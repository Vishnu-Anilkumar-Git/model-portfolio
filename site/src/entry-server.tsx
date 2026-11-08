import { Writable } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppContent, createQueryClient } from "./App";
import type { ProjectDetail, SitePayload } from "./types";

export interface RenderInput {
  url: string;
  site: SitePayload;
  project?: ProjectDetail | null;
}

/**
 * Render one route with the same component tree the browser hydrates. Lazy
 * sections are awaited by the streaming renderer, so the emitted HTML contains
 * the full page even though the client loads those sections as separate chunks.
 */
export function renderPage({ url, site, project }: RenderInput): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = createQueryClient({
      site,
      project: project ? { slug: project.slug, data: project } : undefined,
    });

    let html = "";
    const output = new Writable({
      write(chunk, _encoding, callback) {
        html += chunk.toString();
        callback();
      },
    });

    output.on("finish", () => resolve(html));

    const { pipe } = renderToPipeableStream(
      <MemoryRouter initialEntries={[url]}>
        <QueryClientProvider client={client}>
          <AppContent />
        </QueryClientProvider>
      </MemoryRouter>,
      {
        onAllReady() {
          pipe(output);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          // Recoverable render errors are handled by the app's error states.
          console.error("[prerender]", error);
        },
      },
    );
  });
}
