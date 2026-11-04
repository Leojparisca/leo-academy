"use client";

import { LETTERS } from "@/lib/harmony";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK: Array<{ pc: number; after: number }> = [
  { pc: 1, after: 0 },
  { pc: 3, after: 1 },
  { pc: 6, after: 3 },
  { pc: 8, after: 4 },
  { pc: 10, after: 5 },
];

/**
 * A one-octave pitch-class keyboard. Octave equivalence is intentional: the
 * chord architect validates the shape the student builds, not the register.
 */
export function NotePicker({
  selected,
  onToggle,
  disabled = false,
  reveal,
}: {
  selected: number[];
  onToggle: (pc: number) => void;
  disabled?: boolean;
  reveal?: number[];
}) {
  const audio = useAudioEngine();
  const chosen = new Set(selected);
  const revealed = new Set(reveal ?? []);

  const press = (pc: number) => {
    if (disabled) return;
    audio.unlock();
    audio.playNote(60 + pc, 1.4, 0.72);
    onToggle(pc);
  };

  return (
    <div
      className={cn(
        "note-picker piano-frame relative mt-4 h-[154px] select-none rounded-[16px] p-1.5 pt-2",
        disabled && "opacity-80",
      )}
      role="group"
      aria-label="Teclado para construir el acorde"
    >
      <div className="keyboard-felt" aria-hidden />
      <div className="relative flex h-full w-full gap-[2px]">
        {WHITE.map((pc) => {
          const active = chosen.has(pc);
          const hint = !active && revealed.has(pc);
          return (
            <button
              key={pc}
              type="button"
              onClick={() => press(pc)}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`Nota ${LETTERS[pc]}`}
              className={cn(
                "note-key-white relative flex-1 rounded-b-[7px] border border-[#08121f]/90 text-[9px] font-semibold",
                active
                  ? "note-key-white--active text-[#062033]"
                  : hint
                    ? "note-key-white--hint text-[#0a2b45]"
                    : "text-[#3c546b]",
              )}
            >
              <span className="absolute inset-x-0 bottom-2">{LETTERS[pc]}</span>
            </button>
          );
        })}

        {BLACK.map(({ pc, after }) => {
          const active = chosen.has(pc);
          const hint = !active && revealed.has(pc);
          return (
            <button
              key={pc}
              type="button"
              onClick={() => press(pc)}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`Nota ${LETTERS[pc]}`}
              className={cn(
                "note-key-black absolute top-0 z-10 h-[62%] rounded-b-[6px] border border-black/90 text-[7px] font-semibold",
                active
                  ? "note-key-black--active text-[#d9f4ff]"
                  : hint
                    ? "note-key-black--hint text-[#d9f4ff]"
                    : "text-white/35",
              )}
              style={{
                left: `calc(${((after + 1) / 7) * 100}% - 4.1%)`,
                width: "8.2%",
              }}
            >
              <span className="absolute inset-x-0 bottom-1.5">{LETTERS[pc]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
