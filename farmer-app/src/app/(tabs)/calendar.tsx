import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, ErrorText, IconTile, Loading, Muted, Screen, type IconName } from "@/components/ui";
import { addMonths, BS_MAX_YEAR, BS_MIN_YEAR, BS_WEEK_SHORT, bsDateText, bsMonthGrid, bsMonthTitle, digits, isoToBs, todayIso } from "@/lib/bs";
import { TASK_EN } from "@/lib/farm";
import { CROP_EN, useLang } from "@/lib/i18n";
import { useData, type CalendarEvent, type CalendarResponse, type Parcel } from "@/lib/use-data";
import { theme } from "@/theme";

const c = theme.colors;

const TASK: Record<string, { icon: IconName; color: string; ne: string }> = {
  LAND_PREP: { icon: "construct", color: c.soil, ne: "खेत तयारी" },
  NURSERY: { icon: "flower", color: "#2E8B57", ne: "बिउ बेर्ना" },
  SOWING: { icon: "ellipse", color: c.brand[700], ne: "रोपाइँ बीउ" },
  TRANSPLANTING: { icon: "leaf", color: "#4A9F1E", ne: "रोपाइँ" },
  FERTILIZING: { icon: "flask", color: c.info, ne: "मल" },
  IRRIGATION: { icon: "water", color: "#0E8FA8", ne: "सिँचाइ" },
  WEEDING: { icon: "cut", color: "#7B4FB0", ne: "गोडमेल" },
  PEST_SCOUTING: { icon: "bug", color: c.warning, ne: "रोग कीरा" },
  HARVEST: { icon: "basket", color: c.accent, ne: "कटनी" },
  STORAGE: { icon: "home", color: c.inkMuted, ne: "भण्डारण" },
};
const FALLBACK = { icon: "checkmark-circle" as IconName, color: c.brand[800], ne: "काम" };
const task = (key: string) => TASK[key] ?? FALLBACK;
const onColor = (color: string) => (color === c.accent ? c.ink : c.white);

const CROP_NE: Record<string, string> = { paddy: "धान", wheat: "गहुँ", maize: "मकै", potato: "आलु", mustard: "तोरी", lentil: "मसुरो", millet: "कोदो" };

const day10 = (iso: string) => iso.slice(0, 10);

export default function CalendarTab() {
  const { tr, lang } = useLang();
  const parcels = useData<Parcel[]>("/v1/parcels");
  const [parcelId, setParcelId] = useState<string | null>(null);
  useEffect(() => {
    if (!parcelId && parcels.data?.[0]) setParcelId(parcels.data[0].id);
  }, [parcels.data, parcelId]);
  const cal = useData<CalendarResponse>(parcelId ? `/v1/calendar?parcelId=${parcelId}` : null);

  const today = todayIso();
  const todayBs = isoToBs(today);
  const [view, setView] = useState({ year: todayBs.year, month: todayBs.month });
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => bsMonthGrid(view.year, view.month), [view]);
  const cells = useMemo(() => rows.flat().filter((x): x is NonNullable<typeof x> => x !== null), [rows]);
  const first = cells[0]!.iso;
  const last = cells[cells.length - 1]!.iso;

  const monthEvents = useMemo(
    () =>
      (cal.data?.events ?? [])
        .filter((e) => day10(e.endsOn) >= first && day10(e.startsOn) <= last)
        .sort((a, b) => a.startsOn.localeCompare(b.startsOn)),
    [cal.data, first, last],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, { start?: CalendarEvent; within?: CalendarEvent }>();
    for (const cell of cells) {
      const start = monthEvents.find((e) => day10(e.startsOn) === cell.iso);
      const within = monthEvents.find((e) => day10(e.startsOn) <= cell.iso && day10(e.endsOn) >= cell.iso);
      if (start || within) map.set(cell.iso, { start, within });
    }
    return map;
  }, [cells, monthEvents]);

  const listed = selected ? monthEvents.filter((e) => day10(e.startsOn) <= selected && day10(e.endsOn) >= selected) : monthEvents;
  const usedKinds = [...new Set(monthEvents.map((e) => e.task))];

  const canPrev = view.year > BS_MIN_YEAR || view.month > 0;
  const canNext = view.year < BS_MAX_YEAR || view.month < 11;
  const move = (delta: number) => {
    setSelected(null);
    setView((v) => addMonths(v.year, v.month, delta));
  };
  const isThisMonth = view.year === todayBs.year && view.month === todayBs.month;

  const adLabel = (() => {
    const a = new Date(`${first}T00:00:00`);
    const b = new Date(`${last}T00:00:00`);
    const m = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });
    return `${m(a)}${m(a) === m(b) ? "" : ` / ${m(b)}`} ${b.getFullYear()}`;
  })();

  const taskName = (key: string, titleNe: string) => (lang === "en" ? (TASK_EN[key] ?? titleNe) : titleNe);
  const cropName = (code: string) => (lang === "en" ? (CROP_EN[code] ?? code) : (CROP_NE[code] ?? code));

  return (
    <Screen title={tr("पात्रो", "Calendar")} refreshing={cal.loading} onRefresh={() => void cal.refresh()}>
      {parcels.data && parcels.data.length > 1 ? (
        <View style={styles.chips}>
          {parcels.data.map((p, i) => (
            <Pressable key={p.id} onPress={() => setParcelId(p.id)} style={[styles.chip, p.id === parcelId && styles.chipActive]} accessibilityState={{ selected: p.id === parcelId }}>
              <Ionicons name="map-outline" size={20} color={p.id === parcelId ? c.brand[800] : c.inkMuted} />
              <Text style={[styles.chipText, p.id === parcelId && styles.chipTextActive]}>{digits(i + 1, lang)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Card>
        <View style={styles.monthBar}>
          <Pressable onPress={() => move(-1)} disabled={!canPrev} style={styles.navBtn} accessibilityLabel={tr("अघिल्लो महिना", "Previous month")} hitSlop={6}>
            <Ionicons name="chevron-back" size={26} color={canPrev ? c.ink : c.line} />
          </Pressable>
          <View style={styles.monthCenter}>
            <Text style={styles.monthTitle}>{bsMonthTitle(view.year, view.month, lang)}</Text>
            <Text style={styles.monthSub}>{adLabel}</Text>
          </View>
          <Pressable onPress={() => move(1)} disabled={!canNext} style={styles.navBtn} accessibilityLabel={tr("अर्को महिना", "Next month")} hitSlop={6}>
            <Ionicons name="chevron-forward" size={26} color={canNext ? c.ink : c.line} />
          </Pressable>
        </View>

        {!isThisMonth ? (
          <Pressable
            onPress={() => {
              setSelected(null);
              setView({ year: todayBs.year, month: todayBs.month });
            }}
            style={styles.todayBtn}
            accessibilityRole="button"
          >
            <Ionicons name="today-outline" size={20} color={c.brand[800]} />
            <Text style={styles.todayText}>{tr("आज", "Today")}</Text>
          </Pressable>
        ) : null}

        <View style={styles.weekRow}>
          {BS_WEEK_SHORT[lang].map((w, i) => (
            <Text key={w} style={[styles.weekText, i === 6 && styles.sat]}>
              {w}
            </Text>
          ))}
        </View>

        {rows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((cell, ci) => {
              if (!cell) return <View key={ci} style={styles.cell} />;
              const hit = byDay.get(cell.iso);
              const mark = hit?.start ? task(hit.start.task) : null;
              const bar = hit?.within ? task(hit.within.task).color : null;
              const isToday = cell.iso === today;
              const isSel = cell.iso === selected;
              return (
                <Pressable key={ci} style={styles.cell} onPress={() => (hit ? setSelected(isSel ? null : cell.iso) : setSelected(null))} accessibilityRole="button" accessibilityLabel={`${digits(cell.day, lang)}`}>
                  <View style={[styles.dayCircle, mark && { backgroundColor: mark.color }, isToday && styles.todayRing, isSel && styles.selRing]}>
                    <Text style={[styles.dayNum, cell.weekday === 6 && styles.sat, mark && { color: onColor(mark.color) }, isToday && !mark && { fontFamily: theme.font.heading }]}>{digits(cell.day, lang)}</Text>
                  </View>
                  <Text style={styles.adNum}>{cell.adDay}</Text>
                  <View style={[styles.rangeBar, bar ? { backgroundColor: bar } : null]} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      {cal.loading && !cal.data ? <Loading /> : null}
      {cal.error ? <ErrorText>{cal.error}</ErrorText> : null}
      {parcels.data?.length === 0 ? <Muted>{tr("खेत दर्ता भएपछि पात्रो देखिन्छ।", "The calendar appears once a field is registered.")}</Muted> : null}

      {usedKinds.length > 0 ? (
        <View style={styles.legend}>
          {usedKinds.map((k) => (
            <View key={k} style={styles.legendItem}>
              <View style={[styles.legendIcon, { backgroundColor: task(k).color }]}>
                <Ionicons name={task(k).icon} size={16} color={onColor(task(k).color)} />
              </View>
              <Text style={styles.legendText}>{lang === "en" ? (TASK_EN[k] ?? k).split(" ")[0] : task(k).ne}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Card icon="star-outline" title={selected ? bsDateText(selected, lang) : tr("महत्त्वपूर्ण मिति", "Important dates")} action={selected ? <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityLabel={tr("सबै", "All")}><Ionicons name="close-circle" size={26} color={c.inkMuted} /></Pressable> : undefined}>
        {listed.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-clear-outline" size={36} color={c.inkMuted} />
            <Text style={styles.emptyText}>{tr("यो महिना काम छैन", "Nothing this month")}</Text>
          </View>
        ) : null}
        {listed.map((e, i) => {
          const t = task(e.task);
          const past = day10(e.endsOn) < today;
          const sameDay = day10(e.startsOn) === day10(e.endsOn);
          return (
            <View key={`${e.task}-${e.startsOn}-${i}`} style={[styles.event, i < listed.length - 1 && styles.eventDivider, past && { opacity: 0.55 }]}>
              <View style={[styles.eventIcon, { backgroundColor: t.color }]}>
                <Ionicons name={t.icon} size={26} color={onColor(t.color)} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eventTitle}>{taskName(e.task, e.titleNe)}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="leaf-outline" size={16} color={c.inkMuted} />
                  <Text style={styles.eventMeta}>{cropName(e.crop)}</Text>
                </View>
              </View>
              <View style={styles.eventDate}>
                <Text style={styles.eventDateMain}>{bsDateText(e.startsOn, lang)}</Text>
                {!sameDay ? <Text style={styles.eventDateEnd}>{bsDateText(e.endsOn, lang)}</Text> : null}
              </View>
            </View>
          );
        })}
      </Card>

      {cal.data?.basis === "suggested" ? (
        <View style={styles.note}>
          <IconTile name="information-circle-outline" size={36} color={c.inkMuted} />
          <Text style={[styles.noteText, { flex: 1 }]}>{tr("सामान्य पात्रो", "Typical calendar")}</Text>
        </View>
      ) : null}

    </Screen>
  );
}

const CELL_H = 58;

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, minWidth: 64, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14, borderRadius: theme.radii.md, borderWidth: 1.5, borderColor: c.line, backgroundColor: c.white },
  chipActive: { borderColor: c.brand[800] },
  chipText: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.inkMuted },
  chipTextActive: { color: c.ink },

  monthBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: c.fill },
  monthCenter: { alignItems: "center" },
  monthTitle: { fontFamily: theme.font.heading, ...theme.type.h2, color: c.ink },
  monthSub: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  todayBtn: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, borderColor: c.brand[800] },
  todayText: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.brand[800] },

  weekRow: { flexDirection: "row", paddingTop: 4 },
  weekText: { flex: 1, textAlign: "center", fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.inkMuted },
  sat: { color: c.danger },
  gridRow: { flexDirection: "row" },
  cell: { flex: 1, height: CELL_H, alignItems: "center", justifyContent: "flex-start", paddingTop: 2 },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  todayRing: { borderColor: c.brand[800] },
  selRing: { borderColor: c.ink },
  dayNum: { fontFamily: theme.font.bodyBold, fontSize: 17, color: c.ink },
  adNum: { fontFamily: theme.font.body, fontSize: 11, color: c.inkMuted, lineHeight: 13 },
  rangeBar: { height: 3, width: "62%", borderRadius: 2, marginTop: 2, backgroundColor: "transparent" },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendIcon: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  legendText: { fontFamily: theme.font.bodyBold, ...theme.type.small, color: c.body },

  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyText: { fontFamily: theme.font.bodyBold, ...theme.type.body, color: c.inkMuted },
  event: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  eventDivider: { borderBottomWidth: 1, borderBottomColor: c.line },
  eventIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  eventTitle: { fontFamily: theme.font.bodyBold, ...theme.type.body, color: c.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  eventMeta: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
  eventDate: { alignItems: "flex-end" },
  eventDateMain: { fontFamily: theme.font.headingMedium, ...theme.type.body, color: c.brand[800] },
  eventDateEnd: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },

  note: { flexDirection: "row", alignItems: "center", gap: 10 },
  noteText: { fontFamily: theme.font.body, ...theme.type.small, color: c.inkMuted },
});
