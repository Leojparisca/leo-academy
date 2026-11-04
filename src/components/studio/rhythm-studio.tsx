"use client";

import { CircleDot, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import type { PercussionKind } from "@/lib/audio-engine";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

const PADS: Array<{
  id: PercussionKind;
  label: string;
  hint: string;
  key: string;
}> = [
  { id: "kick", label: "Bombo", hint: "Kick", key: "K" },
  { id: "snare", label: "Caja", hint: "Snare", key: "S" },
  { id: "woodblock", label: "Caja china", hint: "Woodblock", key: "W" },
  { id: "click", label: "Pulso", hint: "Click", key: "C" },
];

const METERS = [3, 4, 6] as const;

export function RhythmStudio({ active = true }: { active?: boolean }) {
  const audio = useAudioEngine();
  const [running, setRunning] = useState(false);
  const [bpm, setBpm] = useState(84);
  const [beats, setBeats] = useState<number>(4);
  const [beat, setBeat] = useState(-1);
  const [volume, setVolume] = useState(72);
  const [flash, setFlash] = useState<PercussionKind | null>(null);

  const runningRef = useRef(false);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef<number>(beats);
  const nextRef = useRef(0);
  const stepRef = useRef(0);
  const queueRef = useRef<Array<{ time: number; beat: number }>>([]);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const flashRef = useRef<number | null>(null);

  bpmRef.current = bpm;
  beatsRef.current = beats;

  useEffect(() => {
    audio.setVolume(volume);
  }, [audio, volume]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const pad = PADS.find((item) => item.key === event.key.toUpperCase());
      if (!pad) return;
      event.preventDefault();
      audio.playPercussion(pad.id);
      setFlash(pad.id);
      if (flashRef.current) window.clearTimeout(flashRef.current);
      flashRef.current = window.setTimeout(() => setFlash(null), 130);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, audio]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setBeat(-1);
    queueRef.current = [];
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    timerRef.current = null;
    frameRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stop();
      if (flashRef.current) window.clearTimeout(flashRef.current);
    };
  }, [stop]);

  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    audio.unlock();
    queueRef.current = [];
    stepRef.current = 0;
    nextRef.current = audio.now() + 0.09;
    runningRef.current = true;
    setRunning(true);
    setBeat(-1);

    const schedule = () => {
      const now = audio.now();
      const horizon = now + 0.16;
      while (nextRef.current < horizon) {
        const step = stepRef.current;
        const when = nextRef.current;
        audio.playPercussion("click", { when, accent: step === 0 });
        queueRef.current.push({ time: when, beat: step });
        stepRef.current = (step + 1) % beatsRef.current;
        nextRef.current += 60 / bpmRef.current;
      }
    };

    schedule();
    timerRef.current = window.setInterval(schedule, 25);

    const paint = () => {
      const now = audio.now();
      while (queueRef.current.length && queueRef.current[0].time <= now) {
        const next = queueRef.current.shift();
        if (next) setBeat(next.beat);
      }
      frameRef.current = requestAnimationFrame(paint);
    };
    frameRef.current = requestAnimationFrame(paint);
  }, [audio]);

  const tapPad = (kind: PercussionKind) => {
    audio.unlock();
    audio.playPercussion(kind);
    setFlash(kind);
    if (flashRef.current) window.clearTimeout(flashRef.current);
    flashRef.current = window.setTimeout(() => setFlash(null), 130);
  };

  const toggle = () => {
    if (runningRef.current) stop();
    else start();
  };

  const reset = () => {
    stop();
    setBpm(84);
    setBeats(4);
  };

  return (
    <div className="space-y-4">
      <section
        className="keyboard-stage relative overflow-hidden rounded-[26px] p-4"
        aria-label="Metrónomo y percusión"
      >
        <span className="keyboard-screw left-1.5 top-1.5" aria-hidden />
        <span className="keyboard-screw right-1.5 top-1.5" aria-hidden />
        <span className="keyboard-screw bottom-1.5 left-1.5" aria-hidden />
        <span className="keyboard-screw bottom-1.5 right-1.5" aria-hidden />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all duration-300",
                running
                  ? "bg-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                  : "bg-white/15",
              )}
            />
            <p className="eyebrow text-[7px]">
              {running ? "Transporte activo" : "Transporte detenido"}
            </p>
          </div>
          <span className="text-[6px] font-semibold uppercase tracking-[0.16em] text-faint/70">
            {beats}/4 · {bpm} BPM
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-[46px] leading-none tabular-nums text-ivory">
              {bpm}
            </p>
            <p className="mt-1 text-[7px] font-semibold uppercase tracking-[0.2em] text-faint">
              Pulsos por minuto
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full border border-white/[0.06] bg-black/25 p-1">
              {METERS.map((meter) => (
                <button
                  key={meter}
                  type="button"
                  onClick={() => setBeats(meter)}
                  aria-pressed={beats === meter}
                  className={cn(
                    "h-7 w-7 rounded-full text-[8px] font-semibold transition-all duration-300",
                    beats === meter
                      ? "bg-white/[0.09] text-ivory shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                      : "text-faint hover:text-muted",
                  )}
                >
                  {meter}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={running ? "Detener metrónomo" : "Iniciar metrónomo"}
              className={cn(
                "neu-button neu-button--primary h-11 w-11 min-h-0 rounded-full p-0",
                running && "border-cyan-300/30 text-glow",
              )}
            >
              {running ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label="Reiniciar tempo"
              className="neu-icon h-9 w-9 rounded-[11px]"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2.5">
          <Volume2 size={12} className="flex-none text-faint" />
          <input
            className="range-neu h-[6px]"
            type="range"
            min={40}
            max={180}
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
            aria-label="Tempo en pulsos por minuto"
          />
          <span className="w-8 flex-none text-right text-[8px] font-semibold tabular-nums text-faint">
            {bpm}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-1.5">
          {Array.from({ length: beats }, (_, index) => {
            const isActive = running && beat === index;
            return (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-150",
                  isActive
                    ? index === 0
                      ? "bg-cyan-200 shadow-[0_0_14px_rgba(186,230,253,0.9)]"
                      : "bg-glow/80 shadow-[0_0_10px_rgba(56,189,248,0.6)]"
                    : "bg-white/[0.07]",
                )}
              />
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {PADS.map((pad) => (
            <button
              key={pad.id}
              type="button"
              onClick={() => tapPad(pad.id)}
              aria-label={`Tocar ${pad.label}`}
              className={cn(
                "group relative flex min-h-[64px] flex-col items-start justify-between rounded-[16px] border border-white/[0.055] px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.985]",
                flash === pad.id
                  ? "border-cyan-300/35 bg-cyan-300/[0.09] shadow-[inset_0_0_18px_rgba(56,189,248,0.16),0_0_22px_rgba(56,189,248,0.14)]"
                  : "bg-[linear-gradient(160deg,#0e2037,#081322)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_5px_12px_rgba(2,6,12,0.6)] hover:border-white/10",
              )}
            >
              <span className="flex w-full items-center justify-between">
                <span className="text-[6px] font-semibold uppercase tracking-[0.16em] text-faint">
                  {pad.hint}
                </span>
                <span className="rounded-[4px] border border-white/[0.07] px-1 py-[1px] text-[5.5px] font-semibold text-faint/70">
                  {pad.key}
                </span>
              </span>
              <span className="mt-2 flex items-end justify-between gap-2">
                <span
                  className={cn(
                    "font-display text-[16px] leading-none transition-colors",
                    flash === pad.id ? "text-glow" : "text-ivory/90",
                  )}
                >
                  {pad.label}
                </span>
                <CircleDot
                  size={11}
                  className={cn(
                    "transition-colors",
                    flash === pad.id ? "text-glow" : "text-faint/40",
                  )}
                />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="ritmo-guia">
        <SectionHeading
          index="02"
          title="Pulso interno"
          meta={
            <span className="text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
              {beats === 3 ? "Vals" : beats === 6 ? "Compuesto" : "Cuaternario"}
            </span>
          }
        />
        <div className="neu-inset mt-3 rounded-[20px] px-4 py-3.5">
          <p className="text-[10px] leading-relaxed text-muted">
            Cuenta en voz alta mientras suena el pulso:{" "}
            <span className="text-ivory">
              {Array.from({ length: beats }, (_, index) => index + 1).join(" — ")}
            </span>
            . El primer pulso lleva acento y una luz más blanca.
          </p>
          <p className="mt-2 text-[7.5px] uppercase tracking-[0.14em] text-faint/70">
            Atajos · K bombo · S caja · W caja china · C pulso
          </p>
        </div>
      </section>
    </div>
  );
}
