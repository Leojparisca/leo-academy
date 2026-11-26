"use client";

/**
 * Leo Academy — offline-first local cache.
 *
 * IMPORTANT: Dexie/IndexedDB is a *cache and offline outbox*, never the source
 * of truth. It lives exclusively in the browser. The academy's relational
 * database is SQLite, owned by the server and never reachable from this file.
 */

import Dexie, { type EntityTable } from "dexie";
import {
  ACTIVE_STUDENT_KEY,
  type AttendanceMode,
  type Skill,
  type Student,
} from "@/lib/academy";
import {
  BACKUP_LIMITS,
  BACKUP_STAMP_KEY,
  BACKUP_VERSION,
  DEVICE_ID_KEY,
  type BackupDump,
  type BackupStudent,
  type BackupSummary,
  type BackupTruncation,
  type LocalBackupStats,
} from "@/lib/backup";
import {
  curriculumProgressKey,
  lessonProgressKey,
  practiceSessionKey,
  skillScoreKey,
  xpKey,
} from "@/lib/sync-keys";
import {
  canonicalClientId,
  type StudentProgressPackage,
} from "@/lib/progress-package";
import { type BranchId, type CurriculumNode } from "@/data/curriculum";
import { uid } from "@/lib/utils";

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
  /**
   * Random identity of the event that produced this row. It is the same value
   * the server uses to key `skill_scores`, so the live heartbeat, the practice
   * action and a later backup all collapse into one row instead of three.
   */
  clientId?: string;
  /**
   * `"server"` marks a row that came down from the academy rather than being
   * produced on this device. Such a row is already safe upstream: it is never
   * re-sent in a backup and never counted as pending sync.
   */
  origin?: "device" | "server";
};

export type OfflineMutationKind = "practice" | "evaluation" | "student";

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
  /** Same rule as `LocalSkillScore.clientId`: identity, never a timestamp. */
  clientId?: string;
  /** Same rule as `LocalSkillScore.origin`. */
  origin?: "device" | "server";
};

/** Mirror of the SQLite attendance row used by "Pasar Lista Grupal". */
export type LocalAttendance = {
  id?: number;
  studentId: string;
  date: string;
  mode: AttendanceMode;
  notes: string | null;
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

/**
 * A student the teacher created while SQLite was unreachable. It lives in the
 * Dexie outbox —the teacher sees the provisional code immediately— and the
 * dashboard replays it against `addStudentAction` until the server confirms.
 */
export type PendingStudentCreation = {
  queueId: number;
  clientId: string;
  code: string;
  name: string;
  age: number | null;
  level: number;
  weeklyGoalMinutes: number;
  notes: string;
  createdAt: string;
};

type StudentCreationPayload = Omit<PendingStudentCreation, "queueId">;

class AcademyLocalDatabase extends Dexie {
  students!: EntityTable<Student, "id">;
  lessonProgress!: EntityTable<LocalLessonProgress, "id">;
  skillScores!: EntityTable<LocalSkillScore, "id">;
  offlineQueue!: EntityTable<OfflineMutation, "id">;
  curriculumProgress!: EntityTable<LocalCurriculumProgress, "id">;
  xpLedger!: EntityTable<LocalXpEntry, "id">;
  attendance!: EntityTable<LocalAttendance, "id">;

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
    this.version(3).stores({
      students: "id, name, updatedAt",
      lessonProgress:
        "++id, studentId, levelId, updatedAt, [studentId+levelId]",
      skillScores: "++id, studentId, skill, createdAt, [studentId+skill]",
      offlineQueue: "++id, clientId, status, kind, createdAt",
      curriculumProgress:
        "++id, studentId, nodeId, branch, level, updatedAt, [studentId+nodeId]",
      xpLedger: "++id, studentId, source, createdAt, [studentId+source]",
      attendance: "++id, studentId, date, createdAt, [studentId+date]",
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
  // Student-creation rows are teacher-only and are replayed by the dashboard;
  // they must not hold back the student's practice/backup merge.
  return getLocalDb()
    .offlineQueue.where("status")
    .equals("pending")
    .and((entry) => entry.kind !== "student")
    .count();
}

/** Same unambiguous alphabet as the server: no O/0, I/1 or L. */
const LOCAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Provisional code the teacher can read and hand out instantly. The server
 * reuses it when the pending creation finally syncs (unless it was taken).
 */
export function newLocalStudentCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => LOCAL_CODE_ALPHABET[byte % LOCAL_CODE_ALPHABET.length],
  ).join("");
}

export async function queueStudentCreation(
  input: StudentCreationPayload,
): Promise<PendingStudentCreation> {
  const db = getLocalDb();
  const queueId = await db.offlineQueue.add({
    clientId: input.clientId,
    kind: "student",
    payload: JSON.stringify(input),
    createdAt: input.createdAt,
    attempts: 0,
    status: "pending",
  });
  if (queueId == null) {
    throw new Error("No se pudo escribir el alumno en la cola local.");
  }
  return { ...input, queueId: Number(queueId) };
}

function parseStudentCreation(
  payload: string,
): StudentCreationPayload | null {
  try {
    const value = JSON.parse(payload) as Partial<StudentCreationPayload>;
    if (
      typeof value.clientId !== "string" ||
      typeof value.code !== "string" ||
      typeof value.name !== "string" ||
      typeof value.level !== "number" ||
      typeof value.weeklyGoalMinutes !== "number" ||
      typeof value.createdAt !== "string"
    ) {
      return null;
    }
    return {
      clientId: value.clientId,
      code: value.code,
      name: value.name,
      age: typeof value.age === "number" ? value.age : null,
      level: value.level,
      weeklyGoalMinutes: value.weeklyGoalMinutes,
      notes: typeof value.notes === "string" ? value.notes : "",
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}

export async function readPendingStudentCreations(): Promise<
  PendingStudentCreation[]
> {
  const entries = await getLocalDb().offlineQueue
    .where("kind")
    .equals("student")
    .and(
      (entry) => entry.status === "pending" || entry.status === "failed",
    )
    .toArray();

  return entries.flatMap((entry) => {
    const payload = parseStudentCreation(entry.payload);
    if (!payload) return [];
    return [{ ...payload, queueId: entry.id! }];
  });
}

/** Removes the outbox row once SQLite confirmed the exact same client id. */
export async function completeStudentCreation(clientId: string) {
  const db = getLocalDb();
  const rows = await db.offlineQueue
    .where("clientId")
    .equals(clientId)
    .and((entry) => entry.kind === "student")
    .toArray();
  await db.offlineQueue.bulkDelete(
    rows.flatMap((entry) => (entry.id == null ? [] : [entry.id])),
  );
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
    clientId: uid("xp"),
  });
}

/**
 * Writes the whole class list in a single Dexie transaction, like the server
 * action does in SQLite. Re-saving the same day updates instead of duplicating.
 */
export async function saveAttendanceBatchLocal(input: {
  date: string;
  mode: AttendanceMode;
  notes: string | null;
  studentIds: string[];
}) {
  const db = getLocalDb();
  const now = new Date().toISOString();
  const unique = [...new Set(input.studentIds)];

  await db.transaction("rw", db.attendance, async () => {
    for (const studentId of unique) {
      const existing = await db.attendance
        .where("[studentId+date]")
        .equals([studentId, input.date])
        .first();
      if (existing) {
        await db.attendance.update(existing.id!, {
          mode: input.mode,
          notes: input.notes,
          createdAt: now,
          synced: 0,
        });
      } else {
        await db.attendance.add({
          studentId,
          date: input.date,
          mode: input.mode,
          notes: input.notes,
          createdAt: now,
          synced: 0,
        });
      }
    }
  });

  return unique.length;
}

export async function markAttendanceSynced(
  date: string,
  studentIds: string[],
) {
  const db = getLocalDb();
  const unique = new Set(studentIds);
  await db.attendance
    .where("date")
    .equals(date)
    .and((row) => unique.has(row.studentId))
    .modify({ synced: 1 });
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

export type BackupManifestEntry = {
  id: number;
  key: string;
  stamp: string;
};

export type BackupManifest = {
  lessonProgress: BackupManifestEntry[];
  skillScores: BackupManifestEntry[];
  curriculumProgress: BackupManifestEntry[];
  xpLedger: BackupManifestEntry[];
  practiceSessions: Array<{ queueId: number; key: string; stamp: string }>;
};

export type BackupPayload = {
  dump: BackupDump;
  manifest: BackupManifest;
  truncated: BackupTruncation[];
};

/* ------------------------------------------------------------------ *
 * Server → device hydration (Max-Wins)
 *
 * The device cache is never replaced wholesale: that would delete practice
 * done offline on this phone. Each row is merged monotonically instead —
 * the largest XP, the most stars and the best accuracy always win, and the
 * union of sealed nodes is kept. A row can move forward, never backwards.
 * ------------------------------------------------------------------ */

export type HydrationConflict = {
  /** Rows where the academy was ahead and the device caught up. */
  remoteAhead: number;
  /** Rows where the device was ahead and its value was preserved. */
  localAhead: number;
  /** True when the device already had progress before this merge. */
  hadLocalProgress: boolean;
};

export type HydrationResult = {
  inserted: number;
  updated: number;
  unchanged: number;
  conflict: HydrationConflict;
};

/** Merges two stamps so the survivor looks the most recent of the two. */
function latestStamp(left: string, right: string) {
  return right > left ? right : left;
}

/**
 * Writes a server progress package into Dexie.
 *
 * Rules, in order of importance:
 *  1. nothing is deleted — only `put`, never `delete`/`clear`;
 *  2. XP and lesson/skill rows are merged with `max`, so the best value wins;
 *  3. `curriculum_progress` is the union of sealed nodes; a node present only
 *     on the device stays;
 *  4. rows that already exist upstream are stored as `origin: "server"` and
 *     `synced: 1`, which excludes them from the next backup;
 *  5. `lesson_progress` rows are never downgraded from `completed` to
 *     `locked`/`current`, and `progress`/`minutesPracticed` never shrink.
 *
 * The `student` row is deliberately untouched: the profile was already
 * rendered from the server layout, and the teacher owns identity and level.
 */
export async function hydrateFromServer(
  pkg: StudentProgressPackage,
): Promise<HydrationResult> {
  const db = getLocalDb();
  const studentId = pkg.student.id;

  const [localLessons, localScores, localCurriculum, localXp] = await Promise.all([
    db.lessonProgress.where("studentId").equals(studentId).toArray(),
    db.skillScores.where("studentId").equals(studentId).toArray(),
    db.curriculumProgress.where("studentId").equals(studentId).toArray(),
    db.xpLedger.where("studentId").equals(studentId).toArray(),
  ]);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let remoteAhead = 0;
  let localAhead = 0;
  const hadLocalProgress =
    localLessons.length + localScores.length + localCurriculum.length + localXp.length > 0;

  /* -------------------------------------------------------------- lessons */
  const lessonStatusRank = { locked: 0, current: 1, completed: 2 } as const;
  for (const remote of pkg.lessonProgress) {
    const local = localLessons.find((row) => row.levelId === remote.levelId);
    if (!local) {
      await db.lessonProgress.add({
        studentId,
        levelId: remote.levelId,
        status: remote.status,
        progress: remote.progress,
        minutesPracticed: remote.minutesPracticed,
        updatedAt: remote.updatedAt,
        synced: 1,
      });
      inserted += 1;
      continue;
    }

    // A lesson the student finished on this device stays finished even if the
    // academy still has it as "current": progress is monotonic.
    const keepLocalStatus =
      lessonStatusRank[local.status] > lessonStatusRank[remote.status];
    const nextStatus = keepLocalStatus ? local.status : remote.status;
    const nextProgress = Math.max(local.progress, remote.progress);
    const nextMinutes = Math.max(local.minutesPracticed, remote.minutesPracticed);

    if (
      lessonStatusRank[remote.status] > lessonStatusRank[local.status] ||
      remote.progress > local.progress ||
      remote.minutesPracticed > local.minutesPracticed
    ) {
      remoteAhead += 1;
    } else if (
      lessonStatusRank[local.status] > lessonStatusRank[remote.status] ||
      local.progress > remote.progress ||
      local.minutesPracticed > remote.minutesPracticed
    ) {
      localAhead += 1;
    }

    if (
      nextStatus === local.status &&
      nextProgress === local.progress &&
      nextMinutes === local.minutesPracticed
    ) {
      unchanged += 1;
      continue;
    }

    await db.lessonProgress.update(local.id!, {
      status: nextStatus,
      progress: nextProgress,
      minutesPracticed: nextMinutes,
      updatedAt: latestStamp(local.updatedAt, remote.updatedAt),
      synced: 1,
    });
    updated += 1;
  }

  /* ----------------------------------------------------------- curriculum */
  const curriculumByNode = new Map(
    localCurriculum.map((row) => [row.nodeId, row] as const),
  );
  for (const remote of pkg.curriculumProgress) {
    const local = curriculumByNode.get(remote.nodeId);
    if (!local) {
      await db.curriculumProgress.add({
        studentId,
        nodeId: remote.nodeId,
        branch: remote.branch,
        level: remote.level,
        stars: remote.stars,
        accuracy: remote.accuracy,
        updatedAt: remote.updatedAt,
        synced: 1,
      });
      inserted += 1;
      continue;
    }

    const stars = Math.max(local.stars, remote.stars) as 1 | 2 | 3;
    const accuracy = Math.max(local.accuracy, remote.accuracy);
    if (remote.stars > local.stars || remote.accuracy > local.accuracy) {
      remoteAhead += 1;
    } else if (local.stars > remote.stars || local.accuracy > remote.accuracy) {
      localAhead += 1;
    }

    if (stars === local.stars && accuracy === local.accuracy) {
      // Already identical: only the bookkeeping changes, and only if needed.
      if (local.synced !== 1) {
        await db.curriculumProgress.update(local.id!, { synced: 1 });
        updated += 1;
      } else {
        unchanged += 1;
      }
      continue;
    }

    await db.curriculumProgress.update(local.id!, {
      stars,
      accuracy,
      updatedAt: latestStamp(local.updatedAt, remote.updatedAt),
      synced: 1,
    });
    updated += 1;
  }

  /* -------------------------------------------------------- skill scores */
  const scoreKey = (row: {
    clientId?: string;
    studentId: string;
    skill: string;
    score: number;
    createdAt: string;
  }) => skillScoreKey({ ...row, clientId: row.clientId ?? null });

  // Legacy rows came back from the academy with a hashed id, so the client id
  // cannot match. Their content is the only stable handle left.
  const contentScoreKey = (row: {
    skill: string;
    score: number;
    createdAt: string;
  }) => `${row.skill}|${row.score}|${row.createdAt}`;

  const localScoreContent = new Map(
    localScores.map((row) => [contentScoreKey(row), row] as const),
  );

  for (const remote of pkg.skillScores) {
    const clientId = canonicalClientId(remote.clientId);
    const key = skillScoreKey({
      clientId,
      studentId,
      skill: remote.skill,
      score: remote.score,
      createdAt: remote.createdAt,
    });
    const content = contentScoreKey(remote);

    const local =
      localScores.find((row) => scoreKey(row) === key) ??
      localScoreContent.get(content);

    if (local) {
      // The event already exists on this device (it produced the row in the
      // first place). Mark it as confirmed instead of duplicating it.
      if (local.synced !== 1) {
        await db.skillScores.update(local.id!, {
          synced: 1,
          origin: "server",
        });
        updated += 1;
      } else {
        unchanged += 1;
      }
      continue;
    }

    await db.skillScores.add({
      studentId,
      skill: remote.skill,
      score: remote.score,
      source: remote.source,
      createdAt: remote.createdAt,
      synced: 1,
      clientId,
      origin: "server",
    });
    inserted += 1;
  }

  /* ---------------------------------------------------------- xp ledger */
  const xpKeyOf = (row: {
    clientId?: string;
    studentId: string;
    source: string;
    amount: number;
    detail: string;
    createdAt: string;
  }) => xpKey({ ...row, clientId: row.clientId ?? null });

  const localXpKeys = new Set(localXp.map((row) => xpKeyOf(row)));
  for (const remote of pkg.xpLedger) {
    const clientId = canonicalClientId(remote.clientId);
    const key = xpKey({
      clientId,
      studentId,
      source: remote.source,
      amount: remote.amount,
      detail: remote.detail,
      createdAt: remote.createdAt,
    });

    if (localXpKeys.has(key)) {
      const local = localXp.find((row) => xpKeyOf(row) === key);
      if (!local) {
        unchanged += 1;
        continue;
      }

      // The same event, but the two copies disagree on the amount. Max wins:
      // a stale queued entry must never lower a ledger the academy already
      // corrected. The count feeds the "this phone was behind" notice.
      if (remote.amount > local.amount) remoteAhead += 1;
      else if (local.amount > remote.amount) localAhead += 1;
      const amount = Math.max(local.amount, remote.amount);

      if (
        local.synced !== 1 ||
        local.amount !== amount ||
        local.origin !== "server"
      ) {
        await db.xpLedger.update(local.id!, {
          amount,
          clientId: local.clientId ?? clientId,
          synced: 1,
          origin: "server",
        });
        updated += 1;
      } else {
        unchanged += 1;
      }
      continue;
    }

    // A locally queued XP entry for the same moment and detail is the same
    // event: keep one row, keep the larger amount, never both.
    const rival = localXp.find(
      (row) =>
        row.detail === remote.detail &&
        row.source === remote.source &&
        row.createdAt === remote.createdAt,
    );
    if (rival) {
      if (remote.amount > rival.amount) remoteAhead += 1;
      else if (rival.amount > remote.amount) localAhead += 1;
      await db.xpLedger.update(rival.id!, {
        amount: Math.max(rival.amount, remote.amount),
        clientId: rival.clientId ?? clientId,
        synced: 1,
        origin: "server",
      });
      updated += 1;
      continue;
    }

    await db.xpLedger.add({
      studentId,
      amount: remote.amount,
      source: remote.source,
      detail: remote.detail,
      createdAt: remote.createdAt,
      synced: 1,
      clientId,
      origin: "server",
    });
    localXpKeys.add(key);
    inserted += 1;
  }

  return {
    inserted,
    updated,
    unchanged,
    conflict: {
      remoteAhead,
      localAhead,
      hadLocalProgress,
    },
  };
}

/**
 * Reads the whole on-device cache as a validated backup dump.
 *
 * The dump and its manifest come from a single pass over the same slice. The
 * manifest is the only trustworthy record of what actually left the device, so
 * a row can never be marked as synced by accident. When a table hits its hard
 * ceiling the overflow is reported, not discarded silently: it stays on the
 * device and travels in the next backup.
 */
export async function readBackupPayload(): Promise<BackupPayload> {
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

  // Rows that came down from the academy are already in SQLite: re-sending them
  // would waste the tight per-table ceilings and could resurrect a row the
  // server has since corrected. Only what this device produced travels back.
  const localOnlyScores = skillScores.filter((row) => row.origin !== "server");
  const localOnlyXp = xpLedger.filter((row) => row.origin !== "server");

  const sessions = queue.flatMap((entry) => {
    try {
      return [
        {
          queueId: entry.id!,
          payload: JSON.parse(entry.payload) as PracticePayload,
        },
      ];
    } catch {
      return [];
    }
  });

  const studentRows = newest(
    students,
    BACKUP_LIMITS.students,
    (row) => row.updatedAt,
  );
  const lessonRows = newest(
    lessonProgress,
    BACKUP_LIMITS.lessonProgress,
    (row) => row.updatedAt,
  );
  const scoreRows = newest(
    localOnlyScores,
    BACKUP_LIMITS.skillScores,
    (row) => row.createdAt,
  );
  const curriculumRows = newest(
    curriculumProgress,
    BACKUP_LIMITS.curriculumProgress,
    (row) => row.updatedAt,
  );
  const xpRows = newest(
    localOnlyXp,
    BACKUP_LIMITS.xpLedger,
    (row) => row.createdAt,
  );
  const sessionRows = newest(
    sessions,
    BACKUP_LIMITS.practiceSessions,
    (row) => row.payload.createdAt,
  );

  const truncated: BackupTruncation[] = [];
  const noteTruncation = (
    table: BackupTruncation["table"],
    total: number,
    kept: number,
  ) => {
    if (total > kept) truncated.push({ table, total, kept });
  };
  noteTruncation("students", students.length, studentRows.length);
  noteTruncation("lessonProgress", lessonProgress.length, lessonRows.length);
  noteTruncation("skillScores", localOnlyScores.length, scoreRows.length);
  noteTruncation(
    "curriculumProgress",
    curriculumProgress.length,
    curriculumRows.length,
  );
  noteTruncation("xpLedger", localOnlyXp.length, xpRows.length);
  noteTruncation("practiceSessions", sessions.length, sessionRows.length);

  const manifest: BackupManifest = {
    lessonProgress: lessonRows.map((row) => ({
      id: row.id!,
      key: lessonProgressKey(row),
      stamp: row.updatedAt,
    })),
    skillScores: scoreRows.map((row) => ({
      id: row.id!,
      key: skillScoreKey(row),
      stamp: row.createdAt,
    })),
    curriculumProgress: curriculumRows.map((row) => ({
      id: row.id!,
      key: curriculumProgressKey(row),
      stamp: row.updatedAt,
    })),
    xpLedger: xpRows.map((row) => ({
      id: row.id!,
      key: xpKey(row),
      stamp: row.createdAt,
    })),
    practiceSessions: sessionRows.map((row) => ({
      queueId: row.queueId,
      key: practiceSessionKey(row.payload),
      stamp: row.payload.createdAt,
    })),
  };

  return {
    dump: {
      version: BACKUP_VERSION,
      generatedAt: new Date().toISOString(),
      deviceId: readDeviceId(),
      students: studentRows.map(
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
      lessonProgress: lessonRows.map((row) => ({
        studentId: row.studentId,
        levelId: row.levelId,
        status: row.status,
        progress: row.progress,
        minutesPracticed: row.minutesPracticed,
        updatedAt: row.updatedAt,
      })),
      skillScores: scoreRows.map((row) => ({
        studentId: row.studentId,
        skill: row.skill,
        score: row.score,
        source: row.source,
        createdAt: row.createdAt,
        clientId: row.clientId,
      })),
      curriculumProgress: curriculumRows.map((row) => ({
        studentId: row.studentId,
        nodeId: row.nodeId,
        branch: row.branch,
        level: row.level,
        stars: row.stars,
        accuracy: row.accuracy,
        updatedAt: row.updatedAt,
      })),
      xpLedger: xpRows.map((row) => ({
        studentId: row.studentId,
        amount: row.amount,
        source: row.source,
        detail: row.detail,
        createdAt: row.createdAt,
        clientId: row.clientId,
      })),
      practiceSessions: sessionRows.map((row) => row.payload),
    },
    manifest,
    truncated,
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
 * Called only after the Server Action confirms the transaction.
 *
 * A row is marked as synced only when all three conditions hold:
 *  1. it was part of the exact slice that travelled (the manifest);
 *  2. the server did not report its natural key as rejected;
 *  3. its stamp has not changed since the dump was built.
 *
 * The practice outbox follows the same rule: delivered sessions are deleted,
 * rejected ones stay on the device marked `failed`, and sessions created while
 * the request was in flight were never in the manifest, so they are untouched.
 */
export async function markBackupSynced(
  summary: BackupSummary,
  manifest: BackupManifest,
) {
  const db = getLocalDb();
  const rejected = {
    lessonProgress: new Set(summary.rejected.lessonProgress),
    skillScores: new Set(summary.rejected.skillScores),
    curriculumProgress: new Set(summary.rejected.curriculumProgress),
    xpLedger: new Set(summary.rejected.xpLedger),
    practiceSessions: new Set(summary.rejected.practiceSessions),
  };

  const lessonIds = await confirmedIds(
    manifest.lessonProgress,
    rejected.lessonProgress,
    async (ids) =>
      (await db.lessonProgress.bulkGet(ids)).map((row) => row?.updatedAt),
  );
  const scoreIds = await confirmedIds(
    manifest.skillScores,
    rejected.skillScores,
    async (ids) =>
      (await db.skillScores.bulkGet(ids)).map((row) => row?.createdAt),
  );
  const curriculumIds = await confirmedIds(
    manifest.curriculumProgress,
    rejected.curriculumProgress,
    async (ids) =>
      (await db.curriculumProgress.bulkGet(ids)).map((row) => row?.updatedAt),
  );
  const xpIds = await confirmedIds(
    manifest.xpLedger,
    rejected.xpLedger,
    async (ids) => (await db.xpLedger.bulkGet(ids)).map((row) => row?.createdAt),
  );

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

  const queueIds = manifest.practiceSessions.map((entry) => entry.queueId);
  if (!queueIds.length) return;

  const queueRows = await db.offlineQueue.bulkGet(queueIds);
  const delivered: number[] = [];
  const failed: number[] = [];

  manifest.practiceSessions.forEach((entry, index) => {
    const row = queueRows[index];
    if (!row) return;
    if (rejected.practiceSessions.has(entry.key)) {
      // Refused by the server: never delete it, never retry it blindly.
      if (row.status !== "failed") failed.push(entry.queueId);
      return;
    }
    if (row.status === "pending") delivered.push(entry.queueId);
  });

  if (delivered.length) await db.offlineQueue.bulkDelete(delivered);
  for (const id of failed) {
    await db.offlineQueue.update(id, { status: "failed" });
  }
}

/**
 * Local ids whose row is still exactly what travelled: the server accepted its
 * natural key and the on-device stamp has not changed since the dump was built.
 */
async function confirmedIds(
  entries: BackupManifestEntry[],
  rejected: Set<string>,
  readStamps: (ids: number[]) => Promise<Array<string | undefined>>,
) {
  const accepted = entries.filter((entry) => !rejected.has(entry.key));
  if (!accepted.length) return new Set<number>();
  const stamps = await readStamps(accepted.map((entry) => entry.id));
  const ids = new Set<number>();
  accepted.forEach((entry, index) => {
    if (stamps[index] === entry.stamp) ids.add(entry.id);
  });
  return ids;
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
