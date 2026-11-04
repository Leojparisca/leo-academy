"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { useAcademy } from "@/components/providers/academy-provider";
import { cn } from "@/lib/utils";

export function OfflineToggle() {
  const { offlineMode, toggleOfflineMode, pendingSync } = useAcademy();

  return (
    <button
      type="button"
      onClick={toggleOfflineMode}
      aria-pressed={offlineMode}
      aria-label={
        offlineMode
          ? "Desactivar Modo Sin Luz y sincronizar"
          : "Activar Modo Sin Luz (offline)"
      }
      className={cn(
        "neu-button group relative h-11 overflow-hidden rounded-[15px] border px-2.5 pr-3 transition-all duration-500",
        offlineMode
          ? "border-ember/35 bg-[linear-gradient(145deg,#2a2117,#12100d)] shadow-[inset_4px_4px_10px_#03070D,inset_-3px_-3px_8px_rgba(242,180,92,0.12),0_0_24px_rgba(242,180,92,0.12)]"
          : "border-white/[0.07]",
      )}
      title="Modo Sin Luz · guarda todo en el dispositivo"
    >
      <span className="relative flex items-center gap-2">
        <span className="relative grid h-7 w-7 place-items-center">
          <span
            className={cn(
              "absolute inset-0 rounded-full blur-md transition-opacity duration-500",
              offlineMode
                ? "bg-ember/30 opacity-100"
                : "bg-cyan-400/20 opacity-0 group-hover:opacity-100",
            )}
          />
          <Zap
            size={15}
            strokeWidth={2.2}
            className={cn(
              "relative transition-colors duration-500",
              offlineMode ? "text-ember" : "text-glow",
            )}
            fill={offlineMode ? "currentColor" : "none"}
          />
          {offlineMode && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-ember shadow-[0_0_8px_#F2B45C]"
            />
          )}
        </span>
        <span className="text-left leading-[1.05]">
          <span className="block text-[6.5px] font-semibold tracking-[0.2em] text-faint">
            MODO
          </span>
          <span
            className={cn(
              "block text-[9px] font-extrabold tracking-[0.09em] transition-colors duration-500",
              offlineMode ? "text-ember" : "text-ivory/90",
            )}
          >
            SIN LUZ
          </span>
        </span>
        {pendingSync > 0 && !offlineMode && (
          <span className="ml-0.5 grid min-w-[16px] place-items-center rounded-full bg-royal/20 px-1 text-[8px] font-bold text-glow">
            {pendingSync}
          </span>
        )}
      </span>
    </button>
  );
}
