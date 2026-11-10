"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Fingerprint, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { starsForAccuracy, type MelodyDrill } from "@/data/curriculum";
import { formatMidi } from "@/lib/harmony";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

/** One octave of white keys: enough for every guided phrase. */
const WHITE_KEYS = [60, 62, 64, 65, 67, 69, 71, 72];

type GuidedNote = { midi: number; finger: number; name: string };
type Feedback = { id: number; label: string; tone: "ok" | "soft" } | null;

function buildNotes(mode: MelodyDrill["mode"]): GuidedNote[] {
  const offsets =
    mode === "direction"
      ? [0, 2, 4, 0]
      : mode === "read"
        ? [0, 4, 7, 12]
        : [0, 4, 7, 0];
  const fingers = mode === "direction" ? [1, 2, 3, 1] : [1, 3, 5, 1];

  return offsets.map((offset, index) => ({
    midi: 60 + offset,
    finger: fingers[index],
    name: formatMidi(60 + offset, "solfege", false),
  }));
}

/**
 * Guided melody: the next key glows cyan with its suggested finger. Wrong
 * keys shake softly but never reset the phrase or hide the target.
 */
export function MelodyGuided({
  drill,
  onComplete,
}: {
  drill: MelodyDrill;
  onComplete: (stars: 1 | 2 | 3, accuracy: number) => void;
}) {
  const audio = useAudioEngine();
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const notes = useRef(buildNotes(drill.mode)).current;
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<boolean[]>(() =>
    notes.map(() => false),
  );
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  const [pressedMidi, setPressedMidi] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const indexRef = useRef(0);
  const mistakesRef = useRef(0);
  const completedRef = useRef(false);
  const timers = useRef<number[]>([]);
  const wrongTimer = useRef<number | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  const pressTimer = useRef<number | null>(null);

  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  const showFeedback = (label: string, tone: "ok" | "soft") => {
    setFeedback({ id: Date.now(), label, tone });
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 820);
  };

  const press = (midi: number) => {
    if (completedRef.current) return;

    audioRef.current.unlock();
    audioRef.current.playNote(midi, 0.55, 0.8);
    setPressedMidi(midi);
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPressedMidi(null), 160);

    const target = notes[indexRef.current];
    if (!target) return;

    if (midi !== target.midi) {
      mistakesRef.current += 1;
      setWrongMidi(midi);
      if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
      wrongTimer.current = window.setTimeout(() => setWrongMidi(null), 420);
      showFeedback("Casi. Toca la tecla iluminada.", "soft");
      return;
    }

    const current = indexRef.current;
    setDone((previous) => {
      const next = [...previous];
      next[current] = true;
      return next;
    });

    if (current === notes.length - 1) {
      completedRef.current = true;
      const accuracy = Math.max(40, 100 - mistakesRef.current * 10);
      showFeedback("¡Melodía completa!", "ok");
      [72, 76, 79, 84].forEach((note, position) => {
        after(position * 120, () =>
          audioRef.current.playNote(note, 0.35, 0.72),
        );
      });
      after(820, () => onComplete(starsForAccuracy(accuracy), accuracy));
      return;
    }

    showFeedback(current === notes.length - 2 ? "¡Casi lista!" : "¡Bien!", "ok");
    indexRef.current = current + 1;
    setIndex(indexRef.current);
  };

  useEffect(() => {
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
      audioRef.current.releaseAll();
    };
  }, []);

  const target = notes[Math.min(index, notes.length - 1)];
  const completedCount = done.filter(Boolean).length;
  const nextMidi = target.midi;

  return (
    <div className="space-y-3.5">
      <div className="rounded-[16px] border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3">
        <p className="text-[13px] font-semibold leading-snug text-cyan-50">
          Toca la tecla iluminada en orden.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {notes.map((note, noteIndex) => {
          const complete = done[noteIndex];
          const active = noteIndex === index && !completedRef.current;
          return (
            <span
              key={`${note.midi}-${noteIndex}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all duration-200",
                complete
                  ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                  : active
                    ? "border-sky-400/60 bg-sky-400/[0.08] text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.28)]"
                    : "border-white/10 bg-white/[0.03] text-slate-500",
              )}
            >
              {complete ? (
                <Check size={11} strokeWidth={3} />
              ) : (
                <span className="text-[9px] opacity-70">{noteIndex + 1}</span>
              )}
              {note.name}
            </span>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 p-4 backdrop-blur-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl"
        />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Ahora toca
            </p>
            <p className="mt-0.5 text-[30px] font-bold leading-none text-cyan-100">
              {target.name}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-200">
              <Fingerprint size={12} />
              Dedo {target.finger}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Nota
            </p>
            <p className="mt-0.5 text-[24px] font-bold leading-none text-white">
              {Math.min(notes.length, index + 1)}
              <span className="text-[12px] text-slate-500"> / {notes.length}</span>
            </p>
            <p className="mt-1 text-[9px] text-slate-400">
              {completedCount} completadas
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-1.5">
        {WHITE_KEYS.map((midi) => {
          const isTarget = midi === nextMidi && !completedRef.current;
          const isWrong = wrongMidi === midi;
          const isPressed = pressedMidi === midi;
          return (
            <motion.button
              key={midi}
              type="button"
              onClick={() => press(midi)}
              animate={isWrong ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.32 }}
              aria-label={`Toca ${formatMidi(midi, "solfege", false)}${
                isTarget ? `, dedo ${target.finger}` : ""
              }`}
              className={cn(
                "relative flex h-[128px] touch-manipulation select-none flex-col items-center justify-between rounded-b-2xl rounded-t-xl border px-1 pb-2.5 pt-2 transition-all duration-150",
                isTarget
                  ? "border-cyan-300/70 bg-[linear-gradient(180deg,rgba(56,189,248,0.28),rgba(13,110,253,0.14))] shadow-[0_0_30px_rgba(56,189,248,0.5)]"
                  : isWrong
                    ? "border-red-400/60 bg-red-400/[0.12]"
                    : isPressed
                      ? "border-white/25 bg-white/[0.14]"
                      : "border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))]",
              )}
            >
              {isTarget && (
                <span className="grid h-7 w-7 place-items-center rounded-full border border-cyan-200/70 bg-cyan-300/20 text-[11px] font-bold text-cyan-50 shadow-[0_0_14px_rgba(56,189,248,0.55)]">
                  {target.finger}
                </span>
              )}
              {!isTarget && <span className="h-7" aria-hidden />}
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  isTarget ? "text-cyan-50" : "text-slate-400",
                )}
              >
                {formatMidi(midi, "solfege", false)}
              </span>
            </motion.button>
          );
        })}
      </div>

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
                  : "border-red-300/30 bg-[#1a0b10]/95 text-red-100",
              )}
            >
              {feedback.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="flex items-center justify-center gap-1.5 text-center text-[9px] text-slate-500">
        <Sparkles size={10} className="text-cyan-300/70" />
        La tecla correcta sigue encendida aunque falles.
      </p>
    </div>
  );
}
