import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Download, MapPin, Terminal } from "lucide-react";
import type { Profile, SocialLink } from "@/types";
import { SocialIcon, socialIsExternal } from "@/components/layout/SocialIcon";
import { HeroBackground } from "./HeroBackground";
import { ScrambleText } from "@/components/ui/ScrambleText";

function TerminalCard({ profile }: { profile: Profile }) {
  const lines: Array<[string, string, string?]> = [
    ["whoami", profile.name],
    ["focus", profile.headline],
    ["status", profile.availability || "Open to opportunities", "mint"],
    ["contact", profile.email],
  ];

  return (
    <div className="panel scanline relative overflow-hidden border-line/90 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-[#FF6B5E]" />
          <span className="h-2 w-2 rounded-full bg-[#FFC15E]" />
          <span className="h-2 w-2 rounded-full bg-[#3ED6B5]" />
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-fog uppercase">
          <Terminal size={12} aria-hidden="true" />
          vishnu@portfolio: ~
        </div>
      </div>

      <div className="space-y-2.5 p-4 font-mono text-[11.5px] leading-5 sm:p-5">
        {lines.map(([command, value, tone]) => (
          <div key={command} className="flex flex-wrap gap-x-2">
            <span className="text-flame">$</span>
            <span className="text-fog">{command}</span>
            <span className="text-line">/</span>
            <span className={tone === "mint" ? "text-mint" : "text-paper/90"}>
              {tone === "mint" && (
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-mint align-middle" />
              )}
              {value}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 text-paper">
          <span className="text-flame">$</span>
          <span className="h-3.5 w-1.5 animate-blink bg-mint" aria-hidden="true" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 font-mono text-[10px] text-fog/70">
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={11} aria-hidden="true" />
          {profile.location}
        </span>
        <span>grounded · no hallucinations</span>
      </div>
    </div>
  );
}

export function Hero({
  profile,
  socials,
}: {
  profile: Profile;
  socials: SocialLink[];
}) {
  const [firstName, ...restName] = profile.name.trim().split(/\s+/);
  const lastName = restName.join(" ") || firstName;

  return (
    <section className="relative overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-20">
      <HeroBackground />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent"
        aria-hidden="true"
      />

      <div className="shell relative grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div>
          <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-line bg-panel/60 px-3 py-1.5 font-mono text-[10.5px] tracking-[0.1em] text-fog">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" aria-hidden="true" />
            {profile.hero_eyebrow}
            <span className="animate-blink text-flame" aria-hidden="true">_</span>
          </div>

          <h1
            aria-label={profile.name}
            className="text-[clamp(3.4rem,9.5vw,7.2rem)] leading-[0.88] font-semibold tracking-[-0.05em]"
          >
            {firstName}
            <br />
            <span className="text-flame">
              <ScrambleText text={lastName} />
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-[15px] leading-7 text-fog sm:text-base">
            {profile.headline}
          </p>

          {profile.availability && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/5 px-3 py-1.5 font-mono text-[10.5px] tracking-[0.04em] text-mint">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" aria-hidden="true" />
              {profile.availability}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/#projects" className="btn-primary">
              View projects
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            {profile.resume_url ? (
              <a
                href={profile.resume_url}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                <Download size={15} aria-hidden="true" />
                Download CV
              </a>
            ) : (
              <Link to="/#contact" className="btn-ghost">
                Get in touch
              </Link>
            )}
          </div>

          <ul className="mt-8 flex items-center gap-4" aria-label="Social links">
            {socials.map((social) => (
              <li key={social.id}>
                <a
                  href={social.url}
                  target={socialIsExternal(social.url) ? "_blank" : undefined}
                  rel={socialIsExternal(social.url) ? "noreferrer" : undefined}
                  aria-label={social.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-fog transition-colors hover:border-flame/40 hover:text-flame"
                >
                  <SocialIcon icon={social.icon} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div
            className="absolute -inset-6 rounded-[2rem] bg-mint/5 blur-2xl"
            aria-hidden="true"
          />
          <TerminalCard profile={profile} />
        </div>
      </div>

      <div className="shell relative mt-14 hidden items-center gap-3 sm:flex" aria-hidden="true">
        <span className="h-px w-12 bg-line" />
        <span className="font-mono text-[9.5px] tracking-[0.3em] text-fog/60 uppercase">
          scroll to explore
        </span>
        <ArrowDown size={12} className="text-fog/60" />
      </div>
    </section>
  );
}
