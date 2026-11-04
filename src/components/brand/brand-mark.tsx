import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandMark({
  size = 44,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex flex-none items-center justify-center overflow-hidden rounded-[15px] border border-white/10 bg-abyss",
        className,
      )}
      style={{
        width: size,
        height: size,
        boxShadow:
          "0 0 0 1px rgba(56,189,248,0.08), 4px 4px 12px #03070D, -2px -2px 8px rgba(30,95,180,0.18), inset 0 1px 0 rgba(255,255,255,0.14)",
      }}
    >
      <Image
        src="/logo.jpg"
        alt=""
        fill
        priority={priority}
        sizes={`${size}px`}
        className="scale-[1.03] object-cover"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/10 via-transparent to-cyan-300/10"
      />
    </span>
  );
}
