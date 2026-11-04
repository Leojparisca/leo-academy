import { cn } from "@/lib/utils";

export function SectionHeading({
  id,
  index,
  title,
  meta,
  className,
}: {
  id?: string;
  index: string;
  title: string;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="flex items-center gap-2.5">
        <span className="rounded-full border border-sky-400/20 bg-sky-400/[0.08] px-2 py-0.5 text-[9px] font-bold tabular-nums tracking-[0.06em] text-sky-300">
          {index}
        </span>
        <h2
          id={id}
          className="scroll-mt-28 text-[19px] font-bold leading-none tracking-[-0.01em] text-white"
        >
          {title}
        </h2>
      </div>
      {meta}
    </div>
  );
}
