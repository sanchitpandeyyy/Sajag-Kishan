import { API_URL, authHeaders } from "./auth-client";
import { markAllStale } from "./data-cache";
import { showToast } from "./toast";

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    const msg = `Cannot reach the server: ${API_URL}`;
    showToast(msg);
    throw new Error(msg);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, {
    ...init,
    credentials: "omit",
    headers: {
      "content-type": "application/json",
      ...(await authHeaders()),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { messageNe?: string; error?: string };
    const msg = body.messageNe ?? body.error ?? `HTTP ${res.status}`;
    showToast(`${path.split("?")[0]}: ${msg}`);
    throw new Error(msg);
  }
  if (init?.method && init.method !== "GET") markAllStale();
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await send(path, { method: "POST", body: form, credentials: "omit", headers: await authHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { messageNe?: string; error?: string };
    const msg = body.messageNe ?? body.error ?? `HTTP ${res.status}`;
    showToast(`${path}: ${msg}`);
    throw new Error(msg);
  }
  markAllStale();
  return res.json() as Promise<T>;
}

export async function apiQuiet(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "omit",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(body),
    });
  } catch {
  }
}
