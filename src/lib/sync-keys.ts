/**
 * Shared row identity for the local ↔ server sync.
 *
 * Both sides of the backup (browser and Server Action) must agree on three
 * things without ever importing each other's runtime code:
 *
 *  1. the primary key of a `skill_scores` / `xp_ledger` row;
 *  2. the natural key used to report (and therefore to honour) a rejection;
 *  3. which tables can reject a row at all.
 *
 * A row's identity is its `clientId`: a random value assigned once, on the
 * device, when the event happens. It is deliberately NOT derived from
 * `createdAt`, because the device clock is skewed and a shifted timestamp used
 * to mint a different id for the same event, duplicating XP and scores.
 */

export type BackupTable =
  | "students"
  | "lessonProgress"
  | "skillScores"
  | "curriculumProgress"
  | "xpLedger"
  | "practiceSessions";

/** Rejected natural keys, grouped by table. Empty arrays mean "nothing lost". */
export type BackupRejections = Record<BackupTable, string[]>;

export function emptyRejections(): BackupRejections {
  return {
    students: [],
    lessonProgress: [],
    skillScores: [],
    curriculumProgress: [],
    xpLedger: [],
    practiceSessions: [],
  };
}

export function countRejections(rejections: BackupRejections) {
  return Object.values(rejections).reduce((total, keys) => total + keys.length, 0);
}

/**
 * Canonical primary keys. One event = one row, no matter which writer got
 * there first (`persistPractice`, the live heartbeat, or a device backup).
 */
export function scoreRowId(clientId: string) {
  return `score_${clientId}`;
}

export function xpRowId(clientId: string) {
  return `xp_${clientId}`;
}

/**
 * Natural keys. These only need to be stable and identical on both sides; they
 * are never persisted. Rows written before the `clientId` field existed fall
 * back to a content key that still matches what the server validated.
 */
export function studentKey(row: { id: string }) {
  return row.id;
}

export function lessonProgressKey(row: { studentId: string; levelId: string }) {
  return `${row.studentId}|${row.levelId}`;
}

export function skillScoreKey(row: {
  clientId?: string | null;
  studentId: string;
  skill: string;
  score: number;
  createdAt: string;
}) {
  if (row.clientId) return row.clientId;
  return `${row.studentId}|${row.skill}|${row.score}|${row.createdAt}`;
}

export function curriculumProgressKey(row: {
  studentId: string;
  nodeId: string;
}) {
  return `${row.studentId}|${row.nodeId}`;
}

export function xpKey(row: {
  clientId?: string | null;
  studentId: string;
  source: string;
  amount: number;
  detail: string;
  createdAt: string;
}) {
  if (row.clientId) return row.clientId;
  return `${row.studentId}|${row.source}|${row.amount}|${row.detail}|${row.createdAt}`;
}

export function practiceSessionKey(row: { clientId: string }) {
  return row.clientId;
}
