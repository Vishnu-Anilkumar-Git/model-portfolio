import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import type { QueryClient } from "@tanstack/react-query";
import App, { createQueryClient, type QuerySeed } from "./App";
import { API_BASE } from "@/lib/api";
import "./index.css";
import type { ProjectDetail, SitePayload } from "./types";

interface EmbeddedData {
  site?: SitePayload;
  project?: ProjectDetail | null;
}

function readEmbeddedData(): EmbeddedData {
  const element = document.getElementById("__SITE_DATA__");
  const text =
    element instanceof HTMLTemplateElement
      ? element.content.textContent
      : element?.textContent;
  if (!text) return {};
  try {
    return JSON.parse(text) as EmbeddedData;
  } catch {
    return {};
  }
}

/** Site content without the per-request `meta` block, for comparison. */
function contentOnly(payload: SitePayload): string {
  return JSON.stringify({ ...payload, meta: undefined });
}

/**
 * A pre-rendered page can be one deploy old. After hydration, ask the API once
 * and swap the content in only if it changed. Crawlers still receive the
 * build-time HTML, and a slow or unreachable API keeps the build-time data.
 */
async function refreshFromApi(client: QueryClient, buildTime: SitePayload) {
  try {
    const response = await fetch(`${API_BASE}/site/`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return;

    const fresh = (await response.json()) as SitePayload;
    if (contentOnly(fresh) === contentOnly(buildTime)) return;
    client.setQueryData(["site"], fresh);
  } catch {
    // Offline or a sleeping API: the pre-rendered content is still correct.
  }
}

const embedded = readEmbeddedData();
const seed: QuerySeed | undefined = embedded.site
  ? {
      site: embedded.site,
      project: embedded.project
        ? { slug: embedded.project.slug, data: embedded.project }
        : undefined,
    }
  : undefined;

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const queryClient = createQueryClient(seed);

const app = (
  <StrictMode>
    <App queryClient={queryClient} />
  </StrictMode>
);

// Pre-rendered routes arrive with their markup already in place; hydrate so the
// first paint is never discarded. Client-only builds (dev) still mount normally.
if (container.hasChildNodes()) {
  hydrateRoot(container, app);
  if (embedded.site) void refreshFromApi(queryClient, embedded.site);
} else {
  createRoot(container).render(app);
}
