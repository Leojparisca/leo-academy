"use client";

import { useEffect, useRef, useState } from "react";
import type { AudioLatency } from "@/lib/audio-engine";
import { useAudioEngine } from "@/lib/use-audio-engine";

/**
 * Guided rhythm calibration.
 *
 * The student taps along with four clicks. The mean of the four deltas is the
 * systematic lateness of this device (audio output + touch input + motor
 * delay); it is stored per device and subtracted from every judged tap. The
 * spread decides whether the measurement is trustworthy: four attempts that
 * never settle degrade the exercise to a practice run without a grade, which
 * is stated on screen.
 *
 * The offset is measured against `AudioContext.currentTime`, the same clock
 * the judge uses, so it already contains the route latency the browser
 * declares. Adding `outputLatency` on top would count it twice; the declared
 * value is used only when this device has never been calibrated.
 */

const STORAGE_KEY = "leo.rhythm.calibration.v1";
export const CALIBRATION_CLICKS = 4;
export const CALIBRATION_ROUNDS = 4;

/** Time before the first click, so the count-in never feels abrupt. */
const LEAD_IN = 0.55;
/** A tap further than this from every pending click is ignored. */
const TAP_WINDOW = 0.5;
/** Maximum standard deviation of the four taps for a round to count. */
const MAX_SPREAD = 0.12;
/** A consistent bias above this is not a lock onto the clicks. */
const MAX_BIAS = 0.45;
const RETRY_DELAY = 800;

export type CalibrationStatus = "idle" | "listening" | "converged" | "failed";

export type StoredRhythmCalibration = {
  /** Seconds the tap arrives after the click. Positive means late. */
  offset: number;
  spread: number;
  taps: number;
  device: string;
  updatedAt: number;
};

export type RhythmCompensation = {
  seconds: number;
  source: "calibration" | "browser" | "none";
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Stable per-device key. Browser version is part of the user agent, so a major
 * update invalidates the old measurement instead of applying a stale offset.
 */
function deviceSignature() {
  if (typeof navigator === "undefined") return "server";
  const navigatorWithHints = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return hashString(
    [
      navigator.userAgent,
      navigator.platform,
      navigatorWithHints.userAgentData?.platform ?? "",
      String(navigator.maxTouchPoints ?? 0),
    ].join("|"),
  );
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Private mode or a blocked origin: calibration simply does not persist.
    return null;
  }
}

export function readStoredRhythmCalibration(): StoredRhythmCalibration | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRhythmCalibration> | null;
    if (!parsed || typeof parsed.offset !== "number") return null;
    if (!Number.isFinite(parsed.offset)) return null;
    const device = deviceSignature();
    if (typeof parsed.device === "string" && parsed.device !== device) {
      return null;
    }
    return {
      offset: clamp(parsed.offset, -0.6, 0.6),
      spread:
        typeof parsed.spread === "number" && Number.isFinite(parsed.spread)
          ? Math.max(0, parsed.spread)
          : 0,
      taps:
        typeof parsed.taps === "number" && Number.isFinite(parsed.taps)
          ? Math.round(parsed.taps)
          : CALIBRATION_CLICKS,
      device,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

function writeStoredRhythmCalibration(value: StoredRhythmCalibration) {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* Storage full or blocked: the session still uses the fresh offset. */
  }
}

export function clearStoredRhythmCalibration() {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* Nothing to clear. */
  }
}

/**
 * Offset to subtract from a tap before comparing it with the expected hit.
 * A calibrated device wins; otherwise the browser's declared route latency is
 * the best estimate available.
 */
export function rhythmCompensation(
  calibration: StoredRhythmCalibration | null,
  latency: AudioLatency,
): RhythmCompensation {
  if (calibration && Number.isFinite(calibration.offset)) {
    return { seconds: calibration.offset, source: "calibration" };
  }
  const browser = Math.max(latency.outputLatency, latency.baseLatency);
  if (browser > 0) return { seconds: browser, source: "browser" };
  return { seconds: 0, source: "none" };
}

export function useRhythmCalibration({ bpm = 90 }: { bpm?: number } = {}) {
  const audio = useAudioEngine();
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const [status, setStatus] = useState<CalibrationStatus>("idle");
  const [round, setRound] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const [offset, setOffset] = useState<number | null>(null);
  const [spread, setSpread] = useState(0);
  const [stored, setStored] = useState<StoredRhythmCalibration | null>(null);

  const statusRef = useRef<CalibrationStatus>("idle");
  statusRef.current = status;

  const expectedRef = useRef<number[]>([]);
  const usedRef = useRef<Set<number>>(new Set());
  const deltasRef = useRef<number[]>([]);
  const roundRef = useRef(0);
  const activeRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setStored(readStoredRhythmCalibration());
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    };
  }, []);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  const fail = () => {
    activeRef.current = false;
    clearTimers();
    setStatus("failed");
    setOffset(null);
    setSpread(0);
    setTaps([]);
    setRound(0);
  };

  const evaluateRound = () => {
    if (!activeRef.current) return;
    activeRef.current = false;

    const values = deltasRef.current.slice();
    const currentRound = roundRef.current;
    if (values.length < CALIBRATION_CLICKS) {
      if (currentRound >= CALIBRATION_ROUNDS) fail();
      else after(RETRY_DELAY, () => scheduleRound(currentRound + 1));
      return;
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length;
    const deviation = Math.sqrt(variance);
    setSpread(deviation);

    const converged = deviation <= MAX_SPREAD && Math.abs(mean) <= MAX_BIAS;
    if (converged) {
      const next: StoredRhythmCalibration = {
        offset: Math.round(mean * 1000) / 1000,
        spread: Math.round(deviation * 1000) / 1000,
        taps: values.length,
        device: deviceSignature(),
        updatedAt: Date.now(),
      };
      writeStoredRhythmCalibration(next);
      setStored(next);
      setOffset(next.offset);
      setTaps(values);
      setStatus("converged");
      return;
    }

    if (currentRound >= CALIBRATION_ROUNDS) {
      fail();
      return;
    }
    setTaps([]);
    after(RETRY_DELAY, () => scheduleRound(currentRound + 1));
  };

  const scheduleRound = (nextRound: number) => {
    const engine = audioRef.current;
    clearTimers();
    roundRef.current = nextRound;
    setRound(nextRound);
    setTaps([]);
    setSpread(0);
    setStatus("listening");
    statusRef.current = "listening";
    deltasRef.current = [];
    usedRef.current = new Set();

    const gap = clamp(60 / Math.max(60, bpm), 0.5, 0.8);
    const origin = engine.now() + LEAD_IN;
    expectedRef.current = Array.from(
      { length: CALIBRATION_CLICKS },
      (_, index) => origin + index * gap,
    );
    expectedRef.current.forEach((when, index) => {
      engine.playPercussion("click", { when, accent: index === 0 });
    });

    activeRef.current = true;
    const wait =
      (LEAD_IN + (CALIBRATION_CLICKS - 1) * gap + TAP_WINDOW + 0.25) * 1000;
    after(wait, evaluateRound);
  };

  const start = () => {
    const engine = audioRef.current;
    if (!engine.unlock()) {
      fail();
      return;
    }
    setOffset(null);
    setSpread(0);
    setStatus("listening");
    scheduleRound(1);
  };

  const tap = () => {
    if (!activeRef.current || statusRef.current !== "listening") return;
    const engine = audioRef.current;
    engine.unlock();
    const at = engine.now();

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    expectedRef.current.forEach((when, index) => {
      if (usedRef.current.has(index)) return;
      const distance = Math.abs(at - when);
      if (distance > TAP_WINDOW) return;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex < 0) return;

    usedRef.current.add(bestIndex);
    const delta = at - expectedRef.current[bestIndex];
    engine.playPercussion("woodblock");
    deltasRef.current = [...deltasRef.current, delta];
    setTaps(deltasRef.current.slice());

    if (deltasRef.current.length >= CALIBRATION_CLICKS) evaluateRound();
  };

  const cancel = () => {
    activeRef.current = false;
    clearTimers();
    deltasRef.current = [];
    usedRef.current = new Set();
    setTaps([]);
    setStatus(stored ? "converged" : "idle");
  };

  const reset = () => {
    activeRef.current = false;
    clearTimers();
    clearStoredRhythmCalibration();
    setStored(null);
    setOffset(null);
    setSpread(0);
    setTaps([]);
    setRound(0);
    setStatus("idle");
  };

  const practiceMode = status === "failed";
  const message =
    status === "converged"
      ? "Listo. Tu toque quedó ajustado en este equipo."
      : status === "failed"
        ? "No pudimos medir tu equipo. Hoy el ritmo va en modo práctica: sin nota."
        : status === "listening"
          ? round > 1
            ? `Otra vez: toca los 4 clics (intento ${round} de ${CALIBRATION_ROUNDS}).`
            : "Toca los 4 clics cuando los oigas."
          : stored
            ? "Tu toque ya está ajustado en este equipo."
            : "Toca 4 veces con el pulso para ajustar tu equipo.";

  return {
    status,
    round,
    taps,
    offset,
    spread,
    stored,
    practiceMode,
    message,
    latency: audio.latency,
    start,
    tap,
    cancel,
    reset,
  };
}
