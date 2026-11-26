import * as SQLite from "expo-sqlite";

let database: SQLite.SQLiteDatabase | undefined;
export async function getDatabase() { database ??= await SQLite.openDatabaseAsync("leo-academy.db"); return database; }

export async function bootstrapDatabase() {
  const db = await getDatabase();
  await db.execAsync(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS student_profile (id TEXT PRIMARY KEY, payload TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lesson_progress (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS curriculum_progress (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS skill_scores (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS xp_ledger (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_outbox (client_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT, last_error TEXT);
    CREATE TABLE IF NOT EXISTS device_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS sync_outbox_due_idx ON sync_outbox(next_attempt_at, created_at);`);
}

export async function pendingOutboxCount() {
  const result = await (await getDatabase()).getFirstAsync<{ count: number }>("SELECT count(*) AS count FROM sync_outbox");
  return result?.count ?? 0;
}

export async function hasLocalProfile() {
  const result = await (await getDatabase()).getFirstAsync<{ id: string }>("SELECT id FROM student_profile LIMIT 1");
  return Boolean(result?.id);
}

export async function getHomeMetrics() {
  const db = await getDatabase();
  const profile = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM student_profile LIMIT 1");
  const lessons = await db.getAllAsync<{ payload: string }>("SELECT payload FROM lesson_progress");
  let lastPracticedAt: string | null = null;
  for (const item of lessons) {
    const date = JSON.parse(item.payload).lastPracticedAt as string | null | undefined;
    if (date && (!lastPracticedAt || date > lastPracticedAt)) lastPracticedAt = date;
  }
  const student = profile ? JSON.parse(profile.payload) : {};
  return { streakDays: Number(student.streakDays ?? 0), lastPracticedAt };
}
