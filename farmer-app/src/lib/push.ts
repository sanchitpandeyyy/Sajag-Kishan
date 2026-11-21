import { ensureChannel } from "./channel";
/**
 * Remote push: alerts reach the farmer even when the app is closed and nothing is scheduled.
 * The backend's hourly alert job sends to every token registered here (Expo Push API, free).
 *
 * Needs a development or release build: Expo Go on Android has no remote push since SDK 53.
 * Local alarms (reminders.ts) keep working everywhere.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api } from "./api";

/** Must match `channelId` in backend/src/push.ts. */
const ALERT_CHANNEL = "alerts";
const SENT_KEY = "sajagkishan.pushToken";

export type PushState = "registered" | "denied" | "unsupported" | "failed";

export async function registerForPush(): Promise<PushState> {
  if (!Device.isDevice || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return "unsupported";
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return "unsupported";

  try {
    // Android 13+: the channel must exist before a token can be issued.
    await ensureChannel(ALERT_CHANNEL, "Alerts / चेतावनी", [0, 500, 250, 500]);

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return "denied";

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    // Only call the API when the token is new for this phone.
    if ((await SecureStore.getItemAsync(SENT_KEY).catch(() => null)) === token) return "registered";
    await api("/v1/push/register", { method: "POST", body: JSON.stringify({ token, platform: Platform.OS === "ios" ? "ios" : "android" }) });
    await SecureStore.setItemAsync(SENT_KEY, token).catch(() => undefined);
    return "registered";
  } catch {
    return "failed";
  }
}
