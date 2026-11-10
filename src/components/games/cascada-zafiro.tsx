"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Gem,
  Hand,
  Maximize2,
  RotateCcw,
  Smartphone,
  Sparkles,
  Star,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAcademy } from "@/components/providers/academy-provider";
import { starsForAccuracy } from "@/data/curriculum";
import {
  readBestRecord,
  saveBestRecord,
  subscribeGameRecords,
  type GameRecord,
} from "@/lib/game-records";
import { midiToName } from "@/lib/harmony";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------
   Cascada Zafiro · El Hilo del Ancla
   A falling-chord arcade: hold the shared note between two chords and the
   golden thread never breaks.
   ------------------------------------------------------------------------- */

const GAME_ID = "cascada-zafiro";
const START_BPM = 65;
const MAX_BPM = 105;
const BPM_STEP = 5;
const BPM_EVERY = 4;
const LEAD = 3.15;
const HIT_EARLY = 0.44;
const HIT_LATE = 0.36;

const WHITE_MIDIS = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
const BLACK_MIDIS = [61, 63, 66, 68, 70, 73, 75, 78];
const ALL_MIDIS = [...WHITE_MIDIS, ...BLACK_MIDIS].sort((a, b) => a - b);
const WHITE_COUNT = WHITE_MIDIS.length;

/** Hand-voiced so every consecutive pair shares at least one exact key. */
const PROGRESSION: number[][] = [
  [60, 64, 67], // C
  [64, 69, 72], // Am/C
  [65, 69, 72], // F
  [62, 65, 69], // Dm
  [62, 67, 71], // G
  [64, 67, 71], // Em
  [64, 67, 72], // C
  [65, 69, 72], // F
  [64, 69, 72], // Am
];

const CHORD_NAMES = ["C", "Am", "F", "Dm", "G", "Em", "C", "F", "Am"];

const KEY_MAP: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
  o: 73,
  l: 74,
  p: 75,
  ";": 76,
  "'": 77,
  "]": 78,
  "\\": 79,
};

type Judgement = "maestro" | "time" | "miss";

type ChartChord = {
  index: number;
  midis: number[];
  hitTime: number;
  anchors: number[];
  resolved: boolean;
  judgement?: Judgement;
  resolvedAt?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
};

type Runtime = {
  running: boolean;
  ending: boolean;
  song: number;
  bpm: number;
  lives: number;
  combo: number;
  bestCombo: number;
  links: number;
  hits: number;
  misses: number;
  maxBpm: number;
  ramp: number;
  chart: ChartChord[];
  nextIndex: number;
  nextBeat: number;
  beatIndex: number;
  pulse: number;
  particles: Particle[];
  targetIndex: number;
};

type Banner = {
  id: number;
  title: string;
  sub: string;
  tone: "gold" | "sapphire" | "rose";
};

type Summary = {
  score: number;
  accuracy: number;
  stars: 1 | 2 | 3;
  xp: number;
  hits: number;
  misses: number;
  links: number;
  bestCombo: number;
  maxBpm: number;
  total: number;
  newRecord: boolean;
};

function freshRuntime(): Runtime {
  return {
    running: false,
    ending: false,
    song: 0,
    bpm: START_BPM,
    lives: 3,
    combo: 0,
    bestCombo: 0,
    links: 0,
    hits: 0,
    misses: 0,
    maxBpm: START_BPM,
    ramp: 0,
    chart: [],
    nextIndex: 0,
    nextBeat: 0.14,
    beatIndex: 0,
    pulse: 0,
    particles: [],
    targetIndex: -1,
  };
}

function whiteIndex(midi: number) {
  return WHITE_MIDIS.indexOf(midi);
}

function laneX(midi: number, width: number) {
  const cell = width / WHITE_COUNT;
  const white = whiteIndex(midi);
  if (white >= 0) return (white + 0.5) * cell;
  const below = whiteIndex(midi - 1);
  return (below + 1) * cell;
}

function laneWidth(midi: number, width: number) {
  const cell = width / WHITE_COUNT;
  return cell * (whiteIndex(midi) >= 0 ? 0.82 : 0.6);
}

function leftPercent(midi: number) {
  const white = whiteIndex(midi);
  if (white >= 0) return ((white + 0.5) / WHITE_COUNT) * 100;
  const below = whiteIndex(midi - 1);
  return ((below + 1) / WHITE_COUNT) * 100;
}

function chordLabel(index: number) {
  return CHORD_NAMES[((index % CHORD_NAMES.length) + CHORD_NAMES.length) % CHORD_NAMES.length];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function CascadaZafiro() {
  const audio = useAudioEngine();
  const { activeStudent, recordGameResult } = useAcademy();

  const [playing, setPlaying] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [stats, setStats] = useState({
    bpm: START_BPM,
    lives: 3,
    combo: 0,
    links: 0,
    maxBpm: START_BPM,
  });
  const [target, setTarget] = useState<{
    index: number;
    midis: number[];
    anchors: number[];
    label: string;
  } | null>(null);
  const [activeNotes, setActiveNotes] = useState<number[]>([]);
  const [portrait, setPortrait] = useState(false);
  const [forceLandscape, setForceLandscape] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [fingering, setFingering] = useState(true);
  const [record, setRecord] = useState<GameRecord | null>(null);

  const runtimeRef = useRef<Runtime>(freshRuntime());
  const pausedRef = useRef(false);
  const heldRef = useRef(new Map<number, { downAt: number; count: number }>());
  const pointersRef = useRef(new Map<number, number>());
  const armedRef = useRef<{ index: number; keys: Map<number, number> } | null>(null);
  const scoreRef = useRef(0);
  const finishedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const highwayRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const lastFrameRef = useRef(0);
  const bannerTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const shakeTimerRef = useRef<number | null>(null);
  const recordRef = useRef(recordGameResult);
  const studentIdRef = useRef<string | undefined>(activeStudent?.id);
  const audioRef = useRef(audio);

  const paused =
    playing && !summary && ((portrait && !forceLandscape) || hidden);

  useEffect(() => {
    recordRef.current = recordGameResult;
  }, [recordGameResult]);

  useEffect(() => {
    studentIdRef.current = activeStudent?.id;
  }, [activeStudent?.id]);

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  useEffect(() => {
    if (!activeStudent) return;
    const sync = () => setRecord(readBestRecord(activeStudent.id, GAME_ID));
    sync();
    return subscribeGameRecords(sync);
  }, [activeStudent]);

  useEffect(() => {
    const update = () => setPortrait(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const releaseHeld = useCallback(() => {
    const engine = audioRef.current;
    for (const midi of heldRef.current.keys()) engine.forceNoteOff(midi);
    heldRef.current.clear();
    pointersRef.current.clear();
    setActiveNotes([]);
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    const rt = runtimeRef.current;
    if (paused) {
      releaseHeld();
      audioRef.current.stopPad(0.18);
    } else if (playing) {
      rt.nextBeat = rt.song + 0.12;
      lastFrameRef.current = performance.now();
    }
  }, [paused, playing, releaseHeld]);

  const press = useCallback((midi: number) => {
    const rt = runtimeRef.current;
    if (!rt.running || pausedRef.current) return;
    const held = heldRef.current;
    const current = held.get(midi);
    if (current) {
      current.count += 1;
    } else {
      held.set(midi, { downAt: rt.song, count: 1 });
      audioRef.current.noteOn(midi, 0.64);
    }
    setActiveNotes([...held.keys()]);
  }, []);

  const release = useCallback((midi: number) => {
    const held = heldRef.current;
    const current = held.get(midi);
    if (!current) return;
    if (current.count > 1) {
      current.count -= 1;
    } else {
      held.delete(midi);
      audioRef.current.noteOff(midi);
    }
    setActiveNotes([...held.keys()]);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const midi = KEY_MAP[event.key.toLowerCase()];
      if (midi === undefined) return;
      event.preventDefault();
      const pointerId = -(midi + 1000);
      if (pointersRef.current.has(pointerId)) return;
      pointersRef.current.set(pointerId, midi);
      press(midi);
    };
    const up = (event: KeyboardEvent) => {
      const midi = KEY_MAP[event.key.toLowerCase()];
      if (midi === undefined) return;
      const pointerId = -(midi + 1000);
      if (!pointersRef.current.has(pointerId)) return;
      pointersRef.current.delete(pointerId);
      release(midi);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [playing, press, release]);

  const start = useCallback(() => {
    const engine = audioRef.current;
    engine.unlock();
    runtimeRef.current = freshRuntime();
    runtimeRef.current.running = true;
    armedRef.current = null;
    scoreRef.current = 0;
    finishedRef.current = false;
    heldRef.current.clear();
    pointersRef.current.clear();
    pausedRef.current = false;
    setActiveNotes([]);
    setSummary(null);
    setBanner(null);
    setTarget(null);
    setForceLandscape(false);
    setStats({
      bpm: START_BPM,
      lives: 3,
      combo: 0,
      links: 0,
      maxBpm: START_BPM,
    });
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    bannerTimerRef.current = null;
    finishTimerRef.current = null;
    lastFrameRef.current = performance.now();
    setPlaying(true);
    if (!document.fullscreenElement) {
      const element = document.documentElement;
      try {
        void element.requestFullscreen?.().catch(() => undefined);
      } catch {
        /* Fullscreen is optional (iOS / embedded previews). */
      }
    }
  }, []);

  const exit = useCallback(() => {
    runtimeRef.current.running = false;
    runtimeRef.current.ending = false;
    pausedRef.current = false;
    setPlaying(false);
    setSummary(null);
    setBanner(null);
    setTarget(null);
    setActiveNotes([]);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    bannerTimerRef.current = null;
    finishTimerRef.current = null;
    shakeTimerRef.current = null;
    heldRef.current.clear();
    pointersRef.current.clear();
    audioRef.current.stopPad(0.15);
    audioRef.current.releaseAll();
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!playing) return;
    const stop = () => {
      runtimeRef.current.running = false;
      runtimeRef.current.ending = false;
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    };
    return stop;
  }, [playing]);

  useEffect(() => () => {
    const engine = audioRef.current;
    engine.stopPad(0.1);
    engine.releaseAll();
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
  }, []);

  /* Canvas buffer follows the highway box; drawing happens in CSS pixels. */
  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    const host = highwayRef.current;
    if (!canvas || !host) return;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [playing]);

  /* Main game loop. All mutable state lives in refs; React only mirrors HUD. */
  useEffect(() => {
    if (!playing) return;
    let alive = true;
    let raf = 0;

    const flash = (title: string, sub: string, tone: Banner["tone"]) => {
      setBanner({ id: Date.now() + Math.random(), title, sub, tone });
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = window.setTimeout(
        () => setBanner(null),
        tone === "gold" ? 1500 : 950,
      );
    };

    const shake = () => {
      const stage = stageRef.current;
      if (!stage) return;
      stage.classList.remove("cascada-shake");
      void stage.offsetWidth;
      stage.classList.add("cascada-shake");
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(
        () => stage.classList.remove("cascada-shake"),
        400,
      );
    };

    const syncHud = (rt: Runtime) => {
      setStats({
        bpm: rt.bpm,
        lives: rt.lives,
        combo: rt.combo,
        links: rt.links,
        maxBpm: rt.maxBpm,
      });
    };

    const syncTarget = (rt: Runtime) => {
      const next = rt.chart.find((chord) => !chord.resolved) ?? null;
      const index = next ? next.index : -1;
      if (index === rt.targetIndex) return;
      rt.targetIndex = index;
      setTarget(
        next
          ? {
              index: next.index,
              midis: next.midis,
              anchors: next.anchors,
              label: chordLabel(next.index),
            }
          : null,
      );
    };

    const ensureChart = (rt: Runtime) => {
      while (
        rt.chart.length === 0 ||
        rt.chart[rt.chart.length - 1].hitTime < rt.song + LEAD + 2
      ) {
        const previous = rt.chart[rt.chart.length - 1];
        const midis = [...PROGRESSION[rt.nextIndex % PROGRESSION.length]].sort(
          (a, b) => a - b,
        );
        const hitTime = previous
          ? previous.hitTime + 120 / rt.bpm
          : rt.song + LEAD;
        const anchors = previous
          ? midis.filter((midi) => previous.midis.includes(midi))
          : [];
        rt.chart.push({
          index: rt.nextIndex,
          midis,
          hitTime,
          anchors,
          resolved: false,
        });
        rt.nextIndex += 1;
      }
    };

    const spawnParticles = (
      x: number,
      y: number,
      colors: string[],
      count: number,
      spread: number,
      upward: number,
    ) => {
      const rt = runtimeRef.current;
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = spread * (0.35 + Math.random());
        rt.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - upward,
          life: 0,
          max: 0.5 + Math.random() * 0.55,
          size: 1.2 + Math.random() * 2.4,
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: 140 + Math.random() * 110,
        });
      }
      if (rt.particles.length > 160) {
        rt.particles.splice(0, rt.particles.length - 160);
      }
    };

    const celebrateAnchors = (chord: ChartChord) => {
      const size = sizeRef.current;
      if (!size.w) return;
      for (const midi of chord.anchors) {
        spawnParticles(
          laneX(midi, size.w),
          size.h - 16,
          ["#FFE7A8", "#F5C15A", "#FFF4CC", "#FBBF24"],
          16,
          58,
          60,
        );
      }
    };

    const finishRound = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const rt = runtimeRef.current;
      rt.running = false;
      rt.ending = false;
      audioRef.current.stopPad(0.3);
      audioRef.current.releaseAll();
      heldRef.current.clear();
      pointersRef.current.clear();
      setActiveNotes([]);
      const total = rt.hits + rt.misses;
      const accuracy = total ? Math.round((rt.hits / total) * 100) : 0;
      const stars = starsForAccuracy(accuracy);
      const xp =
        rt.hits === 0
          ? 0
          : Math.max(
              20,
              Math.min(
                420,
                Math.round(rt.hits * 3 + rt.links * 5 + rt.bestCombo * 2),
              ),
            );
      const score = Math.round(scoreRef.current);
      const previous = readBestRecord(studentIdRef.current, GAME_ID);
      if (score > 0) {
        saveBestRecord(studentIdRef.current, GAME_ID, {
          score,
          accuracy,
          maxBpm: rt.maxBpm,
          links: rt.links,
        });
      }
      setSummary({
        score,
        accuracy,
        stars,
        xp,
        hits: rt.hits,
        misses: rt.misses,
        links: rt.links,
        bestCombo: rt.bestCombo,
        maxBpm: rt.maxBpm,
        total,
        newRecord: score > 0 && (!previous || score > previous.score),
      });
      setBanner(null);
      setTarget(null);
      setStats({
        bpm: rt.bpm,
        lives: rt.lives,
        combo: rt.combo,
        links: rt.links,
        maxBpm: rt.maxBpm,
      });
      if (xp > 0) {
        void recordRef.current({
          skill: "harmony",
          accuracy,
          xp,
          detail: "Cascada Zafiro",
        });
      }
    };

    const resolveChord = (rt: Runtime, chord: ChartChord) => {
      const armed = armedRef.current;
      const maestro =
        chord.anchors.length > 0 &&
        !!armed &&
        armed.index === chord.index &&
        chord.anchors.every((midi) => {
          const held = heldRef.current.get(midi);
          return held !== undefined && armed.keys.get(midi) === held.downAt;
        });

      chord.resolved = true;
      chord.resolvedAt = rt.song;
      chord.judgement = maestro ? "maestro" : "time";
      rt.hits += 1;
      rt.combo += maestro ? 2 : 1;
      rt.bestCombo = Math.max(rt.bestCombo, rt.combo);
      if (maestro) rt.links += 1;
      rt.ramp += 1;
      let bumped = false;
      if (rt.ramp >= BPM_EVERY && rt.bpm < MAX_BPM) {
        rt.bpm = Math.min(MAX_BPM, rt.bpm + BPM_STEP);
        rt.maxBpm = Math.max(rt.maxBpm, rt.bpm);
        rt.ramp = 0;
        bumped = true;
      }
      scoreRef.current +=
        (maestro ? 220 : 120) + rt.combo * 9 + (bumped ? 40 : 0);

      armedRef.current = null;
      const next = rt.chart[rt.chart.indexOf(chord) + 1];
      if (next && next.anchors.length > 0) {
        const keys = new Map<number, number>();
        const heldAll = next.anchors.every((midi) => {
          const held = heldRef.current.get(midi);
          if (!held) return false;
          keys.set(midi, held.downAt);
          return true;
        });
        if (heldAll) armedRef.current = { index: next.index, keys };
      }

      if (maestro) {
        audioRef.current.playArpeggio(
          chord.midis.map((midi) => midi + 12),
          { step: 0.05, duration: 1.15, velocity: 0.3, wet: 0.7 },
        );
        audioRef.current.playPercussion("woodblock", { accent: true });
        try {
          navigator.vibrate?.(35);
        } catch {
          /* Haptics are optional. */
        }
        celebrateAnchors(chord);
        flash(
          "¡ENLACE MAESTRO! ×2",
          bumped ? `Hilo dorado · ${rt.bpm} BPM` : "Hilo dorado · combo ×2",
          "gold",
        );
      } else {
        flash(
          "A tiempo",
          `${chordLabel(chord.index)}${bumped ? ` · ${rt.bpm} BPM` : ""}`,
          "sapphire",
        );
      }

      if (rt.combo >= 3) {
        audioRef.current.startPad(chord.midis, { volume: 0.042 });
      } else {
        audioRef.current.stopPad(0.35);
      }
      syncHud(rt);
      syncTarget(rt);
    };

    const missChord = (rt: Runtime, chord: ChartChord) => {
      chord.resolved = true;
      chord.resolvedAt = rt.song;
      chord.judgement = "miss";
      rt.misses += 1;
      rt.combo = 0;
      rt.ramp = 0;
      rt.lives = Math.max(0, rt.lives - 1);
      armedRef.current = null;
      audioRef.current.stopPad(0.24);
      audioRef.current.playShatter();
      try {
        navigator.vibrate?.([16, 36, 20]);
      } catch {
        /* Haptics are optional. */
      }
      const size = sizeRef.current;
      if (size.w) {
        spawnParticles(
          size.w / 2,
          size.h - 18,
          ["#FB7185", "#38BDF8", "#E0F7FF", "#F5C15A"],
          22,
          150,
          40,
        );
      }
      shake();
      flash("Cristal roto", `${chordLabel(chord.index)} · sin enlace`, "rose");
      syncHud(rt);
      syncTarget(rt);
      if (rt.lives <= 0) {
        rt.ending = true;
        if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
        finishTimerRef.current = window.setTimeout(finishRound, 950);
      }
    };

    const draw = () => {
      const canvas = canvasRef.current;
      const size = sizeRef.current;
      if (!canvas || size.w < 2 || size.h < 2) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { w, h, dpr } = size;
      const rt = runtimeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const hitLine = h - 12;
      const travel = Math.max(60, hitLine - 10);
      const blockH = clamp(h * 0.078, 20, 42);
      const whiteW = w / WHITE_COUNT;
      const bottomOf = (chord: ChartChord) =>
        hitLine - ((chord.hitTime - rt.song) / LEAD) * travel;
      const active = rt.chart.find((chord) => !chord.resolved) ?? null;

      // Lane beds, aligned with the physical keys below.
      for (const midi of ALL_MIDIS) {
        const x = laneX(midi, w);
        const lw = laneWidth(midi, w);
        const gradient = ctx.createLinearGradient(0, hitLine, 0, 0);
        gradient.addColorStop(0, "rgba(148,163,184,0.11)");
        gradient.addColorStop(0.6, "rgba(148,163,184,0.035)");
        gradient.addColorStop(1, "rgba(148,163,184,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x - lw / 2, 0, lw, hitLine);
      }

      // Target lanes glow so the student knows the next shape.
      if (active) {
        for (const midi of active.midis) {
          const x = laneX(midi, w);
          const lw = laneWidth(midi, w);
          const anchor = active.anchors.includes(midi);
          const gradient = ctx.createLinearGradient(0, hitLine, 0, 0);
          gradient.addColorStop(
            0,
            anchor ? "rgba(245,193,90,0.2)" : "rgba(56,189,248,0.2)",
          );
          gradient.addColorStop(
            0.5,
            anchor ? "rgba(245,193,90,0.06)" : "rgba(56,189,248,0.06)",
          );
          gradient.addColorStop(1, "rgba(56,189,248,0)");
          ctx.fillStyle = gradient;
          ctx.fillRect(x - lw / 2, 0, lw, hitLine);
        }
      }

      // Rhythmic grid: one faint line per chord landing.
      ctx.save();
      ctx.setLineDash([3, 9]);
      ctx.lineWidth = 1;
      for (const chord of rt.chart) {
        const y = bottomOf(chord);
        if (y < -blockH || y > h + blockH) continue;
        ctx.strokeStyle = chord.anchors.length
          ? "rgba(245,193,90,0.1)"
          : "rgba(255,255,255,0.045)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      // El Hilo del Ancla: continuous amber beams between linked chords.
      for (let index = 0; index < rt.chart.length - 1; index += 1) {
        const lower = rt.chart[index];
        const upper = rt.chart[index + 1];
        if (upper.anchors.length === 0) continue;
        if (lower.resolved) {
          const lowerFade = Math.max(
            0,
            1 - (rt.song - (lower.resolvedAt ?? rt.song)) / 0.6,
          );
          if (lowerFade <= 0.02) continue;
        }
        const lowerY = clamp(bottomOf(lower) - blockH / 2, 0, hitLine);
        const upperY = clamp(bottomOf(upper) - blockH / 2, 0, hitLine);
        if (Math.abs(lowerY - upperY) < 6) continue;
        if (
          Math.min(lowerY, upperY) > hitLine + 1 ||
          Math.max(lowerY, upperY) < -1
        ) {
          continue;
        }
        const top = Math.min(lowerY, upperY);
        const bottom = Math.max(lowerY, upperY);
        for (const midi of upper.anchors) {
          const x = laneX(midi, w);
          const gradient = ctx.createLinearGradient(0, top, 0, bottom);
          gradient.addColorStop(0, "rgba(255,231,168,0.9)");
          gradient.addColorStop(0.5, "rgba(245,193,90,0.62)");
          gradient.addColorStop(1, "rgba(255,231,168,0.9)");
          ctx.save();
          ctx.shadowColor = "rgba(245,193,90,0.8)";
          ctx.shadowBlur = 14;
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x, bottom);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,244,204,0.8)";
          ctx.lineWidth = 1.4;
          ctx.stroke();
          const phase = ((rt.song * 0.62 + midi * 0.11) % 1 + 1) % 1;
          const sparkY = top + (bottom - top) * phase;
          ctx.fillStyle = "#FFF3C4";
          ctx.beginPath();
          ctx.arc(x, sparkY, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Falling chord blocks.
      for (const chord of rt.chart) {
        const bottom = bottomOf(chord);
        const top = bottom - blockH;
        if (bottom < -blockH * 2 || top > h + 40) continue;
        const fade = chord.resolved
          ? Math.max(
              0,
              1 - (rt.song - (chord.resolvedAt ?? rt.song)) / 0.6,
            )
          : 1;
        if (fade <= 0.02) continue;
        const miss = chord.judgement === "miss";
        const maestro = chord.judgement === "maestro";
        const palette = miss
          ? ["#FDA4AF", "#9F1239"]
          : maestro
            ? ["#FFF1C2", "#D97706"]
            : ["#A5F3FF", "#1D6FA8"];
        const glow = miss
          ? "rgba(251,113,133,0.65)"
          : maestro
            ? "rgba(245,193,90,0.8)"
            : "rgba(34,211,238,0.7)";

        const firstX = laneX(chord.midis[0], w);
        const lastX = laneX(chord.midis[chord.midis.length - 1], w);

        ctx.save();
        ctx.globalAlpha = fade;
        if (lastX - firstX > whiteW * 0.5) {
          roundRect(
            ctx,
            firstX,
            top + blockH * 0.34,
            lastX - firstX,
            blockH * 0.32,
            blockH * 0.16,
          );
          ctx.fillStyle = miss
            ? "rgba(251,113,133,0.2)"
            : maestro
              ? "rgba(245,193,90,0.24)"
              : "rgba(34,211,238,0.22)";
          ctx.fill();
        }
        for (const midi of chord.midis) {
          const lw = laneWidth(midi, w) * 0.96;
          const x = laneX(midi, w) - lw / 2;
          const gradient = ctx.createLinearGradient(0, top, 0, bottom);
          gradient.addColorStop(0, palette[0]);
          gradient.addColorStop(1, palette[1]);
          roundRect(ctx, x, top, lw, blockH, Math.min(9, lw / 2));
          ctx.fillStyle = gradient;
          ctx.shadowColor = glow;
          ctx.shadowBlur = active?.index === chord.index ? 22 : 12;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(255,255,255,0.65)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.32)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + lw * 0.2, top + 4);
          ctx.lineTo(x + lw * 0.8, top + 4);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Landing pads on the hit line for the chord in play.
      if (active) {
        ctx.save();
        for (const midi of active.midis) {
          const held = heldRef.current.has(midi);
          const anchor = active.anchors.includes(midi);
          const lw = laneWidth(midi, w) * 0.94;
          const x = laneX(midi, w) - lw / 2;
          ctx.shadowColor = anchor
            ? "rgba(245,193,90,0.9)"
            : "rgba(56,189,248,0.9)";
          ctx.shadowBlur = held ? 22 : 10;
          roundRect(ctx, x, hitLine - 5, lw, 10, 5);
          ctx.fillStyle = held
            ? anchor
              ? "#FFE7A8"
              : "#A5F3FF"
            : anchor
              ? "rgba(245,193,90,0.5)"
              : "rgba(56,189,248,0.32)";
          ctx.fill();
        }
        ctx.restore();
      }

      // The impact line itself, with a pulse on every beat.
      const pulse = rt.pulse;
      if (pulse > 0.01) {
        const glow = ctx.createLinearGradient(0, hitLine - 34, 0, hitLine);
        glow.addColorStop(0, "rgba(56,189,248,0)");
        glow.addColorStop(
          1,
          `rgba(56,189,248,${0.24 * pulse})`,
        );
        ctx.fillStyle = glow;
        ctx.fillRect(0, hitLine - 34, w, 34);
      }
      const lineGradient = ctx.createLinearGradient(0, 0, w, 0);
      lineGradient.addColorStop(0, "rgba(56,189,248,0.05)");
      lineGradient.addColorStop(0.5, "rgba(125,231,255,0.55)");
      lineGradient.addColorStop(1, "rgba(56,189,248,0.05)");
      ctx.fillStyle = lineGradient;
      ctx.fillRect(0, hitLine, w, 1.5);
      ctx.fillStyle = "rgba(255,231,168,0.9)";
      ctx.fillRect(w / 2 - 38, hitLine, 76, 1.5);

      // Spark particles.
      for (const particle of rt.particles) {
        const alpha = Math.max(0, 1 - particle.life / particle.max);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(
          particle.x,
          particle.y,
          Math.max(0.6, particle.size * alpha),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const step = () => {
      const rt = runtimeRef.current;
      const now = performance.now();
      const dt = Math.min(0.055, (now - lastFrameRef.current) / 1000);
      lastFrameRef.current = now;
      if (pausedRef.current || !rt.running) return;

      rt.song += dt;
      rt.pulse = Math.max(0, rt.pulse - dt * 2.6);
      for (const particle of rt.particles) {
        particle.life += dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += particle.gravity * dt;
      }
      rt.particles = rt.particles.filter(
        (particle) => particle.life < particle.max,
      );

      if (rt.ending) return;

      ensureChart(rt);

      // Soft pulse: kick on the downbeat, hat on the offbeat.
      const horizon = 0.18;
      while (rt.nextBeat < rt.song + horizon) {
        const when = audioRef.current.now() + (rt.nextBeat - rt.song);
        audioRef.current.playPercussion(
          rt.beatIndex % 2 === 0 ? "kick" : "hat",
          { when },
        );
        rt.pulse = 1;
        rt.nextBeat += 60 / rt.bpm;
        rt.beatIndex += 1;
      }

      const active = rt.chart.find((chord) => !chord.resolved);
      if (!active) {
        syncTarget(rt);
        return;
      }

      if (
        rt.song >= active.hitTime - HIT_EARLY &&
        rt.song <= active.hitTime + HIT_LATE
      ) {
        const held = heldRef.current;
        let exact = held.size === active.midis.length;
        if (exact) {
          exact = active.midis.every((midi) => held.has(midi));
        }
        if (exact) {
          resolveChord(rt, active);
        }
      }

      if (!active.resolved && rt.song > active.hitTime + HIT_LATE) {
        missChord(rt, active);
      }

      syncTarget(rt);
      while (
        rt.chart.length > 4 &&
        rt.chart[0].resolved &&
        rt.chart[0].hitTime < rt.song - 3
      ) {
        rt.chart.shift();
      }
    };

    const tick = () => {
      if (!alive) return;
      step();
      draw();
      raf = requestAnimationFrame(tick);
    };
    lastFrameRef.current = performance.now();
    raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [playing]);

  const handlePointerDown = (midi: number) => (event: React.PointerEvent) => {
    event.preventDefault();
    if (!runtimeRef.current.running || pausedRef.current) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Pointer capture is best-effort. */
    }
    const existing = pointersRef.current.get(event.pointerId);
    if (existing === midi) return;
    if (existing !== undefined) release(existing);
    pointersRef.current.set(event.pointerId, midi);
    press(midi);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const midi = pointersRef.current.get(event.pointerId);
    if (midi === undefined) return;
    pointersRef.current.delete(event.pointerId);
    release(midi);
  };

  const fingeringFor = useMemo(() => {
    if (!target) return [] as Array<{ midi: number; finger: string; left: number }>;
    const fingers = ["1", "3", "5"];
    return [...target.midis]
      .sort((a, b) => a - b)
      .map((midi, index) => ({
        midi,
        finger: fingers[index] ?? "5",
        left: leftPercent(midi),
      }));
  }, [target]);

  const anchorNames = target
    ? target.anchors.map((midi) => midiToName(midi)).join(" · ")
    : "";

  return (
    <div className="space-y-3">
      {!playing && (
        <div className="keyboard-stage relative overflow-hidden rounded-[26px] p-4">
          <span className="keyboard-screw left-1.5 top-1.5" aria-hidden />
          <span className="keyboard-screw right-1.5 top-1.5" aria-hidden />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[#38BDF8]/12 blur-3xl"
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="eyebrow text-[7px]">Armonía · Arcade de enlaces</p>
                <span className="rounded-full bg-[#F5C15A]/15 px-1.5 py-0.5 text-[6.5px] font-bold uppercase tracking-[0.14em] text-[#F5C15A]">
                  Nuevo
                </span>
              </div>
              <h2 className="mt-1.5 font-display text-[24px] leading-none text-ivory">
                Cascada Zafiro
              </h2>
              <p className="mt-1.5 max-w-[260px] text-[9.5px] leading-relaxed text-muted">
                Mantén la nota común entre acordes y el Hilo del Ancla se
                encenderá en oro. Pantalla completa horizontal.
              </p>
            </div>
            <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] border border-[#38BDF8]/20 bg-[#38BDF8]/[0.07] text-[#7DE7FF]">
              <Gem size={18} />
            </span>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-1.5">
            {[
              { label: "Tempo", value: "65→105", hint: "BPM" },
              { label: "Cristales", value: "💎💎💎", hint: "3 vidas" },
              { label: "Hilo", value: "+2×", hint: "ancla" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[11px] border border-white/[0.05] bg-white/[0.02] px-2 py-2 text-center"
              >
                <span className="block font-display text-[14px] leading-none text-ivory">
                  {item.value}
                </span>
                <span className="mt-1 block text-[6px] font-semibold uppercase tracking-[0.12em] text-faint">
                  {item.label} · {item.hint}
                </span>
              </div>
            ))}
          </div>

          <div className="relative mt-2.5 flex items-center gap-2 rounded-[12px] border border-white/[0.05] bg-black/20 px-2.5 py-2">
            <Trophy
              size={12}
              className={cn(
                "flex-none",
                record ? "text-[#F5C15A]" : "text-faint",
              )}
            />
            <p className="min-w-0 flex-1 text-[8px] leading-tight text-muted">
              {record ? (
                <>
                  <span className="font-semibold text-[#FFE7A8]">
                    {record.score.toLocaleString("es")} pts
                  </span>
                  <span className="text-faint">
                    {" "}
                    · {record.accuracy}% · {record.links} enlaces ·{" "}
                    {record.maxBpm} BPM
                  </span>
                </>
              ) : (
                "Sin récord todavía. El primer hilo dorado es tuyo."
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={start}
            className="neu-button neu-button--primary relative mt-3 w-full rounded-[14px] py-3 text-[11px]"
          >
            <Maximize2 size={13} />
            Jugar en pantalla completa
          </button>

          <p className="relative mt-2 text-center text-[7px] font-semibold uppercase tracking-[0.16em] text-faint/80">
            También puedes usar A–J / K–\ en computadora
          </p>
        </div>
      )}

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {playing && (
          <motion.div
            key="cascada-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[90] flex select-none flex-col overflow-hidden bg-[#06080F] text-white"
          >
            <header className="relative z-30 flex flex-none items-center gap-2 px-2.5 py-2">
              <button
                type="button"
                onClick={exit}
                className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-200 backdrop-blur transition-colors hover:bg-white/12"
              >
                <X size={11} />
                Salir
              </button>

              <div className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 text-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#38BDF8]/25 bg-[#08121F]/85 px-3 py-1 shadow-[0_0_22px_rgba(56,189,248,0.18)] backdrop-blur">
                  <Zap size={10} className="text-[#F5C15A]" fill="currentColor" />
                  <span className="text-[10px] font-bold tabular-nums tracking-[0.04em] text-white">
                    {stats.bpm} BPM
                  </span>
                  <span className="text-[#38BDF8]/50">·</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold tabular-nums tracking-[0.04em]",
                      stats.combo >= 3 ? "text-[#FFE7A8]" : "text-slate-200",
                    )}
                  >
                    Combo ×{stats.combo}
                  </span>
                </div>
                <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-[#7DE7FF]/70">
                  {target
                    ? `${target.label}${anchorNames ? ` · ancla ${anchorNames}` : ""}`
                    : summary
                      ? "Sesión terminada"
                      : "Cascada Zafiro"}
                </p>
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFingering((value) => !value)}
                  aria-pressed={fingering}
                  aria-label="Mostrar digitación 1 · 3 · 5"
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full border transition-colors",
                    fingering
                      ? "border-[#F5C15A]/35 bg-[#F5C15A]/10 text-[#F5C15A]"
                      : "border-white/10 bg-white/[0.05] text-slate-400",
                  )}
                >
                  <Hand size={12} />
                </button>
                <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className={cn(
                        "text-[11px] leading-none transition-all duration-300",
                        index < stats.lives
                          ? "opacity-100 drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]"
                          : "scale-90 opacity-20 grayscale",
                      )}
                    >
                      💎
                    </span>
                  ))}
                </div>
              </div>
            </header>

            <div
              ref={stageRef}
              className="relative flex min-h-0 flex-1 flex-col"
            >
              <div
                ref={highwayRef}
                className="relative overflow-hidden"
                style={{
                  height: "55%",
                  background:
                    "radial-gradient(120% 90% at 50% 112%, rgba(56,189,248,0.16), transparent 60%), linear-gradient(180deg, #05070d 0%, #070b14 62%, #081524 100%)",
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 block h-full w-full"
                  aria-hidden
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#06080F] via-[#06080F]/50 to-transparent"
                />

                <AnimatePresence>
                  {banner && (
                    <motion.div
                      key={banner.id}
                      initial={{ opacity: 0, y: -10, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 320, damping: 24 }}
                      className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2"
                    >
                      <div
                        className={cn(
                          "relative overflow-hidden rounded-[14px] border px-4 py-2 text-center backdrop-blur",
                          banner.tone === "gold" &&
                            "border-[#F5C15A]/45 bg-[#0A0F18]/95 shadow-[0_0_40px_rgba(245,193,90,0.35)]",
                          banner.tone === "sapphire" &&
                            "border-[#38BDF8]/30 bg-[#08121F]/90 shadow-[0_0_26px_rgba(56,189,248,0.22)]",
                          banner.tone === "rose" &&
                            "border-[#FB7185]/35 bg-[#170A10]/90 shadow-[0_0_26px_rgba(251,113,133,0.22)]",
                        )}
                      >
                        {banner.tone === "gold" && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_18%,rgba(255,231,168,0.2)_46%,transparent_72%)]"
                          />
                        )}
                        <p
                          className={cn(
                            "relative font-display leading-none",
                            banner.tone === "gold" && "text-[18px] text-[#FFE7A8]",
                            banner.tone === "sapphire" &&
                              "text-[13px] text-[#A5F3FF]",
                            banner.tone === "rose" &&
                              "text-[13px] text-[#FDA4AF]",
                          )}
                        >
                          {banner.title}
                        </p>
                        <p className="relative mt-1 text-[6.5px] font-bold uppercase tracking-[0.2em] text-white/55">
                          {banner.sub}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!summary && (
                  <div className="pointer-events-none absolute left-2.5 top-2 flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/40 px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.14em] text-slate-400 backdrop-blur">
                    <Sparkles size={8} className="text-[#F5C15A]" />
                    Mantén el ancla
                    <ChevronRight size={8} />
                    {target ? target.label : "—"}
                  </div>
                )}
              </div>

              <div
                className="relative flex min-h-0 flex-1 flex-col bg-[#070A11] px-1 pb-1 pt-1.5"
                style={{ height: "45%" }}
              >
                <div className="relative h-full w-full overflow-hidden rounded-t-[10px]">
                  {WHITE_MIDIS.map((midi) => {
                    const wi = whiteIndex(midi);
                    const active = activeNotes.includes(midi);
                    return (
                      <button
                        key={midi}
                        type="button"
                        tabIndex={-1}
                        aria-label={midiToName(midi)}
                        onPointerDown={handlePointerDown(midi)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onContextMenu={(event) => event.preventDefault()}
                        data-active={active}
                        data-hint={target?.midis.includes(midi) ?? false}
                        className="cascada-key"
                        style={{
                          left: `${(wi / WHITE_COUNT) * 100}%`,
                          width: `${100 / WHITE_COUNT}%`,
                        }}
                      >
                        <span className="cascada-key-label">
                          {midiToName(midi)}
                        </span>
                      </button>
                    );
                  })}
                  {BLACK_MIDIS.map((midi) => {
                    const below = whiteIndex(midi - 1);
                    const active = activeNotes.includes(midi);
                    return (
                      <button
                        key={midi}
                        type="button"
                        tabIndex={-1}
                        aria-label={midiToName(midi)}
                        onPointerDown={handlePointerDown(midi)}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onContextMenu={(event) => event.preventDefault()}
                        data-active={active}
                        data-hint={target?.midis.includes(midi) ?? false}
                        className="cascada-key cascada-key--black"
                        style={{
                          left: `${((below + 1) / WHITE_COUNT) * 100}%`,
                          width: `${(100 / WHITE_COUNT) * 0.6}%`,
                        }}
                      >
                        <span className="cascada-key-label">
                          {midiToName(midi)}
                        </span>
                      </button>
                    );
                  })}
                  {fingering &&
                    !summary &&
                    fingeringFor.map((item) => (
                      <span
                        key={`finger-${item.midi}`}
                        aria-hidden
                        className={cn(
                          "pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-bold leading-none tabular-nums",
                          target?.anchors.includes(item.midi)
                            ? "border-[#F5C15A]/50 bg-[#160F02]/80 text-[#FFE7A8] shadow-[0_0_12px_rgba(245,193,90,0.35)]"
                            : "border-[#38BDF8]/35 bg-[#04101B]/75 text-[#A5F3FF]",
                        )}
                        style={{
                          left: `${item.left}%`,
                          top: whiteIndex(item.midi) >= 0 ? "70%" : "48%",
                        }}
                      >
                        {item.finger}
                      </span>
                    ))}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {portrait && !forceLandscape && !summary && (
                <motion.div
                  key="portrait-gate"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="cascada-glass absolute inset-0 z-40 grid place-items-center px-6 text-center"
                >
                  <div className="max-w-[320px]">
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-[22px] border border-white/12 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <Smartphone
                        size={34}
                        className="cascada-phone text-[#7DE7FF]"
                      />
                    </div>
                    <p className="mt-5 font-display text-[20px] leading-tight text-ivory">
                      Gira tu pantalla
                    </p>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-300">
                      Gira tu pantalla para activar el teclado de concierto.
                    </p>
                    <div className="mt-5 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setForceLandscape(true)}
                        className="rounded-full border border-[#38BDF8]/30 bg-[#38BDF8]/10 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#A5F3FF]"
                      >
                        Continuar así
                      </button>
                      <button
                        type="button"
                        onClick={exit}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300"
                      >
                        Salir
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {summary && (
                <motion.div
                  key="cascada-summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-[#04060B]/94 px-4 py-5 backdrop-blur-xl"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-full max-w-[380px] overflow-hidden rounded-[26px] border border-[#38BDF8]/20 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(56,189,248,0.14),transparent_62%),rgba(8,12,20,0.96)] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,1)]"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#F5C15A]/12 blur-3xl"
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[7px] font-semibold uppercase tracking-[0.22em] text-[#7DE7FF]/75">
                          Sesión terminada
                        </p>
                        <h3 className="mt-1.5 font-display text-[26px] leading-none text-ivory">
                          Cascada Zafiro
                        </h3>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <Stars value={summary.stars} />
                          <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-faint">
                            {summary.accuracy}% precisión
                          </span>
                        </div>
                      </div>
                      <span className="grid h-11 w-11 flex-none place-items-center rounded-full border border-[#F5C15A]/25 bg-[#F5C15A]/[0.08] text-[#F5C15A]">
                        <Trophy size={18} />
                      </span>
                    </div>

                    <div className="relative mt-4 flex items-end justify-between">
                      <div>
                        <p className="font-display text-[42px] leading-none tabular-nums text-ivory">
                          {summary.score.toLocaleString("es")}
                        </p>
                        <p className="mt-1 text-[7px] font-semibold uppercase tracking-[0.2em] text-faint">
                          Puntos de cascada
                        </p>
                      </div>
                      {summary.newRecord && (
                        <span className="rounded-full border border-[#F5C15A]/40 bg-[#F5C15A]/12 px-2.5 py-1 text-[7px] font-bold uppercase tracking-[0.14em] text-[#FFE7A8]">
                          Récord personal
                        </span>
                      )}
                    </div>

                    <div className="relative mt-4 grid grid-cols-2 gap-2">
                      {[
                        {
                          label: "Enlaces maestros",
                          value: `${summary.links}`,
                          hint: "hilo dorado",
                        },
                        {
                          label: "Velocidad máxima",
                          value: `${summary.maxBpm} BPM`,
                          hint: "tempo",
                        },
                        {
                          label: "Acordes",
                          value: `${summary.hits} / ${summary.total}`,
                          hint: `${summary.misses} rotos`,
                        },
                        {
                          label: "Mejor combo",
                          value: `×${summary.bestCombo}`,
                          hint: "racha",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[13px] border border-white/[0.055] bg-white/[0.025] px-3 py-2.5"
                        >
                          <p className="font-display text-[17px] leading-none text-ivory">
                            {item.value}
                          </p>
                          <p className="mt-1 text-[6.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="relative mt-4 flex items-center justify-center gap-1.5 rounded-[12px] border border-[#F5C15A]/15 bg-[#F5C15A]/[0.06] px-3 py-2">
                      <Zap
                        size={11}
                        className="text-[#F5C15A]"
                        fill="currentColor"
                      />
                      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#FFE7A8]">
                        {summary.xp > 0
                          ? `+${summary.xp} XP guardados en tu perfil`
                          : "Sin XP esta vez · toca al menos un acorde"}
                      </p>
                    </div>

                    <div className="relative mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={start}
                        className="neu-button flex-1 rounded-[14px] py-2.5 text-[10px]"
                      >
                        <RotateCcw size={12} />
                        Otra vez
                      </button>
                      <button
                        type="button"
                        onClick={exit}
                        className="neu-button neu-button--primary flex-1 rounded-[14px] py-2.5 text-[10px]"
                      >
                        <X size={12} />
                        Salir al lobby
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3].map((index) => (
        <Star
          key={index}
          size={11}
          strokeWidth={1.4}
          className={
            index <= value
              ? "text-[#F5C15A] drop-shadow-[0_0_6px_rgba(245,193,90,0.7)]"
              : "text-white/15"
          }
          fill={index <= value ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
