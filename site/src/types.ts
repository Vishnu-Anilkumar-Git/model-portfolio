export type ProjectStatus = "completed" | "ongoing" | "upcoming";
export type ProjectAccent = "orange" | "teal" | "violet";

export interface Profile {
  name: string;
  headline: string;
  target_role: string;
  location: string;
  email: string;
  phone: string;
  availability: string;
  hero_eyebrow: string;
  about_heading: string;
  bio: string[];
  github_url: string;
  linkedin_url: string;
  website_url: string;
  twitter_url: string;
  avatar: string | null;
  resume_url: string | null;
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  og_image: string | null;
  chatbot_greeting: string;
  footer_note: string;
}

export interface Stat {
  label: string;
  value: string;
}

export interface SocialLink {
  id: number;
  label: string;
  url: string;
  icon: string;
  order: number;
}

export interface Skill {
  id: number;
  name: string;
  level: number | null;
}

export interface SkillCategory {
  id: number;
  name: string;
  description: string;
  skills: Skill[];
}

export interface ProjectSummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  status: ProjectStatus;
  status_label: string;
  progress: number | null;
  tech: string[];
  repo_url: string;
  demo_url: string;
  cover_image: string | null;
  accent: ProjectAccent;
  featured: boolean;
  timeline: string;
  started_on: string | null;
  completed_on: string | null;
  order: number;
}

export interface ProjectScreenshot {
  id: number;
  image: string;
  caption: string;
  order: number;
}

export interface ProjectDetail extends ProjectSummary {
  description: string[];
  architecture: string[];
  architecture_image: string | null;
  highlights: string[];
  learnings: string;
  meta_description: string;
  screenshots: ProjectScreenshot[];
  updated_at: string;
}

export interface Education {
  id: number;
  institution: string;
  degree: string;
  field_of_study: string;
  university: string;
  location: string;
  start_year: number | null;
  end_year: number | null;
  grade: string;
  description: string;
  current: boolean;
  period: string;
}

export interface Experience {
  id: number;
  role: string;
  organization: string;
  kind: string;
  kind_label: string;
  location: string;
  start_date: string | null;
  end_date: string | null;
  current: boolean;
  summary: string;
  highlights: string[];
  period: string;
}

export type CertificationStatus = "in_progress" | "completed" | "planned";

export interface Certification {
  id: number;
  name: string;
  issuer: string;
  status: CertificationStatus;
  status_label: string;
  category: "certification" | "training";
  category_label: string;
  issued_on: string | null;
  expires_on: string | null;
  credential_id: string;
  credential_url: string;
  description: string;
}

export interface Achievement {
  id: number;
  title: string;
  organization: string;
  category: string;
  category_label: string;
  occurred_on: string | null;
  description: string;
  url: string;
  badge_image: string | null;
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
}

export interface SuggestedQuestion {
  id: number;
  text: string;
}

export interface Seo {
  title: string;
  description: string;
  canonical: string;
  og_image: string;
  json_ld: Record<string, unknown>[];
}

export interface SitePayload {
  profile: Profile;
  stats: Stat[];
  socials: SocialLink[];
  skills: SkillCategory[];
  projects: ProjectSummary[];
  education: Education[];
  experience: Experience[];
  certifications: Certification[];
  achievements: Achievement[];
  faqs: FAQ[];
  suggested_questions: SuggestedQuestion[];
  seo: Seo;
  meta: {
    generated_at: string;
    project_counts: Record<ProjectStatus, number>;
  };
}

export interface ChatSource {
  label: string;
  url: string;
  kind: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  provider: string;
  session_id: string;
  latency_ms: number;
  flagged: boolean;
}

export interface ChatSuggestions {
  greeting: string;
  suggestions: string[];
  time: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  provider?: string;
  error?: boolean;
  flagged?: boolean;
}

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  website?: string;
}
