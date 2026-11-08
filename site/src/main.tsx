import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App, { createQueryClient, type QuerySeed } from "./App";
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

const app = (
  <StrictMode>
    <App queryClient={createQueryClient(seed)} />
  </StrictMode>
);

// Pre-rendered routes arrive with their markup already in place; hydrate so the
// first paint is never discarded. Client-only builds (dev) still mount normally.
if (container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
