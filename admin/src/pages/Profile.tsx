import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Save, Upload } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  EmptyState,
  Field,
  PageHeader,
  Spinner,
  useToast,
} from "@/components/ui";

interface ProfileData extends Record<string, unknown> {
  name: string;
  headline: string;
  target_role: string;
  location: string;
  email: string;
  phone: string;
  availability: string;
  hero_eyebrow: string;
  about_heading: string;
  bio: string;
  github_url: string;
  linkedin_url: string;
  website_url: string;
  twitter_url: string;
  seo_title: string;
  seo_description: string;
  canonical_url: string;
  chatbot_greeting: string;
  footer_note: string;
  avatar: string | null;
  resume: string | null;
  og_image: string | null;
  bio_paragraphs: string[];
  resume_url: string | null;
  updated_at: string;
}

type TextKey = Exclude<
  keyof ProfileData,
  "avatar" | "resume" | "og_image" | "bio_paragraphs" | "resume_url" | "updated_at"
>;

const sections: Array<{
  title: string;
  description: string;
  fields: Array<{ name: TextKey; label: string; type?: "textarea" | "text"; rows?: number; hint?: string; full?: boolean }>;
}> = [
  {
    title: "Identity",
    description: "The name, tagline and availability shown in the hero.",
    fields: [
      { name: "name", label: "Full name" },
      { name: "hero_eyebrow", label: "Hero eyebrow", hint: "Small monospace label above the name." },
      { name: "headline", label: "Headline", full: true },
      { name: "target_role", label: "Target role" },
      { name: "availability", label: "Availability line", hint: "Leave blank to hide the availability pill." },
      { name: "location", label: "Location" },
      { name: "email", label: "Public email" },
      { name: "phone", label: "Phone (optional)" },
    ],
  },
  {
    title: "About",
    description: "The About section copy.",
    fields: [
      { name: "about_heading", label: "About heading", full: true },
      {
        name: "bio",
        label: "Bio",
        type: "textarea",
        rows: 8,
        full: true,
        hint: "Separate paragraphs with a blank line.",
      },
    ],
  },
  {
    title: "Links",
    description: "Used in the hero, footer and Person structured data.",
    fields: [
      { name: "github_url", label: "GitHub URL" },
      { name: "linkedin_url", label: "LinkedIn URL" },
      { name: "website_url", label: "Website URL" },
      { name: "twitter_url", label: "X / Twitter URL" },
    ],
  },
  {
    title: "SEO & sharing",
    description: "The document title, meta description and social preview.",
    fields: [
      { name: "seo_title", label: "SEO title", full: true },
      { name: "seo_description", label: "Meta description", type: "textarea", rows: 3, full: true },
      { name: "canonical_url", label: "Canonical URL", full: true },
    ],
  },
  {
    title: "Assistant & footer",
    description: "Chat widget greeting and the footer note.",
    fields: [
      { name: "chatbot_greeting", label: "Chatbot greeting", full: true },
      { name: "footer_note", label: "Footer note", full: true },
    ],
  },
];

export function Profile() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<ProfileData>("/admin/profile/"),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const next: Record<string, string> = {};
    for (const section of sections) {
      for (const field of section.fields) {
        next[field.name] = String(query.data[field.name] ?? "");
      }
    }
    setValues(next);
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) payload[key] = value;
      await api.updateTo<ProfileData>("/admin/profile/", payload);

      for (const [field, file] of Object.entries(files)) {
        if (file) await api.uploadTo("/admin/profile/", field, file);
      }
    },
    onSuccess: () => {
      toast.push("Saved. The public site will refresh shortly.");
      setFiles({});
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (caught) => {
      setError(errorMessage(caught));
      toast.push(errorMessage(caught), "error");
    },
  });

  if (query.isLoading) {
    return (
      <div className="grid place-items-center py-32">
        <Spinner className="h-6 w-6 text-mint" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Could not load the profile"
        description={errorMessage(query.error)}
        action={
          <button type="button" className="btn-ghost" onClick={() => void query.refetch()}>
            Retry
          </button>
        }
      />
    );
  }

  const data = query.data;

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Profile & site settings"
        description="Single source of truth for identity, about copy, links, SEO and downloads."
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setError(null);
              save.mutate();
            }}
            disabled={save.isPending}
          >
            {save.isPending ? <Spinner /> : <Save size={14} aria-hidden="true" />}
            Save profile
          </button>
        }
      />

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="card p-5">
            <div className="mb-4">
              <h2 className="text-sm font-medium text-paper">{section.title}</h2>
              <p className="mt-0.5 text-[11.5px] text-fog">{section.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.name} className={field.full ? "sm:col-span-2" : ""}>
                  <Field label={field.label} hint={field.hint}>
                    {field.type === "textarea" ? (
                      <textarea
                        className="input resize-y"
                        rows={field.rows ?? 4}
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <input
                        className="input"
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </Field>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-medium text-paper">Files</h2>
            <p className="mt-0.5 text-[11.5px] text-fog">
              The résumé download button only appears on the site once a PDF is uploaded.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { field: "avatar", label: "Avatar", accept: "image/*", current: data.avatar },
              { field: "resume", label: "Résumé (PDF)", accept: "application/pdf", current: data.resume },
              { field: "og_image", label: "Social share image", accept: "image/*", current: data.og_image },
            ].map((item) => (
              <div key={item.field}>
                <span className="label">{item.label}</span>
                <input
                  type="file"
                  accept={item.accept}
                  className="block w-full text-xs text-fog file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-panel-2 file:px-3 file:py-1.5 file:text-paper/80 hover:file:bg-[#182231]"
                  onChange={(event) =>
                    setFiles((current) => ({
                      ...current,
                      [item.field]: event.target.files?.[0] ?? null,
                    }))
                  }
                />
                {item.current && (
                  <a
                    href={item.current}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-mint hover:underline"
                  >
                    <ExternalLink size={11} aria-hidden="true" />
                    Current file
                  </a>
                )}
                {files[item.field] && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-flame">
                    <Upload size={11} aria-hidden="true" />
                    {files[item.field]?.name} — saved with the next save
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] tracking-[0.08em] text-fog/50 uppercase">
            last updated {new Date(data.updated_at).toLocaleString()}
          </p>
        </section>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setError(null);
            save.mutate();
          }}
          disabled={save.isPending}
        >
          {save.isPending ? <Spinner /> : <Save size={14} aria-hidden="true" />}
          Save profile
        </button>
      </div>
    </>
  );
}
