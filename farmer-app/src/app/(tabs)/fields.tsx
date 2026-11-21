/**
 * My fields: one summary card, then one card per field (title and status, land and crop,
 * one main action and two secondary ones), then subsidy. Same heading and strip style as Alerts.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { CropPicker } from "@/components/crop-picker";
import { Card, ErrorText, IconTile, Loading, Muted, Screen, type IconName } from "@/components/ui";
import { digits } from "@/lib/bs";
import { currentSeason, landText } from "@/lib/farm";
import { CROP_EN, useLang } from "@/lib/i18n";
import { saveFieldLocation } from "@/lib/location";
import { takeFieldPhoto } from "@/lib/photo";
import { useData, type Allocation, type Parcel } from "@/lib/use-data";
import { theme } from "@/theme";

const c = theme.colors;

export default function FieldsTab() {
  const { tr, num, lang } = useLang();
  const parcels = useData<Parcel[]>("/v1/parcels");
  const subsidy = useData<Allocation[]>("/v1/subsidies/mine");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [locating, setLocating] = useState<string | null>(null);
  const [shooting, setShooting] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, { text: string; error?: boolean }>>({});
  const season = currentSeason();

  async function photo(parcelId: string) {
    setShooting(parcelId);
    const r = await takeFieldPhoto(parcelId);
    setShooting(null);
    if (!r.ok && r.reason === "cancelled") return;
    const text = r.ok ? tr("फोटो पठाइयो", "Photo sent") : r.reason === "denied" ? tr("क्यामेराको अनुमति दिनुहोस्", "Allow the camera") : tr("फोटो पठाउन सकिएन", "Photo not sent");
    setNotes((n) => ({ ...n, [parcelId]: { text, error: !r.ok } }));
  }

  async function locate(parcelId: string) {
    setLocating(parcelId);
    const r = await saveFieldLocation(parcelId);
    setLocating(null);
    const text = r.ok
      ? tr("स्थान सेभ भयो", "Location saved")
      : r.reason === "denied"
        ? tr("स्थानको अनुमति दिनुहोस्", "Allow location")
        : r.reason === "unavailable"
          ? tr("फोनको GPS खोल्नुहोस्", "Turn on GPS")
          : tr("स्थान सेभ भएन", "Location not saved");
    setNotes((n) => ({ ...n, [parcelId]: { text, error: !r.ok } }));
    if (r.ok) void parcels.refresh();
  }

  const status = (v: Parcel["verification"]): { text: string; icon: IconName; color: string } =>
    v === "VERIFIED"
      ? { text: tr("प्रमाणित", "Verified"), icon: "shield-checkmark", color: c.brand[700] }
      : v === "DISPUTED"
        ? { text: tr("कृषि शाखा", "Contact office"), icon: "alert-circle", color: c.danger }
        : { text: tr("बाँकी", "Pending"), icon: "time", color: c.warning };

  const list = parcels.data ?? [];
  const totalHa = list.reduce((sum, p) => sum + p.areaM2, 0) / 10_000;
  const planted = list.filter((p) => p.declarations.some((d) => !d.isFallow && d.season === season)).length;

  return (
    <Screen
      title={tr("मेरो खेत", "My fields")}
      refreshing={parcels.loading}
      onRefresh={() => {
        void parcels.refresh();
        void subsidy.refresh();
      }}
    >
      {parcels.loading && !parcels.data ? <Loading /> : null}
      {parcels.error ? <ErrorText>{parcels.error}</ErrorText> : null}

      {/* Summary: one card, three equal columns */}
      {list.length > 0 ? (
        <View style={styles.summary}>
          <SummaryCell icon="map" value={num(list.length)} label={tr("खेत", "Fields")} />
          <View style={styles.sumDivider} />
          <SummaryCell icon="resize" value={num(totalHa)} label={tr("हेक्टर", "Hectares")} />
          <View style={styles.sumDivider} />
          <SummaryCell icon="leaf" value={`${num(planted)}/${num(list.length)}`} label={tr("बाली लगाएको", "Planted")} />
        </View>
      ) : null}

      {parcels.data && list.length === 0 ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={48} color={c.inkMuted} />
            <Text style={styles.emptyTitle}>{tr("खेत दर्ता भएको छैन", "No field yet")}</Text>
            <Muted>{tr("कृषि शाखामा सम्पर्क गर्नुहोस्", "Contact the agriculture office")}</Muted>
          </View>
        </Card>
      ) : null}

      {list.length > 0 ? <Text style={styles.section}>{tr("तपाईंका खेत", "Your fields")}</Text> : null}

      {list.map((p, i) => {
        const s = status(p.verification);
        const crop = p.declarations.find((d) => !d.isFallow && d.season === season)?.crop;
        const cropName = crop ? (lang === "en" ? (CROP_EN[crop.code] ?? crop.code) : crop.nameNe) : null;
        const note = notes[p.id];
        return (
          <Card key={p.id}>
            {/* Title row: what it is, where it is, its status */}
            <View style={styles.head}>
              <IconTile name="map" size={48} />
              <View style={styles.headText}>
                <Text style={styles.fieldTitle}>
                  {tr("खेत", "Field")} {digits(i + 1, lang)}
                </Text>
                <View style={styles.placeRow}>
                  <Ionicons name="location-outline" size={16} color={c.inkMuted} />
                  <Text style={styles.place} numberOfLines={1}>
                    {tr("वडा", "Ward")} {num(p.ward.number)}, {p.tole}
                  </Text>
                </View>
              </View>
              <View style={styles.status}>
                <Ionicons name={s.icon} size={20} color={s.color} />
                <Text style={[styles.statusText, { color: s.color }]} numberOfLines={1}>
                  {s.text}
                </Text>
              </View>
            </View>

            {/* Facts: two equal columns, label above value */}
            <View style={styles.facts}>
              <Fact icon="resize-outline" label={tr("जग्गा", "Land")} value={landText(p.areaOriginal, p.areaM2, lang, num)} />
              <View style={styles.factDivider} />
              <Fact icon="leaf-outline" label={tr("यो मौसमको बाली", "This season")} value={cropName ?? tr("छानिएको छैन", "Not chosen")} muted={!cropName} />
            </View>

            {/* Actions: one main button, two smaller ones */}
            <Pressable
              onPress={() => setPickerFor(p.id)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.mainAction, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="leaf" size={24} color={c.ink} />
              <Text style={styles.mainActionText}>{crop ? tr("बाली बदल्नुहोस्", "Change crop") : tr("बाली छान्नुहोस्", "Choose crop")}</Text>
            </Pressable>
            <View style={styles.subActions}>
              <SubAction icon={p.geometry ? "checkmark-circle" : "locate"} label={p.geometry ? tr("स्थान फेरि", "Update location") : tr("स्थान राख्नुहोस्", "Save location")} onPress={() => locate(p.id)} busy={locating === p.id} />
              <SubAction icon="camera" label={tr("फोटो खिच्नुहोस्", "Take photo")} onPress={() => photo(p.id)} busy={shooting === p.id} />
            </View>

            {note ? (
              <View style={styles.noteRow}>
                <Ionicons name={note.error ? "alert-circle" : "checkmark-circle"} size={20} color={note.error ? c.danger : c.brand[700]} />
                <Text style={[styles.note, note.error && { color: c.danger }]}>{note.text}</Text>
              </View>
            ) : null}
          </Card>
        );
      })}

      {/* Subsidy */}
      <Pressable onPress={() => router.push("/subsidy")} accessibilityRole="button" style={styles.sectionRow}>
        <Text style={styles.section}>{tr("अनुदान", "Subsidy")}</Text>
        <View style={styles.seeAll}>
          <Text style={styles.seeAllText}>{tr("सबै हेर्नुहोस्", "See all")}</Text>
          <Ionicons name="chevron-forward" size={18} color={c.brand[700]} />
        </View>
      </Pressable>
      <Card>
        {subsidy.data?.length === 0 ? (
          <View style={styles.subEmpty}>
            <Ionicons name="gift-outline" size={28} color={c.inkMuted} />
            <Text style={styles.subEmptyText}>{tr("अहिलेसम्म अनुदान छैन", "No subsidy yet")}</Text>
          </View>
        ) : null}
        {subsidy.data?.map((a, i) => {
          const got = a.status === "DELIVERED";
          return (
            <View key={a.id} style={[styles.subRow, i < (subsidy.data?.length ?? 0) - 1 && styles.subDivider]}>
              <IconTile name={got ? "checkmark-done" : "time-outline"} size={44} color={got ? c.brand[700] : c.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.subName} numberOfLines={2}>
                  {a.scheme.name}
                </Text>
                <Text style={[styles.subState, { color: got ? c.brand[700] : c.warning }]}>{got ? tr("पाइयो", "Received") : tr("आउन बाँकी", "Coming")}</Text>
              </View>
              <View style={styles.subQtyBox}>
                <Text style={styles.subQty}>{num(a.deliveredQty ?? a.allocatedQty)}</Text>
                <Text style={styles.subUnit}>{a.scheme.unit}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      {pickerFor ? <CropPicker parcelId={pickerFor} visible onClose={() => setPickerFor(null)} onSaved={() => void parcels.refresh()} /> : null}
    </Screen>
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

function Fact({ icon, label, value, muted }: { icon: IconName; label: string; value: string; muted?: boolean }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={24} color={c.brand[800]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.factLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.factValue, muted && { color: c.inkMuted }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SubAction({ icon, label, onPress, busy }: { icon: IconName; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.subAction, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
    >
      {busy ? <ActivityIndicator color={c.ink} /> : <Ionicons name={icon} size={22} color={c.brand[800]} />}
      <Text style={styles.subActionText} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink, marginTop: 4 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.brand[700] },

  summary: { flexDirection: "row", alignItems: "stretch", backgroundColor: c.white, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: c.line, paddingVertical: 16, ...theme.shadow },
  sumCell: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 6 },
  sumDivider: { width: 1, backgroundColor: c.line, marginVertical: 4 },
  sumValue: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink },
  sumLabel: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },

  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyTitle: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink },

  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  headText: { flex: 1, gap: 2 },
  fieldTitle: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  place: { flexShrink: 1, fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  status: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 110 },
  statusText: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 13 },

  facts: { flexDirection: "row", alignItems: "center", backgroundColor: c.page, borderRadius: theme.radii.md, paddingVertical: 14, paddingHorizontal: 14 },
  fact: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  factDivider: { width: 1, alignSelf: "stretch", backgroundColor: c.line, marginHorizontal: 12 },
  factLabel: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  factValue: { fontFamily: theme.font.headingMedium, ...theme.type.body, color: c.ink },

  mainAction: { minHeight: theme.touch, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: theme.radii.md, backgroundColor: c.accent },
  mainActionText: { fontFamily: theme.font.bodyBold, fontSize: 17, color: c.ink },
  subActions: { flexDirection: "row", gap: 10 },
  subAction: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8, borderRadius: theme.radii.md, borderWidth: 1.5, borderColor: c.inputBorder, backgroundColor: c.white },
  subActionText: { flexShrink: 1, fontFamily: theme.font.bodyBold, fontSize: 14, color: c.ink, textAlign: "center" },

  noteRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  note: { flex: 1, fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.brand[700] },

  subEmpty: { alignItems: "center", gap: 6, paddingVertical: 12 },
  subEmptyText: { fontFamily: theme.font.bodyBold, ...theme.type.body, color: c.inkMuted },
  subRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  subDivider: { borderBottomWidth: 1, borderBottomColor: c.line },
  subName: { fontFamily: theme.font.bodyBold, ...theme.type.body, color: c.ink },
  subState: { fontFamily: theme.font.bodyBold, ...theme.type.small },
  subQtyBox: { alignItems: "flex-end" },
  subQty: { fontFamily: theme.font.heading, ...theme.type.h3, color: c.ink },
  subUnit: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
});
