import { eq } from "drizzle-orm";
import { z } from "zod";
import { allowMobileRedeem } from "@/server/auth/mobile-rate-limit";
import { createMobileToken, mobileAuthConfigured } from "@/server/auth/mobile-session";
import { getReadyDb } from "@/server/db/client";
import { normalizeCode } from "@/server/db/helpers";
import { studentAccessCodes, students } from "@/server/db/schema";

const redeemSchema = z.object({ code: z.string().trim().min(4).max(8).regex(/^[A-Za-z0-9]+$/) }).strict();
const genericFailure = () => Response.json({ error: "Unable to redeem code." }, { status: 401 });

export async function POST(request: Request) {
  if (!mobileAuthConfigured()) return Response.json({ error: "Mobile authentication unavailable." }, { status: 503 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2_000) return genericFailure();
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2_000) return genericFailure();
    body = JSON.parse(raw);
  } catch { return genericFailure(); }
  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) return genericFailure();

  const code = normalizeCode(parsed.data.code);
  // Prefer the deployment's client-IP header; do not trust an arbitrary
  // leftmost X-Forwarded-For value supplied by the caller.
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "unknown";
  if (!allowMobileRedeem(ip, code)) return Response.json({ error: "Unable to redeem code." }, { status: 429 });

  try {
    const db = await getReadyDb();
    const rows = await db.select({
      id: students.id, name: students.name, firstName: students.firstName,
      code: studentAccessCodes.code,
    }).from(studentAccessCodes)
      .innerJoin(students, eq(studentAccessCodes.studentId, students.id))
      .where(eq(studentAccessCodes.code, code)).limit(1);
    const student = rows[0];
    if (!student) return genericFailure();

    const now = new Date().toISOString();
    await db.update(studentAccessCodes).set({ lastLoginAt: now }).where(eq(studentAccessCodes.studentId, student.id));
    const token = createMobileToken(student.id, student.code);
    return Response.json({ token, expiresIn: 30 * 24 * 60 * 60, student: { id: student.id, name: student.name, firstName: student.firstName } });
  } catch (error) {
    console.error("[leo] Mobile redeem failed", error);
    return Response.json({ error: "Academy unavailable." }, { status: 503 });
  }
}
