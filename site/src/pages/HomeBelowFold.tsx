import type { SitePayload } from "@/types";
import { About } from "@/components/sections/About";
import { Skills } from "@/components/sections/Skills";
import { Projects } from "@/components/sections/Projects";
import { Journey } from "@/components/sections/Journey";
import { Certifications } from "@/components/sections/Certifications";
import { Achievements } from "@/components/sections/Achievements";
import { FAQ } from "@/components/sections/FAQ";
import { Contact } from "@/components/sections/Contact";

export function HomeBelowFold({ site }: { site: SitePayload }) {
  return (
    <>
      <About profile={site.profile} stats={site.stats} />
      <Skills categories={site.skills} />
      <Projects projects={site.projects} />
      <Journey
        education={site.education}
        experience={site.experience}
        profile={site.profile}
      />
      <Certifications certifications={site.certifications} />
      <Achievements achievements={site.achievements} />
      <FAQ faqs={site.faqs} />
      <Contact profile={site.profile} socials={site.socials} />
    </>
  );
}
