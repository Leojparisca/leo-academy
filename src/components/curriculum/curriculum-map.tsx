"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  Lock,
  Piano,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { LessonRunner } from "@/components/curriculum/lesson-runner";
import { TeacherGuideSheet } from "@/components/teacher/teacher-guide-sheet";
import { Stars } from "@/components/games/game-ui";
import {
  BRANCHES,
  BRANCH_ORDER,
  CURRICULUM_NODES,
  CURRICULUM_TIERS,
  nodesForLevel,
  tierFor,
  unlockedLevel,
  type BranchId,
  type CurriculumNode,
} from "@/data/curriculum";
import { cn } from "@/lib/utils";

const BRANCH_ICON: Record<BranchId, typeof Waves> = {
  ritmo: Waves,
  melodia: AudioLines,
  armonia: Piano,
};

type NodeState = "completed" | "active" | "available" | "locked";

function NodeButton({
  node,
  state,
  stars,
  teacherMode,
  onOpen,
  onGuide,
}: {
  node: CurriculumNode;
  state: NodeState;
  stars: number;
  teacherMode: boolean;
  onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onGuide: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const branch = BRANCHES[node.branch];
  const Icon = BRANCH_ICON[node.branch];
  const locked = state === "locked";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={locked ? undefined : onOpen}
        disabled={locked}
        aria-label={
          locked
            ? `${branch.label} nivel ${node.level}: bloqueado`
            : `${branch.label} nivel ${node.level}: ${node.title}${
                state === "completed" ? `, ${stars} estrellas` : ", disponible"
              }`
        }
        className={cn(
          "curriculum-node group relative flex min-h-[105px] w-full flex-col items-center justify-between overflow-hidden rounded-[18px] border px-1.5 pb-2 pt-2.5 text-center transition-all duration-300",
          state === "completed" && "curriculum-node--done",
          state === "active" && "curriculum-node--active",
          state === "available" && "curriculum-node--available",
          state === "locked" && "curriculum-node--locked",
        )}
      >
        {state === "active" && (
          <motion.span
            aria-hidden
            initial={{ opacity: 0.4, scale: 0.9 }}
            animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.95, 1.03, 0.95] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 rounded-[18px] border border-cyan-300/25"
          />
        )}

        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-[10px] border transition-colors",
            state === "completed"
              ? "border-[#F5C15A]/25 bg-[#F5C15A]/[0.08]"
              : state === "active"
                ? "border-cyan-300/25 bg-cyan-300/[0.07]"
                : state === "available"
                  ? "border-cyan-300/15 bg-white/[0.03]"
                  : "border-white/[0.05] bg-white/[0.015]",
          )}
          style={{
            color:
              state === "locked"
                ? "rgba(93,116,146,0.55)"
                : state === "completed"
                  ? "#F5C15A"
                  : branch.color,
          }}
        >
          {locked ? <Lock size={13} /> : <Icon size={15} />}
        </span>

        <span className="mt-1 min-w-0">
          <span
            className={cn(
              "block truncate text-[8.5px] font-bold uppercase tracking-[0.12em]",
              state === "locked" ? "text-faint/55" : "text-ivory/90",
            )}
          >
            {branch.label}
          </span>
          <span
            className={cn(
              "mt-0.5 block truncate text-[6.5px]",
              state === "locked" ? "text-faint/40" : "text-faint",
            )}
          >
            {node.title}
          </span>
        </span>

        <span className="mt-1 flex min-h-[13px] items-center justify-center">
          {state === "completed" ? (
            <Stars value={stars} size={10} />
          ) : state === "active" ? (
            <span className="inline-flex items-center gap-0.5 text-[6px] font-bold uppercase tracking-[0.13em] text-glow">
              Abrir
              <ChevronRight size={8} />
            </span>
          ) : state === "available" ? (
            <span className="inline-flex items-center gap-0.5 text-[6px] font-bold uppercase tracking-[0.13em] text-glow/55">
              Abrir
              <ChevronRight size={8} />
            </span>
          ) : (
            <span className="text-[5.5px] font-semibold uppercase tracking-[0.12em] text-faint/40">
              Nivel {node.level - 1}
            </span>
          )}
        </span>
      </button>

      {teacherMode && (
        <button
          type="button"
          onClick={onGuide}
          aria-label={`Guía Docente de Leo para ${branch.label} nivel ${node.level}: ${node.title}`}
          title="Guía Docente de Leo"
          className="guide-trigger absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full"
        >
          <BookOpen size={10} />
        </button>
      )}
    </div>
  );
}

export function CurriculumMap({
  teacherMode = false,
}: {
  teacherMode?: boolean;
}) {
  const { curriculum, xpByStudent, activeStudent } = useAcademy();
  const [openNode, setOpenNode] = useState<CurriculumNode | null>(null);
  const [guideNode, setGuideNode] = useState<CurriculumNode | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const guideTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Restore focus to the node that opened the lesson. The sheet cannot do this
  // itself: opening it marks the map `inert`, which blurs the trigger.
  useEffect(() => {
    if (openNode || !triggerRef.current) return;
    triggerRef.current.focus({ preventScroll: true });
    triggerRef.current = null;
  }, [openNode]);

  useEffect(() => {
    if (guideNode || !guideTriggerRef.current) return;
    guideTriggerRef.current.focus({ preventScroll: true });
    guideTriggerRef.current = null;
  }, [guideNode]);

  const completedIds = useMemo(
    () => new Set(curriculum.map((row) => row.nodeId)),
    [curriculum],
  );
  const starsByNode = useMemo(
    () => new Map(curriculum.map((row) => [row.nodeId, row.stars])),
    [curriculum],
  );

  // Progression = the furthest of (a) what the student has sealed locally and
  // (b) what the teacher unlocked by hand. `currentLevel` is 1-based over the
  // eight academy levels; the map only has five thresholds, so it saturates.
  const localLevel = unlockedLevel(completedIds);
  const teacherLevel = activeStudent
    ? Math.min(CURRICULUM_TIERS.length, Math.max(1, activeStudent.currentLevel))
    : 0;
  const activeLevel = Math.max(localLevel, teacherLevel);
  const totalStars = curriculum.reduce((sum, row) => sum + row.stars, 0);
  const allDone = completedIds.size === CURRICULUM_NODES.length;

  return (
    <section aria-labelledby="curriculo">
      <div
        className="space-y-4"
        inert={openNode || guideNode ? true : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="status-dot text-glow" />
              <p className="eyebrow">01 · Currículo sincronizado</p>
            </div>
            <h2
              id="curriculo"
              className="mt-2 font-display text-[26px] leading-[1.02] tracking-[-0.02em] text-ivory"
            >
              Tres ramas.
              <br />
              <em className="sapphire-text font-normal italic">Cinco umbrales.</em>
            </h2>
          </div>
          <div className="neu-pill mt-1 flex min-h-0 flex-col items-end gap-0.5 rounded-[14px] px-2.5 py-1.5">
            <span className="flex items-center gap-1 font-display text-[14px] leading-none text-ivory">
              <Zap size={11} className="text-[#F5C15A]" fill="currentColor" />
              {activeStudent ? (xpByStudent[activeStudent.id] ?? 0) : 0}
            </span>
            <span className="text-[6px] font-semibold uppercase tracking-[0.15em] text-faint">
              XP de perfil
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {BRANCH_ORDER.map((branchId) => {
            const branch = BRANCHES[branchId];
            const Icon = BRANCH_ICON[branchId];
            const done = CURRICULUM_NODES.filter(
              (node) => node.branch === branchId && completedIds.has(node.id),
            ).length;
            return (
              <span
                key={branchId}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.055] bg-white/[0.018] px-2 py-1 text-[6.5px] font-semibold uppercase tracking-[0.12em] text-faint"
              >
                <Icon size={9} style={{ color: branch.color }} />
                {branch.label}
                <span className="tabular-nums text-ivory/60">{done}/5</span>
              </span>
            );
          })}
          <span className="ml-auto inline-flex items-center gap-1 text-[6.5px] font-semibold uppercase tracking-[0.12em] text-[#F5C15A]/80">
            <Sparkles size={9} />
            {totalStars} estrellas
          </span>
        </div>

        <ol className="relative space-y-2.5">
          {CURRICULUM_TIERS.map((tier, tierIndex) => {
            const nodes = nodesForLevel(tier.level);
            const levelDone = nodes.every((node) => completedIds.has(node.id));
            const levelActive = tier.level === activeLevel;
            const levelAvailable = tier.level < activeLevel && !levelDone;
            const locked = tier.level > activeLevel;
            const tierStars = nodes.reduce(
              (sum, node) => sum + (starsByNode.get(node.id) ?? 0),
              0,
            );

            return (
              <li key={tier.level} className="relative flex gap-3">
                <div className="relative flex w-7 flex-none flex-col items-center">
                  {tierIndex < CURRICULUM_TIERS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-1/2 top-8 h-[calc(100%+10px)] w-px -translate-x-1/2",
                        levelDone
                          ? "bg-gradient-to-b from-[#F5C15A]/30 via-[#F5C15A]/10 to-transparent"
                          : "bg-gradient-to-b from-white/[0.07] to-transparent",
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "relative z-10 grid h-7 w-7 place-items-center rounded-full border text-[9px] font-bold",
                      levelDone
                        ? "border-[#F5C15A]/30 bg-[#F5C15A]/[0.09] text-[#F5C15A]"
                        : levelActive
                          ? "border-cyan-300/30 bg-[#0b1c30] text-glow shadow-[0_0_18px_rgba(56,189,248,0.18)]"
                          : levelAvailable
                            ? "border-cyan-300/15 bg-[#081625] text-glow/55"
                            : "border-white/[0.05] bg-[#071120] text-faint/50",
                    )}
                  >
                    {levelDone ? (
                      <Check size={11} strokeWidth={3} />
                    ) : locked ? (
                      <Lock size={9} />
                    ) : (
                      String(tier.level).padStart(2, "0")
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1 pb-1">
                  <div className="flex items-start justify-between gap-2 px-0.5">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-[10.5px] font-semibold leading-tight",
                          locked ? "text-muted/55" : "text-ivory/90",
                        )}
                      >
                        {tier.title}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-[7.5px]",
                          locked ? "text-faint/40" : "text-faint",
                        )}
                      >
                        {tier.subtitle}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex-none text-[6.5px] font-semibold uppercase tracking-[0.1em]",
                        levelDone
                          ? "text-[#F5C15A]/85"
                          : levelActive
                            ? "text-glow/80"
                            : levelAvailable
                              ? "text-glow/55"
                              : "text-faint/45",
                      )}
                    >
                      {levelDone ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Sparkles size={8} /> {tierStars}/9
                        </span>
                      ) : levelActive ? (
                        "En curso"
                      ) : levelAvailable ? (
                        "Abierto"
                      ) : (
                        `Nivel ${tier.level - 1}`
                      )}
                    </span>
                  </div>

                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {nodes.map((node) => {
                      // A teacher unlock raises `currentLevel`, which can skip
                      // tiers. Everything below the active threshold stays
                      // playable ("available") instead of looking locked.
                      const state: NodeState = completedIds.has(node.id)
                        ? "completed"
                        : tier.level === activeLevel
                          ? "active"
                          : tier.level < activeLevel
                            ? "available"
                            : "locked";
                      return (
                        <NodeButton
                          key={node.id}
                          node={node}
                          state={state}
                          stars={starsByNode.get(node.id) ?? 0}
                          teacherMode={teacherMode}
                          onOpen={(event) => {
                            triggerRef.current = event.currentTarget;
                            setOpenNode(node);
                          }}
                          onGuide={(event) => {
                            guideTriggerRef.current = event.currentTarget;
                            setGuideNode(node);
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex items-start gap-2 rounded-[14px] border border-white/[0.045] bg-white/[0.012] px-3 py-2.5">
          <Sparkles size={11} className="mt-0.5 flex-none text-glow/60" />
          <p className="text-[7.5px] leading-relaxed text-faint">
            {allDone
              ? "Las tres ramas están completas. Ahora el repertorio: interpreta, escucha y comparte."
              : "Cada umbral se abre al sellar las tres ramas del nivel anterior. Un nivel, tres lenguajes, una sola música."}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {guideNode && teacherMode && (
          <TeacherGuideSheet
            key={`guide-${guideNode.id}`}
            node={guideNode}
            onClose={() => setGuideNode(null)}
          />
        )}
        {openNode && (
          <LessonRunner
            key={openNode.id}
            node={openNode}
            onClose={() => setOpenNode(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
