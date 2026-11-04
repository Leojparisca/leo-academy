"use client";

import { motion } from "framer-motion";
import { Drum, FlaskConical, Piano, Sparkles } from "lucide-react";
import { useState } from "react";
import { KeyboardStudio } from "@/components/studio/keyboard-studio";
import { LabStudio } from "@/components/studio/lab-studio";
import { RhythmStudio } from "@/components/studio/rhythm-studio";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "keyboard" as const, label: "Teclado", icon: Piano },
  { id: "lab" as const, label: "Laboratorio", icon: FlaskConical },
  { id: "rhythm" as const, label: "Ritmo", icon: Drum },
];

export function EstudioView() {
  const [tab, setTab] = useState<"keyboard" | "lab" | "rhythm">("keyboard");

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Estudio · Afinación 440 Hz
          </p>
        </div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.02em] text-white">
          El <span className="text-sky-300">estudio</span>.
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[10px] font-semibold text-slate-300">
            <Piano size={11} className="text-sky-400" />
            Piano cálido
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[10px] font-semibold text-slate-300">
            <Sparkles size={11} className="text-[#F5C15A]" />
            Sin cables
          </span>
        </div>
      </header>

      <div
        className="grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.08] bg-[#0E1524]/70 p-1 backdrop-blur-xl"
        role="tablist"
        aria-label="Secciones del estudio"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={active}
              aria-controls={`panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={cn(
                "relative flex min-h-[50px] items-center justify-center gap-1.5 rounded-xl text-[11px] font-semibold transition-colors duration-300",
                active ? "text-white" : "text-slate-400 hover:text-slate-200",
              )}
            >
              {active && (
                <motion.span
                  layoutId="studio-tab"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  className="nav-pool absolute inset-0 rounded-xl"
                />
              )}
              <Icon
                size={14}
                strokeWidth={active ? 2.1 : 1.7}
                className={cn(
                  "relative z-10",
                  active && "text-sky-300 drop-shadow-[0_0_7px_rgba(56,189,248,0.45)]",
                )}
              />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="panel-keyboard"
        aria-labelledby="tab-keyboard"
        hidden={tab !== "keyboard"}
      >
        <KeyboardStudio active={tab === "keyboard"} />
      </div>
      <div
        role="tabpanel"
        id="panel-lab"
        aria-labelledby="tab-lab"
        hidden={tab !== "lab"}
      >
        <LabStudio active={tab === "lab"} />
      </div>
      <div
        role="tabpanel"
        id="panel-rhythm"
        aria-labelledby="tab-rhythm"
        hidden={tab !== "rhythm"}
      >
        <RhythmStudio active={tab === "rhythm"} />
      </div>
    </div>
  );
}
