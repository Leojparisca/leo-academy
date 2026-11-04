"use client";

import { useEffect, useMemo, useRef } from "react";
import { BassClef, TrebleClef } from "@/components/studio/clefs";
import {
  DEGREES,
  INVERSION_LABEL,
  SOLFEGE,
  analyzeHarmony,
  diatonicIndex,
  formatMidi,
  midiToPc,
  type HarmonyAnalysis,
  type NamingMode,
} from "@/lib/harmony";
import { cn } from "@/lib/utils";

type Staff = {
  key: "treble" | "bass";
  top: number;
  bottom: number;
  base: number;
  clefLine: number;
  clefHeight: number;
};

const W = 340;
const H = 196;
const NOTE_X = 236;
const TREBLE: Staff = {
  key: "treble",
  top: 46,
  bottom: 78,
  base: 30,
  clefLine: 70,
  clefHeight: 58,
};
const BASS: Staff = {
  key: "bass",
  top: 126,
  bottom: 158,
  base: 18,
  clefLine: 134,
  clefHeight: 20,
};
const STAFF_LINES = [0, 1, 2, 3, 4];

const CHIP_LABEL: Record<number, string> = {
  0: "R",
  1: "♭2",
  2: "9",
  3: "♭3",
  4: "3",
  5: "11",
  6: "♯11",
  7: "5",
  8: "♭13",
  9: "13",
  10: "♭7",
  11: "7",
  12: "8",
  13: "♭9",
  14: "9",
};

function yFor(midi: number, staff: Staff) {
  return staff.bottom - (diatonicIndex(midi) - staff.base) * 4;
}

function ledgerLines(y: number, staff: Staff) {
  const lines: number[] = [];
  for (let line = staff.top - 8; line >= y; line -= 8) lines.push(line);
  for (let line = staff.bottom + 8; line <= y; line += 8) lines.push(line);
  return lines;
}

type Placed = {
  midi: number;
  y: number;
  x: number;
  staff: Staff;
  sharp: boolean;
};

function placeNotes(midis: number[]) {
  const placed: Placed[] = [];
  for (const staff of [TREBLE, BASS]) {
    const group = [...new Set(midis)]
      .filter((midi) => (staff.key === "treble" ? midi >= 60 : midi < 60))
      .map((midi) => ({ midi, y: yFor(midi, staff) }))
      .sort((a, b) => a.y - b.y);

    let previousY = Number.POSITIVE_INFINITY;
    let offset = 0;
    for (const note of group) {
      if (Math.abs(note.y - previousY) < 7) {
        offset = offset === 0 ? 5 : offset > 0 ? -5 : 0;
      } else {
        offset = 0;
      }
      placed.push({
        midi: note.midi,
        y: note.y,
        x: NOTE_X + offset,
        staff,
        sharp: [1, 3, 6, 8, 10].includes(midiToPc(note.midi)),
      });
      previousY = note.y;
    }
  }
  return placed;
}

function StaffSvg({
  activeMidis,
  ghostMidis,
}: {
  activeMidis: number[];
  ghostMidis: number[];
}) {
  const live = useMemo(
    () => placeNotes(activeMidis),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMidis.join(",")],
  );
  const ghost = useMemo(
    () =>
      ghostMidis.length
        ? placeNotes(ghostMidis).filter(
            (note) => !activeMidis.includes(note.midi),
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ghostMidis.join(","), activeMidis.join(",")],
  );

  const notes = [...ghost, ...live];
  const trebleActive = notes.some((note) => note.staff.key === "treble");
  const bassActive = notes.some((note) => note.staff.key === "bass");

  const stems = [TREBLE, BASS].map((staff) => {
    const group = live.filter((note) => note.staff.key === staff.key);
    if (!group.length) return null;
    const middle = (staff.top + staff.bottom) / 2;
    const average = group.reduce((sum, note) => sum + note.y, 0) / group.length;
    const up = average >= middle;
    const anchor = up
      ? group.reduce((a, b) => (a.y > b.y ? a : b))
      : group.reduce((a, b) => (a.y < b.y ? a : b));
    return {
      key: staff.key,
      x: anchor.x + (up ? 5.1 : -5.1),
      from: anchor.y,
      to: up ? anchor.y - 29 : anchor.y + 29,
    };
  });

  const ghostStems = [TREBLE, BASS].map((staff) => {
    const group = ghost.filter((note) => note.staff.key === staff.key);
    if (!group.length) return null;
    const up = group.reduce((sum, note) => sum + note.y, 0) / group.length >=
      (staff.top + staff.bottom) / 2;
    const anchor = up
      ? group.reduce((a, b) => (a.y > b.y ? a : b))
      : group.reduce((a, b) => (a.y < b.y ? a : b));
    return {
      key: staff.key,
      x: anchor.x + (up ? 5.1 : -5.1),
      from: anchor.y,
      to: up ? anchor.y - 29 : anchor.y + 29,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="staff-svg w-full"
      role="img"
      aria-label="Pentagrama en clave de sol y fa con las notas que estás tocando"
    >
      <defs>
        <radialGradient id="visorGlow" cx="62%" cy="18%" r="74%">
          <stop offset="0%" stopColor="#0d3f76" stopOpacity="0.45" />
          <stop offset="55%" stopColor="#07182b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#030a12" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id="staffLine"
          gradientUnits="userSpaceOnUse"
          x1="32"
          x2="322"
          y1="0"
          y2="0"
        >
          <stop offset="0%" stopColor="#8fa6c4" stopOpacity="0" />
          <stop offset="14%" stopColor="#8fa6c4" stopOpacity="0.34" />
          <stop offset="86%" stopColor="#8fa6c4" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#8fa6c4" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="noteCore" cx="38%" cy="30%" r="74%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="58%" stopColor="#dff4ff" />
          <stop offset="100%" stopColor="#7cc8f8" />
        </radialGradient>
        <filter id="noteGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="0" y="0" width={W} height={H} rx="14" fill="#040b13" />
      <rect x="0" y="0" width={W} height={H} rx="14" fill="url(#visorGlow)" />

      <path
        d="M 27 46 C 18 52 17 64 20 76 C 23 88 15 96 11 102 C 15 108 23 116 20 128 C 17 140 18 152 27 158"
        fill="none"
        stroke="#8fa6c4"
        strokeOpacity="0.34"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {[TREBLE, BASS].map((staff) =>
        STAFF_LINES.map((line) => (
          <line
            key={`${staff.key}-${line}`}
            x1="32"
            x2="322"
            y1={staff.top + line * 8}
            y2={staff.top + line * 8}
            stroke="url(#staffLine)"
            strokeWidth="0.8"
          />
        )),
      )}

      <g
        className={cn(
          "transition-colors duration-500",
          trebleActive ? "text-[#cfe9ff]" : "text-[#6f89a8]",
        )}
      >
        <TrebleClef
          x={22}
          lineY={TREBLE.clefLine}
          height={TREBLE.clefHeight}
          active={trebleActive}
        />
      </g>
      <g
        className={cn(
          "transition-colors duration-500",
          bassActive ? "text-[#cfe9ff]" : "text-[#6f89a8]",
        )}
      >
        <BassClef
          x={22}
          lineY={BASS.clefLine}
          height={BASS.clefHeight}
          active={bassActive}
        />
      </g>

      <line
        x1={NOTE_X}
        x2={NOTE_X}
        y1="40"
        y2="164"
        stroke="#38bdf8"
        strokeOpacity="0.12"
        strokeDasharray="2 5"
      />

      {notes.length === 0 && (
        <text
          x="180"
          y="105"
          textAnchor="middle"
          fontSize="6.6"
          letterSpacing="2.4"
          fill="#5d7492"
          fillOpacity="0.75"
        >
          TOCA UNA TECLA
        </text>
      )}

      {notes.map((note) => {
        const isGhost = ghost.some(
          (ghostNote) =>
            ghostNote.midi === note.midi && ghostNote.staff.key === note.staff.key,
        );
        return (
          <g key={`${note.staff.key}-${note.midi}-${isGhost ? "g" : "a"}`}>
            {ledgerLines(note.y, note.staff).map((line) => (
              <line
                key={line}
                x1={note.x - 11}
                x2={note.x + 11}
                y1={line}
                y2={line}
                stroke="#8fa6c4"
                strokeOpacity={isGhost ? 0.22 : 0.55}
                strokeWidth="0.8"
              />
            ))}
            {note.sharp && (
              <text
                x={note.x - 15.5}
                y={note.y + 3.4}
                fontSize="10"
                fill={isGhost ? "#8fa6c4" : "#cfe9ff"}
                fillOpacity={isGhost ? 0.28 : 0.82}
                fontFamily="serif"
              >
                ♯
              </text>
            )}
            <ellipse
              cx={note.x}
              cy={note.y}
              rx="5.4"
              ry="4"
              transform={`rotate(-18 ${note.x} ${note.y})`}
              fill="url(#noteCore)"
              stroke="#38bdf8"
              strokeWidth="0.7"
              filter={isGhost ? undefined : "url(#noteGlow)"}
              opacity={isGhost ? 0.24 : 1}
            />
          </g>
        );
      })}

      {[...ghostStems, ...stems].filter(Boolean).map((stem) => {
        if (!stem) return null;
        const isGhost = ghostStems.some((item) => item === stem);
        return (
          <line
            key={`${stem.key}-${stem.from}-${isGhost ? "g" : "a"}`}
            x1={stem.x}
            x2={stem.x}
            y1={stem.from}
            y2={stem.to}
            stroke="#dff4ff"
            strokeOpacity={isGhost ? 0.2 : 0.62}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function Spectrum({
  analyser,
  live,
}: {
  analyser: AnalyserNode | null;
  live: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef(live);
  liveRef.current = live;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const data = analyser
      ? new Uint8Array(analyser.frequencyBinCount)
      : null;
    const bars = 22;
    const smooth = new Float32Array(bars);
    let width = 1;
    let height = 1;
    let frame = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(resize)
        : null;
    observer?.observe(canvas);

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      if (analyser && data) analyser.getByteFrequencyData(data);

      for (let index = 0; index < bars; index += 1) {
        let value = 0;
        if (analyser && data) {
          const sample = Math.min(
            data.length - 1,
            Math.floor(Math.pow(index / bars, 1.7) * data.length * 0.58) + 2,
          );
          value = data[sample] / 255;
        } else if (liveRef.current) {
          value = 0.16;
        } else {
          value = 0.045 + 0.02 * Math.sin(time / 780 + index * 0.8);
        }
        smooth[index] = Math.max(value, smooth[index] * 0.86);
        if (reduced) smooth[index] = value;

        const barWidth = width / bars - 1.6;
        const barHeight = Math.max(1.6, smooth[index] * height);
        const x = index * (width / bars);
        const y = height - barHeight;
        const gradient = context.createLinearGradient(0, height, 0, y);
        gradient.addColorStop(0, "rgba(13,110,253,0.32)");
        gradient.addColorStop(0.55, "rgba(56,189,248,0.72)");
        gradient.addColorStop(1, "rgba(224,247,255,0.95)");
        context.fillStyle = gradient;
        if (typeof context.roundRect === "function") {
          context.beginPath();
          context.roundRect(x, y, barWidth, barHeight, 1.4);
          context.fill();
        } else {
          context.fillRect(x, y, barWidth, barHeight);
        }
      }

      if (!reduced) frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [analyser]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden />;
}

export function StaffVisor({
  activeMidis,
  ghostMidis = [],
  naming,
  analyser,
  ready,
  lastHarmony,
}: {
  activeMidis: number[];
  ghostMidis?: number[];
  naming: NamingMode;
  analyser: AnalyserNode | null;
  ready: boolean;
  lastHarmony: HarmonyAnalysis | null;
}) {
  const harmony = useMemo(() => analyzeHarmony(activeMidis), [activeMidis]);
  const silent = harmony.kind === "silence";
  const shown = silent ? lastHarmony : harmony;
  const displayMode = naming === "clean" ? "letters" : naming;
  const live = !silent;

  const noteChips = shown
    ? shown.notes.map((midi) => formatMidi(midi, displayMode, true))
    : [];
  const intervalChips =
    shown && shown.kind === "chord"
      ? shown.intervals.map((interval) => CHIP_LABEL[interval] ?? `${interval}`)
      : shown && shown.kind === "interval"
        ? [`${shown.intervals[0]} st`]
        : [];

  const detail = (() => {
    if (!shown) return "El visor espera tu mano";
    if (silent) return "Último acorde escuchado";
    if (shown.kind === "chord" && shown.rootPc !== null) {
      const inversion =
        shown.inversion > 0 ? ` · ${INVERSION_LABEL[shown.inversion]}` : "";
      return `${SOLFEGE[shown.rootPc]} ${shown.quality}${inversion}`;
    }
    if (shown.kind === "interval") {
      return `${formatMidi(shown.notes[0], displayMode, true)} → ${formatMidi(
        shown.notes[1],
        displayMode,
        true,
      )} · ${shown.quality}`;
    }
    if (shown.kind === "note") return shown.quality;
    return shown.quality;
  })();

  const rootLabel =
    shown?.kind === "chord" && shown.rootPc !== null
      ? naming === "degrees"
        ? `Grado ${DEGREES[shown.rootPc]}`
        : `Grado ${shown.roman}`
      : null;

  return (
    <section
      className="staff-visor neu-inset relative overflow-hidden rounded-[26px] px-3 pb-3 pt-3"
      aria-label="Visor armónico en tiempo real"
    >
      <header className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className="status-dot text-glow" />
          <p className="eyebrow text-[6.8px]">Visor armónico</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[6px] font-semibold uppercase tracking-[0.14em] text-faint">
            Clave de Sol · Fa
          </span>
          <span
            className={cn(
              "h-1 w-1 rounded-full",
              ready
                ? "bg-cyan-300 shadow-[0_0_6px_#38BDF8]"
                : "bg-white/20",
            )}
          />
        </div>
      </header>

      <div className="staff-glass mt-2 overflow-hidden rounded-[16px] border border-white/[0.04]">
        <StaffSvg activeMidis={activeMidis} ghostMidis={ghostMidis} />
      </div>

      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_74px] items-end gap-2.5">
        <div className="min-w-0">
          <div className="flex min-h-[11px] items-center gap-1.5">
            <p className="eyebrow text-[6px]">Armonía detectada</p>
            {silent && shown && (
              <span className="rounded-full border border-white/[0.07] px-1.5 py-[1px] text-[5.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                último
              </span>
            )}
            {rootLabel && (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-1.5 py-[1px] text-[5.5px] font-semibold uppercase tracking-[0.12em] text-glow/80">
                {rootLabel}
              </span>
            )}
            {!ready && (
              <span className="text-[5.5px] font-semibold uppercase tracking-[0.12em] text-faint/70">
                toca para sonar
              </span>
            )}
          </div>
          <p
            className={cn(
              "mt-1 truncate font-display text-[24px] leading-none transition-opacity duration-300",
              silent && shown ? "text-ivory/55" : "text-ivory",
            )}
          >
            {shown?.label ?? "Silencio"}
          </p>
          <p className="mt-1 truncate text-[8.5px] leading-tight text-muted">
            {detail}
          </p>
          <div className="mt-1.5 flex min-h-[16px] flex-wrap gap-1">
            {noteChips.length > 0 ? (
              noteChips.map((note, index) => (
                <span
                  key={`${note}-${index}`}
                  className={cn(
                    "rounded-[6px] border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[7px] font-semibold tracking-[0.04em]",
                    silent ? "text-ivory/45" : "text-ivory/80",
                  )}
                >
                  {note}
                </span>
              ))
            ) : (
              <span className="text-[7.5px] text-faint/70">
                Toca un acorde de 3 o 4 notas
              </span>
            )}
          </div>
          {intervalChips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {intervalChips.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="rounded-[5px] bg-royal/15 px-1.5 py-[1px] text-[6px] font-bold uppercase tracking-[0.08em] text-glow/85"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-right text-[5.5px] font-semibold uppercase tracking-[0.14em] text-faint">
            Espectro
          </p>
          <div className="mt-1 h-[46px] w-full">
            <Spectrum analyser={analyser} live={live} />
          </div>
        </div>
      </div>
    </section>
  );
}
