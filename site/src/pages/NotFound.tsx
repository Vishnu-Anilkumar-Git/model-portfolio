import { Link } from "react-router-dom";
import { ArrowLeft, Terminal } from "lucide-react";
import { useSite } from "@/components/layout/SiteLayout";
import { useSeo } from "@/lib/seo";

export function NotFound() {
  const site = useSite();

  useSeo({
    title: `404 | ${site.profile.name}`,
    description: "That page does not exist.",
    canonical: site.profile.canonical_url,
  });

  return (
    <div className="shell flex min-h-[75vh] flex-col justify-center py-24">
      <div className="max-w-xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 font-mono text-[10.5px] text-fog">
          <Terminal size={12} className="text-flame" aria-hidden="true" />
          HTTP 404
        </div>
        <h1 className="text-[clamp(3rem,10vw,6rem)] leading-none font-semibold tracking-[-0.05em]">
          Not <span className="text-flame">found</span>
        </h1>
        <p className="mt-4 text-sm leading-6 text-fog">
          This route does not exist. The portfolio is still one page away.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link to="/" className="btn-primary">
            <ArrowLeft size={15} aria-hidden="true" />
            Back home
          </Link>
          <Link to="/#projects" className="btn-ghost">
            Browse projects
          </Link>
        </div>
      </div>
    </div>
  );
}
