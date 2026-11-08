import type { ReactNode } from "react";
import { cn } from "@/lib/format";

interface SectionProps {
  id: string;
  index: string;
  label: string;
  title: string;
  intro?: string;
  children: ReactNode;
  className?: string;
  alt?: boolean;
}

export function Section({
  id,
  index,
  label,
  title,
  intro,
  children,
  className,
  alt = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "cv-auto relative scroll-mt-24 border-t border-line/60 py-20 sm:py-24",
        alt && "bg-panel/35",
        className,
      )}
    >
      <div className="shell">
        <div className="mb-10 flex flex-col gap-4 sm:mb-14 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-[0.2em] text-flame">
                {index}
              </span>
              <span className="h-px w-8 bg-flame/40" aria-hidden="true" />
              <span className="mono">{label}</span>
            </div>
            <h2 className="section-title">{title}</h2>
            {intro && <p className="mt-3 max-w-xl text-[15px] leading-7 text-fog">{intro}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}
