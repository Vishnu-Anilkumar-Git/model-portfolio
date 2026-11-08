import { createContext, useContext, useState } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchSite } from "@/lib/api";
import type { SitePayload } from "@/types";
import { BootScreen } from "@/components/ui/BootScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { DeferredChat } from "@/components/chat/DeferredChat";
import { Footer } from "./Footer";
import { Nav } from "./Nav";

const SiteContext = createContext<SitePayload | null>(null);

export function useSite(): SitePayload {
  const site = useContext(SiteContext);
  if (!site) throw new Error("useSite must be used inside SiteLayout");
  return site;
}

export function SiteLayout() {
  const [bootDismissed, setBootDismissed] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["site"],
    queryFn: fetchSite,
    staleTime: 5 * 60 * 1000,
  });

  // On a pre-rendered route the cache is already seeded, so the hero is painted
  // immediately and this branch is never entered. It exists for API failures and
  // for client-side boots, and can always be skipped.
  if (isLoading && !bootDismissed) {
    return <BootScreen onSkip={() => setBootDismissed(true)} />;
  }

  if (!data) {
    return (
      <>
        <Nav />
        <main id="main-content">
          <ErrorState
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => void refetch()}
          />
        </main>
      </>
    );
  }

  return (
    <SiteContext.Provider value={data}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
      >
        Skip to main content
      </a>
      <Nav />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer profile={data.profile} socials={data.socials} />
      <DeferredChat />
    </SiteContext.Provider>
  );
}
