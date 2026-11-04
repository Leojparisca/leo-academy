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
      <header className="text-center">
        <div className="relative mx-auto mb-5 grid h-[76px] w-[76px] place-items-center">
          <span className="absolute inset-0 rounded-full border border-cyan-300/10 shadow-[0_0_36px_rgba(13,110,253,0.12)]" />
          <span className="absolute inset-2 rounded-full border border-white/[0.05]" />
          <span className="neu-icon h-[58px] w-[58px] rounded-full text-glow">
            <LockKeyhole size={21} strokeWidth={1.4} />
          </span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="status-dot text-ember" />
          <p className="eyebrow">Acceso privado</p>
        </div>
        <h1 className="mt-3 font-display text-[36px] leading-[0.95] tracking-[-0.03em] text-ivory">
          La mesa del
          <br />
          <em className="sapphire-text font-normal italic">profesor</em>
          <span className="text-glow">.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-[260px] text-[10.5px] leading-relaxed text-muted">
          Evaluaciones, niveles y el pulso de cada alumno. Solo tú puedes abrir
          esta puerta.
        </p>
      </header>

      <div className="neu-card relative overflow-hidden rounded-[26px] p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-royal/10 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-[7px]">PIN del profesor</span>
            <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
              <KeyRound size={9} />
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
            className="mt-3"
          >
            <div className="neu-inset--deep flex h-[66px] items-center justify-center gap-3.5 rounded-[18px]">
              {[0, 1, 2, 3].map((index) => {
                const filled = index < digits.length;
                return (
                  <span
                    key={index}
                    className={cn(
                      "h-3 w-3 rounded-full border transition-all duration-200",
                      filled
                        ? status === "error"
                          ? "border-red-400/40 bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.5)]"
                          : "border-cyan-200/40 bg-glow shadow-[0_0_14px_rgba(56,189,248,0.65)]"
                        : "border-white/10 bg-white/[0.03]",
                      status === "checking" &&
                        filled &&
                        "animate-dot-pulse",
                    )}
                  />
                );
              })}
            </div>
          </motion.div>

          <div className="mt-3 min-h-[18px] text-center" aria-live="polite">
            {message ? (
              <p className="text-[9.5px] font-medium text-red-300/90">{message}</p>
            ) : status === "checking" ? (
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-glow/80">
                Verificando…
              </p>
            ) : status === "success" ? (
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-300/90">
                Bienvenido, profe.
              </p>
            ) : (
              <p className="text-[8.5px] text-faint/70">
                Toca los dígitos. Se abre al cuarto.
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
                    "neu-button h-[58px] rounded-[16px] p-0 font-display text-[22px] font-normal",
                    isDelete && "text-muted",
                    !configured && "opacity-40",
                  )}
                >
                  {isDelete ? <Delete size={18} strokeWidth={1.7} /> : key}
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
          className="text-[8px] font-semibold uppercase tracking-[0.12em] text-faint transition-colors hover:text-ivory"
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
              <p className="mx-auto mt-2 max-w-[280px] rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[8.5px] leading-relaxed text-faint">
                Pista discreta:{" "}
                <span className="font-semibold text-glow/85">
                  día y mes de cumpleaños
                </span>
                . El PIN inicial de la academia es{" "}
                <span className="font-semibold tracking-[0.16em] text-ivory">
                  1006
                </span>
                .
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-start gap-2.5 px-2">
        <ShieldCheck size={13} className="mt-0.5 flex-none text-glow/60" />
        <p className="text-[8.5px] leading-[1.6] text-faint">
          El PIN se verifica en el servidor. Nunca viaja al cliente, no se
          guarda en IndexedDB y la sesión vive en una cookie{" "}
          <span className="text-muted">httpOnly</span> firmada.
        </p>
      </div>
    </div>
  );
}
