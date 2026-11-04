"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Lock,
  Play,
  Quote,
  Sparkles,
  Target,
  TimerReset,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { CurriculumMap } from "@/components/curriculum/curriculum-map";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  FOCUS_LABEL,
  LEVELS,
  SKILL_META,
  levelStatus,
  type Level,
  type Skill,
} from "@/lib/academy";
import { cn } from "@/lib/utils";

const SKILL_ORDER: Skill[] = ["melody", "harmony", "rhythm"];

function StatCell({
  icon: Icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  suffix?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-1 py-3.5">
      <Icon size={13} className={cn("opacity-70", accent ?? "text-glow")} />
      <div className="flex items-baseline gap-0.5">
        <span className="font-display text-[19px] leading-none text-ivory">
          {value}
        </span>
        {suffix && (
          <span className="text-[8px] font-semibold uppercase tracking-wider text-faint">
            {suffix}
          </span>
        )}
      </div>
      <span className="text-[7px] font-semibold uppercase tracking-[0.17em] text-faint">
        {label}
      </span>
    </div>
  );
}

function PathNode({
  status,
  ordinal,
  isLast,
}: {
  status: "completed" | "current" | "locked";
  ordinal: number;
  isLast: boolean;
}) {
  return (
    <div className="relative flex w-9 flex-none flex-col items-center">
      {!isLast && (
        <span
          aria-hidden
          className={cn(
            "absolute left-1/2 top-9 h-[calc(100%+14px)] w-px -translate-x-1/2",
            status === "locked"
              ? "bg-gradient-to-b from-white/[0.06] to-transparent"
              : "bg-gradient-to-b from-cyan-300/20 via-white/[0.07] to-transparent",
          )}
        />
      )}

      <div className="relative">
        {status === "current" && (
          <>
            <span
              aria-hidden
              className="absolute -inset-2 rounded-full border border-cyan-300/15 shadow-[0_0_24px_rgba(56,189,248,0.18)]"
            />
            <span
              aria-hidden
              className="absolute -inset-[13px] animate-dot-pulse rounded-full border border-cyan-300/[0.07]"
            />
          </>
        )}
        <div
          className={cn(
            "relative z-10 grid h-9 w-9 place-items-center rounded-full border text-[11px]",
            status === "completed" &&
              "border-cyan-200/20 bg-[linear-gradient(145deg,#1482ff,#0a4fb2)] text-white shadow-[0_0_18px_rgba(13,110,253,0.28),inset_0_1px_0_rgba(255,255,255,0.32)]",
            status === "current" &&
              "border-cyan-300/35 bg-[linear-gradient(145deg,#142c4c,#091424)] font-display text-[15px] text-glow shadow-[0_0_26px_rgba(56,189,248,0.18),inset_0_1px_0_rgba(255,255,255,0.1)]",
            status === "locked" &&
              "border-white/[0.045] bg-[linear-gradient(145deg,#071120,#0a1728)] text-faint/55 shadow-[inset_3px_3px_8px_#03070D,inset_-2px_-2px_6px_rgba(30,95,180,0.08)]",
          )}
        >
          {status === "completed" ? (
            <Check size={13} strokeWidth={3} />
          ) : status === "locked" ? (
            <Lock size={11} strokeWidth={2} />
          ) : (
            String(ordinal).padStart(2, "0")
          )}
        </div>
      </div>
    </div>
  );
}

function CurrentLevelCard({
  level,
  progress,
}: {
  level: Level;
  progress: number;
}) {
  return (
    <Link
      href="/estudio"
      className="neu-card neu-card--glow group block overflow-hidden p-4 transition-transform duration-300 active:scale-[0.99]"
      aria-label={`Continuar nivel ${level.ordinal}: ${level.title}`}
    >
      <span
        aria-hidden
        className="staff-paper pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-40"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-glow shadow-[0_0_7px_#38BDF8]" />
            <span className="text-[7.5px] font-bold uppercase tracking-[0.2em] text-glow">
              En curso
            </span>
          </div>
          <h3 className="mt-1.5 font-display text-[19px] leading-tight text-ivory">
            {level.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-[10px] text-muted">
            {level.subtitle}
          </p>
        </div>
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-cyan-300/15 bg-cyan-300/[0.04] text-glow transition-all duration-300 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/[0.08]">
          <ChevronRight size={15} />
        </span>
      </div>

      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
            Avance del nivel
          </span>
          <span className="text-[9px] font-bold text-ivory/80">{progress}%</span>
        </div>
        <div className="neu-inset h-[7px] overflow-hidden rounded-full p-[1px]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
            className="h-full rounded-full bg-[linear-gradient(90deg,#0D6EFD,#38BDF8)] shadow-[0_0_12px_rgba(56,189,248,0.45)]"
          />
        </div>
      </div>
    </Link>
  );
}

function LevelRow({
  level,
  currentLevel,
  currentProgress,
  isLast,
}: {
  level: Level;
  currentLevel: number;
  currentProgress: number;
  isLast: boolean;
}) {
  const status = levelStatus(level, currentLevel);
  const meta = SKILL_META[level.focus as Skill];

  return (
    <li className="flex gap-3.5 pb-3.5">
      <PathNode status={status} ordinal={level.ordinal} isLast={isLast} />
      <div className="min-w-0 flex-1 pt-0.5">
        {status === "current" ? (
          <CurrentLevelCard level={level} progress={currentProgress} />
        ) : (
          <div
            className={cn(
              "flex items-center gap-3 rounded-[18px] px-3.5 py-3",
              status === "completed"
                ? "bg-white/[0.018]"
                : "bg-white/[0.008]",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3
                  className={cn(
                    "truncate text-[12.5px] font-semibold leading-tight",
                    status === "completed"
                      ? "text-ivory/80"
                      : "text-muted/60",
                  )}
                >
                  {level.title}
                </h3>
                {status === "completed" && meta && (
                  <span
                    className="hidden flex-none text-[7px] font-bold tracking-[0.14em] min-[380px]:inline"
                    style={{ color: `${meta.color}99` }}
                  >
                    {meta.short}
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "mt-0.5 truncate text-[9.5px]",
                  status === "locked" ? "text-faint/45" : "text-faint/75",
                )}
              >
                {status === "locked"
                  ? "Se abre con el profesor"
                  : level.subtitle}
              </p>
            </div>
            <div className="flex flex-none items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-faint/60">
              {status === "completed" ? (
                <>
                  <Check size={10} className="text-glow/60" />
                  {level.minutes}′
                </>
              ) : (
                <>
                  <Lock size={9} />
                  Nivel {String(level.ordinal).padStart(2, "0")}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export function MapaView({ teacherMode = false }: { teacherMode?: boolean }) {
  const { activeStudent, progress, skillScores } = useAcademy();
  const reduceMotion = useReducedMotion();

  const currentLevel = Math.min(
    Math.max(activeStudent?.currentLevel ?? 1, 1),
    LEVELS.length,
  );
  const currentLevelData = LEVELS[currentLevel - 1];
  const currentProgress =
    progress.find((row) => row.levelId === currentLevelData.id)?.progress ?? 0;

  const overall = Math.round(
    ((currentLevel - 1 + currentProgress / 100) / LEVELS.length) * 100,
  );
  const completed = Math.max(0, currentLevel - 1);
  const weeklyPct = Math.min(
    100,
    Math.round(
      ((activeStudent?.weeklyMinutes ?? 0) /
        Math.max(1, activeStudent?.weeklyGoalMinutes ?? 90)) *
        100,
    ),
  );

  const scores = useMemo(() => {
    return SKILL_ORDER.map((skill) => {
      const matching = skillScores.filter((score) => score.skill === skill);
      // No invented baseline: a skill the student has never measured is 0.
      const value =
        matching.length > 0
          ? Math.round(
              matching.slice(-6).reduce((sum, row) => sum + row.score, 0) /
                Math.min(6, matching.length),
            )
          : 0;
      return { skill, value };
    });
  }, [skillScores]);

  if (!activeStudent) {
    return (
      <div className="space-y-6">
        <section className="neu-card rounded-[26px] p-6">
          <p className="eyebrow">Sin perfil activo</p>
          <h1 className="mt-3 font-display text-[32px] leading-[1] tracking-[-0.03em] text-ivory">
            Abre tu perfil para empezar.
          </h1>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            Todavía no hay alumnos reales en esta academia. El profesor puede
            registrar el primero desde su mesa; en cuanto exista un perfil, aquí
            aparecerán su sendero, su progreso y sus estrellas.
          </p>
          <Link
            href="/profesor"
            className="neu-button neu-button--primary mt-5 w-full rounded-[15px] py-3"
          >
            Ir a la mesa del profesor
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <section>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="status-dot text-glow" />
              <p className="eyebrow">El sendero del zafiro · Semana 04</p>
            </div>
            <h1 className="mt-3.5 font-display text-[40px] leading-[0.9] tracking-[-0.035em] text-ivory">
              Hola,{" "}
              <em className="sapphire-text font-normal italic">
                {activeStudent.firstName}
              </em>
              <span className="text-glow">.</span>
            </h1>
            <p className="mt-3 max-w-[250px] text-[11.5px] leading-[1.55] text-muted">
              Nivel {String(currentLevel).padStart(2, "0")} de 08 ·{" "}
              {completed} umbrales cruzados. Hoy, una tecla más.
            </p>
          </div>
          <ProgressRing value={overall} size={82} caption="sendero" />
        </div>
      </section>

      <CurriculumMap teacherMode={teacherMode} />

      <section aria-labelledby="continuar">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <span id="continuar" className="eyebrow">
            Continuar donde quedaste
          </span>
          <span className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-faint">
            <TimerReset size={10} />
            {currentLevelData.minutes} min
          </span>
        </div>

        <article className="neu-card neu-card--feature relative overflow-hidden rounded-[26px] p-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-3 -top-8 select-none font-display text-[116px] font-semibold leading-none text-white/[0.035]"
          >
            {String(currentLevelData.ordinal).padStart(2, "0")}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-1 top-2 select-none"
          >
            <span className="block -rotate-6 font-display text-[190px] italic leading-none text-cyan-100/[0.055]">
              ♪
            </span>
          </div>
          <div className="staff-paper pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-50" />

          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/15 bg-cyan-300/[0.055] px-2.5 py-1 text-[7.5px] font-bold uppercase tracking-[0.18em] text-glow">
                <span className="h-1 w-1 animate-dot-pulse rounded-full bg-glow" />
                Nivel {String(currentLevelData.ordinal).padStart(2, "0")} · En curso
              </span>
              <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-faint">
                {FOCUS_LABEL[currentLevelData.focus]}
              </span>
            </div>

            <h2 className="mt-4 max-w-[280px] font-display text-[27px] leading-[1.04] tracking-[-0.02em] text-ivory">
              {currentLevelData.title}
            </h2>
            <p className="mt-2 max-w-[250px] text-[10.5px] leading-relaxed text-muted">
              {currentLevelData.subtitle}
            </p>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-faint">
                  Progreso del nivel
                </span>
                <span className="font-display text-[11px] text-ivory/85">
                  {currentProgress}%
                </span>
              </div>
              <div className="neu-inset h-2 overflow-hidden rounded-full p-[2px]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${currentProgress}%` }}
                  transition={{
                    duration: reduceMotion ? 0 : 1.3,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.25,
                  }}
                  className="relative h-full overflow-hidden rounded-full bg-[linear-gradient(90deg,#0D6EFD_0%,#38BDF8_70%,#C9F2FF_100%)] shadow-[0_0_14px_rgba(56,189,248,0.5)]"
                >
                  <span className="absolute inset-y-0 right-0 w-7 bg-white/30 blur-[6px]" />
                </motion.div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2.5">
              <Link
                href="/estudio"
                className="neu-button neu-button--primary group w-full rounded-[15px] py-3"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15">
                  <Play size={10} fill="currentColor" />
                </span>
                Retomar sesión
                <ArrowUpRight
                  size={14}
                  className="ml-auto opacity-70 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
        </article>
      </section>

      <section className="neu-card overflow-hidden rounded-[22px]" aria-label="Resumen de estudio">
        <div className="grid grid-cols-3 divide-x divide-white/[0.055]">
          <StatCell
            icon={Clock3}
            label="Esta semana"
            value={String(activeStudent.weeklyMinutes)}
            suffix="min"
          />
          <StatCell
            icon={Target}
            label="Precisión"
            value={String(activeStudent.accuracy)}
            suffix="%"
            accent="text-cyan-300"
          />
          <StatCell
            icon={Flame}
            label="Racha"
            value={String(activeStudent.streakDays)}
            suffix="días"
            accent="text-ember"
          />
        </div>
        <div className="border-t border-white/[0.055] px-4 pb-3.5 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
              Meta semanal
            </span>
            <span className="text-[8.5px] font-semibold text-muted">
              {activeStudent.weeklyMinutes}{" "}
              <span className="text-faint">/ {activeStudent.weeklyGoalMinutes} min</span>
            </span>
          </div>
          <div className="neu-inset mt-2 h-[5px] overflow-hidden rounded-full p-[1px]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weeklyPct}%` }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
              className="h-full rounded-full bg-[linear-gradient(90deg,#0D6EFD,#38BDF8)]"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="sendero">
        <SectionHeading
          index="03"
          title="El sendero"
          meta={
            <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-faint">
              <span className="text-glow/80">{completed}</span> de 8
              <Sparkles size={10} className="text-glow/50" />
            </span>
          }
        />
        <ol className="mt-4">
          {LEVELS.map((level, index) => (
            <LevelRow
              key={level.id}
              level={level}
              currentLevel={currentLevel}
              currentProgress={currentProgress}
              isLast={index === LEVELS.length - 1}
            />
          ))}
        </ol>
      </section>

      <section aria-labelledby="lectura">
        <SectionHeading
          index="04"
          title="Lectura del profesor"
          className="mb-3"
          meta={
            <span className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
              29 oct
            </span>
          }
        />
        <figure className="neu-card relative overflow-hidden rounded-[22px] p-5">
          <Quote
            size={44}
            strokeWidth={0.8}
            className="absolute right-4 top-4 text-white/[0.045]"
            aria-hidden
          />
          <blockquote className="relative max-w-[290px] font-display text-[16.5px] italic leading-[1.45] text-ivory/90">
            “La precisión sin respiración es solo mecánica. Deja que el pulso
            sostenga la frase y la mano izquierda cantará sola.”
          </blockquote>

          <div className="mt-5 space-y-2.5">
            {scores.map(({ skill, value }) => {
              const meta = SKILL_META[skill];
              return (
                <div key={skill}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
                      {meta.label}
                    </span>
                    <span className="font-display text-[10px] text-ivory/75">
                      {value}
                    </span>
                  </div>
                  <div className="neu-inset h-[4px] overflow-hidden rounded-full">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{
                        duration: reduceMotion ? 0 : 1,
                        delay: 0.4,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, #0D6EFD, ${meta.color})`,
                        boxShadow: `0 0 10px ${meta.glow}`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <figcaption className="mt-4 flex items-center gap-2.5 border-t border-white/[0.055] pt-3.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(145deg,#1a63c7,#0a2f63)] text-[8px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
              PL
            </span>
            <span>
              <span className="block text-[10px] font-semibold text-ivory/85">
                Prof. Leo
              </span>
              <span className="block text-[8px] uppercase tracking-[0.13em] text-faint">
                Evaluación del nivel {String(currentLevel).padStart(2, "0")}
              </span>
            </span>
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
