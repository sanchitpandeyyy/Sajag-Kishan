/** Subsidy: what the farmer will get and what has already been received, one card per scheme. */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, ErrorText, IconTile, Loading, Muted, type IconName } from "@/components/ui";
import { dateText } from "@/lib/farm";
import { useLang } from "@/lib/i18n";
import { useData, type Allocation, type OpenScheme } from "@/lib/use-data";
import { theme } from "@/theme";

const c = theme.colors;

export default function Subsidy() {
  const { tr, num, lang } = useLang();
  const subsidy = useData<Allocation[]>("/v1/subsidies/mine");
  const open = useData<OpenScheme[]>("/v1/subsidies/open");
  const programmes = (open.data ?? []).filter((s) => !s.mine);
  const kindLabel: Record<string, string> = {
    FERTILIZER: tr("मल", "Fertilizer"),
    SEED: tr("बीउ", "Seed"),
    PESTICIDE: tr("विषादी", "Pesticide"),
    MACHINERY: tr("यन्त्र", "Machinery"),
    OTHER: tr("अन्य", "Other"),
  };
  const all = subsidy.data ?? [];
  const received = all.filter((a) => a.status === "DELIVERED");
  const coming = all.filter((a) => a.status === "PLANNED" || a.status === "APPROVED");
  const cancelled = all.filter((a) => a.status === "CANCELLED");

  const state = (s: string): { text: string; icon: IconName; color: string } =>
    s === "DELIVERED"
      ? { text: tr("पाइयो", "Received"), icon: "checkmark-circle", color: c.brand[700] }
      : s === "APPROVED"
        ? { text: tr("स्वीकृत, आउन बाँकी", "Approved, coming"), icon: "time", color: c.warning }
        : s === "CANCELLED"
          ? { text: tr("रद्द भयो", "Cancelled"), icon: "close-circle", color: c.inkMuted }
          : { text: tr("योजनामा छ", "Planned"), icon: "time-outline", color: c.warning };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} hitSlop={12} accessibilityRole="button" accessibilityLabel={tr("पछाडि", "Back")} style={styles.back}>
          <Ionicons name="arrow-back" size={26} color={c.ink} />
        </Pressable>
        <Text style={styles.title}>{tr("अनुदान", "Subsidy")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl
            refreshing={subsidy.loading}
            onRefresh={() => {
              void subsidy.refresh();
              void open.refresh();
            }}
            tintColor={c.brand[800]}
          />}>
        {subsidy.loading && !subsidy.data ? <Loading /> : null}
        {subsidy.error ? <ErrorText>{subsidy.error}</ErrorText> : null}

        {subsidy.data && all.length === 0 ? (
          <Card>
            <View style={styles.empty}>
              <Ionicons name="gift-outline" size={48} color={c.inkMuted} />
              <Text style={styles.emptyTitle}>{tr("अहिलेसम्म अनुदान छैन", "No subsidy yet")}</Text>
              <Muted>
                {programmes.length
                  ? tr("तपाईंलाई अहिलेसम्म अनुदान छुट्याइएको छैन। तल तपाईंको पालिकाका खुला कार्यक्रम हेर्नुहोस्।", "Nothing has been allocated to you yet. See the open programmes in your municipality below.")
                  : tr("कृषि शाखाले अनुदान कार्यक्रम खोलेपछि यहाँ देखिन्छ", "Programmes appear here once the agriculture office opens them")}
              </Muted>
            </View>
          </Card>
        ) : null}

        {all.length > 0 ? (
          <View style={styles.summary}>
            <SummaryCell icon="gift" value={num(all.length)} label={tr("जम्मा", "Total")} />
            <View style={styles.sumDivider} />
            <SummaryCell icon="time" value={num(coming.length)} label={tr("आउन बाँकी", "Coming")} />
            <View style={styles.sumDivider} />
            <SummaryCell icon="checkmark-done" value={num(received.length)} label={tr("पाइसकेको", "Received")} />
          </View>
        ) : null}

        <Group title={tr("आउन बाँकी", "Coming")} items={coming} state={state} num={num} tr={tr} lang={lang} />
        <Group title={tr("पाइसकेको", "Received")} items={received} state={state} num={num} tr={tr} lang={lang} />
        <Group title={tr("रद्द भएको", "Cancelled")} items={cancelled} state={state} num={num} tr={tr} lang={lang} />

        {programmes.length > 0 ? (
          <View style={{ gap: theme.space.sm }}>
            <Text style={styles.section}>{tr("तपाईंको पालिकाका अनुदान कार्यक्रम", "Programmes in your municipality")}</Text>
            {programmes.map((s) => (
              <Card key={s.id}>
                <View style={styles.head}>
                  <IconTile name="megaphone" size={48} color={c.brand[700]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {s.name}
                    </Text>
                    <Text style={styles.stateText}>
                      {kindLabel[s.kind] ?? s.kind}
                      {s.product ? ` · ${s.product}` : ""} · {tr(`आ.व. ${s.fiscalYearBs}`, `FY ${s.fiscalYearBs}`)}
                    </Text>
                    {s.remaining != null ? (
                      <Muted>{tr(`बाँकी: ${num(s.remaining)} ${s.unit}`, `Remaining: ${num(s.remaining)} ${s.unit}`)}</Muted>
                    ) : null}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {all.length > 0 || programmes.length > 0 ? (
          <View style={styles.help}>
            <Ionicons name="information-circle-outline" size={22} color={c.inkMuted} />
            <Text style={styles.helpText}>{tr("अनुदान बुझ्न आफ्नो पालिकाको कृषि शाखामा सम्पर्क गर्नुहोस्।", "To collect a subsidy, contact your municipality agriculture office.")}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({
  title,
  items,
  state,
  num,
  tr,
  lang,
}: {
  title: string;
  items: Allocation[];
  state: (s: string) => { text: string; icon: IconName; color: string };
  num: (n: number, d?: number) => string;
  tr: (ne: string, en: string) => string;
  lang: "ne" | "en";
}) {
  if (items.length === 0) return null;
  return (
    <View style={{ gap: theme.space.md }}>
      <Text style={styles.section}>{title}</Text>
      {items.map((a) => {
        const s = state(a.status);
        const got = a.status === "DELIVERED";
        return (
          <Card key={a.id}>
            <View style={styles.head}>
              <IconTile name="gift" size={48} color={s.color} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {a.scheme.name}
                </Text>
                <View style={styles.stateRow}>
                  <Ionicons name={s.icon} size={16} color={s.color} />
                  <Text style={[styles.stateText, { color: s.color }]}>{s.text}</Text>
                </View>
              </View>
            </View>
            <View style={styles.qty}>
              <View style={styles.qtyCell}>
                <Text style={styles.qtyLabel}>{tr("तपाईंको हिस्सा", "Your share")}</Text>
                <Text style={styles.qtyValue}>
                  {num(a.allocatedQty)} <Text style={styles.qtyUnit}>{a.scheme.unit}</Text>
                </Text>
              </View>
              <View style={styles.qtyDivider} />
              <View style={styles.qtyCell}>
                <Text style={styles.qtyLabel}>{tr("पाइसकेको", "Received")}</Text>
                <Text style={styles.qtyValue}>
                  {num(got ? (a.deliveredQty ?? a.allocatedQty) : 0)} <Text style={styles.qtyUnit}>{a.scheme.unit}</Text>
                </Text>
              </View>
            </View>
            {a.createdAt ? <Muted>{dateText(a.createdAt, lang)}</Muted> : null}
          </Card>
        );
      })}
    </View>
  );
}

function SummaryCell({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.sumCell}>
      <Ionicons name={icon} size={24} color={c.brand[800]} />
      <Text style={styles.sumValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.sumLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.page },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.white, borderWidth: 1, borderColor: c.line },
  title: { fontFamily: theme.font.heading, ...theme.type.h1, color: c.ink },
  scroll: { paddingHorizontal: theme.space.lg, paddingBottom: 40, gap: theme.space.lg },
  section: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink },

  summary: { flexDirection: "row", alignItems: "stretch", backgroundColor: c.white, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.line, paddingVertical: 16, ...theme.shadow },
  sumCell: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 6 },
  sumDivider: { width: 1, backgroundColor: c.line, marginVertical: 4 },
  sumValue: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink },
  sumLabel: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },

  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyTitle: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink },

  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink },
  stateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stateText: { fontFamily: theme.font.bodyBold, ...theme.type.small },

  qty: { flexDirection: "row", alignItems: "center", backgroundColor: c.page, borderRadius: theme.radii.md, paddingVertical: 14, paddingHorizontal: 14 },
  qtyCell: { flex: 1, gap: 2 },
  qtyDivider: { width: 1, alignSelf: "stretch", backgroundColor: c.line, marginHorizontal: 12 },
  qtyLabel: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  qtyValue: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink },
  qtyUnit: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },

  help: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  helpText: { flex: 1, fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
});
