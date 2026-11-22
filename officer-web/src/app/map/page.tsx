"use client";

import { CheckCircle2, ClipboardCheck, MapPinOff, Satellite, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { CropLegend, ParcelMap, type ParcelFeature } from "@/components/parcel-map";
import { SatelliteSync } from "@/components/satellite";
import { Card, Shell, StateMessage } from "@/components/shell";
import { api } from "@/lib/api";
import { SEASON_LABEL, useLang } from "@/lib/i18n";
import { CROP_EN, type MapSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

interface ParcelRow {
  id: string;
  tole: string;
  kittaNo: string | null;
  areaM2: number;
  verification: "UNVERIFIED" | "VERIFIED" | "DISPUTED";
  geometry: unknown;
  wardId: number;
  ward: { number: number };
  farmer?: { firstNameNe: string; lastNameNe: string | null };
  declarations: { crop: { code: string; nameNe: string }; season: string; isFallow: boolean }[];
}

const VERIFICATION = {
  UNVERIFIED: ["प्रमाणित हुन बाँकी", "Not verified"],
  VERIFIED: ["प्रमाणित", "Verified"],
  DISPUTED: ["विवादित", "Disputed"],
} as const;

export default function MapPage() {
  const { tr, num } = useLang();
  const [ward, setWard] = useState<string>("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const summary = useApi<MapSummary>("/v1/map/summary");
  const geo = useApi<{ features: ParcelFeature[] }>(`/v1/map/parcels${ward ? `?wardId=${ward}` : ""}`);
  const parcels = useApi<ParcelRow[]>("/v1/parcels");

  const list = useMemo(
    () => (parcels.data ?? []).filter((p) => (!ward || String(p.wardId) === ward) && (!onlyPending || p.verification !== "VERIFIED")),
    [parcels.data, ward, onlyPending],
  );
  const unmapped = (parcels.data ?? []).filter((p) => !p.geometry && (!ward || String(p.wardId) === ward)).length;

  async function verify(id: string, status: "VERIFIED" | "DISPUTED") {
    setBusy(id);
    setActionError(null);
    try {
      await api(`/v1/parcels/${id}/verify`, { method: "POST", body: JSON.stringify({ status }) });
      await Promise.all([parcels.reload(), geo.reload()]);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : tr("त्रुटि भयो", "Something went wrong"));
    } finally {
      setBusy(null);
    }
  }

  const season = summary.data ? SEASON_LABEL[summary.data.season] : null;
  const legendCrops = (summary.data?.totals.byCrop ?? []).map((c) => ({ crop: c.crop, name: tr(c.nameNe, CROP_EN[c.crop] ?? c.crop) }));

  return (
    <Shell
      title={tr("कृषि नक्सा", "KrishiMap")}
      subtitle={
        summary.data && season
          ? tr(`आ.व. ${summary.data.fiscalYearBs}, ${season[0]} मौसमको बाली घोषणा अनुसार`, `FY ${summary.data.fiscalYearBs}, ${season[1]} season crop declarations`)
          : tr("जग्गा र बाली वितरण", "Land and crop distribution")
      }
      action={
        <select value={ward} onChange={(e) => setWard(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm" aria-label={tr("वडा छान्नुहोस्", "Choose ward")}>
          <option value="">{tr("सबै वडा", "All wards")}</option>
          {summary.data?.wards.map((w) => (
            <option key={w.wardId} value={w.wardId}>
              {tr("वडा", "Ward")} {num(w.number ?? 0)}
            </option>
          ))}
        </select>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <StateMessage loading={geo.loading && !geo.data} error={geo.error} />
          <ParcelMap features={geo.data?.features ?? []} selectedId={selected} onSelect={setSelected} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <CropLegend crops={legendCrops} noCropLabel={tr("घोषणा नभएको", "No declaration")} verifiedLabel={tr("प्रमाणित", "Verified")} />
            {unmapped > 0 && (
              <p className="flex items-center gap-1 text-xs text-soil">
                <MapPinOff className="size-3" />
                {tr(`${num(unmapped)} खेतको स्थान अझै नक्सामा छैन (दर्तामा क्षेत्रफल मात्र)`, `${unmapped} parcels not mapped yet (registry area only)`)}
              </p>
            )}
          </div>
        </Card>

        <Card icon={ClipboardCheck} title={tr("खेत प्रमाणीकरण", "Parcel verification")}>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
            {tr("प्रमाणित हुन बाँकी मात्र", "Only not yet verified")}
          </label>
          <StateMessage loading={parcels.loading && !parcels.data} error={parcels.error ?? actionError} />
          <ul className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
            {list.map((p) => {
              const decl = p.declarations.find((d) => !d.isFallow);
              const cropName = decl ? tr(decl.crop.nameNe, CROP_EN[decl.crop.code] ?? decl.crop.code) : tr("बाली घोषणा छैन", "No crop declared");
              const v = VERIFICATION[p.verification];
              return (
                <li
                  key={p.id}
                  className={`rounded-lg border p-3 text-sm ${selected === p.id ? "border-accent bg-accent/10" : "border-line"}`}
                  onMouseEnter={() => setSelected(p.id)}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{p.farmer ? `${p.farmer.firstNameNe} ${p.farmer.lastNameNe ?? ""}` : ""}</span>
                    <span className={`text-xs ${p.verification === "DISPUTED" ? "text-danger" : "text-ink-muted"}`}>{tr(v[0], v[1])}</span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {tr("वडा", "Ward")} {num(p.ward.number)}, {p.tole}. {num(p.areaM2 / 10_000)} {tr("हे.", "ha")}, {cropName}
                    {p.kittaNo ? `, ${tr("कि.नं.", "plot no.")} ${p.kittaNo}` : ""}. {p.geometry ? tr("नक्सामा छ", "Mapped") : tr("नक्सा छैन", "Not mapped")}
                  </p>
                  {p.verification !== "VERIFIED" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        disabled={busy === p.id}
                        onClick={() => verify(p.id, "VERIFIED")}
                        className="flex items-center gap-1 rounded-md bg-brand-800 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-3" /> {tr("प्रमाणित गर्नुहोस्", "Verify")}
                      </button>
                      {p.verification !== "DISPUTED" && (
                        <button
                          disabled={busy === p.id}
                          onClick={() => verify(p.id, "DISPUTED")}
                          className="flex items-center gap-1 rounded-md border border-danger px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                        >
                          <XCircle className="size-3" /> {tr("विवादित", "Dispute")}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {parcels.data && list.length === 0 && <li className="text-sm text-ink-muted">{tr("प्रमाणित गर्न बाँकी खेत छैन।", "Nothing left to verify.")}</li>}
          </ul>
        </Card>

        <Card icon={Satellite} title={tr("भू-उपग्रह जाँच", "Satellite check")} className="xl:col-span-3">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <SatelliteSync onDone={summary.reload} />
            {summary.data?.satellite && (
              <dl className="grid grid-cols-3 gap-6 text-small">
                {[
                  [tr("जाँचिएका खेत", "Fields checked"), summary.data.satellite.checkedParcels],
                  [tr("हरियो देखिएका", "Seen green"), summary.data.satellite.greenParcels],
                  [tr("बेमेल", "Mismatch"), summary.data.satellite.conflictParcels],
                ].map(([k, val]) => (
                  <div key={String(k)}>
                    <dt className="text-muted">{k}</dt>
                    <dd className="tnum font-heading text-h3 text-ink">{num(Number(val))}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
