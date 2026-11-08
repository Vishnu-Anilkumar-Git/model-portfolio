import { useId, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  MapPin,
  Send,
} from "lucide-react";
import type { Profile, SocialLink } from "@/types";
import { ApiError, sendContact } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { SocialIcon, socialIsExternal } from "@/components/layout/SocialIcon";

type Status = "idle" | "sending" | "success" | "error";

const EMPTY = { name: "", email: "", subject: "", message: "", website: "" };

function validate(values: typeof EMPTY) {
  const errors: Partial<Record<keyof typeof EMPTY, string>> = {};
  if (values.name.trim().length < 2) errors.name = "Tell me your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (values.message.trim().length < 10) {
    errors.message = "Add a little more detail (at least 10 characters).";
  }
  return errors;
}

export function Contact({
  profile,
  socials,
}: {
  profile: Profile;
  socials: SocialLink[];
}) {
  const baseId = useId();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [feedback, setFeedback] = useState("");

  const update = (field: keyof typeof EMPTY, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("sending");
    setFeedback("");
    try {
      await sendContact({
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
        website: values.website,
      });
      setStatus("success");
      setValues(EMPTY);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      let message =
        apiError?.message ??
        "The message could not be sent right now. Please try email instead.";
      if (apiError?.status === 429) {
        message = apiError.retryAfter
          ? `Too many messages. Please try again in ${apiError.retryAfter} seconds, or email directly.`
          : "Too many messages. Please try again shortly, or email directly.";
      }
      setFeedback(message);
      setStatus("error");
    }
  };

  return (
    <Section
      id="contact"
      index="08"
      label="Contact"
      title="Let's talk security."
      intro="Open to SOC analyst, security intern and entry-level cybersecurity roles. Messages land in my inbox."
      alt
    >
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        <Reveal>
          <div className="space-y-5">
            <div className="panel p-5">
              <p className="mono">Direct</p>
              <a
                href={`mailto:${profile.email}`}
                className="mt-3 flex items-center gap-2.5 text-[14px] break-all text-paper transition-colors hover:text-flame"
              >
                <Mail size={16} className="shrink-0 text-flame" aria-hidden="true" />
                {profile.email}
              </a>
              <p className="mt-3 flex items-center gap-2.5 text-[13px] text-fog">
                <MapPin size={15} className="shrink-0 text-mint" aria-hidden="true" />
                {profile.location}
              </p>
              {profile.resume_url && (
                <a
                  href={profile.resume_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] text-fog transition-colors hover:text-paper"
                >
                  <Download size={13} aria-hidden="true" />
                  Download resume (PDF)
                </a>
              )}
            </div>

            <div className="panel p-5">
              <p className="mono">Availability</p>
              <p className="mt-2.5 text-[13.5px] leading-6 text-paper/85">
                {profile.availability ||
                  `Open to ${profile.target_role} and entry-level security roles.`}
              </p>
              {socials.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  {socials.map((social) => (
                    <li key={social.id}>
                      <a
                        href={social.url}
                        target={socialIsExternal(social.url) ? "_blank" : undefined}
                        rel={socialIsExternal(social.url) ? "noreferrer" : undefined}
                        className="btn-small"
                      >
                        <SocialIcon icon={social.icon} size={12} />
                        {social.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="font-mono text-[10.5px] leading-5 text-fog/60">
              No analytics or tracking scripts on this site. Contact details are used
              only to reply to your message.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          {status === "success" ? (
            <div className="panel flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
              <span className="rounded-full border border-mint/30 bg-mint/10 p-3 text-mint">
                <CheckCircle2 size={26} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">Message received</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-fog">
                Thanks for reaching out. Your message is stored and a notification has
                been sent to Vishnu — expect a reply by email.
              </p>
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="btn-ghost mt-6 text-[13px]"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="panel p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${baseId}-name`} className="field-label">
                    Name <span className="text-flame">*</span>
                  </label>
                  <input
                    id={`${baseId}-name`}
                    name="name"
                    value={values.name}
                    onChange={(event) => update("name", event.target.value)}
                    className="field"
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                    aria-describedby={errors.name ? `${baseId}-name-error` : undefined}
                    required
                  />
                  {errors.name && (
                    <p id={`${baseId}-name-error`} className="mt-1 text-[11px] text-flame">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={`${baseId}-email`} className="field-label">
                    Email <span className="text-flame">*</span>
                  </label>
                  <input
                    id={`${baseId}-email`}
                    name="email"
                    type="email"
                    value={values.email}
                    onChange={(event) => update("email", event.target.value)}
                    className="field"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${baseId}-email-error` : undefined}
                    required
                  />
                  {errors.email && (
                    <p id={`${baseId}-email-error`} className="mt-1 text-[11px] text-flame">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor={`${baseId}-subject`} className="field-label">
                  Subject
                </label>
                <input
                  id={`${baseId}-subject`}
                  name="subject"
                  value={values.subject}
                  onChange={(event) => update("subject", event.target.value)}
                  className="field"
                  placeholder="SOC analyst role, internship, collaboration…"
                  maxLength={200}
                />
              </div>

              <div className="mt-4">
                <div className="flex items-baseline justify-between">
                  <label htmlFor={`${baseId}-message`} className="field-label">
                    Message <span className="text-flame">*</span>
                  </label>
                  {values.message.length > 4000 && (
                    <span className="font-mono text-[10px] text-fog">
                      {values.message.length}/5000
                    </span>
                  )}
                </div>
                <textarea
                  id={`${baseId}-message`}
                  name="message"
                  rows={6}
                  value={values.message}
                  onChange={(event) => update("message", event.target.value)}
                  className="field resize-y"
                  placeholder="A little context about the role or question…"
                  maxLength={5000}
                  aria-invalid={Boolean(errors.message)}
                  aria-describedby={errors.message ? `${baseId}-message-error` : undefined}
                  required
                />
                {errors.message && (
                  <p id={`${baseId}-message-error`} className="mt-1 text-[11px] text-flame">
                    {errors.message}
                  </p>
                )}
              </div>

              <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor={`${baseId}-website`}>Leave this field empty</label>
                <input
                  id={`${baseId}-website`}
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={values.website}
                  onChange={(event) => update("website", event.target.value)}
                />
              </div>

              {status === "error" && (
                <div
                  role="alert"
                  className="mt-4 flex gap-2.5 rounded-xl border border-flame/30 bg-flame/5 p-3 text-[12px] leading-5 text-flame"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <p>{feedback}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[10px] text-fog/60">
                  required fields <span className="text-flame">*</span>
                </p>
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="btn-primary min-w-[150px]"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                      Sending
                    </>
                  ) : (
                    <>
                      <Send size={15} aria-hidden="true" />
                      Send message
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </Reveal>
      </div>
    </Section>
  );
}
