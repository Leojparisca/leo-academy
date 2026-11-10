"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Ear,
  Hand,
  Headphones,
  Music2,
  Sparkles,
  Waves,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAcademy } from "@/components/providers/academy-provider";
import { ChordArchitect } from "@/components/games/chord-architect";
import { GroovePadDual } from "@/components/games/groove-pad-dual";
import { IntervalHunter } from "@/components/games/interval-hunter";
import { Stars, type GameResult } from "@/components/games/game-ui";
import { MelodyGuided } from "@/components/curriculum/melody-guided";
import { RhythmCallResponse } from "@/components/curriculum/rhythm-call-response";
import {
  BRANCHES,
  CHORD_QUALITIES,
  CURRICULUM_LEVEL_COUNT,
  EMOTION_META,
  INTERVAL_LABELS,
  type ChordQuality,
  type CurriculumNode,
} from "@/data/curriculum";
import { LETTERS } from "@/lib/harmony";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { cn } from "@/lib/utils";

const STEP_ICON = [Hand, Headphones, Music2, Sparkles] as const;
const STEP_LABEL = ["Sentir", "Escuchar", "Comprender", "Reto"] as const;

export function LessonRunner({
  node,
  onClose,
}: {
  node: CurriculumNode;
  onClose: () => void;
}) {
  const { recordCurriculumResult, notify } = useAcademy();
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState([false, false, false, false]);
  const [reto, setReto] = useState<{ result: GameResult; xp: number } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const branch = BRANCHES[node.branch];
  const guided = node.branch === "ritmo" || node.branch === "melodia";
  const step = node.steps[stepIndex];
  const closeRef = useRef(onClose);
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  closeRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstButtonRef.current?.focus({ preventScroll: true });

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
        closeRef.current();
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

  const completeStep = () => {
    setDone((previous) => {
      if (previous[stepIndex]) return previous;
      const next = [...previous];
      next[stepIndex] = true;
      return next;
    });
  };

  const handleReto = async (result: GameResult) => {
    setSaving(true);
    const saved = await recordCurriculumResult({
      nodeId: node.id,
      stars: result.stars,
      accuracy: result.accuracy,
    });
    setSaving(false);
    setReto({ result, xp: saved.xp });
    setDone((previous) => {
      const next = [...previous];
      next[3] = true;
      return next;
    });
  };

  /**
   * Guided rhythm/melody lessons seal the node through the same
   * `recordCurriculumResult` pipeline as the old challenge step. No schema,
   * node id or stored progress is touched.
   */
  const handleGuidedComplete = async (stars: 1 | 2 | 3, accuracy: number) => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await recordCurriculumResult({
        nodeId: node.id,
        stars,
        accuracy,
      });
      setReto({
        result: {
          game: node.branch === "ritmo" ? "rhythm" : "melody",
          score: Math.round(accuracy),
          accuracy: saved.accuracy,
          stars: saved.stars as 1 | 2 | 3,
          xp: saved.xp,
          detail: node.title,
          stats: {},
        },
        xp: saved.xp,
      });
    } catch {
      notify("No pudimos sellar el nivel. Vuelve a intentarlo.", "warning");
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      ref={sheetRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="lesson-sheet fixed inset-0 z-[70] overflow-y-auto overflow-x-hidden overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label={`Lección ${node.title}`}
    >
      <div className="mx-auto min-h-dvh w-full max-w-[560px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)] sm:px-6">
        <header
          className="sticky top-0 z-20 mb-4 bg-[#040b13]/85 pb-3 pt-1 backdrop-blur-xl"
          style={{ marginInline: "calc(50% - 50vw)" }}
        >
          <div className="mx-auto w-full max-w-[560px] px-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <button
                ref={firstButtonRef}
                type="button"
                onClick={onClose}
                className="neu-icon h-9 w-9 rounded-[11px]"
                aria-label="Volver al mapa"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: branch.color, boxShadow: `0 0 8px ${branch.color}` }}
                  />
                  <span className="text-[6.5px] font-bold uppercase tracking-[0.2em] text-faint">
                    Nivel {String(node.level).padStart(2, "0")} · {branch.label}
                  </span>
                </div>
                <h2 className="mt-0.5 truncate font-display text-[18px] leading-tight text-ivory">
                  {node.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="neu-icon h-9 w-9 rounded-[11px]"
                aria-label="Cerrar lección"
              >
                <X size={14} />
              </button>
            </div>

            {!guided && (
              <div className="mt-3 flex items-center gap-1.5">
                {node.steps.map((entry, index) => {
                  const Icon = STEP_ICON[index];
                  const active = index === stepIndex;
                  return (
                    <button
                      key={entry.kind}
                      type="button"
                      onClick={() => {
                        if (index <= stepIndex || done[index - 1]) {
                          setStepIndex(index);
                        }
                      }}
                      className={cn(
                        "flex min-h-0 flex-1 items-center justify-center gap-1 rounded-full border px-1.5 py-1.5 text-[6px] font-semibold uppercase tracking-[0.1em] transition-all duration-300",
                        active
                          ? "border-white/15 bg-white/[0.07] text-ivory"
                          : done[index]
                            ? "border-[#7DE2C3]/20 bg-[#7DE2C3]/[0.05] text-[#7DE2C3]"
                            : "border-white/[0.04] bg-white/[0.01] text-faint/60",
                      )}
                      aria-current={active ? "step" : undefined}
                    >
                      {done[index] && !active ? (
                        <Check size={9} strokeWidth={3} />
                      ) : (
                        <Icon size={9} />
                      )}
                      <span className="hidden min-[370px]:inline">
                        {STEP_LABEL[index]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {!guided && (
          <>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full border px-2 py-0.5 text-[6.5px] font-bold uppercase tracking-[0.18em]"
                style={{
                  borderColor: `${branch.color}33`,
                  background: `${branch.color}0f`,
                  color: branch.color,
                }}
              >
                Paso {stepIndex + 1} · {STEP_LABEL[stepIndex]}
              </span>
              <span className="text-[6.5px] font-semibold uppercase tracking-[0.15em] text-faint">
                {node.minutes} min · {node.concept}
              </span>
            </div>

            <h1 className="mt-3 font-display text-[30px] leading-[1.02] tracking-[-0.025em] text-ivory">
              {step.title}
            </h1>
            <p className="mt-2 max-w-[330px] text-[11px] leading-relaxed text-muted">
              {step.prompt}
            </p>
          </>
        )}

        <div className="mt-4">
          {guided ? (
            <>
              {!reto &&
                node.branch === "ritmo" &&
                node.drill.kind === "rhythm" && (
                  <RhythmCallResponse
                    drill={node.drill}
                    onComplete={handleGuidedComplete}
                  />
                )}
              {!reto &&
                node.branch === "melodia" &&
                node.drill.kind === "melody" && (
                  <MelodyGuided
                    drill={node.drill}
                    onComplete={handleGuidedComplete}
                  />
                )}
            </>
          ) : (
            <>
              {stepIndex === 0 && (
                <FeelStep node={node} done={done[0]} onDone={completeStep} />
              )}
              {stepIndex === 1 && (
                <ListenStep node={node} done={done[1]} onDone={completeStep} />
              )}
              {stepIndex === 2 && (
                <ConceptStep node={node} done={done[2]} onDone={completeStep} />
              )}
              {stepIndex === 3 && !reto && (
                <div className="space-y-3">
                  <div className="rounded-[16px] border border-white/[0.05] bg-white/[0.015] px-3.5 py-2.5">
                    <p className="text-[8.5px] leading-relaxed text-muted">
                      {step.cue} El reto abre el juego completo con la
                      configuración de este nivel.
                    </p>
                  </div>
                  {node.branch === "ritmo" && node.drill.kind === "rhythm" && (
                    <GroovePadDual
                      drill={node.drill}
                      barsOverride={2}
                      compact
                      persist={false}
                      finishLabel="Sellar reto"
                      xpNote="El XP se acredita al sellar el reto"
                      onFinish={handleReto}
                    />
                  )}
                  {node.branch === "melodia" &&
                    node.drill.kind === "melody" && (
                      <IntervalHunter
                        drill={node.drill}
                        roundsOverride={Math.min(5, node.drill.rounds)}
                        compact
                        persist={false}
                        finishLabel="Sellar reto"
                        xpNote="El XP se acredita al sellar el reto"
                        onFinish={handleReto}
                      />
                    )}
                  {node.branch === "armonia" &&
                    node.drill.kind === "harmony" && (
                      <ChordArchitect
                        drill={node.drill}
                        compact
                        persist={false}
                        finishLabel="Sellar reto"
                        xpNote="El XP se acredita al sellar el reto"
                        onFinish={handleReto}
                      />
                    )}
                </div>
              )}
            </>
          )}

          {(guided || stepIndex === 3) && reto && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[24px] border border-[#F5C15A]/20 bg-[linear-gradient(150deg,rgba(245,193,90,0.09),rgba(4,11,19,0.9))] p-5 text-center"
            >
              <span className="text-[34px]">✦</span>
              <p className="mt-1 font-display text-[22px] leading-tight text-ivory">
                Nivel sellado
              </p>
              <div className="mt-2 flex justify-center">
                <Stars value={reto.result.stars} size={22} />
              </div>
              <p className="mt-2 text-[9.5px] leading-relaxed text-muted">
                {reto.result.accuracy}% de precisión · +{reto.xp} XP en tu perfil.
                {reto.result.stars < 3
                  ? " Repite el reto para encender la tercera estrella."
                  : node.level >= CURRICULUM_LEVEL_COUNT
                    ? " Has cruzado el último umbral: ahora el repertorio y el escenario."
                    : " Las tres ramas te esperan en el siguiente umbral."}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="neu-button neu-button--primary mt-4 w-full rounded-[13px] py-2.5 text-[10px]"
              >
                <ArrowRight size={12} />
                Volver al mapa
              </button>
              <button
                type="button"
                onClick={() => {
                  setReto(null);
                  if (!guided) {
                    setDone((previous) => {
                      const next = [...previous];
                      next[3] = false;
                      return next;
                    });
                  }
                }}
                className="mt-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-faint"
              >
                Repetir reto
              </button>
            </motion.div>
          )}
        </div>

        {!guided && stepIndex < 3 && (
          <div className="mt-4 flex items-center gap-2">
            <p className="flex-1 text-[7.5px] leading-relaxed text-faint">
              {step.cue}
            </p>
            <button
              type="button"
              disabled={!done[stepIndex]}
              onClick={() => setStepIndex((index) => Math.min(3, index + 1))}
              className="neu-button neu-button--primary min-h-0 flex-none rounded-[13px] px-4 py-2.5 text-[9.5px]"
            >
              {done[stepIndex] ? "Continuar" : "Completa el paso"}
              <ArrowRight size={12} />
            </button>
          </div>
        )}

        {saving && (
          <p className="mt-3 text-center text-[8px] uppercase tracking-[0.15em] text-faint">
            Guardando en tu perfil…
          </p>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Step 1 — Sentir                                                            */
/* -------------------------------------------------------------------------- */

function FeelStep({
  node,
  done,
  onDone,
}: {
  node: CurriculumNode;
  done: boolean;
  onDone: () => void;
}) {
  const audio = useAudioEngine();
  const [active, setActive] = useState<number[]>([]);
  const audioRef = useRef(audio);
  audioRef.current = audio;

  useEffect(() => {
    return () => audioRef.current.releaseAll();
  }, []);

  if (node.branch === "ritmo") {
    return <PulseFeel node={node} done={done} onDone={onDone} />;
  }
  if (node.branch === "melodia") {
    return <ContourFeel done={done} onDone={onDone} />;
  }

  const intervals =
    node.drill.kind === "harmony"
      ? CHORD_QUALITIES[node.drill.qualities[0]].intervals.slice(0, 3)
      : [0, 4, 7];
  const rootPc = node.drill.kind === "harmony" ? node.drill.roots[0] : 0;

  const toggleVoice = (voice: number) => {
    const midi = 60 + rootPc + intervals[voice];
    if (active.includes(voice)) {
      audio.forceNoteOff(midi);
      setActive(active.filter((item) => item !== voice));
      return;
    }
    audio.unlock();
    audio.noteOn(midi, 0.6);
    const next = [...active, voice];
    setActive(next);
    if (next.length === intervals.length) onDone();
  };

  return (
    <div className="space-y-3">
      <div className="neu-inset relative overflow-hidden rounded-[20px] p-4">
        <div className="flex items-end justify-center gap-3">
          {["Raíz", "Tercera", "Quinta"].map((label, voice) => {
            const unlocked = active.includes(voice);
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleVoice(voice)}
                className={cn(
                  "flex w-20 flex-col items-center gap-2 rounded-[16px] border px-2 py-3 transition-all duration-300",
                  unlocked
                    ? "border-[#9DB5FF]/35 bg-[#9DB5FF]/[0.09] shadow-[0_0_20px_rgba(157,181,255,0.16)]"
                    : "border-white/[0.055] bg-white/[0.02]",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full border font-display text-[16px]",
                    unlocked
                      ? "border-[#9DB5FF]/30 text-[#C7D5FF]"
                      : "border-white/[0.07] text-faint",
                  )}
                >
                  {LETTERS[(rootPc + intervals[voice]) % 12]}
                </span>
                <span className="text-[7px] font-semibold uppercase tracking-[0.13em] text-faint">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[8.5px] text-muted">
          Enciende las tres voces y sostenlas juntas. La tercera decide el color.
        </p>
      </div>
      <Dots done={done} label="Voces escuchadas" />
    </div>
  );
}

function PulseFeel({
  node,
  done,
  onDone,
}: {
  node: CurriculumNode;
  done: boolean;
  onDone: () => void;
}) {
  const audio = useAudioEngine();
  const bpm = node.drill.kind === "rhythm" ? node.drill.bpm : 76;
  const [beats, setBeats] = useState(0);
  const [taps, setTaps] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      audio.releaseAll();
    };
  }, [audio]);

  const playPulse = () => {
    audio.unlock();
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setBeats(0);
    const gap = 60000 / bpm;
    for (let index = 0; index < 8; index += 1) {
      audio.playPercussion("click", { accent: index % 4 === 0 });
      const timer = window.setTimeout(() => {
        setBeats(index + 1);
      }, index * gap);
      timers.current.push(timer);
    }
  };

  const tap = () => {
    audio.unlock();
    audio.playPercussion("woodblock");
    const next = taps + 1;
    setTaps(next);
    if (next >= 4) onDone();
  };

  return (
    <div className="space-y-3">
      <div className="neu-inset relative overflow-hidden rounded-[20px] p-4 text-center">
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-2 w-2 rounded-full transition-all duration-150",
                index < beats
                  ? index % 4 === 0
                    ? "bg-cyan-200 shadow-[0_0_10px_rgba(186,230,253,0.9)]"
                    : "bg-glow/70"
                  : "bg-white/10",
              )}
            />
          ))}
        </div>
        <p className="mt-3 font-display text-[34px] leading-none text-ivory">
          {taps}
          <span className="ml-1 text-[10px] uppercase tracking-[0.16em] text-faint">
            / 4 pulsos
          </span>
        </p>
        <p className="mt-1 text-[8px] text-faint">
          Escucha y camina el pulso antes de tocar.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={playPulse}
            className="neu-button min-h-0 flex-1 rounded-[12px] py-2.5 text-[9px]"
          >
            <Waves size={12} />
            Oír pulso
          </button>
          <button
            type="button"
            onClick={tap}
            className="neu-button neu-button--primary min-h-0 flex-1 rounded-[12px] py-2.5 text-[9px]"
          >
            <Hand size={12} />
            Tocar pulso
          </button>
        </div>
      </div>
      <Dots done={done} label="Pulso sentido" />
    </div>
  );
}

function ContourFeel({ done, onDone }: { done: boolean; onDone: () => void }) {
  const audio = useAudioEngine();
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [moved, setMoved] = useState(false);
  const lastMidi = useRef<number | null>(null);
  const bounds = useRef<DOMRect | null>(null);

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect =
      bounds.current ??
      (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    bounds.current = rect;
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setPoint({ x, y });
    const midi = Math.round(72 - y * 12);
    if (midi !== lastMidi.current) {
      lastMidi.current = midi;
      audio.unlock();
      audio.playNote(midi, 0.35, 0.7);
    }
    if (!moved) {
      setMoved(true);
      window.setTimeout(onDone, 900);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className="contour-pad neu-inset relative h-52 touch-none overflow-hidden rounded-[20px]"
        onPointerDown={move}
        onPointerMove={(event) => {
          if (event.buttons > 0 || event.pointerType === "touch") move(event);
        }}
        onPointerUp={() => {
          bounds.current = null;
        }}
      >
        <span className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-white/10" />
        <span className="pointer-events-none absolute left-3 top-3 text-[6.5px] font-semibold uppercase tracking-[0.16em] text-faint">
          Agudo
        </span>
        <span className="pointer-events-none absolute bottom-3 left-3 text-[6.5px] font-semibold uppercase tracking-[0.16em] text-faint">
          Grave
        </span>
        {point && (
          <>
            <span
              className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/50 bg-cyan-300/20 shadow-[0_0_26px_rgba(56,189,248,0.5)]"
              style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
            />
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-cyan-200/30"
              style={{ left: `${point.x * 100}%` }}
            />
          </>
        )}
        {!point && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[9px] text-muted">
            Arrastra el dedo para dibujar el contorno
          </span>
        )}
      </div>
      <Dots done={done} label="Contorno dibujado" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 2 — Escuchar                                                          */
/* -------------------------------------------------------------------------- */

function ListenStep({
  node,
  done,
  onDone,
}: {
  node: CurriculumNode;
  done: boolean;
  onDone: () => void;
}) {
  const audio = useAudioEngine();
  const [answered, setAnswered] = useState<string | null>(null);
  const [right, setRight] = useState(false);

  const rhythm = node.drill.kind === "rhythm" ? node.drill : null;
  const harmonyDrill = node.drill.kind === "harmony" ? node.drill : null;
  const melodyDrill = node.drill.kind === "melody" ? node.drill : null;

  const rhythmAnswer = (() => {
    if (!rhythm) return "";
    const counts = new Map<number, number>();
    for (const hit of rhythm.hits) {
      const beat = Math.floor(hit.at);
      counts.set(beat, (counts.get(beat) ?? 0) + 1);
    }
    const values = [...counts.values()];
    if (values.every((value) => value === 1)) return "Un golpe";
    if (values.every((value) => value === 2)) return "Dos golpes";
    return "Mixto";
  })();

  const harmonyQuality: ChordQuality = harmonyDrill?.qualities[0] ?? "maj";
  const harmonyEmotion = CHORD_QUALITIES[harmonyQuality].emotion;

  const play = () => {
    audio.unlock();
    if (rhythm) {
      const spb = 60 / rhythm.bpm;
      const start = audio.now() + 0.12;
      for (let index = 0; index < 4; index += 1) {
        rhythm.hits
          .filter((hit) => hit.at >= index && hit.at < index + 1)
          .forEach((hit) => {
            audio.playPercussion(hit.hand === "left" ? "kick" : "snare", {
              when: start + hit.at * spb,
            });
          });
        audio.playPercussion("click", {
          when: start + index * spb,
          accent: index === 0,
        });
      }
      return;
    }
    if (melodyDrill) {
      audio.playNote(60, 0.55, 0.78);
      window.setTimeout(() => audio.playNote(67, 0.95, 0.8), 640);
      return;
    }
    if (harmonyDrill) {
      const root = harmonyDrill.roots[0];
      audio.playChord(
        CHORD_QUALITIES[harmonyQuality].intervals.map(
          (interval) => 60 + root + interval,
        ),
        1.5,
        0.72,
      );
    }
  };

  const options = rhythm
    ? ["Un golpe", "Dos golpes", "Mixto"]
    : melodyDrill
      ? ["Sube", "Baja"]
      : (Object.keys(EMOTION_META) as Array<keyof typeof EMOTION_META>).map(
          (emotion) => EMOTION_META[emotion].label,
        );

  const correct = rhythm
    ? rhythmAnswer
    : melodyDrill
      ? "Sube"
      : EMOTION_META[harmonyEmotion].label;

  const choose = (option: string) => {
    setAnswered(option);
    const ok = option === correct;
    setRight(ok);
    if (ok) onDone();
  };

  return (
    <div className="space-y-3">
      <div className="neu-inset relative overflow-hidden rounded-[20px] p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] text-glow">
            <Ear size={18} />
          </span>
          <div>
            <p className="font-display text-[18px] leading-tight text-ivory">
              {rhythm
                ? "¿Qué densidad tiene el pulso?"
                : melodyDrill
                  ? "¿La segunda nota sube o baja?"
                  : "¿Qué color emocional tiene?"}
            </p>
            <p className="mt-0.5 text-[8px] text-faint">
              {node.steps[1].cue}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={play}
          className="neu-button neu-button--primary mt-3 w-full rounded-[12px] py-2.5 text-[9.5px]"
        >
          <Headphones size={12} />
          Escuchar
        </button>
      </div>

      <div className={cn("grid gap-2", options.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
        {options.map((option) => {
          const selected = answered === option;
          const reveal = answered !== null && option === correct;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              className={cn(
                "choice-key rounded-[13px] border px-2 py-3 text-[9px] font-semibold transition-all",
                reveal
                  ? "border-[#7DE2C3]/35 bg-[#7DE2C3]/[0.08] text-[#B9F5E2]"
                  : selected
                    ? "border-[#FB7185]/30 bg-[#FB7185]/[0.07] text-[#FFC1CB]"
                    : "border-white/[0.055] text-ivory/85",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered && (
        <p
          className={cn(
            "rounded-[12px] border px-3 py-2 text-[8.5px] leading-relaxed",
            right
              ? "border-[#7DE2C3]/20 bg-[#7DE2C3]/[0.05] text-[#B9F5E2]"
              : "border-[#FB7185]/20 bg-[#FB7185]/[0.05] text-[#FFC1CB]",
          )}
        >
          {right
            ? "Exacto. Puedes continuar."
            : `Todavía no: la respuesta es ${correct}. Escucha otra vez.`}
        </p>
      )}
      <Dots done={done} label="Oído despierto" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Step 3 — Comprender                                                        */
/* -------------------------------------------------------------------------- */

function ConceptStep({
  node,
  done,
  onDone,
}: {
  node: CurriculumNode;
  done: boolean;
  onDone: () => void;
}) {
  const audio = useAudioEngine();
  const [visited, setVisited] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState<boolean | null>(null);

  const rhythm = node.drill.kind === "rhythm" ? node.drill : null;
  const harmonyDrill = node.drill.kind === "harmony" ? node.drill : null;

  const mark = (value: number) => {
    if (visited.includes(value)) return;
    const next = [...visited, value];
    setVisited(next);
    if (next.length >= 1) onDone();
  };

  if (rhythm) {
    const target = rhythm.hits.map((hit) => Math.round(hit.at * 2));
    const toggle = (cell: number) => {
      audio.unlock();
      audio.playPercussion("click", { accent: cell % 4 === 0 });
      setChecked(null);
      setSelected((previous) =>
        previous.includes(cell)
          ? previous.filter((item) => item !== cell)
          : [...previous, cell],
      );
    };
    const verify = () => {
      const ok =
        selected.length === target.length &&
        target.every((cell) => selected.includes(cell));
      setChecked(ok);
      if (ok) onDone();
    };

    return (
      <div className="space-y-3">
        <div className="neu-inset relative overflow-hidden rounded-[20px] p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-[7px] font-semibold uppercase tracking-[0.16em] text-faint">
              Carril de 8 corcheas
            </p>
            <span className="text-[7px] font-semibold uppercase tracking-[0.14em] text-faint">
              4 tiempos
            </span>
          </div>
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {Array.from({ length: 8 }, (_, cell) => {
              const on = selected.includes(cell);
              const isTarget = target.includes(cell);
              return (
                <button
                  key={cell}
                  type="button"
                  onClick={() => toggle(cell)}
                  aria-pressed={on}
                  className={cn(
                    "aspect-square rounded-[5px] border transition-all duration-150",
                    on
                      ? "border-cyan-200/40 bg-cyan-300/25 shadow-[0_0_12px_rgba(56,189,248,0.25)]"
                      : isTarget
                        ? "border-white/15 bg-white/[0.04]"
                        : "border-white/[0.045] bg-white/[0.012]",
                  )}
                >
                  <span className="sr-only">Corchea {cell + 1}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[7px] uppercase tracking-[0.13em] text-faint">
              Los contornos claros son la guía
            </span>
            <button
              type="button"
              onClick={verify}
              className="neu-button min-h-0 rounded-full px-3 py-1.5 text-[8px]"
            >
              Comprobar
            </button>
          </div>
          {checked !== null && (
            <p
              className={cn(
                "mt-2 rounded-[10px] px-2.5 py-1.5 text-[8px]",
                checked
                  ? "bg-[#7DE2C3]/[0.07] text-[#B9F5E2]"
                  : "bg-[#FB7185]/[0.06] text-[#FFC1CB]",
              )}
            >
              {checked
                ? "Patrón exacto. Ya puedes tocar el reto."
                : "Ajusta las celdas: la guía marca los golpes del nivel."}
            </p>
          )}
        </div>
        <Dots done={done || checked === true} label="Patrón comprendido" />
      </div>
    );
  }

  if (harmonyDrill) {
    return (
      <div className="space-y-3">
        <div className="neu-inset relative overflow-hidden rounded-[20px] p-3.5">
          <div className="space-y-2">
            {harmonyDrill.qualities.map((quality) => {
              const meta = CHORD_QUALITIES[quality];
              const marker = 100 + harmonyDrill.qualities.indexOf(quality);
              const heard = visited.includes(marker);
              return (
                <button
                  key={quality}
                  type="button"
                  onClick={() => {
                    audio.unlock();
                    audio.playChord(
                      meta.intervals.map(
                        (interval) => 60 + harmonyDrill.roots[0] + interval,
                      ),
                      1.4,
                      0.7,
                    );
                    mark(marker);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition-all",
                    heard
                      ? "border-[#9DB5FF]/25 bg-[#9DB5FF]/[0.06]"
                      : "border-white/[0.05] bg-white/[0.015]",
                  )}
                >
                  <span
                    className="grid h-8 w-8 flex-none place-items-center rounded-full border text-[14px]"
                    style={{
                      borderColor: `${EMOTION_META[meta.emotion].color}33`,
                      color: EMOTION_META[meta.emotion].color,
                    }}
                  >
                    {meta.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold text-ivory/90">
                      {meta.label}
                    </span>
                    <span className="block text-[7px] text-faint">
                      {meta.formula} · {meta.emotion}
                    </span>
                  </span>
                  {heard && <Check size={13} className="text-[#7DE2C3]" />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-12 gap-[2px]">
            {Array.from({ length: 12 }, (_, step) => (
              <span
                key={step}
                className="rounded-[2px] border border-white/[0.035] bg-white/[0.012] py-0.5 text-center text-[5px] text-faint/50"
              >
                {step}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[7px] text-faint">
            Toca cada color: los semitonos están contados desde la raíz.
          </p>
        </div>
        <Dots
          done={visited.length >= harmonyDrill.qualities.length}
          label="Fórmulas comprendidas"
        />
      </div>
    );
  }

  // Melody: an interval staircase.
  return (
    <div className="space-y-3">
      <div className="neu-inset relative overflow-hidden rounded-[20px] p-3.5">
        <div className="space-y-1.5">
          {[2, 4, 7, 12].map((interval, index) => {
            const heard = visited.includes(interval);
            return (
              <button
                key={interval}
                type="button"
                onClick={() => {
                  audio.unlock();
                  audio.playNote(60, 0.5, 0.75);
                  window.setTimeout(
                    () => audio.playNote(60 + interval, 0.9, 0.8),
                    520,
                  );
                  mark(interval);
                }}
                className={cn(
                  "relative flex items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left transition-all",
                  heard
                    ? "border-cyan-300/25 bg-cyan-300/[0.06]"
                    : "border-white/[0.05] bg-white/[0.012]",
                )}
                style={{ marginLeft: index * 10 }}
              >
                <span className="font-display text-[13px] text-glow">
                  {INTERVAL_LABELS[interval]}
                </span>
                <span className="ml-auto text-[7px] uppercase tracking-[0.13em] text-faint">
                  {interval} semitonos
                </span>
                {heard && <Check size={11} className="text-[#7DE2C3]" />}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-[7.5px] text-faint">
          Sube la escalera completa: cada peldaño es una distancia distinta.
        </p>
      </div>
      <Dots done={visited.length >= 4} label="Escalera recorrida" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Dots({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[1, 2, 3].map((dot) => (
        <span
          key={dot}
          className={cn(
            "h-1.5 w-1.5 rounded-full transition-colors",
            done ? "bg-[#7DE2C3]" : "bg-white/12",
          )}
        />
      ))}
      <span className="ml-1 text-[7px] font-semibold uppercase tracking-[0.15em] text-faint">
        {done ? `${label} · listo` : label}
      </span>
    </div>
  );
}
