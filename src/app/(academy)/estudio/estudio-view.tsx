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
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="status-dot text-glow" />
            <p className="eyebrow">Estudio · Afinación 440 Hz</p>
          </div>
          <h1 className="mt-3 font-display text-[40px] leading-[0.92] tracking-[-0.035em] text-ivory">
            El <em className="sapphire-text font-normal italic">estudio</em>
            <span className="text-glow">.</span>
          </h1>
          <p className="mt-2.5 max-w-[255px] text-[11px] leading-relaxed text-muted">
            Siente la tecla antes de nombrarla. Un piano cálido, sin cables y
            sin prisa.
          </p>
        </div>

        <div className="neu-inset hidden h-[74px] w-[74px] flex-none items-center justify-center rounded-[24px] min-[370px]:flex">
          <div className="relative">
            <Piano size={25} strokeWidth={1.1} className="text-glow/70" />
            <Sparkles
              size={10}
              className="absolute -right-2 -top-1.5 text-cyan-200/60"
            />
          </div>
        </div>
      </header>

      <div
        className="neu-inset grid grid-cols-3 gap-1 rounded-[17px] p-1"
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
                "relative flex min-h-[42px] items-center justify-center gap-1.5 rounded-[13px] text-[10px] font-semibold transition-colors duration-300",
                active ? "text-ivory" : "text-faint hover:text-muted",
              )}
            >
              {active && (
                <motion.span
                  layoutId="studio-tab"
                  transition={{ type: "spring", stiffness: 480, damping: 38 }}
                  className="absolute inset-0 rounded-[13px] border border-white/[0.07] bg-[linear-gradient(145deg,#122947,#0b192c)] shadow-[inset_3px_3px_8px_#03070D,inset_-2px_-2px_6px_rgba(30,95,180,0.12),0_0_18px_rgba(13,110,253,0.08)]"
                />
              )}
              <Icon
                size={13}
                strokeWidth={active ? 2.1 : 1.6}
                className={cn(
                  "relative z-10",
                  active && "text-glow drop-shadow-[0_0_7px_rgba(56,189,248,0.35)]",
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
