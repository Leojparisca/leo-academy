"use client";

import { useId } from "react";
import { SKILL_META, type StudentRadar } from "@/lib/academy";
import { cn } from "@/lib/utils";

const AXES = [
  { key: "melody" as const, label: "Melodía" },
  { key: "harmony" as const, label: "Armonía" },
  { key: "rhythm" as const, label: "Ritmo" },
];

const CENTER = 100;
const RADIUS = 66;

function polar(index: number, ratio: number) {
  const angle = (-90 + index * 120) * (Math.PI / 180);
  return {
    x: CENTER + Math.cos(angle) * RADIUS * ratio,
    y: CENTER + Math.sin(angle) * RADIUS * ratio,
  };
}

function polygon(ratio: number) {
  return AXES.map((_, index) => {
    const { x, y } = polar(index, ratio);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

/**
 * Hand-built SVG radar: Melodía / Armonía / Ritmo. Posture is intentionally
 * absent — it is a physical habit, shown as a separate dial on the dashboard.
 */
export function StudentRadar({
  data,
  size = 168,
  className,
  muted = false,
  compact = false,
}: {
  data: StudentRadar;
  size?: number;
  className?: string;
  muted?: boolean;
  compact?: boolean;
}) {
  const gradientId = useId();
  const glowId = useId();
  const withLabels = !compact && size >= 96;

  const values = AXES.map((axis) => Math.max(0, Math.min(100, data[axis.key])));
  const points = values
    .map((value, index) => {
      const { x, y } = polar(index, value / 100);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={`Radar musical. ${AXES.map(
        (axis, index) => `${axis.label} ${values[index]} de 100`,
      ).join(". ")}.`}
      className={cn("overflow-visible", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#7C9CFF" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#F2B45C" stopOpacity="0.3" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon
          key={ratio}
          points={polygon(ratio)}
          fill="none"
          stroke="rgba(148, 197, 255, 0.13)"
          strokeWidth={ratio === 1 ? 1.2 : 0.7}
        />
      ))}

      {AXES.map((axis, index) => {
        const { x, y } = polar(index, 1);
        return (
          <line
            key={axis.key}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="rgba(148, 197, 255, 0.14)"
            strokeWidth={0.8}
          />
        );
      })}

      <polygon
        points={points}
        fill={`url(#${gradientId})`}
        stroke={muted ? "rgba(148, 197, 255, 0.45)" : "#7CE3FF"}
        strokeWidth={1.6}
        strokeLinejoin="round"
        filter={muted ? undefined : `url(#${glowId})`}
        style={{ transition: "all 500ms ease" }}
      />

      {values.map((value, index) => {
        const { x, y } = polar(index, value / 100);
        return (
          <circle
            key={AXES[index].key}
            cx={x}
            cy={y}
            r={2.6}
            fill={SKILL_META[AXES[index].key].color}
            stroke="#041320"
            strokeWidth={0.9}
          />
        );
      })}

      {withLabels &&
        AXES.map((axis, index) => {
          const { x, y } = polar(index, 1.24);
          const anchor =
            index === 0 ? "middle" : index === 1 ? "start" : "end";
          return (
            <g key={axis.key}>
              <text
                x={x}
                y={y - 3}
                textAnchor={anchor}
                className="fill-[#9fb6cf] text-[8.5px] font-semibold uppercase"
                style={{ letterSpacing: "0.09em" }}
              >
                {axis.label}
              </text>
              <text
                x={x}
                y={y + 8}
                textAnchor={anchor}
                fill={SKILL_META[axis.key].color}
                className="text-[8px] font-bold tabular-nums"
              >
                {values[index]}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
