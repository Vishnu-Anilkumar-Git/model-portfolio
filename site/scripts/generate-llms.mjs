/**
 * Build-time LLM-readable exports. Both files come from the deployed API, the
 * same source the site renders, so certifications and project statuses cannot
 * drift from the page.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchPortfolio, isStrictBuild, resolveOrigin } from "./content.mjs";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public");

const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

function projectUrl(origin, project) {
  return `${origin}/projects/${project.slug}`;
}

function main() {
  return fetchPortfolio().then(({ site, projects }) => {
    const origin = resolveOrigin(site);
    const { profile } = site;

    const lines = [
      `# ${profile.name}`,
      "",
      `> ${normalize(profile.headline)}`,
      "",
      `Canonical: ${origin}`,
      `Location: ${normalize(profile.location)}`,
      `Target role: ${normalize(profile.target_role)}`,
      `Contact: ${normalize(profile.email)}`,
      "",
      "## About",
      "",
      ...profile.bio.map((paragraph) => `${normalize(paragraph)}\n`),
      "## Projects",
      "",
      ...projects.map(
        (project) =>
          `- [${project.title}](${projectUrl(origin, project)}) — ${project.status_label}. ${normalize(project.summary)}`,
      ),
      "",
      "## Skills",
      "",
      ...site.skills.map(
        (category) =>
          `- ${category.name}: ${category.skills.map((skill) => skill.name).join(", ")}`,
      ),
      "",
      "## Certifications and training",
      "",
      ...site.certifications.map(
        (certification) =>
          `- ${certification.name} — ${certification.issuer} (${certification.status_label})`,
      ),
      "",
      "## Contact",
      "",
      `- Email: ${normalize(profile.email)}`,
      `- GitHub: ${normalize(profile.github_url)}`,
      `- LinkedIn: ${normalize(profile.linkedin_url)}`,
      "",
      "## Full content",
      "",
      `- [llms-full.txt](${origin}/llms-full.txt): complete project case studies, education, experience and FAQs.`,
      "",
    ];

    const full = [
      `# ${profile.name} — full portfolio`,
      "",
      `Source: ${origin}`,
      "",
      "## Profile",
      "",
      `- Headline: ${normalize(profile.headline)}`,
      `- Target role: ${normalize(profile.target_role)}`,
      `- Location: ${normalize(profile.location)}`,
      `- Availability: ${normalize(profile.availability)}`,
      `- Email: ${normalize(profile.email)}`,
      `- GitHub: ${normalize(profile.github_url)}`,
      `- LinkedIn: ${normalize(profile.linkedin_url)}`,
      "",
      ...profile.bio.map((paragraph) => `${normalize(paragraph)}\n`),
      "## Projects",
      "",
    ];

    for (const project of projects) {
      full.push(
        `### ${project.title}`,
        "",
        `Status: ${project.status_label}`,
        `Timeline: ${project.timeline}`,
        `URL: ${projectUrl(origin, project)}`,
        `Stack: ${project.tech.join(", ")}`,
        "",
        normalize(project.summary),
        "",
      );
      if (project.subtitle) full.push(normalize(project.subtitle), "");
      for (const paragraph of project.description ?? []) {
        full.push(`${normalize(paragraph)}\n`);
      }
      if (project.highlights?.length) {
        full.push("Highlights:");
        for (const highlight of project.highlights) full.push(`- ${normalize(highlight)}`);
        full.push("");
      }
      for (const paragraph of project.architecture ?? []) {
        full.push(`${normalize(paragraph)}\n`);
      }
      if (project.learnings) full.push(`What I learned: ${normalize(project.learnings)}\n`);
      if (project.repo_url) full.push(`Repository: ${project.repo_url}`);
      if (project.demo_url) full.push(`Live demo: ${project.demo_url}`);
      full.push("");
    }

    full.push("## Education", "");
    for (const entry of site.education) {
      full.push(
        `- ${entry.degree} — ${entry.institution} (${entry.period || "completed"})`,
      );
      if (entry.description) full.push(`  ${normalize(entry.description)}`);
    }

    if (site.experience.length) {
      full.push("", "## Experience", "");
      for (const entry of site.experience) {
        full.push(`- ${entry.role} — ${entry.organization} (${entry.period})`);
        if (entry.summary) full.push(`  ${normalize(entry.summary)}`);
      }
    }

    full.push("", "## Skills", "");
    for (const category of site.skills) {
      full.push(
        `- ${category.name}: ${category.skills.map((skill) => skill.name).join(", ")}`,
      );
    }

    full.push("", "## Certifications and training", "");
    for (const certification of site.certifications) {
      full.push(
        `- ${certification.name} — ${certification.issuer} (${certification.status_label})`,
      );
    }

    if (site.achievements.length) {
      full.push("", "## Labs and achievements", "");
      for (const achievement of site.achievements) {
        full.push(
          `- ${achievement.title} — ${achievement.organization} (${achievement.category_label})`,
        );
        if (achievement.description) full.push(`  ${normalize(achievement.description)}`);
      }
    }

    full.push("", "## FAQ", "");
    for (const faq of site.faqs) {
      full.push(`### ${normalize(faq.question)}`, "", normalize(faq.answer), "");
    }

    full.push("## Contact", "", `Email: ${normalize(profile.email)}`, "");

    return Promise.all([
      writeFile(path.join(publicDir, "llms.txt"), `${lines.join("\n")}\n`, "utf8"),
      writeFile(path.join(publicDir, "llms-full.txt"), `${full.join("\n")}\n`, "utf8"),
    ]);
  });
}

main()
  .then(() => console.log("llms: wrote public/llms.txt and public/llms-full.txt"))
  .catch((error) => {
    const mode = isStrictBuild() ? "CI/production build" : "local build";
    console.error(`llms generation failed during ${mode}: ${error.message}`);
    if (isStrictBuild()) {
      console.error("Refusing to publish stale or incomplete llms files.");
    }
    process.exitCode = 1;
  });
