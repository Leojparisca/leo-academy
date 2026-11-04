import "server-only";

import { inArray } from "drizzle-orm";
import { LEVELS } from "@/lib/academy";
import type { AcademyDb } from "./client";
import { newStudentCode, readTakenCodes, setStudentCode } from "./helpers";
import {
  attendance,
  curriculumProgress,
  lessonProgress,
  levels,
  livePresence,
  practiceSessions,
  skillScores,
  studentAccessCodes,
  students,
  teacherEvaluations,
  unlockedLevels,
  xpLedger,
} from "./schema";

/**
 * Identifiers used by the early prototype. They are purged on every boot so a
 * device upgraded from that build never shows fictional students again.
 */
const LEGACY_STUDENT_IDS = ["stu_leo", "stu_mia", "stu_tomas"];
const LEGACY_EVALUATION_IDS = ["eval_001", "eval_002", "eval_003"];
const LEGACY_ATTENDANCE_IDS = ["att_001", "att_002", "att_003", "att_004"];
const LEGACY_SESSION_IDS = [
  "session_seed_01",
  "session_seed_02",
  "session_seed_03",
  "session_seed_04",
];

/**
 * Only the curriculum reference rows are seeded. Every student, grade,
 * attendance row and practice session in the database is real user data.
 */
export async function seedDatabase(db: AcademyDb) {
  await db.transaction(async (tx) => {
    await tx
      .insert(levels)
      .values(
        LEVELS.map((level) => ({
          id: level.id,
          ordinal: level.ordinal,
          title: level.title,
          subtitle: level.subtitle,
          focus: level.focus,
          minutes: level.minutes,
          xp: level.xp,
          createdAt: "2026-01-01T00:00:00.000Z",
        })),
      )
      .onConflictDoNothing();

    // Purge prototype data (idempotent: deleting nothing is a no-op).
    // Sequential awaits: a LibSQL transaction queues one statement at a time.
    await tx
      .delete(lessonProgress)
      .where(inArray(lessonProgress.studentId, LEGACY_STUDENT_IDS));
    await tx
      .delete(skillScores)
      .where(inArray(skillScores.studentId, LEGACY_STUDENT_IDS));
    await tx
      .delete(curriculumProgress)
      .where(inArray(curriculumProgress.studentId, LEGACY_STUDENT_IDS));
    await tx.delete(xpLedger).where(inArray(xpLedger.studentId, LEGACY_STUDENT_IDS));
    await tx
      .delete(practiceSessions)
      .where(inArray(practiceSessions.studentId, LEGACY_STUDENT_IDS));
    await tx
      .delete(unlockedLevels)
      .where(inArray(unlockedLevels.studentId, LEGACY_STUDENT_IDS));
    await tx
      .delete(teacherEvaluations)
      .where(inArray(teacherEvaluations.studentId, LEGACY_STUDENT_IDS));
    await tx
      .delete(attendance)
      .where(inArray(attendance.studentId, LEGACY_STUDENT_IDS));
    await tx
      .delete(livePresence)
      .where(inArray(livePresence.studentId, LEGACY_STUDENT_IDS));
    await tx
      .delete(studentAccessCodes)
      .where(inArray(studentAccessCodes.studentId, LEGACY_STUDENT_IDS));
    await tx.delete(students).where(inArray(students.id, LEGACY_STUDENT_IDS));
    await tx
      .delete(teacherEvaluations)
      .where(inArray(teacherEvaluations.id, LEGACY_EVALUATION_IDS));
    await tx.delete(attendance).where(inArray(attendance.id, LEGACY_ATTENDANCE_IDS));
    await tx
      .delete(practiceSessions)
      .where(inArray(practiceSessions.id, LEGACY_SESSION_IDS));
  });

  await backfillAccessCodes(db);
}

/**
 * Every real student needs exactly one private code. A database created before
 * the access-code table existed gets one on the next boot; existing codes are
 * never rotated here.
 */
async function backfillAccessCodes(db: AcademyDb) {
  const rows = await db.select({ id: students.id }).from(students);
  if (!rows.length) return;

  const current = await db
    .select({ studentId: studentAccessCodes.studentId })
    .from(studentAccessCodes);
  const covered = new Set(current.map((row) => row.studentId));
  const missing = rows.filter((row) => !covered.has(row.id));
  if (!missing.length) return;

  const taken = await readTakenCodes(db);
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    for (const row of missing) {
      const code = newStudentCode(taken);
      taken.add(code);
      await setStudentCode(tx, row.id, code, now);
    }
  });
}
