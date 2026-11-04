"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  Lock,
  Piano,
  Play,
  Sparkles,
  Waves,
  X,
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

  const iconColor =
    state === "locked"
      ? "rgba(148, 163, 184, 0.45)"
      : state === "completed"
        ? "#F5C15A"
        : branch.color;

  return (
    <div className="relative flex flex-col items-center gap-1.5">
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
          "curriculum-node relative grid h-[62px] w-[62px] place-items-center rounded-full border transition-transform duration-300",
          state === "completed" && "curriculum-node--done",
          state === "active" && "curriculum-node--active",
          state === "available" && "curriculum-node--available",
          state === "locked" && "curriculum-node--locked",
        )}
      >
        {locked ? (
          <Lock size={18} style={{ color: iconColor }} />
        ) : (
          <Icon size={21} style={{ color: iconColor }} />
        )}
      </button>

      <span
        className={cn(
          "text-[9px] font-bold uppercase tracking-[0.1em]",
          state === "locked" ? "text-slate-500" : "text-slate-300",
        )}
      >
        {branch.label}
      </span>

      <span className="flex min-h-[15px] items-center justify-center">
        {state === "completed" ? (
          <Stars value={stars} size={11} />
        ) : state === "active" ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-sky-300">
            Abrir
            <ChevronRight size={9} />
          </span>
        ) : state === "available" ? (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-sky-300/65">
            Abrir
            <ChevronRight size={9} />
          </span>
        ) : (
          <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-500">
            Nivel {node.level - 1}
          </span>
        )}
      </span>

      {teacherMode && (
        <button
          type="button"
          onClick={onGuide}
          aria-label={`Guía Docente de Leo para ${branch.label} nivel ${node.level}: ${node.title}`}
          title="Guía Docente de Leo"
          className="guide-trigger absolute -right-0.5 -top-0.5 z-10 grid h-6 w-6 place-items-center rounded-full"
        >
          <BookOpen size={11} />
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
  const [previewNode, setPreviewNode] = useState<CurriculumNode | null>(null);
  const [guideNode, setGuideNode] = useState<CurriculumNode | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const guideTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Restore focus to the node that opened the lesson. The sheet cannot do this
  // itself: opening it marks the map `inert`, which blurs the trigger.
  useEffect(() => {
    if (openNode || !triggerRef.current) return;
    triggerRef.current.focus({ preventScroll: true });
    triggerRef.current = null;
  }, [openNode]);

  useEffect(() => {
    if (previewNode || !previewTriggerRef.current) return;
    if (openNode) return;
    previewTriggerRef.current.focus({ preventScroll: true });
    previewTriggerRef.current = null;
  }, [openNode, previewNode]);

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
  const previewTier = previewNode ? tierFor(previewNode.level) : null;

  return (
    <section aria-labelledby="curriculo">
      <div
        className="space-y-4"
        inert={openNode || guideNode || previewNode ? true : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="curriculo"
              className="text-2xl font-bold leading-tight tracking-[-0.02em] text-white"
            >
              Tres ramas.{" "}
              <span className="text-sky-300">Cinco umbrales.</span>
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              Toca un nodo para ver la lección.
            </p>
          </div>
          <div className="flex flex-none flex-col items-end gap-0.5 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3 py-2 backdrop-blur-xl">
            <span className="flex items-center gap-1 text-[15px] font-bold leading-none text-white">
              <Zap size={12} className="text-[#F5C15A]" fill="currentColor" />
              {activeStudent ? (xpByStudent[activeStudent.id] ?? 0) : 0}
            </span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              XP
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
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-300"
              >
                <Icon size={10} style={{ color: branch.color }} />
                {branch.label}
                <span className="tabular-nums text-slate-400">{done}/5</span>
              </span>
            );
          })}
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#F5C15A]">
            <Sparkles size={10} />
            {totalStars}
          </span>
        </div>

        <ol className="relative space-y-3">
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
              <li key={tier.level} className="relative flex gap-2.5">
                <div className="relative flex w-7 flex-none flex-col items-center">
                  {tierIndex < CURRICULUM_TIERS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-1/2 top-8 h-[calc(100%+12px)] w-px -translate-x-1/2",
                        levelDone
                          ? "bg-gradient-to-b from-[#F5C15A]/35 via-[#F5C15A]/12 to-transparent"
                          : levelActive
                            ? "bg-gradient-to-b from-sky-400/40 via-sky-400/12 to-transparent"
                            : "bg-gradient-to-b from-white/10 to-transparent",
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "relative z-10 grid h-7 w-7 place-items-center rounded-full border text-[10px] font-bold",
                      levelDone
                        ? "border-[#F5C15A]/35 bg-[#F5C15A]/[0.1] text-[#F5C15A]"
                        : levelActive
                          ? "border-sky-400/40 bg-[#0b1c30] text-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.25)]"
                          : levelAvailable
                            ? "border-sky-400/20 bg-[#081625] text-sky-300/60"
                            : "border-white/[0.07] bg-[#081120] text-slate-500",
                    )}
                  >
                    {levelDone ? (
                      <Check size={12} strokeWidth={3} />
                    ) : locked ? (
                      <Lock size={10} />
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
                          "truncate text-[13px] font-semibold leading-tight",
                          locked ? "text-slate-500" : "text-white",
                        )}
                      >
                        {tier.title}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-[10px]",
                          locked ? "text-slate-500/70" : "text-slate-400",
                        )}
                      >
                        {tier.subtitle}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex-none text-[9px] font-semibold uppercase tracking-[0.08em]",
                        levelDone
                          ? "text-[#F5C15A]"
                          : levelActive
                            ? "text-sky-300"
                            : levelAvailable
                              ? "text-sky-300/60"
                              : "text-slate-500",
                      )}
                    >
                      {levelDone ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Sparkles size={9} /> {tierStars}/9
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

                  <div className="mt-2 grid grid-cols-3 place-items-center gap-1">
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
                            previewTriggerRef.current = event.currentTarget;
                            setPreviewNode(node);
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

        <div className="flex items-center justify-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <Sparkles size={11} className="text-sky-400/70" />
          <p className="text-[10px] text-slate-400">
            {allDone
              ? "Tres ramas completas · ahora el repertorio"
              : "Sella las tres ramas para cruzar el umbral"}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {previewNode && previewTier && !openNode && (
          <motion.div
            key={`preview-${previewNode.id}`}
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-[118px] z-50 px-4"
          >
            <div className="mx-auto w-full max-w-[480px] rounded-3xl border border-white/10 bg-[#0B111D]/95 p-4 shadow-2xl shadow-black/80 backdrop-blur-2xl">
              <div className="flex items-start gap-3">
                <span
                  className="grid h-11 w-11 flex-none place-items-center rounded-full border"
                  style={{
                    color: BRANCHES[previewNode.branch].color,
                    borderColor: `${BRANCHES[previewNode.branch].color}44`,
                    background: `${BRANCHES[previewNode.branch].color}14`,
                  }}
                >
                  {(() => {
                    const Icon = BRANCH_ICON[previewNode.branch];
                    return <Icon size={19} />;
                  })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {previewTier.title} · Nivel {previewNode.level}
                  </p>
                  <h3 className="mt-0.5 truncate text-xl font-bold leading-tight text-white">
                    {previewNode.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewNode(null)}
                  aria-label="Cerrar vista de lección"
                  className="grid h-9 w-9 flex-none place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400 transition-colors hover:text-white"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-[#F5C15A]/15 px-2.5 py-1 text-[10px] font-bold text-[#F5C15A]">
                  {starsByNode.get(previewNode.id) ?? 0} / 3 estrellas
                </span>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                  {BRANCHES[previewNode.branch].label}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpenNode(previewNode);
                  setPreviewNode(null);
                }}
                className="neu-button neu-button--primary mt-4 w-full"
              >
                <Play size={15} fill="currentColor" />
                Comenzar Lección
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
