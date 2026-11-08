export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "file"
  | "relation";

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  hint?: string;
  required?: boolean;
  options?: SelectOption[];
  relation?: { path: string; labelField: string };
  nullable?: boolean;
  rows?: number;
  mono?: boolean;
  full?: boolean;
  inList?: boolean;
  accept?: string;
}

export interface FilterConfig {
  name: string;
  label: string;
  options: SelectOption[];
}

export interface ResourceConfig {
  key: string;
  title: string;
  eyebrow: string;
  description: string;
  path: string;
  singular: string;
  fields: FieldConfig[];
  searchPlaceholder: string;
  filters?: FilterConfig[];
  createDefaults?: Record<string, unknown>;
  createWithUpload?: boolean;
  warning?: string;
}

const visible: FieldConfig = {
  name: "visible",
  label: "Visible on site",
  type: "checkbox",
  inList: true,
};

const order: FieldConfig = {
  name: "order",
  label: "Order",
  type: "number",
  hint: "Lower numbers appear first.",
  inList: true,
};

const statusOptions: SelectOption[] = [
  { value: "completed", label: "Completed" },
  { value: "ongoing", label: "Ongoing" },
  { value: "upcoming", label: "Upcoming" },
];

export const resources: ResourceConfig[] = [
  {
    key: "projects",
    title: "Projects",
    eyebrow: "Case studies",
    description:
      "Cards shown on the site plus the full case-study page at /projects/{slug}. Empty optional fields simply do not render.",
    path: "/admin/projects/",
    singular: "project",
    searchPlaceholder: "Search title, summary or tech…",
    filters: [{ name: "status", label: "Status", options: statusOptions }],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, inList: true },
      {
        name: "slug",
        label: "Slug",
        type: "text",
        hint: "Leave blank to generate from the title. Changing it breaks existing links.",
        mono: true,
      },
      { name: "subtitle", label: "Subtitle", type: "text", full: true },
      {
        name: "summary",
        label: "Card summary",
        type: "textarea",
        rows: 3,
        required: true,
        full: true,
        hint: "One or two sentences for the project card (max 500 characters).",
      },
      {
        name: "description",
        label: "Case study",
        type: "textarea",
        rows: 8,
        full: true,
        hint: "Separate paragraphs with a blank line.",
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: statusOptions,
        inList: true,
      },
      {
        name: "progress",
        label: "Progress %",
        type: "number",
        nullable: true,
        hint: "Ongoing projects only, 0–100.",
      },
      {
        name: "tech_stack",
        label: "Tech stack",
        type: "text",
        hint: "Comma-separated, e.g. Django, PostgreSQL, React.",
        full: true,
      },
      {
        name: "accent",
        label: "Card accent",
        type: "select",
        options: [
          { value: "orange", label: "Orange" },
          { value: "teal", label: "Teal" },
          { value: "violet", label: "Violet" },
        ],
      },
      { name: "cover_image", label: "Cover image", type: "file", accept: "image/*" },
      {
        name: "architecture_image",
        label: "Architecture image",
        type: "file",
        accept: "image/*",
      },
      {
        name: "architecture_notes",
        label: "Architecture notes",
        type: "textarea",
        rows: 6,
        full: true,
        hint: "How the system fits together. Blank lines separate paragraphs.",
      },
      {
        name: "highlights",
        label: "Highlights",
        type: "textarea",
        rows: 5,
        full: true,
        hint: "One highlight per line.",
      },
      {
        name: "learnings",
        label: "What you learned",
        type: "textarea",
        rows: 4,
        full: true,
      },
      { name: "repo_url", label: "Repository URL", type: "text", mono: true },
      { name: "demo_url", label: "Live demo URL", type: "text", mono: true },
      { name: "started_on", label: "Started on", type: "date", nullable: true },
      { name: "completed_on", label: "Completed on", type: "date", nullable: true },
      {
        name: "meta_description",
        label: "SEO meta description",
        type: "text",
        full: true,
        hint: "Optional. Falls back to the summary.",
      },
      { name: "featured", label: "Featured", type: "checkbox" },
      order,
      visible,
    ],
    createDefaults: { status: "ongoing", accent: "orange", visible: true, order: 0 },
  },
  {
    key: "skills",
    title: "Skills",
    eyebrow: "Capabilities",
    description: "Skills grouped into the categories shown in the site's skills section.",
    path: "/admin/skills/",
    singular: "skill",
    searchPlaceholder: "Search skills…",
    fields: [
      { name: "name", label: "Skill", type: "text", required: true, inList: true },
      {
        name: "category",
        label: "Category",
        type: "relation",
        relation: { path: "/admin/skills/categories/", labelField: "name" },
        required: true,
        inList: true,
      },
      {
        name: "level",
        label: "Confidence (0–100)",
        type: "number",
        nullable: true,
        hint: "Optional. Leave blank to hide the meter.",
        inList: true,
      },
      order,
      visible,
    ],
    createDefaults: { visible: true, order: 0 },
  },
  {
    key: "skill-categories",
    title: "Skill categories",
    eyebrow: "Capabilities",
    description: "Groups that organise skills on the public site.",
    path: "/admin/skills/categories/",
    singular: "category",
    searchPlaceholder: "Search categories…",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, inList: true },
      { name: "description", label: "Description", type: "text", full: true },
      order,
      visible,
    ],
    createDefaults: { visible: true, order: 0 },
  },
  {
    key: "education",
    title: "Education",
    eyebrow: "Journey",
    description: "Timeline entries for degrees and formal study.",
    path: "/admin/education/",
    singular: "education entry",
    searchPlaceholder: "Search institution or degree…",
    fields: [
      { name: "degree", label: "Degree", type: "text", required: true, inList: true },
      {
        name: "institution",
        label: "Institution",
        type: "text",
        required: true,
        inList: true,
      },
      { name: "field_of_study", label: "Field of study", type: "text" },
      { name: "university", label: "University / board", type: "text" },
      { name: "location", label: "Location", type: "text" },
      { name: "start_year", label: "Start year", type: "number", nullable: true, inList: true },
      {
        name: "end_year",
        label: "End year",
        type: "number",
        nullable: true,
        hint: "Leave blank if ongoing.",
        inList: true,
      },
      { name: "grade", label: "Grade / score", type: "text" },
      { name: "description", label: "Description", type: "textarea", rows: 4, full: true },
      { name: "current", label: "Currently studying", type: "checkbox" },
      order,
      visible,
    ],
    createDefaults: { visible: true, order: 0 },
  },
  {
    key: "experience",
    title: "Experience",
    eyebrow: "Journey",
    description: "Work, internships, freelance and independent project entries.",
    path: "/admin/experience/",
    singular: "experience entry",
    searchPlaceholder: "Search role or organisation…",
    filters: [
      {
        name: "kind",
        label: "Kind",
        options: [
          { value: "work", label: "Work" },
          { value: "internship", label: "Internship" },
          { value: "freelance", label: "Freelance" },
          { value: "volunteer", label: "Volunteer" },
          { value: "education", label: "Education" },
          { value: "project", label: "Independent project" },
        ],
      },
    ],
    fields: [
      { name: "role", label: "Role", type: "text", required: true, inList: true },
      {
        name: "organization",
        label: "Organisation",
        type: "text",
        required: true,
        inList: true,
      },
      {
        name: "kind",
        label: "Kind",
        type: "select",
        options: [
          { value: "work", label: "Work" },
          { value: "internship", label: "Internship" },
          { value: "freelance", label: "Freelance" },
          { value: "volunteer", label: "Volunteer" },
          { value: "education", label: "Education" },
          { value: "project", label: "Independent project" },
        ],
        inList: true,
      },
      { name: "location", label: "Location", type: "text" },
      { name: "start_date", label: "Start date", type: "date", nullable: true, inList: true },
      { name: "end_date", label: "End date", type: "date", nullable: true },
      { name: "current", label: "Current role", type: "checkbox" },
      { name: "summary", label: "Summary", type: "textarea", rows: 4, full: true },
      {
        name: "highlights",
        label: "Highlights",
        type: "textarea",
        rows: 4,
        full: true,
        hint: "One per line.",
      },
      order,
      visible,
    ],
    createDefaults: { kind: "work", visible: true, order: 0 },
  },
  {
    key: "certifications",
    title: "Certifications & training",
    eyebrow: "Credentials",
    description:
      "Both certifications and training programmes. Status drives the badge colour on the public site.",
    path: "/admin/certifications/",
    singular: "certification",
    searchPlaceholder: "Search name or issuer…",
    filters: [
      {
        name: "status",
        label: "Status",
        options: [
          { value: "completed", label: "Completed" },
          { value: "in_progress", label: "In progress" },
          { value: "planned", label: "Planned" },
        ],
      },
      {
        name: "category",
        label: "Category",
        options: [
          { value: "certification", label: "Certification" },
          { value: "training", label: "Training" },
        ],
      },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, inList: true },
      { name: "issuer", label: "Issuer", type: "text", inList: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "in_progress", label: "In progress" },
          { value: "completed", label: "Completed" },
          { value: "planned", label: "Planned" },
        ],
        inList: true,
      },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
          { value: "certification", label: "Certification" },
          { value: "training", label: "Training" },
        ],
      },
      { name: "issued_on", label: "Issued on", type: "date", nullable: true },
      { name: "expires_on", label: "Expires on", type: "date", nullable: true },
      { name: "credential_id", label: "Credential ID", type: "text", mono: true },
      { name: "credential_url", label: "Credential URL", type: "text", mono: true },
      { name: "description", label: "Description", type: "text", full: true },
      order,
      visible,
    ],
    createDefaults: {
      status: "in_progress",
      category: "certification",
      visible: true,
      order: 0,
    },
  },
  {
    key: "achievements",
    title: "Achievements & labs",
    eyebrow: "Proof of work",
    description: "TryHackMe / Hack The Box progress, CTF results, awards and community work.",
    path: "/admin/achievements/",
    singular: "achievement",
    searchPlaceholder: "Search title or organisation…",
    filters: [
      {
        name: "category",
        label: "Category",
        options: [
          { value: "lab", label: "Hands-on lab" },
          { value: "ctf", label: "CTF" },
          { value: "award", label: "Award" },
          { value: "community", label: "Community" },
          { value: "other", label: "Other" },
        ],
      },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", required: true, inList: true },
      { name: "organization", label: "Organisation", type: "text", inList: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
          { value: "lab", label: "Hands-on lab" },
          { value: "ctf", label: "CTF" },
          { value: "award", label: "Award" },
          { value: "community", label: "Community" },
          { value: "other", label: "Other" },
        ],
        inList: true,
      },
      { name: "occurred_on", label: "Date", type: "date", nullable: true },
      { name: "description", label: "Description", type: "textarea", rows: 4, full: true },
      { name: "url", label: "Proof URL", type: "text", mono: true },
      { name: "badge_image", label: "Badge image", type: "file", accept: "image/*" },
      order,
      visible,
    ],
    createDefaults: { category: "lab", visible: true, order: 0 },
  },
  {
    key: "faqs",
    title: "FAQs",
    eyebrow: "Site copy",
    description: "Questions shown on the site and mirrored into FAQPage structured data.",
    path: "/admin/faqs/",
    singular: "FAQ",
    searchPlaceholder: "Search questions…",
    fields: [
      { name: "question", label: "Question", type: "text", required: true, inList: true },
      { name: "answer", label: "Answer", type: "textarea", rows: 4, required: true, full: true },
      order,
      visible,
    ],
    createDefaults: { visible: true, order: 0 },
  },
  {
    key: "socials",
    title: "Social links",
    eyebrow: "Site copy",
    description: "Links shown in the hero and footer.",
    path: "/admin/social-links/",
    singular: "social link",
    searchPlaceholder: "Search links…",
    fields: [
      { name: "label", label: "Label", type: "text", required: true, inList: true },
      { name: "url", label: "URL", type: "text", required: true, mono: true, inList: true },
      {
        name: "icon",
        label: "Icon",
        type: "select",
        options: [
          { value: "github", label: "GitHub" },
          { value: "linkedin", label: "LinkedIn" },
          { value: "mail", label: "Email" },
          { value: "globe", label: "Website" },
          { value: "x", label: "X / Twitter" },
          { value: "tryhackme", label: "TryHackMe" },
          { value: "hackthebox", label: "Hack The Box" },
          { value: "link", label: "Generic link" },
        ],
        inList: true,
      },
      order,
      visible,
    ],
    createDefaults: { icon: "link", visible: true, order: 0 },
  },
  {
    key: "suggestions",
    title: "Chatbot prompts",
    eyebrow: "Assistant",
    description: "Suggested questions offered when the chatbot opens.",
    path: "/admin/chatbot/suggestions/",
    singular: "suggested question",
    searchPlaceholder: "Search prompts…",
    fields: [
      { name: "text", label: "Question", type: "text", required: true, inList: true },
      order,
      visible,
    ],
    createDefaults: { visible: true, order: 0 },
  },
  {
    key: "screenshots",
    title: "Screenshots",
    eyebrow: "Case studies",
    description: "Extra screenshots attached to a project's case-study page.",
    path: "/admin/projects/screenshots/",
    singular: "screenshot",
    searchPlaceholder: "Search captions…",
    createWithUpload: true,
    fields: [
      {
        name: "project",
        label: "Project",
        type: "relation",
        relation: { path: "/admin/projects/", labelField: "title" },
        required: true,
        inList: true,
      },
      { name: "caption", label: "Caption", type: "text", inList: true },
      {
        name: "image",
        label: "Image",
        type: "file",
        accept: "image/*",
        required: true,
        hint: "Required when creating. Choosing a new file replaces the current image.",
      },
      { name: "order", label: "Order", type: "number", inList: true },
    ],
    createDefaults: { order: 0 },
  },
];

export function getResource(key: string | undefined): ResourceConfig | undefined {
  return resources.find((resource) => resource.key === key);
}
