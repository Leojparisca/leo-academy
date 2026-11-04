"use server";

import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  getLevel,
  type ActionResult,
  type LiveClassroomData,
  type LiveClassroomStudent,
} from "@/lib/academy";
import { getStudentSessionId } from "@/server/auth/student-session";
import { isTeacherAuthenticated } from "@/server/auth/teacher-session";
import { getReadyDb } from "@/server/db/client";
import {
  lessonProgress,
  levels,
  livePresence,
  skillScores,
  students,
} from "@/server/db/schema";

const TABS = ["mapa", "estudio", "juegos", "profesor"] as const;

const heartbeatSchema = z.object({
  studentId: z.string().min(3).max(80),
  tab: z.enum(TABS).default("mapa"),
  levelId: z.string().regex(/^level-\d{2}$/).nullable().optional(),
  exercise: z.string().trim().max(140).default(""),
  keyLabel: z.string().trim().max(48).nullable().optional(),
  skill: z.enum(["melody", "harmony", "rhythm"]).nullable().optional(),
  melody: z.number().int().min(0).max(100).default(0),
  harmony: z.number().int().min(0).max(100).default(0),
  rhythm: z.number().int().min(0).max(100).default(0),
  progress: z.number().int().min(0).max(100).default(0),
  practicing: z.boolean().default(false),
  lastActivity: z.string().min(10).max(40).optional(),
  event: z.enum(["heartbeat", "exercise-complete"]).default("heartbeat"),
  clientId: z.string().min(8).max(80).optional(),
});

/**
 * Student heartbeat. Called every 5 seconds while practising and immediately
 * when an exercise is completed. The browser keeps Dexie as offline backup;
 * this action only mirrors the live state into the database.
 */
export async function syncLiveProgressAction(
  input: unknown,
): Promise<ActionResult<{ syncedAt: string }>> {
  const parsed = heartbeatSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "El latido de práctica no tiene un formato válido.",
      code: "INVALID_INPUT",
    };
  }

  const sessionId = await getStudentSessionId();
  if (!sessionId || sessionId !== parsed.data.studentId) {
    return {
      ok: false,
      error: "La sesión del alumno ha caducado.",
      code: "UNAUTHORIZED",
    };
  }

  const payload = parsed.data;
  const now = new Date().toISOString();

  try {
    const db = await getReadyDb();
    const rows = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, payload.studentId))
      .limit(1);

    if (!rows[0]) {
      return { ok: false, error: "Alumno no encontrado.", code: "NOT_FOUND" };
    }

    await db.transaction(async (tx) => {
      await tx
        .insert(livePresence)
        .values({
          studentId: payload.studentId,
          tab: payload.tab,
          levelId: payload.levelId ?? null,
          exercise: payload.exercise,
          keyLabel: payload.keyLabel ?? null,
          skill: payload.skill ?? null,
          melody: payload.melody,
          harmony: payload.harmony,
          rhythm: payload.rhythm,
          progress: payload.progress,
          practicing: payload.practicing,
          lastActivity: payload.lastActivity ?? now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: livePresence.studentId,
          set: {
            tab: payload.tab,
            levelId: payload.levelId ?? null,
            exercise: payload.exercise,
            keyLabel: payload.keyLabel ?? null,
            skill: payload.skill ?? null,
            melody: payload.melody,
            harmony: payload.harmony,
            rhythm: payload.rhythm,
            progress: payload.progress,
            practicing: payload.practicing,
            lastActivity: payload.lastActivity ?? now,
            lastSeenAt: now,
          },
        });

      if (payload.levelId) {
        const levelRows = await tx
          .select({ id: levels.id })
          .from(levels)
          .where(eq(levels.id, payload.levelId))
          .limit(1);

        if (levelRows[0]) {
          await tx
            .insert(lessonProgress)
            .values({
              id: `progress_${payload.studentId}_${payload.levelId}`,
              studentId: payload.studentId,
              levelId: payload.levelId,
              status: "current",
              progress: payload.progress,
              bestScore: 0,
              minutesPracticed: 0,
              lastPracticedAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [lessonProgress.studentId, lessonProgress.levelId],
              set: {
                progress: sql`max(${lessonProgress.progress}, ${payload.progress})`,
                lastPracticedAt: now,
                updatedAt: now,
              },
            });
        }
      }

      if (
        payload.event === "exercise-complete" &&
        payload.skill &&
        payload.clientId
      ) {
        await tx
          .insert(skillScores)
          .values({
            id: `live_${payload.clientId}`,
            studentId: payload.studentId,
            skill: payload.skill,
            score: payload[payload.skill],
            source: "lesson",
            createdAt: payload.lastActivity ?? now,
            syncedFrom: "live",
          })
          .onConflictDoNothing();
      }
    });

    return { ok: true, data: { syncedAt: now } };
  } catch (error) {
    console.error("[leo] Error al sincronizar el salón en vivo", error);
    return {
      ok: false,
      error: "No se pudo enviar el latido al servidor.",
      code: "DB_ERROR",
    };
  }
}

/** Teacher-only snapshot for the 3-second polling view. */
export async function getLiveClassroomAction(): Promise<
  ActionResult<LiveClassroomData>
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
    const [studentRows, presenceRows, scoreRows] = await Promise.all([
      db.select().from(students).orderBy(asc(students.name)),
      db.select().from(livePresence),
      db
        .select({
          studentId: skillScores.studentId,
          skill: skillScores.skill,
          avg: sql<number>`avg(${skillScores.score})`,
        })
        .from(skillScores)
        .groupBy(skillScores.studentId, skillScores.skill),
    ]);

    const presenceByStudent = new Map(
      presenceRows.map((row) => [row.studentId, row]),
    );
    const radar = new Map<string, Record<string, number>>();
    for (const row of scoreRows) {
      if (!row.skill) continue;
      const entry = radar.get(row.studentId) ?? {};
      entry[row.skill] = Math.round(Number(row.avg) || 0);
      radar.set(row.studentId, entry);
    }

    const now = Date.now();
    const cards: LiveClassroomStudent[] = studentRows.map((student) => {
      const presence = presenceByStudent.get(student.id);
      const averages = radar.get(student.id) ?? {};
      const level = getLevel(student.currentLevel);
      const online = Boolean(
        presence && now - new Date(presence.lastSeenAt).getTime() < 30_000,
      );

      return {
        studentId: student.id,
        name: student.name,
        firstName: student.firstName,
        initials: student.initials,
        avatarTone: student.avatarTone,
        levelOrdinal: level.ordinal,
        levelId: presence?.levelId ?? level.id,
        levelTitle: level.title,
        tab: presence?.tab ?? "sin actividad",
        exercise: presence?.exercise ?? "",
        keyLabel: presence?.keyLabel ?? null,
        skill: presence?.skill ?? null,
        melody: presence?.melody || averages.melody || 0,
        harmony: presence?.harmony || averages.harmony || 0,
        rhythm: presence?.rhythm || averages.rhythm || 0,
        progress: presence?.progress ?? 0,
        practicing: Boolean(presence?.practicing),
        online,
        lastActivity: presence?.lastActivity ?? null,
        lastSeenAt: presence?.lastSeenAt ?? null,
      };
    });

    cards.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return a.name.localeCompare(b.name, "es");
    });

    return {
      ok: true,
      data: {
        source: "sqlite",
        students: cards,
        activeCount: cards.filter((card) => card.online).length,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("[leo] Error al leer el salón en vivo", error);
    return {
      ok: true,
      data: {
        source: "unavailable",
        students: [],
        activeCount: 0,
        updatedAt: new Date().toISOString(),
      },
    };
  }
}
