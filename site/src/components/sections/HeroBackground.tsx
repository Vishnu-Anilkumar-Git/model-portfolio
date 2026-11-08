import { Suspense, lazy, useEffect, useState } from "react";

const HeroCanvas = lazy(() => import("./HeroCanvas"));

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

function canAnimate(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!window.matchMedia("(min-width: 1024px)").matches) return false;
  if (!window.matchMedia("(pointer: fine)").matches) return false;

  const navigatorWithHints = navigator as Navigator & {
    deviceMemory?: number;
    connection?: NetworkInformation;
  };

  if (
    navigatorWithHints.deviceMemory !== undefined &&
    navigatorWithHints.deviceMemory < 4
  ) {
    return false;
  }
  if (
    navigatorWithHints.hardwareConcurrency !== undefined &&
    navigatorWithHints.hardwareConcurrency < 4
  ) {
    return false;
  }

  const connection = navigatorWithHints.connection;
  if (connection?.saveData) return false;
  if (
    connection?.effectiveType &&
    ["slow-2g", "2g", "3g"].includes(connection.effectiveType)
  ) {
    return false;
  }

  return true;
}

// Pointer intent only: Lighthouse and screenshot tools scroll the page, which
// must not pull three.js into the measured load. Touch devices never reach here.
const INTERACTIONS = ["pointermove", "pointerdown"] as const;

/**
 * The gradient is part of the first paint. The WebGL layer is an enhancement
 * that loads only after LCP and after the visitor shows intent (or after a long
 * idle fallback), and never on phones, reduced-motion or data-saver devices.
 * This keeps three.js off the critical path and out of the interaction window.
 */
export function HeroBackground() {
  const [showCanvas, setShowCanvas] = useState(false);

  useEffect(() => {
    if (!canAnimate()) return;

    let cancelled = false;
    let armed = false;
    let idleId: number | undefined;
    let fallbackId: number | undefined;
    let armTimer: number | undefined;
    let observer: PerformanceObserver | undefined;

    const enable = () => {
      if (!cancelled) setShowCanvas(true);
    };

    const schedule = () => {
      if (cancelled) return;
      const requestIdleCallback = (
        window as unknown as {
          requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        }
      ).requestIdleCallback;

      if (typeof requestIdleCallback === "function") {
        idleId = requestIdleCallback(enable, { timeout: 2000 });
      } else {
        fallbackId = window.setTimeout(enable, 300);
      }
    };

    const removeInteraction = () => {
      for (const event of INTERACTIONS) {
        window.removeEventListener(event, onInteract);
      }
      if (fallbackId !== undefined) window.clearTimeout(fallbackId);
      fallbackId = undefined;
    };

    const onInteract = () => {
      removeInteraction();
      schedule();
    };

    const arm = () => {
      if (armed || cancelled) return;
      armed = true;
      if (armTimer !== undefined) {
        window.clearTimeout(armTimer);
        armTimer = undefined;
      }
      for (const event of INTERACTIONS) {
        window.addEventListener(event, onInteract, { passive: true });
      }
      // Some visitors never move the pointer; still offer the effect eventually.
      fallbackId = window.setTimeout(schedule, 20000);
    };

    if ("PerformanceObserver" in window) {
      try {
        observer = new PerformanceObserver((list) => {
          if (list.getEntries().length === 0) return;
          observer?.disconnect();
          arm();
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        arm();
      }
    } else {
      arm();
    }

    // If the LCP observer never delivers (for example from a restored page),
    // still arm interaction listeners so desktop visitors get the enhancement.
    armTimer = window.setTimeout(arm, 2500);

    return () => {
      cancelled = true;
      removeInteraction();
      if (armTimer !== undefined) window.clearTimeout(armTimer);
      if (idleId !== undefined) {
        const cancelIdleCallback = (
          window as unknown as { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback;
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
      }
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="hero-aurora absolute inset-0" />
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
      {showCanvas && (
        <Suspense fallback={null}>
          <HeroCanvas animate />
        </Suspense>
      )}
    </div>
  );
}
