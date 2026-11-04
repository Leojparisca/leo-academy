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
      <div className="flex items-baseline gap-2.5">
        <span className="font-display text-[10px] italic text-glow/60">
          {index}
        </span>
        <h2
          id={id}
          className="scroll-mt-28 font-display text-[20px] font-medium leading-none text-ivory"
        >
          {title}
        </h2>
      </div>
      {meta}
    </div>
  );
}
