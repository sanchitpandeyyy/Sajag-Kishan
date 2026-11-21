/** The farmer app's single API client. Auth comes from the Better Auth session cookie. */
import { API_URL, authHeaders } from "./auth-client";
import { showToast } from "./toast";

/** fetch that turns "no reply" into a readable error and shows it as a toast. */
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
    // The cookie is sent explicitly from SecureStore; don't let fetch add or drop cookies.
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
  return res.json() as Promise<T>;
}

/** Multipart upload (React Native fills in the multipart boundary). */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await send(path, { method: "POST", body: form, credentials: "omit", headers: await authHeaders() });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { messageNe?: string; error?: string };
    const msg = body.messageNe ?? body.error ?? `HTTP ${res.status}`;
    showToast(`${path}: ${msg}`);
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
