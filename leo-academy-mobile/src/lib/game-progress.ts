import { getDatabase } from "./database";
import { savePracticeEvent, syncNow } from "./sync-engine";

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export async function saveGameResult(input: { gameId: string; level: number; score: number; xp: number; clientId: string }) {
  const now = new Date().toISOString();
  const boundedLevel = Math.max(1, Math.min(3, Math.floor(input.level)));
  await savePracticeEvent({ type: "practice", clientId: `${input.clientId}-practice`, levelId: `level-${String(boundedLevel).padStart(2, "0")}`, minutes: 2, skill: input.gameId === "caza-intervalos" ? "melody" : "harmony", score: input.score, createdAt: now });
  await savePracticeEvent({ type: "xp", clientId: `${input.clientId}-xp`, amount: input.xp, source: "game", detail: `${input.gameId} · nivel ${boundedLevel}`, createdAt: now });
  const db = await getDatabase();
  await db.runAsync("INSERT INTO curriculum_progress(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at", `game-${input.gameId}-${boundedLevel}`, JSON.stringify({ nodeId: `game-${input.gameId}-${boundedLevel}`, score: input.score, updatedAt: now }), now);
  void syncNow();
}
