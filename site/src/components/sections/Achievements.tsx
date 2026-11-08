import { Award, ExternalLink, Flag, FlaskConical, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Achievement } from "@/types";
import { formatDate } from "@/lib/format";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const icons: Record<string, LucideIcon> = {
  lab: FlaskConical,
  ctf: Flag,
  award: Award,
  community: Users,
  other: Sparkles,
};

export function Achievements({ achievements }: { achievements: Achievement[] }) {
  if (!achievements.length) return null;

  return (
    <Section
      id="achievements"
      index="06"
      label="Labs & achievements"
      title="Practice, not just theory."
      intro="Hands-on labs, challenges and community work that sit alongside the formal training."
      alt
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {achievements.map((achievement, index) => {
          const Icon = icons[achievement.category] ?? Sparkles;
          return (
            <Reveal key={achievement.id} delay={index * 0.05}>
              <article className="panel card-hover flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-xl border border-line bg-ink/60 p-2.5 text-violet">
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.08em] text-fog/70 uppercase">
                    {achievement.category_label}
                  </span>
                </div>

                <h3 className="mt-4 text-[15px] font-medium">{achievement.title}</h3>
                <p className="mt-1 font-mono text-[10.5px] text-fog">
                  {[achievement.organization, formatDate(achievement.occurred_on)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {achievement.description && (
                  <p className="mt-3 text-[13px] leading-6 text-fog">
                    {achievement.description}
                  </p>
                )}

                {achievement.url && (
                  <a
                    href={achievement.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-auto inline-flex items-center gap-1.5 pt-4 font-mono text-[11px] text-paper transition-colors hover:text-violet"
                  >
                    View profile
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
