import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang } from "@/lib/i18n";
import { useOnline } from "@/lib/network";
import { onOutboxChange, pendingCount } from "@/lib/outbox";
import { theme } from "@/theme";

/** Shown while the phone is offline: the app keeps working from saved data. */
export function OfflineBanner() {
  const online = useOnline();
  const { tr } = useLang();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    void pendingCount().then(setPending);
    return onOutboxChange(setPending);
  }, []);

  if (online && pending === 0) return null;
  const digits = (n: number) => tr(String(n).replace(/[0-9]/g, (d) => "०१२३४५६७८९"[Number(d)]!), String(n));
  const text = !online
    ? tr("इन्टरनेट छैन। पहिले सुरक्षित गरिएको जानकारी देखाइँदैछ।", "No internet. Showing saved information.")
    : tr("इन्टरनेट आयो, बाँकी काम पठाउँदै…", "Back online, sending saved changes…");

  return (
    <View pointerEvents="none" style={[styles.wrap, { paddingTop: insets.top + 6 }, online ? styles.syncing : styles.offline]}>
      <Ionicons name={online ? "cloud-upload-outline" : "cloud-offline-outline"} size={20} color={theme.colors.white} />
      <Text style={styles.text} numberOfLines={2}>
        {text}
        {pending > 0 ? tr(` पठाउन बाँकी: ${digits(pending)}`, ` Waiting to send: ${pending}`) : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 900, elevation: 900, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  offline: { backgroundColor: theme.colors.ink },
  syncing: { backgroundColor: theme.colors.brand[800] },
  text: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 14, lineHeight: 19, color: theme.colors.white },
});
