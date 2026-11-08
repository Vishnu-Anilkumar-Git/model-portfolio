import type { ProjectStatus } from "@/types";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function sourcePath(url: string): string {
  if (!url) return "/";
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function formatMonth(date: string | null): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function formatDate(date: string | null): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const statusTone: Record<ProjectStatus, string> = {
  completed: "border-mint/30 bg-mint/10 text-mint",
  ongoing: "border-flame/30 bg-flame/10 text-flame",
  upcoming: "border-violet/30 bg-violet/10 text-violet",
};

export const accentGradient: Record<string, string> = {
  orange: "from-[#2A1710] via-[#141014] to-[#0B0F14]",
  teal: "from-[#0D2420] via-[#0E161A] to-[#0B0F14]",
  violet: "from-[#1C1630] via-[#121018] to-[#0B0F14]",
};

export const accentStroke: Record<string, string> = {
  orange: "#FF8C42",
  teal: "#3ED6B5",
  violet: "#A78BFA",
};
