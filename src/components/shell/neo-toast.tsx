"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, TriangleAlert, X, Zap } from "lucide-react";
import { useEffect } from "react";
import { useAcademy } from "@/components/providers/academy-provider";
import { cn } from "@/lib/utils";

const TONE = {
  info: {
    icon: Info,
    color: "text-glow",
    ring: "border-cyan-300/15",
    glow: "0 0 34px rgba(56,189,248,0.08)",
  },
  success: {
    icon: CheckCircle2,
    color: "text-emerald-300",
    ring: "border-emerald-300/15",
    glow: "0 0 34px rgba(52,211,153,0.08)",
  },
  warning: {
    icon: Zap,
    color: "text-ember",
    ring: "border-ember/20",
    glow: "0 0 34px rgba(242,180,92,0.1)",
  },
} as const;

export function NeoToast() {
  const { notice, dismissNotice } = useAcademy();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismissNotice, 4800);
    return () => window.clearTimeout(timer);
  }, [notice, dismissNotice]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+94px)] z-50 flex justify-center px-4"
    >
      <AnimatePresence mode="wait">
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
            className={cn(
              "neu-card pointer-events-auto flex w-full max-w-[420px] items-start gap-3 rounded-[18px] border p-3.5 pr-2.5",
              TONE[notice.tone].ring,
            )}
            style={{ boxShadow: `8px 8px 18px #03070D, -6px -6px 16px rgba(30,95,180,0.1), ${TONE[notice.tone].glow}` }}
            role="status"
          >
            <span
              className={cn(
                "mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-white/[0.04]",
                TONE[notice.tone].color,
              )}
            >
              {(() => {
                const Icon = TONE[notice.tone].icon;
                return <Icon size={15} strokeWidth={2} />;
              })()}
            </span>
            <p className="min-w-0 flex-1 pt-1 text-[11.5px] leading-[1.45] text-ivory/90">
              {notice.message}
            </p>
            <button
              type="button"
              onClick={dismissNotice}
              aria-label="Cerrar aviso"
              className="grid h-7 w-7 flex-none place-items-center rounded-lg text-faint transition-colors hover:bg-white/5 hover:text-ivory"
            >
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function InlineNotice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning" | "error";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[14px] border px-3 py-2.5 text-[10.5px] leading-relaxed",
        tone === "info" && "border-cyan-300/10 bg-cyan-300/[0.035] text-muted",
        tone === "warning" && "border-ember/15 bg-ember/[0.045] text-ember/90",
        tone === "error" && "border-red-400/15 bg-red-400/[0.04] text-red-300/90",
      )}
    >
      <TriangleAlert size={13} className="mt-0.5 flex-none opacity-80" />
      <div>{children}</div>
    </div>
  );
}
