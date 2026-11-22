import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLang } from "@/lib/i18n";
import { theme } from "@/theme";

const c = theme.colors;

export function Screen({
  title,
  subtitle,
  headerRight,
  children,
  refreshing = false,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brand[800]} /> : undefined}
      >
        <BrandRow right={<LangSwitch />} />
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { flexShrink: 1 }]} numberOfLines={1}>
              {title}
            </Text>
            {headerRight}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function BrandRow({ right }: { right?: React.ReactNode }) {
  const { tr } = useLang();
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandLeft}>
        <Image source={require("../../assets/icon.png")} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.brandName}>{tr("कृषि दृष्टि", "Krishi Drishti")}</Text>
      </View>
      <View style={styles.brandRight}>
        {right}
        <Pressable onPress={() => router.push("/settings")} hitSlop={8} accessibilityRole="button" accessibilityLabel={tr("सेटिङ", "Settings")} style={styles.gear}>
          <Ionicons name="settings-outline" size={22} color={c.ink} />
        </Pressable>
      </View>
    </View>
  );
}

export type IconName = keyof typeof Ionicons.glyphMap;

export function IconTile({ name, size = 44, color = c.brand[800] }: { name: IconName; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: theme.radii.md, backgroundColor: c.fill, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={name} size={Math.round(size * 0.55)} color={color} />
    </View>
  );
}

export function Card({ title, icon, action, children, style }: { title?: string; icon?: IconName; action?: React.ReactNode; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      {title || action ? (
        <View style={styles.cardHead}>
          {title ? (
            <View style={styles.cardTitleRow}>
              {icon ? <Ionicons name={icon} size={26} color={c.brand[800]} /> : null}
              <Text style={styles.cardTitle}>{title}</Text>
            </View>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  busy,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "brand";
  busy?: boolean;
  disabled?: boolean;
}) {
  const v = variant === "primary" ? styles.btnPrimary : variant === "brand" ? styles.btnBrand : styles.btnSecondary;
  const t = variant === "brand" ? styles.btnTextLight : styles.btnTextDark;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, v, pressed && { opacity: 0.85 }, (busy || disabled) && { opacity: 0.6 }]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "brand" ? c.white : c.ink} />
      ) : (
        <View style={styles.btnInner}>
          {icon ? <Ionicons name={icon} size={24} color={variant === "brand" ? c.white : c.ink} /> : null}
          <Text style={[styles.btnText, t]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function TextLink({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={12}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

export function Row({ label, value, sub, last, icon }: { label: string; value?: string; sub?: string; last?: boolean; icon?: IconName }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      {icon ? <IconTile name={icon} size={40} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </View>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Body({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <Text style={[styles.body, bold && { fontFamily: theme.font.bodyBold, color: c.ink }]}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 24 }}>
      <ActivityIndicator color={c.brand[800]} />
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <View style={styles.seg} accessibilityRole="radiogroup">
      {(
        [
          ["ne", "NP", "नेपाली"],
          ["en", "EN", "English"],
        ] as const
      ).map(([code, label, full]) => (
        <Pressable
          key={code}
          accessibilityLabel={full}
          accessibilityRole="radio"
          accessibilityState={{ selected: lang === code }}
          onPress={() => setLang(code)}
          style={[styles.segItem, lang === code && styles.segActive]}
        >
          <Text style={[styles.segText, lang === code && styles.segTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.page },
  scroll: { paddingHorizontal: theme.space.lg, paddingBottom: 40, gap: theme.space.lg },
  header: { gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontFamily: theme.font.heading, ...theme.type.h1, color: c.ink },
  subtitle: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },

  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: theme.space.md },
  brandLeft: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  brandLogo: { width: 36, height: 36 },
  brandRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  gear: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: c.white, borderWidth: 1, borderColor: c.line },
  brandName: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.brand[800] },

  card: { backgroundColor: c.surface, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.line, padding: theme.space.lg, gap: theme.space.md, ...theme.shadow },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.space.md },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  cardTitle: { fontFamily: theme.font.headingMedium, ...theme.type.h3, color: c.ink },

  btn: { minHeight: theme.touch, borderRadius: theme.radii.md, paddingHorizontal: theme.space.xl, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  btnPrimary: { backgroundColor: c.accent, borderColor: c.accent },
  btnBrand: { backgroundColor: c.brand[800], borderColor: c.brand[800] },
  btnSecondary: { backgroundColor: c.white, borderColor: c.inputBorder },
  btnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontFamily: theme.font.bodyBold, fontSize: 17 },
  btnTextDark: { color: c.ink },
  btnTextLight: { color: c.white },
  link: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.brand[700], textAlign: "center" },

  row: { flexDirection: "row", alignItems: "center", gap: theme.space.md, paddingVertical: theme.space.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.line },
  rowLabel: { fontFamily: theme.font.bodyBold, ...theme.type.body, color: c.ink },
  rowSub: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  rowValue: { fontFamily: theme.font.headingMedium, ...theme.type.h3, color: c.ink },

  muted: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  body: { fontFamily: theme.font.body, ...theme.type.body, color: c.body },
  error: { fontFamily: theme.font.body, ...theme.type.small, color: c.danger },

  seg: { flexDirection: "row", borderWidth: 1, borderColor: c.line, borderRadius: 999, padding: 2, backgroundColor: c.white },
  segItem: { height: 28, minWidth: 36, paddingHorizontal: 8, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: c.brand[800] },
  segText: { fontFamily: theme.font.bodyBold, fontSize: 12, color: c.inkMuted },
  segTextActive: { color: c.white },
});
