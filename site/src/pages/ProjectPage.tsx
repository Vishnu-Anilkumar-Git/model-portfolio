import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ExternalLink,
  Lightbulb,
  PlayCircle,
} from "lucide-react";
import { ApiError, fetchProject } from "@/lib/api";
import { useSeo } from "@/lib/seo";
import { cn, formatDate } from "@/lib/format";
import { useSite } from "@/components/layout/SiteLayout";
import { ProjectArtwork } from "@/components/ui/ProjectArtwork";
import { GithubIcon } from "@/components/ui/BrandIcons";
import { ProjectStatusBadge } from "@/components/ui/StatusBadge";
import { TechChips } from "@/components/ui/TechChips";
import { ProjectCard } from "@/components/sections/ProjectCard";

function DetailSkeleton() {
  return (
    <div className="shell animate-pulse pt-28 pb-20">
      <div className="h-3 w-24 rounded bg-panel-2" />
      <div className="mt-8 h-10 w-3/4 rounded bg-panel-2" />
      <div className="mt-4 h-4 w-2/3 rounded bg-panel-2" />
      <div className="mt-10 aspect-[21/9] rounded-2xl border border-line bg-panel" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className="h-3 w-full rounded bg-panel-2" />
          <div className="h-3 w-11/12 rounded bg-panel-2" />
          <div className="h-3 w-10/12 rounded bg-panel-2" />
        </div>
        <div className="h-56 rounded-2xl border border-line bg-panel" />
      </div>
    </div>
  );
}

export function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const site = useSite();

  const query = useQuery({
    queryKey: ["project", slug],
    queryFn: () => fetchProject(slug ?? ""),
    enabled: Boolean(slug),
  });

  const project = query.data;
  const canonicalBase = site.profile.canonical_url.replace(/\/$/, "");
  const canonical = slug ? `${canonicalBase}/projects/${slug}` : canonicalBase;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slug]);

  const jsonLd = useMemo(() => {
    if (!project) return [];
    return [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: project.title,
        description: project.meta_description || project.summary,
        url: canonical,
        codeRepository: project.repo_url || undefined,
        programmingLanguage: project.tech,
        author: { "@type": "Person", name: site.profile.name },
        dateCreated: project.started_on || undefined,
        dateModified: project.updated_at,
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: site.profile.canonical_url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Projects",
            item: `${canonicalBase}/#projects`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: project.title,
            item: canonical,
          },
        ],
      },
    ];
  }, [project, canonical, canonicalBase, site.profile]);

  useSeo({
    title: project
      ? `${project.title} | ${site.profile.name}`
      : `Project | ${site.profile.name}`,
    description: project?.meta_description || project?.summary || site.seo.description,
    canonical,
    image: project?.cover_image ?? site.seo.og_image,
    jsonLd,
  });

  if (query.isLoading) return <DetailSkeleton />;

  if (query.isError || !project) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="shell flex min-h-[70vh] flex-col justify-center py-24">
        <p className="eyebrow">project</p>
        <h1 className="section-title mt-3">
          {notFound ? "That project isn't here." : "The project could not be loaded."}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-fog">
          {notFound
            ? "The project may have been renamed or unpublished."
            : "The portfolio API did not return the case study. Try again, or head back to the project list."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/#projects" className="btn-primary">
            <ArrowLeft size={15} aria-hidden="true" />
            All projects
          </Link>
          <button type="button" onClick={() => void query.refetch()} className="btn-ghost">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const others = site.projects
    .filter((item) => item.slug !== project.slug)
    .sort((a, b) => {
      const sameA = a.status === project.status ? 0 : 1;
      const sameB = b.status === project.status ? 0 : 1;
      return sameA - sameB || a.order - b.order;
    })
    .slice(0, 3);

  return (
    <article className="pt-24 pb-20">
      <div className="shell">
        <Link
          to="/#projects"
          className="inline-flex items-center gap-2 font-mono text-[11px] text-fog transition-colors hover:text-paper"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Back to projects
        </Link>

        <header className="mt-7 max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
            <ProjectStatusBadge status={project.status} label={project.status_label} />
            <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-fog">
              <CalendarDays size={12} aria-hidden="true" />
              {project.timeline}
            </span>
          </div>

          <h1 className="mt-4 text-[clamp(2.1rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
            {project.title}
          </h1>
          {project.subtitle && (
            <p className="mt-3 text-lg leading-7 text-fog">{project.subtitle}</p>
          )}
          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-fog">
            {project.summary}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {project.repo_url && (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost text-[13px]"
              >
                <GithubIcon size={15} />
                Repository
              </a>
            )}
            {project.demo_url && (
              <a
                href={project.demo_url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-[13px]"
              >
                <PlayCircle size={15} aria-hidden="true" />
                Live demo
              </a>
            )}
            <Link to="/#contact" className="btn-small">
              Discuss this project
              <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="mt-9 overflow-hidden rounded-2xl border border-line">
          {project.cover_image ? (
            <img
              src={project.cover_image}
              alt={`${project.title} cover`}
              className="aspect-[21/9] w-full object-cover"
            />
          ) : (
            <ProjectArtwork project={project} large className="aspect-[21/9]" />
          )}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-9">
            {project.description.length > 0 && (
              <section aria-labelledby="overview">
                <h2 id="overview" className="mono mb-3">
                  Overview
                </h2>
                <div className="prose-body max-w-3xl">
                  {project.description.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
                </div>
              </section>
            )}

            {project.highlights.length > 0 && (
              <section aria-labelledby="highlights">
                <h2 id="highlights" className="mono mb-3">
                  What it does
                </h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {project.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex gap-2.5 rounded-xl border border-line bg-panel/50 p-3.5 text-[13px] leading-6 text-fog"
                    >
                      <Check size={14} className="mt-1 shrink-0 text-mint" aria-hidden="true" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(project.architecture.length > 0 || project.architecture_image) && (
              <section aria-labelledby="architecture">
                <h2 id="architecture" className="mono mb-3">
                  Architecture
                </h2>
                <div className="prose-body max-w-3xl">
                  {project.architecture.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
                </div>
                {project.architecture_image && (
                  <img
                    src={project.architecture_image}
                    alt={`${project.title} architecture diagram`}
                    loading="lazy"
                    className="mt-4 w-full rounded-xl border border-line"
                  />
                )}
              </section>
            )}

            {project.screenshots.length > 0 && (
              <section aria-labelledby="screenshots">
                <h2 id="screenshots" className="mono mb-3">
                  Screenshots
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {project.screenshots.map((screenshot) => (
                    <figure
                      key={screenshot.id}
                      className="overflow-hidden rounded-xl border border-line bg-panel/50"
                    >
                      <img
                        src={screenshot.image}
                        alt={screenshot.caption || `${project.title} screenshot`}
                        loading="lazy"
                        className="w-full object-cover"
                      />
                      {screenshot.caption && (
                        <figcaption className="px-3 py-2 font-mono text-[10px] text-fog">
                          {screenshot.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {project.learnings && (
              <section
                aria-labelledby="learnings"
                className="rounded-2xl border border-violet/20 bg-violet/5 p-5"
              >
                <h2
                  id="learnings"
                  className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-violet uppercase"
                >
                  <Lightbulb size={14} aria-hidden="true" />
                  What I learned
                </h2>
                <p className="text-[13.5px] leading-7 text-fog">{project.learnings}</p>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="panel p-5">
              <p className="mono mb-4">Project facts</p>
              <dl className="space-y-3 text-[12px]">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-fog">Status</dt>
                  <dd className="text-right text-paper/90">{project.status_label}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-fog">Timeline</dt>
                  <dd className="text-right text-paper/90">{project.timeline}</dd>
                </div>
                {project.started_on && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-fog">Started</dt>
                    <dd className="text-right text-paper/90">
                      {formatDate(project.started_on)}
                    </dd>
                  </div>
                )}
                {project.completed_on && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-fog">Completed</dt>
                    <dd className="text-right text-paper/90">
                      {formatDate(project.completed_on)}
                    </dd>
                  </div>
                )}
                {project.status === "ongoing" && project.progress !== null && (
                  <div>
                    <div className="mb-1.5 flex justify-between">
                      <dt className="text-fog">Progress</dt>
                      <dd className="text-flame">{project.progress}%</dd>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-flame to-mint"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </dl>

              {project.tech.length > 0 && (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mono mb-2">Stack</p>
                  <TechChips tech={project.tech} />
                </div>
              )}

              <div className="mt-4 space-y-2 border-t border-line pt-4">
                {project.repo_url && (
                  <a
                    href={project.repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[12px] text-fog",
                      "transition-colors hover:border-fog/40 hover:text-paper",
                    )}
                  >
                    Source code
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                )}
                {project.demo_url && (
                  <a
                    href={project.demo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[12px] text-fog transition-colors hover:border-fog/40 hover:text-paper"
                  >
                    Live demo
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                )}
                <Link
                  to="/#contact"
                  className="flex items-center justify-between rounded-lg border border-flame/25 bg-flame/5 px-3 py-2 text-[12px] text-flame transition-colors hover:bg-flame/10"
                >
                  Talk about this project
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {others.length > 0 && (
          <section aria-labelledby="more-projects" className="mt-16 border-t border-line pt-10">
            <h2 id="more-projects" className="section-title text-2xl">
              More projects
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {others.map((item) => (
                <ProjectCard key={item.id} project={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
