import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSite } from "@/components/layout/SiteLayout";
import { useSeo } from "@/lib/seo";
import { Hero } from "@/components/sections/Hero";
import { HomeBelowFold } from "./HomeBelowFold";

export function Home() {
  const site = useSite();
  const location = useLocation();

  useSeo({
    title: site.seo.title,
    description: site.seo.description,
    canonical: site.seo.canonical,
    image: site.seo.og_image,
    jsonLd: site.seo.json_ld,
  });

  useEffect(() => {
    if (!location.hash) return;
    const target = decodeURIComponent(location.hash.slice(1));
    const timer = window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ block: "start" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.hash]);

  return (
    <>
      <Hero profile={site.profile} socials={site.socials} />
      <HomeBelowFold site={site} />
    </>
  );
}
