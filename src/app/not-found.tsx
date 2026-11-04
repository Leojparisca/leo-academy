import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Music2 } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

export const metadata: Metadata = {
  title: "Página no encontrada",
  description: "Esta página no está en el sendero de Leo Academy.",
};

export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 py-16">
      <div aria-hidden className="app-atmosphere" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-royal/[0.08] blur-3xl"
      />

      <div className="relative w-full max-w-[420px] text-center">
        <div className="flex justify-center">
          <BrandMark size={64} priority />
        </div>

        <p className="mt-8 text-[9px] font-semibold uppercase tracking-[0.28em] text-glow">
          Fuera del pentagrama
        </p>
        <h1 className="mt-3 font-display text-[56px] leading-none tracking-[-0.04em] text-ivory">
          <span className="sapphire-text">404</span>
        </h1>
        <h2 className="mt-2 font-display text-[26px] leading-tight text-ivory">
          Esta página no está
          <br />
          <em className="font-normal italic text-muted">en el sendero.</em>
        </h2>
        <p className="mx-auto mt-4 max-w-[300px] text-[11px] leading-relaxed text-muted">
          La partitura sigue en su sitio. Vuelve al mapa y retoma el nivel donde
          lo dejaste.
        </p>

        <div className="neu-card mt-8 rounded-[22px] p-4">
          <Link
            href="/mapa"
            className="neu-button neu-button--primary h-11 w-full rounded-[13px] text-[11px]"
          >
            <ArrowLeft size={14} />
            Volver al mapa
          </Link>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[7.5px] font-semibold uppercase tracking-[0.18em] text-faint">
            <Music2 size={10} />
            Leo Academy · Piano y armonía
          </p>
        </div>
      </div>
    </main>
  );
}
