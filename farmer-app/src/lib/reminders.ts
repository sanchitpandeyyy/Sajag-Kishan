import { ensureChannel } from "./channel";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { TASK_EN } from "./farm";
import type { Lang } from "./i18n";
import type { Alert, CalendarEvent } from "./use-data";

const CHANNEL = "reminders";
const ENABLED_KEY = "sajagkishan.reminders";
const NOTIFIED_KEY = "sajagkishan.alertsNotified";
const TASK_PREFIX = "task:";
const REMIND_HOUR = 7;
const MAX_TASKS = 20;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function remindersEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ENABLED_KEY).catch(() => null)) !== "off";
}

export async function setRemindersEnabled(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(ENABLED_KEY, on ? "on" : "off").catch(() => undefined);
  if (!on) await cancelTaskReminders();
}

export async function prepareReminders(): Promise<boolean> {
  await ensureChannel(CHANNEL, "Reminders / सम्झना", [0, 600, 300, 600, 300, 600]);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function cancelTaskReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(TASK_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

export async function scheduleTaskReminders(events: CalendarEvent[], lang: Lang): Promise<number> {
  if (!(await remindersEnabled())) return 0;
  await cancelTaskReminders();
  const now = new Date();
  const upcoming = events
    .map((e) => ({ e, at: new Date(`${e.startsOn.slice(0, 10)}T${String(REMIND_HOUR).padStart(2, "0")}:00:00`) }))
    .filter(({ at }) => at > now)
    .slice(0, MAX_TASKS);

  for (const { e, at } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${TASK_PREFIX}${e.crop}:${e.task}:${e.startsOn.slice(0, 10)}`,
      content: {
        title: lang === "ne" ? `आज: ${e.titleNe}` : `Today: ${TASK_EN[e.task] ?? e.titleNe}`,
        body: lang === "ne" ? "कृषि दृष्टि पात्रो" : "Krishi Drishti calendar",
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { screen: "/calendar" },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
  return upcoming.length;
}

export async function notifyNewDangerAlerts(alerts: Alert[], lang: Lang): Promise<void> {
  if (!(await remindersEnabled())) return;
  const danger = alerts.filter((a) => a.severity === "SEVERE" || a.type === "LATE_BLIGHT" || a.type === "RICE_BLAST");
  if (!danger.length) return;
  const seen = new Set<string>(JSON.parse((await SecureStore.getItemAsync(NOTIFIED_KEY).catch(() => null)) ?? "[]"));
  for (const a of danger) {
    if (seen.has(a.id)) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: lang === "ne" ? `खतरा: ${a.titleNe}` : `Danger: ${a.titleNe}`,
        body: a.messageNe,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { screen: "/alerts" },
      },
      trigger: Platform.OS === "android" ? { channelId: CHANNEL } : null,
    });
    seen.add(a.id);
  }
  await SecureStore.setItemAsync(NOTIFIED_KEY, JSON.stringify([...seen].slice(-50))).catch(() => undefined);
}
