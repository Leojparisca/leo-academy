"use client";

import {
  CheckCircle2,
  CloudUpload,
  Database,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useAcademy } from "@/components/providers/academy-provider";
import { SectionHeading } from "@/components/ui/section-heading";
import type { BackupState } from "@/lib/backup";
import { cn } from "@/lib/utils";
import { exportServerBackupAction } from "@/server/actions/export";
import { useState } from "react";

const STATUS: Record<
  BackupState,
  {
    label: string;
    hint: string;
    icon: typeof CheckCircle2;
    tone: string;
    ring: string;
  }
> = {
  device: {
    label: "100% Guardado en Dispositivo",
    hint: "Tu progreso vive en IndexedDB. Aún no ha viajado a SQLite.",
    icon: HardDrive,
    tone: "text-glow",
    ring: "border-cyan-300/20 bg-cyan-300/[0.05]",
  },
  syncing: {
    label: "Blindando respaldo…",
    hint: "Validando con Zod y escribiendo en una sola transacción.",
    icon: Loader2,
    tone: "text-glow",
    ring: "border-cyan-300/25 bg-cyan-300/[0.07]",
  },
  synced: {
    label: "Sincronizado con Servidor",
    hint: "El volcado del dispositivo ya está a salvo en SQLite.",
    icon: CheckCircle2,
    tone: "text-emerald-300",
    ring: "border-emerald-300/25 bg-emerald-300/[0.06]",
  },
  error: {
    label: "Respaldo pendiente",
    hint: "Nada se ha perdido: el dispositivo conserva cada registro.",
    icon: TriangleAlert,
    tone: "text-ember",
    ring: "border-ember/25 bg-ember/[0.06]",
  },
};

function formatStamp(iso: string | null) {
  if (!iso) return "Todavía sin respaldo";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Todavía sin respaldo";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function BackupPanel() {
  const {
    backupState,
    backupStats,
    lastBackupAt,
    backupToServer,
    offlineMode,
    notify,
  } = useAcademy();
  const [exporting, setExporting] = useState(false);

  const status = STATUS[backupState];
  const Icon = status.icon;
  const busy = backupState === "syncing";
  const dirty = (backupStats?.dirtyRows ?? 0) + (backupStats?.pendingSessions ?? 0);

  async function downloadServerBackup() {
    setExporting(true);
    try {
      const result = await exportServerBackupAction();
      if (!result.ok) {
        notify(result.error, "warning");
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const stamp = result.data.generatedAt.slice(0, 10);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `leo-academy-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      notify(
        `Respaldo del servidor descargado · ${result.data.summary.students} alumnos.`,
        "success",
      );
    } catch {
      notify("No se pudo descargar el respaldo del servidor.", "warning");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section aria-labelledby="respaldo">
      <SectionHeading
        id="respaldo"
        index="06"
        title="Respaldo blindado"
        meta={
          <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-faint">
            <ShieldCheck size={9} />
            SQLite
          </span>
        }
      />

      <div className="neu-card mt-3 overflow-hidden rounded-[22px]">
        <div className="flex items-start gap-3 p-4">
          <span
            className={cn(
              "grid h-11 w-11 flex-none place-items-center rounded-[14px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
              status.ring,
            )}
          >
            <Icon
              size={19}
              className={cn(
                status.tone,
                busy && "animate-spin",
                backupState === "synced" &&
                  "drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]",
              )}
            />
          </span>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[10.5px] font-bold leading-tight",
                status.tone,
              )}
            >
              {status.label}
            </p>
            <p className="mt-1 text-[8px] leading-[1.55] text-faint">
              {status.hint}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/[0.055] border-y border-white/[0.055]">
          {[
            {
              icon: Database,
              label: "Registros",
              value: backupStats ? String(backupStats.totalRows) : "—",
              small: false,
            },
            {
              icon: RefreshCw,
              label: "Pendientes",
              value: backupStats ? String(dirty) : "—",
              small: false,
            },
            {
              icon: ShieldCheck,
              label: "Último",
              value: formatStamp(lastBackupAt),
              small: true,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 px-1 py-2.5"
            >
              <stat.icon size={10} className="text-glow/55" />
              <span
                className={cn(
                  "font-display leading-none text-ivory",
                  stat.small ? "text-[9px] text-center" : "text-[16px]",
                )}
              >
                {stat.value}
              </span>
              <span className="text-[6px] font-semibold uppercase tracking-[0.13em] text-faint">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2.5 p-4">
          <button
            type="button"
            onClick={() => void backupToServer()}
            disabled={busy || offlineMode}
            className="neu-button neu-button--primary w-full rounded-[14px] py-3 text-[10.5px] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CloudUpload size={14} />
            )}
            {busy ? "Blindando respaldo…" : "Sincronizar respaldo"}
          </button>

          <button
            type="button"
            onClick={() => void downloadServerBackup()}
            disabled={exporting}
            className="neu-button w-full rounded-[14px] py-3 text-[10.5px] disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {exporting
              ? "Preparando JSON…"
              : "Descargar respaldo JSON"}
          </button>

          {offlineMode ? (
            <p className="flex items-start gap-1.5 text-[7.5px] leading-snug text-ember/85">
              <WifiOff size={10} className="mt-px flex-none" />
              Modo Sin Luz activo. Desactívalo para enviar el respaldo al
              servidor; mientras tanto todo sigue guardado en el dispositivo.
            </p>
          ) : (
            <p className="text-[7.5px] leading-snug text-faint/80">
              El volcado viaja validado con Zod. El profesor conserva nombre,
              nivel, edad y notas: el dispositivo solo actualiza minutos,
              precisión, estrellas y XP.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
