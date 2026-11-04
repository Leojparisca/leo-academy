"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  size = 76,
  stroke = 5,
  className,
  label,
  caption,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  label?: string;
  caption?: string;
}) {
  const reduceMotion = useReducedMotion();
  const rawId = useId().replace(/[:]/g, "");
  const gradientId = `ring-${rawId}`;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn("relative flex-none", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? "Progreso"}: ${clamped}%`}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="-rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0D6EFD" />
            <stop offset="55%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#D7F3FF" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.055)"
          strokeWidth={stroke}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(56,189,248,0.08)"
          strokeWidth={stroke + 4}
          strokeDasharray={`${circumference * 0.32} ${circumference}`}
          strokeDashoffset={offset - circumference * 0.06}
          strokeLinecap="round"
          className="blur-[2px]"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: reduceMotion ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.45, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          style={{ filter: "drop-shadow(0 0 5px rgba(56,189,248,0.45))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[19px] leading-none text-ivory">
          {Math.round(clamped)}
          <span className="ml-0.5 text-[9px] text-faint">%</span>
        </span>
        {caption && (
          <span className="mt-0.5 text-[6.5px] font-semibold uppercase tracking-[0.16em] text-faint">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
