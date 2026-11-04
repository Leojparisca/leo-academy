"use client";

import { usePathname } from "next/navigation";
import { useAcademy } from "@/components/providers/academy-provider";
import { BottomNav } from "@/components/shell/bottom-nav";
import { Header } from "@/components/shell/header";
import { NeoToast } from "@/components/shell/neo-toast";
import { StudentWelcome } from "@/components/shell/student-welcome";

function Atmosphere() {
  return (
    <>
      <div className="app-atmosphere" aria-hidden>
        <div className="sapphire-orb left-[-90px] top-[6%] h-64 w-64 animate-slow-drift bg-royal/20" />
        <div className="sapphire-orb right-[-110px] top-[42%] h-80 w-80 animate-slow-drift bg-cyan-400/[0.07] [animation-delay:-7s]" />
        <div className="sapphire-orb bottom-[-80px] left-[18%] h-60 w-60 bg-royal/[0.12]" />
      </div>
      <div className="unplugged-lamp" aria-hidden />
      <div className="vignette" aria-hidden />
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { offlineMode, teacherMode, studentMode } = useAcademy();
  const pathname = usePathname();

  // The teacher door always stays reachable; every other route asks the
  // student to open their private profile first.
  const gated =
    !teacherMode && !studentMode && !pathname.startsWith("/profesor");

  if (gated) {
    return (
      <div className="relative min-h-dvh overflow-x-clip">
        <Atmosphere />
        <main
          id="contenido"
          className="relative z-10 mx-auto w-full max-w-[520px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+1.2rem)] sm:px-7"
        >
          <StudentWelcome />
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-royal focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Saltar al contenido
      </a>

      <Atmosphere />

      <Header />

      <main
        id="contenido"
        className="relative z-10 mx-auto w-full max-w-[560px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+9.5rem)] pt-[calc(env(safe-area-inset-top,0px)+8.4rem)] sm:px-7"
      >
        {children}
      </main>

      <BottomNav />
      <NeoToast />

      {offlineMode && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] bg-[linear-gradient(90deg,transparent,rgba(242,180,92,0.55),transparent)]" aria-hidden />
      )}
    </div>
  );
}
