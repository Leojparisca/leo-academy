"use client";

import { motion } from "framer-motion";
import {
  AudioLines,
  Ear,
  Gamepad2,
  Headphones,
  Piano,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { ChordArchitect } from "@/components/games/chord-architect";
import { GroovePadDual } from "@/components/games/groove-pad-dual";
import { GroupClass } from "@/components/games/group-class";
import { IntervalHunter } from "@/components/games/interval-hunter";
import { cn } from "@/lib/utils";

type GameId = "ritmo" | "melodia" | "armonia";

const TABS: Array<{
  id: GameId;
  label: string;
  hint: string;
  icon: LucideIcon;
  color: string;
}> = [
  {
    id: "ritmo",
    label: "Ritmo",
    hint: "Groove Pad Dual",
    icon: Waves,
    color: "#F2B45C",
  },
  {
    id: "melodia",
    label: "Melodía",
    hint: "Intervalos",
    icon: AudioLines,
    color: "#38BDF8",
  },
  {
    id: "armonia",
    label: "Armonía",
    hint: "Acordes",
    icon: Piano,
    color: "#9DB5FF",
  },
];

export function GamesHub() {
  const [tab, setTab] = useState<GameId>("ritmo");
  const { activeStudent } = useAcademy();

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <span className="status-dot text-glow" />
          <p className="eyebrow">Juegos · Oído y pulso</p>
        </div>
        <h1 className="mt-3.5 max-w-[330px] font-display text-[39px] leading-[0.94] tracking-[-0.035em] text-ivory">
          Tres sentidos.
          <br />
          Un <em className="sapphire-text font-normal italic">músico</em>
          <span className="text-glow">.</span>
        </h1>
        <p className="mt-3 max-w-[290px] text-[11px] leading-[1.6] text-muted">
          {activeStudent ? `${activeStudent.firstName}, ` : ""}cada reto mide una
          cosa distinta: el pulso, la distancia entre notas y la forma del
          acorde. Todo se guarda en tu perfil, incluso sin luz.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <span className="neu-pill min-h-0 px-2.5 py-1.5 text-[7.5px] font-semibold uppercase tracking-[0.15em] text-faint">
            <Headphones size={10} className="text-glow" />
            Auriculares recomendados
          </span>
          <span className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-faint/60">
            <Sparkles size={10} className="text-[#F5C15A]" />
            3 juegos
          </span>
        </div>
      </header>

      <section aria-label="Selector de juego">
        <div className="neu-inset grid grid-cols-3 gap-1 rounded-[18px] p-1">
          {TABS.map((entry) => {
            const active = tab === entry.id;
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                aria-pressed={active}
                className={cn(
                  "relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-1.5 transition-colors duration-300",
                  active ? "text-ivory" : "text-faint hover:text-muted",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="game-tab-pool"
                    transition={{ type: "spring", stiffness: 480, damping: 36 }}
                    className="nav-pool absolute inset-0 rounded-[14px]"
                    aria-hidden
                  />
                )}
                <Icon
                  size={16}
                  className="relative z-10"
                  style={{ color: active ? entry.color : undefined }}
                />
                <span className="relative z-10 text-[8px] font-semibold uppercase tracking-[0.12em]">
                  {entry.label}
                </span>
                <span className="relative z-10 text-[5.5px] uppercase tracking-[0.1em] text-faint">
                  {entry.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Juego activo">
        {tab === "ritmo" && <GroovePadDual />}
        {tab === "melodia" && <IntervalHunter />}
        {tab === "armonia" && <ChordArchitect />}
      </section>

      <GroupClass />

      <section aria-label="Cómo se entrena">
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              icon: Ear,
              title: "Oído",
              copy: "Reconocer antes de nombrar.",
            },
            {
              icon: Gamepad2,
              title: "Tacto",
              copy: "La mano recuerda la forma.",
            },
            {
              icon: Sparkles,
              title: "Perfil",
              copy: "Cada reto suma XP real.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-[16px] border border-white/[0.045] bg-white/[0.015] p-3"
            >
              <item.icon size={12} className="text-glow/65" />
              <p className="mt-2 text-[9px] font-semibold text-ivory/80">
                {item.title}
              </p>
              <p className="mt-1 text-[8px] leading-relaxed text-faint">
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-center gap-2 pb-2 opacity-60">
        <Gamepad2 size={11} className="text-faint" />
        <span className="text-[7.5px] font-semibold uppercase tracking-[0.18em] text-faint">
          Fase 3 · Juegos de oído
        </span>
      </div>
    </div>
  );
}
