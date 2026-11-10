"use client";

/**
 * Per-game records live outside Dexie on purpose: the shared schema only stores
 * `skill` + `score` for game sessions, and the arcade needs richer, game-specific
 * bests (score, BPM, linked chords) without touching the sync tables.
 */

export type GameRecord = {
  score: number;
  accuracy: number;
  maxBpm: number;
  links: number;
  at: number;
};

const STORAGE_KEY = "leo:game-best";
const EVENT = "leo:game-record";

type Store = Record<string, GameRecord>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function keyFor(studentId: string, gameId: string) {
  return `${studentId}:${gameId}`;
}

export function readBestRecord(
  studentId: string | undefined | null,
  gameId: string,
): GameRecord | null {
  if (!studentId) return null;
  const record = readStore()[keyFor(studentId, gameId)];
  if (!record || typeof record.score !== "number") return null;
  return record;
}

/** Stores the record only when it beats the previous score. */
export function saveBestRecord(
  studentId: string | undefined | null,
  gameId: string,
  record: Omit<GameRecord, "at">,
): GameRecord | null {
  if (!studentId || typeof window === "undefined") return null;
  const store = readStore();
  const key = keyFor(studentId, gameId);
  const previous = store[key];
  const next: GameRecord = { ...record, at: Date.now() };
  if (previous && previous.score >= next.score) return previous;
  store[key] = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* Storage full or disabled: the session still counts, just no record. */
  }
  return next;
}

export function subscribeGameRecords(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
