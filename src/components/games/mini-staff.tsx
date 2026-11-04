"use client";

import { TrebleClef } from "@/components/studio/clefs";
import { diatonicIndex, midiToPc } from "@/lib/harmony";
import { cn } from "@/lib/utils";

const TOP = 44;
const BOTTOM = 76;
const BASE = 30; // E4 sits on the bottom line of the treble staff.
const STEP = 4;
const NOTE_X = 218;
const BLACK_PC = [1, 3, 6, 8, 10];

function yFor(midi: number) {
  return BOTTOM - (diatonicIndex(midi) - BASE) * STEP;
}

/** A single-note treble staff used by the melody game. */
export function MiniStaff({
  midi,
  label,
  glow = true,
  className,
}: {
  midi: number;
  label?: string;
  glow?: boolean;
  className?: string;
}) {
  const y = yFor(midi);
  const sharp = BLACK_PC.includes(midiToPc(midi));
  const up = y > (TOP + BOTTOM) / 2;
  const stemX = NOTE_X + (up ? 9 : -9);
  const stemEnd = up ? y - 30 : y + 30;

  const ledgers: number[] = [];
  for (let line = TOP - 8; line >= y - 2; line -= 8) ledgers.push(line);
  for (let line = BOTTOM + 8; line <= y + 2; line += 8) ledgers.push(line);

  return (
    <div
      className={cn(
        "staff-visor relative overflow-hidden rounded-[18px] px-2 py-1",
        className,
      )}
    >
      <svg
        viewBox="0 0 300 132"
        className="staff-svg w-full"
        role="img"
        aria-label={label ? `Pentagrama: ${label}` : "Pentagrama"}
      >
        <g stroke="rgba(226,240,255,0.24)" strokeWidth="1">
          {[0, 1, 2, 3, 4].map((index) => (
            <line
              key={index}
              x1="18"
              x2="282"
              y1={TOP + index * 8}
              y2={TOP + index * 8}
            />
          ))}
        </g>

        <TrebleClef x={22} lineY={70} height={54} active />

        {ledgers.map((line) => (
          <line
            key={line}
            x1={NOTE_X - 16}
            x2={NOTE_X + 16}
            y1={line}
            y2={line}
            stroke="rgba(226,240,255,0.3)"
            strokeWidth="1"
          />
        ))}

        {sharp && (
          <text
            x={NOTE_X - 25}
            y={y + 4}
            fill="rgba(226,240,255,0.72)"
            fontSize="15"
            fontFamily="serif"
          >
            ♯
          </text>
        )}

        <g transform={`rotate(-14 ${NOTE_X} ${y})`}>
          <ellipse
            cx={NOTE_X}
            cy={y}
            rx="8.2"
            ry="5.8"
            fill={glow ? "#BAE6FD" : "#E7F1FB"}
            style={
              glow
                ? { filter: "drop-shadow(0 0 7px rgba(56,189,248,0.65))" }
                : undefined
            }
          />
        </g>
        <line
          x1={stemX}
          y1={y}
          x2={stemX}
          y2={stemEnd}
          stroke={glow ? "#BAE6FD" : "#E7F1FB"}
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        <g stroke="rgba(56,189,248,0.14)" strokeWidth="1" strokeDasharray="2 5">
          <line x1={NOTE_X} x2={NOTE_X} y1={TOP - 4} y2={BOTTOM + 4} />
        </g>
      </svg>

      {label && (
        <span className="pointer-events-none absolute bottom-2 right-3 rounded-full border border-cyan-300/15 bg-[#040b13]/80 px-2 py-0.5 text-[7.5px] font-semibold uppercase tracking-[0.18em] text-glow">
          {label}
        </span>
      )}
    </div>
  );
}
