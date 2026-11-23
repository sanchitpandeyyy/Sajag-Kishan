import { API_URL, authHeaders } from "./auth-client";
import { markAllStale } from "./data-cache";
import { isOnline, noteRequestResult } from "./network";
import { enqueue, flushOutbox, setOutboxSender } from "./outbox";
import { showToast, ToastedError } from "./toast";

/** The phone couldn't reach the server. Not toasted: the offline banner already says so. */
export class OfflineError extends ToastedError {}

export interface ApiInit extends RequestInit {
  /** For writes: if offline, save the change and send it when the internet is back. */
  queueOffline?: boolean;
}

/** What api() returns for a write that was saved for later instead of sent. */
export interface Queued {
  queued: true;
}
export const isQueued = (v: unknown): v is Queued => !!v && typeof v === "object" && (v as Queued).queued === true;

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${API_URL}${path}`, init);
    noteRequestResult(true);
    return res;
  } catch {
    noteRequestResult(false);
    throw new OfflineError(`Cannot reach the server: ${API_URL}`);
  }
}

async function fail(path: string, res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { messageNe?: string; error?: string };
  const msg = body.messageNe ?? body.error ?? `HTTP ${res.status}`;
  if (res.status !== 404) showToast(`${path.split("?")[0]}: ${msg}`); // unavailable feature: stay quiet
  throw new ToastedError(msg);
}

export async function api<T>(path: string, init?: ApiInit): Promise<T> {
  const { queueOffline, ...rest } = init ?? {};
  const method = (rest.method ?? "GET").toUpperCase();
  const canQueue = queueOffline && method !== "GET" && (rest.body == null || typeof rest.body === "string");
  const queue = async () => {
    await enqueue({ path, method, body: rest.body as string | undefined });
    showToast("इन्टरनेट आएपछि आफैँ पठाइनेछ। / Saved; it will be sent when the internet is back.", "info");
    return { queued: true } as T;
  };
  if (canQueue && !isOnline()) return queue();

  let res: Response;
  try {
    res = await send(path, {
      ...rest,
      credentials: "omit",
      headers: {
        "content-type": "application/json",
        ...(await authHeaders()),
        ...rest.headers,
      },
    });
  } catch (e) {
    if (canQueue && e instanceof OfflineError) return queue();
    throw e;
  }
  if (!res.ok) return fail(path, res);
  if (method !== "GET") markAllStale();
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await send(path, { method: "POST", body: form, credentials: "omit", headers: await authHeaders() });
  if (!res.ok) return fail(path, res);
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

setOutboxSender(async (req) => {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${req.path}`, {
      method: req.method,
      body: req.body,
      credentials: "omit",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
    });
  } catch {
    noteRequestResult(false);
    return "offline";
  }
  noteRequestResult(true);
  if (res.ok) {
    markAllStale();
    return "sent";
  }
  if (res.status >= 500 || res.status === 401 || res.status === 429) return "offline"; // try again later
  const body = (await res.json().catch(() => ({}))) as { messageNe?: string; error?: string };
  showToast(`${req.path.split("?")[0]}: ${body.messageNe ?? body.error ?? `HTTP ${res.status}`}`);
  return "rejected";
});

// Send anything left over from a previous offline session.
setTimeout(() => void flushOutbox(), 5000);
