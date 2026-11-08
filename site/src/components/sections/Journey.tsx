import { Link } from "react-router-dom";
import { ArrowUpRight, BriefcaseBusiness, GraduationCap, MapPin } from "lucide-react";
import type { Education, Experience, Profile } from "@/types";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

export function Journey({
  education,
  experience,
  profile,
}: {
  education: Education[];
  experience: Experience[];
  profile: Profile;
}) {
  return (
    <Section
      id="journey"
      index="04"
      label="Journey"
      title="Education and the work behind the portfolio."
      intro="A BCA foundation in software, now pointed at security operations and hands-on security engineering."
      alt
    >
      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <div className="mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-fog uppercase">
            <GraduationCap size={14} className="text-mint" aria-hidden="true" />
            Education
          </div>

          <ol className="relative space-y-4 border-l border-line pl-6">
            {education.map((entry, index) => (
              <li key={entry.id} className="relative">
                <span
                  className="absolute top-5 -left-[29px] h-2 w-2 rounded-full border border-mint/60 bg-mint shadow-[0_0_10px_rgba(62,214,181,0.5)]"
                  aria-hidden="true"
                />
                <Reveal delay={index * 0.05}>
                  <div className="panel p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[10.5px] tracking-[0.08em] text-flame">
                        {entry.period || "Completed"}
                      </span>
                      {entry.current && (
                        <span className="rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 font-mono text-[9.5px] text-mint uppercase">
                          current
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 text-[16px] font-medium">{entry.degree}</h3>
                    <p className="mt-1 text-sm text-fog">{entry.institution}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-fog/70">
                      {entry.university && <span>{entry.university}</span>}
                      {entry.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={10} aria-hidden="true" />
                          {entry.location}
                        </span>
                      )}
                      {entry.grade && <span>{entry.grade}</span>}
                    </div>
                    {entry.description && (
                      <p className="mt-3 text-[13px] leading-6 text-fog">{entry.description}</p>
                    )}
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>

          {experience.length > 0 && (
            <>
              <div className="mt-8 mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-fog uppercase">
                <BriefcaseBusiness size={14} className="text-flame" aria-hidden="true" />
                Experience
              </div>
              <ol className="relative space-y-4 border-l border-line pl-6">
                {experience.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span
                      className="absolute top-5 -left-[29px] h-2 w-2 rounded-full border border-flame/60 bg-flame"
                      aria-hidden="true"
                    />
                    <div className="panel p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px] text-fog">
                        <span className="text-flame">{entry.period}</span>
                        <span>{entry.kind_label}</span>
                      </div>
                      <h3 className="mt-2 text-[16px] font-medium">{entry.role}</h3>
                      <p className="mt-1 text-sm text-fog">{entry.organization}</p>
                      {entry.summary && (
                        <p className="mt-3 text-[13px] leading-6 text-fog">{entry.summary}</p>
                      )}
                      {entry.highlights.length > 0 && (
                        <ul className="mt-3 space-y-1.5">
                          {entry.highlights.map((highlight) => (
                            <li
                              key={highlight}
                              className="flex gap-2 text-[13px] leading-6 text-fog"
                            >
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-mint/70" />
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        <Reveal delay={0.1}>
          <div className="panel sticky top-24 p-5">
            <p className="mono">Open to</p>
            <p className="mt-3 text-[15px] leading-7 text-paper/90">
              {profile.availability ||
                `Entry-level ${profile.target_role} and security roles.`}
            </p>
            <div className="mt-4 space-y-2 border-t border-line pt-4 font-mono text-[10.5px] text-fog">
              <p className="flex justify-between gap-3">
                <span>target</span>
                <span className="text-paper/80">{profile.target_role}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span>base</span>
                <span className="text-paper/80">{profile.location}</span>
              </p>
              <p className="flex justify-between gap-3">
                <span>resume</span>
                <span className="text-paper/80">
                  {profile.resume_url ? "available" : "on request"}
                </span>
              </p>
            </div>
            <Link to="/#contact" className="btn-primary mt-5 w-full text-[13px]">
              Reach out
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
