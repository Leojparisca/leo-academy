"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarCheck,
  Check,
  MoonStar,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AttendanceMode, Student } from "@/lib/academy";
import {
  markAttendanceSynced,
  saveAttendanceBatchLocal,
} from "@/lib/local-db";
import { saveClassAttendanceAction } from "@/server/actions/teacher";
import { cn } from "@/lib/utils";

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

type Notice = {
  tone: "success" | "error" | "warning";
  message: string;
} | null;

export function BulkAttendance({
  students,
  disabled = false,
}: {
  students: Student[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(),
    mode: "normal" as AttendanceMode,
    notes: "",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Notice>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const openModal = () => {
    setForm({ date: todayISO(), mode: "normal", notes: "" });
    setSelected(new Set(students.map((student) => student.id)));
    setResult(null);
    setOpen(true);
  };

  const toggle = (studentId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const selectedIds = students
    .filter((student) => selected.has(student.id))
    .map((student) => student.id);

  const save = async () => {
    if (saving) return;
    if (!selectedIds.length) {
      setResult({
        tone: "error",
        message: "Marca al menos un alumno presente.",
      });
      return;
    }
    setSaving(true);
    setResult(null);

    const notes = form.notes.trim() || null;
    let localSaved = 0;
    try {
      localSaved = await saveAttendanceBatchLocal({
        date: form.date,
        mode: form.mode,
        notes,
        studentIds: selectedIds,
      });
    } catch {
      // IndexedDB can be blocked in private mode; SQLite is still the source
      // of truth, so the server write continues.
    }

    const response = await saveClassAttendanceAction({
      date: form.date,
      mode: form.mode,
      notes,
      studentIds: selectedIds,
    });

    if (response.ok) {
      try {
        await markAttendanceSynced(form.date, selectedIds);
      } catch {
        /* The next class save will retry the local mirror. */
      }
      setResult({
        tone: "success",
        message: `${response.data.saved} ${
          response.data.saved === 1 ? "alumno registrado" : "alumnos registrados"
        } · ${
          response.data.mode === "unplugged" ? "Modo Sin Luz" : "Clase normal"
        }.`,
      });
      router.refresh();
    } else {
      setResult({
        tone: "warning",
        message:
          localSaved > 0
            ? `Guardado en este dispositivo (${localSaved}). ${response.error}`
            : response.error,
      });
    }
    setSaving(false);
  };

  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 p-3.5 backdrop-blur-xl">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300">
          <Users size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-tight text-white">
            Pasar Lista Grupal
          </p>
          <p className="mt-0.5 text-[11px] text-slate-300">
            Toda la clase en un toque
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          disabled={disabled || students.length === 0}
          className="flex h-11 min-h-0 flex-none items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-[11px] font-bold text-white shadow-lg shadow-blue-500/25 transition-transform active:scale-95 disabled:opacity-50"
        >
          <CalendarCheck size={14} />
          Pasar lista
        </button>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] flex items-end justify-center bg-[#02050b]/80 p-0 backdrop-blur-sm sm:items-center sm:p-5"
                role="presentation"
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) setOpen(false);
                }}
              >
                <motion.div
                  initial={{ y: 40, opacity: 0, scale: 0.98 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 30, opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="bulk-attendance-title"
                  className="flex max-h-[92dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0B111D]/95 shadow-2xl shadow-black/80 backdrop-blur-2xl sm:rounded-3xl"
                >
                  <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Asistencia del salón
                      </p>
                      <h2
                        id="bulk-attendance-title"
                        className="mt-1.5 text-2xl font-bold leading-tight text-white"
                      >
                        Pasar Lista Grupal
                      </h2>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {students.length} alumnos · guarda local y nube a la vez
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Cerrar pasar lista"
                      className="grid h-10 w-10 flex-none place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-300 transition-colors hover:text-white"
                    >
                      <X size={17} />
                    </button>
                  </header>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
                          Fecha
                        </span>
                        <input
                          type="date"
                          className="neu-input min-w-0 px-2.5 text-[11px]"
                          value={form.date}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              date: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <div>
                        <span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
                          Modalidad
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          {[
                            {
                              mode: "normal" as const,
                              icon: Sun,
                              label: "Normal",
                            },
                            {
                              mode: "unplugged" as const,
                              icon: MoonStar,
                              label: "Sin Luz",
                            },
                          ].map((option) => {
                            const active = form.mode === option.mode;
                            return (
                              <button
                                key={option.mode}
                                type="button"
                                onClick={() =>
                                  setForm((current) => ({
                                    ...current,
                                    mode: option.mode,
                                  }))
                                }
                                aria-pressed={active}
                                className={cn(
                                  "flex min-h-[34px] items-center justify-center gap-1 rounded-[9px] border px-1 text-[7.5px] font-semibold transition-colors",
                                  active
                                    ? "border-cyan-300/30 bg-cyan-300/[0.06] text-ivory"
                                    : "border-white/[0.06] bg-white/[0.015] text-faint",
                                )}
                              >
                                <option.icon
                                  size={11}
                                  className={active ? "text-glow" : "text-faint"}
                                />
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
                        Nota del día
                      </span>
                      <input
                        className="neu-input"
                        value={form.notes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Ej. Conociendo el teclado y primeros acordes"
                        maxLength={400}
                      />
                    </label>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-300">
                          Presentes ({selectedIds.length}/{students.length})
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelected(
                                new Set(students.map((student) => student.id)),
                              )
                            }
                            className="rounded-full px-2 py-1 text-[10px] font-semibold text-sky-300 hover:text-sky-200"
                          >
                            Marcar todos
                          </button>
                          <span className="text-white/20">·</span>
                          <button
                            type="button"
                            onClick={() => setSelected(new Set())}
                            className="rounded-full px-2 py-1 text-[10px] font-semibold text-slate-400 hover:text-slate-200"
                          >
                            Desmarcar
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {students.map((student) => {
                          const checked = selected.has(student.id);
                          return (
                            <label
                              key={student.id}
                              className={cn(
                                "flex min-h-[54px] cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 transition-colors",
                                checked
                                  ? "border-sky-400/30 bg-sky-400/[0.08]"
                                  : "border-white/[0.07] bg-white/[0.02]",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={checked}
                                onChange={() => toggle(student.id)}
                                aria-label={`Marcar presente a ${student.name}`}
                              />
                              <span
                                aria-hidden
                                className={cn(
                                  "grid h-6 w-6 flex-none place-items-center rounded-full border transition-all",
                                  checked
                                    ? "border-sky-400/60 bg-sky-400/25 text-white shadow-[0_0_12px_rgba(56,189,248,0.35)]"
                                    : "border-white/20 bg-black/30 text-transparent",
                                )}
                              >
                                <Check size={13} strokeWidth={3} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-white">
                                  {student.name}
                                </span>
                                <span className="block text-[10px] uppercase tracking-[0.1em] text-slate-400">
                                  Nivel {student.currentLevel}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {result && (
                      <p
                        className={cn(
                          "flex items-start gap-1.5 rounded-[11px] border px-2.5 py-2 text-[8.5px] leading-snug",
                          result.tone === "success"
                            ? "border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-200/90"
                            : result.tone === "warning"
                              ? "border-ember/15 bg-ember/[0.04] text-ember/90"
                              : "border-red-400/15 bg-red-400/[0.04] text-red-300/90",
                        )}
                      >
                        {result.tone === "success" ? (
                          <Sparkles size={11} className="mt-0.5 flex-none" />
                        ) : null}
                        {result.message}
                      </p>
                    )}
                  </div>

                  <footer className="border-t border-white/[0.07] px-5 py-4">
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={saving || selectedIds.length === 0}
                      className="neu-button neu-button--primary w-full text-[14px] disabled:opacity-50"
                    >
                      <CalendarCheck size={17} />
                      {saving
                        ? "Guardando asistencia…"
                        : "Guardar Asistencia de Clase"}
                    </button>
                  </footer>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
