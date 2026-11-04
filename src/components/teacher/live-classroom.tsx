"use client";

import {
  Activity,
  Clock3,
  Gauge,
  RefreshCw,
  Signal,
  SignalZero,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHeading } from "@/components/ui/section-heading";
import type { LiveClassroomData, LiveClassroomStudent } from "@/lib/academy";
import { getLiveClassroomAction } from "@/server/actions/live";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;

const AVATAR_TONE: Record<string, string> = {
  sapphire: "bg-[linear-gradient(145deg,#1a63c7,#0a2f63)] text-[#dbeeff]",
  cyan: "bg-[linear-gradient(145deg,#1a8fb7,#0a425e)] text-[#dcf7ff]",
  slate: "bg-[linear-gradient(145deg,#3a4c63,#18222f)] text-[#e6edf5]",
};

const SKILL_ROWS = [
  { key: "melody" as const, label: "Melodía", color: "#38BDF8" },
  { key: "harmony" as const, label: "Armonía", color: "#0D6EFD" },
  { key: "rhythm" as const, label: "Ritmo", color: "#F2B45C" },
];

const TAB_LABEL: Record<string, string> = {
  mapa: "Mapa",
  estudio: "Estudio",
  juegos: "Juegos",
  profesor: "Profesor",
  "sin actividad": "Sin actividad",
};

function relativeTime(iso: string | null) {
  if (!iso) return "sin actividad";
  const delta = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(delta) || delta < 0) return "ahora";
  const seconds = Math.round(delta / 1000);
  if (seconds < 10) return "ahora";
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}

function ScoreRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[48px] flex-none text-[6.5px] font-semibold uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      <span className="relative h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            boxShadow: `0 0 8px ${color}55`,
          }}
        />
      </span>
      <span className="w-[22px] flex-none text-right text-[8px] font-semibold tabular-nums text-ivory/80">
        {value}
      </span>
    </div>
  );
}

export function LiveClassroomCard({
  student,
  onGrade,
}: {
  student: LiveClassroomStudent;
  onGrade: (student: LiveClassroomStudent) => void;
}) {
  return (
    <LiveCardShell>
      <div className="flex items-start gap-2.5">
        <span className="relative flex-none">
          <span
            className={cn(
              "grid h-9 w-9 place-items-center rounded-[11px] text-[9.5px] font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]",
              AVATAR_TONE[student.avatarTone] ?? AVATAR_TONE.sapphire,
            )}
          >
            {student.initials}
          </span>
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a1420]",
              student.online
                ? student.practicing
                  ? "bg-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                  : "bg-emerald-300"
                : "bg-white/20",
            )}
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-semibold text-ivory/90">
              {student.name}
            </p>
            <span
              className={cn(
                "flex flex-none items-center gap-1 text-[6px] font-semibold uppercase tracking-[0.12em]",
                student.online
                  ? student.practicing
                    ? "text-glow"
                    : "text-emerald-300/85"
                  : "text-faint/60",
              )}
            >
              {student.online ? (
                student.practicing ? (
                  <Activity size={8} />
                ) : (
                  <Signal size={8} />
                )
              ) : (
                <SignalZero size={8} />
              )}
              {student.online
                ? student.practicing
                  ? "Practicando"
                  : "Conectado"
                : "Desconectado"}
            </span>
          </div>

          <p className="mt-0.5 truncate text-[7.5px] text-faint">
            N{String(student.levelOrdinal).padStart(2, "0")} · {student.levelTitle}
            <span className="text-faint/50"> · {TAB_LABEL[student.tab] ?? student.tab}</span>
          </p>
          <p className="mt-0.5 truncate text-[7px] text-faint/70">
            {student.exercise || "Sin ejercicio activo"}
            {student.keyLabel ? ` · ${student.keyLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-2.5 space-y-1.5">
        {SKILL_ROWS.map((row) => (
          <ScoreRow
            key={row.key}
            label={row.label}
            value={student[row.key]}
            color={row.color}
          />
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[6px] font-semibold uppercase tracking-[0.1em] text-faint/70">
            <span>Progreso del nivel</span>
            <span className="tabular-nums">{student.progress}%</span>
          </div>
          <span className="mt-1 block h-[3px] overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="block h-full rounded-full bg-[linear-gradient(90deg,#0D6EFD,#38BDF8)] transition-[width] duration-700"
              style={{ width: `${student.progress}%` }}
            />
          </span>
        </div>
        <button
          type="button"
          onClick={() => onGrade(student)}
          className="neu-button h-8 min-h-0 flex-none rounded-[10px] px-2.5 text-[7.5px]"
        >
          <Gauge size={11} />
          Evaluar
        </button>
      </div>
    </LiveCardShell>
  );
}

function LiveCardShell({ children }: { children: React.ReactNode }) {
  return (
    <article className="neu-card rounded-[18px] px-3.5 py-3 transition-transform duration-300 hover:-translate-y-0.5">
      {children}
    </article>
  );
}

export function LiveClassroom({
  onGrade,
}: {
  onGrade: (student: LiveClassroomStudent) => void;
}) {
  const [data, setData] = useState<LiveClassroomData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const result = await getLiveClassroomAction();
        if (cancelled) return;
        if (result.ok) {
          setData(result.data);
          setError(null);
          setTick((value) => value + 1);
        } else {
          setError(result.error);
        }
      } catch {
        if (!cancelled) setError("No se pudo leer el salón en vivo.");
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const students = data?.students ?? [];
  const activeCount = data?.activeCount ?? 0;
  const connected = students.filter((student) => student.online);
  const offline = students.filter((student) => !student.online);

  return (
    <section aria-labelledby="salon-vivo">
      <SectionHeading
        id="salon-vivo"
        index="01"
        title="Salón en Vivo"
        meta={
          <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.14em] text-glow/85">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
            </span>
            Tiempo real · {activeCount} activo{activeCount === 1 ? "" : "s"}
          </span>
        }
      />

      <div className="mt-3 flex items-center justify-between px-1 text-[7px] text-faint/70">
        <span className="flex items-center gap-1">
          <RefreshCw size={8} className="text-glow/60" />
          Se actualiza cada 3 s
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <Clock3 size={8} />
          {data ? new Date(data.updatedAt).toLocaleTimeString("es-ES") : "—"}
        </span>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 rounded-[12px] border border-ember/15 bg-ember/[0.04] px-3 py-2 text-[8px] text-ember/90">
          <WifiOff size={10} />
          {error}
        </p>
      )}

      {!data ? (
        <div className="mt-3 space-y-2.5">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="neu-card h-[132px] animate-pulse rounded-[18px] opacity-60"
            />
          ))}
        </div>
      ) : students.length === 0 ? (
        <p className="neu-card mt-3 rounded-[18px] px-4 py-5 text-center text-[8.5px] leading-relaxed text-faint">
          Todavía no hay alumnos. Añade el primero en la sección Alumnos.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {connected.map((student) => (
            <LiveClassroomCard
              key={`${student.studentId}-${tick}`}
              student={student}
              onGrade={onGrade}
            />
          ))}

          {offline.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-[12px] px-2 py-2 text-[7px] font-semibold uppercase tracking-[0.14em] text-faint transition-colors hover:text-muted">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={9} className="text-faint/60" />
                  {offline.length} sin conexión
                </span>
                <span className="text-[6px] normal-case tracking-normal text-faint/50 group-open:hidden">
                  Mostrar
                </span>
              </summary>
              <div className="mt-2 space-y-2.5 opacity-70">
                {offline.map((student) => (
                  <div key={student.studentId}>
                    <div className="mb-1 flex items-center justify-between px-1 text-[6.5px] text-faint/60">
                      <span className="truncate">{student.name}</span>
                      <span>{relativeTime(student.lastSeenAt)}</span>
                    </div>
                    <LiveClassroomCard student={student} onGrade={onGrade} />
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
