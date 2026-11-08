import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Content is always rendered visible. The old entrance animation depended on
 * JavaScript, which hid copy in the pre-rendered HTML and cost main-thread time.
 */
export function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>;
}
