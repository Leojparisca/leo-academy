import "server-only";

import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { LEVELS } from "@/lib/academy";
import type { AcademyDb } from "@/server/db/client";
import {
  lessonProgress,
  studentAccessCodes,
  students,
  unlockedLevels,
} from "@/server/db/schema";

/** A database handle or an open Drizzle transaction; both support the builder. */
export type Tx = Parameters<Parameters<AcademyDb["transaction"]>[0]>[0];

export function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? name.trim(),
    initials:
      parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || "AL",
  };
}

/**
 * A teacher unlock means “this student may enter level N”. We keep the
 * relational trail (unlocked_levels + lesson_progress) in sync so the map,
 * the menu and future syncs all agree.
 */
export async function grantLevels(
  tx: Tx,
  studentId: string,
  throughOrdinal: number,
  now: string,
) {
  const accessible = LEVELS.filter((level) => level.ordinal <= throughOrdinal);
  if (!accessible.length) return;

  await tx
    .insert(unlockedLevels)
    .values(
      accessible.map((level) => ({
        id: `unlocked_${studentId}_${level.id}`,
        studentId,
        levelId: level.id,
        unlockedAt: now,
        unlockedBy: "teacher" as const,
        note:
          level.ordinal === throughOrdinal
            ? "Nivel activo desbloqueado por el profesor"
            : "Accesible por desbloqueo del profesor",
      })),
    )
    .onConflictDoNothing();

  await tx
    .insert(lessonProgress)
    .values(
      accessible.map((level) => ({
        id: `progress_${studentId}_${level.id}`,
        studentId,
        levelId: level.id,
        status:
          level.ordinal === throughOrdinal
            ? ("current" as const)
            : ("completed" as const),
        progress: level.ordinal === throughOrdinal ? 0 : 100,
        bestScore: 0,
        minutesPracticed: 0,
        lastPracticedAt: null,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [lessonProgress.studentId, lessonProgress.levelId],
      set: { updatedAt: now },
    });
}

/** Unambiguous alphabet: no O/0, I/1 or L. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newStudentCode(taken: Set<string> = new Set()) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    let code = "";
    for (let index = 0; index < 4; index += 1) {
      code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
    }
    if (!taken.has(code)) return code;
  }
  // Extremely unlikely: widen to six characters rather than fail a signup.
  return `L${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

export async function readTakenCodes(db: AcademyDb) {
  const rows = await db
    .select({ code: studentAccessCodes.code })
    .from(studentAccessCodes);
  return new Set(rows.map((row) => row.code));
}

/**
 * Creates a student plus their private access code and starting level.
 * The caller controls the transaction.
 */
export async function createStudentWithCode(
  tx: Tx,
  input: {
    id: string;
    name: string;
    level: number;
    age?: number | null;
    weeklyGoalMinutes?: number;
    notes?: string | null;
    tone?: "sapphire" | "cyan" | "slate";
    code: string;
  },
  now: string,
) {
  const { firstName, initials } = splitName(input.name);

  await tx.insert(students).values({
    id: input.id,
    name: input.name.trim(),
    firstName,
    initials,
    avatarTone: input.tone ?? "sapphire",
    currentLevel: input.level,
    age: input.age ?? null,
    teacherNotes: input.notes?.trim() || null,
    streakDays: 0,
    totalMinutes: 0,
    accuracy: 0,
    weeklyMinutes: 0,
    weeklyGoalMinutes: input.weeklyGoalMinutes ?? 90,
    joinedAt: now.slice(0, 10),
    updatedAt: now,
  });

  await tx.insert(studentAccessCodes).values({
    studentId: input.id,
    code: input.code,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
  });

  await grantLevels(tx, input.id, input.level, now);
}

export async function setStudentCode(
  tx: Tx,
  studentId: string,
  code: string,
  now: string,
) {
  await tx
    .insert(studentAccessCodes)
    .values({
      studentId,
      code,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    })
    .onConflictDoUpdate({
      target: studentAccessCodes.studentId,
      set: { code, updatedAt: now },
    });
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function nameMatchesStudent(
  input: string,
  student: { name: string; firstName: string },
) {
  const candidate = normalizeName(input);
  if (!candidate) return false;
  const full = normalizeName(student.name);
  const first = normalizeName(student.firstName);
  return candidate === full || candidate === first || full.startsWith(candidate);
}

export async function getStudentRowByCode(db: AcademyDb, code: string) {
  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      firstName: students.firstName,
      code: studentAccessCodes.code,
    })
    .from(studentAccessCodes)
    .innerJoin(students, eq(studentAccessCodes.studentId, students.id))
    .where(eq(studentAccessCodes.code, normalizeCode(code)))
    .limit(1);

  return rows[0];
}
