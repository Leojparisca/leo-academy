"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Flame,
  KeyRound,
  Lock,
  LogOut,
  Smartphone,
  Sparkles,
  Unlock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { getMyStudentCodeAction, logoutStudentAction } from "@/server/actions/student-auth";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  sapphire:
    "bg-[linear-gradient(145deg,#1a63c7,#0a2f63)] text-[#dbeeff] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
  cyan: "bg-[linear-gradient(145deg,#1a8fb7,#0a425e)] text-[#dcf7ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]",
  slate:
    "bg-[linear-gradient(145deg,#3a4c63,#18222f)] text-[#e6edf5] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
};

export function StudentSelector() {
  const router = useRouter();
  const {
    students,
    activeStudent,
    setActiveStudentId,
    offlineMode,
    teacherMode,
    canSwitchStudents,
    passThePhone,
    enablePassThePhone,
    disablePassThePhone,
  } = useAcademy();
  const [open, setOpen] = useState(false);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  // Guest on the teacher gate: no student chip at all.
  if (!activeStudent && !teacherMode) return null;

  // Empty academy (teacher mode with no students yet): no fictional profile.
  if (!activeStudent) {
    return (
      <div className="relative min-w-0 flex-1">
        <Link
          href="/profesor"
          className="neu-pill min-h-[40px] w-full max-w-[230px] justify-start gap-2.5 px-2.5 text-left"
        >
          <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-white/[0.04] text-faint">
            <Sparkles size={12} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[8px] font-semibold uppercase tracking-[0.2em] text-faint">
              Sin alumnos
            </span>
            <span className="block truncate text-[12px] font-semibold leading-tight text-ivory">
              Registrar el primero
            </span>
          </span>
        </Link>
      </div>
    );
  }

  const locked = !canSwitchStudents;

  const revealCode = async () => {
    if (codeBusy) return;
    setCodeBusy(true);
    const result = await getMyStudentCodeAction();
    if (result.ok) setMyCode(result.data.code ?? "—");
    setCodeBusy(false);
  };

  const logout = async () => {
    if (leaving) return;
    setLeaving(true);
    await logoutStudentAction();
    router.refresh();
  };

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup={locked ? "dialog" : "listbox"}
        aria-expanded={open}
        aria-label={
          locked
            ? `Mi progreso: ${activeStudent.name}`
            : `Alumno activo: ${activeStudent.name}. Cambiar alumno`
        }
        className="neu-pill group min-h-[40px] w-full max-w-[230px] justify-start gap-2.5 py-1.5 pl-1.5 pr-2.5 text-left transition-[border-color,box-shadow] hover:border-white/10"
      >
        <span
          className={cn(
            "grid h-7 w-7 flex-none place-items-center rounded-[9px] text-[10px] font-bold tracking-wide",
            TONE[activeStudent.avatarTone] ?? TONE.sapphire,
          )}
        >
          {activeStudent.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.2em] text-faint">
            {locked ? "Mi progreso" : passThePhone ? "Pasa el teléfono" : "Alumno activo"}
            {locked && <Lock size={8} className="text-glow/70" />}
          </span>
          <span className="block truncate text-[12px] font-semibold leading-tight text-ivory">
            {activeStudent.firstName}
          </span>
        </span>
        {locked ? (
          <Lock size={12} className="flex-none text-faint" />
        ) : (
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={cn(
              "flex-none text-faint transition-transform duration-300",
              open && "-rotate-180 text-glow",
            )}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="neu-card absolute left-0 top-[calc(100%+10px)] z-50 w-[min(82vw,290px)] overflow-hidden rounded-[22px] p-2"
            role={locked ? "dialog" : "listbox"}
            aria-label={locked ? "Mi perfil privado" : "Seleccionar alumno"}
          >
            {locked ? (
              <div className="px-1.5 pb-1 pt-1.5">
                <div className="flex items-center justify-between px-1">
                  <p className="eyebrow text-[8px]">Perfil privado</p>
                  <span className="flex items-center gap-1 text-[9px] text-glow/80">
                    <Lock size={9} />
                    Solo tú
                  </span>
                </div>

                <p className="mt-2 rounded-[12px] border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 text-[9px] leading-[1.55] text-faint">
                  {activeStudent.name}, este dispositivo muestra únicamente tu
                  progreso. El selector de alumnos se abre con el profe o en
                  Modo Sin Luz · Pasa el Teléfono.
                </p>

                {myCode && (
                  <div className="mt-2 flex items-center justify-between rounded-[12px] border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
                      <KeyRound size={10} />
                      Mi código
                    </span>
                    <span className="font-display text-[14px] tracking-[0.16em] text-ivory">
                      {myCode}
                    </span>
                  </div>
                )}

                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => void revealCode()}
                    disabled={codeBusy}
                    className="flex w-full items-center gap-2 rounded-[12px] px-2.5 py-2 text-left text-[9.5px] font-semibold text-muted transition-colors hover:bg-white/[0.035] hover:text-ivory disabled:opacity-50"
                  >
                    <KeyRound size={12} className="text-glow/80" />
                    {codeBusy ? "Buscando…" : "Ver mi código de alumno"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void enablePassThePhone();
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-2 rounded-[12px] px-2.5 py-2 text-left transition-colors hover:bg-ember/[0.06]"
                  >
                    <Smartphone size={12} className="mt-0.5 flex-none text-ember" />
                    <span>
                      <span className="block text-[9.5px] font-semibold text-ivory/85">
                        Modo Sin Luz · Pasa el Teléfono
                      </span>
                      <span className="mt-0.5 block text-[8px] leading-snug text-faint">
                        El grupo puede turnarse este dispositivo.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void logout()}
                    disabled={leaving}
                    className="flex w-full items-center gap-2 rounded-[12px] px-2.5 py-2 text-left text-[9.5px] font-semibold text-faint transition-colors hover:bg-white/[0.035] hover:text-ivory disabled:opacity-50"
                  >
                    <LogOut size={12} />
                    {leaving ? "Saliendo…" : "Salir de mi perfil"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2.5 pb-2 pt-1">
                  <p className="eyebrow text-[8px]">
                    {passThePhone ? "Pasa el teléfono" : "Sendero activo"}
                  </p>
                  <span className="flex items-center gap-1 text-[9px] text-faint">
                    <Sparkles size={10} className="text-glow" />
                    {students.length} alumnos
                  </span>
                </div>

                {passThePhone && (
                  <button
                    type="button"
                    onClick={() => {
                      disablePassThePhone();
                      setOpen(false);
                    }}
                    className="mb-1 flex w-full items-center gap-1.5 rounded-[10px] border border-ember/20 bg-ember/[0.05] px-2.5 py-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-ember"
                  >
                    <Unlock size={10} />
                    Terminar turno · volver a mi perfil
                  </button>
                )}

                <div className="max-h-[46vh] space-y-1 overflow-y-auto scrollbar-none">
                  {students.map((student) => {
                    const isActive = student.id === activeStudent.id;
                    return (
                      <button
                        key={student.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => {
                          setActiveStudentId(student.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-[14px] px-2 py-2 text-left transition-colors",
                          isActive
                            ? "bg-white/[0.055]"
                            : "hover:bg-white/[0.035]",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-8 w-8 flex-none place-items-center rounded-[10px] text-[10px] font-bold",
                            TONE[student.avatarTone] ?? TONE.sapphire,
                          )}
                        >
                          {student.initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-ivory">
                            {student.name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-[9.5px] text-faint">
                            <span>
                              Nivel {String(student.currentLevel).padStart(2, "0")}
                            </span>
                            <span className="flex items-center gap-0.5 text-ember/80">
                              <Flame size={9} />
                              {student.streakDays}
                            </span>
                          </span>
                        </span>
                        {isActive && (
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-royal/20 text-glow">
                            <Check size={11} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-1.5 border-t border-white/5 px-2.5 pb-1 pt-2 text-[9px] leading-relaxed text-faint">
                  {teacherMode
                    ? "Modo Profesor: puedes cambiar de alumno para evaluar."
                    : passThePhone
                      ? "Turno de grupo: el progreso se sincroniza al terminar."
                      : offlineMode
                        ? "Modo Sin Luz: el cambio también funciona sin conexión."
                        : "El progreso de cada alumno vive en este dispositivo y en la academia."}
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
