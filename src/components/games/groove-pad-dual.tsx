"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Flame, Hand, Play, Timer, Waves } from "lucide-react";
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

/** Generous mobile-friendly window: ±140 ms around every expected hit. */
const TOLERANCE = 0.14;
/** Inside this window the hit feels locked-in and earns the perfect flash. */
const PERFECT = 0.045;
const FIRE_COMBO = 10;

const DEFAULT_DRILL: RhythmDrill = {
  kind: "rhythm",
  bpm: 88,
  bars: 4,
  label: "Negras alternadas",
  hits: [
    { at: 0, hand: "left" },
    { at: 1, hand: "right" },
    { at: 2, hand: "left" },
    { at: 3, hand: "right" },
  ],
};

/** Combo tiers: 1x · 2x · 3x · ¡Fuego! */
function multiplierFor(combo: number) {
  if (combo >= FIRE_COMBO) return 4;
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

function vibrate(ms: number) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  navigator.vibrate(ms);
}

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
  const [multiplier, setMultiplier] = useState(1);
  const [flash, setFlash] = useState<{ id: number; fire: boolean } | null>(null);
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
  const bonusRef = useRef(0);
  const barRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const judgeTimer = useRef<number | null>(null);
  const loopTimers = useRef<number[]>([]);
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
    loopTimers.current.forEach((timer) => window.clearTimeout(timer));
    loopTimers.current = [];
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
    const xp = Math.round(
      accuracy * 0.7 + bestComboRef.current * 3 + bonusRef.current * 0.25 + 20,
    );
    const next: GameResult = {
      game: "rhythm",
      score: Math.round(earned * 100) + bonusRef.current,
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

  /**
   * Schedules one bar of the backing groove: soft hi-hat eighths, warm kick,
   * defined snare and a piano anchor on the downbeat. Bars are scheduled as
   * they arrive, so leaving the game never leaves drums ringing.
   */
  const scheduleBar = useCallback(
    (index: number, barStart: number) => {
      for (let step = 0; step < 8; step += 1) {
        audio.playPercussion("hat", {
          when: barStart + (step * spb) / 2,
          accent: step % 2 === 0,
        });
      }
      audio.playPercussion("kick", { when: barStart, accent: true });
      audio.playPercussion("kick", { when: barStart + 2 * spb });
      audio.playPercussion("kick", { when: barStart + 3.5 * spb });
      audio.playPercussion("snare", { when: barStart + spb });
      audio.playPercussion("snare", { when: barStart + 3 * spb });

      const anchorDelay = Math.max(0, (barStart - audio.now()) * 1000);
      loopTimers.current.push(
        window.setTimeout(() => {
          audioRef.current.playNote(index % 2 === 0 ? 48 : 55, 1.15, 0.32);
        }, anchorDelay),
      );
    },
    [audio, spb],
  );

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
      scheduleBar(nextBar, startRef.current + nextBar * 4 * spb);
    }

    if (elapsed >= total + 0.45) {
      finalize();
      return;
    }

    frameRef.current = requestAnimationFrame(paint);
  }, [audio, bars, finalize, scheduleBar, spb]);

  const start = useCallback(() => {
    audio.unlock();
    clearTimers();
    finishedRef.current = false;
    perfectRef.current = 0;
    goodRef.current = 0;
    missRef.current = 0;
    comboRef.current = 0;
    bestComboRef.current = 0;
    bonusRef.current = 0;
    barRef.current = 0;
    setCombo(0);
    setMultiplier(1);
    setFlash(null);
    setBar(0);
    setJudge(null);
    setResult(null);

    const startAt = audio.now() + 0.75;
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
    }

    events.sort((a, b) => a.time - b.time);
    eventsRef.current = events;

    // Only the first bar goes out now; `paint` schedules the rest as the
    // playhead reaches them, so stopping early silences the drums quickly.
    scheduleBar(0, startAt);

    setPhase("playing");
    phaseRef.current = "playing";

    frameRef.current = requestAnimationFrame(paint);
  }, [audio, bars, clearTimers, drill.hits, paint, scheduleBar, spb]);

  const bumpCombo = () => {
    comboRef.current += 1;
    bestComboRef.current = Math.max(bestComboRef.current, comboRef.current);
    const next = multiplierFor(comboRef.current);
    if (next > 1) bonusRef.current += (next - 1) * 25;
    setCombo(comboRef.current);
    setMultiplier(next);
    setFlash({ id: Date.now(), fire: next >= 4 });
  };

  const dropCombo = () => {
    comboRef.current = 0;
    setCombo(0);
    setMultiplier(1);
  };

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
      if (delta <= TOLERANCE && delta < bestDelta) {
        best = event;
        bestDelta = delta;
      }
    }

    if (!best) {
      missRef.current += 1;
      dropCombo();
      vibrate(12);
      showJudge("Fuera de tiempo", "#FB7185");
      return;
    }

    best.judged = true;
    if (best.hand !== hand) {
      missRef.current += 1;
      dropCombo();
      vibrate(12);
      showJudge("Mano equivocada", "#FB7185");
      return;
    }

    if (bestDelta < PERFECT) {
      perfectRef.current += 1;
      bumpCombo();
      vibrate(25);
      showJudge("¡Perfecto!", "#7DE2C3");
    } else {
      goodRef.current += 1;
      bumpCombo();
      showJudge("¡A tiempo!", "#38BDF8");
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
    setMultiplier(1);
    setFlash(null);
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
              { label: "Perfecto", value: "< 45 ms", tone: "text-[#7DE2C3]" },
              { label: "A tiempo", value: "± 140 ms", tone: "text-glow" },
              { label: "Fuera", value: "> 140 ms", tone: "text-[#FB7185]" },
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

          <div className="mt-2 flex items-start gap-2 rounded-[12px] border border-cyan-300/15 bg-cyan-300/[0.04] px-2.5 py-2">
            <Flame
              size={11}
              className="mt-0.5 flex-none text-[#F5C15A]"
              fill="currentColor"
            />
            <p className="text-[7.5px] leading-relaxed text-muted">
              Loop de batería a {drill.bpm} BPM. Combo ×2 a los 3 golpes, ×3 a
              los 6 y <span className="text-[#FFE7A8]">¡Fuego!</span> a los 10.
            </p>
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
          <AnimatePresence>
            {flash && (
              <motion.span
                key={flash.id}
                aria-hidden
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                transition={{ duration: flash.fire ? 0.55 : 0.35, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 z-10 rounded-[26px]"
                style={{
                  boxShadow: flash.fire
                    ? "inset 0 0 46px rgba(56,189,248,0.8), inset 0 0 0 2px rgba(245,193,90,0.55)"
                    : "inset 0 0 30px rgba(56,189,248,0.5), inset 0 0 0 1.5px rgba(56,189,248,0.45)",
                }}
              />
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              <Timer size={10} className="text-ember" />
              Compás {bar + 1}/{bars}
            </span>
            <span className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              <span className="flex items-end gap-[2px]" aria-hidden>
                {[0, 1, 2].map((index) => (
                  <motion.span
                    key={index}
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: index * 0.12,
                      ease: "easeInOut",
                    }}
                    className="block w-[2px] rounded-full bg-cyan-300"
                    style={{ height: 4 + index * 3 }}
                  />
                ))}
              </span>
              Loop · {drill.bpm} BPM
            </span>
          </div>

          <div className="relative mt-3 flex items-center justify-between gap-2">
            <span className="font-display text-[34px] leading-none tabular-nums text-ivory">
              {perfectRef.current + goodRef.current}
            </span>
            <div className="flex items-center gap-1.5">
              {combo > 0 && (
                <span className="text-[7px] font-semibold uppercase tracking-[0.12em] text-faint">
                  racha {combo}
                </span>
              )}
              <AnimatePresence mode="popLayout">
                {combo > 1 && (
                  <motion.span
                    key={multiplier}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-bold",
                      multiplier >= 4
                        ? "border-[#F5C15A]/45 bg-[#F5C15A]/[0.14] text-[#FFE7A8] shadow-[0_0_18px_rgba(245,193,90,0.35)]"
                        : multiplier >= 3
                          ? "border-cyan-300/35 bg-cyan-300/[0.1] text-cyan-100"
                          : "border-[#F5C15A]/20 bg-[#F5C15A]/[0.07] text-[#F5C15A]",
                    )}
                  >
                    {multiplier >= 4 && <Flame size={9} fill="currentColor" />}
                    {multiplier >= 4 ? "¡FUEGO!" : `×${multiplier}`}
                  </motion.span>
                )}
              </AnimatePresence>
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
