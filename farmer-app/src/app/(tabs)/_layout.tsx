import Ionicons from "@expo/vector-icons/Ionicons";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { registerForPush } from "@/lib/push";
import { theme } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

export default function TabsLayout() {
  const { tr } = useLang();
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    void registerForPush();
  }, []);
  useEffect(() => {
    const screen = response?.notification.request.content.data?.screen;
    if (screen === "/calendar" || screen === "/alerts") router.navigate(screen);
  }, [response]);
  const icon = (name: IconName, active: IconName) =>
    function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
      return <Ionicons name={focused ? active : name} size={26} color={typeof color === "string" ? color : undefined} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.colors.brand[800],
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarLabelStyle: { fontFamily: theme.font.bodyBold, fontSize: 13 },
        tabBarStyle: { height: 68, paddingTop: 6, paddingBottom: 10, borderTopColor: theme.colors.line, backgroundColor: theme.colors.white },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr("गृह", "Home"), tabBarIcon: icon("home-outline", "home") }} />
      <Tabs.Screen name="calendar" options={{ title: tr("पात्रो", "Calendar"), tabBarIcon: icon("calendar-outline", "calendar") }} />
      <Tabs.Screen name="fields" options={{ title: tr("मेरो खेत", "My fields"), tabBarIcon: icon("leaf-outline", "leaf") }} />
      <Tabs.Screen name="ask" options={{ title: tr("सोध्नुहोस्", "Ask"), tabBarIcon: icon("mic-outline", "mic") }} />
      <Tabs.Screen name="alerts"options={{ title: tr("सूचना", "Alerts"), tabBarIcon: icon("notifications-outline", "notifications") }} />
    </Tabs>
  );
}
