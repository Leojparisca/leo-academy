"use client";

import { motion } from "framer-motion";
import {
  Gamepad2,
  GraduationCap,
  Map,
  Piano,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS: Array<{
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { href: "/mapa", label: "Mapa", hint: "Niveles", icon: Map },
  { href: "/estudio", label: "Estudio", hint: "Teclado", icon: Piano },
  { href: "/juegos", label: "Juegos", hint: "Oído", icon: Gamepad2 },
  {
    href: "/profesor",
    label: "Profesor",
    hint: "Mesa",
    icon: GraduationCap,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
    >
      <div className="bottom-nav pointer-events-auto mx-auto flex w-full max-w-[520px] items-stretch gap-0.5 rounded-[25px] p-1.5">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              aria-label={`${tab.label} · ${tab.hint}`}
              onClick={() => {
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                  navigator.vibrate?.(6);
                }
              }}
              className={cn(
                "relative flex min-h-[54px] flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-1.5",
                "transition-colors duration-300",
                active ? "text-ivory" : "text-faint hover:text-muted",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-pool"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  className="nav-pool absolute inset-0 rounded-[20px]"
                  aria-hidden
                />
              )}
              <Icon
                size={19}
                strokeWidth={active ? 2.1 : 1.6}
                className={cn(
                  "relative z-10 transition-all duration-300",
                  active && "text-glow drop-shadow-[0_0_9px_rgba(56,189,248,0.45)]",
                )}
              />
              <span
                className={cn(
                  "relative z-10 text-[8.5px] font-semibold uppercase tracking-[0.14em] transition-colors duration-300",
                  active ? "text-ivory/95" : "text-faint/80",
                )}
              >
                {tab.label}
              </span>
              {active && (
                <motion.span
                  layoutId="nav-dot"
                  className="absolute bottom-[5px] z-10 h-[2px] w-4 rounded-full bg-glow/80 shadow-[0_0_8px_rgba(56,189,248,0.8)]"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
