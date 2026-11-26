import { eq } from "drizzle-orm";
import { getMobileStudentId, mobileAuthConfigured } from "@/server/auth/mobile-session";
import { getReadyDb } from "@/server/db/client";
import { rowToStudent } from "@/server/queries/students";
import { curriculumProgress, lessonProgress, practiceSessions, skillScores, students, xpLedger } from "@/server/db/schema";

const unauthorized = () => Response.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  if (!mobileAuthConfigured()) return Response.json({ error: "Mobile authentication unavailable." }, { status: 503 });
  const studentId = await getMobileStudentId(request);
  if (!studentId) return unauthorized();
  try {
    const db = await getReadyDb();
    const [studentRows, lessonRows, curriculumRows, scoreRows, xpRows, sessionRows] = await Promise.all([
      db.select().from(students).where(eq(students.id, studentId)).limit(1),
      db.select().from(lessonProgress).where(eq(lessonProgress.studentId, studentId)),
      db.select().from(curriculumProgress).where(eq(curriculumProgress.studentId, studentId)),
      db.select().from(skillScores).where(eq(skillScores.studentId, studentId)),
      db.select().from(xpLedger).where(eq(xpLedger.studentId, studentId)),
      db.select().from(practiceSessions).where(eq(practiceSessions.studentId, studentId)),
    ]);
    if (!studentRows[0]) return Response.json({ error: "Profile unavailable." }, { status: 404 });
    const student = rowToStudent(studentRows[0], true);
    return Response.json({
      student,
      lessonProgress: lessonRows.map(({ levelId, status, progress, bestScore, minutesPracticed, lastPracticedAt, updatedAt }) => ({ levelId, status, progress, bestScore, minutesPracticed, lastPracticedAt, updatedAt })),
      curriculumProgress: curriculumRows.map(({ nodeId, branch, level, stars, accuracy, createdAt, updatedAt }) => ({ nodeId, branch, level, stars, accuracy, createdAt, updatedAt })),
      skillScores: scoreRows.map(({ id, skill, score, source, createdAt }) => ({ clientId: id, skill, score, source, createdAt })),
      xpLedger: xpRows.map(({ id, amount, source, detail, createdAt }) => ({ clientId: id, amount, source, detail, createdAt })),
      practiceSessions: sessionRows.map(({ id, levelId, skill, minutes, score, source, createdAt }) => ({ clientId: id.startsWith("sess_") ? id.slice(5) : id, levelId, skill, minutes, score, source, createdAt })),
      xpTotal: xpRows.reduce((total, row) => total + row.amount, 0),
      readAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[leo] Mobile progress failed", error);
    return Response.json({ error: "Academy unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
