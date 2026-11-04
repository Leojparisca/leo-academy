import "server-only";

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getReadyDb } from "@/server/db/client";
import { appSettings } from "@/server/db/schema";

const COOKIE_NAME = "leo_teacher";
const TEACHER_PIN_KEY = "teacher_pin_hash";
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
 * The PIN has a usable classroom default; a deployment can override it with
 * `PROFESSOR_PIN` (or the legacy `TEACHER_PIN`), and the teacher can rotate it
 * from the panel (stored as a salted scrypt hash in the database).
 */
export function getTeacherPin(): string {
  return (
    process.env.PROFESSOR_PIN?.trim() ||
    process.env.TEACHER_PIN?.trim() ||
    "1006"
  );
}

export function isTeacherPinConfigured() {
  return true;
}

export function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyHashedPin(pin: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const candidate = scryptSync(pin, salt, 32).toString("hex");
  const a = Buffer.from(candidate);
  const b = Buffer.from(digest);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Constant-time comparison against the environment/default PIN. */
export function pinMatches(input: string) {
  const expected = getTeacherPin();
  const a = Buffer.from(input.padEnd(32, "\0"));
  const b = Buffer.from(expected.padEnd(32, "\0"));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b) && input.length === expected.length;
}

/**
 * Checks the teacher PIN, preferring the hash stored from the panel. Falls
 * back to PROFESSOR_PIN / 1006 when the database is unavailable.
 */
export async function verifyTeacherPin(input: string) {
  try {
    const db = await getReadyDb();
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, TEACHER_PIN_KEY))
      .limit(1);
    const row = rows[0];
    if (row?.value) return verifyHashedPin(input, row.value);
  } catch {
    // Database offline: the environment default still opens the door.
  }
  return pinMatches(input);
}

export async function saveTeacherPinHash(pin: string) {
  const now = new Date().toISOString();
  const db = await getReadyDb();
  await db
    .insert(appSettings)
    .values({ key: TEACHER_PIN_KEY, value: hashPin(pin), updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: hashPin(pin), updatedAt: now },
    });
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
