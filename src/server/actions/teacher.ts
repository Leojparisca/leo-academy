"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/academy";
import { LEVELS } from "@/lib/academy";
import {
  clientAddressKey,
  clearAttempts,
  createTeacherSession,
  destroyTeacherSession,
  getTeacherPin,
  isTeacherAuthenticated,
  rateLimitStatus,
  recordFailedAttempt,
  saveTeacherPinHash,
  verifyTeacherPin,
} from "@/server/auth/teacher-session";
import { getReadyDb } from "@/server/db/client";
import {
  createStudentWithCode,
  grantLevels,
  newStudentCode,
  readTakenCodes,
  setStudentCode,
  splitName,
} from "@/server/db/helpers";
import {
  attendance,
  lessonProgress,
  levels,
  skillScores,
  studentAccessCodes,
  students,
  teacherEvaluations,
  unlockedLevels,
} from "@/server/db/schema";

const pinSchema = z.string().length(4);

export async function verifyTeacherPinAction(
  input: unknown,
): Promise<ActionResult<{ authenticated: true }>> {
  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Introduce el PIN del profesor." };
  }

  if (!getTeacherPin()) {
    return {
      ok: false,
      error:
        "El PIN del profesor no está configurado en el servidor. Añade PROFESSOR_PIN.",
      code: "PIN_NOT_CONFIGURED",
    };
  }

  const address = await clientAddressKey();
  const limit = rateLimitStatus(address);
  if (limit.blocked) {
    return {
      ok: false,
      error: `Demasiados intentos. Prueba de nuevo en ${Math.ceil(
        (limit.retryInSeconds ?? 60) / 60,
      )} min.`,
      code: "RATE_LIMITED",
    };
  }

  if (!(await verifyTeacherPin(parsed.data))) {
    recordFailedAttempt(address);
    await new Promise((resolve) => setTimeout(resolve, 420));
    return { ok: false, error: "Ese PIN no abre la mesa del profesor." };
  }

  clearAttempts(address);
  await createTeacherSession();
  revalidatePath("/profesor");
  return { ok: true, data: { authenticated: true } };
}

export async function logoutTeacherAction(): Promise<ActionResult<null>> {
  await destroyTeacherSession();
  revalidatePath("/profesor");
  return { ok: true, data: null };
}

const evaluationSchema = z.object({
  studentId: z.string().min(3).max(80),
  levelId: z.string().regex(/^level-\d{2}$/),
  melody: z.number().int().min(0).max(100),
  harmony: z.number().int().min(0).max(100),
  rhythm: z.number().int().min(0).max(100),
  posture: z.number().int().min(0).max(100).default(0),
  feedback: z.string().trim().min(8).max(600),
  homework: z.string().trim().max(400).optional(),
  unlockNext: z.boolean().default(false),
});

export async function saveEvaluationAction(
  input: unknown,
): Promise<ActionResult<{ evaluationId: string }>> {
  if (!(await isTeacherAuthenticated())) {
    return {
      ok: false,
      error: "La sesión del profesor ha caducado. Vuelve a entrar.",
      code: "UNAUTHORIZED",
    };
  }

  const parsed = evaluationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa la evaluación: faltan datos o el texto es demasiado corto.",
      code: "INVALID_INPUT",
    };
  }

  try {
    const db = await getReadyDb();
    const payload = parsed.data;
    const evaluationId = `eval_${randomUUID()}`;
    const now = new Date().toISOString();

    await db.transaction(async (tx) => {
      const studentRows = await tx
        .select()
        .from(students)
        .where(eq(students.id, payload.studentId))
        .limit(1);
      const student = studentRows[0];

      if (!student) throw new Error("STUDENT_NOT_FOUND");

      const levelRows = await tx
        .select()
        .from(levels)
        .where(eq(levels.id, payload.levelId))
        .limit(1);

      if (!levelRows[0]) throw new Error("LEVEL_NOT_FOUND");

      await tx.insert(teacherEvaluations).values({
        id: evaluationId,
        studentId: payload.studentId,
        levelId: payload.levelId,
        teacherName: "Prof. Leo",
        melody: payload.melody,
        harmony: payload.harmony,
        rhythm: payload.rhythm,
        posture: payload.posture,
        feedback: payload.feedback,
        homework: payload.homework || null,
        createdAt: now,
      });

      const skills = [
        ["melody", payload.melody],
        ["harmony", payload.harmony],
        ["rhythm", payload.rhythm],
      ] as const;

      for (const [skill, score] of skills) {
        await tx
          .insert(skillScores)
          .values({
            id: `score_${evaluationId}_${skill}`,
            studentId: payload.studentId,
            skill,
            score,
            source: "teacher",
            createdAt: now,
            syncedFrom: "teacher",
          })
          .onConflictDoNothing();
      }

      if (payload.unlockNext && student.currentLevel < LEVELS.length) {
        const nextLevel = LEVELS.find(
          (candidate) => candidate.ordinal === student.currentLevel + 1,
        );

        if (nextLevel) {
          await tx
            .update(lessonProgress)
            .set({ status: "completed", progress: 100, updatedAt: now })
            .where(
              and(
                eq(lessonProgress.studentId, payload.studentId),
                eq(lessonProgress.levelId, payload.levelId),
              ),
            );

          await tx
            .insert(unlockedLevels)
            .values({
              id: `unlocked_${payload.studentId}_${nextLevel.id}`,
              studentId: payload.studentId,
              levelId: nextLevel.id,
              unlockedAt: now,
              unlockedBy: "teacher",
              note: "Desbloqueado tras evaluación",
            })
            .onConflictDoNothing();

          await tx
            .insert(lessonProgress)
            .values({
              id: `progress_${payload.studentId}_${nextLevel.id}`,
              studentId: payload.studentId,
              levelId: nextLevel.id,
              status: "current",
              progress: 0,
              bestScore: 0,
              minutesPracticed: 0,
              lastPracticedAt: null,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [lessonProgress.studentId, lessonProgress.levelId],
              set: { status: "current", updatedAt: now },
            });

          await tx
            .update(students)
            .set({ currentLevel: nextLevel.ordinal, updatedAt: now })
            .where(eq(students.id, payload.studentId));
        }
      } else {
        await tx
          .update(students)
          .set({ updatedAt: now })
          .where(eq(students.id, payload.studentId));
      }
    });

    revalidatePath("/profesor");
    revalidatePath("/mapa");
    return { ok: true, data: { evaluationId } };
  } catch (error) {
    console.error("[leo] Error al guardar evaluación", error);
    return {
      ok: false,
      error: "No se pudo guardar la evaluación. Inténtalo otra vez.",
      code: "DB_ERROR",
    };
  }
}

const newStudentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  age: z.number().int().min(3).max(99).nullable().optional(),
  level: z.number().int().min(1).max(8),
  weeklyGoalMinutes: z.number().int().min(30).max(600),
  notes: z.string().trim().max(800).optional(),
  /** Browser-generated idempotency key: retries must not create duplicates. */
  clientId: z.string().trim().min(8).max(80).optional(),
  /** Code shown to the teacher immediately after the Dexie write. */
  preferredCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,8}$/)
    .optional(),
});

const updateStudentSchema = z.object({
  studentId: z.string().min(3).max(80),
  name: z.string().trim().min(2).max(80),
  age: z.number().int().min(3).max(99).nullable().optional(),
  level: z.number().int().min(1).max(8),
  weeklyGoalMinutes: z.number().int().min(30).max(600),
  notes: z.string().trim().max(800).optional(),
});

export async function addStudentAction(
  input: unknown,
): Promise<ActionResult<{ studentId: string; code: string }>> {
  if (!(await isTeacherAuthenticated())) {
    return {
      ok: false,
      error: "La sesión del profesor ha caducado. Vuelve a entrar.",
      code: "UNAUTHORIZED",
    };
  }

  const parsed = newStudentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "El nombre debe tener al menos 2 caracteres y el nivel ser válido.",
      code: "INVALID_INPUT",
    };
  }

  try {
    const db = await getReadyDb();
    const name = parsed.data.name;

    // A stable client id makes the Server Action replay-safe: if the response
    // was lost after the row was committed, retrying returns the same student
    // and the same code instead of creating a duplicate.
    const id = parsed.data.clientId
      ? `stu_${createHash("sha1")
          .update(parsed.data.clientId)
          .digest("hex")
          .slice(0, 10)}`
      : `stu_${randomUUID().slice(0, 8)}`;

    const existing = await db
      .select({ id: students.id, code: studentAccessCodes.code })
      .from(students)
      .innerJoin(
        studentAccessCodes,
        eq(students.id, studentAccessCodes.studentId),
      )
      .where(eq(students.id, id))
      .limit(1);

    if (existing[0]) {
      revalidatePath("/profesor");
      revalidatePath("/mapa");
      return {
        ok: true,
        data: { studentId: existing[0].id, code: existing[0].code },
      };
    }

    const now = new Date().toISOString();
    const taken = await readTakenCodes(db);
    const preferred = parsed.data.preferredCode;
    const code =
      preferred && !taken.has(preferred) ? preferred : newStudentCode(taken);

    try {
      await db.transaction(async (tx) => {
        await createStudentWithCode(
          tx,
          {
            id,
            name,
            level: parsed.data.level,
            age: parsed.data.age ?? null,
            weeklyGoalMinutes: parsed.data.weeklyGoalMinutes,
            notes: parsed.data.notes ?? null,
            code,
          },
          now,
        );
      });
    } catch (error) {
      // Concurrent retry: another request may have inserted the same client id.
      const raced = await db
        .select({ id: students.id, code: studentAccessCodes.code })
        .from(students)
        .innerJoin(
          studentAccessCodes,
          eq(students.id, studentAccessCodes.studentId),
        )
        .where(eq(students.id, id))
        .limit(1);
      if (!raced[0]) throw error;
      revalidatePath("/profesor");
      revalidatePath("/mapa");
      return {
        ok: true,
        data: { studentId: raced[0].id, code: raced[0].code },
      };
    }

    revalidatePath("/profesor");
    revalidatePath("/mapa");
    return { ok: true, data: { studentId: id, code } };
  } catch (error) {
    console.error("[leo] Error al crear alumno", error);
    return {
      ok: false,
      error:
        "No se pudo guardar en SQLite. El alumno sigue a salvo en este dispositivo y se reintentará la sincronización.",
      code: "DB_ERROR",
    };
  }
}

export async function updateStudentAction(
  input: unknown,
): Promise<ActionResult<{ studentId: string }>> {
  if (!(await isTeacherAuthenticated())) {
    return {
      ok: false,
      error: "La sesión del profesor ha caducado. Vuelve a entrar.",
      code: "UNAUTHORIZED",
    };
  }

  const parsed = updateStudentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revisa el perfil: nombre, edad o nivel no son válidos.",
      code: "INVALID_INPUT",
    };
  }

  try {
    const db = await getReadyDb();
    const now = new Date().toISOString();
    const payload = parsed.data;
    const { firstName, initials } = splitName(payload.name);

    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(students)
        .where(eq(students.id, payload.studentId))
        .limit(1);
      const existing = rows[0];

      if (!existing) throw new Error("STUDENT_NOT_FOUND");

      const level = Math.max(existing.currentLevel, payload.level);

      await tx
        .update(students)
        .set({
          name: payload.name,
          firstName,
          initials,
          age: payload.age ?? null,
          teacherNotes: payload.notes?.trim() || null,
          currentLevel: level,
          weeklyGoalMinutes: payload.weeklyGoalMinutes,
          updatedAt: now,
        })
        .where(eq(students.id, payload.studentId));

      await grantLevels(tx, payload.studentId, level, now);
    });

    revalidatePath("/profesor");
    revalidatePath("/mapa");
    return { ok: true, data: { studentId: payload.studentId } };
  } catch (error) {
    console.error("[leo] Error al actualizar alumno", error);
    return {
      ok: false,
      error: "No se pudo actualizar el alumno.",
      code: "DB_ERROR",
    };
  }
}

const unlockSchema = z.object({
  studentId: z.string().min(3).max(80),
  level: z.number().int().min(1).max(8),
});

/** Manual curriculum unlock: raises currentLevel to at least `level`. */
export async function unlockCurriculumLevelAction(
  input: unknown,
): Promise<ActionResult<{ currentLevel: number }>> {
  if (!(await isTeacherAuthenticated())) {
    return { ok: false, error: "No autorizado.", code: "UNAUTHORIZED" };
  }

  const parsed = unlockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos.", code: "INVALID_INPUT" };
  }

  try {
    const db = await getReadyDb();
    const now = new Date().toISOString();
    const { studentId, level } = parsed.data;

    const finalLevel = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);
      const student = rows[0];

      if (!student) throw new Error("STUDENT_NOT_FOUND");

      const nextLevel = Math.max(student.currentLevel, level);

      await tx
        .update(students)
        .set({ currentLevel: nextLevel, updatedAt: now })
        .where(eq(students.id, studentId));

      await grantLevels(tx, studentId, nextLevel, now);
      return nextLevel;
    });

    revalidatePath("/profesor");
    revalidatePath("/mapa");
    return { ok: true, data: { currentLevel: finalLevel } };
  } catch (error) {
    console.error("[leo] Error al desbloquear nivel", error);
    return {
      ok: false,
      error: "No se pudo desbloquear el nivel.",
      code: "DB_ERROR",
    };
  }
}

const attendanceSchema = z.object({
  studentId: z.string().min(3).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["normal", "unplugged"]),
  notes: z.string().trim().max(400).optional(),
});

export async function saveAttendanceAction(
  input: unknown,
): Promise<ActionResult<{ date: string; mode: "normal" | "unplugged" }>> {
  if (!(await isTeacherAuthenticated())) {
    return { ok: false, error: "No autorizado.", code: "UNAUTHORIZED" };
  }

  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Elige un alumno, una fecha y un modo de clase.",
      code: "INVALID_INPUT",
    };
  }

  try {
    const db = await getReadyDb();
    const now = new Date().toISOString();
    const payload = parsed.data;
    const rows = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, payload.studentId))
      .limit(1);

    if (!rows[0]) {
      return { ok: false, error: "Alumno no encontrado.", code: "NOT_FOUND" };
    }

    await db
      .insert(attendance)
      .values({
        id: `att_${randomUUID()}`,
        studentId: payload.studentId,
        date: payload.date,
        mode: payload.mode,
        notes: payload.notes?.trim() || null,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [attendance.studentId, attendance.date],
        set: {
          mode: payload.mode,
          notes: payload.notes?.trim() || null,
          createdAt: now,
        },
      });

    revalidatePath("/profesor");
    return { ok: true, data: { date: payload.date, mode: payload.mode } };
  } catch (error) {
    console.error("[leo] Error al registrar asistencia", error);
    return {
      ok: false,
      error: "No se pudo registrar la asistencia.",
      code: "DB_ERROR",
    };
  }
}

/**
 * "Pasar Lista Grupal": one atomic transaction for the whole classroom. Every
 * selected student gets the same day note and modality; re-saving the day is an
 * idempotent upsert thanks to the (student_id, date) unique index.
 */
const classAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["normal", "unplugged"]),
  notes: z.string().trim().max(400).optional(),
  studentIds: z.array(z.string().min(3).max(80)).min(1).max(200),
});

export async function saveClassAttendanceAction(
  input: unknown,
): Promise<
  ActionResult<{
    saved: number;
    date: string;
    mode: "normal" | "unplugged";
  }>
> {
  if (!(await isTeacherAuthenticated())) {
    return { ok: false, error: "No autorizado.", code: "UNAUTHORIZED" };
  }

  const parsed = classAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Elige una fecha, un modo y al menos un alumno.",
      code: "INVALID_INPUT",
    };
  }

  const { date, mode, studentIds } = parsed.data;
  const notes = parsed.data.notes?.trim() || null;
  const unique = [...new Set(studentIds)];

  try {
    const db = await getReadyDb();
    const existing = await db
      .select({ id: students.id })
      .from(students)
      .where(inArray(students.id, unique));

    if (existing.length !== unique.length) {
      return {
        ok: false,
        error: "Alguno de los alumnos ya no está en la academia.",
        code: "NOT_FOUND",
      };
    }

    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      for (const studentId of unique) {
        await tx
          .insert(attendance)
          .values({
            id: `att_${randomUUID()}`,
            studentId,
            date,
            mode,
            notes,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: [attendance.studentId, attendance.date],
            set: { mode, notes, createdAt: now },
          });
      }
    });

    revalidatePath("/profesor");
    revalidatePath("/mapa");
    return { ok: true, data: { saved: unique.length, date, mode } };
  } catch (error) {
    console.error("[leo] Error al pasar lista grupal", error);
    return {
      ok: false,
      error: "No se pudo guardar la asistencia de la clase.",
      code: "DB_ERROR",
    };
  }
}

/**
 * @deprecated Prefer `unlockCurriculumLevelAction`, which also raises the
 * student's `currentLevel`. Kept as a thin alias for older callers.
 */
export async function unlockLevelAction(
  studentId: string,
  levelId: string,
): Promise<ActionResult<null>> {
  const level = LEVELS.find((item) => item.id === levelId);
  if (!level) return { ok: false, error: "Nivel no encontrado." };

  const result = await unlockCurriculumLevelAction({
    studentId,
    level: level.ordinal,
  });

  return result.ok ? { ok: true, data: null } : result;
}

const pinChangeSchema = z
  .object({
    currentPin: z.string().length(4).regex(/^\d{4}$/),
    newPin: z.string().length(4).regex(/^\d{4}$/),
    confirmPin: z.string().length(4).regex(/^\d{4}$/),
  })
  .refine((data) => data.newPin === data.confirmPin, {
    message: "PIN_MISMATCH",
    path: ["confirmPin"],
  });

/** Rotates the teacher PIN from inside the authenticated panel. */
export async function changeTeacherPinAction(
  input: unknown,
): Promise<ActionResult<{ changed: true }>> {
  if (!(await isTeacherAuthenticated())) {
    return {
      ok: false,
      error: "La sesión del profesor ha caducado. Vuelve a entrar.",
      code: "UNAUTHORIZED",
    };
  }

  const parsed = pinChangeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "El PIN debe tener 4 dígitos y la confirmación debe coincidir.",
      code: "INVALID_INPUT",
    };
  }

  if (!(await verifyTeacherPin(parsed.data.currentPin))) {
    return {
      ok: false,
      error: "El PIN actual no coincide.",
      code: "PIN_MISMATCH",
    };
  }

  try {
    await saveTeacherPinHash(parsed.data.newPin);
    revalidatePath("/profesor");
    return { ok: true, data: { changed: true } };
  } catch (error) {
    console.error("[leo] Error al cambiar el PIN", error);
    return {
      ok: false,
      error: "No se pudo guardar el nuevo PIN.",
      code: "DB_ERROR",
    };
  }
}

const studentCodeSchema = z.object({
  studentId: z.string().min(3).max(80),
});

/** Generates a fresh private code for a student (old code stops working). */
export async function regenerateStudentCodeAction(
  input: unknown,
): Promise<ActionResult<{ code: string }>> {
  if (!(await isTeacherAuthenticated())) {
    return { ok: false, error: "No autorizado.", code: "UNAUTHORIZED" };
  }

  const parsed = studentCodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Alumno no válido.", code: "INVALID_INPUT" };
  }

  try {
    const db = await getReadyDb();
    const rows = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, parsed.data.studentId))
      .limit(1);

    if (!rows[0]) {
      return { ok: false, error: "Alumno no encontrado.", code: "NOT_FOUND" };
    }

    const code = newStudentCode(await readTakenCodes(db));
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await setStudentCode(tx, parsed.data.studentId, code, now);
    });

    revalidatePath("/profesor");
    return { ok: true, data: { code } };
  } catch (error) {
    console.error("[leo] Error al regenerar el código", error);
    return {
      ok: false,
      error: "No se pudo generar un código nuevo.",
      code: "DB_ERROR",
    };
  }
}
