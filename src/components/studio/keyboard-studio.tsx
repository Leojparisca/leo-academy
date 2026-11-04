"use client";

import {
  ChevronDown,
  Hand,
  Maximize2,
  Minus,
  Piano,
  Plus,
  Sparkles,
  SlidersHorizontal,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAcademy } from "@/components/providers/academy-provider";
import { PianoKeyboard } from "@/components/studio/piano-keyboard";
import { StaffVisor } from "@/components/studio/staff-visor";
import { SectionHeading } from "@/components/ui/section-heading";
import { SKILL_META, getLevel, type Skill } from "@/lib/academy";
import type { EnginePreset } from "@/lib/audio-engine";
import {
  analyzeHarmony,
  chordMidis,
  type HarmonyAnalysis,
  type NamingMode,
} from "@/lib/harmony";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { useMidiInput } from "@/lib/use-midi";
import { cn } from "@/lib/utils";

type ViewMode = "one" | "half" | "two";

const VIEW_OPTIONS: Array<{
  id: ViewMode;
  label: string;
}> = [
  { id: "one", label: "1 oct" },
  { id: "half", label: "1.5 oct" },
  { id: "two", label: "2 oct" },
];

function rangeLabel(octaves: 1 | 1.5 | 2) {
  if (octaves === 1) return "C4 — C5";
  if (octaves === 1.5) return "C4 — F5";
  return "C4 — C6";
}

function octaveWord(octaves: 1 | 1.5 | 2) {
  return octaves === 1 ? "1 octava" : `${octaves} octavas`;
}

const NAMING_OPTIONS: Array<{
  id: NamingMode;
  label: string;
  hint: string;
  full: string;
}> = [
  { id: "solfege", label: "Do-Re-Mi", hint: "Solfeo", full: "Do-Re-Mi" },
  { id: "letters", label: "C-D-E", hint: "Cifrado", full: "C-D-E" },
  {
    id: "degrees",
    label: "Grados",
    hint: "1-3-5",
    full: "Grados Funcionales (1-3-5)",
  },
  {
    id: "clean",
    label: "Limpias",
    hint: "Examen",
    full: "Teclas Limpias (Modo Examen)",
  },
];

const PRESETS: Array<{ id: EnginePreset; label: string }> = [
  { id: "rhodes", label: "Rhodes" },
  { id: "grand", label: "Gran Piano" },
  { id: "glass", label: "Cristal" },
];

const CHORD_PADS = [
  { name: "Cmaj7", degree: "I∆7", root: 0, intervals: [0, 4, 7, 11] },
  { name: "Am7", degree: "vi7", root: 9, intervals: [0, 3, 7, 10] },
  { name: "Fmaj7", degree: "IV∆7", root: 5, intervals: [0, 4, 7, 11] },
  { name: "G7", degree: "V7", root: 7, intervals: [0, 4, 7, 10] },
] as const;

const QWERTY: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
};

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function KeyboardStudio({ active = true }: { active?: boolean }) {
  const { activeStudent, logPractice, reportLiveActivity } = useAcademy();
  // The keyboard stays explorable with no profile; practice is simply not saved.
  const level = getLevel(activeStudent?.currentLevel ?? 1);
  const audio = useAudioEngine();

  const [preset, setPreset] = useState<EnginePreset>("grand");
  const [volume, setVolume] = useState(72);
  const [sustain, setSustain] = useState(false);
  const [octave, setOctave] = useState(4);
  const [view, setView] = useState<ViewMode>("one");
  const [naming, setNaming] = useState<NamingMode>("solfege");
  const [activeMidis, setActiveMidis] = useState<Set<number>>(new Set());
  const [padMidis, setPadMidis] = useState<number[]>([]);
  const [playingPad, setPlayingPad] = useState<string | null>(null);
  const [lastHarmony, setLastHarmony] = useState<HarmonyAnalysis | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [fingering, setFingering] = useState(false);
  const [toast, setToast] = useState<{ id: number; minutes: number } | null>(
    null,
  );
  const [skill, setSkill] = useState<Skill>(
    level.focus === "melody" || level.focus === "rhythm"
      ? level.focus
      : "harmony",
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenOctaves, setFullscreenOctaves] = useState<1 | 1.5 | 2>(2);
  const [mounted, setMounted] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);

  const padTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const holdersRef = useRef<Map<number, Set<string>>>(new Map());
  const activeSecondsRef = useRef(0);
  const creditedRef = useRef(0);
  const lastActivityRef = useRef(0);
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const logPracticeRef = useRef(logPractice);
  logPracticeRef.current = logPractice;
  const skillRef = useRef(skill);
  skillRef.current = skill;
  const levelRef = useRef(level);
  levelRef.current = level;
  const canLogRef = useRef(Boolean(activeStudent));
  canLogRef.current = Boolean(activeStudent);

  const midi = useMidiInput(
    {
      onNoteOn: (note, velocity) => press(note, velocity, `midi:${note}`),
      onNoteOff: (note) => release(note, `midi:${note}`),
      onSustain: (on) => setSustain(on),
    },
    active,
  );

  useEffect(() => {
    audio.setVolume(volume);
  }, [audio, volume]);

  useEffect(() => {
    audio.setPreset(preset);
  }, [audio, preset]);

  useEffect(() => {
    audio.setSustain(sustain);
  }, [audio, sustain]);

  useEffect(() => {
    reportLiveActivity({
      levelId: level.id,
      exercise: "Teclado libre",
      skill,
    });
  }, [level.id, reportLiveActivity, skill]);

  useEffect(() => {
    reportLiveActivity({
      practicing: started,
      keyLabel: lastHarmony?.label ?? null,
    });
  }, [lastHarmony?.label, reportLiveActivity, started]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const active =
        lastActivityRef.current > 0 && now - lastActivityRef.current < 15_000;
      setStarted(active);
      if (!active) return;

      // Ten hours is a generous ceiling: the counter never blocks crediting.
      activeSecondsRef.current = Math.min(35_999, activeSecondsRef.current + 1);
      setSeconds(activeSecondsRef.current);

      if (!canLogRef.current) return;
      const creditedSeconds = creditedRef.current * 60;
      if (activeSecondsRef.current - creditedSeconds < 60) return;

      creditedRef.current += 1;
      const levelId = levelRef.current.id;
      const currentSkill = skillRef.current;
      void logPracticeRef
        .current({
          levelId,
          minutes: 1,
          skill: currentSkill,
          score: 74,
          quiet: true,
        })
        .then(() => {
          setToast({ id: Date.now(), minutes: 1 });
          if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(
            () => setToast(null),
            2800,
          );
        });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (padTimerRef.current) window.clearTimeout(padTimerRef.current);
      audioRef.current.releaseAll();
    };
  }, []);

  useEffect(() => {
    try {
      const savedView = localStorage.getItem("leo.keyboardView");
      if (savedView === "one" || savedView === "half" || savedView === "two") {
        setView(savedView);
      }
      const savedNaming = localStorage.getItem("leo.keyboardNaming");
      if (
        savedNaming === "solfege" ||
        savedNaming === "letters" ||
        savedNaming === "degrees" ||
        savedNaming === "clean"
      ) {
        setNaming(savedNaming);
      }
      setFingering(localStorage.getItem("leo.keyboardFingering") === "true");
    } catch {
      /* Private mode. */
    }
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    try {
      localStorage.setItem("leo.keyboardView", view);
      localStorage.setItem("leo.keyboardNaming", naming);
      localStorage.setItem("leo.keyboardFingering", String(fingering));
    } catch {
      /* Private mode. */
    }
  }, [fingering, prefsReady, view, naming]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const check = () => {
      setPortrait(
        window.innerHeight > window.innerWidth && window.innerWidth < 900,
      );
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.pianoFullscreen = "true";
    return () => {
      document.body.style.overflow = previous;
      delete document.documentElement.dataset.pianoFullscreen;
    };
  }, [fullscreen]);

  const press = useCallback(
    (midiNote: number, velocity: number, source: string) => {
      lastActivityRef.current = Date.now();
      const holders = holdersRef.current;
      let sources = holders.get(midiNote);
      if (!sources) {
        sources = new Set();
        holders.set(midiNote, sources);
      }
      const wasEmpty = sources.size === 0;
      sources.add(source);
      if (wasEmpty) audio.noteOn(midiNote, velocity);
      setActiveMidis(new Set(holders.keys()));
      setStarted(true);
    },
    [audio],
  );

  const release = useCallback(
    (midiNote: number, source: string) => {
      const holders = holdersRef.current;
      const sources = holders.get(midiNote);
      if (!sources) return;
      sources.delete(source);
      if (sources.size === 0) {
        holders.delete(midiNote);
        audio.noteOff(midiNote);
      }
      setActiveMidis(new Set(holders.keys()));
    },
    [audio],
  );

  const clearHeld = useCallback(() => {
    holdersRef.current.clear();
    setActiveMidis(new Set());
    setPadMidis([]);
    setPlayingPad(null);
    audio.releaseAll();
    if (padTimerRef.current) window.clearTimeout(padTimerRef.current);
  }, [audio]);

  useEffect(() => {
    if (active) return;
    if (
      holdersRef.current.size === 0 &&
      padMidis.length === 0 &&
      playingPad === null
    ) {
      return;
    }
    clearHeld();
  }, [active, clearHeld, padMidis.length, playingPad]);

  const displayMidis = useMemo(
    () =>
      [...new Set([...activeMidis, ...padMidis])].sort((a, b) => a - b),
    [activeMidis, padMidis],
  );

  const harmony = useMemo(
    () => analyzeHarmony(displayMidis),
    [displayMidis],
  );

  useEffect(() => {
    if (harmony.kind === "silence") return;
    // Debounce every fragment: while a chord is released note by note, the
    // intermediate triads/intervals never live long enough to replace the
    // ghost. A chord held for a moment does.
    const timer = window.setTimeout(() => setLastHarmony(harmony), 260);
    return () => window.clearTimeout(timer);
  }, [harmony]);

  const ghostMidis =
    harmony.kind === "silence" ? (lastHarmony?.notes ?? []) : [];

  const changeOctave = (delta: number) => {
    clearHeld();
    setOctave((value) => Math.min(6, Math.max(2, value + delta)));
  };

  const changeView = (next: ViewMode) => {
    clearHeld();
    setView(next);
  };

  const enterImmersive = useCallback(async () => {
    clearHeld();
    audio.unlock();
    setFullscreen(true);
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      await orientation.lock?.("landscape");
    } catch {
      /* Orientation lock is optional; CSS rotation covers phones. */
    }
  }, [audio, clearHeld]);

  const exitImmersive = useCallback(() => {
    clearHeld();
    setFullscreen(false);
    try {
      screen.orientation?.unlock?.();
    } catch {
      /* Ignore. */
    }
  }, [clearHeld]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") exitImmersive();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitImmersive, fullscreen]);

  useEffect(() => {
    if (!active) return;
    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const offset = QWERTY[event.code];
      if (offset === undefined) return;
      event.preventDefault();
      press((octave + 1) * 12 + offset, 0.78, `qwerty:${event.code}`);
    };
    const up = (event: KeyboardEvent) => {
      const offset = QWERTY[event.code];
      if (offset === undefined) return;
      release((octave + 1) * 12 + offset, `qwerty:${event.code}`);
    };
    const blur = () => {
      for (const [midiNote, sources] of holdersRef.current) {
        for (const source of [...sources]) {
          if (source.startsWith("qwerty:")) release(midiNote, source);
        }
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      blur();
    };
  }, [active, octave, press, release]);

  const playPad = (pad: (typeof CHORD_PADS)[number]) => {
    lastActivityRef.current = Date.now();
    if (padTimerRef.current) window.clearTimeout(padTimerRef.current);
    const notes = chordMidis(pad.root, [...pad.intervals], octave);
    audio.playChord(notes, 2, 0.76);
    setPadMidis(notes);
    setPlayingPad(pad.name);
    setStarted(true);
    padTimerRef.current = window.setTimeout(() => {
      setPadMidis([]);
      setPlayingPad(null);
    }, 1900);
  };

  const octaves: 1 | 1.5 | 2 =
    view === "two" ? 2 : view === "half" ? 1.5 : 1;
  const startMidi = (octave + 1) * 12;
  const presetLabel =
    PRESETS.find((option) => option.id === preset)?.label ?? "Grand Piano";

  const midiLabel = !midi.supported
    ? "MIDI · sin soporte"
    : midi.status === "ready"
      ? (midi.devices[0] ?? "MIDI conectado")
      : midi.status === "requesting"
        ? "MIDI · buscando"
        : midi.status === "denied"
          ? "MIDI · bloqueado"
          : "MIDI · toca para conectar";
  const midiTone =
    midi.status === "ready"
      ? "text-glow"
      : midi.status === "denied"
        ? "text-ember/90"
        : "text-faint";

  const harmonyLive = harmony.kind !== "silence";
  const hudLabel = harmonyLive ? harmony.label : (lastHarmony?.label ?? "Silencio");

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 430, damping: 32 }}
            className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+8.55rem)] z-[46] flex justify-center px-4"
            role="status"
            aria-live="polite"
          >
            <span className="neu-card flex items-center gap-2 rounded-full border border-cyan-300/20 px-4 py-2 text-[10.5px] font-semibold text-ivory/90 shadow-[0_0_24px_rgba(56,189,248,0.12)]">
              <span aria-hidden>🎹</span>
              +{toast.minutes} min de práctica registrado
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <StaffVisor
        activeMidis={displayMidis}
        ghostMidis={ghostMidis}
        naming={naming}
        analyser={audio.analyser}
        ready={audio.ready}
        lastHarmony={lastHarmony}
        fingering={fingering}
      />

      <div className="rounded-2xl border border-white/[0.08] bg-[#0E1524]/80 p-1.5 backdrop-blur-xl">
        <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto">
          <label className="relative flex h-10 flex-none items-center gap-1.5 rounded-full bg-white/[0.06] pl-3 pr-2">
            <Piano size={14} className="text-sky-400" />
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as EnginePreset)}
              aria-label="Sonido del piano"
              className="appearance-none bg-transparent pr-4 text-[11px] font-semibold text-white outline-none"
            >
              <option value="grand" className="bg-[#0E1524]">
                Grand Piano
              </option>
              <option value="rhodes" className="bg-[#0E1524]">
                Rhodes
              </option>
              <option value="glass" className="bg-[#0E1524]">
                Cristal
              </option>
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2 text-slate-400"
            />
          </label>

          <div className="flex h-10 flex-none items-center rounded-full bg-white/[0.06]">
            <button
              type="button"
              onClick={() => changeOctave(-1)}
              disabled={octave <= 2}
              aria-label="Bajar una octava"
              className="grid h-8 w-8 place-items-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <Minus size={13} />
            </button>
            <span className="min-w-[38px] text-center text-[10px] font-bold tracking-[0.02em] text-white">
              OCT {octave}
            </span>
            <button
              type="button"
              onClick={() => changeOctave(1)}
              disabled={octave >= 6}
              aria-label="Subir una octava"
              className="grid h-8 w-8 place-items-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <Plus size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setFingering((value) => !value)}
            aria-pressed={fingering}
            aria-label="Modo Molde / Digitación"
            title="Modo Molde / Digitación · 1-3-5"
            className={cn(
              "flex h-10 flex-none items-center gap-1.5 rounded-full px-3 text-[10px] font-bold transition-colors",
              fingering
                ? "bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/40"
                : "bg-white/[0.06] text-slate-300",
            )}
          >
            <Hand size={13} />
            1·3·5
          </button>

          <button
            type="button"
            onClick={() => void enterImmersive()}
            aria-label="Pantalla completa"
            title="Pantalla completa"
            className="grid h-10 w-10 flex-none place-items-center rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-95"
          >
            <Maximize2 size={15} />
          </button>

          <label className="relative flex h-10 flex-none items-center rounded-full bg-white/[0.06] pl-3 pr-2">
            <select
              value={naming}
              onChange={(event) => setNaming(event.target.value as NamingMode)}
              aria-label="Nomenclatura de las notas"
              className="max-w-[74px] appearance-none truncate bg-transparent pr-4 text-[10px] font-semibold text-white outline-none"
            >
              {NAMING_OPTIONS.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  className="bg-[#0E1524]"
                >
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2 text-slate-400"
            />
          </label>

          <label className="relative flex h-10 flex-none items-center rounded-full bg-white/[0.06] pl-3 pr-2">
            <select
              value={view}
              onChange={(event) => changeView(event.target.value as ViewMode)}
              aria-label="Vista del teclado"
              className="max-w-[62px] appearance-none bg-transparent pr-4 text-[10px] font-semibold text-white outline-none"
            >
              {VIEW_OPTIONS.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  className="bg-[#0E1524]"
                >
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2 text-slate-400"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-1">
        <span className="flex-none text-[10px] font-semibold text-slate-400">
          Próximo minuto
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#0D6EFD,#38BDF8)] shadow-[0_0_10px_rgba(56,189,248,0.6)] transition-[width] duration-500"
            style={{ width: `${((seconds % 60) / 60) * 100}%` }}
          />
        </div>
        <span className="w-9 flex-none text-right text-[10px] font-bold tabular-nums text-sky-300">
          {60 - (seconds % 60)}s
        </span>
      </div>

      <div className="keyboard-stage neu-card relative rounded-[26px] p-3">
        <span className="keyboard-screw left-1.5 top-1.5" aria-hidden />
        <span className="keyboard-screw right-1.5 top-1.5" aria-hidden />
        <span className="keyboard-screw bottom-1.5 left-1.5" aria-hidden />
        <span className="keyboard-screw bottom-1.5 right-1.5" aria-hidden />

        <div className="relative flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "h-1.5 w-1.5 flex-none rounded-full transition-all duration-500",
                audio.ready
                  ? "bg-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                  : "bg-white/15",
              )}
            />
            <span className="truncate text-[7px] font-semibold uppercase tracking-[0.24em] text-faint/85">
              Sapphire Keys
            </span>
            <span className="hidden text-[6px] font-semibold uppercase tracking-[0.14em] text-faint/45 min-[370px]:inline">
              · {octaveWord(octaves)}
            </span>
          </div>
          <div className="flex flex-none items-center gap-1.5">
            <button
              type="button"
              onClick={() => void midi.connect()}
              disabled={!midi.supported}
              title={midiLabel}
              className={cn(
                "flex items-center gap-1 rounded-full border border-white/[0.06] bg-black/20 px-2 py-1 text-[5.5px] font-semibold uppercase tracking-[0.1em] transition-colors hover:border-white/10 disabled:opacity-60",
                midiTone,
              )}
            >
              <span
                className={cn(
                  "h-1 w-1 rounded-full",
                  midi.status === "ready" ? "bg-cyan-300" : "bg-current",
                )}
              />
              <span className="max-w-[74px] truncate">
                {midi.status === "ready" ? midiLabel : "MIDI"}
              </span>
            </button>
          </div>
        </div>

        <div className="piano-frame neu-inset relative mt-2 overflow-hidden rounded-[18px] p-2">
          <div className="keyboard-felt" aria-hidden />
          <div className="keyboard-ledge" aria-hidden />
          <PianoKeyboard
            startMidi={startMidi}
            octaves={octaves}
            naming={naming}
            activeMidis={activeMidis}
            onPress={press}
            onRelease={release}
            fingering={fingering}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => setSustain((value) => !value)}
            aria-pressed={sustain}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold transition-colors",
              sustain
                ? "bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/40"
                : "bg-white/[0.06] text-slate-300",
            )}
          >
            <Waves size={13} />
            Pedal
          </button>
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {presetLabel}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2.5 px-1">
          <Volume2 size={12} className="flex-none text-faint" />
          <input
            className="range-neu h-[6px]"
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volumen del sintetizador"
          />
          <span className="w-7 flex-none text-right text-[8px] font-semibold tabular-nums text-faint">
            {volume}%
          </span>
        </div>
      </div>

      {fullscreen &&
        mounted &&
        createPortal(
          <div
            className="piano-fullscreen fixed inset-0 z-[100] h-[100dvh] w-[100dvw] overflow-hidden bg-[#050B14]"
            role="dialog"
            aria-modal="true"
            aria-label="Piano en pantalla completa"
          >
            <div
              className={cn(
                "absolute left-1/2 top-1/2 flex flex-col",
                portrait ? "origin-center" : "h-full w-full",
              )}
              style={
                portrait
                  ? {
                      width: "100dvh",
                      height: "100dvw",
                      transform: "translate(-50%, -50%) rotate(90deg)",
                    }
                  : undefined
              }
            >
              <div className="flex flex-none flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.06] bg-[#06101c]/95 px-2.5 py-1.5">
                <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-black/30 p-0.5">
                  {([1, 1.5, 2] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFullscreenOctaves(value)}
                      aria-pressed={fullscreenOctaves === value}
                      title={`${octaveWord(value)}`}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[9px] font-semibold transition-colors",
                        fullscreenOctaves === value
                          ? "bg-white/[0.1] text-ivory"
                          : "text-faint hover:text-muted",
                      )}
                    >
                      {value}
                      <span className="ml-1 text-[6px] uppercase tracking-wider opacity-70">
                        oct
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-black/30 p-0.5">
                  {PRESETS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPreset(option.id)}
                      aria-pressed={preset === option.id}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.06em] transition-colors",
                        preset === option.id
                          ? "bg-white/[0.1] text-ivory"
                          : "text-faint hover:text-muted",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSustain((value) => !value)}
                  aria-pressed={sustain}
                  className={cn(
                    "flex items-center gap-1 rounded-full border border-white/[0.06] bg-black/30 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.06em] transition-colors",
                    sustain ? "text-glow" : "text-faint hover:text-muted",
                  )}
                >
                  <Waves size={10} />
                  Pedal
                </button>

                <button
                  type="button"
                  onClick={() => setFingering((value) => !value)}
                  aria-pressed={fingering}
                  aria-label="Modo Molde / Digitación"
                  className={cn(
                    "flex items-center gap-1 rounded-full border border-white/[0.06] bg-black/30 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.06em] transition-colors",
                    fingering ? "text-glow" : "text-faint hover:text-muted",
                  )}
                >
                  <Hand size={10} />
                  Molde
                </button>

                <button
                  type="button"
                  onClick={() => exitImmersive()}
                  className="ml-auto flex flex-none items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-[8.5px] font-semibold text-ivory transition-colors hover:bg-white/[0.09]"
                >
                  <X size={11} />
                  Salir de Pantalla Completa
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-2">
                <div className="mx-auto flex h-[82%] min-h-0 w-full max-w-[1500px]">
                  <div className="piano-frame neu-inset relative w-full overflow-hidden rounded-[16px] p-2">
                    <div className="keyboard-felt" aria-hidden />
                    <div className="keyboard-ledge" aria-hidden />
                    <PianoKeyboard
                      startMidi={startMidi}
                      octaves={fullscreenOctaves}
                      naming={naming}
                      activeMidis={activeMidis}
                      onPress={press}
                      onRelease={release}
                      immersive
                      fingering={fingering}
                    />
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
                  <div className="min-w-0">
                    <p className="text-[6px] font-semibold uppercase tracking-[0.18em] text-faint">
                      {harmonyLive ? "Sonando" : "Último acorde"}
                    </p>
                    <p className="truncate font-display text-[20px] leading-none text-ivory">
                      {hudLabel}
                    </p>
                  </div>
                  <p className="text-right text-[7px] font-semibold uppercase tracking-[0.14em] text-faint/70">
                    {rangeLabel(fullscreenOctaves)}
                    <span className="ml-2 text-faint/50">OCT {octave}</span>
                    {portrait && (
                      <span className="ml-2 text-glow/70">Gira el teléfono</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <section aria-labelledby="acompanamiento">
        <SectionHeading
          index="01"
          title="Acompañamiento"
          meta={
            <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
              <SlidersHorizontal size={9} />
              Toca un acorde
            </span>
          }
        />
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {CHORD_PADS.map((pad) => (
            <button
              key={pad.name}
              type="button"
              onClick={() => playPad(pad)}
              aria-label={`Tocar acorde ${pad.name}`}
              className={cn(
                "neu-button h-[54px] flex-col gap-0.5 rounded-[14px] px-1 py-2",
                playingPad === pad.name &&
                  "border-cyan-300/35 text-glow shadow-[inset_4px_4px_10px_#03070D,inset_-3px_-3px_8px_rgba(56,189,248,0.12),0_0_24px_rgba(56,189,248,0.12)]",
              )}
            >
              <span className="font-display text-[12.5px] leading-none">
                {pad.name}
              </span>
              <span
                className={cn(
                  "text-[6px] font-semibold uppercase tracking-[0.12em]",
                  playingPad === pad.name ? "text-glow/80" : "text-faint",
                )}
              >
                {pad.degree}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section
        className="neu-card overflow-hidden rounded-[22px]"
        aria-label="Práctica automática"
      >
        <div className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-faint">
                Práctica automática
              </span>
              <span
                className={cn(
                  "h-1 w-1 rounded-full transition-colors",
                  started ? "animate-dot-pulse bg-glow" : "bg-white/20",
                )}
              />
              <span className="text-[6px] font-semibold uppercase tracking-[0.12em] text-faint/60">
                {started ? "detectando teclas" : "en pausa"}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-[26px] leading-none tabular-nums text-ivory">
                {formatTimer(seconds)}
              </span>
              <span className="text-[7.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                {Math.floor(seconds / 60) > 0
                  ? `${Math.floor(seconds / 60)} min guardados`
                  : "activo"}
              </span>
            </div>
            <p className="mt-1.5 text-[7px] leading-relaxed text-faint/80">
              Cada minuto tocado se registra solo. Se pausa tras 15 s sin
              tocar.
            </p>
          </div>
          <div className="w-[74px] flex-none text-right">
            <p className="text-[6px] font-semibold uppercase tracking-[0.12em] text-faint">
              Próximo minuto
            </p>
            <p className="mt-0.5 font-display text-[16px] leading-none tabular-nums text-glow">
              {60 - (seconds % 60)}s
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/45">
              <div
                className="h-full rounded-full bg-glow/70 transition-[width] duration-500"
                style={{ width: `${((seconds % 60) / 60) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.055] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              Trabajando
            </span>
            <span className="text-[7.5px] text-faint/70">{level.title}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(["melody", "harmony", "rhythm"] as Skill[]).map((option) => {
              const meta = SKILL_META[option];
              const isActive = skill === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSkill(option)}
                  aria-pressed={isActive}
                  className={cn(
                    "rounded-[10px] border px-2 py-1.5 text-[7.5px] font-semibold uppercase tracking-[0.1em] transition-all duration-300",
                    isActive
                      ? "border-white/10 bg-white/[0.055] text-ivory"
                      : "border-transparent text-faint hover:bg-white/[0.025]",
                  )}
                  style={
                    isActive
                      ? { boxShadow: `inset 0 0 0 1px ${meta.color}33` }
                      : undefined
                  }
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <p className="flex items-center justify-center gap-1.5 pb-1 text-center text-[6.5px] uppercase tracking-[0.16em] text-faint/55">
        <Sparkles size={8} className="text-glow/60" />
        También responde a tu teclado físico · A W S E D F T G Y H U J
      </p>
    </div>
  );
}
