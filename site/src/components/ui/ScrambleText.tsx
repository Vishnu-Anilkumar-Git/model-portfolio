import { useEffect, useState } from "react";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#_";

/**
 * The server and first client paint render the real string. Only after the page
 * has painted does the animation replace characters, ending on the same text.
 * Assistive tech always reads the stable copy in the visually hidden span.
 */
export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    setDisplay(text);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let startDelay = 0;
    let idleId: number | undefined;
    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      const begin = performance.now();
      const duration = 650;

      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min(1, (now - begin) / duration);
        const revealed = Math.floor(progress * text.length);

        setDisplay(
          text
            .split("")
            .map((character, index) => {
              if (character === " " || index < revealed) return character;
              return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
            })
            .join(""),
        );

        if (progress < 1) {
          frame = window.requestAnimationFrame(tick);
        } else {
          setDisplay(text);
        }
      };

      frame = window.requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (cancelled) return;
      const requestIdleCallback = (
        window as unknown as {
          requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        }
      ).requestIdleCallback;

      if (typeof requestIdleCallback === "function") {
        idleId = requestIdleCallback(run, { timeout: 1200 });
      } else {
        startDelay = window.setTimeout(run, 400);
      }
    };

    // Wait for the first paint/hydration before touching the text.
    startDelay = window.setTimeout(schedule, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(startDelay);
      window.cancelAnimationFrame(frame);
      const cancelIdleCallback = (
        window as unknown as { cancelIdleCallback?: (id: number) => void }
      ).cancelIdleCallback;
      if (idleId !== undefined && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
    };
  }, [text]);

  // The h1 carries the full accessible name via aria-label; this span is the
  // visual layer only, so the text is not announced twice.
  return (
    <span aria-hidden="true" className={className}>
      {display}
    </span>
  );
}
