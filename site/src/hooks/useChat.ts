import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  postChat,
  streamChat,
  StreamError,
} from "@/lib/api";
import type { ChatMessage, ChatSource } from "@/types";

const HISTORY_KEY = "vishnu-chat-history-v1";
const SESSION_KEY = "vishnu-chat-session-v1";
const MAX_STORED = 40;

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ChatMessage =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as ChatMessage).id === "string" &&
          ((item as ChatMessage).role === "user" ||
            (item as ChatMessage).role === "assistant") &&
          typeof (item as ChatMessage).content === "string",
      )
      .slice(-MAX_STORED);
  } catch {
    return [];
  }
}

function sessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = newId();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return newId();
  }
}

function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return error.retryAfter
        ? `You're asking quickly — try again in ${error.retryAfter} seconds.`
        : "You're asking quickly — try again in a minute.";
    }
    if (error.status === 0) {
      return "The assistant API is unreachable. Please try again in a moment.";
    }
    return error.message;
  }
  if (error instanceof StreamError) return error.message;
  return "The assistant is unavailable right now. Please try again.";
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
      } catch {
        // Storage can be unavailable in private mode; chat still works.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [messages]);

  const patchAssistant = useCallback(
    (id: string, patch: Partial<ChatMessage>) => {
      setMessages((current) =>
        current.map((message) => (message.id === id ? { ...message, ...patch } : message)),
      );
    },
    [],
  );

  const run = useCallback(
    async (text: string, prior: ChatMessage[]) => {
      const trimmed = text.trim().slice(0, 500);
      if (!trimmed || activeRef.current) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      activeRef.current = true;

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
      };
      const assistantId = newId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      setMessages([...prior, userMessage, assistantMessage]);
      setError(null);
      setIsStreaming(true);

      const history = prior
        .filter((message) => !message.error && message.content.trim())
        .slice(-6)
        .map(({ role, content }) => ({ role, content }));
      const request = {
        message: trimmed,
        history,
        session_id: sessionId(),
      };

      let accumulated = "";
      let sawToken = false;
      let sources: ChatSource[] = [];

      try {
        await streamChat(
          request,
          {
            onMeta: (meta) => {
              sources = meta.sources;
              patchAssistant(assistantId, {
                sources: meta.sources,
                flagged: meta.flagged,
              });
            },
            onDelta: (delta) => {
              sawToken = true;
              accumulated += delta;
              patchAssistant(assistantId, { content: accumulated });
            },
            onDone: (done) => {
              patchAssistant(assistantId, {
                provider: done.provider,
                flagged: done.flagged,
              });
            },
          },
          controller.signal,
        );
      } catch (streamError) {
        if (streamError instanceof DOMException && streamError.name === "AbortError") {
          patchAssistant(assistantId, {
            content: accumulated ? `${accumulated}\n\n[stopped]` : "[stopped]",
            provider: "stopped",
          });
          return;
        }

        if (sawToken) {
          patchAssistant(assistantId, { content: accumulated, error: true });
          setError("The connection dropped before the answer finished.");
          return;
        }

        // Streaming failed before any token: use the non-streaming endpoint.
        try {
          const result = await postChat(request);
          patchAssistant(assistantId, {
            content: result.answer,
            sources: result.sources.length ? result.sources : sources,
            provider: result.provider,
            flagged: result.flagged,
            error: false,
          });
        } catch (fallbackError) {
          patchAssistant(assistantId, {
            content: "I couldn't reach the assistant. Please try again.",
            error: true,
            provider: "error",
          });
          setError(friendlyError(fallbackError));
        }
      } finally {
        activeRef.current = false;
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [patchAssistant],
  );

  const send = useCallback(
    (text: string) => {
      void run(text, messages);
    },
    [messages, run],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  }, []);

  const retry = useCallback(() => {
    if (activeRef.current) return;
    const index = messages.map((message) => message.role).lastIndexOf("user");
    if (index < 0) return;
    void run(messages[index].content, messages.slice(0, index));
  }, [messages, run]);

  const lastMessage = messages[messages.length - 1];
  const isThinking =
    isStreaming && lastMessage?.role === "assistant" && lastMessage.content.length === 0;

  return {
    messages,
    isStreaming,
    isThinking,
    error,
    send,
    stop,
    clear,
    retry,
  };
}
