import { useId } from "react";
import { accentGradient, accentStroke, cn } from "@/lib/format";
import type { ProjectSummary } from "@/types";

export function monogram(title: string): string {
  const words = title
    .replace(/—.*$/, "")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!words.length) return "VA";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function ProjectArtwork({
  project,
  className,
  large = false,
}: {
  project: ProjectSummary;
  className?: string;
  large?: boolean;
}) {
  const uid = useId().replace(/[:]/g, "");
  const stroke = accentStroke[project.accent] ?? accentStroke.orange;
  const patternId = `grid-${uid}`;
  const glowId = `glow-${uid}`;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        accentGradient[project.accent] ?? accentGradient.orange,
        className,
      )}
    >
      <svg
        viewBox="0 0 420 230"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id={patternId} width="34" height="34" patternUnits="userSpaceOnUse">
            <path d="M 34 0 L 0 0 0 34" fill="none" stroke="rgba(139,152,167,0.12)" strokeWidth="1" />
          </pattern>
          <radialGradient id={glowId} cx="78%" cy="18%" r="65%">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.24" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="420" height="230" fill={`url(#${patternId})`} />
        <rect width="420" height="230" fill={`url(#${glowId})`} />
        <path
          d="M-10 168 L68 168 L104 132 L182 132 L214 164 L300 164 L338 126 L430 126"
          fill="none"
          stroke={stroke}
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />
        <path
          d="M-10 196 L94 196 L130 160 L222 160 L256 192 L342 192 L374 158 L430 158"
          fill="none"
          stroke={stroke}
          strokeOpacity="0.16"
          strokeWidth="1"
        />
        {[
          [68, 168],
          [182, 132],
          [300, 164],
          [222, 160],
          [342, 192],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.4" fill={stroke} fillOpacity="0.85" />
        ))}
      </svg>

      <div
        className={cn(
          "relative flex h-full flex-col justify-between",
          large ? "p-7 sm:p-9" : "p-5",
        )}
      >
        <span className="font-mono text-[9.5px] tracking-[0.22em] text-fog/40 uppercase">
          vishnu.sec
        </span>
        <div className="flex items-end justify-between gap-4">
          <span
            className={cn(
              "font-mono font-semibold tracking-tight text-paper/90",
              large ? "text-6xl" : "text-4xl",
            )}
          >
            {monogram(project.title)}
          </span>
          <span className="max-w-[60%] text-right font-mono text-[10px] leading-5 text-fog/80">
            {project.tech.slice(0, 3).join(" · ")}
          </span>
        </div>
      </div>
    </div>
  );
}
