"use client";

import { Lightbulb, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { useMetronome } from "@/lib/use-metronome";
import { cn } from "@/lib/utils";

const LAB_KEYS = [
  { english: "C", spanish: "Do", pc: 0 },
  { english: "G", spanish: "Sol", pc: 7 },
  { english: "D", spanish: "Re", pc: 2 },
  { english: "A", spanish: "La", pc: 9 },
  { english: "E", spanish: "Mi", pc: 4 },
  { english: "B", spanish: "Si", pc: 11 },
  { english: "F#", spanish: "Fa♯", pc: 6 },
  { english: "C#", spanish: "Do♯", pc: 1 },
  { english: "G#", spanish: "Sol♯", pc: 8 },
  { english: "D#", spanish: "Re♯", pc: 3 },
  { english: "A#", spanish: "La♯", pc: 10 },
  { english: "F", spanish: "Fa", pc: 5 },
];

const PC_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11, 12];

/** Keep SSR and client trig output identical to avoid hydration drift. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function LabStudio({ active = true }: { active?: boolean }) {
  const [selected, setSelected] = useState(0);
  const [minor, setMinor] = useState(false);
  const [bpm, setBpm] = useState(72);
  const audio = useAudioEngine();
  const metronome = useMetronome(bpm, active);
  const timersRef = useRef<number[]>([]);

  const key = LAB_KEYS[selected];
  const intervals = minor ? [0, 3, 7] : [0, 4, 7];

  const chordNotes = useMemo(() => {
    return intervals.map((interval) => 60 + key.pc + interval);
  }, [intervals, key.pc]);

  const chordLabels = useMemo(
    () =>
      chordNotes.map((midi) => `${PC_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`),
    [chordNotes],
  );

  const scaleNotes = useMemo(() => {
    return MAJOR_SCALE.map((interval) => 60 + key.pc + interval);
  }, [key.pc]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current = [];
    };
  }, []);

  const playScale = () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
    const gap = Math.max(120, (60 / bpm) * 420);
    scaleNotes.forEach((midi, index) => {
      timersRef.current.push(
        window.setTimeout(() => audio.playNote(midi, 0.34, 0.72), index * gap),
      );
    });
  };

  const playKey = (index: number) => {
    setSelected(index);
    const next = LAB_KEYS[index];
    const nextIntervals = minor ? [0, 3, 7] : [0, 4, 7];
    const notes = nextIntervals.map((interval) => 60 + next.pc + interval);
    audio.playChord(notes, 1.9);
  };

  return (
    <div className="space-y-5">
      <section className="neu-card relative overflow-hidden rounded-[26px] p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-royal/10 blur-3xl"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-[7px]">Laboratorio de armonía</p>
            <h2 className="mt-1.5 font-display text-[23px] leading-none text-ivory">
              Círculo de quintas
            </h2>
            <p className="mt-1.5 text-[9.5px] text-muted">
              Doce puertas. Toca una para escuchar su tríada.
            </p>
          </div>
          <div className="flex flex-none items-center gap-0.5 rounded-[11px] border border-white/[0.055] bg-black/20 p-0.5">
            <button
              type="button"
              onClick={() => setMinor(false)}
              aria-pressed={!minor}
              className={cn(
                "rounded-[8px] px-2 py-1.5 text-[7.5px] font-semibold uppercase tracking-[0.1em] transition-all",
                !minor ? "bg-white/[0.08] text-ivory" : "text-faint",
              )}
            >
              Mayor
            </button>
            <button
              type="button"
              onClick={() => setMinor(true)}
              aria-pressed={minor}
              className={cn(
                "rounded-[8px] px-2 py-1.5 text-[7.5px] font-semibold uppercase tracking-[0.1em] transition-all",
                minor ? "bg-white/[0.08] text-ivory" : "text-faint",
              )}
            >
              Menor
            </button>
          </div>
        </div>

        <div className="relative mx-auto mt-5 aspect-square w-full max-w-[292px]">
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="0.5"
            />
            <circle
              cx="50"
              cy="50"
              r="28"
              fill="none"
              stroke="rgba(56,189,248,0.09)"
              strokeWidth="0.3"
              strokeDasharray="1.5 2.5"
            />
            {LAB_KEYS.map((item, index) => {
              const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
              const x1 = round3(50 + Math.cos(angle) * 36);
              const y1 = round3(50 + Math.sin(angle) * 36);
              const x2 = round3(50 + Math.cos(angle) * 41);
              const y2 = round3(50 + Math.sin(angle) * 41);
              return (
                <line
                  key={item.english}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={
                    index === selected
                      ? "rgba(56,189,248,0.45)"
                      : "rgba(255,255,255,0.07)"
                  }
                  strokeWidth="0.4"
                />
              );
            })}
          </svg>

          {LAB_KEYS.map((item, index) => {
            const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const left = round3(50 + Math.cos(angle) * 42);
            const top = round3(50 + Math.sin(angle) * 42);
            const active = index === selected;
            return (
              <button
                key={item.english}
                type="button"
                onClick={() => playKey(index)}
                aria-label={`${item.spanish} ${minor ? "menor" : "mayor"}`}
                aria-pressed={active}
                className={cn(
                  "absolute grid h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[9.5px] font-semibold",
                  "transition-all duration-300",
                  active
                    ? "border-cyan-200/35 bg-[linear-gradient(145deg,#1482ff,#0a4fb2)] text-white shadow-[0_0_22px_rgba(13,110,253,0.4),inset_0_1px_0_rgba(255,255,255,0.35)]"
                    : "border-white/[0.06] bg-[linear-gradient(145deg,#10233d,#091424)] text-muted shadow-[3px_3px_7px_#03070D,-2px_-2px_6px_rgba(30,95,180,0.12)] hover:border-white/12 hover:text-ivory",
                )}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                {item.spanish}
              </button>
            );
          })}

          <div className="absolute inset-[29%] flex flex-col items-center justify-center text-center">
            <span className="font-display text-[10px] italic text-faint">
              {minor ? "menor" : "mayor"}
            </span>
            <span className="font-display text-[27px] leading-none text-ivory">
              {key.spanish}
            </span>
            <span className="mt-1 text-[7px] font-semibold uppercase tracking-[0.15em] text-glow">
              {chordLabels.join(" · ")}
            </span>
            <button
              type="button"
              onClick={() => audio.playChord(chordNotes, 1.9)}
              aria-label={`Escuchar ${key.spanish} ${minor ? "menor" : "mayor"}`}
              className="neu-icon mt-2 h-8 w-8 min-h-0 rounded-full text-glow"
            >
              <Play size={10} fill="currentColor" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={playScale}
            className="neu-button h-9 min-h-0 flex-1 rounded-[12px] text-[9px]"
          >
            <Sparkles size={12} className="text-glow" />
            Escuchar escala de {key.spanish}
          </button>
          <button
            type="button"
            onClick={() => audio.playChord(chordNotes, 2.4)}
            aria-label="Repetir acorde"
            className="neu-icon h-9 w-9 min-h-0 rounded-[12px]"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </section>

      <section aria-labelledby="metronomo">
        <SectionHeading
          index="02"
          title="Metrónomo"
          meta={
            <span className="text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              4 / 4 · Negra
            </span>
          }
        />
        <div className="neu-card mt-3 overflow-hidden rounded-[22px] p-4">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[7px] font-semibold uppercase tracking-[0.18em] text-faint">
                Tempo
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-[32px] leading-none tabular-nums text-ivory">
                  {bpm}
                </span>
                <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-faint">
                  bpm
                </span>
              </div>
            </div>

            <div className="flex gap-1.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all duration-150",
                    metronome.running && metronome.beat === index
                      ? "scale-125 bg-glow shadow-[0_0_12px_rgba(56,189,248,0.9)]"
                      : index === 0
                        ? "bg-white/20"
                        : "bg-white/10",
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={metronome.toggle}
              aria-pressed={metronome.running}
              aria-label={
                metronome.running ? "Detener metrónomo" : "Iniciar metrónomo"
              }
              className={cn(
                "neu-button h-11 w-11 flex-none rounded-full p-0",
                metronome.running &&
                  "border-cyan-300/30 text-glow shadow-[inset_4px_4px_10px_#03070D,inset_-3px_-3px_8px_rgba(56,189,248,0.12)]",
              )}
            >
              {metronome.running ? (
                <Pause size={15} fill="currentColor" />
              ) : (
                <Play size={15} fill="currentColor" className="ml-0.5" />
              )}
            </button>
          </div>

          <div className="mt-4">
            <input
              className="range-neu h-[6px]"
              type="range"
              min={40}
              max={180}
              value={bpm}
              onChange={(event) => setBpm(Number(event.target.value))}
              aria-label="Tempo del metrónomo en BPM"
            />
            <div className="mt-1.5 flex justify-between text-[7px] font-semibold uppercase tracking-[0.14em] text-faint/60">
              <span>Adagio · 40</span>
              <span>Presto · 180</span>
            </div>
          </div>
        </div>
      </section>

      <div className="neu-inset flex items-start gap-3 rounded-[18px] p-4">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-ember/10 text-ember">
          <Lightbulb size={13} />
        </span>
        <p className="text-[10px] leading-[1.55] text-muted">
          Las tonalidades vecinas comparten casi todas sus notas. Si dominas{" "}
          <span className="text-ivory">{key.spanish}</span>, ya conoces media{" "}
          <span className="text-ivory">Sol</span> y media{" "}
          <span className="text-ivory">Fa</span>.
        </p>
      </div>
    </div>
  );
}
