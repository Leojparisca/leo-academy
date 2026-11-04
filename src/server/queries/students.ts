import "server-only";

import { asc, eq } from "drizzle-orm";
import type { Student } from "@/lib/academy";
import { getReadyDb } from "@/server/db/client";
import { studentAccessCodes, students } from "@/server/db/schema";

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
