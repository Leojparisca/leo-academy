import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getReadyDb } from "@/server/db/client";
import { studentAccessCodes } from "@/server/db/schema";

const TTL_SECONDS = 30 * 24 * 60 * 60;

function secret() {
  const value = process.env.MOBILE_SESSION_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

function signature(payload: string, key: string) {
  return createHmac("sha256", key).update(`leo-mobile.${payload}`).digest("base64url");
}

export function createMobileToken(studentId: string, code: string) {
  const key = secret();
  if (!key) throw new Error("MOBILE_SESSION_SECRET is missing or too short");
  const payload = Buffer.from(JSON.stringify({
    sub: studentId,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    // A code rotation revokes every token for this student without a schema change.
    codeTag: createHmac("sha256", key).update(`code.${code}`).digest("base64url"),
  })).toString("base64url");
  return `${payload}.${signature(payload, key)}`;
}

export async function getMobileStudentId(request: Request): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header);
  if (!match) return null;
  const [payload, supplied] = match[1].split(".");
  const expected = signature(payload, key);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown; exp?: unknown; codeTag?: unknown;
    };
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number" ||
      claims.exp <= Math.floor(Date.now() / 1000) || typeof claims.codeTag !== "string") return null;

    const db = await getReadyDb();
    const rows = await db.select({ code: studentAccessCodes.code })
      .from(studentAccessCodes).where(eq(studentAccessCodes.studentId, claims.sub)).limit(1);
    const currentCode = rows[0]?.code;
    if (!currentCode) return null;
    const currentTag = createHmac("sha256", key).update(`code.${currentCode}`).digest("base64url");
    const x = Buffer.from(claims.codeTag);
    const y = Buffer.from(currentTag);
    if (x.length !== y.length || !timingSafeEqual(x, y)) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

export function mobileAuthConfigured() {
  return Boolean(secret());
}
