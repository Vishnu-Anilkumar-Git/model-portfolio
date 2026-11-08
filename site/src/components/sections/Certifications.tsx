import { ExternalLink, Info, ShieldCheck } from "lucide-react";
import type { Certification } from "@/types";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { CertStatusBadge } from "@/components/ui/StatusBadge";

const ORDER: Record<Certification["status"], number> = {
  in_progress: 0,
  planned: 1,
  completed: 2,
};

export function Certifications({ certifications }: { certifications: Certification[] }) {
  const sorted = [...certifications].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const inProgress = certifications.filter(
    (certification) => certification.status === "in_progress",
  ).length;
  const completed = certifications.filter(
    (certification) => certification.status === "completed",
  ).length;

  return (
    <Section
      id="certifications"
      index="05"
      label="Certifications & training"
      title="Credentials in progress."
      intro="A live view of what I am studying right now — statuses are shown exactly as they are, not rounded up."
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="chip border-flame/25 text-flame">
          {inProgress} in progress
        </span>
        <span className="chip">{certifications.length - completed - inProgress} planned</span>
        <span className="chip border-mint/25 text-mint">{completed} completed</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((certification, index) => (
          <Reveal key={certification.id} delay={Math.min(index * 0.03, 0.2)}>
            <article className="panel flex h-full items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] leading-5 font-medium text-paper">
                    {certification.name}
                  </h3>
                  <CertStatusBadge
                    status={certification.status}
                    label={certification.status_label}
                  />
                </div>
                <p className="mt-1.5 font-mono text-[10.5px] text-fog">
                  {[certification.issuer, certification.category_label]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {certification.description && (
                  <p className="mt-2 text-[12.5px] leading-5 text-fog/80">
                    {certification.description}
                  </p>
                )}
              </div>

              {certification.credential_url ? (
                <a
                  href={certification.credential_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Verify ${certification.name}`}
                  className="mt-1 shrink-0 text-fog transition-colors hover:text-mint"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              ) : (
                <ShieldCheck
                  size={15}
                  className="mt-1 shrink-0 text-fog/30"
                  aria-hidden="true"
                />
              )}
            </article>
          </Reveal>
        ))}
      </div>

      <div className="mt-6 flex gap-2.5 rounded-xl border border-line bg-panel/60 p-4 text-[12px] leading-5 text-fog">
        <Info size={15} className="mt-0.5 shrink-0 text-flame/80" aria-hidden="true" />
        <p>
          Everything above is training in progress or planned unless explicitly marked
          completed. None of these items are presented as an awarded certification.
        </p>
      </div>
    </Section>
  );
}
