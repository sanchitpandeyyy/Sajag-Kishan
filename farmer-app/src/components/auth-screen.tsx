import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LangSwitch } from "@/components/ui";
import { useLang } from "@/lib/i18n";
import { theme } from "@/theme";

export function AuthScreen({ title, subtitle, icon, children }: { title: string; subtitle: string; icon?: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const { tr } = useLang();
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <View style={styles.top}>
            <View style={styles.brand}>
              <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandName}>{tr("कृषि दृष्टि", "Krishi Dristi")}</Text>
            </View>
            <LangSwitch />
          </View>
          <View style={styles.head}>
            {icon ? <Ionicons name={icon} size={56} color={theme.colors.brand[800]} /> : null}
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.page },
  scroll: { flexGrow: 1, padding: theme.space.lg, gap: theme.space.xxl },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: theme.space.sm },
  brand: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  logo: { width: 40, height: 40 },
  brandName: { fontFamily: theme.font.heading, ...theme.type.h3, color: theme.colors.brand[800] },
  head: { gap: theme.space.xs, marginTop: theme.space.xxl },
  title: { fontFamily: theme.font.heading, ...theme.type.display, color: theme.colors.ink },
  subtitle: { fontFamily: theme.font.body, ...theme.type.body, color: theme.colors.inkMuted },
  card: {
    padding: theme.space.xl,
    gap: theme.space.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    ...theme.shadow,
  },
});
