/** Settings: alarms, voice, language, account. One screen, big switches, plain words. */
import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, IconTile, LangSwitch, type IconName } from "@/components/ui";
import { API_URL, signOut } from "@/lib/auth-client";
import { useLang } from "@/lib/i18n";
import { useSpeakReplies } from "@/lib/prefs";
import { prepareReminders, remindersEnabled, setRemindersEnabled } from "@/lib/reminders";
import { useData, type Me } from "@/lib/use-data";
import { theme } from "@/theme";

const c = theme.colors;

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function Item({ icon, label, sub, right, last, onPress }: { icon: IconName; label: string; sub?: string; right?: React.ReactNode; last?: boolean; onPress?: () => void }) {
  const body = (
    <View style={[styles.item, !last && styles.itemDivider]}>
      <IconTile name={icon} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={styles.itemLabel}>{label}</Text>
        {sub ? <Text style={styles.itemSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.7 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export default function Settings() {
  const { tr } = useLang();
  const me = useData<Me>("/v1/me");
  const [alarm, setAlarm] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [speakOn, setSpeakOn] = useSpeakReplies();

  useEffect(() => {
    void remindersEnabled().then(setAlarm);
    void prepareReminders().then(setAllowed);
  }, []);

  async function toggleAlarm(on: boolean) {
    setAlarm(on);
    await setRemindersEnabled(on);
    if (on) setAllowed(await prepareReminders());
  }

  const track = { true: c.brand[700], false: c.line };
  const fullName = me.data?.farmer ? `${me.data.farmer.firstNameNe} ${me.data.farmer.lastNameNe ?? ""}`.trim() : (me.data?.name ?? "");

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr("पछाडि", "Back")} style={styles.back}>
          <Ionicons name="arrow-back" size={26} color={c.ink} />
        </Pressable>
        <Text style={styles.title}>{tr("सेटिङ", "Settings")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profile}>
          <IconTile name="person" size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{fullName}</Text>
            {me.data?.phoneNumber ? <Text style={styles.itemSub}>{me.data.phoneNumber}</Text> : null}
          </View>
        </View>

        <Group title={tr("सम्झना", "Reminders")}>
          <Item
            icon={alarm ? "alarm" : "alarm-outline"}
            label={tr("अलार्म", "Alarm")}
            sub={tr("काम सुरु हुने दिन बिहान ७ बजे र खतराको सूचनामा बज्छ", "Rings at 7 AM when a job starts, and for danger alerts")}
            right={<Switch value={alarm} onValueChange={toggleAlarm} trackColor={track} thumbColor={c.white} />}
            last={!(alarm && allowed === false)}
          />
          {alarm && allowed === false ? (
            <Item
              icon="settings-outline"
              label={tr("अनुमति चाहिन्छ", "Permission needed")}
              sub={tr("फोन सेटिङमा सूचना खोल्नुहोस्", "Turn on notifications in phone settings")}
              onPress={() => void Linking.openSettings()}
              right={<Ionicons name="chevron-forward" size={22} color={c.inkMuted} />}
              last
            />
          ) : null}
        </Group>

        <Group title={tr("आवाज", "Voice")}>
          <Item
            icon="volume-high-outline"
            label={tr("जवाफ सुनाउनुहोस्", "Read answers aloud")}
            sub={tr("सोध्नुहोस् मा जवाफ आफैँ पढिन्छ", "Ask reads the answer out in Nepali")}
            right={<Switch value={speakOn} onValueChange={setSpeakOn} trackColor={track} thumbColor={c.white} />}
            last
          />
        </Group>

        <Group title={tr("भाषा", "Language")}>
          <Item icon="language-outline" label={tr("भाषा छान्नुहोस्", "App language")} right={<LangSwitch />} last />
        </Group>

        <Group title={tr("एपबारे", "About")}>
          <Item icon="information-circle-outline" label={tr("संस्करण", "Version")} right={<Text style={styles.value}>{Constants.expoConfig?.version ?? ""}</Text>} />
          <Item icon="server-outline" label={tr("सर्भर", "Server")} sub={API_URL} last />
        </Group>

        <Button title={tr("बाहिर निस्कनुहोस्", "Sign out")} icon="log-out-outline" variant="secondary" onPress={() => void signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.page },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.white, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: theme.font.heading, ...theme.type.h1, color: c.ink },
  scroll: { paddingHorizontal: theme.space.lg, paddingBottom: 40, gap: theme.space.lg },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: c.white, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.line, padding: theme.space.lg, ...theme.shadow },
  profileName: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink },
  group: { gap: 8 },
  groupTitle: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.inkMuted, paddingHorizontal: 4 },
  groupBody: { backgroundColor: c.white, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.line, paddingHorizontal: theme.space.lg, ...theme.shadow },
  item: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 72, paddingVertical: 12 },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: c.line },
  itemLabel: { fontFamily: theme.font.bodyBold, ...theme.type.body, color: c.ink },
  itemSub: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  value: { fontFamily: theme.font.bodyBold, ...theme.type.body, color: c.ink },
});
