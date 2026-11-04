"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Copy,
  LockKeyhole,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";
import {
  createStudentProfileAction,
  loginStudentAction,
} from "@/server/actions/student-auth";

type Mode = "login" | "create" | "created";

const CODE_LENGTH = 4;

function splitCode(value: string) {
  const clean = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
  return Array.from({ length: CODE_LENGTH }, (_, index) => clean[index] ?? "");
}

export function StudentWelcome() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const boxesRef = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join("");

  const focusBox = (index: number) => {
    const next = Math.max(0, Math.min(CODE_LENGTH - 1, index));
    boxesRef.current[next]?.focus();
    boxesRef.current[next]?.select();
  };

  const setCode = (value: string) => {
    const next = splitCode(value);
    setDigits(next);
    return next;
  };

  const handleDigit = (index: number, raw: string) => {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    if (clean.length > 1) {
      // Pasting the whole code into any box fills the row.
      setCode(clean);
      focusBox(Math.min(CODE_LENGTH - 1, clean.length - 1));
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (index < CODE_LENGTH - 1) focusBox(index + 1);
  };

  const handleKey = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      focusBox(index - 1);
    }
    if (event.key === "ArrowLeft") focusBox(index - 1);
    if (event.key === "ArrowRight") focusBox(index + 1);
  };

  const enter = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    if (code.length < 4) {
      setError("Escribe las 4 letras de tu código.");
      return;
    }
    setBusy(true);
    setError(null);

    const result = await loginStudentAction({ name, code });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }

    router.refresh();
  };

  const createProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await createStudentProfileAction({ name });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }

    setNewCode(result.data.code);
    setCode(result.data.code);
    setMode("created");
    setBusy(false);
  };

  const enterWithNewCode = async () => {
    if (!newCode || busy) return;
    setBusy(true);
    setError(null);
    const result = await loginStudentAction({ name, code: newCode });
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    router.refresh();
  };

  const copyCode = async () => {
    if (!newCode) return;
    try {
      await navigator.clipboard.writeText(newCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("No se pudo copiar. Anótalo a mano.");
    }
  };

  const openCreate = () => {
    setMode("create");
    setError(null);
  };

  return (
    <div className="space-y-7 pb-10">
      <header className="pt-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="relative mx-auto grid h-[84px] w-[84px] place-items-center rounded-full border border-white/10 bg-[#0E1524]/80 shadow-[0_0_70px_rgba(13,110,253,0.4)] backdrop-blur-xl"
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.22),transparent_65%)]"
          />
          <BrandMark size={54} priority className="rounded-full" />
        </motion.div>

        <h1 className="mt-5 text-[34px] font-bold leading-none tracking-[-0.03em] text-white">
          Leo Academy
        </h1>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-[11px] font-medium text-slate-300 backdrop-blur-xl">
          <LockKeyhole size={11} className="text-sky-400" />
          Tu pase privado de alumno
        </p>
      </header>

      <motion.section
        layout
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E1524]/80 p-5 backdrop-blur-xl"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-royal/20 blur-3xl"
        />

        <AnimatePresence mode="wait" initial={false}>
          {mode === "created" && newCode ? (
            <motion.div
              key="created"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative text-center"
            >
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300">
                <Sparkles size={20} />
              </span>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Tu código de alumno
              </p>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {splitCode(newCode).map((digit, index) => (
                  <span
                    key={index}
                    className="grid h-[58px] place-items-center rounded-2xl border border-sky-400/30 bg-sky-400/[0.08] text-[26px] font-bold text-white shadow-[0_0_18px_rgba(56,189,248,0.18)]"
                  >
                    {digit}
                  </span>
                ))}
              </div>

              <p className="mx-auto mt-4 max-w-[260px] text-[12px] leading-relaxed text-slate-300">
                Guárdalo: es la llave de tu progreso si cambias de teléfono.
              </p>

              <button
                type="button"
                onClick={() => void copyCode()}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 text-[11px] font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copiado" : "Copiar código"}
              </button>

              {error && (
                <p className="mt-3 text-[11px] text-red-300/90">{error}</p>
              )}

              <button
                type="button"
                onClick={() => void enterWithNewCode()}
                disabled={busy}
                className="neu-button neu-button--primary mt-5 w-full disabled:opacity-50"
              >
                Entrar a Clase
                <ArrowRight size={16} />
              </button>
            </motion.div>
          ) : mode === "create" ? (
            <motion.form
              key="create"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={createProfile}
              className="relative space-y-4"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
                  Primer día
                </p>
                <h2 className="mt-1.5 text-2xl font-bold leading-tight text-white">
                  Crea tu perfil
                </h2>
              </div>

              <label className="block">
                <span className="mb-2 block text-[11px] font-medium text-slate-300">
                  Tu nombre
                </span>
                <input
                  className="neu-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nombre y apellido"
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </label>

              <p className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-300">
                Te damos un código de 4 letras. Tu profe también puede verlo.
              </p>

              {error && <p className="text-[11px] text-red-300/90">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="neu-button neu-button--primary w-full disabled:opacity-50"
              >
                <UserPlus size={16} />
                {busy ? "Creando tu perfil…" : "Crear mi perfil"}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onSubmit={enter}
              className="relative space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/90">
                  Entrar a clase
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                  <LockKeyhole size={10} />
                  Privado
                </span>
              </div>

              <label className="block">
                <span className="mb-2 block text-[11px] font-medium text-slate-300">
                  Tu nombre
                </span>
                <input
                  className="neu-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nombre y apellido"
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-300">
                    Código de alumno
                  </span>
                  <span className="text-[10px] text-slate-500">4 letras</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        boxesRef.current[index] = element;
                      }}
                      value={digit}
                      onChange={(event) => handleDigit(index, event.target.value)}
                      onKeyDown={(event) => handleKey(index, event)}
                      onFocus={(event) => event.currentTarget.select()}
                      onPaste={(event) => {
                        event.preventDefault();
                        const pasted = event.clipboardData.getData("text");
                        if (pasted) {
                          setCode(pasted);
                          focusBox(
                            Math.min(CODE_LENGTH - 1, splitCode(pasted).join("").length - 1),
                          );
                        }
                      }}
                      aria-label={`Letra ${index + 1} del código`}
                      inputMode="text"
                      autoCapitalize="characters"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      className="otp-box"
                      required
                    />
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[11px] leading-snug text-red-300/90">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="neu-button neu-button--primary w-full disabled:opacity-50"
              >
                {busy ? "Abriendo tu academia…" : "Entrar a Clase"}
                <ArrowRight size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.section>

      <div className="flex items-center justify-center gap-5 text-[12px]">
        <Link
          href="/profesor"
          className="font-medium text-slate-400 transition-colors hover:text-slate-200"
        >
          ¿Eres profesor?
        </Link>
        <span aria-hidden className="h-3 w-px bg-white/15" />
        <button
          type="button"
          onClick={() => (mode === "login" ? openCreate() : setMode("login"))}
          className={cn(
            "font-medium transition-colors hover:text-slate-200",
            mode === "login" ? "text-sky-300" : "text-slate-400",
          )}
        >
          {mode === "login" ? "¿Primer día?" : "Ya tengo código"}
        </button>
      </div>
    </div>
  );
}
