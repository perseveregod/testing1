import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config, isProduction } from "../config";
import { ApiError, rateLimit } from "../http";
import { getStore } from "../store";
import type { UserRecord } from "../store/types";
import { setSessionCookie } from "./session";

// Email one-time-code sign-in. With Supabase configured, Supabase Auth sends
// and verifies the code (enable "Email OTP" and put {{ .Token }} in the email
// template). Without it, development mode generates the code locally and
// returns it in the response so the flow can be tested end to end.

const codes = new Map<string, { hash: Buffer; expires: number; attempts: number }>();
const hash = (s: string) => createHash("sha256").update(s).digest();

function supabaseAuth() {
  if (!config.store.supabaseUrl || !config.store.supabaseAnonKey) return null;
  return createClient(config.store.supabaseUrl, config.store.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth;
}

export async function startEmailSignIn(email: string, ip: string): Promise<{ devCode?: string }> {
  rateLimit(`otp-ip:${ip}`, 10, 3_600_000);
  rateLimit(`otp-email:${email}`, 5, 3_600_000);
  const auth = supabaseAuth();
  if (auth) {
    const { error } = await auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw new ApiError(502, "Couldn't send the code. Try again shortly.", "email_failed");
    return {};
  }
  if (isProduction) throw new ApiError(503, "Email sign-in isn't configured.", "auth_unavailable");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  codes.set(email, { hash: hash(code), expires: Date.now() + 10 * 60_000, attempts: 0 });
  console.info(`[haven] dev sign-in code for ${email}: ${code}`);
  return { devCode: code };
}

async function verifyCode(email: string, code: string): Promise<boolean> {
  const auth = supabaseAuth();
  if (auth) {
    const { data, error } = await auth.verifyOtp({ email, token: code, type: "email" });
    return !error && Boolean(data.user);
  }
  const entry = codes.get(email);
  if (!entry || entry.expires < Date.now() || entry.attempts >= 5) return false;
  entry.attempts++;
  const ok = timingSafeEqual(entry.hash, hash(code));
  if (ok) codes.delete(email);
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
