"use client";

import { Flame, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { useAcademy } from "@/components/providers/academy-provider";
import { cn } from "@/lib/utils";
import { OfflineToggle } from "./offline-toggle";
import { StudentSelector } from "./student-selector";
import { StudentTourButton } from "./student-tour";

function StreakChip() {
  const { activeStudent } = useAcademy();

  if (!activeStudent) return null;

  return (
    <div
      className="neu-pill hidden min-[355px]:flex h-9 min-h-0 gap-1.5 border-ember/10 px-2 py-1 text-ember/90 sm:flex"
      title={`Racha de estudio: ${activeStudent.streakDays} días`}
    >
      <Flame
        size={13}
        className="animate-ember-flicker drop-shadow-[0_0_5px_rgba(242,180,92,0.55)]"
        fill="currentColor"
        strokeWidth={1.4}
      />
      <span className="flex items-baseline gap-1">
        <span className="text-[13px] font-bold leading-none tracking-tight text-ivory">
          {activeStudent.streakDays}
        </span>
        <span className="text-[7.5px] font-semibold uppercase tracking-[0.13em] text-faint">
          días
        </span>
      </span>
    </div>
  );
}

function SyncStatus() {
  const { offlineMode, syncState, pendingSync, dataSource } = useAcademy();

  let label = "En dispositivo";
  let tone = "text-faint";
  let Icon = WifiOff;

  if (offlineMode) {
    label = pendingSync > 0 ? `${pendingSync} en cola` : "Sin luz";
    tone = "text-ember";
    Icon = WifiOff;
  } else if (syncState === "syncing") {
    label = "Sincronizando";
    tone = "text-glow";
    Icon = Wifi;
  } else if (syncState === "error") {
    label = "En cola";
    tone = "text-ember";
    Icon = WifiOff;
  } else if (pendingSync > 0) {
    label = `${pendingSync} en cola`;
    tone = "text-ember";
    Icon = WifiOff;
  } else if (dataSource === "server") {
    label = "Sincronizado";
    tone = "text-glow";
    Icon = Wifi;
  }

  return (
    <div
      className={cn(
        "hidden min-[398px]:flex items-center gap-1.5",
        "text-[8px] font-semibold uppercase tracking-[0.16em]",
        tone,
      )}
      aria-live="polite"
    >
      <span className={cn("status-dot", syncState === "syncing" && "animate-dot-pulse")} />
      <span className="hidden min-[430px]:inline">{label}</span>
      <Icon size={10} className="min-[430px]:hidden" />
    </div>
  );
}

export function Header() {
  return (
    <header className="header-shell fixed inset-x-0 top-0 z-40">
      <div className="mx-auto w-full max-w-[560px] px-5 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.7rem)] sm:px-7">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/mapa"
            className="group flex min-w-0 items-center gap-2.5 rounded-xl"
            aria-label="Leo Academy, ir al mapa"
          >
            <BrandMark size={42} priority className="transition-transform duration-500 group-hover:scale-[1.03]" />
            <span className="min-w-0">
              <span className="block truncate font-display text-[18px] font-medium leading-none tracking-[-0.015em] text-ivory">
                Leo Academy
              </span>
              <span className="mt-1 block truncate text-[7px] font-semibold uppercase tracking-[0.23em] text-faint">
                Piano · Teoría
                <span className="hidden min-[420px]:inline"> · Armonía</span>
              </span>
            </span>
          </Link>

          <div className="flex flex-none items-center gap-1.5">
            <StudentTourButton />
            <StreakChip />
            <OfflineToggle />
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2.5">
          <StudentSelector />
          <div className="ml-auto flex flex-none items-center">
            <SyncStatus />
          </div>
        </div>
      </div>
    </header>
  );
}
