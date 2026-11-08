import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { Field, Spinner } from "@/components/ui";

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #8b98a7 1px, transparent 1px), linear-gradient(to bottom, #8b98a7 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <p className="font-mono text-[10.5px] tracking-[0.24em] text-flame uppercase">
            vishnu.sec / control room
          </p>
          <h1 className="mt-6 max-w-md text-4xl leading-[1.05] font-semibold tracking-[-0.03em]">
            One database.
            <br />
            Every word on
            <br />
            <span className="text-mint">the site.</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-fog">
            Projects, skills, certifications, FAQs, the assistant's knowledge and the
            public SEO payload all read from here. Edit once, ship everywhere.
          </p>
        </div>

        <div className="relative rounded-xl border border-line bg-panel/70 p-4 font-mono text-[11.5px] leading-6">
          <p className="text-fog">
            <span className="text-flame">$</span> curl -X POST /api/v1/auth/token/
          </p>
          <p className="text-fog">
            <span className="text-mint">→</span> {"{"} access, refresh {"}"}
          </p>
          <p className="text-fog/60">
            <span className="text-flame">$</span> auth: Bearer &lt;access_token&gt;
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-mint align-middle" />
          </p>
        </div>

        <p className="relative flex items-center gap-2 font-mono text-[10px] tracking-[0.14em] text-fog/60 uppercase">
          <ShieldCheck size={12} aria-hidden="true" />
          staff-only · JWT · no cookies
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-mint/30 bg-mint/10 text-mint">
              <Lock size={17} aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">Sign in</h2>
            <p className="mt-1.5 text-sm text-fog">
              Use your Django staff account. Content changes go live immediately.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </div>
            )}
            <Field label="Username">
              <input
                className="input"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Password">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? <Spinner /> : <ArrowRight size={15} aria-hidden="true" />}
              {busy ? "Authenticating…" : "Enter control room"}
            </button>
          </form>

          <p className="mt-6 text-[11.5px] leading-5 text-fog/60">
            No account yet? Create one with{" "}
            <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[10.5px] text-paper/80">
              python manage.py createsuperuser
            </code>{" "}
            in the backend directory.
          </p>
        </div>
      </div>
    </div>
  );
}
