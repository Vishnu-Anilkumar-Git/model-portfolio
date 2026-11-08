import { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BadgeCheck,
  Bot,
  Briefcase,
  ExternalLink,
  FolderKanban,
  Gauge,
  GraduationCap,
  HelpCircle,
  Image,
  Inbox,
  Layers,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Settings,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/components/ui";

const groups = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: Gauge, end: true }],
  },
  {
    label: "Content",
    items: [
      { to: "/projects", label: "Projects", icon: FolderKanban },
      { to: "/screenshots", label: "Screenshots", icon: Image },
      { to: "/skills", label: "Skills", icon: Sparkles },
      { to: "/skill-categories", label: "Skill categories", icon: Layers },
      { to: "/education", label: "Education", icon: GraduationCap },
      { to: "/experience", label: "Experience", icon: Briefcase },
      { to: "/certifications", label: "Certifications", icon: BadgeCheck },
      { to: "/achievements", label: "Achievements", icon: Award },
    ],
  },
  {
    label: "Assistant & site",
    items: [
      { to: "/faqs", label: "FAQs", icon: HelpCircle },
      { to: "/socials", label: "Social links", icon: Share2 },
      { to: "/suggestions", label: "Chatbot prompts", icon: Bot },
      { to: "/profile", label: "Profile & SEO", icon: Settings },
    ],
  },
  {
    label: "Inbox",
    items: [
      { to: "/messages", label: "Messages", icon: Mail },
      { to: "/chat-logs", label: "Chat logs", icon: MessageSquare },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const unreadQuery = useQuery({
    queryKey: ["unread-messages"],
    queryFn: () => api.list("/admin/messages/", { unread: "true", page_size: 1 }),
    refetchInterval: 60_000,
  });
  const unread = unreadQuery.data?.count ?? 0;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-mint/30 bg-mint/10 font-mono text-sm font-semibold text-mint">
          V
        </span>
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-fog uppercase">
            control room
          </p>
          <p className="text-sm font-medium text-paper">Portfolio admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Admin sections">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 font-mono text-[9.5px] tracking-[0.18em] text-fog/60 uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={"end" in item ? item.end : false}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                        isActive
                          ? "bg-panel-2 text-paper shadow-[inset_2px_0_0_var(--color-mint)]"
                          : "text-fog hover:bg-panel-2/60 hover:text-paper",
                      )
                    }
                  >
                    <item.icon size={15} aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {item.to === "/messages" && unread > 0 && (
                      <span className="rounded-full bg-flame px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-[#160b04]">
                        {unread}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <a
          href={import.meta.env.VITE_SITE_URL ?? "http://localhost:5173"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-fog transition-colors hover:bg-panel-2/60 hover:text-paper"
        >
          <ExternalLink size={14} aria-hidden="true" />
          View public site
        </a>
        <div className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-panel-2/40 px-2.5 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] text-paper">{user?.username}</p>
            <p className="truncate font-mono text-[9.5px] tracking-wide text-fog uppercase">
              {user?.is_superuser ? "superuser" : "staff"}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-panel/50 lg:block">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-ink/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={16} aria-hidden="true" />
          </button>
          <Link to="/" className="font-mono text-[10.5px] tracking-[0.18em] text-fog uppercase">
            portfolio / admin
          </Link>
          <span className="w-8" />
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              className="relative h-full w-64 border-r border-line bg-panel"
            >
              <button
                type="button"
                className="icon-btn absolute top-4 right-3"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
              >
                <X size={15} aria-hidden="true" />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        <main
          id="admin-main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>

        <footer className="border-t border-line px-4 py-3 text-center font-mono text-[9.5px] tracking-[0.16em] text-fog/50 uppercase">
          <Inbox size={10} className="mr-1 inline" aria-hidden="true" />
          JWT session · content writes hit the live API
        </footer>
      </div>
    </div>
  );
}
