import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { theme } from "@/theme";

export function Field({ label, icon, ...props }: TextInputProps & { label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {icon ? <Ionicons name={icon} size={24} color={theme.colors.inkMuted} /> : null}
        <TextInput placeholderTextColor={theme.colors.inkMuted} style={styles.input} accessibilityLabel={label} {...props} />
      </View>
    </View>
  );
}

export function PrimaryButton({ title, onPress, busy, icon }: { title: string; onPress: () => void; busy?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.cta, (pressed || busy) && { backgroundColor: theme.colors.accentStrong }]}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.ink} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {icon ? <Ionicons name={icon} size={26} color={theme.colors.ink} /> : null}
          <Text style={styles.ctaText}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

export function Message({ error, info }: { error?: string | null; info?: string | null }) {
  if (error) return <Text style={[styles.msg, { color: theme.colors.danger }]}>{error}</Text>;
  if (info) return <Text style={[styles.msg, { color: theme.colors.brand[700] }]}>{info}</Text>;
  return null;
}

const styles = StyleSheet.create({
  label: { fontFamily: theme.font.bodyBold, fontSize: 16, color: theme.colors.ink },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: theme.touch,
    backgroundColor: theme.colors.white,
    borderWidth: 1.5,
    borderColor: theme.colors.inputBorder,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
  },
  input: { flex: 1, fontFamily: theme.font.body, fontSize: 18, color: theme.colors.ink, minHeight: theme.touch - 4 },
  cta: { backgroundColor: theme.colors.accent, borderRadius: theme.radii.md, minHeight: theme.touch, justifyContent: "center", alignItems: "center" },
  ctaText: { fontFamily: theme.font.bodyBold, fontSize: 17, color: theme.colors.ink },
  link: { fontFamily: theme.font.bodyBold, fontSize: 15, color: theme.colors.brand[700], textAlign: "center" },
  msg: { fontFamily: theme.font.body, fontSize: 15 },
});
