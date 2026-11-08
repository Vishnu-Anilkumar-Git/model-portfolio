export function BootScreen({ onSkip }: { onSkip?: () => void }) {
  const lines = [
    "initializing portfolio...",
    "connecting to content api...",
    "loading projects, skills, credentials...",
  ];

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-fog uppercase">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" aria-hidden="true" />
          boot sequence
        </div>
        <div className="panel scanline relative overflow-hidden p-5 font-mono text-[12px] text-fog">
          {lines.map((line, index) => (
            <p key={line} className="flex gap-3 py-1">
              <span className="text-flame/70">{String(index + 1).padStart(2, "0")}</span>
              <span>{line}</span>
              <span className="ml-auto text-mint/70">ok</span>
            </p>
          ))}
          <p className="flex items-center gap-2 pt-3 text-paper">
            <span className="text-flame">&gt;</span>
            <span>starting site</span>
            <span className="inline-block h-3.5 w-1.5 animate-blink bg-mint" aria-hidden="true" />
          </p>
        </div>
        {onSkip && (
          <button type="button" onClick={onSkip} className="btn-ghost mt-4 w-full text-[12px]">
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}
