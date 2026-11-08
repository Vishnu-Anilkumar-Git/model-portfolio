import { Link } from "react-router-dom";
import { ArrowUpRight, PlayCircle } from "lucide-react";
import type { ProjectSummary } from "@/types";
import { GithubIcon } from "@/components/ui/BrandIcons";
import { ProjectArtwork } from "@/components/ui/ProjectArtwork";
import { ProjectStatusBadge } from "@/components/ui/StatusBadge";
import { TechChips } from "@/components/ui/TechChips";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <article className="panel card-hover group flex h-full flex-col overflow-hidden">
      {/* The cover repeats the title link below; hide it from assistive tech so
          it is not announced twice. */}
      <Link
        to={`/projects/${project.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className="block overflow-hidden border-b border-line"
      >
        {project.cover_image ? (
          <div className="relative aspect-[16/9] overflow-hidden bg-panel-2">
            <img
              src={project.cover_image}
              alt={`${project.title} cover`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
        ) : (
          <ProjectArtwork project={project} className="aspect-[16/9]" />
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ProjectStatusBadge status={project.status} label={project.status_label} />
          <span className="font-mono text-[10px] text-fog/70">{project.timeline}</span>
        </div>

        <h3 className="mt-3 text-[17px] leading-6 font-medium tracking-[-0.01em]">
          <Link
            to={`/projects/${project.slug}`}
            className="transition-colors hover:text-flame"
          >
            {project.title}
          </Link>
        </h3>
        {project.subtitle && (
          <p className="mt-1 text-[12.5px] text-fog/80">{project.subtitle}</p>
        )}

        <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-fog">
          {project.summary}
        </p>

        {project.status === "ongoing" && project.progress !== null && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between font-mono text-[10px] text-fog">
              <span>build progress</span>
              <span className="text-flame">{project.progress}%</span>
            </div>
            <div
              className="h-1 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={project.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${project.title} progress`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-flame to-mint"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        )}

        <TechChips tech={project.tech} limit={5} className="mt-4" />

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line/70 pt-4">
          <Link
            to={`/projects/${project.slug}`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-paper transition-colors hover:text-flame"
          >
            Case study
            <ArrowUpRight size={13} aria-hidden="true" />
          </Link>

          <div className="flex items-center gap-3 text-fog">
            {project.repo_url && (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${project.title} repository`}
                className="transition-colors hover:text-paper"
              >
                <GithubIcon size={15} />
              </a>
            )}
            {project.demo_url && (
              <a
                href={project.demo_url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${project.title} live demo`}
                className="transition-colors hover:text-paper"
              >
                <PlayCircle size={15} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
