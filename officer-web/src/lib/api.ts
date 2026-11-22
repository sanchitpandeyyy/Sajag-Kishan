/** The officer app's single API client. Calls go through the /api rewrite (same origin). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401 && typeof window !== "undefined" && !["/", "/login"].includes(window.location.pathname)) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { messageNe?: string; error?: string };
    throw new ApiError(body.messageNe ?? body.error ?? `HTTP ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

/** JSON request. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  return handle<T>(res);
}

/** Multipart upload (the browser sets the multipart boundary header). */
export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", body: form, credentials: "include" });
  return handle<T>(res);
}
