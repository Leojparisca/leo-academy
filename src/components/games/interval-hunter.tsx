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
  const [question, setQuestion] = useState<Question | null>(null);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [result, setResult] = useState<GameResult | null>(null);

  const questionCounter = useRef(0);
  const correctRef = useRef(0);
  const streakRef = useRef(0);
  const bestStreakRef = useRef(0);
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

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const accuracy = Math.round((correctRef.current / rounds) * 100);
    const stars = starsForAccuracy(accuracy);
    const xp = Math.round(accuracy * 0.75 + bestStreakRef.current * 4 + 20);
    const next: GameResult = {
      game: "melody",
      score: correctRef.current * 100 + bestStreakRef.current * 15,
      accuracy,
      stars,
      xp,
      detail:
        drill.mode === "read"
          ? "Cazador de lectura"
          : "Cazador de intervalos",
      stats: {
        correct: correctRef.current,
        total: rounds,
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
  }, [audio, drill.mode, persist, recordGameResult, rounds]);

  function submitAnswer(choice: string | null) {
    if (!question || phase !== "question") return;
    const right = choice === question.correct;
    setPicked(choice);
    setIsCorrect(right);
    setPhase("feedback");

    if (right) {
      correctRef.current += 1;
      streakRef.current += 1;
      bestStreakRef.current = Math.max(bestStreakRef.current, streakRef.current);
      setCorrect(correctRef.current);
      setStreak(streakRef.current);
      setBestStreak(bestStreakRef.current);
    } else {
      streakRef.current = 0;
      setStreak(0);
    }

    if (question.mode === "read" || !right) {
      playSequence(question, true);
    }
  }

  const next = () => {
    if (index + 1 >= rounds) {
      finish();
      return;
    }
    const nextIndex = index + 1;
    const nextQuestion = buildQuestion(drill, questionCounter.current + 1);
    questionCounter.current += 1;
    setIndex(nextIndex);
    setQuestion(nextQuestion);
    setPicked(null);
    setTimeLeft(10);
    setPhase("question");
  };

  const start = () => {
    audio.unlock();
    clearPlayTimers();
    finishedRef.current = false;
    correctRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    questionCounter.current = 0;
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setIndex(0);
    setResult(null);
    setPicked(null);
    setTimeLeft(10);
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
            {drill.intervals.map((interval) => (
              <span
                key={interval}
                className="rounded-full border border-white/[0.055] bg-white/[0.02] px-2 py-1 text-[7px] font-semibold text-faint"
              >
                {intervalAnswerLabel(interval)}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={start}
            className="neu-button neu-button--primary mt-4 w-full rounded-[14px] py-3 text-[11px]"
          >
            <Play size={13} fill="currentColor" />
            Empezar a escuchar
          </button>
        </div>
      )}

      {(phase === "question" || phase === "feedback") && question && (
        <div className="game-stage relative overflow-hidden rounded-[26px] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              <Music2 size={10} style={{ color: tone }} />
              Reto {index + 1}/{rounds}
            </span>
            <div className="flex items-center gap-2 text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
              {streak > 1 && (
                <span className="text-[#F5C15A]">racha ×{streak}</span>
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
              {correct}
            </span>
            <span className="text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              aciertos
            </span>
            <div className="ml-auto w-24">
              <GameMeter value={(index / rounds) * 100} tone={tone} />
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
              {question.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => submitAnswer(choice)}
                  className="choice-key rounded-[14px] border border-white/[0.055] px-3 py-3.5 text-[11px] font-semibold text-ivory/90"
                >
                  {choice}
                </button>
              ))}
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
                {index + 1 >= rounds ? "Ver resultado" : "Siguiente reto"}
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
          onRetry={start}
          onFinish={onFinish}
          finishLabel={finishLabel}
          xpNote={xpNote}
        />
      )}
    </div>
  );
}
