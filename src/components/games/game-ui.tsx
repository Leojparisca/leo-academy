"use client";

import { motion } from "framer-motion";
import { RotateCcw, Sparkles, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export type GameId = "rhythm" | "melody" | "harmony";

export type GameResult = {
  game: GameId;
  score: number;
  accuracy: number;
  stars: 1 | 2 | 3;
  xp: number;
  detail: string;
  stats: {
    perfect?: number;
    good?: number;
    miss?: number;
    correct?: number;
    total?: number;
    combo?: number;
  };
};

export function Stars({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${value} de 3 estrellas`}
    >
      {[1, 2, 3].map((index) => (
        <Star
          key={index}
          size={size}
          strokeWidth={1.4}
          className={cn(
            "transition-colors duration-500",
            index <= value
              ? "text-[#F5C15A] drop-shadow-[0_0_7px_rgba(245,193,90,0.7)]"
              : "text-white/12",
          )}
          fill={index <= value ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export function GameResultCard({
  result,
  onRetry,
  onFinish,
  finishLabel = "Continuar",
  xpNote,
  className,
}: {
  result: GameResult;
  onRetry?: () => void;
  onFinish?: (result: GameResult) => void;
  finishLabel?: string;
  xpNote?: string;
  className?: string;
}) {
  const stat = result.stats;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "game-result relative overflow-hidden rounded-[24px] border border-white/[0.07] p-5",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[#F5C15A]/10 blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-[7px]">Reto completado</p>
          <h3 className="mt-1.5 font-display text-[22px] leading-none text-ivory">
            {result.detail}
          </h3>
        </div>
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full border border-[#F5C15A]/20 bg-[#F5C15A]/[0.07] text-[#F5C15A]">
          <Trophy size={17} />
        </span>
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[46px] leading-none tabular-nums text-ivory">
            {Math.round(result.score)}
          </p>
          <p className="mt-1 text-[7px] font-semibold uppercase tracking-[0.2em] text-faint">
            Puntos · {Math.round(result.accuracy)}% precisión
          </p>
        </div>
        <Stars value={result.stars} size={19} />
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2">
        {stat.perfect !== undefined && (
          <>
            <ResultStat label="Perfecto" value={stat.perfect} tone="text-[#7DE2C3]" />
            <ResultStat label="Bueno" value={stat.good ?? 0} tone="text-[#38BDF8]" />
            <ResultStat label="Fuera" value={stat.miss ?? 0} tone="text-[#FB7185]" />
          </>
        )}
        {stat.correct !== undefined && (
          <>
            <ResultStat label="Aciertos" value={stat.correct} tone="text-[#7DE2C3]" />
            <ResultStat
              label="Errores"
              value={Math.max(0, (stat.total ?? 0) - stat.correct)}
              tone="text-[#FB7185]"
            />
            <ResultStat label="Racha" value={stat.combo ?? 0} tone="text-[#F5C15A]" />
          </>
        )}
      </div>

      <div className="relative mt-4 flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="neu-button flex-1 rounded-[14px] py-2.5 text-[10px]"
          >
            <RotateCcw size={12} />
            Repetir
          </button>
        )}
        <button
          type="button"
          onClick={onFinish ? () => onFinish(result) : onRetry}
          disabled={!onFinish && !onRetry}
          className="neu-button neu-button--primary flex-1 rounded-[14px] py-2.5 text-[10px]"
        >
          <Sparkles size={12} />
          {finishLabel}
        </button>
      </div>

      <p className="relative mt-3 text-center text-[7.5px] font-semibold uppercase tracking-[0.16em] text-faint/70">
        {xpNote ?? `+${Math.round(result.xp)} XP guardados en tu perfil`}
      </p>
    </motion.div>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-[12px] border border-white/[0.045] bg-black/15 px-2 py-2 text-center">
      <p className={cn("font-display text-[16px] leading-none tabular-nums", tone)}>
        {value}
      </p>
      <p className="mt-1 text-[6px] font-semibold uppercase tracking-[0.14em] text-faint">
        {label}
      </p>
    </div>
  );
}

export function GameMeter({
  value,
  tone = "#38BDF8",
}: {
  value: number;
  tone?: string;
}) {
  return (
    <div className="neu-inset h-[6px] overflow-hidden rounded-full p-[1px]">
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: `linear-gradient(90deg, #0D6EFD, ${tone})`,
          boxShadow: `0 0 10px ${tone}66`,
        }}
      />
    </div>
  );
}
