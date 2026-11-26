"use client";

import { CloudOff, Flame, Loader2, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
      className="neu-pill hidden min-[355px]:flex h-9 min-h-0 gap-1.5 border-ember/15 bg-ember/[0.06] px-2.5 py-1 text-ember sm:flex"
      title={`Racha de estudio: ${activeStudent.streakDays} días`}
    >
      <Flame
        size={13}
        className="animate-ember-flicker drop-shadow-[0_0_5px_rgba(242,180,92,0.55)]"
        fill="currentColor"
        strokeWidth={1.4}
      />
      <span className="flex items-baseline gap-1">
        <span className="text-[13px] font-bold leading-none tracking-tight text-white">
          {activeStudent.streakDays}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ember/90">
          días
        </span>
      </span>
    </div>
  );
}

/**
 * The single visible state of the student's connection, in the words of §7.
 *
 * Two rules make this component honest:
 *  - "Todo guardado" requires `hydrated`, i.e. the progress tables were read,
 *    not merely the profile. Reaching the server for `students` alone never
 *    authorises that sentence.
 *  - The words are always rendered. At 320 px there is no room for a chip, so
 *    the label moves to its own full-width line under the selector instead of
 *    being hidden behind a breakpoint.
 */
function SyncStatus() {
  const {
    offlineMode,
    syncState,
    pendingSync,
    progressState,
    hydrated,
    teacherMode,
    reloadProgress,
  } = useAcademy();

  const [busy, setBusy] = useState(false);

  // The teacher panel reports its own backup state; this line speaks to the
  // student about the student's own progress.
  if (teacherMode) return null;

  let label: string;
  let tone: string;
  let Icon = Wifi;

  if (offlineMode || syncState === "offline") {
    label = "Guardado aquí. Se enviará cuando vuelva el internet.";
    tone = "text-ember";
    Icon = WifiOff;
  } else if (progressState === "loading" || syncState === "syncing") {
    label = "Buscando tu progreso…";
    tone = "text-glow";
    Icon = Loader2;
  } else if (progressState === "error") {
    label = "No pudimos traer tu progreso. Tus datos siguen aquí.";
    tone = "text-ember";
    Icon = CloudOff;
  } else if (pendingSync > 0) {
    label = "Guardado aquí. Se enviará cuando vuelva el internet.";
    tone = "text-ember";
    Icon = WifiOff;
  } else if (hydrated) {
    label = "Todo guardado";
    tone = "text-glow";
    Icon = Wifi;
  } else {
    // Profile only: never claim the progress is safe.
    label = "Buscando tu progreso…";
    tone = "text-glow";
    Icon = Loader2;
  }

  const canRetry =
    !offlineMode && (progressState === "error" || pendingSync > 0);

  return (
    <div className="mt-2 flex w-full items-center gap-2" aria-live="polite">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={cn(
            "status-dot shrink-0",
            (syncState === "syncing" || progressState === "loading") &&
              "animate-dot-pulse",
          )}
        />
        <span
          className={cn(
            "text-[10px] font-semibold leading-tight tracking-[0.02em]",
            tone,
          )}
        >
          {label}
        </span>
      </div>

      {canRetry && (
        <button
          type="button"
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await reloadProgress();
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="flex-none rounded-full border border-white/12 bg-white/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-200 disabled:opacity-50"
        >
          {busy ? "Buscando…" : "Reintentar"}
        </button>
      )}

      <Icon
        size={11}
        className={cn("hidden shrink-0 min-[360px]:block", tone)}
        aria-hidden
      />
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
          </Link>

          <div className="flex flex-none items-center gap-1.5">
            <StudentTourButton />
            <StreakChip />
            <OfflineToggle />
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2.5">
          <StudentSelector />
        </div>

        {/* The status owns its own line so its text never has to hide: at
            320 px there is simply no horizontal room next to the selector. */}
        <SyncStatus />
      </div>
    </header>
  );
}
