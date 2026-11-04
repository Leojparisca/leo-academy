"use server";

import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult, Student } from "@/lib/academy";
import {
  createStudentSession,
  destroyStudentSession,
  getStudentSessionId,
} from "@/server/auth/student-session";
import { isTeacherAuthenticated } from "@/server/auth/teacher-session";
import { getReadyDb } from "@/server/db/client";
import {
  createStudentWithCode,
  getStudentRowByCode,
  nameMatchesStudent,
  newStudentCode,
  readTakenCodes,
} from "@/server/db/helpers";
import { studentAccessCodes, students } from "@/server/db/schema";
import { rowToStudent } from "@/server/queries/students";

const loginSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .min(4)
    .max(8)
    .regex(/^[A-Za-z0-9]+$/),
});

export async function loginStudentAction(
  input: unknown,
): Promise<ActionResult<{ studentId: string; name: string; firstName: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Escribe tu nombre y tu código de alumno.",
      code: "INVALID_INPUT",
    };
  }

  try {
    const db = await getReadyDb();
    const row = await getStudentRowByCode(db, parsed.data.code);
    if (!row) {
      return {
        ok: false,
        error: "Ese código no existe. Pídeselo a tu profe.",
        code: "CODE_NOT_FOUND",
      };
    }

    if (!nameMatchesStudent(parsed.data.name, row)) {
      return {
        ok: false,
        error: "El nombre no coincide con ese código de alumno.",
        code: "NAME_MISMATCH",
      };
    }

    const now = new Date().toISOString();
    await db
      .update(studentAccessCodes)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(studentAccessCodes.studentId, row.id));

    await createStudentSession(row.id);
    revalidatePath("/", "layout");
    revalidatePath("/mapa");
    revalidatePath("/estudio");
    revalidatePath("/juegos");

    return {
      ok: true,
      data: { studentId: row.id, name: row.name, firstName: row.firstName },
    };
  } catch (error) {
    console.error("[leo] Error al entrar como alumno", error);
    return {
      ok: false,
      error: "No se pudo abrir tu academia. Inténtalo otra vez.",
      code: "DB_ERROR",
    };
  }
}

const createProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function createStudentProfileAction(
  input: unknown,
): Promise<ActionResult<{ studentId: string; code: string; name: string }>> {
  const parsed = createProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Escribe tu nombre (al menos 2 letras).",
      code: "INVALID_INPUT",
    };
  }

  try {
    const db = await getReadyDb();
    const now = new Date().toISOString();
    const id = `stu_${randomUUID().slice(0, 8)}`;
    const code = newStudentCode(await readTakenCodes(db));

    await db.transaction(async (tx) => {
      await createStudentWithCode(
        tx,
        {
          id,
          name: parsed.data.name,
          level: 1,
          weeklyGoalMinutes: 90,
          code,
        },
        now,
      );
    });

    revalidatePath("/profesor");
    revalidatePath("/mapa");

    return {
      ok: true,
      data: { studentId: id, code, name: parsed.data.name.trim() },
    };
  } catch (error) {
    console.error("[leo] Error al crear el perfil de alumno", error);
    return {
      ok: false,
      error: "No se pudo crear tu perfil. Inténtalo otra vez.",
      code: "DB_ERROR",
    };
  }
}

export async function logoutStudentAction(): Promise<ActionResult<null>> {
  await destroyStudentSession();
  revalidatePath("/", "layout");
  return { ok: true, data: null };
}

/** Lets a student remember their own code without exposing anyone else's. */
export async function getMyStudentCodeAction(): Promise<
  ActionResult<{ code: string | null }>
> {
  const studentId = await getStudentSessionId();
  if (!studentId) {
    return { ok: false, error: "No hay sesión de alumno.", code: "UNAUTHORIZED" };
  }

  try {
    const db = await getReadyDb();
    const rows = await db
      .select({ code: studentAccessCodes.code })
      .from(studentAccessCodes)
      .where(eq(studentAccessCodes.studentId, studentId))
      .limit(1);
    return { ok: true, data: { code: rows[0]?.code ?? null } };
  } catch {
    return { ok: true, data: { code: null } };
  }
}

/**
 * Roster for “Modo Sin Luz · Pasa el Teléfono”. Only names and progress
 * summaries travel; private teacher notes are always redacted.
 */
export async function fetchClassroomRosterAction(): Promise<
  ActionResult<Student[]>
> {
  const [teacher, sessionId] = await Promise.all([
    isTeacherAuthenticated(),
    getStudentSessionId(),
  ]);

  if (!teacher && !sessionId) {
    return { ok: false, error: "No autorizado.", code: "UNAUTHORIZED" };
  }

  try {
    const db = await getReadyDb();
    const rows = await db.select().from(students).orderBy(asc(students.name));
    return { ok: true, data: rows.map((row) => rowToStudent(row, true)) };
  } catch (error) {
    console.error("[leo] Error al leer el grupo", error);
    return {
      ok: false,
      error: "No se pudo cargar el grupo para pasar el teléfono.",
      code: "DB_ERROR",
    };
  }
}
