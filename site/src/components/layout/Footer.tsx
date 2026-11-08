import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { Profile, SocialLink } from "@/types";
import { SocialIcon, socialIsExternal } from "./SocialIcon";

export function Footer({
  profile,
  socials,
}: {
  profile: Profile;
  socials: SocialLink[];
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-panel/30 py-12">
      <div className="shell">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 font-mono text-[13px] font-semibold tracking-[0.14em]"
            >
              <span className="h-2 w-2 rounded-full bg-mint" aria-hidden="true" />
              VISHNU<span className="text-flame">.SEC</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-fog">
              {profile.headline}
            </p>
            <p className="mt-3 font-mono text-[11px] text-fog/70">
              {profile.location}
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="mono mb-3">Sections</p>
            <ul className="space-y-2 text-sm text-fog">
              {[
                ["About", "/#about"],
                ["Projects", "/#projects"],
                ["Journey", "/#journey"],
                ["Certifications", "/#certifications"],
                ["Contact", "/#contact"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link to={href} className="transition-colors hover:text-paper">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="mono mb-3">Elsewhere</p>
            <ul className="space-y-2 text-sm text-fog">
              {socials.map((social) => (
                <li key={social.id}>
                  <a
                    href={social.url}
                    target={socialIsExternal(social.url) ? "_blank" : undefined}
                    rel={socialIsExternal(social.url) ? "noreferrer" : undefined}
                    className="inline-flex items-center gap-2 transition-colors hover:text-paper"
                  >
                    <SocialIcon icon={social.icon} size={14} />
                    {social.label}
                    {socialIsExternal(social.url) && (
                      <ArrowUpRight size={12} aria-hidden="true" />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-[11px] text-fog/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {profile.name}. {profile.footer_note}
          </p>
          <p className="font-mono">
            Django REST · React · Tailwind ·{" "}
            <span className="text-mint/80">grounded AI assistant</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
