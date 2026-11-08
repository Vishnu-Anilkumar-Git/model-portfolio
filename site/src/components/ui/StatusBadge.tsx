import { cn, statusTone } from "@/lib/format";
import type { CertificationStatus, ProjectStatus } from "@/types";

const certTone: Record<CertificationStatus, string> = {
  completed: "border-mint/30 bg-mint/10 text-mint",
  in_progress: "border-flame/30 bg-flame/10 text-flame",
  planned: "border-violet/30 bg-violet/10 text-violet",
};

export function ProjectStatusBadge({
  status,
  label,
  className,
}: {
  status: ProjectStatus;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] uppercase",
        statusTone[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function CertStatusBadge({
  status,
  label,
}: {
  status: CertificationStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.08em] uppercase",
        certTone[status],
      )}
    >
      {label}
    </span>
  );
}
