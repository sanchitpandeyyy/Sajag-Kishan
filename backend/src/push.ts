/** Expo Push API (free). https://docs.expo.dev/push-notifications/sending-notifications/ */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: "default" | "normal" | "high";
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPush(messages: PushMessage[]): Promise<boolean> {
  let ok = true;
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100).map((m) => ({ ...m, sound: "default", channelId: "alerts" }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) ok = false;
    } catch {
      ok = false;
    }
  }
  return ok;
}
