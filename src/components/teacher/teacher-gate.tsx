"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Delete,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { InlineNotice } from "@/components/shell/neo-toast";
import { verifyTeacherPinAction } from "@/server/actions/teacher";
import { cn } from "@/lib/utils";

type Status = "idle" | "checking" | "error" | "success";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"];

export function TeacherGate({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const statusRef = useRef<Status>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const submit = useCallback(
    async (pin: string) => {
      if (statusRef.current === "checking" || statusRef.current === "success") {
        return;
      }
      statusRef.current = "checking";
      setStatus("checking");
      setMessage(null);

      const result = await verifyTeacherPinAction(pin);

      if (result.ok) {
        statusRef.current = "success";
        setStatus("success");
        router.refresh();
        return;
      }

      statusRef.current = "error";
      setStatus("error");
      setMessage(result.error);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([18, 40, 18]);
      }
      resetTimer.current = window.setTimeout(() => {
        setDigits("");
        setStatus("idle");
        statusRef.current = "idle";
      }, 1050);
    },
    [router],
  );

  useEffect(() => {
    if (digits.length === 4) void submit(digits);
  }, [digits, submit]);

  const press = (value: string) => {
    if (!configured || statusRef.current === "checking" || statusRef.current === "success") {
      return;
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(5);
    }
    if (value === "del") {
      setDigits((current) => current.slice(0, -1));
      if (status === "error") {
        setStatus("idle");
        setMessage(null);
        statusRef.current = "idle";
      }
      return;
    }
    if (value === "bio") return;
    setDigits((current) => (current.length < 4 ? current + value : current));
  };

  return (
    <div className="space-y-6">
      <header className="pt-4 text-center">
        <div className="relative mx-auto mb-5 grid h-[84px] w-[84px] place-items-center rounded-full border border-white/10 bg-[#0E1524]/80 shadow-[0_0_70px_rgba(13,110,253,0.4)] backdrop-blur-xl">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.22),transparent_65%)]"
          />
          <LockKeyhole size={28} strokeWidth={1.5} className="relative text-sky-300" />
        </div>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
          Acceso privado
        </p>
        <h1 className="mt-4 text-[32px] font-bold leading-[1.05] tracking-[-0.03em] text-white">
          La mesa del{" "}
          <span className="text-sky-300">profesor</span>.
        </h1>
        <p className="mt-2 text-[12px] text-slate-400">
          Solo tú puedes abrir esta puerta.
        </p>
      </header>

      <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 p-5 backdrop-blur-xl">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-royal/20 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              PIN del profesor
            </span>
            <span className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
              <KeyRound size={10} />
              4 dígitos
            </span>
          </div>

          <motion.div
            animate={
              status === "error"
                ? { x: [0, -7, 7, -4, 4, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.42 }}
            className="mt-4 grid grid-cols-4 gap-2"
          >
            {[0, 1, 2, 3].map((index) => {
              const filled = index < digits.length;
              return (
                <span
                  key={index}
                  className={cn(
                    "grid h-[58px] place-items-center rounded-2xl border transition-all duration-200",
                    filled
                      ? status === "error"
                        ? "border-red-400/40 bg-red-400/10 shadow-[0_0_15px_rgba(248,113,113,0.25)]"
                        : "border-sky-400/50 bg-sky-400/[0.08] shadow-[0_0_15px_rgba(56,189,248,0.3)]"
                      : "border-white/10 bg-white/[0.04]",
                    status === "checking" && filled && "animate-dot-pulse",
                  )}
                >
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full transition-all duration-200",
                      filled
                        ? status === "error"
                          ? "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]"
                          : "bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.8)]"
                        : "bg-white/10",
                    )}
                  />
                </span>
              );
            })}
          </motion.div>

          <div className="mt-3 min-h-[18px] text-center" aria-live="polite">
            {message ? (
              <p className="text-[11px] font-medium text-red-300/90">{message}</p>
            ) : status === "checking" ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                Verificando…
              </p>
            ) : status === "success" ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300/90">
                Bienvenido, profe.
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                Se abre al cuarto dígito.
              </p>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {KEYS.map((key) => {
              if (key === "bio") {
                return (
                  <div
                    key={key}
                    aria-hidden
                    className="flex h-[58px] items-center justify-center text-white/[0.09]"
                  >
                    <Fingerprint size={22} strokeWidth={1} />
                  </div>
                );
              }
              const isDelete = key === "del";
              return (
                <motion.button
                  key={key}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => press(key)}
                  disabled={!configured || status === "checking"}
                  aria-label={isDelete ? "Borrar último dígito" : `Dígito ${key}`}
                  className={cn(
                    "h-[58px] rounded-2xl border border-white/[0.08] bg-white/[0.05] p-0 text-[22px] font-bold text-white transition-colors hover:bg-white/[0.08] active:bg-white/[0.11]",
                    isDelete && "text-slate-300",
                    !configured && "opacity-40",
                  )}
                >
                  {isDelete ? <Delete size={19} strokeWidth={1.8} /> : key}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {!configured && (
        <InlineNotice tone="warning">
          El PIN no está configurado en el servidor. Define{" "}
          <span className="font-semibold">TEACHER_PIN</span> (4 dígitos) en
          <span className="font-semibold"> .env.local</span> y reinicia la app.
        </InlineNotice>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowHint((value) => !value)}
          aria-expanded={showHint}
          className="rounded-full px-3 py-2 text-[11px] font-medium text-slate-400 transition-colors hover:text-white"
        >
          ¿Olvidaste tu PIN de Profesor?
        </button>

        <AnimatePresence initial={false}>
          {showHint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mx-auto mt-2 max-w-[300px] rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-[11px] leading-relaxed text-slate-300">
                Si olvidaste tu PIN de acceso, cámbialo en las variables de
                entorno de tu servidor o contacta al administrador
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[10px] text-slate-400">
          <ShieldCheck size={11} className="text-sky-400/70" />
          Verificado en el servidor · Cookie privada
        </span>
      </div>
    </div>
  );
}
