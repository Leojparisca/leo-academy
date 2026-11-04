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
  icon: LucideIcon;
  center?: boolean;
}> = [
  { href: "/mapa", label: "Mapa", icon: Map },
  { href: "/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/estudio", label: "Estudio", icon: Piano, center: true },
  { href: "/profesor", label: "Profesor", icon: GraduationCap },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="bottom-nav pointer-events-auto fixed inset-x-3 bottom-3 z-40 mx-auto flex h-16 max-w-md items-center justify-around rounded-full border border-white/10 bg-[#0B111D]/90 px-2 pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-black/80 backdrop-blur-2xl"
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;

        if (tab.center) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
              onClick={() => {
                if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                  navigator.vibrate?.(6);
                }
              }}
              className="relative -mt-9 flex min-h-[52px] flex-col items-center justify-center gap-1 px-1"
            >
              <motion.span
                whileTap={{ scale: 0.92 }}
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/30 ring-[5px] ring-[#060911] transition-shadow duration-300",
                  active && "shadow-[0_0_28px_rgba(56,189,248,0.55)]",
                )}
              >
                <Icon size={23} strokeWidth={2} />
              </motion.span>
              <span
                className={cn(
                  "text-[9px] font-semibold tracking-[0.04em]",
                  active ? "text-white" : "text-slate-400",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            aria-label={tab.label}
            onClick={() => {
              if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate?.(6);
              }
            }}
            className={cn(
              "relative flex min-h-[52px] min-w-[52px] flex-col items-center justify-center gap-1 rounded-full px-1.5 transition-colors duration-300",
              active ? "text-white" : "text-slate-400",
            )}
          >
            <Icon
              size={20}
              strokeWidth={active ? 2.2 : 1.7}
              className={cn(
                "transition-all duration-300",
                active && "drop-shadow-[0_0_9px_rgba(56,189,248,0.55)]",
              )}
            />
            <span className="text-[9px] font-semibold tracking-[0.04em]">
              {tab.label}
            </span>
            {active && (
              <motion.span
                layoutId="nav-dot"
                className="absolute bottom-1 h-1 w-1 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]"
                aria-hidden
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
