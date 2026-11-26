"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Hand, Headphones, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { starsForAccuracy, type RhythmDrill } from "@/data/curriculum";
import {
  CALIBRATION_CLICKS,
  readStoredRhythmCalibration,
  rhythmCompensation,
  useRhythmCalibration,
} from "@/lib/use-rhythm-calibration";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

const BARS = 4;
/**
 * Asymmetric window: the residual bias after calibration is still late on
 * mobile and Bluetooth, so the late side keeps more margin than the early one.
 */
const EARLY_WINDOW = 0.11;
const LATE_WINDOW = 0.19;

type Phase = "idle" | "countin" | "listen" | "play";
type ExpectedHit = { time: number; judged: boolean };

type Feedback = { id: number; label: string; tone: "ok" | "soft" } | null;

/**
 * "Escucha y repite": the app plays one bar, the student answers it.
 * Four achieved bars fill the four progress circles and seal the lesson.
 */
export function RhythmCallResponse({
  drill,
  onComplete,
}: {
  drill: RhythmDrill;
  onComplete: (stars: 1 | 2 | 3, accuracy: number) => void;
}) {
  const audio = useAudioEngine();
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const calibration = useRhythmCalibration({ bpm: drill.bpm });
  const calibrationRef = useRef(calibration);
  calibrationRef.current = calibration;

  const compensation = useMemo(
    () => rhythmCompensation(calibration.stored, calibration.latency),
    [calibration.stored, calibration.latency],
  );
  const compensationRef = useRef(compensation);
  compensationRef.current = compensation;

  const practiceRef = useRef(calibration.practiceMode);
  practiceRef.current = calibration.practiceMode;

  const spb = 60 / drill.bpm;

  const barHits = useMemo(() => {
    const inside = drill.hits
      .filter((hit) => hit.at >= 0 && hit.at < 4)
      .sort((a, b) => a.at - b.at);
    return inside.length
      ? inside
      : ([
          { at: 0, hand: "left" },
          { at: 1, hand: "right" },
          { at: 2, hand: "left" },
          { at: 3, hand: "right" },
        ] as RhythmDrill["hits"]);
  }, [drill.hits]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [bar, setBar] = useState(0);
  const [lit, setLit] = useState<boolean[]>([false, false, false, false]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [beat, setBeat] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [tapFlash, setTapFlash] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const phaseRef = useRef<Phase>("idle");
  const timers = useRef<number[]>([]);
  const feedbackTimer = useRef<number | null>(null);
  const expectedRef = useRef<ExpectedHit[]>([]);
  const qualityRef = useRef(0);
  const accuraciesRef = useRef<number[]>([]);
  const completedRef = useRef(false);
  const runBarRef = useRef<(index: number) => void>(() => undefined);
  const finishBarRef = useRef<(index: number) => void>(() => undefined);
  const tapRef = useRef<() => void>(() => undefined);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  const showFeedback = (label: string, tone: "ok" | "soft" = "ok") => {
    setFeedback({ id: Date.now(), label, tone });
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 780);
  };

  const finishBar = (index: number) => {
    if (completedRef.current) return;

    // Practice mode: no grade, no retry loop. The bar simply moves on so the
    // student keeps the pulse without being judged by a device we could not
    // measure.
    if (practiceRef.current) {
      setLit((previous) => {
        const next = [...previous];
        next[index] = true;
        return next;
      });
      if (index === BARS - 1) {
        completedRef.current = true;
        clearTimers();
        setPhase("idle");
        phaseRef.current = "idle";
        showFeedback("Práctica completada · sin nota", "soft");
        return;
      }
      showFeedback("Sigue el pulso", "soft");
      after(900, () => runBarRef.current(index + 1));
      return;
    }

    const expected = expectedRef.current;
    const total = Math.max(1, expected.length);
    const judged = expected.filter((hit) => hit.judged).length;
    const barAccuracy = Math.round(qualityRef.current / total);
    const achieved = judged >= Math.ceil(total * 0.75) && barAccuracy >= 70;

    if (!achieved) {
      showFeedback("Casi. Escucha otra vez.", "soft");
      after(1400, () => runBarRef.current(index));
      return;
    }

    accuraciesRef.current.push(Math.min(100, Math.max(60, barAccuracy)));
    setLit((previous) => {
      const next = [...previous];
      next[index] = true;
      return next;
    });

    if (index === BARS - 1) {
      completedRef.current = true;
      showFeedback("¡Lección completa!", "ok");
      after(0, () => audioRef.current.playNote(72, 0.34, 0.75));
      after(150, () => audioRef.current.playNote(76, 0.4, 0.75));
      after(300, () => audioRef.current.playNote(79, 0.75, 0.75));
      after(1150, () => {
        const values = accuraciesRef.current;
        const final = Math.round(
          values.reduce((sum, value) => sum + value, 0) /
            Math.max(1, values.length),
        );
        onComplete(starsForAccuracy(final), final);
      });
      return;
    }

    showFeedback("¡Compás logrado!", "ok");
    audioRef.current.playNote(76, 0.32, 0.7);
    after(1200, () => runBarRef.current(index + 1));
  };

  const runBar = (index: number) => {
    clearTimers();
    setBar(index);
    setCountdown(null);
    setFeedback(null);
    setPhase("countin");
    phaseRef.current = "countin";

    const origin = audioRef.current.now();
    const startAt = origin + 0.32;
    /** Milliseconds from "now" to an audio-clock position. */
    const at = (seconds: number) =>
      Math.max(0, (startAt + seconds - origin) * 1000);
    const listenStart = startAt + 4 * spb;
    const turnStart = listenStart + 4 * spb;

    // Count-in: 1 · 2 · 3 · 4 with a visible central pulse.
    for (let count = 0; count < 4; count += 1) {
      audioRef.current.playPercussion("click", {
        when: startAt + count * spb,
        accent: count === 0,
      });
      after(at(count * spb), () => {
        setCountdown(count + 1);
        setBeat(count);
        setPulse((value) => value + 1);
      });
    }

    after(at(4 * spb) - 40, () => {
      setPhase("listen");
      phaseRef.current = "listen";
      setCountdown(null);
    });

    // Phase A — the model bar plus a soft metronome.
    for (let count = 0; count < 4; count += 1) {
      after(at(4 * spb + count * spb), () => {
        setBeat(count);
        setPulse((value) => value + 1);
      });
      audioRef.current.playPercussion("click", {
        when: listenStart + count * spb,
        accent: count === 0,
      });
    }
    barHits.forEach((hit) => {
      audioRef.current.playPercussion(
        hit.hand === "left" ? "kick" : "snare",
        { when: listenStart + hit.at * spb, accent: hit.at === 0 },
      );
    });

    // Phase B — the student answers the same bar.
    expectedRef.current = barHits.map((hit) => ({
      time: turnStart + hit.at * spb,
      judged: false,
    }));
    qualityRef.current = 0;

    after(at(8 * spb) - 30, () => {
      setPhase("play");
      phaseRef.current = "play";
    });

    for (let count = 0; count < 4; count += 1) {
      after(at(8 * spb + count * spb), () => {
        setBeat(count);
        setPulse((value) => value + 1);
      });
      audioRef.current.playPercussion("click", {
        when: turnStart + count * spb,
      });
    }

    after(at(12 * spb + 0.42), () => finishBarRef.current(index));
  };

  const tap = () => {
    if (phaseRef.current !== "play" || completedRef.current) return;
    audioRef.current.unlock();
    audioRef.current.playPercussion("woodblock");
    setTapFlash((value) => value + 1);

    if (practiceRef.current) {
      showFeedback("Práctica: sigue el pulso", "soft");
      return;
    }

    const now = audioRef.current.now();
    // Remove the device's systematic lateness before judging. The calibrated
    // offset already contains the route latency; the browser's declared value
    // is only used when this device was never calibrated.
    const adjusted = now - compensationRef.current.seconds;
    let best: ExpectedHit | null = null;
    let bestDelta = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const hit of expectedRef.current) {
      if (hit.judged) continue;
      const delta = adjusted - hit.time;
      if (delta < -EARLY_WINDOW || delta > LATE_WINDOW) continue;
      const distance = Math.abs(delta);
      if (distance < bestDistance) {
        best = hit;
        bestDelta = delta;
        bestDistance = distance;
      }
    }

    if (!best) return;
    best.judged = true;
    const window = bestDelta < 0 ? EARLY_WINDOW : LATE_WINDOW;
    qualityRef.current += 100 - Math.min(1, bestDistance / window) * 30;

    showFeedback(
      bestDistance < 0.06
        ? "¡Perfecto!"
        : bestDistance < 0.12
          ? "¡A tiempo!"
          : "¡Genial!",
      "ok",
    );
  };

  const start = () => {
    if (!audioRef.current.unlock()) {
      showFeedback("Tu navegador no permite audio aquí.", "soft");
      return;
    }
    clearTimers();
    completedRef.current = false;
    accuraciesRef.current = [];
    qualityRef.current = 0;
    expectedRef.current = [];
    // Re-read the device offset: another tab may have calibrated meanwhile.
    compensationRef.current = rhythmCompensation(
      readStoredRhythmCalibration(),
      audioRef.current.getLatency(),
    );
    setLit([false, false, false, false]);
    setBar(0);
    setFeedback(null);
    runBarRef.current(0);
  };

  runBarRef.current = runBar;
  finishBarRef.current = finishBar;
  tapRef.current = tap;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== "Space" && event.key !== "Enter") return;
      // A focused button keeps its native activation (calibrate, start,
      // cancel). Only the two pads are driven by this shortcut.
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (button) {
        const label = button.getAttribute("aria-label") ?? "";
        const isPad =
          label === "Tocar el ritmo" || label === "Tocar el clic de calibración";
        if (!isPad) return;
      }
      event.preventDefault();
      const current = calibrationRef.current;
      if (current.status === "listening") {
        current.tap();
        return;
      }
      tapRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
      audioRef.current.releaseAll();
    };
  }, [clearTimers]);

  const litCount = lit.filter(Boolean).length;
  const listening = phase === "listen";
  const yourTurn = phase === "play";

  return (
    <div className="space-y-3.5">
      <div className="rounded-[16px] border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3">
        <p className="text-[13px] font-semibold leading-snug text-cyan-50">
          🎧 Escucha el ritmo y repítelo tocando el pad.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {lit.map((on, index) => (
            <span
              key={index}
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full border text-[10px] font-bold transition-all duration-300",
                on
                  ? "border-cyan-300/80 bg-cyan-300/20 text-cyan-100 shadow-[0_0_16px_rgba(56,189,248,0.45)]"
                  : index === bar && phase !== "idle"
                    ? "border-sky-400/60 bg-sky-400/[0.08] text-sky-300"
                    : "border-white/10 bg-white/[0.03] text-slate-500",
              )}
              aria-label={`Compás ${index + 1}${on ? " logrado" : " pendiente"}`}
            >
              {on ? <Check size={13} strokeWidth={3} /> : index + 1}
            </span>
          ))}
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {litCount} / {BARS} compases
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 p-4 backdrop-blur-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl"
        />

        <div className="relative flex flex-col items-center">
          <p
            className={cn(
              "text-center text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors",
              yourTurn
                ? "text-cyan-200"
                : listening
                  ? "text-sky-300"
                  : "text-slate-400",
            )}
          >
            {phase === "idle"
              ? "Preparado"
              : phase === "countin"
                ? "Escucha la cuenta"
                : listening
                  ? "🎧 Escucha el ritmo..."
                  : "🎹 ¡Ahora tú!"}
          </p>

          <div className="relative mt-3 grid h-[118px] w-[118px] place-items-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border border-white/[0.06]"
            />
            <motion.span
              key={pulse}
              initial={{ scale: 0.82, opacity: 0.35 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={cn(
                "grid h-[92px] w-[92px] place-items-center rounded-full border text-[34px] font-bold leading-none",
                yourTurn
                  ? "border-cyan-300/60 bg-cyan-300/[0.12] text-cyan-100 shadow-[0_0_35px_rgba(56,189,248,0.45)]"
                  : listening
                    ? "border-sky-400/40 bg-sky-400/[0.08] text-sky-200 shadow-[0_0_30px_rgba(56,189,248,0.3)]"
                    : "border-white/10 bg-white/[0.04] text-slate-300",
              )}
            >
              {phase === "countin" && countdown ? (
                countdown
              ) : yourTurn ? (
                <Hand size={34} strokeWidth={1.5} />
              ) : (
                <Headphones size={32} strokeWidth={1.5} />
              )}
            </motion.span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  "h-2 w-2 rounded-full transition-all duration-150",
                  index === beat && phase !== "idle"
                    ? "bg-cyan-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]"
                    : "bg-white/12",
                )}
              />
            ))}
          </div>

          <p className="mt-2 text-center text-[10px] text-slate-400">
            {phase === "idle"
              ? "Primero escuchas. Después repites el mismo ritmo."
              : phase === "countin"
                ? "Entra cuando llegue tu turno."
                : listening
                  ? "Solo escucha: el turno llega solo."
                  : "Toca en cada golpe. Tienes margen de sobra."}
          </p>
        </div>
      </div>

      {phase === "idle" ? (
        <div className="space-y-3">
          <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-100">
                  Ajusta tu toque
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
                  {calibration.message}
                </p>
              </div>
              {calibration.stored && calibration.status !== "listening" ? (
                <span className="shrink-0 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-cyan-200">
                  Ajustado
                </span>
              ) : null}
            </div>

            {calibration.status === "listening" ? (
              <>
                <div className="mt-2 flex items-center gap-1.5">
                  {Array.from({ length: CALIBRATION_CLICKS }, (_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1.5 flex-1 rounded-full transition-colors",
                        index < calibration.taps.length
                          ? "bg-cyan-300"
                          : "bg-white/10",
                      )}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    calibration.tap();
                  }}
                  aria-label="Tocar el clic de calibración"
                  className="mt-2 flex min-h-[74px] w-full touch-none select-none flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-cyan-300/50 bg-cyan-300/[0.10] text-[11px] font-bold text-cyan-50 active:scale-[0.99]"
                >
                  <Hand size={18} strokeWidth={1.6} />
                  TOCA CON EL CLIC
                </button>
                <button
                  type="button"
                  onClick={calibration.cancel}
                  className="mt-2 w-full text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={calibration.start}
                  className="min-h-[38px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] text-[10px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.07]"
                >
                  {calibration.stored ? "Volver a calibrar" : "Calibrar (4 toques)"}
                </button>
                {calibration.stored ? (
                  <button
                    type="button"
                    onClick={calibration.reset}
                    className="min-h-[38px] rounded-xl border border-white/[0.06] px-3 text-[9px] font-semibold text-slate-400"
                  >
                    Borrar ajuste
                  </button>
                ) : null}
              </div>
            )}

            {calibration.latency.outputLatency >= 0.1 &&
            !calibration.stored ? (
              <p className="mt-2 text-[9px] leading-snug text-amber-200/90">
                Tu equipo declara un retraso alto. Para las lecciones de ritmo,
                usa audífonos con cable.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={start}
            disabled={calibration.status === "listening"}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.12] text-[13px] font-semibold text-cyan-50 transition-colors hover:bg-cyan-300/[0.18] disabled:opacity-50"
          >
            <Play size={16} fill="currentColor" />
            {calibration.practiceMode ? "Empezar práctica" : "Empezar lección"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            tap();
          }}
          disabled={!yourTurn}
          aria-label="Tocar el ritmo"
          className={cn(
            "relative flex min-h-[132px] w-full touch-none select-none flex-col items-center justify-center gap-1 rounded-3xl border-2 transition-all duration-150",
            yourTurn
              ? "border-cyan-300/60 bg-cyan-300/[0.12] shadow-[0_0_40px_rgba(56,189,248,0.28)] active:scale-[0.985] active:bg-cyan-300/[0.22]"
              : "border-white/[0.06] bg-white/[0.025] opacity-70",
          )}
        >
          <motion.span
            key={tapFlash}
            initial={tapFlash ? { scale: 0.85 } : false}
            animate={{ scale: 1 }}
            transition={{ duration: 0.14 }}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-full border",
              yourTurn
                ? "border-cyan-200/50 bg-cyan-200/10 text-cyan-100"
                : "border-white/10 text-slate-500",
            )}
          >
            <Hand size={21} strokeWidth={1.6} />
          </motion.span>
          <span
            className={cn(
              "text-[13px] font-bold",
              yourTurn ? "text-cyan-50" : "text-slate-500",
            )}
          >
            {yourTurn ? "TOCA AQUÍ" : "Tu turno llega pronto"}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {yourTurn ? "Pad o barra espaciadora" : "Mientras tanto, escucha"}
          </span>
        </button>
      )}

      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.id}
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            className="pointer-events-none fixed inset-x-0 bottom-36 z-[80] flex justify-center px-4"
          >
            <span
              className={cn(
                "rounded-full border px-4 py-2 text-[12px] font-bold shadow-lg backdrop-blur-xl",
                feedback.tone === "ok"
                  ? "border-cyan-300/40 bg-[#0b1c30]/95 text-cyan-100"
                  : "border-amber-300/30 bg-[#1a1408]/95 text-amber-100",
              )}
            >
              {feedback.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-center text-[9px] text-slate-500">
        Compás {Math.min(BARS, bar + 1)} de {BARS} · {drill.bpm} BPM
        {compensation.source === "calibration"
          ? " · Toque ajustado a este equipo"
          : ""}
      </p>
    </div>
  );
}
