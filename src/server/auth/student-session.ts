import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "leo_student";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Stable across serverless instances. Override with `STUDENT_SESSION_SECRET`
 * (recommended) or inherit the teacher secret.
 */
function studentSecret() {
  return (
    process.env.STUDENT_SESSION_SECRET?.trim() ||
    (process.env.TEACHER_SESSION_SECRET
      ? `${process.env.TEACHER_SESSION_SECRET}.student`
      : `leo-academy:student:${process.env.TEACHER_PIN ?? process.env.PROFESSOR_PIN ?? "5864"}`)
  );
}

function sign(value: string) {
  return createHmac("sha256", studentSecret())
    .update(`leo-student.${value}`)
    .digest("base64url");
}

function createToken(studentId: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${encodeURIComponent(studentId)}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [rawId, rawExpires, signature] = parts;
  const expiresAt = Number(rawExpires);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  const payload = `${rawId}.${rawExpires}`;
  const expected = sign(payload);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(provided, expectedBuffer)) return null;

  try {
    return decodeURIComponent(rawId);
  } catch {
    return null;
  }
}

export async function getStudentSessionId() {
  const store = await cookies();
  return readToken(store.get(COOKIE_NAME)?.value);
}

export async function createStudentSession(studentId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(studentId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroyStudentSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isStudentSessionFor(studentId: string) {
  const sessionId = await getStudentSessionId();
  return Boolean(sessionId && sessionId === studentId);
}
