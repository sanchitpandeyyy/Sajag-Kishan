"use client";

import { AlertTriangle, BellRing, CloudRain, Megaphone, Newspaper, RefreshCw, ShieldAlert, Snowflake, Sun, Wind } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, inputClass, PrimaryButton, SecondaryButton, Shell, StateMessage, useMe } from "@/components/shell";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface Alert {
  id: string;
  wardId: number;
  type: string;
  severity: "INFO" | "WARNING" | "SEVERE";
  validFrom: string;
  titleNe: string;
  messageNe: string;
  cropCodes: string[];
  evidence: Record<string, number | string> | null;
}
interface Advisory {
  id: string;
  wardId: number | null;
  titleNe: string;
  bodyNe: string;
  publishedAt: string;
  officer: { fullName: string; designation: string | null };
}
interface Ward {
  id: number;
  number: number;
}

const TYPE_EN: Record<string, readonly [string, string]> = {
  HEAVY_RAIN: ["Heavy rain likely", "Drain fields and postpone fertilizer or pesticide application."],
  FLOOD_RISK: ["Flood / landslide risk", "A lot of rain over three days. Move livestock and stored grain to safety."],
  FROST: ["Frost likely", "Irrigate lightly in the evening and cover nurseries and vegetables."],
  HEAT: ["Extreme heat", "Irrigate morning and evening; avoid field work at midday."],
  DRY_SPELL: ["Dry spell likely", "Little rain in the next 10 days. Plan irrigation."],
  STRONG_WIND: ["Strong wind likely", "Harvest ripe crops early and secure tunnels and plastic."],
  LATE_BLIGHT: ["Late blight risk", "Inspect potato and tomato regularly and ask a technician about prevention."],
  RICE_BLAST: ["Rice blast risk", "Avoid excess nitrogen, inspect fields and report symptoms to the agriculture office."],
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
};

export default function AlertsPage() {
  const { tr, num, lang } = useLang();
  const { data: me } = useMe();
  const feed = useApi<{ alerts: Alert[]; advisories: Advisory[] }>("/v1/alerts");
  const wards = useApi<Ward[]>(me?.officer ? `/v1/geo/wards?localLevelId=${me.officer.localLevelId}` : null);
  const wardNo = useMemo(() => new Map((wards.data ?? []).map((w) => [w.id, w.number])), [wards.data]);

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
      await api("/v1/alerts/advisories", { method: "POST", body: JSON.stringify({ wardId: Number(form.wardId), titleNe: form.titleNe, bodyNe: form.bodyNe, cropCodes: [] }) });
      setForm({ wardId: form.wardId, titleNe: "", bodyNe: "" });
      setInfo(tr("सूचना प्रकाशित भयो।", "Advisory published."));
      await feed.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("प्रकाशित गर्न सकिएन", "Could not publish"));
    } finally {
      setBusy(null);
    }
  }

  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === "ne" ? "ne-NP" : "en-GB", { day: "numeric", month: "short" });
  const severityClass = { SEVERE: "border-danger bg-danger/5", WARNING: "border-warning bg-warning/10", INFO: "border-info bg-info/5" } as const;
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
                <li key={a.id} className={`rounded-lg border-l-4 p-3 ${severityClass[a.severity]}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4 shrink-0" aria-hidden />
                      {severityLabel[a.severity]}: {lang === "en" && en ? en[0] : a.titleNe}
                    </p>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {tr("वडा", "Ward")} {num(wardNo.get(a.wardId) ?? 0)}, {date(a.validFrom)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{lang === "en" && en ? en[1] : a.messageNe}</p>
                  {a.evidence && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {tr("आधार", "Based on")}:{" "}
                      {Object.entries(a.evidence)
                        .map(([k, v]) => `${k} ${v}`)
                        .join(", ")}
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
                    {a.officer.fullName}, {a.wardId ? `${tr("वडा", "Ward")} ${num(wardNo.get(a.wardId) ?? 0)}, ` : ""}
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
