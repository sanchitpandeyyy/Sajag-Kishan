import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Create an Android channel. Never throws: some devices/Expo Go reject the extra options, so retry with the minimum. */
export async function ensureChannel(id: string, name: string, vibrationPattern: number[]): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(id, {
      name,
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern,
      enableVibrate: true,
    });
  } catch {
    try {
      await Notifications.setNotificationChannelAsync(id, { name, importance: Notifications.AndroidImportance.HIGH });
    } catch {
      /* channel unavailable; notifications fall back to the default channel */
    }
  }
}
