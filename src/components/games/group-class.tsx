"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Crown,
  Ear,
  Hand,
  Moon,
  Piano,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Waves,
  WifiOff,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { ChordArchitect } from "@/components/games/chord-architect";
import { GroovePadDual } from "@/components/games/groove-pad-dual";
import { IntervalHunter } from "@/components/games/interval-hunter";
import { Stars, type GameResult } from "@/components/games/game-ui";
import type {
  HarmonyDrill,
  MelodyDrill,
  RhythmDrill,
} from "@/data/curriculum";
import { cn } from "@/lib/utils";

type ActivityId = "ritmo" | "melodia" | "armonia";

type Activity = {
  id: ActivityId;
  label: string;
  short: string;
  icon: typeof Waves;
  color: string;
  copy: string;
};

const ACTIVITIES: Activity[] = [
  {
    id: "ritmo",
    label: "Ritmo Táctil",
    short: "Ritmo",
    icon: Waves,
    color: "#F2B45C",
    copy: "Percute el patrón en los dos pads.",
  },
  {
    id: "melodia",
    label: "Dictado Auditivo",
    short: "Dictado",
    icon: Ear,
    color: "#38BDF8",
    copy: "Escucha y nombra el intervalo.",
  },
  {
    id: "armonia",
    label: "Construcción de Acordes",
    short: "Acordes",
    icon: Piano,
    color: "#9DB5FF",
    copy: "Cuenta semitonos y sella la forma.",
  },
];

const GROUP_RHYTHM: RhythmDrill = {
  kind: "rhythm",
  bpm: 76,
  bars: 2,
  label: "Negras alternadas",
  hits: [
    { at: 0, hand: "left" },
    { at: 1, hand: "right" },
    { at: 2, hand: "left" },
    { at: 3, hand: "right" },
  ],
};

const GROUP_MELODY: MelodyDrill = {
  kind: "melody",
  mode: "interval",
  intervals: [2, 4, 7, 12],
  rounds: 4,
  baseMidi: 60,
  label: "Dictado de intervalos",
};

const GROUP_HARMONY: HarmonyDrill = {
  kind: "harmony",
  mode: "build",
  qualities: ["maj", "min"],
  roots: [0, 2, 5, 7, 9],
  rounds: 3,
  label: "Mayor y menor",
};

type Turn = { studentId: string; activity: Activity; round: number };
type Phase = "setup" | "turn" | "playing" | "result" | "final";

type TurnResult = {
  studentId: string;
  activity: Activity;
  result: GameResult;
  xp: number;
};

function ActivityGlyph({
  activity,
  size = 12,
}: {
  activity: Activity;
  size?: number;
}) {
  const Icon = activity.icon;
  return <Icon size={size} style={{ color: activity.color }} />;
}

export function GroupClass() {
  const {
    students,
    offlineMode,
    toggleOfflineMode,
    xpByStudent,
    awardGroupXp,
  } = useAcademy();

  const [phase, setPhase] = useState<Phase>("setup");
  const [selected, setSelected] = useState<string[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [sessionXp, setSessionXp] = useState<Record<string, number>>({});
  const [last, setLast] = useState<TurnResult | null>(null);

  const schedule = useMemo<Turn[]>(() => {
    if (selected.length < 2) return [];
    const turns: Turn[] = [];
    for (let round = 0; round < ACTIVITIES.length; round += 1) {
      selected.forEach((studentId, index) => {
        turns.push({
          studentId,
          activity: ACTIVITIES[(index + round) % ACTIVITIES.length],
          round,
        });
      });
    }
    return turns;
  }, [selected]);

  const studentName = (id: string) =>
    students.find((student) => student.id === id)?.firstName ??
    students.find((student) => student.id === id)?.name ??
    "Alumno";

  const toggle = (id: string) => {
    setSelected((previous) => {
      if (previous.includes(id)) return previous.filter((item) => item !== id);
      if (previous.length >= 5) return previous;
      return [...previous, id];
    });
  };

  const start = () => {
    if (selected.length < 2) return;
    setSessionXp(Object.fromEntries(selected.map((id) => [id, 0])));
    setTurnIndex(0);
    setLast(null);
    setPhase("turn");
  };

  const current = schedule[turnIndex];

  const finishTurn = (result: GameResult) => {
    if (!current) return;
    const xp = Math.max(25, Math.round(result.xp));
    void awardGroupXp(
      current.studentId,
      xp,
      `Pasa el teléfono · ${current.activity.label}`,
    );
    setSessionXp((previous) => ({
      ...previous,
      [current.studentId]: (previous[current.studentId] ?? 0) + xp,
    }));
    setLast({
      studentId: current.studentId,
      activity: current.activity,
      result,
      xp,
    });
    setPhase("result");
  };

  const advance = () => {
    if (turnIndex + 1 >= schedule.length) {
      setPhase("final");
      return;
    }
    setTurnIndex((index) => index + 1);
    setLast(null);
    setPhase("turn");
  };

  if (!offlineMode) {
    return (
      <section
        aria-labelledby="grupo-standby"
        className="neu-card relative overflow-hidden rounded-[24px] p-5"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-ember/[0.08] blur-3xl"
        />
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-[13px] border border-ember/15 bg-ember/[0.05] text-ember">
            <Moon size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-[7px]">Protocolo sin luz</p>
            <h2
              id="grupo-standby"
              className="mt-1.5 font-display text-[20px] leading-tight text-ivory"
            >
              Clase en Grupo
              <span className="mt-0.5 block text-[10px] font-normal not-italic text-faint">
                Pasa el teléfono
              </span>
            </h2>
            <p className="mt-1.5 text-[9px] leading-relaxed text-muted">
              Un solo dispositivo, de 2 a 5 alumnos. Activa el Modo Sin Luz para
              bajar la pantalla a tonos abisales y empezar la rotación.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleOfflineMode}
          className="neu-button mt-4 w-full rounded-[13px] py-2.5 text-[9.5px]"
        >
          <WifiOff size={12} className="text-ember" />
          Activar Modo Sin Luz
          <ArrowRight size={12} className="ml-auto opacity-60" />
        </button>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="grupo"
      className="group-class relative overflow-hidden rounded-[24px] border border-ember/15 p-4"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-ember/[0.09] blur-3xl"
      />
      <header className="relative flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-ember shadow-[0_0_8px_#F2B45C]" />
            <p className="text-[6.5px] font-bold uppercase tracking-[0.2em] text-ember/90">
              Modo Sin Luz · Clase en grupo
            </p>
          </div>
          <h2
            id="grupo"
            className="mt-1.5 font-display text-[23px] leading-none text-ivory"
          >
            Pasa el teléfono
          </h2>
          <p className="mt-1 text-[8px] text-faint">
            {phase === "setup"
              ? "Elige de 2 a 5 alumnos presentes."
              : phase === "final"
                ? "Ronda terminada. La XP ya vive en cada perfil."
                : `Turno ${turnIndex + 1} de ${schedule.length} · ${selected.length} alumnos`}
          </p>
        </div>
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-ember/20 bg-ember/[0.07] text-ember">
          <Users size={15} />
        </span>
      </header>

      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative mt-3"
          >
            <div className="space-y-1.5">
              {students.map((student) => {
                const on = selected.includes(student.id);
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => toggle(student.id)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[13px] border px-2.5 py-2 text-left transition-all duration-200",
                      on
                        ? "border-ember/30 bg-ember/[0.07]"
                        : "border-white/[0.05] bg-white/[0.012]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 flex-none place-items-center rounded-full border text-[8px] font-bold",
                        on
                          ? "border-ember/30 bg-ember/10 text-ember"
                          : "border-white/[0.07] bg-white/[0.03] text-faint",
                      )}
                      style={
                        on
                          ? { background: `${student.avatarTone === "cyan" ? "#38BDF8" : "#0D6EFD"}22` }
                          : undefined
                      }
                    >
                      {student.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-semibold text-ivory/90">
                        {student.name}
                      </span>
                      <span className="block text-[6.5px] text-faint">
                        Nivel {student.currentLevel} ·{" "}
                        {xpByStudent[student.id] ?? 0} XP
                      </span>
                    </span>
                    <span
                      className={cn(
                        "grid h-5 w-5 flex-none place-items-center rounded-full border",
                        on
                          ? "border-ember/35 bg-ember text-[#1a1206]"
                          : "border-white/10 text-transparent",
                      )}
                    >
                      <Check size={11} strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between text-[6.5px] font-semibold uppercase tracking-[0.13em] text-faint">
              <span>{selected.length} de 5 seleccionados</span>
              <span>Mínimo 2 · máximo 5</span>
            </div>

            <button
              type="button"
              onClick={start}
              disabled={selected.length < 2}
              className="neu-button neu-button--primary mt-3 w-full rounded-[13px] py-2.5 text-[10px]"
            >
              <Play size={12} fill="currentColor" />
              Empezar rotación
              <span className="ml-auto text-[7px] opacity-70">
                {selected.length * 3} turnos
              </span>
            </button>
          </motion.div>
        )}

        {phase === "turn" && current && (
          <motion.div
            key={`turn-${turnIndex}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative mt-4 rounded-[18px] border border-white/[0.06] bg-black/20 px-4 py-5 text-center"
          >
            <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-faint">
              Turno {turnIndex + 1} de {schedule.length}
            </span>
            <p className="mt-1.5 font-display text-[27px] leading-none text-ivory">
              {studentName(current.studentId)}
            </p>
            <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
              <ActivityGlyph activity={current.activity} />
              <span className="text-[8.5px] font-semibold text-ivory/90">
                {current.activity.label}
              </span>
            </div>
            <p className="mt-2 text-[8.5px] leading-relaxed text-muted">
              {current.activity.copy} Pasa el teléfono a{" "}
              {studentName(current.studentId)} antes de empezar.
            </p>
            <button
              type="button"
              onClick={() => setPhase("playing")}
              className="neu-button neu-button--primary mt-4 w-full rounded-[13px] py-2.5 text-[10px]"
            >
              <Hand size={12} />
              Estoy listo
            </button>
          </motion.div>
        )}

        {phase === "playing" && current && (
          <motion.div
            key={`play-${turnIndex}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative mt-3"
          >
            {current.activity.id === "ritmo" && (
              <GroovePadDual
                drill={GROUP_RHYTHM}
                barsOverride={2}
                compact
                persist={false}
                finishLabel="Pasar el teléfono"
                xpNote="El XP se acredita al pasar el teléfono"
                onFinish={finishTurn}
              />
            )}
            {current.activity.id === "melodia" && (
              <IntervalHunter
                drill={GROUP_MELODY}
                roundsOverride={4}
                compact
                persist={false}
                finishLabel="Pasar el teléfono"
                xpNote="El XP se acredita al pasar el teléfono"
                onFinish={finishTurn}
              />
            )}
            {current.activity.id === "armonia" && (
              <ChordArchitect
                drill={GROUP_HARMONY}
                roundsOverride={3}
                compact
                persist={false}
                finishLabel="Pasar el teléfono"
                xpNote="El XP se acredita al pasar el teléfono"
                onFinish={finishTurn}
              />
            )}
          </motion.div>
        )}

        {phase === "result" && last && (
          <motion.div
            key={`result-${turnIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-4 rounded-[18px] border border-[#7DE2C3]/20 bg-[#7DE2C3]/[0.04] px-4 py-4 text-center"
          >
            <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-faint">
              {last.activity.label} completado
            </p>
            <p className="mt-1 font-display text-[24px] leading-none text-ivory">
              {studentName(last.studentId)}
            </p>
            <div className="mt-2 flex items-center justify-center gap-3">
              <Stars value={last.result.stars} size={17} />
              <span className="inline-flex items-center gap-1 rounded-full border border-[#F5C15A]/25 bg-[#F5C15A]/[0.08] px-2.5 py-1 text-[9px] font-bold text-[#F5C15A]">
                <Zap size={10} fill="currentColor" />+{last.xp} XP
              </span>
            </div>
            <p className="mt-2 text-[8.5px] text-muted">
              {last.result.accuracy}% de precisión. La XP ya está guardada en su
              perfil de IndexedDB.
            </p>
            <button
              type="button"
              onClick={advance}
              className="neu-button neu-button--primary mt-3.5 w-full rounded-[13px] py-2.5 text-[10px]"
            >
              {turnIndex + 1 >= schedule.length ? (
                <>
                  <Crown size={12} />
                  Ver clasificación
                </>
              ) : (
                <>
                  Pasar a {studentName(schedule[turnIndex + 1].studentId)}
                  <ArrowRight size={12} className="ml-auto" />
                </>
              )}
            </button>
          </motion.div>
        )}

        {phase === "final" && (
          <motion.div
            key="final"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-4"
          >
            <div className="space-y-1.5">
              {[...selected]
                .sort(
                  (a, b) => (sessionXp[b] ?? 0) - (sessionXp[a] ?? 0),
                )
                .map((studentId, position) => {
                  const xp = sessionXp[studentId] ?? 0;
                  return (
                    <div
                      key={studentId}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[13px] border px-2.5 py-2",
                        position === 0
                          ? "border-[#F5C15A]/30 bg-[#F5C15A]/[0.07]"
                          : "border-white/[0.05] bg-white/[0.012]",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-6 w-6 flex-none place-items-center rounded-full border text-[8px] font-bold",
                          position === 0
                            ? "border-[#F5C15A]/40 text-[#F5C15A]"
                            : "border-white/10 text-faint",
                        )}
                      >
                        {position === 0 ? (
                          <Crown size={11} />
                        ) : (
                          position + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] font-semibold text-ivory/90">
                          {studentName(studentId)}
                        </span>
                        <span className="block text-[6.5px] text-faint">
                          {xpByStudent[studentId] ?? 0} XP de perfil
                        </span>
                      </span>
                      <span className="font-display text-[15px] tabular-nums text-ivory">
                        +{xp}
                      </span>
                    </div>
                  );
                })}
            </div>

            <div className="mt-2.5 flex items-center justify-center gap-1.5">
              <Sparkles size={10} className="text-[#F5C15A]" />
              <span className="text-[6.5px] font-semibold uppercase tracking-[0.14em] text-faint">
                Cada punto quedó en el perfil individual
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={start}
                className="neu-button min-h-0 rounded-[12px] py-2.5 text-[9px]"
              >
                <RotateCcw size={11} />
                Otra ronda
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase("setup");
                  setLast(null);
                  setTurnIndex(0);
                }}
                className="neu-button neu-button--primary min-h-0 rounded-[12px] py-2.5 text-[9px]"
              >
                <Users size={11} />
                Cambiar grupo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
