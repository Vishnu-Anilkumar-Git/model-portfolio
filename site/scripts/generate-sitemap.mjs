/**
 * Build-time sitemap generator.
 *
 * The public site is static, so the sitemap cannot be rendered by Django at
 * request time. Fetch the same database-backed payload the site renders and
 * write `public/sitemap.xml`. In CI/production an unreachable API aborts the
 * build; only a local development build keeps an existing generated file.
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API_BASE, getJson, isStrictBuild } from "./content.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, "../public");
const sitemapPath = path.join(publicDir, "sitemap.xml");
const robotsPath = path.join(publicDir, "robots.txt");

const apiBase = API_BASE;

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

async function main() {
  const explicitOrigin = process.env.SITE_ORIGIN?.trim();
  let origin = (explicitOrigin || "https://vishnuanilkumar.in").replace(/\/$/, "");
  let projects = null;

  try {
    // Shared helper: waits for a sleeping API and logs "waiting for API to wake"
    // instead of failing on the first cold-start timeout.
    const data = await getJson("/site/");
    projects = Array.isArray(data.projects) ? data.projects : [];
    if (!explicitOrigin && data?.seo?.canonical) {
      origin = new URL(data.seo.canonical).origin;
    }
    console.log(`sitemap: ${projects.length} projects from ${apiBase}`);
  } catch (error) {
    if (isStrictBuild()) {
      throw new Error(
        `sitemap: API unreachable at ${apiBase} (${error.message}). ` +
          "Refusing to keep a stale sitemap in a CI/production build.",
      );
    }
    console.warn(
      `sitemap: could not reach ${apiBase} (${error.message}). ` +
        (existsSync(sitemapPath)
          ? "Keeping the existing sitemap (local development fallback)."
          : "Writing a homepage-only sitemap (local development fallback)."),
    );
  }

  if (projects === null && existsSync(sitemapPath)) {
    // Still refresh robots.txt below, but leave the richer sitemap intact.
  } else {
    const entries = [
      `  <url>\n    <loc>${escapeXml(`${origin}/`)}</loc>\n` +
        "    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>",
      ...(projects ?? []).map(
        (project) =>
          `  <url>\n    <loc>${escapeXml(`${origin}/projects/${project.slug}`)}</loc>\n` +
          "    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>",
      ),
    ];
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      `${entries.join("\n")}\n</urlset>\n`;

    writeFileSync(sitemapPath, xml, "utf8");
    console.log(`sitemap: wrote ${sitemapPath}`);
  }

  writeFileSync(
    robotsPath,
    `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /control/\n\nSitemap: ${origin}/sitemap.xml\n`,
    "utf8",
  );
}

try {
  await main();
} catch (error) {
  console.error(`sitemap generation failed: ${error.message}`);
  process.exit(1);
}
