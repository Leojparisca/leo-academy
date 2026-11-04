"use client";

import { motion } from "framer-motion";
import {
  AudioLines,
  Hand,
  Lightbulb,
  Play,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import {
  GameMeter,
  GameResultCard,
  type GameResult,
} from "@/components/games/game-ui";
import { NotePicker } from "@/components/games/note-picker";
import {
  CHORD_QUALITIES,
  EMOTION_META,
  starsForAccuracy,
  type ChordQuality,
  type HarmonyDrill,
} from "@/data/curriculum";
import { LETTERS, chordMidis } from "@/lib/harmony";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

type Phase = "intro" | "question" | "feedback" | "result";

type Challenge = {
  id: number;
  mode: "build" | "color" | "progression";
  rootPc: number;
  quality: ChordQuality;
  targetPcs: number[];
};

const DEFAULT_DRILL: HarmonyDrill = {
  kind: "harmony",
  mode: "build",
  qualities: ["maj", "min"],
  roots: [0, 2, 5, 7, 9],
  rounds: 5,
  label: "Mayor y menor",
};

const EMOTIONS = ["alegre", "melancólico", "tenso", "suspendido"] as const;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function chordName(rootPc: number, quality: ChordQuality) {
  return `${LETTERS[rootPc]} ${CHORD_QUALITIES[quality].label.toLowerCase()}`;
}

function buildChallenge(
  drill: HarmonyDrill,
  id: number,
): Challenge {
  const quality = pick(drill.qualities);
  const rootPc = pick(drill.roots);
  return {
    id,
    mode: drill.mode === "color" ? "color" : "build",
    rootPc,
    quality,
    targetPcs: CHORD_QUALITIES[quality].intervals.map((interval) =>
      (rootPc + interval) % 12,
    ),
  };
}

export function ChordArchitect({
  drill = DEFAULT_DRILL,
  roundsOverride,
  compact = false,
  persist = true,
  finishLabel,
  xpNote,
  onFinish,
}: {
  drill?: HarmonyDrill;
  roundsOverride?: number;
  compact?: boolean;
  persist?: boolean;
  finishLabel?: string;
  xpNote?: string;
  onFinish?: (result: GameResult) => void;
}) {
  const audio = useAudioEngine();
  const { recordGameResult } = useAcademy();
  const isProgression =
    drill.mode === "progression" && Boolean(drill.progression?.length);
  const progression = drill.progression ?? [];
  const rounds = isProgression ? progression.length : roundsOverride ?? drill.rounds ?? 6;

  const [phase, setPhase] = useState<Phase>("intro");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [pickedEmotion, setPickedEmotion] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [fingering, setFingering] = useState(false);
  const [doneSlots, setDoneSlots] = useState<number[]>([]);

  const counter = useRef(0);
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
  useEffect(() => () => audio.releaseAll(), [audio]);

  const playChordFor = useCallback(
    (rootPc: number, quality: ChordQuality) => {
      audio.unlock();
      audio.playChord(chordMidis(rootPc, CHORD_QUALITIES[quality].intervals, 4), 1.6, 0.72);
    },
    [audio],
  );

  const playProgression = useCallback(() => {
    audio.unlock();
    clearPlayTimers();
    progression.forEach((step, slot) => {
      const timer = window.setTimeout(() => {
        audio.playChord(
          chordMidis(step.rootPc, CHORD_QUALITIES[step.quality].intervals, 4),
          0.95,
          0.68,
        );
      }, slot * 620);
      playTimers.current.push(timer);
    });
  }, [audio, clearPlayTimers, progression]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const accuracy = Math.round((correctRef.current / rounds) * 100);
    const stars = starsForAccuracy(accuracy);
    const xp = Math.round(accuracy * 0.8 + bestStreakRef.current * 3 + 25);
    const detail = isProgression
      ? "I–V–vi–IV con séptimas"
      : drill.mode === "color"
        ? "Color emocional"
        : "Arquitecto de acordes";
    const next: GameResult = {
      game: "harmony",
      score: correctRef.current * 120 + bestStreakRef.current * 20,
      accuracy,
      stars,
      xp,
      detail,
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
        skill: "harmony",
        accuracy,
        xp,
        detail,
      });
    }
  }, [audio, drill.mode, isProgression, persist, recordGameResult, rounds]);

  const makeChallenge = (targetIndex: number): Challenge => {
    if (isProgression) {
      const step = progression[targetIndex];
      return {
        id: targetIndex,
        mode: "progression",
        rootPc: step.rootPc,
        quality: step.quality,
        targetPcs: CHORD_QUALITIES[step.quality].intervals.map((interval) =>
          (step.rootPc + interval) % 12,
        ),
      };
    }
    counter.current += 1;
    return buildChallenge(drill, counter.current);
  };

  const start = () => {
    audio.unlock();
    clearPlayTimers();
    finishedRef.current = false;
    correctRef.current = 0;
    streakRef.current = 0;
    bestStreakRef.current = 0;
    counter.current = 0;
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setIndex(0);
    setSelected([]);
    setPickedEmotion(null);
    setIsCorrect(false);
    setDoneSlots([]);
    setResult(null);
    setShowHint(false);
    const first = makeChallenge(0);
    setChallenge(first);
    setPhase("question");
    if (first.mode === "color") {
      const timer = window.setTimeout(
        () => playChordFor(first.rootPc, first.quality),
        420,
      );
      playTimers.current.push(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const register = (right: boolean) => {
    setIsCorrect(right);
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
    setPhase("feedback");
    if (challenge) playChordFor(challenge.rootPc, challenge.quality);
  };

  const seal = () => {
    if (!challenge || phase !== "question") return;
    const target = [...challenge.targetPcs].sort((a, b) => a - b);
    const chosen = [...new Set(selected)].sort((a, b) => a - b);
    const right =
      target.length === chosen.length &&
      target.every((pc, position) => pc === chosen[position]);
    register(right);
  };

  const answerEmotion = (emotion: (typeof EMOTIONS)[number]) => {
    if (!challenge || phase !== "question") return;
    setPickedEmotion(emotion);
    register(CHORD_QUALITIES[challenge.quality].emotion === emotion);
  };

  const next = () => {
    if (!challenge) return;
    if (index + 1 >= rounds) {
      if (isProgression) {
        playProgression();
        window.setTimeout(() => finish(), 2600);
        return;
      }
      finish();
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setSelected([]);
    setPickedEmotion(null);
    setIsCorrect(false);
    setShowHint(false);
    if (isProgression) setDoneSlots((previous) => [...previous, index]);
    const upcoming = makeChallenge(nextIndex);
    setChallenge(upcoming);
    setPhase("question");
    if (upcoming.mode === "color") {
      const timer = window.setTimeout(
        () => playChordFor(upcoming.rootPc, upcoming.quality),
        420,
      );
      playTimers.current.push(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const togglePc = (pc: number) => {
    setSelected((previous) => {
      if (previous.includes(pc)) return previous.filter((item) => item !== pc);
      if (previous.length >= 4) return previous;
      return [...previous, pc];
    });
  };

  const meta = challenge ? CHORD_QUALITIES[challenge.quality] : null;
  const accent = meta ? EMOTION_META[meta.emotion].color : "#9DB5FF";

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
              <p className="eyebrow text-[7px]">Armonía · Construir y sentir</p>
              <h2 className="mt-1.5 font-display text-[24px] leading-none text-ivory">
                Arquitecto de Acordes
              </h2>
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">
                {drill.mode === "progression"
                  ? "Construye I–V–vi–IV con séptimas, un acorde por vez."
                  : drill.mode === "color"
                    ? "Escucha el acorde y reconoce su color emocional."
                    : "Cuenta semitonos desde la raíz y construye la forma."}
              </p>
            </div>
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-[#9DB5FF]/15 bg-[#9DB5FF]/[0.05] text-[#9DB5FF]">
              <AudioLines size={15} />
            </span>
          </div>

          <div className="neu-inset relative mt-4 overflow-hidden rounded-[16px] p-3">
            <div className="grid grid-cols-4 gap-1.5">
              {drill.qualities.map((quality) => (
                <div
                  key={quality}
                  className="rounded-[9px] border border-white/[0.045] bg-white/[0.02] px-1.5 py-2 text-center"
                >
                  <span className="block text-[13px]" style={{ color: EMOTION_META[CHORD_QUALITIES[quality].emotion].color }}>
                    {CHORD_QUALITIES[quality].glyph}
                  </span>
                  <span className="mt-1 block text-[6px] font-semibold uppercase tracking-[0.1em] text-faint">
                    {CHORD_QUALITIES[quality].short}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
              <span>{rounds} desafíos</span>
              <span>{drill.label}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={start}
            className="neu-button neu-button--primary mt-4 w-full rounded-[14px] py-3 text-[11px]"
          >
            <Play size={13} fill="currentColor" />
            Empezar a construir
          </button>
        </div>
      )}

      {(phase === "question" || phase === "feedback") && challenge && meta && (
        <div className="game-stage relative overflow-hidden rounded-[26px] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              <Sparkles size={10} style={{ color: accent }} />
              {isProgression ? "Enlace" : "Reto"} {index + 1}/{rounds}
            </span>
            <span className="text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
              {streak > 1 ? `racha ×${streak}` : `${correct} aciertos`}
            </span>
          </div>

          {isProgression ? (
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {progression.map((slot, slotIndex) => {
                const done = doneSlots.includes(slotIndex) || slotIndex < index;
                const current = slotIndex === index;
                return (
                  <div
                    key={slot.roman}
                    className={cn(
                      "rounded-[10px] border px-1 py-2 text-center transition-all duration-300",
                      current
                        ? "border-[#9DB5FF]/30 bg-[#9DB5FF]/[0.08]"
                        : done
                          ? "border-[#F5C15A]/20 bg-[#F5C15A]/[0.05]"
                          : "border-white/[0.045] bg-white/[0.012]",
                    )}
                  >
                    <span
                      className={cn(
                        "block font-display text-[13px]",
                        current
                          ? "text-[#C7D5FF]"
                          : done
                            ? "text-[#F5C15A]"
                            : "text-faint/60",
                      )}
                    >
                      {slot.roman}
                    </span>
                    <span className="mt-0.5 block text-[6px] uppercase tracking-[0.08em] text-faint">
                      {LETTERS[slot.rootPc]}
                      {CHORD_QUALITIES[slot.quality].short}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <span className="font-display text-[26px] leading-none tabular-nums text-ivory">
                  {correct}
                </span>
                <span className="ml-1.5 text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
                  aciertos
                </span>
              </div>
              <div className="w-24">
                <GameMeter value={(index / rounds) * 100} tone={accent} />
              </div>
            </div>
          )}

          <div className="mt-3 rounded-[16px] border border-white/[0.05] bg-white/[0.015] px-3.5 py-3">
            {challenge.mode === "color" ? (
              <>
                <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-faint">
                  ¿Qué color tiene este acorde?
                </p>
                <div className="mt-2 flex items-center gap-2.5">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-full border text-[20px]"
                    style={{
                      borderColor: `${accent}44`,
                      background: `${accent}12`,
                      color: accent,
                    }}
                  >
                    {meta.glyph}
                  </span>
                  <div>
                    <p className="font-display text-[19px] leading-none text-ivory">
                      Escucha sin mirar
                    </p>
                    <p className="mt-1 text-[8px] text-faint">
                      {phase === "feedback"
                        ? `${chordName(challenge.rootPc, challenge.quality)} · ${meta.formula}`
                        : "La emoción llega antes que el nombre."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => playChordFor(challenge.rootPc, challenge.quality)}
                  className="neu-button mt-2.5 min-h-0 rounded-full px-3 py-1.5 text-[8px]"
                >
                  <Volume2 size={10} className="text-glow" />
                  Escuchar acorde
                </button>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-faint">
                      {isProgression
                        ? `Construye ${progression[index].roman}`
                        : "Construye el acorde"}
                    </p>
                    <p className="mt-1 font-display text-[22px] leading-none text-ivory">
                      {LETTERS[challenge.rootPc]}{" "}
                      <em className="font-normal italic" style={{ color: accent }}>
                        {meta.label.toLowerCase()}
                      </em>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHint((value) => !value)}
                    aria-pressed={showHint}
                    className={cn(
                      "grid h-8 w-8 flex-none place-items-center rounded-[10px] border transition-colors",
                      showHint
                        ? "border-[#F5C15A]/25 bg-[#F5C15A]/[0.08] text-[#F5C15A]"
                        : "border-white/[0.06] bg-white/[0.02] text-faint",
                    )}
                    aria-label="Mostrar fórmula en semitonos"
                  >
                    <Lightbulb size={13} />
                  </button>
                </div>

                {showHint && (
                  <div className="mt-2.5">
                    <SemitoneRuler
                      rootPc={challenge.rootPc}
                      intervals={meta.intervals}
                    />
                    <p className="mt-1 text-center text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
                      Desde {LETTERS[challenge.rootPc]} · {meta.formula}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
                    Digitación
                  </span>
                  <button
                    type="button"
                    onClick={() => setFingering((value) => !value)}
                    aria-pressed={fingering}
                    aria-label="Modo Molde / Digitación"
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] transition-colors",
                      fingering
                        ? "border-cyan-300/30 bg-cyan-300/[0.07] text-glow"
                        : "border-white/[0.06] bg-black/20 text-faint hover:text-muted",
                    )}
                  >
                    <Hand size={10} />
                    Modo Molde 1·3·5
                  </button>
                </div>

                <NotePicker
                  selected={selected}
                  onToggle={togglePc}
                  disabled={phase === "feedback"}
                  fingering={fingering}
                  reveal={
                    phase === "feedback" && !isCorrect
                      ? challenge.targetPcs
                      : undefined
                  }
                />

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {selected.length === 0 ? (
                    <span className="text-[8px] text-faint">
                      Toca las notas del acorde en el teclado.
                    </span>
                  ) : (
                    selected
                      .slice()
                      .sort((a, b) => a - b)
                      .map((pc) => (
                        <span
                          key={pc}
                          className="inline-flex items-center gap-1 rounded-full border border-[#9DB5FF]/20 bg-[#9DB5FF]/[0.07] px-2 py-0.5 text-[7.5px] font-semibold text-[#C7D5FF]"
                        >
                          {LETTERS[pc]}
                          <button
                            type="button"
                            onClick={() => togglePc(pc)}
                            className="text-faint"
                            aria-label={`Quitar ${LETTERS[pc]}`}
                          >
                            <X size={8} />
                          </button>
                        </span>
                      ))
                  )}
                  <button
                    type="button"
                    onClick={seal}
                    disabled={
                      phase !== "question" ||
                      selected.length < meta.intervals.length
                    }
                    className="neu-button neu-button--primary ml-auto min-h-0 rounded-full px-3.5 py-1.5 text-[8.5px]"
                  >
                    Sellar acorde
                  </button>
                </div>
              </>
            )}
          </div>

          {challenge.mode === "color" && phase === "question" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {EMOTIONS.map((emotion) => {
                const item = EMOTION_META[emotion];
                return (
                  <button
                    key={emotion}
                    type="button"
                    onClick={() => answerEmotion(emotion)}
                    className="choice-key flex items-center gap-2 rounded-[14px] border border-white/[0.055] px-3 py-3 text-left"
                  >
                    <span className="text-[16px]" style={{ color: item.color }}>
                      {item.glyph}
                    </span>
                    <span>
                      <span className="block text-[10px] font-semibold text-ivory/90">
                        {item.label}
                      </span>
                      <span className="block text-[6.5px] text-faint">
                        {item.copy}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {phase === "feedback" && (
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
                  {isCorrect ? "¡Forma exacta!" : "Esa forma no era"}
                </span>
                <span className="ml-auto text-[8px] font-semibold uppercase tracking-[0.14em] text-faint">
                  {meta.formula}
                </span>
              </div>
              <p className="mt-1 text-[9px] leading-relaxed text-muted">
                {chordName(challenge.rootPc, challenge.quality)}: {meta.label.toLowerCase()},{" "}
                {meta.emotion}. {meta.formula} semitonos desde {LETTERS[challenge.rootPc]}.
                {challenge.mode === "color"
                  ? ` Elegiste ${pickedEmotion ?? "nada"}; el color era ${meta.emotion}.`
                  : ""}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => playChordFor(challenge.rootPc, challenge.quality)}
                  className="neu-button min-h-0 rounded-[11px] py-2 text-[8.5px]"
                >
                  <Volume2 size={10} />
                  Escuchar
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="neu-button neu-button--primary min-h-0 rounded-[11px] py-2 text-[8.5px]"
                >
                  {index + 1 >= rounds ? "Ver resultado" : "Siguiente"}
                </button>
              </div>
            </motion.div>
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

function SemitoneRuler({
  rootPc,
  intervals,
}: {
  rootPc: number;
  intervals: number[];
}) {
  return (
    <div className="grid grid-cols-12 gap-[2px]" aria-hidden>
      {Array.from({ length: 12 }, (_, step) => {
        const active = intervals.includes(step);
        return (
          <span
            key={step}
            className={cn(
              "rounded-[3px] border py-1 text-center text-[5.5px] font-semibold",
              active
                ? "border-[#F5C15A]/30 bg-[#F5C15A]/[0.12] text-[#F5C15A]"
                : "border-white/[0.035] bg-white/[0.012] text-faint/50",
            )}
          >
            {step}
          </span>
        );
      })}
    </div>
  );
}
