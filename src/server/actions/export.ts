"use server";

import { asc } from "drizzle-orm";
import type { ActionResult } from "@/lib/academy";
import { isTeacherAuthenticated } from "@/server/auth/teacher-session";
import { getReadyDb } from "@/server/db/client";
import {
  appSettings,
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
} from "@/server/db/schema";

const SERVER_BACKUP_VERSION = 1 as const;

/**
 * A full, human-readable snapshot of the relational database. It is the
 * authoritative export: Dexie only ever holds what one device has seen, while
 * this dump contains every student of the academy.
 */
type ServerBackup = {
  version: typeof SERVER_BACKUP_VERSION;
  source: "server";
  generatedAt: string;
  summary: {
    students: number;
    lessonProgress: number;
    skillScores: number;
    curriculumProgress: number;
    xpLedger: number;
    practiceSessions: number;
    evaluations: number;
    attendance: number;
    totalRows: number;
  };
  students: Awaited<ReturnType<typeof readStudents>>;
  studentCodes: Record<string, string>;
  levels: Awaited<ReturnType<typeof readLevels>>;
  lessonProgress: Awaited<ReturnType<typeof readLessonProgress>>;
  unlockedLevels: Awaited<ReturnType<typeof readUnlockedLevels>>;
  skillScores: Awaited<ReturnType<typeof readSkillScores>>;
  curriculumProgress: Awaited<ReturnType<typeof readCurriculum>>;
  xpLedger: Awaited<ReturnType<typeof readXp>>;
  practiceSessions: Awaited<ReturnType<typeof readSessions>>;
  teacherEvaluations: Awaited<ReturnType<typeof readEvaluations>>;
  attendance: Awaited<ReturnType<typeof readAttendance>>;
  livePresence: Awaited<ReturnType<typeof readPresence>>;
  /** Only non-secret settings are exported (the PIN hash never leaves SQLite). */
  settings: Record<string, string>;
};

async function readStudents() {
  const db = await getReadyDb();
  return db.select().from(students).orderBy(asc(students.name));
}
async function readLevels() {
  const db = await getReadyDb();
  return db.select().from(levels).orderBy(asc(levels.ordinal));
}
async function readLessonProgress() {
  const db = await getReadyDb();
  return db.select().from(lessonProgress);
}
async function readUnlockedLevels() {
  const db = await getReadyDb();
  return db.select().from(unlockedLevels);
}
async function readSkillScores() {
  const db = await getReadyDb();
  return db.select().from(skillScores);
}
async function readCurriculum() {
  const db = await getReadyDb();
  return db.select().from(curriculumProgress);
}
async function readXp() {
  const db = await getReadyDb();
  return db.select().from(xpLedger);
}
async function readSessions() {
  const db = await getReadyDb();
  return db.select().from(practiceSessions);
}
async function readEvaluations() {
  const db = await getReadyDb();
  return db.select().from(teacherEvaluations);
}
async function readAttendance() {
  const db = await getReadyDb();
  return db.select().from(attendance);
}
async function readPresence() {
  const db = await getReadyDb();
  return db.select().from(livePresence);
}

/** Teacher-only full backup of the academy, ready to download as JSON. */
export async function exportServerBackupAction(): Promise<
  ActionResult<ServerBackup>
> {
  if (!(await isTeacherAuthenticated())) {
    return {
      ok: false,
      error: "La sesión del profesor ha caducado. Vuelve a entrar.",
      code: "UNAUTHORIZED",
    };
  }

  try {
    const db = await getReadyDb();

    const [
      studentRows,
      codeRows,
      levelRows,
      progressRows,
      unlockedRows,
      scoreRows,
      curriculumRows,
      xpRows,
      sessionRows,
      evaluationRows,
      attendanceRows,
      presenceRows,
      settingRows,
    ] = await Promise.all([
      readStudents(),
      db.select().from(studentAccessCodes).orderBy(asc(studentAccessCodes.studentId)),
      readLevels(),
      readLessonProgress(),
      readUnlockedLevels(),
      readSkillScores(),
      readCurriculum(),
      readXp(),
      readSessions(),
      readEvaluations(),
      readAttendance(),
      readPresence(),
      db.select().from(appSettings),
    ]);

    const settings: Record<string, string> = {};
    for (const row of settingRows) {
      // Never export hashes or other credentials.
      if (/pin|secret|hash|token/i.test(row.key)) continue;
      settings[row.key] = row.value;
    }

    const backup: ServerBackup = {
      version: SERVER_BACKUP_VERSION,
      source: "server",
      generatedAt: new Date().toISOString(),
      summary: {
        students: studentRows.length,
        lessonProgress: progressRows.length,
        skillScores: scoreRows.length,
        curriculumProgress: curriculumRows.length,
        xpLedger: xpRows.length,
        practiceSessions: sessionRows.length,
        evaluations: evaluationRows.length,
        attendance: attendanceRows.length,
        totalRows:
          studentRows.length +
          progressRows.length +
          unlockedRows.length +
          scoreRows.length +
          curriculumRows.length +
          xpRows.length +
          sessionRows.length +
          evaluationRows.length +
          attendanceRows.length,
      },
      students: studentRows,
      studentCodes: Object.fromEntries(
        codeRows.map((row) => [row.studentId, row.code]),
      ),
      levels: levelRows,
      lessonProgress: progressRows,
      unlockedLevels: unlockedRows,
      skillScores: scoreRows,
      curriculumProgress: curriculumRows,
      xpLedger: xpRows,
      practiceSessions: sessionRows,
      teacherEvaluations: evaluationRows,
      attendance: attendanceRows,
      livePresence: presenceRows,
      settings,
    };

    return { ok: true, data: backup };
  } catch (error) {
    console.error("[leo] Error al exportar el respaldo del servidor", error);
    return {
      ok: false,
      error: "No se pudo leer la base de datos de la academia.",
      code: "BACKUP_ERROR",
    };
  }
}
