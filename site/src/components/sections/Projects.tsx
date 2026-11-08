import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ProjectStatus, ProjectSummary } from "@/types";
import { Section } from "@/components/ui/Section";
import { ProjectCard } from "./ProjectCard";

type Filter = "all" | ProjectStatus;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "ongoing", label: "Ongoing" },
  { key: "upcoming", label: "Upcoming" },
];

export function Projects({ projects }: { projects: ProjectSummary[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    return {
      all: projects.length,
      completed: projects.filter((project) => project.status === "completed").length,
      ongoing: projects.filter((project) => project.status === "ongoing").length,
      upcoming: projects.filter((project) => project.status === "upcoming").length,
    } satisfies Record<Filter, number>;
  }, [projects]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? projects
        : projects.filter((project) => project.status === filter),
    [filter, projects],
  );

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? FILTERS.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % FILTERS.length
            : (index - 1 + FILTERS.length) % FILTERS.length;
    setFilter(FILTERS[next].key);
    const buttons = event.currentTarget.parentElement?.querySelectorAll("button");
    buttons?.[next]?.focus();
  };

  return (
    <Section
      id="projects"
      index="03"
      label="Projects"
      title="Completed, ongoing, and what's next."
      intro="Security, AI and full-stack builds — each with a case study covering the problem, the stack and the current state."
    >
      <div
        role="tablist"
        aria-label="Filter projects by status"
        className="mb-7 flex flex-wrap gap-1.5 rounded-full border border-line bg-panel/50 p-1.5 sm:inline-flex"
      >
        {FILTERS.map((item, index) => {
          const selected = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setFilter(item.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] transition-colors ${
                selected
                  ? "bg-paper text-ink"
                  : "text-fog hover:bg-panel-2 hover:text-paper"
              }`}
            >
              {item.label}
              <span className={selected ? "ml-1.5 text-ink/60" : "ml-1.5 text-fog/50"}>
                {counts[item.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="tabpanel">
        {visible.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {visible.length === 0 && (
        <p className="panel p-8 text-center text-sm text-fog">
          No projects in this category yet.
        </p>
      )}
    </Section>
  );
}
