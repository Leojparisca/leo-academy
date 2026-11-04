/**
 * Leo Academy — Phase 5 backup contract.
 *
 * This module is deliberately client-safe: the exact same Zod schema validates
 * the dump in the browser (before it is sent) and again inside the Server
 * Action (before it touches SQLite). The browser never sees the database.
 */

import { z } from "zod";

export const BACKUP_VERSION = 1 as const;
export const BACKUP_STAMP_KEY = "leo.lastBackupAt";
export const DEVICE_ID_KEY = "leo.deviceId";

/**
 * Hard ceilings. A malicious or corrupted client cannot turn one backup into
 * an unbounded write; the schema rejects oversized payloads outright.
 */
export const BACKUP_LIMITS = {
  students: 24,
  lessonProgress: 600,
  skillScores: 2000,
  curriculumProgress: 400,
  xpLedger: 2000,
  practiceSessions: 100,
} as const;

const isoStamp = z.string().min(8).max(40);
const studentId = z
  .string()
  .regex(/^stu_[a-z0-9_-]{1,40}$/i, "Identificador de alumno no válido.");
const levelId = z.string().regex(/^level-\d{2}$/);
const skill = z.enum(["melody", "harmony", "rhythm"]);
const branch = z.enum(["ritmo", "melodia", "armonia"]);
const nodeId = z
  .string()
  .regex(/^cur-(ritmo|melodia|armonia)-\d{1,2}$/, "Nodo de currículo no válido.");

export const backupStudentSchema = z.object({
  id: studentId,
  name: z.string().min(1).max(80),
  firstName: z.string().min(1).max(40),
  initials: z.string().min(1).max(4),
  avatarTone: z.enum(["sapphire", "cyan", "slate"]),
  currentLevel: z.number().int().min(1).max(60),
  age: z.number().int().min(3).max(99).nullable(),
  teacherNotes: z.string().max(800).nullable(),
  streakDays: z.number().int().min(0).max(3650),
  totalMinutes: z.number().int().min(0).max(1_000_000),
  accuracy: z.number().int().min(0).max(100),
  weeklyMinutes: z.number().int().min(0).max(100_000),
  weeklyGoalMinutes: z.number().int().min(0).max(100_000),
  joinedAt: isoStamp,
  updatedAt: isoStamp,
});

export const backupLessonProgressSchema = z.object({
  studentId,
  levelId,
  status: z.enum(["locked", "current", "completed"]),
  progress: z.number().int().min(0).max(100),
  minutesPracticed: z.number().int().min(0).max(100_000),
  updatedAt: isoStamp,
});

export const backupSkillScoreSchema = z.object({
  studentId,
  skill,
  score: z.number().int().min(0).max(100),
  source: z.enum(["lesson", "game", "teacher"]),
  createdAt: isoStamp,
});

export const backupCurriculumSchema = z.object({
  studentId,
  nodeId,
  branch,
  level: z.number().int().min(1).max(60),
  stars: z.number().int().min(1).max(3),
  accuracy: z.number().int().min(0).max(100),
  updatedAt: isoStamp,
});

export const backupXpSchema = z.object({
  studentId,
  amount: z.number().int().min(0).max(10_000),
  source: z.enum(["lesson", "game", "group"]),
  detail: z.string().max(200),
  createdAt: isoStamp,
});

export const backupPracticeSchema = z.object({
  clientId: z.string().min(8).max(80),
  studentId,
  levelId,
  minutes: z.number().int().min(1).max(180),
  skill,
  score: z.number().int().min(0).max(100),
  createdAt: isoStamp,
});

export const backupDumpSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  generatedAt: isoStamp,
  deviceId: z.string().min(4).max(80),
  students: z.array(backupStudentSchema).max(BACKUP_LIMITS.students),
  lessonProgress: z
    .array(backupLessonProgressSchema)
    .max(BACKUP_LIMITS.lessonProgress),
  skillScores: z
    .array(backupSkillScoreSchema)
    .max(BACKUP_LIMITS.skillScores),
  curriculumProgress: z
    .array(backupCurriculumSchema)
    .max(BACKUP_LIMITS.curriculumProgress),
  xpLedger: z.array(backupXpSchema).max(BACKUP_LIMITS.xpLedger),
  practiceSessions: z
    .array(backupPracticeSchema)
    .max(BACKUP_LIMITS.practiceSessions),
});

export type BackupDump = z.infer<typeof backupDumpSchema>;
export type BackupStudent = z.infer<typeof backupStudentSchema>;
export type BackupLessonProgress = z.infer<typeof backupLessonProgressSchema>;
export type BackupSkillScore = z.infer<typeof backupSkillScoreSchema>;
export type BackupCurriculum = z.infer<typeof backupCurriculumSchema>;
export type BackupXp = z.infer<typeof backupXpSchema>;
export type BackupPractice = z.infer<typeof backupPracticeSchema>;

export type BackupSummary = {
  students: number;
  studentsUpdated: number;
  lessonProgress: number;
  skillScores: number;
  curriculumProgress: number;
  xpLedger: number;
  practiceSessions: number;
  skipped: number;
  total: number;
  syncedAt: string;
};

export type BackupState = "device" | "syncing" | "synced" | "error";

export type LocalBackupStats = {
  students: number;
  lessonProgress: number;
  skillScores: number;
  curriculumProgress: number;
  xpLedger: number;
  pendingSessions: number;
  dirtyRows: number;
  totalRows: number;
};
