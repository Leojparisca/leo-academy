"use client";

import { motion } from "framer-motion";
import { Hand, Play, Timer, Waves } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import {
  GameMeter,
  GameResultCard,
  type GameResult,
} from "@/components/games/game-ui";
import {
  starsForAccuracy,
  type Hand as DrumHand,
  type RhythmDrill,
} from "@/data/curriculum";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

type Phase = "intro" | "playing" | "result";
type Judge = { id: number; label: string; tone: string };

type Expected = { time: number; hand: DrumHand; judged: boolean };

const DEFAULT_DRILL: RhythmDrill = {
  kind: "rhythm",
  bpm: 76,
  bars: 4,
  label: "Negras alternadas",
  hits: [
    { at: 0, hand: "left" },
    { at: 1, hand: "right" },
    { at: 2, hand: "left" },
    { at: 3, hand: "right" },
  ],
};

export function GroovePadDual({
  drill = DEFAULT_DRILL,
  barsOverride,
  compact = false,
  persist = true,
  finishLabel,
  xpNote,
  onFinish,
}: {
  drill?: RhythmDrill;
  barsOverride?: number;
  compact?: boolean;
  persist?: boolean;
  finishLabel?: string;
  xpNote?: string;
  onFinish?: (result: GameResult) => void;
}) {
  const audio = useAudioEngine();
  const { recordGameResult } = useAcademy();
  const [phase, setPhase] = useState<Phase>("intro");
  const [result, setResult] = useState<GameResult | null>(null);
  const [judge, setJudge] = useState<Judge | null>(null);
  const [combo, setCombo] = useState(0);
  const [bar, setBar] = useState(0);
  const [activeHand, setActiveHand] = useState<DrumHand | null>(null);

  const bars = barsOverride ?? drill.bars ?? 4;
  const spb = 60 / drill.bpm;

  const phaseRef = useRef<Phase>("intro");
  const startRef = useRef(0);
  const eventsRef = useRef<Expected[]>([]);
  const perfectRef = useRef(0);
  const goodRef = useRef(0);
  const missRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const barRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const judgeTimer = useRef<number | null>(null);
  const playheadRef = useRef<HTMLSpanElement | null>(null);
  const finishedRef = useRef(false);

  phaseRef.current = phase;

  // The audio facade changes identity when the engine becomes ready. Unmount
  // cleanup must not depend on it, or starting the first groove (which unlocks
  // the engine) would cancel the paint loop it just scheduled.
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const clearTimers = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (judgeTimer.current) window.clearTimeout(judgeTimer.current);
    frameRef.current = null;
    judgeTimer.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      audioRef.current.releaseAll();
    };
  }, [clearTimers]);

  const showJudge = (label: string, tone: string) => {
    setJudge({ id: Date.now(), label, tone });
    if (judgeTimer.current) window.clearTimeout(judgeTimer.current);
    judgeTimer.current = window.setTimeout(() => setJudge(null), 620);
  };

  const finalize = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    let total = 0;
    for (const event of eventsRef.current) {
      total += 1;
      if (!event.judged) missRef.current += 1;
    }

    const earned = perfectRef.current + goodRef.current * 0.6;
    const accuracy = total ? Math.round((earned / total) * 100) : 0;
    const stars = starsForAccuracy(accuracy);
    const xp = Math.round(accuracy * 0.7 + bestComboRef.current * 3 + 20);
    const next: GameResult = {
      game: "rhythm",
      score: Math.round(earned * 100),
      accuracy,
      stars,
      xp,
      detail: "Groove Pad Dual",
      stats: {
        perfect: perfectRef.current,
        good: goodRef.current,
        miss: missRef.current,
        combo: bestComboRef.current,
      },
    };

    setResult(next);
    setPhase("result");
    setActiveHand(null);
    audio.releaseAll();
    if (persist) {
      void recordGameResult({
        skill: "rhythm",
        accuracy,
        xp,
        detail: "Groove Pad Dual",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, persist]);

  const paint = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const elapsed = audio.now() - startRef.current;
    const total = bars * 4 * spb;

    if (playheadRef.current) {
      const position = ((elapsed / (4 * spb)) % 1) * 100;
      playheadRef.current.style.left = `${Math.min(100, Math.max(0, position))}%`;
    }

    const nextBar = Math.min(bars - 1, Math.max(0, Math.floor(elapsed / (4 * spb))));
    if (nextBar !== barRef.current) {
      barRef.current = nextBar;
      setBar(nextBar);
    }

    if (elapsed >= total + 0.45) {
      finalize();
      return;
    }

    frameRef.current = requestAnimationFrame(paint);
  }, [audio, bars, finalize, spb]);

  const start = useCallback(() => {
    audio.unlock();
    clearTimers();
    finishedRef.current = false;
    perfectRef.current = 0;
    goodRef.current = 0;
    missRef.current = 0;
    comboRef.current = 0;
    bestComboRef.current = 0;
    barRef.current = 0;
    setCombo(0);
    setBar(0);
    setJudge(null);
    setResult(null);

    const startAt = audio.now() + 0.55;
    startRef.current = startAt;
    const events: Expected[] = [];

    for (let index = 0; index < bars; index += 1) {
      for (const hit of drill.hits) {
        events.push({
          time: startAt + (index * 4 + hit.at) * spb,
          hand: hit.hand,
          judged: false,
        });
      }
      for (let beat = 0; beat < 4; beat += 1) {
        audio.playPercussion("click", {
          when: startAt + (index * 4 + beat) * spb,
          accent: beat === 0,
        });
      }
    }

    events.sort((a, b) => a.time - b.time);
    eventsRef.current = events;

    setPhase("playing");
    phaseRef.current = "playing";

    frameRef.current = requestAnimationFrame(paint);
  }, [audio, bars, clearTimers, drill.hits, paint, spb]);

  const tap = (hand: DrumHand) => {
    if (phaseRef.current !== "playing") return;
    audio.unlock();
    audio.playPercussion(hand === "left" ? "kick" : "snare");
    setActiveHand(hand);
    window.setTimeout(() => setActiveHand(null), 110);

    const now = audio.now();
    let best: Expected | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const event of eventsRef.current) {
      if (event.judged) continue;
      const delta = Math.abs(event.time - now);
      if (delta < 0.3 && delta < bestDelta) {
        best = event;
        bestDelta = delta;
      }
    }

    if (!best) {
      missRef.current += 1;
      comboRef.current = 0;
      setCombo(0);
      showJudge("Fuera de tiempo", "#FB7185");
      return;
    }

    best.judged = true;
    if (best.hand !== hand) {
      missRef.current += 1;
      comboRef.current = 0;
      setCombo(0);
      showJudge("Mano equivocada", "#FB7185");
      return;
    }

    const ms = Math.abs(now - best.time) * 1000;
    if (ms < 35) {
      perfectRef.current += 1;
      comboRef.current += 1;
      bestComboRef.current = Math.max(bestComboRef.current, comboRef.current);
      setCombo(comboRef.current);
      showJudge("Perfecto", "#7DE2C3");
    } else if (ms < 80) {
      goodRef.current += 1;
      comboRef.current += 1;
      bestComboRef.current = Math.max(bestComboRef.current, comboRef.current);
      setCombo(comboRef.current);
      showJudge("Bueno", "#38BDF8");
    } else {
      missRef.current += 1;
      comboRef.current = 0;
      setCombo(0);
      showJudge("Fuera de tiempo", "#FB7185");
    }
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key !== "f" && key !== "j") return;
      event.preventDefault();
      tap(key === "f" ? "left" : "right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const reset = () => {
    clearTimers();
    setPhase("intro");
    setResult(null);
    setJudge(null);
    setCombo(0);
    setBar(0);
  };

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
              <p className="eyebrow text-[7px]">Ritmo · Manos independientes</p>
              <h2 className="mt-1.5 font-display text-[24px] leading-none text-ivory">
                Groove Pad Dual
              </h2>
              <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">
                {drill.label} · {drill.bpm} BPM · {bars} compases de 4/4.
              </p>
            </div>
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] border border-ember/15 bg-ember/[0.05] text-ember">
              <Waves size={15} />
            </span>
          </div>

          <div className="neu-inset relative mt-4 overflow-hidden rounded-[14px] p-2.5">
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map((beat) => (
                <span
                  key={beat}
                  className="rounded-[4px] border border-white/[0.04] bg-white/[0.025] py-1 text-center text-[6.5px] font-semibold uppercase tracking-[0.14em] text-faint"
                >
                  Tiempo {beat + 1}
                </span>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              {(["left", "right"] as DrumHand[]).map((hand) => (
                <div key={hand} className="relative h-4">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.05]" />
                  {drill.hits
                    .filter((hit) => hit.hand === hand)
                    .map((hit, index) => (
                      <span
                        key={`${hand}-${index}`}
                        className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                        style={{
                          left: `calc(${(hit.at / 4) * 100}% - 4px)`,
                          background: hand === "left" ? "#38BDF8" : "#F2B45C",
                          boxShadow:
                            hand === "left"
                              ? "0 0 8px rgba(56,189,248,0.8)"
                              : "0 0 8px rgba(242,180,92,0.8)",
                        }}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Perfecto", value: "< 35 ms", tone: "text-[#7DE2C3]" },
              { label: "Bueno", value: "< 80 ms", tone: "text-glow" },
              { label: "Fuera", value: "> 80 ms", tone: "text-[#FB7185]" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[12px] border border-white/[0.045] bg-white/[0.012] px-2 py-2"
              >
                <p className={cn("text-[7px] font-bold uppercase tracking-[0.13em]", item.tone)}>
                  {item.label}
                </p>
                <p className="mt-0.5 text-[7px] text-faint">{item.value}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={start}
            className="neu-button neu-button--primary mt-4 w-full rounded-[14px] py-3 text-[11px]"
          >
            <Play size={13} fill="currentColor" />
            Empezar groove
          </button>
        </div>
      )}

      {phase === "playing" && (
        <div className={cn("game-stage relative overflow-hidden rounded-[26px] p-3.5", compact && "p-3")}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              <Timer size={10} className="text-ember" />
              Compás {bar + 1}/{bars}
            </span>
            <span className="text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              {drill.bpm} BPM · {drill.label}
            </span>
          </div>

          <div className="relative mt-3 flex items-center justify-between gap-2">
            <span className="font-display text-[34px] leading-none tabular-nums text-ivory">
              {perfectRef.current + goodRef.current}
            </span>
            <div className="flex items-center gap-1.5">
              {combo > 1 && (
                <motion.span
                  key={combo}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full border border-[#F5C15A]/20 bg-[#F5C15A]/[0.07] px-2 py-0.5 text-[8px] font-bold text-[#F5C15A]"
                >
                  ×{combo}
                </motion.span>
              )}
              <span className="text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
                golpes
              </span>
            </div>
          </div>

          <div className="neu-inset relative mt-3 overflow-hidden rounded-[14px] px-2 py-3">
            <div className="grid grid-cols-4">
              {[0, 1, 2, 3].map((beat) => (
                <span key={beat} className="h-6 border-l border-white/[0.05] first:border-l-0" />
              ))}
            </div>
            <span
              ref={playheadRef}
              aria-hidden
              className="pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-full bg-cyan-200 shadow-[0_0_14px_rgba(186,230,253,0.9)]"
            />
            <div className="pointer-events-none absolute inset-x-2 top-1/2 flex -translate-y-1/2 flex-col gap-2">
              {(["left", "right"] as DrumHand[]).map((hand) => (
                <div key={hand} className="relative h-1.5">
                  {drill.hits
                    .filter((hit) => hit.hand === hand)
                    .map((hit, index) => (
                      <span
                        key={`${hand}-${index}`}
                        className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
                        style={{
                          left: `calc(${(hit.at / 4) * 100}% - 3px)`,
                          background: hand === "left" ? "#38BDF8" : "#F2B45C",
                          opacity: 0.7,
                        }}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-2 gap-2.5">
            {(
              [
                {
                  hand: "left" as DrumHand,
                  title: "Mano izquierda",
                  sub: "Bombo · F",
                  tone: "#38BDF8",
                },
                {
                  hand: "right" as DrumHand,
                  title: "Mano derecha",
                  sub: "Caja · J",
                  tone: "#F2B45C",
                },
              ] as const
            ).map((pad) => (
              <button
                key={pad.hand}
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  tap(pad.hand);
                }}
                aria-label={pad.title}
                className={cn(
                  "groove-pad relative flex min-h-[150px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[24px] border text-center",
                  activeHand === pad.hand && "groove-pad--active",
                )}
                style={{
                  borderColor:
                    activeHand === pad.hand ? `${pad.tone}66` : undefined,
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-8 top-3 h-8 rounded-full blur-xl transition-opacity duration-150"
                  style={{
                    background: pad.tone,
                    opacity: activeHand === pad.hand ? 0.2 : 0.05,
                  }}
                />
                <span
                  className="grid h-10 w-10 place-items-center rounded-full border"
                  style={{
                    borderColor: `${pad.tone}33`,
                    color: pad.tone,
                    background: `${pad.tone}0f`,
                  }}
                >
                  <Hand size={17} />
                </span>
                <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-ivory/90">
                  {pad.title}
                </span>
                <span className="text-[6.5px] uppercase tracking-[0.18em] text-faint">
                  {pad.sub}
                </span>
              </button>
            ))}

            {judge && (
              <motion.span
                key={judge.id}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: -18, scale: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-[#040b13]/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur"
                style={{ color: judge.tone }}
              >
                {judge.label}
              </motion.span>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <GameMeter
              value={
                eventsRef.current.length
                  ? ((perfectRef.current + goodRef.current) /
                      eventsRef.current.length) *
                    100
                  : 0
              }
              tone="#F2B45C"
            />
            <span className="flex-none text-[7px] font-semibold uppercase tracking-[0.13em] text-faint">
              Sigue el pulso
            </span>
          </div>
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
