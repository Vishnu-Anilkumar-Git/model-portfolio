import { AlertTriangle, RotateCcw } from "lucide-react";
import { API_BASE } from "@/lib/api";

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="panel w-full max-w-lg p-7">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-full border border-flame/30 bg-flame/10 p-2 text-flame">
            <AlertTriangle size={16} aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold">The portfolio API is not responding</h1>
        </div>
        <p className="text-sm leading-6 text-fog">
          {message ??
            "Content is served from the Django API, and it could not be reached. Start the backend and try again."}
        </p>
        <p className="mt-3 rounded-lg border border-line bg-ink/60 px-3 py-2 font-mono text-[11px] break-all text-fog/80">
          {API_BASE}
        </p>
        <button type="button" onClick={onRetry} className="btn-primary mt-5">
          <RotateCcw size={15} aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  );
}
