/** Thin typed client for the Django REST API with JWT refresh handling. */

const BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1").replace(
  /\/$/,
  "",
);

const ACCESS_KEY = "portfolio.admin.access";
const REFRESH_KEY = "portfolio.admin.refresh";

export const UNAUTHORIZED_EVENT = "portfolio:unauthorized";

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser: boolean;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class ApiError extends Error {
  status: number;
  details: Record<string, string[]> | null;

  constructor(status: number, message: string, details: Record<string, string[]> | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

function normalizeErrors(payload: unknown): { message: string; details: Record<string, string[]> | null } {
  if (!payload || typeof payload !== "object") {
    return { message: "Something went wrong. Please try again.", details: null };
  }
  const data = payload as Record<string, unknown>;
  if (typeof data.detail === "string") {
    return { message: data.detail, details: null };
  }
  const details: Record<string, string[]> = {};
  const parts: string[] = [];
  for (const [field, value] of Object.entries(data)) {
    const list = Array.isArray(value) ? value.map(String) : [String(value)];
    details[field] = list;
    parts.push(`${field === "non_field_errors" ? "" : `${field}: `}${list.join(" ")}`);
  }
  return { message: parts.join(" · ") || "Request failed.", details };
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = tokens.refresh;
  if (!refresh) return false;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${BASE}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as { access?: string; refresh?: string };
      if (!data.access) return false;
      tokens.set(data.access, data.refresh);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function send(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  const access = tokens.access;
  if (access) headers.set("Authorization", `Bearer ${access}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE}${path}`, { ...init, headers });

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccess();
    if (refreshed) return send(path, init, false);
    tokens.clear();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  return response;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const { message, details } = normalizeErrors(payload);
    throw new ApiError(response.status, message, details);
  }
  return payload as T;
}

function json(body: unknown): RequestInit {
  return { body: JSON.stringify(body) };
}

export const api = {
  base: BASE,

  async login(username: string, password: string) {
    const response = await send("/auth/token/", {
      method: "POST",
      ...json({ username, password }),
    });
    const data = await parse<{ access: string; refresh: string; user: ApiUser }>(response);
    tokens.set(data.access, data.refresh);
    return data.user;
  },

  async me() {
    const response = await send("/auth/me/");
    return parse<ApiUser>(response);
  },

  /** Revoke the refresh token server-side, then clear local storage. */
  async logout() {
    const refresh = tokens.refresh;
    tokens.clear();
    if (!refresh) return;
    try {
      await fetch(`${BASE}/auth/logout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
    } catch {
      // Offline logout still clears the browser session.
    }
  },

  async get<T>(path: string) {
    return parse<T>(await send(path));
  },

  async list<T>(path: string, params: Record<string, string | number | undefined> = {}) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return parse<Paginated<T>>(await send(`${path}${suffix}`));
  },

  async create<T>(path: string, body: unknown) {
    return parse<T>(await send(path, { method: "POST", ...json(body) }));
  },

  async post<T>(path: string, body: unknown = {}) {
    return parse<T>(await send(path, { method: "POST", ...json(body) }));
  },

  async update<T>(path: string, id: number | string, body: unknown) {
    return parse<T>(await send(`${path}${id}/`, { method: "PATCH", ...json(body) }));
  },

  async updateTo<T>(path: string, body: unknown) {
    return parse<T>(await send(path, { method: "PATCH", ...json(body) }));
  },

  async createMultipart<T>(path: string, body: FormData) {
    return parse<T>(await send(path, { method: "POST", body }));
  },

  async remove(path: string, id: number | string) {
    await parse<void>(await send(`${path}${id}/`, { method: "DELETE" }));
  },

  async upload<T>(path: string, id: number | string, field: string, file: File) {
    const body = new FormData();
    body.append(field, file);
    return parse<T>(await send(`${path}${id}/`, { method: "PATCH", body }));
  },

  async uploadTo<T>(path: string, field: string, file: File) {
    const body = new FormData();
    body.append(field, file);
    return parse<T>(await send(path, { method: "PATCH", body }));
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unexpected error.";
}
