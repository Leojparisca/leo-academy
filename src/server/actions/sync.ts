"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { ActionResult } from "@/lib/academy";
import {
  backupDumpSchema,
  type BackupSummary,
} from "@/lib/backup";
import { CURRICULUM_BY_ID } from "@/data/curriculum";
import { getReadyDb } from "@/server/db/client";
import {
  curriculumProgress,
  lessonProgress,
  levels,
  practiceSessions,
  skillScores,
  students,
  xpLedger,
} from "@/server/db/schema";
import { isTeacherAuthenticated } from "@/server/auth/teacher-session";

const STATUS_RANK = { locked: 0, current: 1, completed: 2 } as const;

/** Deterministic ids make re-sending the same dump a safe no-op. */
function stableId(prefix: string, ...parts: Array<string | number>) {
  const hash = createHash("sha1")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 24);
  return `${prefix}_${hash}`;
}

function latest(left: string, right: string) {
  return right > left ? right : left;
}

/**
 * Hardened local-to-server backup.
 *
 * The browser sends a Zod-validated dump of its Dexie cache; this action is the
 * only door into the database. Guarantees:
 *  - teacher session required (the panel lives behind the PIN);
 *  - one transaction: all rows land or none do;
 *  - teacher-owned student data (name, level, age, notes) is never overwritten;
 *  - every row limit is enforced by the schema before the transaction opens;
 *  - stable ids + unique indexes make repeated backups idempotent.
 */
export async function syncBackupAction(
  input: unknown,
): Promise<ActionResult<BackupSummary>> {
  if (!(await isTeacherAuthenticated())) {
    return {
      ok: false,
      error: "La sesión del profesor ha caducado. Vuelve a entrar para respaldar.",
      code: "UNAUTHORIZED",
    };
  }

  const parsed = backupDumpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "El respaldo del dispositivo no tiene un formato válido.",
      code: "INVALID_BACKUP",
    };
  }

  const dump = parsed.data;

  try {
    const db = await getReadyDb();

    const summary = await db.transaction(async (tx) => {
      const counts: BackupSummary = {
        students: 0,
        studentsUpdated: 0,
        lessonProgress: 0,
        skillScores: 0,
        curriculumProgress: 0,
        xpLedger: 0,
        practiceSessions: 0,
        skipped: 0,
        total: 0,
        syncedAt: new Date().toISOString(),
      };

      const knownStudents = new Set(
        (await tx.select({ id: students.id }).from(students)).map(
          (row) => row.id,
        ),
      );
      const knownLevels = new Set(
        (await tx.select({ id: levels.id }).from(levels)).map((row) => row.id),
      );
      const studentRows = new Map(
        (await tx.select().from(students)).map((row) => [row.id, row]),
      );

      for (const record of dump.students) {
        const current = studentRows.get(record.id);

        if (!current) {
          await tx
            .insert(students)
            .values({
              id: record.id,
              name: record.name,
              firstName: record.firstName,
              initials: record.initials,
              avatarTone: record.avatarTone,
              currentLevel: record.currentLevel,
              age: record.age,
              teacherNotes: record.teacherNotes,
              streakDays: record.streakDays,
              totalMinutes: record.totalMinutes,
              accuracy: record.accuracy,
              weeklyMinutes: record.weeklyMinutes,
              weeklyGoalMinutes: record.weeklyGoalMinutes,
              joinedAt: record.joinedAt,
              updatedAt: record.updatedAt,
            })
            .onConflictDoNothing();
          knownStudents.add(record.id);
          counts.students += 1;
          continue;
        }

        // The teacher owns identity, level and notes. The device only owns the
        // measured metrics, and even those never move backwards.
        const deviceWinsAccuracy = record.totalMinutes >= current.totalMinutes;
        await tx
          .update(students)
          .set({
            streakDays: Math.max(current.streakDays, record.streakDays),
            totalMinutes: Math.max(current.totalMinutes, record.totalMinutes),
            weeklyMinutes: Math.max(current.weeklyMinutes, record.weeklyMinutes),
            accuracy: deviceWinsAccuracy ? record.accuracy : current.accuracy,
            updatedAt: latest(current.updatedAt, record.updatedAt),
          })
          .where(eq(students.id, record.id));
        counts.studentsUpdated += 1;
      }

      const progressRows = new Map(
        (await tx.select().from(lessonProgress)).map((row) => [
          `${row.studentId}|${row.levelId}`,
          row,
        ]),
      );

      for (const record of dump.lessonProgress) {
        if (
          !knownStudents.has(record.studentId) ||
          !knownLevels.has(record.levelId)
        ) {
          counts.skipped += 1;
          continue;
        }

        const current = progressRows.get(
          `${record.studentId}|${record.levelId}`,
        );
        if (!current) {
          await tx
            .insert(lessonProgress)
            .values({
              id: `progress_${record.studentId}_${record.levelId}`,
              studentId: record.studentId,
              levelId: record.levelId,
              status: record.status,
              progress: record.progress,
              bestScore: 0,
              minutesPracticed: record.minutesPracticed,
              lastPracticedAt: record.updatedAt,
              updatedAt: record.updatedAt,
            })
            .onConflictDoNothing();
        } else {
          await tx
            .update(lessonProgress)
            .set({
              status:
                STATUS_RANK[record.status] > STATUS_RANK[current.status]
                  ? record.status
                  : current.status,
              progress: Math.max(current.progress, record.progress),
              minutesPracticed: Math.max(
                current.minutesPracticed,
                record.minutesPracticed,
              ),
              lastPracticedAt: current.lastPracticedAt ?? record.updatedAt,
              updatedAt: latest(current.updatedAt, record.updatedAt),
            })
            .where(eq(lessonProgress.id, current.id));
        }
        counts.lessonProgress += 1;
      }

      for (const record of dump.skillScores) {
        if (!knownStudents.has(record.studentId)) {
          counts.skipped += 1;
          continue;
        }
        await tx
          .insert(skillScores)
          .values({
            id: stableId(
              "score",
              record.studentId,
              record.skill,
              record.source,
              record.createdAt,
              record.score,
            ),
            studentId: record.studentId,
            skill: record.skill,
            score: record.score,
            source: record.source,
            createdAt: record.createdAt,
            syncedFrom: "device",
          })
          .onConflictDoNothing();
        counts.skillScores += 1;
      }

      const curriculumRows = new Map(
        (await tx.select().from(curriculumProgress)).map((row) => [
          `${row.studentId}|${row.nodeId}`,
          row,
        ]),
      );

      for (const record of dump.curriculumProgress) {
        const node = CURRICULUM_BY_ID.get(record.nodeId);
        if (!knownStudents.has(record.studentId) || !node) {
          counts.skipped += 1;
          continue;
        }

        const current = curriculumRows.get(
          `${record.studentId}|${record.nodeId}`,
        );
        if (!current) {
          await tx
            .insert(curriculumProgress)
            .values({
              id: `curriculum_${record.studentId}_${record.nodeId}`,
              studentId: record.studentId,
              nodeId: record.nodeId,
              branch: node.branch,
              level: node.level,
              stars: record.stars,
              accuracy: record.accuracy,
              createdAt: record.updatedAt,
              updatedAt: record.updatedAt,
            })
            .onConflictDoNothing();
        } else {
          await tx
            .update(curriculumProgress)
            .set({
              stars: Math.max(current.stars, record.stars),
              accuracy: Math.max(current.accuracy, record.accuracy),
              updatedAt: latest(current.updatedAt, record.updatedAt),
            })
            .where(eq(curriculumProgress.id, current.id));
        }
        counts.curriculumProgress += 1;
      }

      for (const record of dump.xpLedger) {
        if (!knownStudents.has(record.studentId)) {
          counts.skipped += 1;
          continue;
        }
        await tx
          .insert(xpLedger)
          .values({
            id: stableId(
              "xp",
              record.studentId,
              record.source,
              record.createdAt,
              record.amount,
              record.detail,
            ),
            studentId: record.studentId,
            amount: record.amount,
            source: record.source,
            detail: record.detail,
            createdAt: record.createdAt,
            syncedFrom: "device",
          })
          .onConflictDoNothing();
        counts.xpLedger += 1;
      }

      for (const record of dump.practiceSessions) {
        if (
          !knownStudents.has(record.studentId) ||
          !knownLevels.has(record.levelId)
        ) {
          counts.skipped += 1;
          continue;
        }
        // Sessions are immutable log rows. The student's totals were already
        // reconciled above, so inserting here never double-counts minutes.
        const inserted = await tx
          .insert(practiceSessions)
          .values({
            id: `sess_${record.clientId}`,
            studentId: record.studentId,
            levelId: record.levelId,
            skill: record.skill,
            minutes: record.minutes,
            score: record.score,
            source: "offline",
            createdAt: record.createdAt,
          })
          .onConflictDoNothing();
        if (inserted.rowsAffected > 0) counts.practiceSessions += 1;
      }

      counts.total =
        counts.students +
        counts.studentsUpdated +
        counts.lessonProgress +
        counts.skillScores +
        counts.curriculumProgress +
        counts.xpLedger +
        counts.practiceSessions;

      return counts;
    });

    return { ok: true, data: summary };
  } catch (error) {
    console.error("[leo] Error al blindar el respaldo", error);
    return {
      ok: false,
      error:
        "No se pudo escribir el respaldo en la base de datos. Nada se ha perdido en el dispositivo.",
      code: "BACKUP_ERROR",
    };
  }
}
