"use client";

import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Clock3,
  Ear,
  Music2,
  Play,
  Volume2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import {
  GameMeter,
  GameResultCard,
  type GameResult,
} from "@/components/games/game-ui";
import { MiniStaff } from "@/components/games/mini-staff";
import {
  intervalAnswerLabel,
  starsForAccuracy,
  type MelodyDrill,
} from "@/data/curriculum";
import { LETTERS, midiToPc } from "@/lib/harmony";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

type Phase = "intro" | "question" | "feedback" | "result";

type Question = {
  id: number;
  baseMidi: number;
  targetMidi: number;
  semitones: number;
  mode: MelodyDrill["mode"];
  correct: string;
  choices: string[];
};

const DEFAULT_DRILL: MelodyDrill = {
  kind: "melody",
  mode: "direction",
  intervals: [2, 3, 4, 5, 7, 12],
  rounds: 8,
  baseMidi: 60,
  label: "Dirección",
};

const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;

type Mode = "normal" | "lightning";
const LIGHTNING_SECONDS = 30;

/**
 * Friendly listening mnemonics: every answer card carries a mood plus a tune
 * the student already knows, so the ear has somewhere to land.
 */
const MNEMONICS: Record<
  string,
  { mood: string; hint: string; color: string }
> = {
  "2ª mayor": {
    mood: "Cercano · luminoso",
    hint: "“Cumpleaños feliz” empieza con este salto.",
    color: "#7DE2C3",
  },
  "3ª menor": {
    mood: "Triste · sombra",
    hint: "El riff de “Smoke on the Water”.",
    color: "#7C9CFF",
  },
  "3ª mayor": {
    mood: "Alegre · soleado",
    hint: "“Oh when the saints” arranca así.",
    color: "#F2B45C",
  },
  "4ª justa": {
    mood: "Heroico · abierto",
    hint: "La marcha nupcial que todos conocen.",
    color: "#9DB5FF",
  },
  "5ª justa": {
    mood: "Estable · espacio",
    hint: "La fanfarria de “Star Wars”.",
    color: "#38BDF8",
  },
  Octava: {
    mood: "Mismo nombre · brillo",
    hint: "“Over the Rainbow”, primer salto.",
    color: "#F5C15A",
  },
  Sube: {
    mood: "Amanece",
    hint: "La segunda nota queda arriba.",
    color: "#7DE2C3",
  },
  Baja: {
    mood: "Cae la tarde",
    hint: "La segunda nota queda abajo.",
    color: "#FB7185",
  },
};

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function buildQuestion(drill: MelodyDrill, id: number): Question {
  if (drill.mode === "read") {
    const targetMidi = 64 + Math.floor(Math.random() * 14);
    const correct = LETTERS[midiToPc(targetMidi)];
    const distractors = shuffle(
      NOTE_LETTERS.filter((letter) => letter !== correct),
    ).slice(0, 3);
    return {
      id,
      baseMidi: targetMidi,
      targetMidi,
      semitones: 0,
      mode: "read",
      correct,
      choices: shuffle([correct, ...distractors]),
    };
  }

  const semitones = pick(drill.intervals);
  const direction = Math.random() > 0.5 ? 1 : -1;
  const baseMidi = Math.min(
    70,
    Math.max(56, drill.baseMidi + Math.floor(Math.random() * 8) - 3),
  );
  const targetMidi = baseMidi + semitones * direction;

  if (drill.mode === "direction") {
    return {
      id,
      baseMidi,
      targetMidi,
      semitones,
      mode: "direction",
      correct: direction > 0 ? "Sube" : "Baja",
      choices: ["Sube", "Baja"],
    };
  }

  const correct = intervalAnswerLabel(semitones);
  const pool = [...new Set(drill.intervals.map(intervalAnswerLabel))].filter(
    (label) => label !== correct,
  );
  const choices = shuffle([correct, ...shuffle(pool).slice(0, 3)]);

  return {
    id,
    baseMidi,
    targetMidi,
    semitones,
    mode: "interval",
    correct,
    choices,
  };
}

export function IntervalHunter({
  drill = DEFAULT_DRILL,
  roundsOverride,
  compact = false,
  persist = true,
  finishLabel,
  xpNote,
  onFinish,
}: {
  drill?: MelodyDrill;
  roundsOverride?: number;
  compact?: boolean;
  persist?: boolean;
  finishLabel?: string;
  xpNote?: string;
  onFinish?: (result: GameResult) => void;
}) {
  const audio = useAudioEngine();
  const { recordGameResult } = useAcademy();
  const rounds = roundsOverride ?? drill.rounds ?? 8;

  const [phase, setPhase] = useState<Phase>("intro");
  const [mode, setMode] = useState<Mode>("normal");
  const [question, setQuestion] = useState<Question | null>(null);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [points, setPoints] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);

  const questionCounter = useRef(0);
  const correctRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
  const attemptsRef = useRef(0);
  const pointsRef = useRef(0);
  const lightningDeadlineRef = useRef(0);
  const playTimers = useRef<number[]>([]);
  const finishedRef = useRef(false);

  const clearPlayTimers = useCallback(() => {
    playTimers.current.forEach((timer) => window.clearTimeout(timer));
    playTimers.current = [];
  }, []);

  useEffect(() => clearPlayTimers, [clearPlayTimers]);

  const playSequence = useCallback(
    (target: Question, reveal = false) => {
      clearPlayTimers();
      audio.unlock();
      if (target.mode === "read" && !reveal) return;
      audio.playNote(target.baseMidi, 0.62, 0.8);
      const timer = window.setTimeout(() => {
        audio.playNote(target.targetMidi, 1, 0.82);
      }, 660);
      playTimers.current.push(timer);
    },
    [audio, clearPlayTimers],
  );

  const playRising = useCallback(
    (level = 0) => {
      const root = 72 + Math.min(7, level);
      [0, 4, 7, 12].forEach((offset, position) => {
        const timer = window.setTimeout(() => {
          audio.playNote(root + offset, 0.34, 0.72);
        }, position * 78);
        playTimers.current.push(timer);
      });
    },
    [audio],
  );

  const finish = useCallback(
    (lightning = false) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const total = lightning ? Math.max(1, attemptsRef.current) : rounds;
      const accuracy = Math.round((correctRef.current / total) * 100);
      const stars = starsForAccuracy(accuracy);
      const xp = lightning
        ? Math.round(pointsRef.current * 0.06 + bestStreakRef.current * 4 + 20)
        : Math.round(accuracy * 0.75 + bestStreakRef.current * 4 + 20);
      const next: GameResult = {
        game: "melody",
        score: lightning
          ? pointsRef.current
          : correctRef.current * 100 + bestStreakRef.current * 15,
        accuracy,
        stars,
        xp,
        detail: lightning
          ? "Racha Relámpago"
          : drill.mode === "read"
            ? "Cazador de lectura"
            : "Cazador de intervalos",
        stats: {
          correct: correctRef.current,
          total,
          combo: bestStreakRef.current,
        },
      };
      setResult(next);
      setPhase("result");
      audio.releaseAll();
      if (persist) {
        void recordGameResult({
          skill: "melody",
          accuracy,
          xp,
          detail: next.detail,
        });
      }
    },
    [audio, drill.mode, persist, recordGameResult, rounds],
  );

  function submitAnswer(choice: string | null) {
    if (!question || phase !== "question") return;
    const lightning = mode === "lightning";
    const right = choice === question.correct;
    setPicked(choice);
    setIsCorrect(right);
    setPhase("feedback");
    attemptsRef.current += 1;

    if (right) {
      correctRef.current += 1;
      streakRef.current += 1;
      bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
      setCorrect(correctRef.current);
      setStreak(streakRef.current);
      setBestStreak(bestStreakRef.current);

      if (lightning) {
        // Every consecutive answer is worth double: 100 → 200 points.
        const doubled = streakRef.current >= 2;
        pointsRef.current += doubled ? 200 : 100;
        setPoints(pointsRef.current);
        playRising(streakRef.current);
      } else if (streakRef.current >= 3) {
        playRising(streakRef.current);
      }
    } else {
      streakRef.current = 0;
      setStreak(0);
    }

    if (question.mode === "read" || !right) {
      playSequence(question, true);
    }

    // Lightning keeps the pulse fast: a correct answer flows into the next
    // challenge without an extra tap.
    if (lightning && right) {
      const timer = window.setTimeout(() => next(), 560);
      playTimers.current.push(timer);
    }
  }

  const next = () => {
    if (finishedRef.current) return;
    if (mode === "normal" && index + 1 >= rounds) {
      finish();
      return;
    }
    const nextIndex = index + 1;
    const nextQuestion = buildQuestion(drill, questionCounter.current + 1);
    questionCounter.current += 1;
    setIndex(nextIndex);
    setQuestion(nextQuestion);
    setPicked(null);
    if (mode === "normal") setTimeLeft(10);
    setPhase("question");
  };

  const start = (nextMode: Mode = "normal") => {
    audio.unlock();
    clearPlayTimers();
    finishedRef.current = false;
    correctRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    attemptsRef.current = 0;
    pointsRef.current = 0;
    questionCounter.current = 0;
    lightningDeadlineRef.current =
      nextMode === "lightning" ? Date.now() + LIGHTNING_SECONDS * 1000 : 0;
    setMode(nextMode);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setPoints(0);
    setIndex(0);
    setResult(null);
    setPicked(null);
    setTimeLeft(nextMode === "lightning" ? LIGHTNING_SECONDS : 10);
    setQuestion(buildQuestion(drill, 0));
    setPhase("question");
  };

  // Auto-play the pair when a new auditory question arrives.
  useEffect(() => {
    if (phase !== "question" || !question || question.mode === "read") return;
    const timer = window.setTimeout(() => playSequence(question), 260);
    return () => window.clearTimeout(timer);
  }, [phase, question, playSequence]);

  // Reading sprint clock: ten seconds per note.
  useEffect(() => {
    if (phase !== "question" || !question || question.mode !== "read") return;
    if (mode !== "normal") return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, 10 - (Date.now() - startedAt) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        window.clearInterval(timer);
        submitAnswer(null);
      }
    }, 100);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, question]);

  // Racha Relámpago: one shared 30-second fuse for the whole run.
  useEffect(() => {
    if (mode !== "lightning") return;
    if (phase === "intro" || phase === "result") return;
    if (!lightningDeadlineRef.current) return;
    const tick = () => {
      const left = Math.max(
        0,
        (lightningDeadlineRef.current - Date.now()) / 1000,
      );
      setTimeLeft(left);
      if (left <= 0) finish(true);
    };
    const timer = window.setInterval(tick, 100);
    tick();
    return () => window.clearInterval(timer);
  }, [mode, phase, finish]);

  const tone =
    question?.mode === "read"
      ? "#38BDF8"
      : question?.mode === "interval"
        ? "#9DB5FF"
        : "#F2B45C";

  return (
    <div className="space-y-3">
      {phase === "intro" && (
        <div
          className={cn(
            "keyboard-stage relative overflow-hidden rounded-[26px] p-4",
            compact && "rounded-[22px] p-3.5",
          )}
        >
          <span className="keyboard-screw left-1.5 top-1.5" aria-hidden />
          <span className="keyboard-screw right-1.5 top-1.5" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-[7px]">Melodía · Oído y lectura</p>
              <h2 className="mt-1.5 font-display text-[24px] leading-none text-ivory">
                Cazador de Intervalos
              </h2>
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">
                {drill.mode === "direction"
                  ? "Siente si la segunda nota sube o baja."
                  : drill.mode === "interval"
                    ? "Nombra la distancia entre dos notas."
                    : "Lee la nota del pentagrama antes de que se apague el reloj."}
              </p>
            </div>
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-cyan-300/15 bg-cyan-300/[0.05] text-glow">
              <Ear size={15} />
            </span>
          </div>

          <div className="neu-inset relative mt-4 overflow-hidden rounded-[16px] p-3">
            <MiniStaff midi={drill.mode === "read" ? 72 : 67} glow />
            <div className="mt-2 flex items-center justify-between text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
              <span>{rounds} retos</span>
              <span>{drill.mode === "read" ? "10 s por nota" : "Sin reloj"}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {drill.mode === "direction" && (
              <>
                <span className="neu-pill min-h-0 px-2 py-1 text-[7px] text-faint">
                  <ArrowUp size={9} /> Sube
                </span>
                <span className="neu-pill min-h-0 px-2 py-1 text-[7px] text-faint">
                  <ArrowDown size={9} /> Baja
                </span>
              </>
            )}
            {drill.intervals.map((interval) => {
              const mnemonic = MNEMONICS[intervalAnswerLabel(interval)];
              return (
                <span
                  key={interval}
                  className="rounded-full border px-2 py-1 text-[7px] font-semibold"
                  style={{
                    borderColor: `${mnemonic?.color ?? "#38BDF8"}33`,
                    background: `${mnemonic?.color ?? "#38BDF8"}0f`,
                    color: mnemonic?.color ?? "#94A3B8",
                  }}
                >
                  {intervalAnswerLabel(interval)}
                  {mnemonic ? ` · ${mnemonic.mood.split(" · ")[0]}` : ""}
                </span>
              );
            })}
          </div>

          <p className="mt-2 text-[7px] leading-relaxed text-faint">
            Cada tarjeta trae una mnemotecnia y una canción conocida para
            reconocer el intervalo de oído.
          </p>

          <button
            type="button"
            onClick={() => start("normal")}
            className="neu-button neu-button--primary mt-4 w-full rounded-[14px] py-3 text-[11px]"
          >
            <Play size={13} fill="currentColor" />
            Empezar a escuchar
          </button>

          {drill.mode !== "read" && (
            <button
              type="button"
              onClick={() => start("lightning")}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#F5C15A]/30 bg-[linear-gradient(100deg,rgba(56,189,248,0.14),rgba(245,193,90,0.16))] py-2.5 text-[10.5px] font-bold text-[#FFE7A8] transition-colors hover:border-[#F5C15A]/45"
            >
              <Zap size={13} fill="currentColor" />
              Racha Relámpago · 30 s
            </button>
          )}
        </div>
      )}

      {(phase === "question" || phase === "feedback") && question && (
        <div className="game-stage relative overflow-hidden rounded-[26px] p-3.5">
          {mode === "lightning" && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between text-[7px] font-bold uppercase tracking-[0.14em]">
                <span className="flex items-center gap-1 text-[#F5C15A]">
                  <Zap size={9} fill="currentColor" />
                  Racha Relámpago
                </span>
                <span
                  className={cn(
                    "tabular-nums",
                    timeLeft < 5 ? "text-[#FB7185]" : "text-glow",
                  )}
                >
                  {timeLeft.toFixed(1)}s
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full bg-[linear-gradient(90deg,#38BDF8,#F5C15A)] transition-[width] duration-100 ease-linear"
                  style={{
                    width: `${Math.max(0, Math.min(100, (timeLeft / LIGHTNING_SECONDS) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              <Music2 size={10} style={{ color: tone }} />
              {mode === "lightning"
                ? `Reto ${index + 1}`
                : `Reto ${index + 1}/${rounds}`}
            </span>
            <div className="flex items-center gap-2 text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
              {streak > 1 && (
                <span className="text-[#F5C15A]">
                  racha ×{streak}
                  {mode === "lightning" && " · ×2"}
                </span>
              )}
              {question.mode === "read" && phase === "question" && (
                <span
                  className={cn(
                    "flex items-center gap-1 tabular-nums",
                    timeLeft < 3 ? "text-[#FB7185]" : "text-glow",
                  )}
                >
                  <Clock3 size={10} />
                  {timeLeft.toFixed(1)}s
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="font-display text-[28px] leading-none tabular-nums text-ivory">
              {mode === "lightning" ? points : correct}
            </span>
            <span className="text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              {mode === "lightning" ? "puntos" : "aciertos"}
            </span>
            {mode === "lightning" && (
              <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-faint">
                · {correct} aciertos
              </span>
            )}
            <div className="ml-auto w-24">
              <GameMeter
                value={
                  mode === "lightning"
                    ? (timeLeft / LIGHTNING_SECONDS) * 100
                    : (index / rounds) * 100
                }
                tone={tone}
              />
            </div>
          </div>

          {question.mode === "read" ? (
            <div className="mt-3">
              <MiniStaff
                midi={question.targetMidi}
                glow={phase === "question"}
                label={phase === "feedback" ? question.correct : "Clave de sol"}
              />
              <p className="mt-2 text-center text-[10px] text-muted">
                {phase === "question"
                  ? "¿Qué nota está escrita?"
                  : isCorrect
                    ? "Perfecto: la leíste de un vistazo."
                    : `Era ${question.correct}. La línea y el espacio no mienten.`}
              </p>
            </div>
          ) : (
            <div className="neu-inset relative mt-3 overflow-hidden rounded-[18px] px-4 py-6 text-center">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_50%_0%,rgba(56,189,248,0.09),transparent_70%)]"
              />
              <div className="relative flex items-end justify-center gap-4">
                <span className="flex flex-col items-center gap-1.5">
                  <span className="grid h-14 w-14 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] font-display text-[22px] text-ivory">
                    1
                  </span>
                  <span className="text-[6px] font-semibold uppercase tracking-[0.16em] text-faint">
                    Base
                  </span>
                </span>
                <span className="mb-6 flex flex-col items-center">
                  <span className="text-[22px] text-faint">···</span>
                  <span className="text-[7px] font-semibold uppercase tracking-[0.14em] text-glow">
                    ¿{question.mode === "direction" ? "sube o baja?" : "qué intervalo?"}
                  </span>
                </span>
                <span className="flex flex-col items-center gap-1.5">
                  <span className="grid h-14 w-14 place-items-center rounded-full border border-white/[0.08] bg-white/[0.03] font-display text-[22px] text-ivory/70">
                    2
                  </span>
                  <span className="text-[6px] font-semibold uppercase tracking-[0.16em] text-faint">
                    Objetivo
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => playSequence(question)}
                className="neu-button mx-auto mt-5 min-h-0 rounded-full px-3.5 py-2 text-[8.5px]"
              >
                <Volume2 size={11} className="text-glow" />
                Escuchar otra vez
              </button>
            </div>
          )}

          {phase === "question" ? (
            <div
              className={cn(
                "mt-3 grid gap-2",
                question.choices.length === 2 ? "grid-cols-2" : "grid-cols-2",
              )}
            >
              {question.choices.map((choice) => {
                const mnemonic = MNEMONICS[choice];
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => submitAnswer(choice)}
                    className="choice-key relative overflow-hidden rounded-[16px] border border-white/[0.06] px-3 py-3 text-left"
                    style={
                      mnemonic
                        ? { borderColor: `${mnemonic.color}2e` }
                        : undefined
                    }
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-[2px]"
                      style={{ background: mnemonic?.color ?? "#38BDF8" }}
                    />
                    <span className="block text-[12px] font-bold leading-tight text-ivory/90">
                      {choice}
                    </span>
                    {mnemonic && (
                      <>
                        <span
                          className="mt-1 block text-[8px] font-semibold"
                          style={{ color: mnemonic.color }}
                        >
                          {mnemonic.mood}
                        </span>
                        <span className="mt-0.5 block text-[7px] leading-snug text-faint">
                          {mnemonic.hint}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mt-3 rounded-[16px] border px-3.5 py-3",
                isCorrect
                  ? "border-[#7DE2C3]/20 bg-[#7DE2C3]/[0.06]"
                  : "border-[#FB7185]/20 bg-[#FB7185]/[0.05]",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "font-display text-[15px]",
                    isCorrect ? "text-[#7DE2C3]" : "text-[#FB7185]",
                  )}
                >
                  {isCorrect ? "¡Exacto!" : picked ? "Casi" : "Se apagó el reloj"}
                </span>
                {mode === "lightning" && isCorrect && (
                  <motion.span
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-full border border-[#F5C15A]/35 bg-[#F5C15A]/[0.12] px-2 py-0.5 text-[8px] font-bold text-[#FFE7A8]"
                  >
                    {streak >= 2 ? "+200 ×2" : "+100"}
                  </motion.span>
                )}
                <span className="ml-auto text-[8px] font-semibold uppercase tracking-[0.14em] text-faint">
                  {question.correct}
                </span>
              </div>
              <p className="mt-1 text-[9px] leading-relaxed text-muted">
                {question.mode === "read"
                  ? `La nota escrita es ${question.correct}. Cada línea y espacio del pentagrama es un paso de la escala.`
                  : question.mode === "direction"
                    ? `La segunda nota ${question.correct.toLowerCase()}. El contorno se siente antes de nombrarlo.`
                    : `${question.correct}: ${question.semitones} semitonos. Cuenta desde la nota base, no desde la memoria.`}
              </p>
              <button
                type="button"
                onClick={next}
                className="neu-button neu-button--primary mt-2.5 w-full rounded-[12px] py-2.5 text-[9.5px]"
              >
                {mode === "normal" && index + 1 >= rounds
                  ? "Ver resultado"
                  : "Siguiente reto"}
              </button>
            </motion.div>
          )}

          {phase === "feedback" && (
            <button
              type="button"
              onClick={() => playSequence(question, true)}
              className="mx-auto mt-2 flex items-center gap-1.5 text-[7.5px] font-semibold uppercase tracking-[0.14em] text-faint"
            >
              <Volume2 size={10} />
              Escuchar de nuevo
            </button>
          )}
        </div>
      )}

      {phase === "result" && result && (
        <GameResultCard
          result={result}
          onRetry={() => start(mode)}
          onFinish={onFinish}
          finishLabel={finishLabel}
          xpNote={xpNote}
        />
      )}
    </div>
  );
}
