import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { limitsFor } from "@/lib/plans";
import type { Viewer } from "@/lib/types";
import { config, isProduction } from "../config";
import { ApiError, rateLimit } from "../http";
import { getStore } from "../store";
import type { UserRecord } from "../store/types";

// Sessions are stateless signed tokens: `v1.<payload>.<hmac>`. Browsers get
// them in an httpOnly cookie; native clients can send the same token as
// `Authorization: Bearer <token>` (returned by /api/me as `token`).
//
// Every visitor gets a private guest account on first use, so reporting and
// alerts work without sign-up. Verifying an email (server/auth/email.ts)
// attaches it to the account so purchases follow the person across devices.

export const SESSION_COOKIE = "haven_session";
const MAX_AGE_S = 60 * 60 * 24 * 400;

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function sign(payload: string) {
  return createHmac("sha256", config.sessionSecret).update(payload).digest();
}

export function createToken(userId: string): string {
  const payload = b64(JSON.stringify({ u: userId, t: Math.floor(Date.now() / 1000) }));
  return `v1.${payload}.${b64(sign(payload))}`;
}

export function verifyToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [v, payload, mac] = token.split(".");
  if (v !== "v1" || !payload || !mac) return null;
  const expected = sign(payload);
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { u, t } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; t: number };
    if (typeof u !== "string" || Date.now() / 1000 - t > MAX_AGE_S) return null;
    return u;
  } catch {
    return null;
  }
}

async function tokenFromRequest(): Promise<string | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  const c = await cookies();
  return c.get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(userId: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function toViewer(user: UserRecord): Promise<Viewer> {
  const ent = await getStore().getEntitlement(user.id);
  const plan = ent?.plan ?? "free";
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plan,
    limits: limitsFor(plan),
    createdAt: user.createdAt,
  };
}

/** The signed-in (or guest) user, or null when the request has no valid session. */
export async function currentUser(): Promise<UserRecord | null> {
  const id = verifyToken(await tokenFromRequest());
  if (!id) return null;
  return getStore().getUser(id);
}

export async function currentViewer(): Promise<Viewer | null> {
  const user = await currentUser();
  return user ? toViewer(user) : null;
}

/**
 * The current user, creating a guest account if there is none. Guest creation
 * is rate limited per IP so accounts can't be minted to dodge report limits.
 */
export async function requireUser(ip: string): Promise<UserRecord> {
  const existing = await currentUser();
  if (existing) return existing;
  rateLimit(`guest:${ip}`, 30, 60 * 60 * 1000);
  const user = await getStore().createUser({ displayName: "Guest" });
  await setSessionCookie(user.id);
  return user;
}

export async function requireViewer(ip: string): Promise<Viewer> {
  return toViewer(await requireUser(ip));
}

export function assertSignedIn(user: UserRecord | null): asserts user is UserRecord {
  if (!user) throw new ApiError(401, "Session expired. Refresh the app.", "unauthorized");
}
