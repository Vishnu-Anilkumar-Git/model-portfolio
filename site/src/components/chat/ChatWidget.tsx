import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpRight,
  Loader2,
  MessageSquare,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { fetchChatSuggestions } from "@/lib/api";
import { cn, sourcePath } from "@/lib/format";
import { useChat } from "@/hooks/useChat";
import type { ChatMessage, ChatSource } from "@/types";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-fog"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </span>
  );
}

function SourceChips({ sources }: { sources: ChatSource[] }) {
  if (!sources.length) return null;
  return (
    <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Sources used">
      {sources.map((source) => (
        <li key={`${source.label}-${source.url}`}>
          <Link
            to={sourcePath(source.url)}
            className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full border border-line bg-ink/50 px-2.5 py-1 font-mono text-[9.5px] text-fog transition-colors hover:border-mint/40 hover:text-mint"
            title={source.label}
          >
            <span className="truncate">{source.label}</span>
            <ArrowUpRight size={10} className="shrink-0" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-flame px-3.5 py-2.5 text-[13px] leading-6 text-[#180C04]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[8.5px]",
          message.error
            ? "border-flame/40 bg-flame/10 text-flame"
            : "border-mint/30 bg-mint/10 text-mint",
        )}
        aria-hidden="true"
      >
        VA
      </span>
      <div className="min-w-0 max-w-[88%]">
        <div
          className={cn(
            "rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-[13px] leading-6 whitespace-pre-wrap",
            message.error
              ? "border-flame/30 bg-flame/5 text-paper/90"
              : "border-line bg-panel-2/80 text-paper/90",
          )}
        >
          {message.content || <TypingDots />}
          {message.provider === "stopped" && (
            <span className="mt-1 block font-mono text-[9.5px] text-fog">stopped</span>
          )}
        </div>
        <SourceChips sources={message.sources ?? []} />
      </div>
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const { data } = useQuery({
    queryKey: ["chat-suggestions"],
    queryFn: fetchChatSuggestions,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const { messages, isStreaming, isThinking, error, send, stop, clear, retry } = useChat();
  const greeting =
    data?.greeting ?? "Ask me about Vishnu's projects, skills, certifications or background.";
  const suggestions = data?.suggestions ?? [];

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [messages, isThinking, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = () => {
    if (isStreaming) return;
    const text = value.trim();
    if (!text) return;
    setValue("");
    send(text);
  };

  return (
    <>
      {open && (
        <div
          id="portfolio-chat"
          role="dialog"
          aria-label="Vishnu's AI portfolio assistant"
          className="chat-panel-in fixed right-3 bottom-20 left-3 z-50 flex h-[min(600px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-2xl border border-line bg-ink/97 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:right-5 sm:left-auto sm:w-[390px]"
        >
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-mint/25 bg-mint/10 text-mint">
                  <MessageSquare size={15} aria-hidden="true" />
                  <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border-2 border-ink bg-mint" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">Vishnu AI</p>
                  <p className="font-mono text-[9.5px] text-fog">
                    grounded in portfolio data
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={clear}
                  disabled={!messages.length || isStreaming}
                  aria-label="Clear conversation"
                  className="rounded-lg p-2 text-fog transition-colors hover:text-paper disabled:opacity-30"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    launcherRef.current?.focus();
                  }}
                  aria-label="Close assistant"
                  className="rounded-lg p-2 text-fog transition-colors hover:text-paper"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div
              ref={listRef}
              role="log"
              aria-live="polite"
              aria-busy={isStreaming}
              aria-label="Conversation with Vishnu's assistant"
              className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            >
              {messages.length === 0 ? (
                <div>
                  <div className="rounded-2xl rounded-tl-md border border-line bg-panel-2/70 p-3.5 text-[13px] leading-6 text-paper/90">
                    {greeting}
                  </div>
                  {suggestions.length > 0 && (
                    <div className="mt-4">
                      <p className="mono mb-2">Try asking</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => send(suggestion)}
                            className="rounded-full border border-line bg-panel/60 px-3 py-1.5 text-left text-[11.5px] text-fog transition-colors hover:border-mint/40 hover:text-paper"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}

              {error && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-flame/30 bg-flame/5 p-2.5 text-[11.5px] leading-5 text-flame"
                >
                  <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
                  <span className="flex-1">{error}</span>
                  <button
                    type="button"
                    onClick={retry}
                    disabled={isStreaming}
                    className="rounded-full border border-flame/40 px-2.5 py-1 font-mono text-[10px] transition-colors hover:bg-flame/10"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-line p-3">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                <div className="flex items-end gap-2 rounded-xl border border-line bg-panel/70 p-2 focus-within:border-mint/40">
                  <label htmlFor="chat-input" className="sr-only">
                    Ask about Vishnu
                  </label>
                  <textarea
                    id="chat-input"
                    ref={inputRef}
                    rows={1}
                    value={value}
                    onChange={(event) => setValue(event.target.value.slice(0, 500))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                      }
                    }}
                    placeholder="Ask about projects, skills, certifications…"
                    maxLength={500}
                    className="max-h-24 min-h-[34px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[13px] leading-5 text-paper placeholder:text-fog/50 focus:outline-none"
                  />
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={stop}
                      aria-label="Stop the answer"
                      className="mb-0.5 rounded-lg bg-panel-2 p-2 text-fog transition-colors hover:text-paper"
                    >
                      <Square size={15} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!value.trim()}
                      aria-label="Send message"
                      className="mb-0.5 rounded-lg bg-flame p-2 text-[#180C04] transition-colors hover:bg-[#ffa163] disabled:opacity-40"
                    >
                      <Send size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="mt-1.5 flex items-center justify-between px-0.5">
                  <p className="font-mono text-[9px] text-fog/50">
                    answers limited to Vishnu's portfolio
                  </p>
                  <span className="font-mono text-[9px] text-fog/50">
                    {value.length}/500
                  </span>
                </div>
              </form>
            </div>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="portfolio-chat"
        aria-label={open ? "Close Vishnu's AI assistant" : "Ask AI — open Vishnu's assistant"}
        className={cn(
          "fixed right-4 bottom-4 z-50 flex h-12 items-center gap-2 rounded-full border border-line bg-panel px-4 text-[12px] font-medium text-paper shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)] transition-colors hover:border-mint/40 sm:right-5 sm:bottom-5",
          open && "border-mint/40",
        )}
      >
        {isStreaming ? (
          <Loader2 size={17} className="animate-spin text-mint" aria-hidden="true" />
        ) : (
          <MessageSquare size={17} className="text-mint" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{open ? "Assistant" : "Ask AI"}</span>
        {messages.length > 0 && !open && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink bg-flame" />
        )}
      </button>
    </>
  );
}
