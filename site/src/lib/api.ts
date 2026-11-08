import type {
  ChatResponse,
  ChatSource,
  ChatSuggestions,
  ContactPayload,
  ProjectDetail,
  SitePayload,
} from "@/types";

export const API_BASE = (
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  retryAfter: number | null;

  constructor(message: string, status: number, retryAfter: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function messageFrom(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    for (const value of Object.values(record)) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }
  return "Something went wrong. Please try again.";
}

async function toApiError(response: Response): Promise<ApiError> {
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfter =
    data && typeof data === "object" && "retry_after" in data
      ? Number((data as { retry_after: unknown }).retry_after)
      : retryAfterHeader
        ? Number(retryAfterHeader)
        : null;

  return new ApiError(
    messageFrom(data),
    response.status,
    Number.isFinite(retryAfter) ? retryAfter : null,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Cannot reach the portfolio API. Check that the Django server is running.",
      0,
    );
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function fetchSite(): Promise<SitePayload> {
  return request<SitePayload>("/site/");
}

export function fetchProject(slug: string): Promise<ProjectDetail> {
  return request<ProjectDetail>(`/projects/${encodeURIComponent(slug)}/`);
}

export function fetchChatSuggestions(): Promise<ChatSuggestions> {
  return request<ChatSuggestions>("/chat/suggestions/");
}

export async function sendContact(payload: ContactPayload): Promise<{ message: string }> {
  return request<{ message: string }>("/contact/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestPayload {
  message: string;
  history: ChatTurn[];
  session_id: string;
}

export function postChat(payload: ChatRequestPayload): Promise<ChatResponse> {
  return request<ChatResponse>("/chat/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface StreamMeta {
  sources: ChatSource[];
  session_id: string;
  flagged: boolean;
}

export interface StreamDone {
  provider: string;
  latency_ms: number;
  flagged: boolean;
}

export interface StreamHandlers {
  onMeta?: (meta: StreamMeta) => void;
  onDelta?: (text: string) => void;
  onDone?: (done: StreamDone) => void;
}

export class StreamError extends Error {}

/** POST a question and consume the server-sent event stream. */
export async function streamChat(
  payload: ChatRequestPayload,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat/stream/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new StreamError("Cannot reach the assistant right now.");
  }

  if (!response.ok) throw await toApiError(response);
  if (!response.body) throw new StreamError("The assistant returned an empty stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;

  const handleEvent = (raw: string) => {
    const lines = raw.split(/\r?\n/);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;

    let data: unknown;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }

    if (event === "meta") handlers.onMeta?.(data as StreamMeta);
    else if (event === "delta") {
      const text = (data as { text?: string }).text;
      if (text) handlers.onDelta?.(text);
    } else if (event === "done") {
      sawDone = true;
      handlers.onDone?.(data as StreamDone);
    } else if (event === "error") {
      throw new StreamError(
        (data as { message?: string }).message ??
          "The assistant hit an error. Please try again.",
      );
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (part.trim()) handleEvent(part);
      }
    }
    if (buffer.trim()) handleEvent(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!sawDone) {
    throw new StreamError("The connection ended before the answer finished.");
  }
}
