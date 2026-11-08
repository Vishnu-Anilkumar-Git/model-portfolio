import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/format";

const NAV_ITEMS = [
  { id: "about", label: "About" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "journey", label: "Journey" },
  { id: "certifications", label: "Certs" },
  { id: "faq", label: "FAQ" },
];

export function Nav() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    let queued = false;

    const onScroll = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        queued = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (element): element is HTMLElement => element !== null,
    );
    if (!sections.length || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled || open
          ? "border-b border-line/80 bg-ink/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="shell flex h-16 items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-mono text-[13px] font-semibold tracking-[0.14em] text-paper"
        >
          <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_12px_rgba(62,214,181,0.8)]" />
          VISHNU<span className="text-flame">.SEC</span>
          <span className="sr-only">— Vishnu Anilkumar, home</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 lg:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.id}
              to={`/#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "font-mono text-[11px] tracking-[0.1em] transition-colors",
                active === item.id ? "text-flame" : "text-fog hover:text-paper",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/#contact" className="btn-primary hidden px-4 py-2 text-[13px] sm:inline-flex">
            Get in touch
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="rounded-lg border border-line p-2 text-fog transition-colors hover:text-paper lg:hidden"
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="border-t border-line bg-ink/95 px-5 pt-2 pb-5 lg:hidden"
        >
          <ul className="flex flex-col">
            {[...NAV_ITEMS, { id: "contact", label: "Contact" }].map((item) => (
              <li key={item.id}>
                <Link
                  to={`/#${item.id}`}
                  className="block border-b border-line/60 py-3 font-mono text-[12px] tracking-[0.1em] text-fog"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
