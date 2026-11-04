"use client";

import { AnimatePresence, motion } from "framer-motion";
import { VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAudioEngine } from "@/lib/use-audio-engine";

/**
 * Global mobile audio guard. iOS/Android only allow starting the AudioContext
 * from a real gesture, so the first touch anywhere on the app resumes it. If a
 * note never reaches the speakers we surface a discreet floating notice.
 */
export function AudioGuard() {
  const { silent, unlock } = useAudioEngine();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!silent) setDismissed(false);
  }, [silent]);

  useEffect(() => {
    const gesture = () => unlock();
    window.addEventListener("pointerdown", gesture, {
      once: true,
      capture: true,
    });
    window.addEventListener("keydown", gesture, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", gesture, true);
      window.removeEventListener("keydown", gesture, true);
    };
  }, [unlock]);

  const visible = silent && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+11.5rem)] z-[45] mx-auto flex w-[min(92vw,410px)] items-start gap-2.5 rounded-[16px] border border-ember/25 bg-[#170f08]/95 p-3 pr-2 shadow-[8px_8px_18px_#03070D,-6px_-6px_16px_rgba(30,95,180,0.08),0_0_30px_rgba(242,180,92,0.1)] backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-ember/[0.08] text-ember">
            <VolumeX size={15} />
          </span>
          <p className="min-w-0 flex-1 pt-0.5 text-[10.5px] leading-[1.5] text-ivory/90">
            <span aria-hidden>🔇</span> Audio silenciado. Revisa el volumen
            multimedia o el botón de silencio de tu teléfono.
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Cerrar aviso de audio"
            className="grid h-7 w-7 flex-none place-items-center rounded-lg text-faint transition-colors hover:bg-white/5 hover:text-ivory"
          >
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
