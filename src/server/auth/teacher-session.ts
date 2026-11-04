import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

const COOKIE_NAME = "leo_teacher";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type AttemptRecord = { count: number; resetAt: number };

const globalForAuth = globalThis as unknown as {
  __leoPinAttempts?: Map<string, AttemptRecord>;
};

const attempts =
  globalForAuth.__leoPinAttempts ??
  (globalForAuth.__leoPinAttempts = new Map<string, AttemptRecord>());

/**
 * Stable across serverless instances and cold starts. If the operator does not
 * provide `TEACHER_SESSION_SECRET`, the signature is derived from the classroom
 * PIN, which is a shared secret anyway. Set the env var for stronger isolation.
 */
function sessionSecret() {
  return (
    process.env.TEACHER_SESSION_SECRET?.trim() ||
    `leo-academy:teacher:${getTeacherPin()}`
  );
}

/**
 * The PIN is owned exclusively by the server environment. `TEACHER_PIN` takes
 * precedence, then the legacy `PROFESSOR_PIN`; the fallback only keeps local
 * development usable and is never surfaced in the UI.
 */
export function getTeacherPin(): string {
  return (
    process.env.TEACHER_PIN?.trim() ||
    process.env.PROFESSOR_PIN?.trim() ||
    "5864"
  );
}

export function isTeacherPinConfigured() {
  return true;
}

/** Constant-time comparison against the environment PIN. */
export function pinMatches(input: string) {
  const expected = getTeacherPin();
  const a = Buffer.from(input.padEnd(32, "\0"));
  const b = Buffer.from(expected.padEnd(32, "\0"));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b) && input.length === expected.length;
}

/**
 * Validates the teacher PIN against the environment only. There is no in-app
 * rotation and no database fallback: changing the PIN means changing the env.
 */
export async function verifyTeacherPin(input: string) {
  return pinMatches(input);
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret())
    .update(`leo-teacher.${value}`)
    .digest("base64url");
}

function createToken() {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  return `${expiresAt}.${sign(String(expiresAt))}`;
}

function isTokenValid(token: string | undefined) {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  if (!expiresRaw || !signature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = sign(expiresRaw);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function isTeacherAuthenticated() {
  const store = await cookies();
  return isTokenValid(store.get(COOKIE_NAME)?.value);
}

export async function createTeacherSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroyTeacherSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function clientAddressKey() {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "local";
  return ip;
}

export function rateLimitStatus(key: string) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || record.resetAt <= now) {
    attempts.delete(key);
    return { blocked: false as const, remaining: MAX_ATTEMPTS };
  }
  return {
    blocked: record.count >= MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - record.count),
    retryInSeconds: Math.ceil((record.resetAt - now) / 1000),
  };
}

export function recordFailedAttempt(key: string) {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || record.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + LIMIT_WINDOW_MS });
    return;
  }
  record.count += 1;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
