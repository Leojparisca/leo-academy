"use client";

import { motion } from "framer-motion";
import {
  BookOpenCheck,
  Clock3,
  Hand,
  Quote,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BRANCHES, type CurriculumNode } from "@/data/curriculum";
import { getTeacherGuide } from "@/data/teacher-guide";

/**
 * “Guía Docente de Leo” — the live teleprompter.
 *
 * Teacher-only drawer, portalled to <body> because the map lives inside a
 * stacking context owned by <main>. Escape closes, Tab is trapped, and the
 * map restores focus to the tile that opened it.
 */
export function TeacherGuideSheet({
  node,
  onClose,
}: {
  node: CurriculumNode;
  onClose: () => void;
}) {
  const guide = getTeacherGuide(node.id);
  const branch = BRANCHES[node.branch];
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });

    const focusables = () => {
      const root = sheetRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !sheetRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[75]">
      <motion.button
        type="button"
        aria-label="Cerrar la guía docente"
        tabIndex={-1}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#02060c]/72 backdrop-blur-[3px]"
      />

      <motion.aside
        ref={sheetRef}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guia-docente-titulo"
        className="guide-drawer absolute right-0 top-0 flex h-dvh w-full max-w-[440px] flex-col"
        style={
          {
            "--branch-color": branch.color,
          } as React.CSSProperties
        }
      >
        <header className="flex-none px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.9rem)]">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-[12px] border"
              style={{
                color: branch.color,
                borderColor: `${branch.color}33`,
                background: `${branch.color}12`,
              }}
            >
              <BookOpenCheck size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-[6.5px]">Guía Docente de Leo</p>
              <h2
                id="guia-docente-titulo"
                className="mt-1 font-display text-[19px] leading-[1.05] tracking-[-0.01em] text-ivory"
              >
                {node.title}
              </h2>
              <p className="mt-1 text-[7.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                {branch.label} · Nivel {node.level}
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="neu-icon h-8 w-8 flex-none rounded-[10px]"
              aria-label="Cerrar la guía docente"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="guide-drawer__body flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {guide ? (
            <>
              <section className="guide-card">
                <div className="guide-card__head">
                  <span className="guide-chip">
                    <Clock3 size={10} /> 60 s
                  </span>
                  <p className="guide-card__eyebrow">Gancho</p>
                </div>
                <h3 className="guide-card__title">{guide.hook.title}</h3>
                <p className="guide-card__text">{guide.hook.analogy}</p>
                <p className="guide-card__landing">
                  <Sparkles size={10} className="flex-none" />
                  {guide.hook.landing}
                </p>
              </section>

              <section className="guide-card">
                <div className="guide-card__head">
                  <span className="guide-chip">
                    <Hand size={10} /> {guide.body.minutes} min
                  </span>
                  <p className="guide-card__eyebrow">Dinámica física pre-teclado</p>
                </div>
                <h3 className="guide-card__title">{guide.body.title}</h3>
                <ol className="guide-steps">
                  {guide.body.steps.map((stepText, index) => (
                    <li key={stepText}>
                      <span className="guide-step__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{stepText}</span>
                    </li>
                  ))}
                </ol>
                <p className="guide-card__landing">
                  <Sparkles size={10} className="flex-none" />
                  {guide.body.closing}
                </p>
              </section>

              <section className="guide-card">
                <div className="guide-card__head">
                  <span className="guide-chip guide-chip--warn">
                    <TriangleAlert size={10} /> Observar
                  </span>
                  <p className="guide-card__eyebrow">Diagnóstico de errores</p>
                </div>
                <ul className="mt-2 space-y-2.5">
                  {guide.diagnostics.map((item) => (
                    <li key={item.signal} className="guide-diagnostic">
                      <p className="guide-diagnostic__signal">{item.signal}</p>
                      <p className="guide-diagnostic__watch">{item.watch}</p>
                      <p className="guide-diagnostic__fix">
                        <span aria-hidden>✓</span>
                        {item.fix}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              <blockquote className="guide-mantra">
                <Quote size={13} className="flex-none text-glow/70" />
                <p>{guide.mantra}</p>
              </blockquote>
            </>
          ) : (
            <p className="guide-card__text">
              Esta lección aún no tiene guía docente escrita. Usa el gancho del
              nivel anterior como puente y observa muñeca, digitación y
              respiración.
            </p>
          )}
        </div>
      </motion.aside>
    </div>,
    document.body,
  );
}
