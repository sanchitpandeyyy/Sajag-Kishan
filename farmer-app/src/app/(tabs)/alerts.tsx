/**
 * Alerts: a summary strip, then one clear card per warning, crop risk and office notice.
 * Same look as My fields: icon first, few words, a quiet grey strip for the details.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, ErrorText, IconTile, Loading, Muted, Screen, type IconName } from "@/components/ui";
import { apiQuiet } from "@/lib/api";
import { dateText } from "@/lib/farm";
import { useLang } from "@/lib/i18n";
import { useData, type Advisory, type Alert, type DiseaseAdvice, type Parcel } from "@/lib/use-data";
import { theme } from "@/theme";

const c = theme.colors;

/** One clear icon per warning type, so a farmer knows the danger before reading. */
const ICON: Record<string, IconName> = {
  HEAVY_RAIN: "rainy",
  FLOOD_RISK: "water",
  FROST: "snow",
  HEAT: "thermometer",
  DRY_SPELL: "sunny",
  STRONG_WIND: "thunderstorm",
  LATE_BLIGHT: "bug",
  RICE_BLAST: "bug",
};

type Filter = "all" | "weather" | "risk" | "office";

export default function AlertsTab() {
  const { tr, lang, num } = useLang();
  const feed = useData<{ alerts: Alert[]; advisories: Advisory[] }>("/v1/alerts");
  const parcels = useData<Parcel[]>("/v1/parcels");
  const first = parcels.data?.[0];
  const advice = useData<{ advice: DiseaseAdvice[] }>(first ? `/v1/advice?parcelId=${first.id}` : null);
  const L = (b: { ne: string; en: string }) => (lang === "ne" ? b.ne : b.en);
  const [filter, setFilter] = useState<Filter>("all");

  const alerts = feed.data?.alerts ?? [];
  const unread = alerts.filter((a) => a.read === false).map((a) => a.id).join(",");
  useEffect(() => {
    if (unread) void apiQuiet("/v1/alerts/read", { alertIds: unread.split(",") });
  }, [unread]);
  const notices = feed.data?.advisories ?? [];
  const risks = advice.data?.advice ?? [];
  const severe = alerts.some((a) => a.severity === "SEVERE");
  const loaded = !!feed.data && (!first || !!advice.data);
  const allClear = loaded && alerts.length === 0 && notices.length === 0 && risks.length === 0;
  const show = (f: Exclude<Filter, "all">) => filter === "all" || filter === f;
  const shownCount = (show("weather") ? alerts.length : 0) + (show("risk") ? risks.length : 0) + (show("office") ? notices.length : 0);
  const filters: { key: Filter; icon: IconName; label: string; count: number; danger?: boolean }[] = [
    { key: "all", icon: "apps", label: tr("सबै", "All"), count: alerts.length + risks.length + notices.length },
    { key: "weather", icon: severe ? "warning" : "partly-sunny", label: tr("मौसम", "Weather"), count: alerts.length, danger: severe },
    { key: "risk", icon: "bug", label: tr("बाली", "Crops"), count: risks.length, danger: risks.some((r) => r.level === "HIGH") },
    { key: "office", icon: "megaphone", label: tr("कृषि शाखा", "Office"), count: notices.length },
  ];

  return (
    <Screen
      title={tr("सूचना", "Alerts")}
      refreshing={feed.loading}
      onRefresh={() => {
        void feed.refresh();
        void advice.refresh();
      }}
    >
      {feed.loading && !feed.data ? <Loading /> : null}
      {feed.error ? <ErrorText>{feed.error}</ErrorText> : null}

      {/* Filters */}
      {loaded && !allClear ? (
        <View style={styles.filters}>
          {filters.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${f.label} ${f.count}`}
                style={({ pressed }) => [styles.filter, on && styles.filterOn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name={f.icon} size={24} color={on ? c.white : f.danger ? c.danger : c.brand[800]} />
                <Text style={[styles.filterLabel, on && styles.filterLabelOn]} numberOfLines={1}>
                  {f.label}
                </Text>
                <Text style={[styles.filterCount, on && styles.filterLabelOn]}>{num(f.count)}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {loaded && !allClear && shownCount === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={44} color={c.brand[700]} />
            <Text style={styles.emptyTitle}>{tr("कुनै सूचना छैन", "Nothing here")}</Text>
            <Muted>{tr("यो भागमा अहिले केही छैन", "No items in this section right now")}</Muted>
          </View>
        </Card>
      ) : null}

      {allClear ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={48} color={c.brand[700]} />
            <Text style={styles.emptyTitle}>{tr("सबै ठीक छ", "All clear")}</Text>
            <Muted>{tr("अहिले कुनै सूचना छैन", "No alerts right now")}</Muted>
          </View>
        </Card>
      ) : null}

      {/* Weather warnings */}
      {show("weather") && alerts.length > 0 ? <SectionTitle text={tr("मौसमको चेतावनी", "Weather warnings")} /> : null}
      {(show("weather") ? alerts : []).map((a) => {
        const isSevere = a.severity === "SEVERE";
        const tone = isSevere ? c.danger : c.warning;
        return (
          <Card key={a.id} style={isSevere ? { borderColor: c.danger } : undefined}>
            <View style={styles.head}>
              <IconTile name={ICON[a.type] ?? "alert-circle"} size={48} color={tone} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{a.titleNe}</Text>
                <View style={styles.toneRow}>
                  <Ionicons name={isSevere ? "warning" : "alert-circle"} size={16} color={tone} />
                  <Text style={[styles.tone, { color: tone }]}>{isSevere ? tr("खतरा", "Danger") : tr("सचेत", "Warning")}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.body}>{a.messageNe}</Text>
            <View style={styles.strip}>
              <Ionicons name="calendar-outline" size={20} color={c.inkMuted} />
              <Text style={styles.stripText}>{dateText(a.validFrom, lang)}</Text>
            </View>
          </Card>
        );
      })}

      {/* Crop risk this week */}
      {show("risk") && risks.length > 0 ? <SectionTitle text={tr("यो हप्ताको बाली जोखिम", "Crop risk this week")} /> : null}
      {(show("risk") ? risks : []).map((r) => {
        const high = r.level === "HIGH";
        const tone = high ? c.danger : c.warning;
        const bars = r.level === "HIGH" ? 3 : r.level === "MEDIUM" ? 2 : 1;
        return (
          <Card key={r.code} style={high ? { borderColor: c.danger } : undefined}>
            <View style={styles.head}>
              <IconTile name="bug" size={48} color={tone} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{L(r.name)}</Text>
                <Text style={styles.sub}>{L(r.cropName)}</Text>
              </View>
              <View style={styles.level}>
                <View style={styles.bars}>
                  {[1, 2, 3].map((n) => (
                    <View key={n} style={[styles.bar, { height: 8 + n * 5, backgroundColor: n <= bars ? tone : c.line }]} />
                  ))}
                </View>
                <Text style={[styles.levelText, { color: tone }]}>{high ? tr("उच्च", "High") : r.level === "MEDIUM" ? tr("मध्यम", "Medium") : tr("कम", "Low")}</Text>
              </View>
            </View>

            <View style={styles.strip}>
              <Ionicons name="information-circle-outline" size={22} color={c.inkMuted} />
              <Text style={[styles.stripText, { flex: 1 }]}>{L(r.why)}</Text>
            </View>

            <Text style={styles.label}>{tr("के गर्ने", "What to do")}</Text>
            {r.prevent.slice(0, 3).map((p) => (
              <View key={p.en} style={styles.step}>
                <Ionicons name="checkmark-circle" size={22} color={c.brand[700]} />
                <Text style={[styles.body, { flex: 1 }]}>{L(p)}</Text>
              </View>
            ))}
            {r.ifSigns[0] ? <Muted>{L(r.ifSigns[0])}</Muted> : null}
          </Card>
        );
      })}

      {/* Office notices */}
      {show("office") && notices.length > 0 ? <SectionTitle text={tr("कृषि शाखाबाट", "From the office")} /> : null}
      {(show("office") ? notices : []).map((n) => (
        <Card key={n.id}>
          <View style={styles.head}>
            <IconTile name="megaphone" size={48} />
            <Text style={[styles.cardTitle, { flex: 1 }]}>{n.titleNe}</Text>
          </View>
          <Text style={styles.body}>{n.bodyNe}</Text>
          <View style={styles.strip}>
            <Ionicons name="person-outline" size={20} color={c.inkMuted} />
            <Text style={[styles.stripText, { flex: 1 }]} numberOfLines={1}>
              {n.officer.fullName}
            </Text>
            <Text style={styles.stripText}>{dateText(n.publishedAt, lang)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.section}>{text}</Text>;
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8 },
  filter: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 12, paddingHorizontal: 4, backgroundColor: c.white, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.line, ...theme.shadow },
  filterOn: { backgroundColor: c.brand[800], borderColor: c.brand[800] },
  filterLabel: { fontFamily: theme.font.bodyBold, fontSize: 12, color: c.ink },
  filterCount: { fontFamily: theme.font.heading, fontSize: 18, color: c.ink },
  filterLabelOn: { color: c.white },

  section: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink, marginTop: 4 },

  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyTitle: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink },

  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink },
  toneRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tone: { fontFamily: theme.font.bodyBold, ...theme.type.small },
  sub: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  body: { fontFamily: theme.font.body, ...theme.type.body, color: c.body },
  label: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.inkMuted },

  strip: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.page, borderRadius: theme.radii.md, paddingVertical: 12, paddingHorizontal: 12 },
  stripText: { fontFamily: theme.font.body, ...theme.type.small, color: c.body },

  level: { alignItems: "center", gap: 2 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 6, borderRadius: 3 },
  levelText: { fontFamily: theme.font.bodyBold, fontSize: 12 },

  step: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
});
