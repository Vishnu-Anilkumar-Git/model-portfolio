/**
 * Build-time content source. All generators read the same public API payload so
 * the sitemap, llms files and pre-rendered HTML can never disagree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Vite reads .env.local for the browser bundle; the Node generators must use the
// same API origin or a local build would prerender against the wrong host.
const envFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.env.local",
);
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const API_BASE = (
  process.env.SITEMAP_API_URL ??
  process.env.VITE_API_URL ??
  "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

/**
 * CI and production builds must never publish stale content. The sitemap keeps
 * its historical fallback only for a local development build.
 */
export function isStrictBuild() {
  const ci = (process.env.CI ?? "").toLowerCase();
  return (
    ci === "true" ||
    ci === "1" ||
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.NETLIFY) ||
    Boolean(process.env.CF_PAGES) ||
    Boolean(process.env.VERCEL)
  );
}

async function getJson(path, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`GET ${API_BASE}${path} returned HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  throw new Error(
    `API request failed: ${API_BASE}${path} (${
      lastError instanceof Error ? lastError.message : String(lastError)
    })`,
  );
}

export async function fetchPortfolio() {
  const site = await getJson("/site/");
  const projects = [];

  // The dev server is happiest with sequential requests; 13 routes is cheap and
  // avoids transient connection resets during a build.
  for (const summary of Array.isArray(site.projects) ? site.projects : []) {
    projects.push(await getJson(`/projects/${encodeURIComponent(summary.slug)}/`));
  }

  return { site, projects };
}

export function resolveOrigin(site) {
  const explicit = process.env.SITE_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const canonical = site?.seo?.canonical;
  if (canonical) {
    try {
      return new URL(canonical).origin;
    } catch {
      // Fall through to the production origin.
    }
  }

  return "https://vishnuanilkumar.in";
}
