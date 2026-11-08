import { BrainCircuit, Code2, ShieldCheck, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SkillCategory } from "@/types";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const icons: LucideIcon[] = [Code2, ShieldCheck, Wrench, BrainCircuit];

export function Skills({ categories }: { categories: SkillCategory[] }) {
  return (
    <Section
      id="skills"
      index="02"
      label="Skills"
      title="Toolkit"
      intro="The languages, security tooling and AI stack behind the projects — grouped the way I actually use them."
      alt
    >
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((category, index) => {
          const Icon = icons[index % icons.length];
          return (
            <Reveal key={category.id} delay={index * 0.05}>
              <div className="panel card-hover h-full p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl border border-line bg-ink/60 p-2.5 text-mint">
                      <Icon size={17} aria-hidden="true" />
                    </span>
                    <h3 className="text-[15px] font-medium text-paper">{category.name}</h3>
                  </div>
                  <span className="font-mono text-[10px] text-fog/60">
                    {String(category.skills.length).padStart(2, "0")}
                  </span>
                </div>

                {category.description && (
                  <p className="mt-3 text-[13px] leading-6 text-fog">{category.description}</p>
                )}

                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {category.skills.map((skill) => (
                    <li key={skill.id} className="chip">
                      {skill.name}
                    </li>
                  ))}
                </ul>

                {category.skills.some((skill) => skill.level !== null) && (
                  <div className="mt-4 space-y-2">
                    {category.skills
                      .filter((skill) => skill.level !== null)
                      .map((skill) => (
                        <div key={skill.id}>
                          <div className="mb-1 flex justify-between font-mono text-[10px] text-fog">
                            <span>{skill.name}</span>
                            <span>{skill.level}%</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-mint/70"
                              style={{ width: `${skill.level}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
