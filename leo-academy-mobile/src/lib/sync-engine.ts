import NetInfo from "@react-native-community/netinfo";
import { clearSessionToken, getSessionToken, setSessionToken } from "./auth";
import { getDatabase, pendingOutboxCount } from "./database";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
export type SyncStatus = { kind: "loading" | "syncing" | "saved" | "pending" | "error"; message: string };
let status: SyncStatus = { kind: "loading", message: "Buscando tu progreso…" };
const listeners = new Set<(value: SyncStatus) => void>();
let inFlight: Promise<void> | null = null;
const tell = (next: SyncStatus) => { status = next; for (const listener of listeners) listener(next); };
export const getSyncStatus = async () => status;
export const showOfflineReady = () => tell({ kind: "pending", message: "Estás usando el progreso guardado en este teléfono. Se sincronizará al volver el internet." });
export const subscribeSyncStatus = (listener: (value: SyncStatus) => void) => { listeners.add(listener); listener(status); return () => { listeners.delete(listener); }; };

async function request(path: string, init: RequestInit = {}, token?: string) {
  if (!API_BASE) throw new Error("EXPO_PUBLIC_API_BASE_URL is not configured");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export async function applyProgress(payload: Record<string, any>) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    if (payload.student) {
      const prior = await db.getFirstAsync<{ payload: string }>("SELECT payload FROM student_profile WHERE id = ?", payload.student.id);
      const local = prior ? JSON.parse(prior.payload) : {};
      const merged = { ...payload.student,
        totalMinutes: Math.max(local.totalMinutes ?? 0, payload.student.totalMinutes ?? 0),
        weeklyMinutes: Math.max(local.weeklyMinutes ?? 0, payload.student.weeklyMinutes ?? 0),
        accuracy: Math.max(local.accuracy ?? 0, payload.student.accuracy ?? 0),
        streakDays: Math.max(local.streakDays ?? 0, payload.student.streakDays ?? 0),
      };
      await db.runAsync("INSERT INTO student_profile(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at", payload.student.id, JSON.stringify(merged), payload.student.updatedAt ?? payload.readAt);
    }
    for (const [key, rows] of [["lesson_progress", payload.lessonProgress], ["curriculum_progress", payload.curriculumProgress], ["skill_scores", payload.skillScores], ["xp_ledger", payload.xpLedger]] as const) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const id = row.levelId ? `${payload.student.id}|${row.levelId}` : row.nodeId ? `${payload.student.id}|${row.nodeId}` : (row.clientId ?? row.id);
        const when = row.updatedAt ?? row.createdAt ?? payload.readAt;
        const table = key === "xp_ledger" ? key : key;
        const timeColumn = key === "xp_ledger" ? "created_at" : "updated_at";
        const prior = await db.getFirstAsync<{ payload: string }>(`SELECT payload FROM ${table} WHERE id = ?`, id);
        const local = prior ? JSON.parse(prior.payload) : null;
        let merged = row;
        if (local && key === "lesson_progress") merged = { ...row,
          progress: Math.max(local.progress ?? 0, row.progress ?? 0),
          bestScore: Math.max(local.bestScore ?? 0, row.bestScore ?? 0),
          minutesPracticed: Math.max(local.minutesPracticed ?? 0, row.minutesPracticed ?? 0),
          status: local.status === "completed" || row.status === "completed" ? "completed" : (row.status ?? local.status),
        };
        if (local && key === "curriculum_progress") merged = { ...row,
          stars: Math.max(local.stars ?? 0, row.stars ?? 0),
          accuracy: Math.max(local.accuracy ?? 0, row.accuracy ?? 0),
        };
        if (local && (key === "skill_scores" || key === "xp_ledger")) continue;
        const update = key === "xp_ledger" || key === "skill_scores" ? "DO NOTHING" : `DO UPDATE SET payload=excluded.payload,${timeColumn}=excluded.${timeColumn}`;
        await db.runAsync(`INSERT INTO ${table}(id,payload,${timeColumn}) VALUES(?,?,?) ON CONFLICT(id) ${update}`, id, JSON.stringify(merged), when);
      }
    }
  });
}

export async function pullProgress() {
  const token = await getSessionToken();
  if (!token) return;
  tell({ kind: "loading", message: "Buscando tu progreso…" });
  try {
    const response = await request("/api/mobile/progress", { method: "GET" }, token);
    if (response.status === 401) throw new Error("session_expired");
    if (!response.ok) throw new Error("progress_unavailable");
    await applyProgress(await response.json());
    const pending = await pendingOutboxCount();
    tell(pending ? { kind: "pending", message: "Guardado aquí. Se enviará al volver el internet." } : { kind: "saved", message: "Todo guardado" });
  } catch (error) {
    const pending = await pendingOutboxCount();
    if (error instanceof Error && error.message === "session_expired") {
      await clearSessionToken();
      tell({ kind: "error", message: "Tu sesión venció. Conéctate e ingresa tu código otra vez." });
    } else if (pending) tell({ kind: "pending", message: "Guardado aquí. Se enviará al volver el internet." });
    else tell({ kind: "error", message: "No pudimos traer tu progreso. Tus datos siguen aquí." });
  }
}

export async function redeemCode(code: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await NetInfo.fetch()).isConnected) return { ok: false, message: "Necesitas internet para entrar por primera vez. Conéctate y vuelve a intentarlo." };
  try {
    const response = await request("/api/mobile/auth/redeem", { method: "POST", body: JSON.stringify({ code }) });
    if (!response.ok) return { ok: false, message: response.status === 401 || response.status === 429 ? "No pudimos entrar con ese código. Revísalo o pídeselo a tu profe." : "No pudimos conectar con la academia. Revisa tu internet e inténtalo otra vez." };
    const result = await response.json();
    await setSessionToken(result.token);
    await applyProgress({ student: result.student, lessonProgress: [], curriculumProgress: [], skillScores: [], xpLedger: [], readAt: new Date().toISOString() });
    await pullProgress();
    return { ok: true };
  } catch { return { ok: false, message: "No pudimos conectar con la academia. Revisa tu internet e inténtalo otra vez." }; }
}

export async function syncNow() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const token = await getSessionToken();
    if (!token) { tell({ kind: "error", message: "Conéctate e ingresa tu código para sincronizar." }); return; }
    tell({ kind: "syncing", message: "Buscando tu progreso…" });
    const db = await getDatabase();
    try {
      const rows = await db.getAllAsync<{ client_id: string; payload: string }>("SELECT client_id,payload FROM sync_outbox WHERE next_attempt_at IS NULL OR next_attempt_at <= ? ORDER BY created_at LIMIT 50", new Date().toISOString());
      if (rows.length) {
        const response = await request("/api/mobile/sync", { method: "POST", body: JSON.stringify({ events: rows.map(row => JSON.parse(row.payload)) }) }, token);
        if (!response.ok) throw new Error("sync_failed");
        const result = await response.json() as { acceptedIds: string[]; rejected: Array<{ clientId: string; reason: string }> };
        for (const id of result.acceptedIds) await db.runAsync("DELETE FROM sync_outbox WHERE client_id = ?", id);
        for (const item of result.rejected) await db.runAsync("UPDATE sync_outbox SET attempts=attempts+1,last_error=?,next_attempt_at=? WHERE client_id=?", item.reason, new Date(Date.now() + 60_000).toISOString(), item.clientId);
      }
      await pullProgress();
    } catch {
      const due = new Date(Date.now() + 30_000).toISOString();
      await db.runAsync("UPDATE sync_outbox SET attempts=attempts+1,next_attempt_at=?,last_error='network'", due);
      tell({ kind: "pending", message: "Guardado aquí. Se enviará al volver el internet." });
    }
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export async function savePracticeEvent(event: Record<string, unknown> & { clientId: string }) {
  const db = await getDatabase();
  await db.runAsync("INSERT OR IGNORE INTO sync_outbox(client_id,event_type,payload,created_at) VALUES(?,?,?,?)", event.clientId, String(event.type ?? "practice"), JSON.stringify(event), new Date().toISOString());
  tell({ kind: "pending", message: "Guardado aquí. Se enviará al volver el internet." });
}

NetInfo.addEventListener(state => { if (state.isConnected) void syncNow(); });
