import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Loader2, Trash2, TriangleAlert, X } from "lucide-react";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden="true" />;
}

export function Badge({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "mint" | "flame" | "violet" | "danger";
  children: ReactNode;
}) {
  const tones = {
    muted: "border-line bg-panel-2 text-fog",
    mint: "border-mint/30 bg-mint/10 text-mint",
    flame: "border-flame/30 bg-flame/10 text-flame",
    violet: "border-violet/30 bg-violet/10 text-violet",
    danger: "border-danger/30 bg-danger/10 text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] leading-4 text-fog/70">{hint}</span>
      ) : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-ink/40 px-3 py-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors",
          checked ? "border-mint/50 bg-mint/30" : "border-line bg-panel-2",
        )}
      >
        <span
          className={cn(
            "block h-3.5 w-3.5 rounded-full bg-paper transition-transform",
            checked ? "translate-x-[18px] bg-mint" : "translate-x-[3px]",
          )}
        />
      </button>
      <span>
        <span className="block text-sm text-paper">{label}</span>
        {hint && <span className="block text-[11px] text-fog/70">{hint}</span>}
      </span>
    </label>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[10.5px] tracking-[0.22em] text-flame uppercase">{eyebrow}</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-fog">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div>
        <p className="text-sm font-medium text-paper">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-fog">{description}</p>
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={cn(
          "card my-auto w-full overflow-hidden bg-panel shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-paper">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-fog">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close dialog">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner /> : <Trash2 size={14} aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-fog">{message}</p>
    </Modal>
  );
}

type ToastTone = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(
  null,
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    counter.current += 1;
    const id = counter.current;
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 bottom-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-lg",
              item.tone === "success"
                ? "border-mint/30 bg-[#0d1a18] text-mint"
                : "border-danger/40 bg-[#1a0f0e] text-danger",
            )}
          >
            {item.tone === "success" ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span className="leading-5">{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
