import "server-only";

import { asc, eq } from "drizzle-orm";
import type { Student } from "@/lib/academy";
import type { StudentProgressPackage } from "@/lib/progress-package";
import { getReadyDb } from "@/server/db/client";
import {
  curriculumProgress,
  lessonProgress,
  skillScores,
  studentAccessCodes,
  students,
  xpLedger,
} from "@/server/db/schema";

export function rowToStudent(
  row: typeof students.$inferSelect,
  redact = false,
): Student {
  return {
    id: row.id,
    name: row.name,
    firstName: row.firstName,
    initials: row.initials,
    avatarTone: row.avatarTone,
    currentLevel: row.currentLevel,
    age: row.age ?? null,
    teacherNotes: redact ? null : (row.teacherNotes ?? null),
    streakDays: row.streakDays,
    totalMinutes: row.totalMinutes,
    accuracy: row.accuracy,
    weeklyMinutes: row.weeklyMinutes,
    weeklyGoalMinutes: row.weeklyGoalMinutes,
    joinedAt: row.joinedAt,
    updatedAt: row.updatedAt,
  };
}

export async function getStudentById(
  id: string,
  redact = true,
): Promise<Student | null> {
  try {
    const db = await getReadyDb();
    const rows = await db
      .select()
      .from(students)
      .where(eq(students.id, id))
      .limit(1);
    const row = rows[0];
    return row ? rowToStudent(row, redact) : null;
  } catch {
    return null;
  }
}

export async function getStudentCodes(): Promise<Record<string, string>> {
  try {
    const db = await getReadyDb();
    const rows = await db
      .select({
        studentId: studentAccessCodes.studentId,
        code: studentAccessCodes.code,
      })
      .from(studentAccessCodes)
      .orderBy(asc(studentAccessCodes.studentId));
    return Object.fromEntries(rows.map((row) => [row.studentId, row.code]));
  } catch {
    return {};
  }
}

/**
 * The whole progress package of one student, read in a single pass.
 *
 * The student id comes from the session cookie and from nowhere else: this
 * function has no `studentId` parameter, so a caller cannot point it at
 * somebody else's row. Every table below is filtered by that same id, which is
 * also enforced by the foreign keys in SQLite.
 */
export async function getStudentProgressPackage(
  studentId: string,
): Promise<StudentProgressPackage | null> {
  try {
    const db = await getReadyDb();
    const [studentRows, lessonRows, curriculumRows, scoreRows, xpRows] =
      await Promise.all([
        db.select().from(students).where(eq(students.id, studentId)).limit(1),
        db
          .select()
          .from(lessonProgress)
          .where(eq(lessonProgress.studentId, studentId)),
        db
          .select()
          .from(curriculumProgress)
          .where(eq(curriculumProgress.studentId, studentId)),
        db.select().from(skillScores).where(eq(skillScores.studentId, studentId)),
        db.select().from(xpLedger).where(eq(xpLedger.studentId, studentId)),
      ]);

    const studentRow = studentRows[0];
    if (!studentRow) return null;

    return {
      student: rowToStudent(studentRow, true),
      lessonProgress: lessonRows
        .map((row) => ({
          levelId: row.levelId,
          status: row.status,
          progress: row.progress,
          minutesPracticed: row.minutesPracticed,
          updatedAt: row.updatedAt,
        }))
        .sort((left, right) => left.levelId.localeCompare(right.levelId)),
      curriculumProgress: curriculumRows
        .map((row) => ({
          nodeId: row.nodeId,
          branch: row.branch,
          level: row.level,
          stars: Math.min(3, Math.max(1, row.stars)) as 1 | 2 | 3,
          accuracy: row.accuracy,
          updatedAt: row.updatedAt,
        }))
        .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
      skillScores: scoreRows
        .map((row) => ({
          clientId: row.id,
          skill: row.skill,
          score: row.score,
          source: row.source,
          createdAt: row.createdAt,
        }))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      xpLedger: xpRows
        .map((row) => ({
          clientId: row.id,
          amount: row.amount,
          source: row.source,
          detail: row.detail,
          createdAt: row.createdAt,
        }))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      readAt: new Date().toISOString(),
    };
  } catch {
    // An unreachable academy is a normal state for this app: the caller keeps
    // whatever is on the device and shows the "we could not fetch it" state.
    return null;
  }
}
