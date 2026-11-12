import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Circle,
  FolderKanban,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { Badge, EmptyState, PageHeader, Spinner, useToast } from "@/components/ui";

interface DashboardData {
  counts: {
    projects: number;
    projects_completed: number;
    projects_ongoing: number;
    projects_upcoming: number;
    skills: number;
    certifications: number;
    achievements: number;
    faqs: number;
    unread_messages: number;
    chats_7d: number;
  };
  completeness: Array<{ key: string; label: string; done: boolean; hint: string }>;
  recent_messages: Array<{
    id: number;
    name: string;
    email: string;
    subject: string;
    message: string;
    created_at: string;
    is_read: boolean;
  }>;
  recent_chats: Array<{
    id: number;
    question: string;
    answer: string;
    provider: string;
    latency_ms: number;
    flagged: boolean;
    created_at: string;
  }>;
  recent_questions: Array<{ question: string; created_at: string }>;
  rebuild: {
    configured: boolean;
    last_requested_at: string | null;
  };
}

interface PublishResponse {
  requested: boolean;
  configured: boolean;
  reason: "requested" | "debounced" | "queued" | "suppressed" | "unset" | "error";
  last_requested_at: string | null;
  message: string;
}

function timeAgo(value: string) {
  const date = new Date(value);
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/admin/dashboard/"),
    refetchInterval: 120_000,
  });
  const publish = useMutation({
    mutationFn: () => api.post<PublishResponse>("/admin/publish/"),
    onSuccess: (result) => {
      const tone =
        result.reason === "requested" ||
        result.reason === "debounced" ||
        result.reason === "queued"
          ? "success"
          : "error";
      push(result.message, tone);
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => push(errorMessage(error), "error"),
  });

  if (query.isLoading) {
    return (
      <div className="grid place-items-center py-32">
        <Spinner className="h-6 w-6 text-mint" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Dashboard unavailable"
        description={errorMessage(query.error)}
        action={
          <button type="button" className="btn-ghost" onClick={() => void query.refetch()}>
            Retry
          </button>
        }
      />
    );
  }

  const data = query.data;
  const done = data.completeness.filter((item) => item.done).length;
  const percent = Math.round((done / Math.max(1, data.completeness.length)) * 100);

  const cards = [
    {
      label: "Projects",
      value: data.counts.projects,
      detail: `${data.counts.projects_completed} shipped · ${data.counts.projects_ongoing} active`,
      icon: FolderKanban,
      to: "/projects",
    },
    {
      label: "Certifications",
      value: data.counts.certifications,
      detail: `${data.counts.skills} skills published`,
      icon: BadgeCheck,
      to: "/certifications",
    },
    {
      label: "Unread messages",
      value: data.counts.unread_messages,
      detail: "From the contact form",
      icon: Mail,
      to: "/messages",
    },
    {
      label: "Chats · 7 days",
      value: data.counts.chats_7d,
      detail: "Assistant conversations",
      icon: MessageSquare,
      to: "/chat-logs",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Content control room"
        description="Everything the public site and the assistant know about Vishnu, editable from one place."
        actions={
          <>
            <Link to="/projects" className="btn-ghost">
              <Plus size={14} aria-hidden="true" />
              New project
            </Link>
            <Link to="/profile" className="btn-primary">
              Edit profile
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} to={card.to} className="card group p-4 transition-colors hover:border-fog/30">
            <div className="flex items-start justify-between">
              <card.icon size={16} className="text-fog/70" aria-hidden="true" />
              <ArrowUpRight
                size={14}
                className="text-fog/30 transition-colors group-hover:text-mint"
                aria-hidden="true"
              />
            </div>
            <p className="mt-3 font-mono text-3xl font-semibold text-paper">{card.value}</p>
            <p className="mt-0.5 text-[12.5px] text-paper/80">{card.label}</p>
            <p className="mt-1 text-[11px] text-fog/70">{card.detail}</p>
          </Link>
        ))}
      </div>

      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-sm font-medium text-paper">Publish site</h2>
            <p className="mt-0.5 text-[11.5px] text-fog">
              Rebuild the static site from the current database content.
            </p>
            <p className="mt-2 font-mono text-[10.5px] tracking-wide text-fog/70 uppercase">
              {data.rebuild.last_requested_at ? (
                <span title={timeAgo(data.rebuild.last_requested_at)}>
                  Last rebuild requested at{" "}
                  {new Date(data.rebuild.last_requested_at).toLocaleString()}
                </span>
              ) : (
                "No rebuild requested yet"
              )}
            </p>
            <p className="mt-1 text-[11.5px] text-fog/70">
              Changes appear on the public site 1-2 minutes after a rebuild
              starts. Automatic rebuilds are debounced for 60 seconds; this
              button requests one immediately.
            </p>
            {!data.rebuild.configured && (
              <p className="mt-2 text-[11.5px] text-flame">
                Set SITE_REBUILD_HOOK_URL on the API to enable publishing.
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => publish.mutate()}
            disabled={!data.rebuild.configured || publish.isPending}
            title={
              data.rebuild.configured
                ? "Request a static-site rebuild"
                : "Set SITE_REBUILD_HOOK_URL on the API first"
            }
          >
            {publish.isPending ? <Spinner /> : <RefreshCw size={14} aria-hidden="true" />}
            Publish site
          </button>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-paper">Launch readiness</h2>
              <p className="mt-0.5 text-[11.5px] text-fog">
                Assets and sections that make the portfolio recruiter-ready.
              </p>
            </div>
            <span className="font-mono text-lg font-semibold text-mint">{percent}%</span>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full bg-mint transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          <ul className="mt-4 space-y-2.5">
            {data.completeness.map((item) => (
              <li key={item.key} className="flex items-start gap-2.5">
                {item.done ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />
                ) : (
                  <Circle size={15} className="mt-0.5 shrink-0 text-fog/40" aria-hidden="true" />
                )}
                <div>
                  <p className={item.done ? "text-[13px] text-fog line-through" : "text-[13px] text-paper"}>
                    {item.label}
                  </p>
                  {!item.done && <p className="text-[11px] text-fog/60">{item.hint}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-paper">Recent messages</h2>
            <Link to="/messages" className="font-mono text-[10px] tracking-[0.1em] text-mint uppercase hover:underline">
              Inbox
            </Link>
          </div>

          {data.recent_messages.length === 0 ? (
            <p className="mt-6 text-[13px] text-fog">No messages yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line/70">
              {data.recent_messages.map((message) => (
                <li key={message.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] text-paper">
                      {message.name}
                      {!message.is_read && (
                        <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-flame align-middle" />
                      )}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] text-fog/60">
                      {timeAgo(message.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11.5px] text-fog">
                    {message.subject || message.message}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-5 text-sm font-medium text-paper">What visitors ask</h2>
          {data.recent_questions.length === 0 ? (
            <p className="mt-2 text-[13px] text-fog">No assistant conversations yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {data.recent_questions.slice(0, 4).map((item, index) => (
                <li key={`${item.created_at}-${index}`} className="flex gap-2 text-[12px] text-fog">
                  <Sparkles size={11} className="mt-1 shrink-0 text-flame/70" aria-hidden="true" />
                  <span className="line-clamp-1">{item.question}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-paper">Latest assistant activity</h2>
            <p className="mt-0.5 text-[11.5px] text-fog">
              Every answer is grounded in the content above. Flagged items hit the injection guard.
            </p>
          </div>
          <Link to="/chat-logs" className="btn-ghost">
            Open logs
          </Link>
        </div>

        {data.recent_chats.length === 0 ? (
          <p className="mt-4 text-[13px] text-fog">Nothing logged yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/70">
            {data.recent_chats.map((log) => (
              <li key={log.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-paper">{log.question}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] text-fog">{log.answer}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {log.flagged && <Badge tone="danger">flagged</Badge>}
                  <Badge>{log.provider || "llm"}</Badge>
                  <span className="font-mono text-[10px] text-fog/60">{log.latency_ms}ms</span>
                  <span className="font-mono text-[10px] text-fog/60">{timeAgo(log.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
