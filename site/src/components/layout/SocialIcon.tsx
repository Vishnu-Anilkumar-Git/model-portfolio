import type { ComponentType } from "react";
import { AtSign, Globe, Link2, Mail, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/ui/BrandIcons";

type IconComponent = LucideIcon | ComponentType<{ size?: number; className?: string }>;

const icons: Record<string, IconComponent> = {
  github: GithubIcon,
  linkedin: LinkedinIcon,
  mail: Mail,
  globe: Globe,
  x: AtSign,
  tryhackme: Shield,
  hackthebox: Shield,
  link: Link2,
};

export function SocialIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = icons[icon] ?? Link2;
  return <Icon size={size} />;
}

export function socialIsExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
