import "server-only";

/**
 * Relational schema — SQLite via Drizzle ORM.
 *
 * This module is server-only by contract. Importing it from a Client Component
 * is a build-time error. The browser never receives SQL, credentials or a DB
 * SDK; it only talks to Server Actions.
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = text("created_at").notNull();
const updatedAt = text("updated_at").notNull();

export const students = sqliteTable(
  "students",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    firstName: text("first_name").notNull(),
    initials: text("initials").notNull(),
    avatarTone: text("avatar_tone", {
      enum: ["sapphire", "cyan", "slate"],
    })
      .notNull()
      .default("sapphire"),
    currentLevel: integer("current_level").notNull().default(1),
    age: integer("age"),
    teacherNotes: text("teacher_notes"),
    streakDays: integer("streak_days").notNull().default(0),
    totalMinutes: integer("total_minutes").notNull().default(0),
    accuracy: integer("accuracy").notNull().default(0),
    weeklyMinutes: integer("weekly_minutes").notNull().default(0),
    weeklyGoalMinutes: integer("weekly_goal_minutes").notNull().default(90),
    joinedAt: text("joined_at").notNull(),
    updatedAt,
  },
  (table) => [index("students_updated_idx").on(table.updatedAt)],
);

export const levels = sqliteTable(
  "levels",
  {
    id: text("id").primaryKey(),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    focus: text("focus", {
      enum: ["melody", "harmony", "rhythm", "theory", "performance"],
    }).notNull(),
    minutes: integer("minutes").notNull(),
    xp: integer("xp").notNull(),
    createdAt,
  },
  (table) => [uniqueIndex("levels_ordinal_unique").on(table.ordinal)],
);

export const unlockedLevels = sqliteTable(
  "unlocked_levels",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    levelId: text("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    unlockedAt: text("unlocked_at").notNull(),
    unlockedBy: text("unlocked_by").notNull().default("teacher"),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("unlocked_student_level_unique").on(
      table.studentId,
      table.levelId,
    ),
    index("unlocked_student_idx").on(table.studentId),
  ],
);

export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    levelId: text("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["locked", "current", "completed"],
    })
      .notNull()
      .default("current"),
    progress: integer("progress").notNull().default(0),
    bestScore: integer("best_score").notNull().default(0),
    minutesPracticed: integer("minutes_practiced").notNull().default(0),
    lastPracticedAt: text("last_practiced_at"),
    updatedAt,
  },
  (table) => [
    uniqueIndex("progress_student_level_unique").on(
      table.studentId,
      table.levelId,
    ),
    index("progress_student_idx").on(table.studentId),
  ],
);

export const skillScores = sqliteTable(
  "skill_scores",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    skill: text("skill", { enum: ["melody", "harmony", "rhythm"] }).notNull(),
    score: integer("score").notNull(),
    source: text("source", {
      enum: ["lesson", "game", "teacher"],
    })
      .notNull()
      .default("lesson"),
    createdAt,
    syncedFrom: text("synced_from").notNull().default("server"),
  },
  (table) => [
    index("scores_student_skill_idx").on(table.studentId, table.skill),
  ],
);

export const teacherEvaluations = sqliteTable(
  "teacher_evaluations",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    levelId: text("level_id")
      .notNull()
      .references(() => levels.id, { onDelete: "cascade" }),
    teacherName: text("teacher_name").notNull().default("Prof. Leo"),
    melody: integer("melody").notNull(),
    harmony: integer("harmony").notNull(),
    rhythm: integer("rhythm").notNull(),
    posture: integer("posture").notNull().default(0),
    feedback: text("feedback").notNull(),
    homework: text("homework"),
    createdAt,
  },
  (table) => [
    index("evaluations_student_idx").on(table.studentId),
    index("evaluations_created_idx").on(table.createdAt),
  ],
);

export const attendance = sqliteTable(
  "attendance",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    mode: text("mode", { enum: ["normal", "unplugged"] })
      .notNull()
      .default("normal"),
    notes: text("notes"),
    createdAt,
  },
  (table) => [
    uniqueIndex("attendance_student_date_unique").on(
      table.studentId,
      table.date,
    ),
    index("attendance_date_idx").on(table.date),
  ],
);

export const practiceSessions = sqliteTable(
  "practice_sessions",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    levelId: text("level_id").references(() => levels.id, {
      onDelete: "set null",
    }),
    skill: text("skill", { enum: ["melody", "harmony", "rhythm"] }),
    minutes: integer("minutes").notNull().default(1),
    score: integer("score"),
    source: text("source", { enum: ["live", "offline"] })
      .notNull()
      .default("live"),
    createdAt,
  },
  (table) => [
    index("sessions_student_created_idx").on(
      table.studentId,
      table.createdAt,
    ),
  ],
);

/**
 * Phase 5 — device backup destination.
 *
 * `curriculum_progress` stores the sealed nodes of the on-device curriculum
 * map, and `xp_ledger` is an append-only log of XP earned offline. Both are
 * written exclusively by the hardened `syncBackupAction`, never by the browser.
 */
export const curriculumProgress = sqliteTable(
  "curriculum_progress",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    nodeId: text("node_id").notNull(),
    branch: text("branch", {
      enum: ["ritmo", "melodia", "armonia"],
    }).notNull(),
    level: integer("level").notNull(),
    stars: integer("stars").notNull().default(1),
    accuracy: integer("accuracy").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("curriculum_student_node_unique").on(
      table.studentId,
      table.nodeId,
    ),
    index("curriculum_student_idx").on(table.studentId),
  ],
);

export const xpLedger = sqliteTable(
  "xp_ledger",
  {
    id: text("id").primaryKey(),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    source: text("source", {
      enum: ["lesson", "game", "group"],
    })
      .notNull()
      .default("lesson"),
    detail: text("detail").notNull().default(""),
    createdAt,
    syncedFrom: text("synced_from").notNull().default("device"),
  },
  (table) => [
    index("xp_student_idx").on(table.studentId),
    index("xp_created_idx").on(table.createdAt),
  ],
);

/**
 * Phase 6 — private student identities.
 *
 * Each student owns exactly one short access code. The code is the only thing
 * a student types after their name; the browser never receives the full list.
 */
export const studentAccessCodes = sqliteTable(
  "student_access_codes",
  {
    studentId: text("student_id")
      .primaryKey()
      .references(() => students.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    createdAt,
    updatedAt,
    lastLoginAt: text("last_login_at"),
  },
  (table) => [uniqueIndex("student_code_unique").on(table.code)],
);

/**
 * Phase 6 — live classroom presence.
 *
 * One row per student. `syncLiveProgressAction` upserts it every few seconds
 * while the student practises; the teacher dashboard polls it every 3s.
 */
export const livePresence = sqliteTable(
  "live_presence",
  {
    studentId: text("student_id")
      .primaryKey()
      .references(() => students.id, { onDelete: "cascade" }),
    tab: text("tab").notNull().default("mapa"),
    levelId: text("level_id"),
    exercise: text("exercise").notNull().default(""),
    keyLabel: text("key_label"),
    skill: text("skill", { enum: ["melody", "harmony", "rhythm"] }),
    melody: integer("melody").notNull().default(0),
    harmony: integer("harmony").notNull().default(0),
    rhythm: integer("rhythm").notNull().default(0),
    progress: integer("progress").notNull().default(0),
    practicing: integer("practicing", { mode: "boolean" })
      .notNull()
      .default(false),
    lastActivity: text("last_activity").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
  },
  (table) => [index("live_presence_seen_idx").on(table.lastSeenAt)],
);

/** Small key/value store for teacher settings such as the hashed PIN. */
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt,
});

/** Adds a rolling "this week" window without a second table. */
export const weeklyPracticeMinutes = sql`
  select coalesce(sum(${practiceSessions.minutes}), 0) as minutes
  from ${practiceSessions}
  where ${practiceSessions.studentId} = ${students.id}
    and ${practiceSessions.createdAt} >= datetime('now', '-7 days')
`;

export type StudentRow = typeof students.$inferSelect;
export type NewStudentRow = typeof students.$inferInsert;
export type LevelRow = typeof levels.$inferSelect;
export type TeacherEvaluationRow = typeof teacherEvaluations.$inferSelect;
export type NewTeacherEvaluationRow = typeof teacherEvaluations.$inferInsert;
export type LessonProgressRow = typeof lessonProgress.$inferSelect;
export type CurriculumProgressRow = typeof curriculumProgress.$inferSelect;
export type NewCurriculumProgressRow = typeof curriculumProgress.$inferInsert;
export type XpLedgerRow = typeof xpLedger.$inferSelect;
export type NewXpLedgerRow = typeof xpLedger.$inferInsert;
export type StudentAccessCodeRow = typeof studentAccessCodes.$inferSelect;
export type LivePresenceRow = typeof livePresence.$inferSelect;
