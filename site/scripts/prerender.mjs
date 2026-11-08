/**
 * Pre-render every public route into dist/.
 *
 * The API is fetched once; each route is rendered with the production client
 * server bundle, then written as a real HTML file. The head (title, description,
 * canonical, social tags, JSON-LD) and the React Query seed are generated from
 * the same payload, so the first paint and hydration agree.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fetchPortfolio, resolveOrigin } from "./content.mjs";

const root = path.resolve(import.meta.dirname, "..");
const distDir = path.join(root, "dist");
const serverBundle = path.join(root, "dist-ssr", "entry-server.js");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const jsonForScript = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");

function replaceMeta(html, attribute, key, content) {
  const pattern = new RegExp(
    `<meta\\s+${attribute}="${key}"[^>]*>`,
    "i",
  );
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html;
}

function applyHead(html, { title, description, canonical, image, jsonLd, origin }) {
  let output = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`,
  );

  output = replaceMeta(output, "name", "description", description);
  output = replaceMeta(output, "property", "og:title", title);
  output = replaceMeta(output, "property", "og:description", description);
  output = replaceMeta(output, "property", "og:image", image);
  output = replaceMeta(output, "name", "twitter:title", title);
  output = replaceMeta(output, "name", "twitter:description", description);
  output = replaceMeta(output, "name", "twitter:image", image);

  output = output.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
  );

  const extras = [];
  const addMeta = (attribute, key, content) => {
    const pattern = new RegExp(`<meta\\s+${attribute}="${key}"[^>]*>`, "i");
    if (!pattern.test(output)) {
      extras.push(
        `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`,
      );
    }
  };

  addMeta("property", "og:url", canonical);
  addMeta("name", "twitter:card", "summary_large_image");
  addMeta("name", "twitter:title", title);
  addMeta("name", "twitter:description", description);
  addMeta("name", "twitter:image", image);

  extras.push(
    `<link rel="alternate" type="text/markdown" href="${escapeHtml(origin)}/llms.txt" title="LLM-readable portfolio summary" />`,
    `<script type="application/ld+json" id="seo-jsonld">${jsonForScript(jsonLd)}</script>`,
  );

  output = output.replace("</head>", `    ${extras.join("\n    ")}\n  </head>`);
  return output;
}

function applyBody(html, appHtml, data) {
  const rootPattern = /<div id="root">\s*<\/div>/i;
  if (!rootPattern.test(html)) {
    throw new Error('dist/index.html has no empty <div id="root"> to pre-render');
  }

  // A template is inert: the browser never treats the hydration payload as a
  // script, so it needs neither a CSP hash nor an inline-script exemption.
  return html.replace(
    rootPattern,
    () =>
      `<div id="root">${appHtml}</div>\n    <template id="__SITE_DATA__">${jsonForScript(data)}</template>`,
  );
}

/**
 * React's streaming renderer and Vite's preload helper both emit small inline
 * scripts. Hash exactly those blocks instead of allowing every inline script.
 */
function addCspHashes(html) {
  const hashes = new Set();
  const scripts = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scripts)) {
    const content = match[1];
    if (!content.trim()) continue;
    const digest = createHash("sha256").update(content).digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }

  if (hashes.size === 0) return html;

  // Vite serialises the meta content with escaped single quotes.
  const escapedMarker = "script-src &#39;self&#39;";
  const encode = (hash) => hash.replaceAll("'", "&#39;");
  if (html.includes(escapedMarker)) {
    return html.replace(
      escapedMarker,
      `${escapedMarker} ${[...hashes].map(encode).join(" ")}`,
    );
  }

  return html.replace(
    "script-src 'self'",
    `script-src 'self' ${[...hashes].join(" ")}`,
  );
}

function projectSeo(site, project, origin) {
  const base = `${origin}/projects/${project.slug}`;
  return {
    title: `${project.title} | ${site.profile.name}`,
    description: project.meta_description || project.summary,
    canonical: base,
    image: project.cover_image || site.seo.og_image,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: project.title,
        description: project.meta_description || project.summary,
        url: base,
        codeRepository: project.repo_url || undefined,
        programmingLanguage: project.tech,
        author: { "@type": "Person", name: site.profile.name },
        dateCreated: project.started_on || undefined,
        dateModified: project.updated_at,
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          {
            "@type": "ListItem",
            position: 2,
            name: "Projects",
            item: `${origin}/#projects`,
          },
          { "@type": "ListItem", position: 3, name: project.title, item: base },
        ],
      },
    ],
    origin,
  };
}

async function main() {
  const template = await readFile(path.join(distDir, "index.html"), "utf8");
  const { renderPage } = await import(pathToFileURL(serverBundle).href);
  const { site, projects } = await fetchPortfolio();
  const origin = resolveOrigin(site);

  const homeHtml = await renderPage({ url: "/", site });
  const homeHead = {
    title: site.seo.title,
    description: site.seo.description,
    canonical: site.seo.canonical,
    image: site.seo.og_image,
    jsonLd: site.seo.json_ld,
    origin,
  };
  const home = addCspHashes(
    applyBody(applyHead(template, homeHead), homeHtml, { site }),
  );
  await writeFile(path.join(distDir, "index.html"), home, "utf8");
  console.log("prerender: /");

  for (const project of projects) {
    const url = `/projects/${project.slug}`;
    const appHtml = await renderPage({ url, site, project });
    const page = addCspHashes(
      applyBody(
        applyHead(template, projectSeo(site, project, origin)),
        appHtml,
        { site, project },
      ),
    );
    const target = path.join(distDir, "projects", project.slug, "index.html");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, page, "utf8");
    console.log(`prerender: ${url}`);
  }

  console.log(`prerender: ${projects.length + 1} routes from ${origin}`);
}

main().catch((error) => {
  console.error(`prerender failed: ${error.message}`);
  console.error(
    "Build aborted; refusing to publish stale or partially rendered pages.",
  );
  process.exit(1);
});
