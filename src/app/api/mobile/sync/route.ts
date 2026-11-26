import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getMobileStudentId, mobileAuthConfigured } from "@/server/auth/mobile-session";
import { getReadyDb } from "@/server/db/client";
import { lessonProgress, levels, practiceSessions, skillScores, students, curriculumProgress, xpLedger } from "@/server/db/schema";
import { CURRICULUM_BY_ID } from "@/data/curriculum";
import { scoreRowId, xpRowId } from "@/lib/sync-keys";

const practiceSchema = z.object({
  type: z.literal("practice"), clientId: z.string().min(8).max(80),
  levelId: z.string().regex(/^level-\d{2}$/), minutes: z.number().int().min(1).max(180),
  skill: z.enum(["melody", "harmony", "rhythm"]), score: z.number().int().min(0).max(100),
  createdAt: z.string().min(10).max(40),
}).strict();
// XP events are append-only. clientId is the stable event identity and becomes
// the canonical xp_<clientId> primary key shared with the existing backup writer.
const xpSchema = z.object({
  type: z.literal("xp"), clientId: z.string().min(8).max(80),
  amount: z.number().int().min(0).max(10_000),
  source: z.enum(["lesson", "game", "group"]), detail: z.string().max(200),
  createdAt: z.string().min(8).max(40),
}).strict();
// Curriculum is a per-node state union. The DB's unique (student,node) key is
// canonical; repeated events take monotonic maxima and never create duplicates.
const curriculumSchema = z.object({
  type: z.literal("curriculum"), clientId: z.string().min(8).max(80),
  nodeId: z.string().regex(/^cur-(ritmo|melodia|armonia)-[1-5]$/),
  stars: z.number().int().min(1).max(3), accuracy: z.number().int().min(0).max(100),
  updatedAt: z.string().min(8).max(40),
}).strict();
const unsupportedSchema = z.object({ type: z.string().min(1).max(40), clientId: z.string().min(8).max(80) }).passthrough();
const unauthorized = () => Response.json({ error: "Unauthorized." }, { status: 401 });

export async function POST(request: Request) {
  if (!mobileAuthConfigured()) return Response.json({ error: "Mobile authentication unavailable." }, { status: 503 });
  const studentId = await getMobileStudentId(request);
  if (!studentId) return unauthorized();
  let raw: string;
  try { raw = await request.text(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (raw.length > 128_000) return Response.json({ error: "Batch too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || !Array.isArray((body as { events?: unknown }).events) || (body as { events: unknown[] }).events.length > 50) {
    return Response.json({ error: "Invalid batch." }, { status: 400 });
  }

  const events = (body as { events: unknown[] }).events;
  const rejected: Array<{ clientId: string; reason: string }> = [];
  const practices: Array<z.infer<typeof practiceSchema>> = [];
  const xpEvents: Array<z.infer<typeof xpSchema>> = [];
  const curriculumEvents: Array<z.infer<typeof curriculumSchema>> = [];
  const seen = new Set<string>();
  for (const value of events) {
    const unsupported = unsupportedSchema.safeParse(value);
    const parsed = practiceSchema.safeParse(value);
    const xp = xpSchema.safeParse(value);
    const curriculum = curriculumSchema.safeParse(value);
    if (!unsupported.success) return Response.json({ error: "Invalid event." }, { status: 400 });
    const { clientId } = unsupported.data;
    if (seen.has(clientId)) { rejected.push({ clientId, reason: "duplicate_client_id_in_batch" }); continue; }
    seen.add(clientId);
    if (parsed.success) { practices.push(parsed.data); continue; }
    if (xp.success) { xpEvents.push(xp.data); continue; }
    if (curriculum.success) { curriculumEvents.push(curriculum.data); continue; }
    const type = (value as { type?: unknown }).type;
    rejected.push({ clientId, reason: type === "practice" || type === "xp" || type === "curriculum" ? "invalid_event" : "unsupported_event_type" });
  }

  try {
    const db = await getReadyDb();
    const outcome = await db.transaction(async (tx) => {
      const accepted: string[] = [];
      const refused: Array<{ clientId: string; reason: string }> = [];
      for (const event of practices) {
        const level = await tx.select({ id: levels.id }).from(levels).where(eq(levels.id, event.levelId)).limit(1);
        if (!level[0]) { refused.push({ clientId: event.clientId, reason: "unknown_level" }); continue; }
        const id = `sess_${event.clientId}`;
        const prior = await tx.select({ studentId: practiceSessions.studentId }).from(practiceSessions)
          .where(eq(practiceSessions.id, id)).limit(1);
        if (prior[0] && prior[0].studentId !== studentId) {
          refused.push({ clientId: event.clientId, reason: "event_id_conflict" });
          continue;
        }
        const scoreId = scoreRowId(event.clientId);
        const priorScore = await tx.select({ studentId: skillScores.studentId }).from(skillScores)
          .where(eq(skillScores.id, scoreId)).limit(1);
        if (priorScore[0] && priorScore[0].studentId !== studentId) {
          refused.push({ clientId: event.clientId, reason: "event_id_conflict" });
          continue;
        }
        const inserted = await tx.insert(practiceSessions).values({
          id, studentId, levelId: event.levelId, skill: event.skill,
          minutes: event.minutes, score: event.score, source: "offline", createdAt: event.createdAt,
        }).onConflictDoNothing();
        if (inserted.rowsAffected === 0) { accepted.push(event.clientId); continue; }

        await tx.update(students).set({
          totalMinutes: sql`${students.totalMinutes} + ${event.minutes}`,
          weeklyMinutes: sql`${students.weeklyMinutes} + ${event.minutes}`,
          accuracy: sql`max(${students.accuracy}, cast(round((${students.accuracy} * 4.0 + ${event.score}) / 5.0) as integer))`,
          updatedAt: event.createdAt,
        }).where(eq(students.id, studentId));
        await tx.insert(skillScores).values({
          id: scoreId, studentId, skill: event.skill, score: event.score,
          source: "lesson", createdAt: event.createdAt, syncedFrom: "offline",
        }).onConflictDoNothing();
        await tx.insert(lessonProgress).values({
          id: `progress_${studentId}_${event.levelId}`, studentId, levelId: event.levelId,
          status: "current", progress: 6, bestScore: event.score, minutesPracticed: event.minutes,
          lastPracticedAt: event.createdAt, updatedAt: event.createdAt,
        }).onConflictDoUpdate({
          target: [lessonProgress.studentId, lessonProgress.levelId],
          set: {
            progress: sql`min(100, ${lessonProgress.progress} + 6)`,
            minutesPracticed: sql`${lessonProgress.minutesPracticed} + ${event.minutes}`,
            bestScore: sql`max(${lessonProgress.bestScore}, ${event.score})`,
            lastPracticedAt: event.createdAt, updatedAt: event.createdAt,
          },
        });
        accepted.push(event.clientId);
      }
      for (const event of xpEvents) {
        const id = xpRowId(event.clientId);
        const prior = await tx.select({ studentId: xpLedger.studentId }).from(xpLedger)
          .where(eq(xpLedger.id, id)).limit(1);
        if (prior[0] && prior[0].studentId !== studentId) {
          refused.push({ clientId: event.clientId, reason: "event_id_conflict" });
          continue;
        }
        await tx.insert(xpLedger).values({
          id, studentId, amount: event.amount,
          source: event.source, detail: event.detail, createdAt: event.createdAt,
          syncedFrom: "device",
        }).onConflictDoNothing();
        // Duplicate primary key means this exact event was already applied.
        // It is acknowledged because the durable server copy is present.
        // Both a new insert and a same-student retry are durable acknowledgements.
        accepted.push(event.clientId);
      }
      for (const event of curriculumEvents) {
        const node = CURRICULUM_BY_ID.get(event.nodeId);
        if (!node) { refused.push({ clientId: event.clientId, reason: "unknown_curriculum_node" }); continue; }
        await tx.insert(curriculumProgress).values({
          id: `curriculum_${studentId}_${node.id}`, studentId, nodeId: node.id,
          branch: node.branch, level: node.level, stars: event.stars,
          accuracy: event.accuracy, createdAt: event.updatedAt, updatedAt: event.updatedAt,
        }).onConflictDoUpdate({
          target: [curriculumProgress.studentId, curriculumProgress.nodeId],
          set: {
            stars: sql`max(${curriculumProgress.stars}, ${event.stars})`,
            accuracy: sql`max(${curriculumProgress.accuracy}, ${event.accuracy})`,
            updatedAt: sql`max(${curriculumProgress.updatedAt}, ${event.updatedAt})`,
          },
        });
        accepted.push(event.clientId);
      }
      return { accepted, refused };
    });
    return Response.json({ acceptedIds: outcome.accepted, rejected: [...rejected, ...outcome.refused] });
  } catch (error) {
    console.error("[leo] Mobile sync failed", error);
    return Response.json({ error: "Sync failed; keep the batch on this device." }, { status: 503 });
  }
}
