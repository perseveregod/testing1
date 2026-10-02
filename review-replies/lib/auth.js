// Password hashing (scrypt) and session cookies.

const crypto = require("crypto");

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const COOKIE = "rd_session";

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const newToken = () => crypto.randomBytes(32).toString("base64url");
// Reset links are stored as a hash, so reading the database doesn't hand anyone a working link.
const tokenHash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

function readCookie(req, name = COOKIE) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function sessionCookie(token, { secure, maxAgeMs = SESSION_TTL_MS } = {}) {
  const attrs = [`${COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

function validatePassword(password) {
  const p = String(password ?? "");
  if (p.length < 8) return { error: "Use a password with at least 8 characters." };
  if (p.length > 200) return { error: "That password is too long." };
  return { password: p };
}

function validateCredentials(email, password) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) return { error: "Enter a valid email address." };
  const p = validatePassword(password);
  if (p.error) return p;
  return { email: e, password: p.password };
}

module.exports = {
  SESSION_TTL_MS,
  RESET_TTL_MS,
  hashPassword,
  verifyPassword,
  newToken,
  tokenHash,
  readCookie,
  sessionCookie,
  validatePassword,
  validateCredentials,
};
