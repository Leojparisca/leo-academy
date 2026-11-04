"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Ear,
  Gamepad2,
  Hand,
  Headphones,
  Maximize2,
  Music2,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { cn } from "@/lib/utils";

export const STUDENT_TOUR_EVENT = "leo:open-student-tour";
const TOUR_KEY_PREFIX = "leo.hasSeenTour.";

type TourStep = {
  eyebrow: string;
  title: string;
  body: string;
  icon: typeof Sparkles;
  visual: React.ReactNode;
};

const MAP_STEPS = [
  { label: "Sentir", icon: Hand },
  { label: "Escuchar", icon: Headphones },
  { label: "Comprender", icon: Music2 },
  { label: "Reto", icon: Sparkles },
] as const;

const STEPS: TourStep[] = [
  {
    eyebrow: "Bienvenido a Leo Academy",
    title: "Tu camino musical empieza aquí",
    body: "Cada tecla que toques cuenta. Tu progreso es privado, se guarda en este dispositivo y se sincroniza con la academia cuando hay conexión.",
    icon: Sparkles,
    visual: (
      <div className="flex items-center justify-center gap-1.5">
        {["Do", "Re", "Mi", "Fa", "Sol"].map((note, index) => (
          <span
            key={note}
            className={cn(
              "grid h-11 w-8 place-items-end justify-center rounded-b-[8px] border border-white/10 bg-[linear-gradient(180deg,#fdfefe,#dbe6f2)] pb-1.5 font-display text-[9px] font-semibold text-[#2e5a80] shadow-[0_5px_10px_rgba(2,6,12,0.45)]",
              index === 2 && "bg-[linear-gradient(180deg,#e8f8ff,#8fd3ff)] text-[#0a4a78]",
            )}
          >
            {note}
          </span>
        ))}
      </div>
    ),
  },
  {
    eyebrow: "Paso 2 · El Mapa",
    title: "Cuatro pasos, una lección",
    body: "En el Mapa avanzas por niveles. Cada lección te lleva de la sensación al reto: sentir el pulso, escuchar, comprender y demostrarlo.",
    icon: Ear,
    visual: (
      <div className="grid grid-cols-2 gap-1.5">
        {MAP_STEPS.map((step, index) => (
          <div
            key={step.label}
            className="flex items-center gap-2 rounded-[11px] border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
          >
            <span className="grid h-6 w-6 flex-none place-items-center rounded-[8px] bg-cyan-300/[0.07] text-glow">
              <step.icon size={12} />
            </span>
            <span className="text-[8.5px] font-semibold text-ivory/85">
              {index + 1}. {step.label}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: "Paso 3 · El Estudio",
    title: "Tu piano, a tu tamaño",
    body: "En Estudio tocas libremente. Con las flechitas agrandas el piano a pantalla completa y, si estás en el teléfono, lo giras para tener más teclas. El modo Molde 1-3-5 te enseña los dedos y las casitas negras.",
    icon: Maximize2,
    visual: (
      <div className="flex items-center gap-2">
        <span className="neu-button grid h-9 w-9 place-items-center rounded-[10px] text-glow">
          <ArrowLeft size={14} />
        </span>
        <div className="flex min-w-0 flex-1 gap-[2px] rounded-[8px] border border-black/60 bg-[#02060c] p-[3px]">
          {[0, 1, 2, 3, 4].map((key) => (
            <span
              key={key}
              className="h-10 flex-1 rounded-b-[4px] border border-[#08121f]/80 bg-[linear-gradient(180deg,#fdfefe,#c6d5e6)]"
            />
          ))}
        </div>
        <span className="neu-button grid h-9 w-9 place-items-center rounded-[10px] text-glow">
          <ArrowRight size={14} />
        </span>
      </div>
    ),
  },
  {
    eyebrow: "Paso 4 · Los Juegos",
    title: "Entrena el oído y gana estrellas",
    body: "En Juegos entrenas ritmo, melodía y armonía. Cada reto completado enciende estrellas y suma XP real a tu perfil.",
    icon: Gamepad2,
    visual: (
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((star) => (
          <Star
            key={star}
            size={30}
            className={cn(
              star === 3 ? "text-faint/30" : "text-[#F5C15A]",
              star !== 3 && "drop-shadow-[0_0_10px_rgba(245,193,90,0.35)]",
            )}
            fill="currentColor"
            strokeWidth={1}
          />
        ))}
        <span className="ml-1 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-glow">
          +XP
        </span>
      </div>
    ),
  },
];

function readSeen(studentId: string) {
  try {
    return window.localStorage.getItem(`${TOUR_KEY_PREFIX}${studentId}`) === "true";
  } catch {
    return false;
  }
}

function writeSeen(studentId: string) {
  try {
    window.localStorage.setItem(`${TOUR_KEY_PREFIX}${studentId}`, "true");
  } catch {
    /* Private mode: the tour simply shows again next visit. */
  }
}

export function StudentTour() {
  const { studentMode, passThePhone, ownStudentId, activeStudent } = useAcademy();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const studentId = ownStudentId ?? activeStudent?.id ?? null;

  // First entry only: a brand-new student sees the tour once, per profile.
  useEffect(() => {
    if (!studentMode || passThePhone || !studentId) return;
    if (readSeen(studentId)) return;
    const timer = window.setTimeout(() => {
      setStep(0);
      setOpen(true);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [passThePhone, studentId, studentMode]);

  // The "?" in the header can replay it at any time.
  useEffect(() => {
    const replay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(STUDENT_TOUR_EVENT, replay);
    return () => window.removeEventListener(STUDENT_TOUR_EVENT, replay);
  }, []);

  function close() {
    if (studentId) writeSeen(studentId);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[130] flex items-end justify-center bg-[#02050b]/85 p-0 backdrop-blur-md sm:items-center sm:p-5"
          role="presentation"
        >
          <motion.div
            initial={{ y: 44, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-tour-title"
            className="neu-card relative flex max-h-[92dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-royal/15 blur-3xl"
            />
            <header className="relative flex items-center justify-between gap-3 px-4 pb-1 pt-4">
              <div className="flex items-center gap-1.5">
                <span className="status-dot text-glow" />
                <span className="text-[6.5px] font-semibold uppercase tracking-[0.2em] text-glow/85">
                  {current.eyebrow}
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Saltar el tour"
                className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-white/5 hover:text-ivory"
              >
                <X size={13} />
              </button>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-[13px] border border-cyan-300/20 bg-cyan-300/[0.06] text-glow shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <current.icon size={20} />
                  </span>
                  <h2
                    id="student-tour-title"
                    className="mt-3 font-display text-[27px] leading-[1.02] tracking-[-0.02em] text-ivory"
                  >
                    {current.title}
                  </h2>
                  <p className="mt-2.5 text-[10.5px] leading-[1.65] text-muted">
                    {current.body}
                  </p>

                  <div className="mt-4 rounded-[16px] border border-white/[0.055] bg-white/[0.018] p-3">
                    {current.visual}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <footer className="relative border-t border-white/[0.055] px-4 py-3.5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5" aria-hidden>
                  {STEPS.map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        index === step
                          ? "w-5 bg-glow"
                          : index < step
                            ? "w-1.5 bg-glow/45"
                            : "w-1.5 bg-white/15",
                      )}
                    />
                  ))}
                </div>
                <span className="text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
                  {step + 1} / {STEPS.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((value) => Math.max(0, value - 1))}
                    className="neu-button h-10 min-h-0 rounded-[12px] px-3 text-[9px]"
                  >
                    <ArrowLeft size={12} />
                    Atrás
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (last) close();
                    else setStep((value) => value + 1);
                  }}
                  className="neu-button neu-button--primary h-10 min-h-0 flex-1 rounded-[12px] px-4 text-[10px]"
                >
                  {last ? "Empezar a tocar" : "Siguiente"}
                  {last ? <Music2 size={13} /> : <ArrowRight size={13} />}
                </button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function StudentTourButton() {
  const { studentMode } = useAcademy();
  if (!studentMode) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(STUDENT_TOUR_EVENT))}
      title="Ver el tour de bienvenida"
      aria-label="Ayuda: repetir el tour de bienvenida"
      className="neu-icon h-8 w-8 flex-none rounded-full text-[10px] font-bold text-faint transition-colors hover:text-glow"
    >
      ?
    </button>
  );
}
