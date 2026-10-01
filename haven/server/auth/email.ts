import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";
import { ApiError, rateLimit } from "../http";
import { getStore } from "../store";
import type { UserRecord } from "../store/types";
import { setSessionCookie } from "./session";

// Email one-time-code sign-in. With Supabase configured, Supabase Auth sends
// and verifies the code (enable "Email OTP" and put {{ .Token }} in the email
// template). Without it (demo mode), the code is derived from the session
// secret, the email and a 10-minute window, so every server instance agrees on
// it with no shared storage, and it's shown on screen instead of emailed.

const WINDOW_MS = 10 * 60_000;
const attempts = new Map<string, number>();

function demoCode(email: string, window: number): string {
  const mac = createHmac("sha256", config.sessionSecret).update(`${email.toLowerCase()}:${window}`).digest();
  return String(mac.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

function supabaseAuth() {
  if (!config.store.supabaseUrl || !config.store.supabaseAnonKey) return null;
  return createClient(config.store.supabaseUrl, config.store.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth;
}

export async function startEmailSignIn(email: string, ip: string, origin?: string): Promise<{ devCode?: string; mode: "code" | "link" }> {
  rateLimit(`otp-ip:${ip}`, 10, 3_600_000);
  rateLimit(`otp-email:${email}`, 5, 3_600_000);
  const auth = supabaseAuth();
  if (auth) {
    // Supabase's default email (editable only with custom SMTP) carries a
    // sign-in link. It lands on /auth/callback, which finishes sign-in; if the
    // template has been customized with {{ .Token }}, the code works too.
    const { error } = await auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: origin ? `${origin}/auth/callback` : undefined },
    });
    if (error) {
      const limited = /rate|limit|too many/i.test(error.message);
      throw new ApiError(
        limited ? 429 : 502,
        limited ? "Too many sign-in emails right now. Wait a few minutes and try again." : "Couldn't send the email. Try again shortly.",
        "email_failed",
      );
    }
    return { mode: "link" };
  }
  const code = demoCode(email, Math.floor(Date.now() / WINDOW_MS));
  return { devCode: code, mode: "code" };
}

async function verifyCode(email: string, code: string): Promise<boolean> {
  const auth = supabaseAuth();
  if (auth) {
    const { data, error } = await auth.verifyOtp({ email, token: code, type: "email" });
    return !error && Boolean(data.user);
  }
  const n = (attempts.get(email) ?? 0) + 1;
  attempts.set(email, n);
  if (n > 8) return false;
  // Accept the current window and the previous one, so a code typed right
  // after the window rolls over still works.
  const w = Math.floor(Date.now() / WINDOW_MS);
  const given = Buffer.from(code.padStart(6, "0"));
  const ok = [w, w - 1].some((win) => {
    const expected = Buffer.from(demoCode(email, win));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
  if (ok) attempts.delete(email);
  return ok;
}

/**
 * Verifies the code, then either attaches the email to the current guest
 * account or, if the email already has an account, switches to it.
 */
export async function verifyEmailSignIn(email: string, code: string, current: UserRecord | null, ip: string) {
  rateLimit(`otp-verify:${ip}`, 20, 3_600_000);
  if (!(await verifyCode(email, code))) {
    throw new ApiError(400, "That code is incorrect or expired.", "bad_code");
  }
  return signInAs(email, current);
}

/** Finishes sign-in from the emailed link: Supabase hands back an access token for the verified email. */
export async function linkSignIn(accessToken: string, current: UserRecord | null, ip: string) {
  rateLimit(`otp-verify:${ip}`, 20, 3_600_000);
  const auth = supabaseAuth();
  if (!auth) throw new ApiError(400, "Email links aren't enabled.", "bad_link");
  const { data, error } = await auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) throw new ApiError(400, "That sign-in link is invalid or expired. Request a new one.", "bad_link");
  return signInAs(email, current);
}

async function signInAs(email: string, current: UserRecord | null) {
  const store = getStore();
  const existing = await store.getUserByEmail(email);
  let user: UserRecord;
  if (existing) {
    user = existing;
  } else if (current && !current.email) {
    await store.updateUser(current.id, { email, displayName: email.split("@")[0]! });
    user = (await store.getUser(current.id))!;
  } else {
    user = await store.createUser({ email, displayName: email.split("@")[0]! });
  }
  await setSessionCookie(user.id);
  return user;
}
