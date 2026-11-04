"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { ActionResult, Student } from "@/lib/academy";
import { getStudentSessionId } from "@/server/auth/student-session";
import { isTeacherAuthenticated } from "@/server/auth/teacher-session";
import { getReadyDb } from "@/server/db/client";
import type { Tx } from "@/server/db/helpers";
import {
  lessonProgress,
  levels,
  practiceSessions,
  skillScores,
  students,
} from "@/server/db/schema";

const practiceSchema = z.object({
  clientId: z.string().min(8).max(80),
  studentId: z.string().min(3).max(80),
  levelId: z.string().regex(/^level-\d{2}$/),
  minutes: z.number().int().min(1).max(180),
  skill: z.enum(["melody", "harmony", "rhythm"]),
  score: z.number().int().min(0).max(100),
  createdAt: z.string().min(10).max(40),
});

type PracticeInput = z.infer<typeof practiceSchema>;

/**
 * Writes one practice session against an open transaction. Idempotent: the
 * client id is the primary key, so a retried Server Action never double-counts
 * minutes.
 */
async function persistPractice(
  tx: Tx,
  input: PracticeInput,
  source: "live" | "offline" = "live",
) {
  const studentRows = await tx
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, input.studentId))
    .limit(1);
  const levelRows = await tx
    .select({ id: levels.id })
    .from(levels)
    .where(eq(levels.id, input.levelId))
    .limit(1);

  if (!studentRows[0] || !levelRows[0]) return false;

  const inserted = await tx
    .insert(practiceSessions)
    .values({
      id: `sess_${input.clientId}`,
      studentId: input.studentId,
      levelId: input.levelId,
      skill: input.skill,
      minutes: input.minutes,
      score: input.score,
      source,
      createdAt: input.createdAt,
    })
    .onConflictDoNothing();

  if (inserted.rowsAffected === 0) return false;

  await tx
    .update(students)
    .set({
      totalMinutes: sql`${students.totalMinutes} + ${input.minutes}`,
      weeklyMinutes: sql`${students.weeklyMinutes} + ${input.minutes}`,
      accuracy: sql`cast(round((${students.accuracy} * 4.0 + ${input.score}) / 5.0) as integer)`,
      updatedAt: input.createdAt,
    })
    .where(eq(students.id, input.studentId));

  await tx
    .insert(skillScores)
    .values({
      id: `score_${input.clientId}`,
      studentId: input.studentId,
      skill: input.skill,
      score: input.score,
      source: "lesson",
      createdAt: input.createdAt,
      syncedFrom: source,
    })
    .onConflictDoNothing();

  await tx
    .insert(lessonProgress)
    .values({
      id: `progress_${input.studentId}_${input.levelId}`,
      studentId: input.studentId,
      levelId: input.levelId,
      status: "current",
      progress: 6,
      bestScore: input.score,
      minutesPracticed: input.minutes,
      lastPracticedAt: input.createdAt,
      updatedAt: input.createdAt,
    })
    .onConflictDoUpdate({
      target: [lessonProgress.studentId, lessonProgress.levelId],
      set: {
        progress: sql`min(100, ${lessonProgress.progress} + 6)`,
        minutesPracticed: sql`${lessonProgress.minutesPracticed} + ${input.minutes}`,
        bestScore: sql`max(${lessonProgress.bestScore}, ${input.score})`,
        lastPracticedAt: input.createdAt,
        updatedAt: input.createdAt,
      },
    });

  return true;
}

export async function fetchStudentsAction(): Promise<
  ActionResult<Student[]>
> {
  try {
    const teacher = await isTeacherAuthenticated();
    const sessionId = await getStudentSessionId();

    if (!teacher && !sessionId) {
      return {
        ok: false,
        error: "Abre tu perfil de alumno para ver tu progreso.",
        code: "UNAUTHORIZED",
      };
    }

    const db = await getReadyDb();
    const rows = await db.select().from(students);
    const visible = teacher
      ? rows
      : rows.filter((row) => row.id === sessionId);

    const data: Student[] = visible
      .map((row) => ({
        id: row.id,
        name: row.name,
        firstName: row.firstName,
        initials: row.initials,
        avatarTone: row.avatarTone,
        currentLevel: row.currentLevel,
        age: row.age ?? null,
        // Private teacher notes never reach a student device.
        teacherNotes: teacher ? (row.teacherNotes ?? null) : null,
        streakDays: row.streakDays,
        totalMinutes: row.totalMinutes,
        accuracy: row.accuracy,
        weeklyMinutes: row.weeklyMinutes,
        weeklyGoalMinutes: row.weeklyGoalMinutes,
        joinedAt: row.joinedAt,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { ok: true, data };
  } catch (error) {
    console.error("[leo] No se pudieron leer los alumnos", error);
    return {
      ok: false,
      error: "No se pudo contactar con la academia.",
      code: "DB_UNAVAILABLE",
    };
  }
}

async function canWriteStudent(studentId: string) {
  if (await isTeacherAuthenticated()) return true;
  const sessionId = await getStudentSessionId();
  return Boolean(sessionId && sessionId === studentId);
}

export async function logPracticeAction(
  input: unknown,
): Promise<ActionResult<{ minutes: number }>> {
  const parsed = practiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "La práctica no tiene un formato válido.",
      code: "INVALID_INPUT",
    };
  }

  if (!(await canWriteStudent(parsed.data.studentId))) {
    return {
      ok: false,
      error: "No puedes guardar práctica de otro alumno.",
      code: "UNAUTHORIZED",
    };
  }

  try {
    const db = await getReadyDb();
    await db.transaction((tx) => persistPractice(tx, parsed.data));
    return { ok: true, data: { minutes: parsed.data.minutes } };
  } catch (error) {
    console.error("[leo] Error al guardar práctica", error);
    return {
      ok: false,
      error: "No se pudo guardar la práctica en la academia.",
      code: "DB_ERROR",
    };
  }
}

export async function syncPracticeSessionsAction(
  items: unknown,
): Promise<ActionResult<{ synced: number; rejected: number }>> {
  const parsed = z.array(practiceSchema).max(50).safeParse(items);
  if (!parsed.success) {
    return {
      ok: false,
      error: "La cola offline contiene datos inválidos.",
      code: "INVALID_QUEUE",
    };
  }

  const teacher = await isTeacherAuthenticated();
  if (!teacher) {
    const sessionId = await getStudentSessionId();
    const foreign = parsed.data.some(
      (item) => !sessionId || item.studentId !== sessionId,
    );
    if (foreign) {
      return {
        ok: false,
        error: "La cola contiene práctica de otro alumno.",
        code: "UNAUTHORIZED",
      };
    }
  }

  try {
    const db = await getReadyDb();
    const counts = await db.transaction(async (tx) => {
      let synced = 0;
      let rejected = 0;
      for (const item of parsed.data) {
        if (await persistPractice(tx, item, "offline")) synced += 1;
        else rejected += 1;
      }
      return { synced, rejected };
    });

    return { ok: true, data: counts };
  } catch (error) {
    console.error("[leo] Error al sincronizar la cola offline", error);
    return {
      ok: false,
      error: "No se pudo sincronizar. La cola sigue a salvo.",
      code: "SYNC_ERROR",
    };
  }
}
