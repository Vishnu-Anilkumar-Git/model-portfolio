import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Home } from "@/pages/Home";
import { ProjectPage } from "@/pages/ProjectPage";
import { NotFound } from "@/pages/NotFound";
import type { ProjectDetail, SitePayload } from "@/types";

interface SeedProject {
  slug: string;
  data: ProjectDetail;
}

export interface QuerySeed {
  site?: SitePayload;
  project?: SeedProject;
}

export function createQueryClient(seed?: QuerySeed): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  if (seed?.site) client.setQueryData(["site"], seed.site);
  if (seed?.project) {
    client.setQueryData(["project", seed.project.slug], seed.project.data);
  }

  return client;
}

function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const timer = window.setTimeout(() => {
      document
        .getElementById(decodeURIComponent(hash.slice(1)))
        ?.scrollIntoView({ block: "start" });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [pathname, hash]);

  return null;
}

/** Router-agnostic tree, shared by the browser entry and the build-time renderer. */
export function AppContent() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="projects/:slug" element={<ProjectPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App({ queryClient }: { queryClient?: QueryClient } = {}) {
  const [client] = useState(() => queryClient ?? createQueryClient());

  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
