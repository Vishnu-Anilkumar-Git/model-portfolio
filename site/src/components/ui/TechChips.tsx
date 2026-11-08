import { cn } from "@/lib/format";

export function TechChips({
  tech,
  limit,
  className,
}: {
  tech: string[];
  limit?: number;
  className?: string;
}) {
  const shown = limit ? tech.slice(0, limit) : tech;
  const rest = limit ? Math.max(tech.length - shown.length, 0) : 0;

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((item) => (
        <li key={item} className="chip">
          {item}
        </li>
      ))}
      {rest > 0 && <li className="chip">+{rest}</li>}
    </ul>
  );
}
