/** Home: today at a glance (weather, next job, subsidy), then big shortcuts to everything else. */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, IconTile, Loading, Muted, Screen, type IconName } from "@/components/ui";
import { dateText, isActiveOrUpcoming, TASK_EN } from "@/lib/farm";
import { useLang } from "@/lib/i18n";
import { notifyNewDangerAlerts, prepareReminders, remindersEnabled, scheduleTaskReminders } from "@/lib/reminders";
import { useData, type Advisory, type Alert, type Allocation, type CalendarResponse, type Me, type OpenScheme, type Parcel } from "@/lib/use-data";
import { theme } from "@/theme";

const c = theme.colors;

export default function Home() {
  const { tr, lang, num } = useLang();
  const me = useData<Me>("/v1/me");
  const parcels = useData<Parcel[]>("/v1/parcels");
  const feed = useData<{ alerts: Alert[]; advisories: Advisory[] }>("/v1/alerts");
  const subsidy = useData<Allocation[]>("/v1/subsidies/mine");
  const openSchemes = useData<OpenScheme[]>("/v1/subsidies/open");
  const first = parcels.data?.[0];
  const calendar = useData<CalendarResponse>(first ? `/v1/calendar?parcelId=${first.id}` : null);

  const [remind, setRemind] = useState(true);
  const [permission, setPermission] = useState<boolean | null>(null);

  // The alarm switch lives in Settings; pick up changes whenever Home is shown again.
  useFocusEffect(
    useCallback(() => {
      void remindersEnabled().then(setRemind);
      void prepareReminders().then(setPermission);
    }, []),
  );

  // Keep phone alarms in step with the calendar and alerts.
  useEffect(() => {
    if (remind && permission && calendar.data) void scheduleTaskReminders(calendar.data.events, lang);
  }, [remind, permission, calendar.data, lang]);
  useEffect(() => {
    if (remind && permission && feed.data) void notifyNewDangerAlerts(feed.data.alerts, lang);
  }, [remind, permission, feed.data, lang]);

  const refresh = () => {
    void me.refresh();
    void parcels.refresh();
    void feed.refresh();
    void calendar.refresh();
    void subsidy.refresh();
  };

  const name = me.data?.farmer?.firstNameNe ?? "";
  const alert = feed.data?.alerts.find((a) => a.severity === "SEVERE") ?? feed.data?.alerts[0];
  const severe = alert?.severity === "SEVERE";
  const next = useMemo(() => calendar.data?.events.find((e) => isActiveOrUpcoming(e.endsOn)), [calendar.data]);
  // Show the allocation still to come first; otherwise the latest one received.
  const sub = useMemo(() => subsidy.data?.find((a) => a.status !== "DELIVERED") ?? subsidy.data?.[0], [subsidy.data]);
  const subGot = sub?.status === "DELIVERED";
  const today = dateText(new Date().toISOString().slice(0, 10), lang);

  const tiles: { href: "/calendar" | "/fields" | "/subsidy" | "/ask" | "/alerts" | "/settings"; icon: IconName; label: string }[] = [
    { href: "/calendar", icon: "calendar", label: tr("पात्रो", "Calendar") },
    { href: "/fields", icon: "leaf", label: tr("खेत", "Fields") },
    { href: "/subsidy", icon: "gift", label: tr("अनुदान", "Subsidy") },
    { href: "/ask", icon: "mic", label: tr("सोध्नुहोस्", "Ask") },
    { href: "/alerts", icon: "notifications", label: tr("सूचना", "Alerts") },
    { href: "/settings", icon: "settings", label: tr("सेटिङ", "Settings") },
  ];

  return (
    <Screen title={tr(`नमस्ते${name ? ` ${name}` : ""}`, `Hello${name ? ` ${name}` : ""}`)} headerRight={<DateChip text={today} />} refreshing={me.loading || feed.loading} onRefresh={refresh}>
      <Text style={styles.section}>{tr("आज", "Today")}</Text>

      {/* Weather or danger */}
      <Pressable onPress={() => router.push("/alerts")} accessibilityRole="button">
        <Card style={severe ? { borderColor: c.danger } : undefined}>
          {feed.loading && !feed.data ? (
            <Loading />
          ) : (
            <View style={styles.row}>
              <IconTile name={!alert ? "sunny" : severe ? "warning" : "rainy"} size={56} color={!alert ? c.accentStrong : severe ? c.danger : c.warning} />
              <View style={styles.rowText}>
                <Text style={styles.caption}>{tr("मौसम", "Weather")}</Text>
                <Text style={styles.big} numberOfLines={2}>
                  {alert ? alert.titleNe : tr("मौसम ठीक छ", "Weather is fine")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={c.inkMuted} />
            </View>
          )}
        </Card>
      </Pressable>

      {/* Next job */}
      <Pressable onPress={() => router.push("/calendar")} accessibilityRole="button">
        <Card>
          {calendar.loading && !calendar.data ? (
            <Loading />
          ) : (
            <>
              <View style={styles.row}>
                <IconTile name={next ? "calendar" : "calendar-outline"} size={56} />
                <View style={styles.rowText}>
                  <Text style={styles.caption}>{tr("अर्को काम", "Next job")}</Text>
                  <Text style={styles.big} numberOfLines={2}>
                    {next ? (lang === "en" ? (TASK_EN[next.task] ?? next.titleNe) : next.titleNe) : tr("बाली छान्नुहोस्", "Choose a crop")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={c.inkMuted} />
              </View>
              {next ? (
                <View style={styles.strip}>
                  <Ionicons name="time-outline" size={20} color={c.inkMuted} />
                  <Text style={styles.stripText}>{dateText(next.startsOn, lang)}</Text>
                </View>
              ) : (
                <Muted>{tr("खेतमा बाली छानेपछि पात्रो बन्छ", "Your calendar appears once a crop is chosen")}</Muted>
              )}
            </>
          )}
        </Card>
      </Pressable>

      {/* Subsidy */}
      <Pressable onPress={() => router.push("/subsidy")} accessibilityRole="button">
        <Card>
          {subsidy.loading && !subsidy.data ? (
            <Loading />
          ) : (
            <View style={styles.row}>
              <IconTile name="gift" size={56} color={subGot ? c.brand[700] : c.accentStrong} />
              <View style={styles.rowText}>
                <Text style={styles.caption}>{tr("अनुदान", "Subsidy")}</Text>
                <Text style={styles.big} numberOfLines={2}>
                  {sub ? sub.scheme.name : openSchemes.data?.length ? tr(`${num(openSchemes.data.length)} कार्यक्रम खुला`, `${openSchemes.data.length} programmes open`) : tr("अहिलेसम्म छैन", "None yet")}
                </Text>
                {sub ? <Text style={[styles.state, { color: subGot ? c.brand[700] : c.warning }]}>{subGot ? tr("पाइयो", "Received") : tr("आउन बाँकी", "Coming")}</Text> : null}
              </View>
              {sub ? (
                <View style={styles.qtyBox}>
                  <Text style={styles.qty}>{num(sub.deliveredQty ?? sub.allocatedQty)}</Text>
                  <Text style={styles.unit}>{sub.scheme.unit}</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={24} color={c.inkMuted} />
              )}
            </View>
          )}
        </Card>
      </Pressable>

      <Text style={styles.section}>{tr("छिटो पहुँच", "Quick access")}</Text>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <Pressable key={t.label} onPress={() => router.push(t.href)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]} accessibilityRole="button" accessibilityLabel={t.label}>
            <IconTile name={t.icon} size={52} />
            <Text style={styles.tileText} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function DateChip({ text }: { text: string }) {
  return (
    <View style={styles.dateChip}>
      <Ionicons name="calendar-outline" size={16} color={c.inkMuted} />
      <Text style={styles.dateText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dateChip: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  dateText: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.inkMuted },
  section: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  rowText: { flex: 1, gap: 2 },
  caption: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.inkMuted },
  big: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink },
  state: { fontFamily: theme.font.bodyBold, ...theme.type.small },
  strip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.page, borderRadius: theme.radii.md, paddingVertical: 12, paddingHorizontal: 12 },
  stripText: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.body },
  qtyBox: { alignItems: "flex-end" },
  qty: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink },
  unit: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },

  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    flexBasis: "31%",
    flexGrow: 1,
    minHeight: 112,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 6,
    backgroundColor: c.white,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: c.line,
    ...theme.shadow,
  },
  tileText: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.ink, textAlign: "center" },
});
