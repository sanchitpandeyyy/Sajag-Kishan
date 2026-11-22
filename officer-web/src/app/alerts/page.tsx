"use client";

import { AlertTriangle, BellRing, Bug, CloudRain, Megaphone, Newspaper, RefreshCw, ShieldAlert, Snowflake, Sun, Wind } from "lucide-react";
import { useState } from "react";
import { Card, inputClass, PrimaryButton, SecondaryButton, Shell, StateMessage, useMe } from "@/components/shell";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface WardLabel {
  number: number;
  localLevel: { id: number; nameNe: string; nameEn: string };
}
interface Alert {
  id: string;
  wardId: number;
  ward: WardLabel | null;
  type: string;
  severity: "INFO" | "WARNING" | "SEVERE";
  validFrom: string;
  titleNe: string;
  messageNe: string;
  cropCodes: string[];
  evidence: Record<string, unknown> | null;
  reach?: { farmers: number; pushed: number; read: number };
}
interface Advisory {
  id: string;
  wardId: number | null;
  ward: WardLabel | null;
  titleNe: string;
  bodyNe: string;
  publishedAt: string;
  officer: { fullName: string; designation: string | null };
}
interface Ward {
  id: number;
  number: number;
}

/** English text for engine alert types (Nepali comes from the engine). */
const TYPE_EN: Record<string, readonly [string, string]> = {
  HEAVY_RAIN: ["Heavy rain likely", "Drain fields and postpone fertilizer or pesticide application."],
  FLOOD_RISK: ["Flood / landslide risk", "A lot of rain over three days. Move livestock and stored grain to safety."],
  FROST: ["Frost likely", "Irrigate lightly in the evening and cover nurseries and vegetables."],
  HEAT: ["Extreme heat", "Irrigate morning and evening; avoid field work at midday."],
  DRY_SPELL: ["Dry spell likely", "Little rain in the next 10 days. Plan irrigation."],
  STRONG_WIND: ["Strong wind likely", "Harvest ripe crops early and secure tunnels and plastic."],
  LATE_BLIGHT: ["Late blight risk", "Inspect potato and tomato regularly and ask a technician about prevention."],
  RICE_BLAST: ["Rice blast risk", "Avoid excess nitrogen, inspect fields and report symptoms to the agriculture office."],
  BACTERIAL_LEAF_BLIGHT: ["Bacterial leaf blight risk", "Drain standing water after storms and avoid extra nitrogen."],
  YELLOW_RUST: ["Yellow rust risk", "Check wheat leaves twice a week for yellow stripes of powder."],
  FALL_ARMYWORM: ["Fall armyworm risk", "Check maize whorls for holes and frass twice a week."],
  MUSTARD_APHID: ["Mustard aphid risk", "Cool, dry weeks. Check flowers and tips twice a week."],
};

const ICON: Record<string, typeof CloudRain> = {
  HEAVY_RAIN: CloudRain,
  FLOOD_RISK: CloudRain,
  FROST: Snowflake,
  HEAT: Sun,
  DRY_SPELL: Sun,
  STRONG_WIND: Wind,
  LATE_BLIGHT: ShieldAlert,
  RICE_BLAST: ShieldAlert,
  BACTERIAL_LEAF_BLIGHT: ShieldAlert,
  YELLOW_RUST: ShieldAlert,
  FALL_ARMYWORM: Bug,
  MUSTARD_APHID: Bug,
};

const LEVEL: Record<string, readonly [string, string]> = { HIGH: ["उच्च", "high"], MEDIUM: ["मध्यम", "medium"], LOW: ["कम", "low"] };

/**
 * Plain-language reason for an alert, built from the engine's evidence fields.
 * Unknown fields are skipped, so a new rule never shows raw data.
 */
function evidenceText(ev: Record<string, unknown>, tr: (ne: string, en: string) => string, num: (n: number, d?: number) => string, day: (iso: string) => string): string {
  const n = (k: string) => (typeof ev[k] === "number" ? (ev[k] as number) : null);
  const parts: string[] = [];
  const days = Array.isArray(ev.days) ? (ev.days as string[]) : null;
  if (days?.length) {
    const span = days.length > 1 ? `${day(days[0]!)} - ${day(days.at(-1)!)}` : day(days[0]!);
    parts.push(tr(`अर्को ${num(days.length)} दिन रोगलाई अनुकूल मौसम (${span})`, `weather favours it on ${days.length} day${days.length > 1 ? "s" : ""} (${span})`));
  }
  if (typeof ev.level === "string" && LEVEL[ev.level]) {
    const [ne, en] = LEVEL[ev.level]!;
    const score = n("score");
    parts.push(tr(`जोखिम ${ne}${score != null ? ` (${num(Math.round(score * 100))}%)` : ""}`, `risk ${en}${score != null ? ` (${Math.round(score * 100)}%)` : ""}`));
  }
  const past = n("pastAlertsInWard");
  if (past) parts.push(tr(`यो वडामा पहिले ${num(past)} पटक देखिएको`, `seen ${past} time${past > 1 ? "s" : ""} before in this ward`));
  const add = (k: string, ne: (v: string) => string, en: (v: string) => string, digits = 0) => {
    const v = n(k);
    if (v != null) parts.push(tr(ne(num(v, digits)), en(String(Math.round(v * 10 ** digits) / 10 ** digits))));
  };
  add("precipitationMm", (v) => `एकै दिनमा ${v} मि.मि. वर्षा`, (v) => `${v} mm of rain in one day`);
  add("threeDayPrecipitationMm", (v) => `३ दिनमा ${v} मि.मि. वर्षा`, (v) => `${v} mm of rain over 3 days`);
  add("tenDayPrecipitationMm", (v) => `१० दिनमा जम्मा ${v} मि.मि. वर्षा`, (v) => `only ${v} mm of rain in 10 days`, 1);
  add("tempMinC", (v) => `न्यूनतम तापक्रम ${v}°C`, (v) => `low of ${v}°C`, 1);
  add("tempMaxC", (v) => `अधिकतम तापक्रम ${v}°C`, (v) => `high of ${v}°C`, 1);
  add("windGustMaxKmh", (v) => `${v} कि.मि./घण्टाको हावा`, (v) => `gusts of ${v} km/h`);
  add("favourableHours", (v) => `${v} घण्टा रोगलाई अनुकूल`, (v) => `${v} hours favourable to the disease`);
  const h1 = n("humidHoursDay1");
  const h2 = n("humidHoursDay2");
  if (h1 != null && h2 != null) parts.push(tr(`लगातार दुई दिन ${num(h1)} र ${num(h2)} घण्टा ओसिलो`, `${h1} and ${h2} humid hours on two days in a row`));
  return parts.join(", ");
}

export default function AlertsPage() {
  const { tr, num, lang } = useLang();
  const { data: me } = useMe();
  const feed = useApi<{ alerts: Alert[]; advisories: Advisory[] }>("/v1/alerts");
  const wards = useApi<Ward[]>(me?.officer ? `/v1/geo/wards?localLevelId=${me.officer.localLevelId}` : null);
  // "Ward 4", plus the municipality when it is not the officer's own (super admin sees all of them).
  const wardLabel = (w: WardLabel | null) => {
    if (!w) return tr("वडा थाहा छैन", "Ward unknown");
    const ward = tr(`वडा ${num(w.number)}`, `Ward ${w.number}`);
    return w.localLevel.id === me?.officer?.localLevelId ? ward : `${tr(w.localLevel.nameNe, w.localLevel.nameEn)}, ${ward}`;
  };

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [form, setForm] = useState({ wardId: "", titleNe: "", bodyNe: "" });

  async function refresh() {
    setBusy("refresh");
    setError(null);
    setInfo(null);
    try {
      const r = await api<{ wards: number; created: number; pushed: number; failures: unknown[] }>("/v1/alerts/refresh", { method: "POST" });
      setInfo(tr(`${num(r.wards)} वडाको पूर्वानुमान जाँचियो, ${num(r.created)} नयाँ चेतावनी।`, `Checked the forecast for ${r.wards} wards: ${r.created} new alerts.`));
      await feed.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("त्रुटि भयो", "Something went wrong"));
    } finally {
      setBusy(null);
    }
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy("publish");
    setError(null);
    try {
      const r = await api<{ reach: { farmers: number; pushed: number } | null }>("/v1/alerts/advisories", {
        method: "POST",
        body: JSON.stringify({ wardId: Number(form.wardId), titleNe: form.titleNe, bodyNe: form.bodyNe, cropCodes: [] }),
      });
      setForm({ wardId: form.wardId, titleNe: "", bodyNe: "" });
      setInfo(
        r.reach
          ? tr(`सूचना प्रकाशित भयो। ${num(r.reach.farmers)} किसानमध्ये ${num(r.reach.pushed)} फोनमा पठाइयो।`, `Advisory published. Sent to ${r.reach.pushed} phones of ${r.reach.farmers} farmers.`)
          : tr("सूचना प्रकाशित भयो। फोनमा पठाउन सकिएन।", "Advisory published. Could not send to phones."),
      );
      await feed.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("प्रकाशित गर्न सकिएन", "Could not publish"));
    } finally {
      setBusy(null);
    }
  }

  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === "ne" ? "ne-NP" : "en-GB", { day: "numeric", month: "short" });
  // Severity shows in the icon and label colour only: plain white cards, no coloured border or tint.
  const severityClass = { SEVERE: "text-danger", WARNING: "text-warning", INFO: "text-info" } as const;
  const severityLabel = { SEVERE: tr("खतरा", "Danger"), WARNING: tr("सचेत", "Warning"), INFO: tr("जानकारी", "Info") } as const;

  return (
    <Shell
      title={tr("सूचना र चेतावनी", "Alerts and advisories")}
      subtitle={tr("मौसम पूर्वानुमानबाट स्वचालित चेतावनी र कृषि शाखाका सूचना", "Automatic forecast alerts and agriculture office advisories")}
      action={
        <SecondaryButton onClick={refresh} disabled={busy === "refresh"} className="flex items-center gap-1">
          <RefreshCw className={`size-4 ${busy === "refresh" ? "animate-spin" : ""}`} /> {tr("पूर्वानुमान जाँच्नुहोस्", "Check forecast now")}
        </SecondaryButton>
      }
    >
      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}
      {info && (
        <p role="status" className="mb-4 text-sm text-brand-700">
          {info}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon={BellRing} title={tr("सक्रिय चेतावनी", "Active alerts")} className="lg:col-span-2">
          <StateMessage loading={feed.loading && !feed.data} error={feed.error} />
          {feed.data?.alerts.length === 0 && (
            <p className="text-sm text-ink-muted">{tr("अहिले कुनै सक्रिय चेतावनी छैन। पूर्वानुमान हरेक ३ घण्टामा जाँचिन्छ।", "No active alerts. The forecast is checked every 3 hours.")}</p>
          )}
          <ul className="space-y-2">
            {feed.data?.alerts.map((a) => {
              const Icon = ICON[a.type] ?? AlertTriangle;
              const en = TYPE_EN[a.type];
              return (
                <li key={a.id} className="rounded-control border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 font-semibold text-ink">
                      <Icon className={`size-5 shrink-0 ${severityClass[a.severity]}`} aria-hidden />
                      <span className={severityClass[a.severity]}>{severityLabel[a.severity]}:</span> {lang === "en" && en ? en[0] : a.titleNe}
                    </p>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {wardLabel(a.ward)}, {date(a.validFrom)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{lang === "en" && en ? en[1] : a.messageNe}</p>
                  {a.reach && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {tr(
                        `${num(a.reach.farmers)} किसान, ${num(a.reach.pushed)} लाई फोनमा पुग्यो, ${num(a.reach.read)} ले पढे`,
                        `${a.reach.farmers} farmers, ${a.reach.pushed} reached by push, ${a.reach.read} read`,
                      )}
                    </p>
                  )}
                  {a.evidence && evidenceText(a.evidence, tr, num, date) && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {tr("कारण", "Why")}: {evidenceText(a.evidence, tr, num, date)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card icon={Megaphone} title={tr("सूचना प्रकाशित गर्नुहोस्", "Publish an advisory")}>
            <form onSubmit={publish} className="space-y-3 text-sm">
              <label className="block">
                {tr("वडा", "Ward")}
                <select className={`mt-1 ${inputClass}`} value={form.wardId} onChange={(e) => setForm({ ...form, wardId: e.target.value })} required>
                  <option value="">{tr("छान्नुहोस्", "Choose")}</option>
                  {wards.data?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {tr("वडा", "Ward")} {num(w.number)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                {tr("शीर्षक (नेपालीमा)", "Title (in Nepali)")}
                <input className={`mt-1 ${inputClass}`} value={form.titleNe} onChange={(e) => setForm({ ...form, titleNe: e.target.value })} required minLength={2} maxLength={120} />
              </label>
              <label className="block">
                {tr("सन्देश (नेपालीमा)", "Message (in Nepali)")}
                <textarea className={`mt-1 ${inputClass}`} rows={4} value={form.bodyNe} onChange={(e) => setForm({ ...form, bodyNe: e.target.value })} required minLength={2} maxLength={2000} />
              </label>
              <PrimaryButton type="submit" disabled={busy === "publish"} className="flex w-full items-center justify-center gap-1">
                <Megaphone className="size-4" /> {tr("प्रकाशित गर्नुहोस्", "Publish")}
              </PrimaryButton>
              <p className="text-xs text-ink-muted">{tr("कृषकहरूले मोबाइल एपमा यो सूचना देख्छन्।", "Farmers see this in the mobile app.")}</p>
            </form>
          </Card>

          <Card icon={Newspaper} title={tr("प्रकाशित सूचनाहरू", "Published advisories")}>
            {feed.data?.advisories.length === 0 && <p className="text-sm text-ink-muted">{tr("अहिलेसम्म कुनै सूचना छैन।", "No advisories yet.")}</p>}
            <ul className="space-y-3">
              {feed.data?.advisories.map((a) => (
                <li key={a.id} className="border-b border-line pb-2 text-sm last:border-0">
                  <p className="font-semibold">{a.titleNe}</p>
                  <p className="text-ink-muted">{a.bodyNe}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {a.officer.fullName}, {a.ward ? `${wardLabel(a.ward)}, ` : ""}
                    {date(a.publishedAt)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
