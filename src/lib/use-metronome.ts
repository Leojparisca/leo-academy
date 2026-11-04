"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAudioEngine } from "@/lib/audio-engine";

/**
 * Sample-accurate 4/4 metronome driven by the shared Sapphire engine. The
 * scheduler runs on a 25 ms look-ahead while the beat lamp follows the audio
 * clock, so the visual pulse never drifts from what the student hears.
 */
export function useMetronome(bpm: number, enabled = true) {
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(0);

  const runningRef = useRef(false);
  const bpmRef = useRef(bpm);
  const nextRef = useRef(0);
  const stepRef = useRef(0);
  const queueRef = useRef<Array<{ time: number; beat: number }>>([]);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  bpmRef.current = bpm;

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setBeat(0);
    queueRef.current = [];
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    timerRef.current = null;
    frameRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    const engine = getAudioEngine();
    engine.unlock();
    queueRef.current = [];
    stepRef.current = 0;
    nextRef.current = engine.now() + 0.09;
    runningRef.current = true;
    setRunning(true);
    setBeat(0);

    const schedule = () => {
      const now = engine.now();
      const horizon = now + 0.16;
      while (nextRef.current < horizon) {
        const step = stepRef.current;
        const when = nextRef.current;
        engine.playPercussion("click", { when, accent: step === 0 });
        queueRef.current.push({ time: when, beat: step });
        stepRef.current = (step + 1) % 4;
        nextRef.current += 60 / bpmRef.current;
      }
    };

    schedule();
    timerRef.current = window.setInterval(schedule, 25);

    const paint = () => {
      const now = engine.now();
      while (queueRef.current.length && queueRef.current[0].time <= now) {
        const next = queueRef.current.shift();
        if (next) setBeat(next.beat);
      }
      frameRef.current = requestAnimationFrame(paint);
    };
    frameRef.current = requestAnimationFrame(paint);
  }, []);

  const toggle = useCallback(() => {
    if (runningRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  return { running, beat, toggle, stop };
}
