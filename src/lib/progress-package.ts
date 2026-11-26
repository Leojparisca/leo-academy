/**
 * Progress package — the exact shape a student receives back from the academy.
 *
 * Client-safe on purpose: the server query builds it, the Server Action returns
 * it, and `AcademyProvider` seeds its very first render from it so a brand-new
 * device never paints empty progress while it waits for the network.
 *
 * Every table is keyed by the session's own `studentId`. The server never
 * accepts a student id from the caller, so one student cannot ask for another
 * student's package.
 */

import type { Skill, Student } from "@/lib/academy";
import type { BranchId } from "@/data/curriculum";

export type ProgressLessonRow = {
  levelId: string;
  status: "locked" | "current" | "completed";
  progress: number;
  minutesPracticed: number;
  updatedAt: string;
};

export type ProgressCurriculumRow = {
  nodeId: string;
  branch: BranchId;
  level: number;
  stars: 1 | 2 | 3;
  accuracy: number;
  updatedAt: string;
};

export type ProgressScoreRow = {
  /** Canonical `clientId` when the row has one, otherwise the server row id. */
  clientId: string;
  skill: Skill;
  score: number;
  source: "lesson" | "game" | "teacher";
  createdAt: string;
};

export type ProgressXpRow = {
  /** Canonical `clientId` when the row has one, otherwise the server row id. */
  clientId: string;
  amount: number;
  source: "lesson" | "game" | "group";
  detail: string;
  createdAt: string;
};

export type StudentProgressPackage = {
  /** True only when the progress tables were read, not just the profile. */
  student: Student;
  lessonProgress: ProgressLessonRow[];
  curriculumProgress: ProgressCurriculumRow[];
  skillScores: ProgressScoreRow[];
  xpLedger: ProgressXpRow[];
  /** Server clock of the read, used to order merges deterministically. */
  readAt: string;
};

/**
 * Turns a server row id into the local `clientId` that already exists for the
 * same event. Rows written after the canonical-id migration are `score_<x>` /
 * `xp_<x>`; older rows keep their own id, which is still unique.
 */
export function canonicalClientId(rowId: string) {
  return rowId.replace(/^(score|xp)_/, "");
}

export function toLocalScoreRows(pkg: StudentProgressPackage, studentId: string) {
  return pkg.skillScores.map((row) => ({
    studentId,
    skill: row.skill,
    score: row.score,
    source: row.source,
    createdAt: row.createdAt,
    synced: 1 as const,
    clientId: canonicalClientId(row.clientId),
    origin: "server" as const,
  }));
}

export function toLocalXpRows(pkg: StudentProgressPackage, studentId: string) {
  return pkg.xpLedger.map((row) => ({
    studentId,
    amount: row.amount,
    source: row.source,
    detail: row.detail,
    createdAt: row.createdAt,
    synced: 1 as const,
    clientId: canonicalClientId(row.clientId),
    origin: "server" as const,
  }));
}