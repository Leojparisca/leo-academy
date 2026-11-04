"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Copy,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";
import {
  createStudentProfileAction,
  loginStudentAction,
} from "@/server/actions/student-auth";

type Mode = "login" | "create" | "created";

export function StudentWelcome() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const enter = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
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

  return (
    <div className="space-y-5 pb-10">
      <header className="pt-3 text-center">
        <div className="mx-auto mb-5 grid place-items-center">
          <BrandMark size={72} priority />
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="status-dot text-glow" />
          <p className="eyebrow">Tu academia privada</p>
        </div>
        <h1 className="mt-3 font-display text-[38px] leading-[0.94] tracking-[-0.035em] text-ivory">
          Hola, futuro
          <br />
          <em className="sapphire-text font-normal italic">pianista</em>
          <span className="text-glow">.</span>
        </h1>
        <p className="mx-auto mt-3 max-w-[280px] text-[10.5px] leading-[1.65] text-muted">
          Entra con tu nombre y tu código de alumno. Tu progreso es tuyo: nadie
          más en clase puede verlo.
        </p>
      </header>

      <motion.section
        layout
        className="neu-card relative overflow-hidden rounded-[26px] p-5"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-royal/10 blur-3xl"
        />

        <AnimatePresence mode="wait" initial={false}>
          {mode === "created" && newCode ? (
            <motion.div
              key="created"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="relative text-center"
            >
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-[15px] border border-cyan-300/20 bg-cyan-300/[0.06] text-glow">
                <Sparkles size={20} />
              </span>
              <p className="mt-4 text-[8px] font-semibold uppercase tracking-[0.2em] text-faint">
                Tu código de alumno
              </p>
              <p className="mt-1 font-display text-[42px] leading-none tracking-[0.12em] text-ivory">
                {newCode}
              </p>
              <p className="mx-auto mt-3 max-w-[260px] text-[9.5px] leading-relaxed text-muted">
                Guárdalo. Es la llave de tu progreso y lo necesitarás si cambias
                de teléfono.
              </p>

              <button
                type="button"
                onClick={() => void copyCode()}
                className="neu-button mt-3 h-9 min-h-0 rounded-[11px] px-3 text-[8.5px]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copiado" : "Copiar código"}
              </button>

              {error && (
                <p className="mt-3 text-[9px] text-red-300/90">{error}</p>
              )}

              <button
                type="button"
                onClick={() => void enterWithNewCode()}
                disabled={busy}
                className="neu-button neu-button--primary mt-4 w-full rounded-[14px] py-3 text-[10px] disabled:opacity-50"
              >
                Entrar a mi academia
                <ArrowRight size={13} className="ml-auto opacity-70" />
              </button>
            </motion.div>
          ) : mode === "create" ? (
            <motion.form
              key="create"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onSubmit={createProfile}
              className="relative space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow text-[7px]">Nuevo perfil de alumno</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-[8px] font-semibold uppercase tracking-[0.12em] text-faint hover:text-ivory"
                >
                  Ya tengo código
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
                  Tu nombre
                </span>
                <input
                  className="neu-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tu nombre completo"
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </label>

              <p className="rounded-[12px] border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 text-[8.5px] leading-relaxed text-faint">
                Crearemos un código único de 4 caracteres. Tu profe también podrá
                verlo para ayudarte a entrar.
              </p>

              {error && <p className="text-[9px] text-red-300/90">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="neu-button neu-button--primary w-full rounded-[14px] py-3 text-[10px] disabled:opacity-50"
              >
                <UserPlus size={14} />
                {busy ? "Creando tu perfil…" : "Crear mi perfil de alumno"}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="login"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onSubmit={enter}
              className="relative space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="eyebrow text-[7px]">Entrar a mi academia</span>
                <span className="flex items-center gap-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-faint">
                  <LockKeyhole size={9} />
                  Privado
                </span>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
                  Tu nombre
                </span>
                <input
                  className="neu-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tu nombre completo"
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint">
                  Código de alumno
                  <span className="normal-case tracking-normal text-faint/60">
                    Ej. 6UYZ
                  </span>
                </span>
                <input
                  className="neu-input text-center font-display text-[17px] tracking-[0.22em]"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase().slice(0, 8))
                  }
                  placeholder="••••"
                  minLength={4}
                  maxLength={8}
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  inputMode="text"
                  required
                />
              </label>

              {error && (
                <p className="rounded-[10px] border border-red-400/15 bg-red-400/[0.04] px-2.5 py-2 text-[9px] leading-snug text-red-300/90">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="neu-button neu-button--primary w-full rounded-[14px] py-3 text-[10px] disabled:opacity-50"
              >
                <KeyRound size={14} />
                {busy ? "Abriendo tu academia…" : "Entrar"}
                <ArrowRight size={13} className="ml-auto opacity-70" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("create");
                  setError(null);
                }}
                className="w-full rounded-[11px] py-2 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-glow/85 transition-colors hover:text-glow"
              >
                Crear mi perfil de alumno
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.section>

      <div className="flex items-start gap-2.5 px-2">
        <ShieldCheck size={13} className="mt-0.5 flex-none text-glow/60" />
        <p className="text-[8.5px] leading-[1.6] text-faint">
          Cada alumno ve únicamente su nombre y su progreso. El selector de
          alumnos solo se abre en Modo Profesor o con «Pasa el Teléfono».
        </p>
      </div>

      <Link
        href="/profesor"
        className={cn(
          "mx-auto flex w-fit items-center gap-1.5 rounded-full border border-white/[0.06]",
          "px-3 py-1.5 text-[7.5px] font-semibold uppercase tracking-[0.14em] text-faint",
          "transition-colors hover:border-white/12 hover:text-muted",
        )}
      >
        <LockKeyhole size={9} />
        Soy el profesor
      </Link>
    </div>
  );
}
