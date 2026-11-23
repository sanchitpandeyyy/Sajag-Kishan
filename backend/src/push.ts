export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: "default" | "normal" | "high";
}

export interface PushResult {
  to: string;
  ok: boolean;
  error?: string;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type Ticket = { status: "ok" | "error"; details?: { error?: string }; message?: string };

export async function sendPush(messages: PushMessage[]): Promise<PushResult[]> {
  const results: PushResult[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(batch.map((m) => ({ ...m, sound: "default", channelId: "alerts" }))),
        signal: AbortSignal.timeout(20_000),
      });
      const json = res.ok ? ((await res.json().catch(() => null)) as { data?: Ticket[] } | null) : null;
      batch.forEach((m, j) => {
        const t = json?.data?.[j];
        if (!res.ok) results.push({ to: m.to, ok: false, error: `http_${res.status}` });
        else if (!t) results.push({ to: m.to, ok: false, error: "no_ticket" });
        else if (t.status === "ok") results.push({ to: m.to, ok: true });
        else results.push({ to: m.to, ok: false, error: t.details?.error ?? t.message ?? "error" });
      });
    } catch (e) {
      for (const m of batch) results.push({ to: m.to, ok: false, error: e instanceof Error ? e.name : "network" });
    }
  }
  return results;
}

export function deadTokens(results: PushResult[]): string[] {
  return results.filter((r) => r.error === "DeviceNotRegistered").map((r) => r.to);
}
