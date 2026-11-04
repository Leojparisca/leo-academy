"use client";

/**
 * Leo Academy — offline-first local cache.
 *
 * IMPORTANT: Dexie/IndexedDB is a *cache and offline outbox*, never the source
 * of truth. It lives exclusively in the browser. The academy's relational
 * database is SQLite, owned by the server and never reachable from this file.
 */

import Dexie, { type EntityTable } from "dexie";
import { ACTIVE_STUDENT_KEY, type Skill, type Student } from "@/lib/academy";
import {
  BACKUP_LIMITS,
  BACKUP_STAMP_KEY,
  BACKUP_VERSION,
  DEVICE_ID_KEY,
  type BackupDump,
  type BackupStudent,
  type LocalBackupStats,
} from "@/lib/backup";
import { type BranchId, type CurriculumNode } from "@/data/curriculum";

export type LocalLessonProgress = {
  id?: number;
  studentId: string;
  levelId: string;
  status: "locked" | "current" | "completed";
  progress: number;
  minutesPracticed: number;
  updatedAt: string;
  synced: 0 | 1;
};

export type LocalSkillScore = {
  id?: number;
  studentId: string;
  skill: Skill;
  score: number;
  source: "lesson" | "game" | "teacher";
  createdAt: string;
  synced: 0 | 1;
};

export type OfflineMutationKind = "practice" | "evaluation";

export type OfflineMutation = {
  id?: number;
  clientId: string;
  kind: OfflineMutationKind;
  payload: string;
  createdAt: string;
  attempts: number;
  status: "pending" | "syncing" | "failed";
};

export type LocalCurriculumProgress = {
  id?: number;
  studentId: string;
  nodeId: string;
  branch: BranchId;
  level: number;
  stars: 1 | 2 | 3;
  accuracy: number;
  updatedAt: string;
  synced: 0 | 1;
};

export type LocalXpEntry = {
  id?: number;
  studentId: string;
  amount: number;
  source: "lesson" | "game" | "group";
  detail: string;
  createdAt: string;
  synced: 0 | 1;
};

export type PracticePayload = {
  clientId: string;
  studentId: string;
  levelId: string;
  minutes: number;
  skill: Skill;
  score: number;
  createdAt: string;
};

class AcademyLocalDatabase extends Dexie {
  students!: EntityTable<Student, "id">;
  lessonProgress!: EntityTable<LocalLessonProgress, "id">;
  skillScores!: EntityTable<LocalSkillScore, "id">;
  offlineQueue!: EntityTable<OfflineMutation, "id">;
  curriculumProgress!: EntityTable<LocalCurriculumProgress, "id">;
  xpLedger!: EntityTable<LocalXpEntry, "id">;

  constructor() {
    super("leo-academy");
    this.version(1).stores({
      students: "id, name, updatedAt",
      lessonProgress:
        "++id, studentId, levelId, updatedAt, [studentId+levelId]",
      skillScores: "++id, studentId, skill, createdAt, [studentId+skill]",
      offlineQueue: "++id, clientId, status, kind, createdAt",
    });
    this.version(2).stores({
      students: "id, name, updatedAt",
      lessonProgress:
        "++id, studentId, levelId, updatedAt, [studentId+levelId]",
      skillScores: "++id, studentId, skill, createdAt, [studentId+skill]",
      offlineQueue: "++id, clientId, status, kind, createdAt",
      curriculumProgress:
        "++id, studentId, nodeId, branch, level, updatedAt, [studentId+nodeId]",
      xpLedger: "++id, studentId, source, createdAt, [studentId+source]",
    });
  }
}

let database: AcademyLocalDatabase | null = null;

export function getLocalDb() {
  if (typeof window === "undefined") {
    throw new Error("Dexie is only available in the browser.");
  }
  database ??= new AcademyLocalDatabase();
  return database;
}

/** Prototype identifiers that must never appear on a real device. */
const LEGACY_DEMO_STUDENT_IDS = ["stu_leo", "stu_mia", "stu_tomas"];

/**
 * Prepares the on-device cache. The device only ever stores data that came
 * from the server or from the student's own keyboard/pad input, so this no
 * longer hydrates fictional rows: it purges any left behind by the prototype.
 */
export async function seedLocalDb() {
  const db = getLocalDb();
  const legacy = LEGACY_DEMO_STUDENT_IDS;
  const legacySet = new Set(legacy);

  await db.transaction(
    "rw",
    [
      db.students,
      db.lessonProgress,
      db.skillScores,
      db.curriculumProgress,
      db.xpLedger,
      db.offlineQueue,
    ],
    async () => {
      await db.lessonProgress.where("studentId").anyOf(legacy).delete();
      await db.skillScores.where("studentId").anyOf(legacy).delete();
      await db.curriculumProgress.where("studentId").anyOf(legacy).delete();
      await db.xpLedger.where("studentId").anyOf(legacy).delete();
      await db.students.bulkDelete(legacy);

      const queued = await db.offlineQueue.toArray();
      const stale = queued.filter((entry) =>
        legacy.some((id) => entry.payload.includes(id)),
      );
      if (stale.length) {
        await db.offlineQueue.bulkDelete(
          stale.flatMap((entry) => (entry.id == null ? [] : [entry.id])),
        );
      }
    },
  );

  if (typeof window === "undefined") return;
  const active = window.localStorage.getItem(ACTIVE_STUDENT_KEY);
  if (active && legacySet.has(active)) {
    window.localStorage.removeItem(ACTIVE_STUDENT_KEY);
  }
}

export async function queueMutation(
  kind: OfflineMutationKind,
  payload: unknown,
) {
  const db = getLocalDb();
  return db.offlineQueue.add({
    clientId: crypto.randomUUID(),
    kind,
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  });
}

export async function pendingMutationCount() {
  return getLocalDb().offlineQueue.where("status").equals("pending").count();
}

export async function markQueueEntry(
  id: number,
  status: "completed" | OfflineMutation["status"],
) {
  const db = getLocalDb();
  if (status === "completed") {
    await db.offlineQueue.delete(id);
    return;
  }
  if (status === "failed") {
    const entry = await db.offlineQueue.get(id);
    await db.offlineQueue.update(id, {
      status,
      attempts: (entry?.attempts ?? 0) + 1,
    });
    return;
  }
  await db.offlineQueue.update(id, { status });
}

export async function readPracticeQueue(): Promise<
  Array<{ id: number; payload: PracticePayload }>
> {
  const db = getLocalDb();
  const entries = await db.offlineQueue
    .where("kind")
    .equals("practice")
    .and((entry) => entry.status === "pending")
    .toArray();

  return entries.flatMap((entry) => {
    try {
      return [{ id: entry.id!, payload: JSON.parse(entry.payload) as PracticePayload }];
    } catch {
      return [];
    }
  });
}

export async function readCurriculumProgress(studentId: string) {
  return getLocalDb()
    .curriculumProgress.where("studentId")
    .equals(studentId)
    .toArray();
}

export async function readXpTotals() {
  const rows = await getLocalDb().xpLedger.toArray();
  return rows.reduce<Record<string, number>>((totals, row) => {
    totals[row.studentId] = (totals[row.studentId] ?? 0) + row.amount;
    return totals;
  }, {});
}

export async function appendXp(input: {
  studentId: string;
  amount: number;
  source: LocalXpEntry["source"];
  detail: string;
}) {
  const amount = Math.max(0, Math.round(input.amount));
  if (!amount) return;
  await getLocalDb().xpLedger.add({
    studentId: input.studentId,
    amount,
    source: input.source,
    detail: input.detail,
    createdAt: new Date().toISOString(),
    synced: 0,
  });
}

/**
 * Seals a curriculum node. Re-playing never lowers the stars already earned;
 * only a better run awards the full XP again.
 */
export async function saveCurriculumResult(input: {
  studentId: string;
  node: CurriculumNode;
  stars: 1 | 2 | 3;
  accuracy: number;
  xp: number;
}) {
  const db = getLocalDb();
  const now = new Date().toISOString();
  const existing = await db.curriculumProgress
    .where("[studentId+nodeId]")
    .equals([input.studentId, input.node.id])
    .first();

  const stars = Math.max(existing?.stars ?? 0, input.stars) as 1 | 2 | 3;
  const accuracy = Math.max(existing?.accuracy ?? 0, Math.round(input.accuracy));

  if (existing) {
    await db.curriculumProgress.update(existing.id!, {
      stars,
      accuracy,
      updatedAt: now,
      synced: 0,
    });
  } else {
    await db.curriculumProgress.add({
      studentId: input.studentId,
      nodeId: input.node.id,
      branch: input.node.branch,
      level: input.node.level,
      stars,
      accuracy,
      updatedAt: now,
      synced: 0,
    });
  }

  const improved = !existing || input.stars > existing.stars;
  await appendXp({
    studentId: input.studentId,
    amount: improved ? input.xp : Math.round(input.xp * 0.2),
    source: "lesson",
    detail: input.node.title,
  });

  return { stars, accuracy };
}

/**
 * Reads the whole on-device cache as a validated backup dump. Only the newest
 * rows survive when a table exceeds its hard ceiling, so the most valuable
 * progress is what reaches SQLite first.
 */
export async function readBackupDump(): Promise<BackupDump> {
  const db = getLocalDb();
  const [students, lessonProgress, skillScores, curriculumProgress, xpLedger, queue] =
    await Promise.all([
      db.students.toArray(),
      db.lessonProgress.toArray(),
      db.skillScores.toArray(),
      db.curriculumProgress.toArray(),
      db.xpLedger.toArray(),
      db.offlineQueue
        .where("kind")
        .equals("practice")
        .and((entry) => entry.status === "pending")
        .toArray(),
    ]);

  const practiceSessions = queue.flatMap((entry) => {
    try {
      return [JSON.parse(entry.payload) as PracticePayload];
    } catch {
      return [];
    }
  });

  return {
    version: BACKUP_VERSION,
    generatedAt: new Date().toISOString(),
    deviceId: readDeviceId(),
    students: newest(
      students.map(
        (student): BackupStudent => ({
          id: student.id,
          name: student.name,
          firstName: student.firstName,
          initials: student.initials,
          avatarTone: student.avatarTone,
          currentLevel: student.currentLevel,
          age: student.age,
          teacherNotes: student.teacherNotes,
          streakDays: student.streakDays,
          totalMinutes: student.totalMinutes,
          accuracy: student.accuracy,
          weeklyMinutes: student.weeklyMinutes,
          weeklyGoalMinutes: student.weeklyGoalMinutes,
          joinedAt: student.joinedAt,
          updatedAt: student.updatedAt,
        }),
      ),
      BACKUP_LIMITS.students,
      (row) => row.updatedAt,
    ),
    lessonProgress: newest(
      lessonProgress.map((row) => ({
        studentId: row.studentId,
        levelId: row.levelId,
        status: row.status,
        progress: row.progress,
        minutesPracticed: row.minutesPracticed,
        updatedAt: row.updatedAt,
      })),
      BACKUP_LIMITS.lessonProgress,
      (row) => row.updatedAt,
    ),
    skillScores: newest(
      skillScores.map((row) => ({
        studentId: row.studentId,
        skill: row.skill,
        score: row.score,
        source: row.source,
        createdAt: row.createdAt,
      })),
      BACKUP_LIMITS.skillScores,
      (row) => row.createdAt,
    ),
    curriculumProgress: newest(
      curriculumProgress.map((row) => ({
        studentId: row.studentId,
        nodeId: row.nodeId,
        branch: row.branch,
        level: row.level,
        stars: row.stars,
        accuracy: row.accuracy,
        updatedAt: row.updatedAt,
      })),
      BACKUP_LIMITS.curriculumProgress,
      (row) => row.updatedAt,
    ),
    xpLedger: newest(
      xpLedger.map((row) => ({
        studentId: row.studentId,
        amount: row.amount,
        source: row.source,
        detail: row.detail,
        createdAt: row.createdAt,
      })),
      BACKUP_LIMITS.xpLedger,
      (row) => row.createdAt,
    ),
    practiceSessions: newest(
      practiceSessions,
      BACKUP_LIMITS.practiceSessions,
      (row) => row.createdAt,
    ),
  };
}

/**
 * Counts what is on the device and what still needs the academy. `dirtyRows`
 * drives the “100% Guardado en Dispositivo” vs “Sincronizado con Servidor”
 * indicator in the teacher panel.
 */
export async function readBackupStats(): Promise<LocalBackupStats> {
  const db = getLocalDb();
  const [
    students,
    lessonProgress,
    skillScores,
    curriculumProgress,
    xpLedger,
    pendingSessions,
    dirtyLesson,
    dirtyScores,
    dirtyCurriculum,
    dirtyXp,
  ] = await Promise.all([
    db.students.count(),
    db.lessonProgress.count(),
    db.skillScores.count(),
    db.curriculumProgress.count(),
    db.xpLedger.count(),
    db.offlineQueue
      .where("kind")
      .equals("practice")
      .and((entry) => entry.status === "pending")
      .count(),
    db.lessonProgress.filter((row) => row.synced === 0).count(),
    db.skillScores.filter((row) => row.synced === 0).count(),
    db.curriculumProgress.filter((row) => row.synced === 0).count(),
    db.xpLedger.filter((row) => row.synced === 0).count(),
  ]);

  return {
    students,
    lessonProgress,
    skillScores,
    curriculumProgress,
    xpLedger,
    pendingSessions,
    dirtyRows: dirtyLesson + dirtyScores + dirtyCurriculum + dirtyXp,
    totalRows:
      students +
      lessonProgress +
      skillScores +
      curriculumProgress +
      xpLedger +
      pendingSessions,
  };
}

/**
 * Called only after the Server Action confirms the transaction. Marks the rows
 * that actually travelled in the dump as safe (never the overflow beyond a
 * table's ceiling) and clears the practice outbox that was included.
 */
export async function markBackupSynced() {
  const db = getLocalDb();

  const [lesson, scores, curriculum, xp, pending] = await Promise.all([
    db.lessonProgress.toArray(),
    db.skillScores.toArray(),
    db.curriculumProgress.toArray(),
    db.xpLedger.toArray(),
    db.offlineQueue
      .where("kind")
      .equals("practice")
      .and((entry) => entry.status === "pending")
      .toArray(),
  ]);

  const lessonIds = new Set(
    newest(lesson, BACKUP_LIMITS.lessonProgress, (row) => row.updatedAt).map(
      (row) => row.id!,
    ),
  );
  const scoreIds = new Set(
    newest(scores, BACKUP_LIMITS.skillScores, (row) => row.createdAt).map(
      (row) => row.id!,
    ),
  );
  const curriculumIds = new Set(
    newest(
      curriculum,
      BACKUP_LIMITS.curriculumProgress,
      (row) => row.updatedAt,
    ).map((row) => row.id!),
  );
  const xpIds = new Set(
    newest(xp, BACKUP_LIMITS.xpLedger, (row) => row.createdAt).map(
      (row) => row.id!,
    ),
  );
  const pendingIds = newest(
    pending,
    BACKUP_LIMITS.practiceSessions,
    (entry) => entry.createdAt,
  ).flatMap((entry) => (entry.id == null ? [] : [entry.id]));

  await Promise.all([
    db.lessonProgress
      .filter((row) => lessonIds.has(row.id!))
      .modify({ synced: 1 }),
    db.skillScores.filter((row) => scoreIds.has(row.id!)).modify({ synced: 1 }),
    db.curriculumProgress
      .filter((row) => curriculumIds.has(row.id!))
      .modify({ synced: 1 }),
    db.xpLedger.filter((row) => xpIds.has(row.id!)).modify({ synced: 1 }),
  ]);

  if (pendingIds.length) {
    await db.offlineQueue.bulkDelete(pendingIds);
  }
}

export function readBackupStamp() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BACKUP_STAMP_KEY);
}

export function writeBackupStamp(stamp: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BACKUP_STAMP_KEY, stamp);
}

function readDeviceId() {
  if (typeof window === "undefined") return "dev_server";
  const stored = window.localStorage.getItem(DEVICE_ID_KEY);
  if (stored && stored.length >= 4) return stored;
  const next = `dev_${crypto.randomUUID()}`;
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function newest<T>(rows: T[], limit: number, stamp: (row: T) => string) {
  if (rows.length <= limit) return rows;
  return [...rows]
    .sort((a, b) => stamp(a).localeCompare(stamp(b)))
    .slice(-limit);
}

export type { AcademyLocalDatabase };
