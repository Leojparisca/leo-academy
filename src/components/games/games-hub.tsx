"use client";

import { motion } from "framer-motion";
import {
  AudioLines,
  Gamepad2,
  Piano,
  Star,
  Target,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { ChordArchitect } from "@/components/games/chord-architect";
import { GroovePadDual } from "@/components/games/groove-pad-dual";
import { GroupClass } from "@/components/games/group-class";
import { IntervalHunter } from "@/components/games/interval-hunter";
import type { Skill } from "@/lib/academy";
import { cn } from "@/lib/utils";

type GameId = "ritmo" | "melodia" | "armonia";

const GAMES: Array<{
  id: GameId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  skill: Skill;
  color: string;
}> = [
  {
    id: "ritmo",
    title: "Groove Pad",
    subtitle: "Ritmo a dos manos",
    icon: Waves,
    skill: "rhythm",
    color: "#38BDF8",
  },
  {
    id: "melodia",
    title: "Caza-Intervalos",
    subtitle: "Entrenamiento auditivo",
    icon: AudioLines,
    skill: "melody",
    color: "#22D3EE",
  },
  {
    id: "armonia",
    title: "Arquitecto de Acordes",
    subtitle: "Armonía práctica",
    icon: Piano,
    skill: "harmony",
    color: "#9DB5FF",
  },
];

export function GamesHub() {
  const [tab, setTab] = useState<GameId>("ritmo");
  const { activeStudent, skillScores, xpByStudent } = useAcademy();

  const bestBySkill = useMemo(() => {
    const best: Record<string, number> = {};
    for (const score of skillScores) {
      const current = best[score.skill] ?? 0;
      if (score.score > current) best[score.skill] = score.score;
    }
    return best;
  }, [skillScores]);

  const xp = activeStudent ? (xpByStudent[activeStudent.id] ?? 0) : 0;
  const accuracy = activeStudent?.accuracy ?? 0;

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Juegos · Oído y pulso
              </p>
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.02em] text-white">
              Entrena tu oído.
            </h1>
          </div>
          <div className="grid h-12 w-12 flex-none place-items-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
            <Gamepad2 size={22} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0E1524]/80 px-3 py-2.5 backdrop-blur-xl">
            <Zap size={15} className="text-[#F5C15A]" fill="currentColor" />
            <span className="text-[17px] font-bold leading-none text-white">
              {xp}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              XP
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0E1524]/80 px-3 py-2.5 backdrop-blur-xl">
            <Target size={15} className="text-sky-400" />
            <span className="text-[17px] font-bold leading-none text-white">
              {accuracy}%
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Precisión
            </span>
          </div>
        </div>
      </header>

      <section aria-label="Elige un juego" className="space-y-2.5">
        {GAMES.map((game) => {
          const active = tab === game.id;
          const Icon = game.icon;
          const best = bestBySkill[game.skill] ?? 0;
          return (
            <motion.button
              key={game.id}
              type="button"
              onClick={() => {
                setTab(game.id);
                window.setTimeout(() => {
                  document
                    .getElementById("juego-activo")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 60);
              }}
              whileTap={{ scale: 0.99 }}
              aria-pressed={active}
              className={cn(
                "flex w-full items-center gap-3 rounded-3xl border p-3 text-left backdrop-blur-xl transition-colors duration-300",
                active
                  ? "border-sky-400/35 bg-sky-400/[0.07]"
                  : "border-white/[0.08] bg-[#0E1524]/80",
              )}
            >
              <span
                className="grid h-12 w-12 flex-none place-items-center rounded-2xl border"
                style={{
                  color: game.color,
                  borderColor: `${game.color}44`,
                  background: `${game.color}14`,
                }}
              >
                <Icon size={21} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold leading-tight text-white">
                  {game.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-300">
                  {game.subtitle}
                </span>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#F5C15A]/15 px-2 py-0.5 text-[10px] font-bold text-[#F5C15A]">
                  <Star size={9} fill="currentColor" />
                  {best > 0 ? `${best}%` : "Sin récord"}
                </span>
              </span>

              <span
                className={cn(
                  "flex-none rounded-full px-4 py-2.5 text-[11px] font-bold transition-colors",
                  active
                    ? "bg-white text-[#060911]"
                    : "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-500/25",
                )}
              >
                {active ? "Jugando" : "Jugar"}
              </span>
            </motion.button>
          );
        })}
      </section>

      <section id="juego-activo" aria-label="Juego activo" className="scroll-mt-32">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "ritmo" && <GroovePadDual />}
          {tab === "melodia" && <IntervalHunter />}
          {tab === "armonia" && <ChordArchitect />}
        </motion.div>
      </section>

      <GroupClass />
    </div>
  );
}
