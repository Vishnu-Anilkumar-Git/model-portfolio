import { Suspense, lazy, useEffect, useState } from "react";

const ChatWidget = lazy(() =>
  import("./ChatWidget").then((module) => ({ default: module.ChatWidget })),
);

export function DeferredChat() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    let cancelled = false;

    const enable = () => {
      if (!cancelled) setShow(true);
    };

    const requestIdleCallback = (
      window as unknown as {
        requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(enable, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(enable, 1200);
    }

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      const cancelIdleCallback = (
        window as unknown as { cancelIdleCallback?: (id: number) => void }
      ).cancelIdleCallback;
      if (idleId !== undefined && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
    };
  }, []);

  if (!show) return null;

  return (
    <Suspense fallback={null}>
      <ChatWidget />
    </Suspense>
  );
}
