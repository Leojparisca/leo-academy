"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Clock3,
  Flame,
  Quote,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { CurriculumMap } from "@/components/curriculum/curriculum-map";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SectionHeading } from "@/components/ui/section-heading";
import { LEVELS, SKILL_META, type Skill } from "@/lib/academy";
import { cn } from "@/lib/utils";

const SKILL_ORDER: Skill[] = ["melody", "harmony", "rhythm"];
const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

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
    <div className="flex flex-col items-center gap-1 px-1 py-2">
      <Icon size={14} className={cn("opacity-80", accent ?? "text-sky-400")} />
      <div className="flex items-baseline gap-0.5">
        <span className="text-[20px] font-bold leading-none text-white">
          {value}
        </span>
        {suffix && (
          <span className="text-[10px] font-semibold text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>
    </div>
  );
}

export function MapaView({ teacherMode = false }: { teacherMode?: boolean }) {
  const { activeStudent, progress, skillScores } = useAcademy();
  const reduceMotion = useReducedMotion();

  const currentLevel = Math.min(
    Math.max(activeStudent?.currentLevel ?? 1, 1),
    LEVELS.length,
  );
  const currentProgress =
    progress.find((row) => row.levelId === `level-0${currentLevel}`)?.progress ??
    progress.find((row) => row.levelId === LEVELS[currentLevel - 1]?.id)?.progress ??
    0;

  const overall = Math.round(
    ((currentLevel - 1 + currentProgress / 100) / LEVELS.length) * 100,
  );
  const weeklyMinutes = activeStudent?.weeklyMinutes ?? 0;
  const weeklyGoal = Math.max(1, activeStudent?.weeklyGoalMinutes ?? 90);
  const weeklyPct = Math.min(100, Math.round((weeklyMinutes / weeklyGoal) * 100));
  const dailyGoal = Math.max(5, Math.round(weeklyGoal / 7));
  const todayMinutes = weeklyMinutes > 0 ? Math.min(dailyGoal, weeklyMinutes) : 0;

  const todayIndex = (new Date().getDay() + 6) % 7;
  const activeDays = useMemo(() => {
    const days = new Set<number>();
    if (weeklyMinutes > 0) days.add(todayIndex);
    const streak = Math.min(6, activeStudent?.streakDays ?? 0);
    for (let step = 1; step <= streak; step += 1) {
      days.add((todayIndex - step + 7) % 7);
    }
    return days;
  }, [activeStudent?.streakDays, todayIndex, weeklyMinutes]);

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
      <section className="rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 p-6 backdrop-blur-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
          Sin perfil activo
        </p>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-white">
          Abre tu perfil para empezar.
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
          El profesor puede registrar el primer alumno desde su mesa.
        </p>
        <Link
          href="/profesor"
          className="neu-button neu-button--primary mt-5 w-full"
        >
          Ir a la mesa del profesor
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact dashboard */}
      <section aria-label="Resumen del alumno">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 flex-none place-items-center rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 text-[13px] font-bold text-white ring-2 ring-white/10">
            {activeStudent.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-slate-400">
              Bienvenido de vuelta
            </p>
            <h1 className="truncate text-2xl font-bold leading-tight text-white">
              Hola, {activeStudent.firstName}
            </h1>
          </div>
          <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-[11px] font-bold text-amber-200">
            <Flame size={13} fill="currentColor" strokeWidth={1.4} />
            {activeStudent.streakDays} Días
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[11px] font-semibold text-slate-200 backdrop-blur-xl">
            <Clock3 size={12} className="text-sky-400" />
            {todayMinutes}/{dailyGoal} min
          </span>
          <Link
            href="/estudio"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-2 text-[11px] font-bold text-white shadow-lg shadow-blue-500/25"
          >
            Continuar
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </section>

      {/* Weekly luminous strip */}
      <section
        aria-label="Actividad de la semana"
        className="rounded-3xl border border-white/[0.08] bg-[#0E1524]/70 px-4 py-3.5 backdrop-blur-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Esta semana
          </span>
          <span className="text-[11px] font-semibold text-slate-300">
            {weeklyMinutes}{" "}
            <span className="text-slate-500">/ {weeklyGoal} min</span>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEK_LABELS.map((label, index) => {
            const active = activeDays.has(index);
            const today = index === todayIndex;
            return (
              <div
                key={`${label}-${index}`}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    today ? "text-sky-300" : "text-slate-500",
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-colors",
                    active
                      ? "bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)]"
                      : "bg-white/10",
                    today && !active && "ring-1 ring-sky-400/40",
                  )}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Vertical lesson path */}
      <section aria-labelledby="sendero">
        <SectionHeading
          index="01"
          title="El sendero"
          meta={
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <span className="text-sky-300">{currentLevel}</span> de {LEVELS.length}
              <Sparkles size={11} className="text-sky-400/70" />
            </span>
          }
        />
        <div className="mt-4">
          <CurriculumMap teacherMode={teacherMode} />
        </div>
      </section>

      {/* Study summary */}
      <section
        className="rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 p-4 backdrop-blur-xl"
        aria-label="Resumen de estudio"
      >
        <div className="flex items-center gap-3">
          <ProgressRing value={overall} size={70} caption="sendero" />
          <div className="grid flex-1 grid-cols-3 divide-x divide-white/10">
            <StatCell
              icon={Clock3}
              label="Semana"
              value={String(weeklyMinutes)}
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
              suffix="d"
              accent="text-amber-300"
            />
          </div>
        </div>
        <div className="mt-3 border-t border-white/[0.07] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Meta semanal
            </span>
            <span className="text-[11px] font-semibold text-slate-300">
              {weeklyPct}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${weeklyPct}%` }}
              transition={{
                duration: reduceMotion ? 0 : 1.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="h-full rounded-full bg-[linear-gradient(90deg,#0D6EFD,#38BDF8)] shadow-[0_0_12px_rgba(56,189,248,0.45)]"
            />
          </div>
        </div>
      </section>

      {/* Teacher note */}
      <section aria-labelledby="lectura">
        <SectionHeading
          index="02"
          title="Nota del profe"
          className="mb-3"
          meta={
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Nivel {String(currentLevel).padStart(2, "0")}
            </span>
          }
        />
        <figure className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 p-5 backdrop-blur-xl">
          <Quote
            size={40}
            strokeWidth={0.9}
            className="absolute right-4 top-4 text-white/[0.06]"
            aria-hidden
          />
          <blockquote className="relative max-w-[290px] text-[15px] font-medium italic leading-relaxed text-slate-200">
            “La precisión sin respiración es solo mecánica. Deja que el pulso
            sostenga la frase y la mano izquierda cantará sola.”
          </blockquote>

          <div className="mt-4 space-y-2.5">
            {scores.map(({ skill, value }) => {
              const meta = SKILL_META[skill];
              return (
                <div key={skill}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {meta.label}
                    </span>
                    <span className="text-[11px] font-bold text-slate-200">
                      {value}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{
                        duration: reduceMotion ? 0 : 1,
                        delay: 0.3,
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

          <figcaption className="mt-4 flex items-center gap-2.5 border-t border-white/[0.07] pt-3.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(145deg,#1a63c7,#0a2f63)] text-[9px] font-bold text-white">
              PL
            </span>
            <span>
              <span className="block text-[12px] font-semibold text-slate-200">
                Prof. Leo
              </span>
              <span className="block text-[10px] text-slate-400">
                Evaluación del nivel {String(currentLevel).padStart(2, "0")}
              </span>
            </span>
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
