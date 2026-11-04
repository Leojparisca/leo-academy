"use client";

import { useEffect, useRef } from "react";
import { formatMidi, midiToName, midiToPc, type NamingMode } from "@/lib/harmony";
import { cn } from "@/lib/utils";

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];

type Key = {
  midi: number;
  pc: number;
  index: number;
};

function buildKeys(startMidi: number, octaves: 1 | 1.5 | 2) {
  // 1.5 octaves ends on F5 (17 semitones) so the keybed closes on a white key
  // instead of leaving a lone F#5 black key at the right edge.
  const total = octaves === 1.5 ? 17 : Math.round(octaves * 12);
  const white: Key[] = [];
  const black: Array<{ midi: number; pc: number; after: number }> = [];

  for (let offset = 0; offset <= total; offset += 1) {
    const midi = startMidi + offset;
    const pc = midiToPc(midi);
    if (WHITE_PCS.includes(pc)) {
      white.push({ midi, pc, index: white.length });
    } else {
      black.push({ midi, pc, after: white.length - 1 });
    }
  }

  return { white, black };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function octaveWord(octaves: 1 | 1.5 | 2) {
  return octaves === 1
    ? "una octava"
    : octaves === 1.5
      ? "una octava y media"
      : "dos octavas";
}

export function PianoKeyboard({
  startMidi = 60,
  octaves = 1,
  naming = "solfege",
  activeMidis,
  onPress,
  onRelease,
  immersive = false,
  disabled = false,
}: {
  startMidi?: number;
  octaves?: 1 | 1.5 | 2;
  naming?: NamingMode;
  activeMidis: Set<number>;
  onPress: (midi: number, velocity: number, source: string) => void;
  onRelease: (midi: number, source: string) => void;
  immersive?: boolean;
  disabled?: boolean;
}) {
  const pointersRef = useRef(new Map<number, number>());
  const pressRef = useRef(onPress);
  const releaseRef = useRef(onRelease);
  pressRef.current = onPress;
  releaseRef.current = onRelease;

  const { white, black } = buildKeys(startMidi, octaves);
  const whiteCount = white.length;

  const velocityAt = (clientY: number, midi: number) => {
    const element = document.querySelector(
      `[data-midi="${midi}"]`,
    ) as HTMLElement | null;
    if (!element) return 0.8;
    const rect = element.getBoundingClientRect();
    const ratio = clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1);
    return 0.52 + ratio * 0.46;
  };

  const begin = (
    event: React.PointerEvent<HTMLButtonElement>,
    midi: number,
  ) => {
    if (disabled) return;
    event.preventDefault();
    const element = event.currentTarget;
    if (element.hasPointerCapture?.(event.pointerId)) {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        /* Safari can refuse silently. */
      }
    }
    const previous = pointersRef.current.get(event.pointerId);
    if (previous === midi) return;
    if (previous !== undefined) {
      releaseRef.current(previous, `pointer:${event.pointerId}`);
    }
    pointersRef.current.set(event.pointerId, midi);
    pressRef.current(
      midi,
      velocityAt(event.clientY, midi),
      `pointer:${event.pointerId}`,
    );
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = pointersRef.current.get(event.pointerId);
    if (current === undefined) return;
    if (event.pointerType === "mouse" && event.buttons === 0) {
      pointersRef.current.delete(event.pointerId);
      releaseRef.current(current, `pointer:${event.pointerId}`);
      return;
    }
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-midi]");
    const next = target ? Number(target.dataset.midi) : undefined;
    if (next === undefined || next === current) return;
    releaseRef.current(current, `pointer:${event.pointerId}`);
    pointersRef.current.set(event.pointerId, next);
    pressRef.current(
      next,
      velocityAt(event.clientY, next),
      `pointer:${event.pointerId}`,
    );
  };

  useEffect(() => {
    const end = (event: PointerEvent) => {
      const midi = pointersRef.current.get(event.pointerId);
      if (midi === undefined) return;
      pointersRef.current.delete(event.pointerId);
      releaseRef.current(midi, `pointer:${event.pointerId}`);
    };
    const cancelAll = () => {
      for (const [pointerId, midi] of pointersRef.current) {
        releaseRef.current(midi, `pointer:${pointerId}`);
      }
      pointersRef.current.clear();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") cancelAll();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", cancelAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", cancelAll);
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAll();
    };
  }, []);

  const keyLabel = (midi: number, pc: number) => {
    if (naming === "clean") return "";
    const withOctave = octaves === 1 || pc === 0;
    return formatMidi(midi, naming, withOctave);
  };

  return (
    <div
      className={cn(
        "piano-keybed relative flex w-full select-none gap-[2px] rounded-[12px] bg-[#02060c] p-[3px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.9)]",
        immersive ? "h-full w-full" : "h-[176px] sm:h-[204px]",
      )}
      role="group"
      aria-label={`Teclado de piano, ${octaveWord(octaves)}`}
      onPointerMove={move}
      onContextMenu={(event) => event.preventDefault()}
    >
      {white.map((key) => {
        const active = activeMidis.has(key.midi);
        const label = keyLabel(key.midi, key.pc);
        return (
          <button
            key={key.midi}
            type="button"
            disabled={disabled}
            data-midi={key.midi}
            data-active={active}
            aria-label={`Tocar ${midiToName(key.midi)}`}
            aria-pressed={active}
            className="piano-key-white group flex flex-col items-center justify-end pb-2"
            onPointerDown={(event) => begin(event, key.midi)}
            onContextMenu={(event) => event.preventDefault()}
          >
            {label && (
              <span
                className={cn(
                  "pointer-events-none select-none font-semibold tracking-[0.06em] transition-colors duration-200",
                  immersive
                    ? "text-[10px]"
                    : octaves === 1
                      ? "text-[7.5px]"
                      : "text-[6px]",
                  active ? "text-[#0a4a78]" : "text-[#56718c]",
                  key.pc === 0 && "font-bold text-[#2e5a80]",
                )}
              >
                {label}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "mt-1 h-[3px] rounded-full transition-all duration-200",
                octaves === 1 ? "w-3" : "w-2",
                active
                  ? "bg-[#0d6efd]/70 shadow-[0_0_7px_rgba(13,110,253,0.7)]"
                  : "bg-[#aebfd3]/55",
              )}
            />
          </button>
        );
      })}

      {black.map((key) => {
        const active = activeMidis.has(key.midi);
        const label = keyLabel(key.midi, key.pc);
        const left = ((key.after + 1) / whiteCount) * 100;
        const width = (0.64 / whiteCount) * 100;
        return (
          <button
            key={key.midi}
            type="button"
            disabled={disabled}
            data-midi={key.midi}
            data-active={active}
            aria-label={`Tocar ${midiToName(key.midi)}`}
            aria-pressed={active}
            className="piano-key-black group flex items-end justify-center pb-2.5"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              transform: "translateX(-50%)",
            }}
            onPointerDown={(event) => begin(event, key.midi)}
            onContextMenu={(event) => event.preventDefault()}
          >
            {label && octaves === 1 && (
              <span
                className={cn(
                  "pointer-events-none select-none pb-1 text-[6px] font-semibold tracking-[0.04em] transition-colors duration-200",
                  active ? "text-cyan-100/90" : "text-white/35",
                )}
              >
                {label}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute bottom-1.5 left-1/2 h-[2px] -translate-x-1/2 rounded-full transition-all duration-200",
                octaves === 1 ? "w-3" : "w-2",
                active
                  ? "bg-glow/80 shadow-[0_0_9px_rgba(56,189,248,0.9)]"
                  : "bg-white/[0.09]",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
