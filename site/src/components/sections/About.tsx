import { Link } from "react-router-dom";
import { ArrowUpRight, Download, Target } from "lucide-react";
import type { Profile, Stat } from "@/types";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const accents = ["text-flame", "text-mint", "text-violet", "text-paper"];

export function About({
  profile,
  stats,
}: {
  profile: Profile;
  stats: Stat[];
}) {
  return (
    <Section
      id="about"
      index="01"
      label="About"
      title={profile.about_heading}
    >
      <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:gap-14">
        <Reveal>
          <div className="prose-body max-w-2xl">
            {profile.bio.map((paragraph, index) => (
              <p
                key={paragraph.slice(0, 40)}
                className={index === 0 ? "text-[16px] leading-8 text-paper/85" : undefined}
              >
                {paragraph}
              </p>
            ))}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/#contact" className="btn-ghost text-[13px]">
                Start a conversation
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
              {profile.resume_url && (
                <a
                  href={profile.resume_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-small"
                >
                  <Download size={13} aria-hidden="true" />
                  Resume PDF
                </a>
              )}
            </div>
          </div>
        </Reveal>

        <div>
          <Reveal delay={0.08}>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className="panel p-4 transition-colors hover:border-fog/30"
                >
                  <div
                    className={`font-mono text-3xl font-semibold tracking-tight ${
                      accents[index % accents.length]
                    }`}
                  >
                    {stat.value}
                  </div>
                  <div className="mt-1.5 text-[11px] leading-4 text-fog">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.14}>
            <div className="panel mt-3 p-4">
              <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-fog uppercase">
                <Target size={12} className="text-flame" aria-hidden="true" />
                Current focus
              </div>
              <p className="mt-2 text-sm leading-6 text-paper/85">
                Security operations, threat intelligence and AI-assisted security —
                building the practical side alongside certification training.
              </p>
              <p className="mt-2 font-mono text-[10.5px] text-fog/70">
                target role · {profile.target_role}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
