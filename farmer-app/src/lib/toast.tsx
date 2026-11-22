import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/theme";

type Kind = "error" | "info";
interface ToastItem {
  id: number;
  text: string;
  kind: Kind;
}

let counter = 0;
let last: { text: string; at: number } | null = null;
const listeners = new Set<(t: ToastItem) => void>();

export function showToast(text: string, kind: Kind = "error") {
  const now = Date.now();
  if (last && last.text === text && now - last.at < 3000) return;
  last = { text, at: now };
  console.warn(`[toast:${kind}] ${text}`);
  const item = { id: ++counter, text, kind };
  listeners.forEach((l) => l(item));
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ToastItem | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setItem(null));
  };

  useEffect(() => {
    const on = (t: ToastItem) => {
      if (timer.current) clearTimeout(timer.current);
      setItem(t);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(hide, t.kind === "error" ? 6000 : 3500);
    };
    listeners.add(on);
    return () => {
      listeners.delete(on);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!item) return null;
  const error = item.kind === "error";
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8, opacity }]}>
      <Pressable onPress={hide} accessibilityRole="alert" style={styles.toast}>
        <Ionicons name={error ? "alert-circle" : "information-circle"} size={26} color={error ? "#FF6B7F" : theme.colors.brand[300]} />
        <Text style={styles.text} numberOfLines={4}>
          {item.text}
        </Text>
        <Ionicons name="close" size={20} color={theme.colors.line} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, zIndex: 1000, elevation: 1000 },
  toast: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: theme.radii.md, backgroundColor: theme.colors.ink, ...theme.shadow, shadowOpacity: 0.25 },
  text: { flex: 1, fontFamily: theme.font.bodyBold, fontSize: 15, lineHeight: 21, color: theme.colors.white },
});
