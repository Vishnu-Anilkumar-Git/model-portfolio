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

/**
 * The API runs on a free host that sleeps when idle, so the first request of a
 * build can spend most of a minute waking it. Wait for it instead of failing the
 * deploy, but give up loudly if it never answers: a build must never publish
 * stale or empty pages. Worst case is roughly 8 x 12s plus the pauses.
 */
const WAKE_ATTEMPTS = 8;
const WAKE_TIMEOUT_MS = 12000;
const WAKE_PAUSE_MS = 1500;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

async function fetchJsonOnce(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const error = new Error(
      `GET ${API_BASE}${path} returned HTTP ${response.status}`,
    );
    // A 4xx means the API is awake and answered; waiting will not help.
    error.retryable =
      RETRYABLE_STATUS.has(response.status) || response.status >= 500;
    throw error;
  }

  return response.json();
}

export async function getJson(path, attempts = WAKE_ATTEMPTS) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJsonOnce(path);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const canRetry = error?.retryable !== false;

      if (!canRetry || attempt === attempts) break;

      console.warn(
        `waiting for API to wake — ${message}; retrying (attempt ${attempt + 1}/${attempts})`,
      );
      await new Promise((resolve) => setTimeout(resolve, WAKE_PAUSE_MS));
    }
  }

  throw new Error(
    `API request failed: ${API_BASE}${path} (${
      lastError instanceof Error ? lastError.message : String(lastError)
    }). The API never became reachable; refusing to publish stale content.`,
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
