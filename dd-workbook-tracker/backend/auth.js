// Step 2: single shared-password gate for the whole app - not per-user
// accounts. APP_PASSWORD is required at startup (never hardcoded) and also
// doubles as the HMAC key for signing session tokens, so no second secret
// env var is needed for this lightweight setup.

import crypto from "crypto";

const APP_PASSWORD = process.env.APP_PASSWORD;
if (!APP_PASSWORD) {
  throw new Error("APP_PASSWORD environment variable is required (see .env.example)");
}

const COOKIE_NAME = "dd_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Compares two strings in constant time regardless of length, by comparing
// fixed-length digests rather than the raw (variable-length) inputs -
// crypto.timingSafeEqual throws if given buffers of different lengths, and
// an early length check would itself leak timing information.
function constantTimeEqual(a, b) {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function sign(expiresAt) {
  const value = String(expiresAt);
  const signature = crypto.createHmac("sha256", APP_PASSWORD).update(value).digest("hex");
  return `${value}.${signature}`;
}

function verify(token) {
  if (!token || typeof token !== "string") return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;

  const value = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expectedSignature = crypto.createHmac("sha256", APP_PASSWORD).update(value).digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const expectedBuf = Buffer.from(expectedSignature, "hex");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  const expiresAt = Number(value);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

function setSessionCookie(res) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  res.cookie(COOKIE_NAME, sign(expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function requireAuth(req, res, next) {
  if (verify(req.cookies?.[COOKIE_NAME])) return next();
  res.status(401).json({ error: "unauthorized" });
}

export function login(req, res) {
  const password = String(req.body?.password ?? "");
  if (!constantTimeEqual(password, APP_PASSWORD)) {
    return res.status(401).json({ error: "invalid password" });
  }
  setSessionCookie(res);
  res.json({ ok: true });
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
}
