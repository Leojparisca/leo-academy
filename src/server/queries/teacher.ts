import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";
import type {
  AttendanceRecord,
  Student,
  StudentRadar,
  TeacherDashboardData,
  TeacherEvaluation,
} from "@/lib/academy";
import { getReadyDb } from "@/server/db/client";
import {
  attendance,
  skillScores,
  students as studentsTable,
  teacherEvaluations,
  unlockedLevels,
} from "@/server/db/schema";
import { getStudentCodes, rowToStudent } from "@/server/queries/students";

export async function getStudents(): Promise<Student[]> {
  const db = await getReadyDb();
  const rows = await db
    .select()
    .from(studentsTable)
    .orderBy(asc(studentsTable.name));
  return rows.map((row) => rowToStudent(row));
}

export async function getTeacherDashboard(): Promise<TeacherDashboardData> {
  try {
    const db = await getReadyDb();

    const studentRows = (
      await db.select().from(studentsTable).orderBy(asc(studentsTable.name))
    ).map((row) => rowToStudent(row));

    const [evaluationRows, attendanceRows, scoreRows, unlockedRow, codes] =
      await Promise.all([
        db
          .select({
            id: teacherEvaluations.id,
            studentId: teacherEvaluations.studentId,
            studentName: studentsTable.name,
            levelId: teacherEvaluations.levelId,
            melody: teacherEvaluations.melody,
            harmony: teacherEvaluations.harmony,
            rhythm: teacherEvaluations.rhythm,
            posture: teacherEvaluations.posture,
            feedback: teacherEvaluations.feedback,
            homework: teacherEvaluations.homework,
            teacherName: teacherEvaluations.teacherName,
            createdAt: teacherEvaluations.createdAt,
          })
          .from(teacherEvaluations)
          .innerJoin(
            studentsTable,
            eq(teacherEvaluations.studentId, studentsTable.id),
          )
          .orderBy(desc(teacherEvaluations.createdAt))
          .limit(8),
        db
          .select()
          .from(attendance)
          .orderBy(desc(attendance.date))
          .limit(24),
        // Radar: average of every skill score the student has ever earned.
        // Teacher evaluations write to `skill_scores` too, so the triangle
        // reflects class work, games and lessons at once.
        db
          .select({
            studentId: skillScores.studentId,
            skill: skillScores.skill,
            avg: sql<number>`avg(${skillScores.score})`,
          })
          .from(skillScores)
          .groupBy(skillScores.studentId, skillScores.skill),
        db
          .select({ count: sql<number>`count(*)` })
          .from(unlockedLevels),
        getStudentCodes(),
      ]);

    const radar: Record<string, StudentRadar> = {};
    for (const row of studentRows) {
      radar[row.id] = { melody: 0, harmony: 0, rhythm: 0 };
    }
    for (const row of scoreRows) {
      if (!row.skill) continue;
      const bucket = radar[row.studentId];
      if (!bucket) continue;
      bucket[row.skill] = Math.round(Number(row.avg) || 0);
    }

    return {
      source: "sqlite",
      students: studentRows,
      studentCodes: codes,
      evaluations: evaluationRows as TeacherEvaluation[],
      attendance: attendanceRows as AttendanceRecord[],
      radar,
      totalMinutes: studentRows.reduce(
        (sum, student) => sum + student.totalMinutes,
        0,
      ),
      unlockedCount: Number(unlockedRow[0]?.count ?? 0),
    };
  } catch (error) {
    console.error("[leo] No se pudo leer la mesa del profesor", error);
    return {
      source: "unavailable",
      students: [],
      studentCodes: {},
      evaluations: [],
      attendance: [],
      radar: {},
      totalMinutes: 0,
      unlockedCount: 0,
    };
  }
}
