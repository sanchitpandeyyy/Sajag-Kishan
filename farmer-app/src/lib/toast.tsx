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
let pending: ToastItem | null = null;
const listeners = new Set<(t: ToastItem) => void>();

export function showToast(text: string, kind: Kind = "error") {
  const now = Date.now();
  if (last && last.text === text && now - last.at < 3000) return;
  last = { text, at: now };
  console.log(`[toast:${kind}] ${text}`);
  const item = { id: ++counter, text, kind };
  if (listeners.size === 0) pending = item;
  else listeners.forEach((l) => l(item));
}

/** An error the API layer already handled (toasted, or deliberately silent for 404s); reportError skips it. */
export class ToastedError extends Error {}

export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/** Toast an unexpected error with where it happened, unless it was already toasted. */
export function reportError(where: string, e: unknown) {
  if (e instanceof ToastedError) return;
  console.log(`[${where}]`, e);
  showToast(`${where}: ${errorText(e)}`);
}

let globalInstalled = false;

/** Toast uncaught JS errors and unhandled promise rejections (release builds swallow them silently). */
export function installGlobalErrorToasts() {
  if (globalInstalled) return;
  globalInstalled = true;

  type Handler = (e: unknown, fatal?: boolean) => void;
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler?: () => Handler | undefined; setGlobalHandler?: (h: Handler) => void };
    HermesInternal?: { enablePromiseRejectionTracker?: (o: { allRejections: boolean; onUnhandled: (id: number, e: unknown) => void }) => void };
  };

  // Error tracking is optional: never let it break app start-up.
  try {
    const eu = g.ErrorUtils;
    if (eu && typeof eu.setGlobalHandler === "function") {
      const prev = typeof eu.getGlobalHandler === "function" ? eu.getGlobalHandler() : undefined;
      eu.setGlobalHandler((e, fatal) => {
        try {
          // Development hot-reload hiccups ("[Refresh] ...") aren't app errors; a full reload clears them.
          const devReload = __DEV__ && /^\[Refresh\]/.test(errorText(e));
          if (!devReload) reportError(fatal ? "Crash" : "Error", e);
        } catch {}
        if (typeof prev === "function") prev(e, fatal);
      });
    }
  } catch (e) {
    console.log("[toast] global error handler not installed", e);
  }

  try {
    const track = g.HermesInternal?.enablePromiseRejectionTracker;
    if (!__DEV__ && typeof track === "function") {
      track({ allRejections: true, onUnhandled: (_id, e) => reportError("Unhandled", e) });
    }
  } catch (e) {
    console.log("[toast] rejection tracker not installed", e);
  }
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
    if (pending) {
      on(pending);
      pending = null;
    }
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
