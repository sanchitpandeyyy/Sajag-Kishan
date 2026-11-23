"use client";

import { Download, Printer } from "lucide-react";
import { Card, SecondaryButton, Shell, StateMessage, useMe } from "@/components/shell";
import { SEASON_LABEL, useLang } from "@/lib/i18n";
import { CROP_EN, type MapSummary } from "@/lib/types";
import { useApi } from "@/lib/use-api";

interface FarmerRow {
  nameNe: string;
  ward: number;
  tole: string;
  totalAreaM2: number;
  parcels: number;
  mappedParcels: number;
  verifiedParcels: number;
  hasPassword: boolean;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ha = (m2: number) => Math.round((m2 / 10_000) * 100) / 100;

export default function ReportsPage() {
  const { tr, num, lang } = useLang();
  const { data: me } = useMe();
  const summary = useApi<MapSummary>("/v1/map/summary");
  const farmers = useApi<FarmerRow[]>("/v1/farmers");
  const s = summary.data;
  const t = s?.totals;
  const season = s ? SEASON_LABEL[s.season] : null;
  const place = me?.officer?.localLevel ? tr(me.officer.localLevel.nameNe, me.officer.localLevel.nameEn) : "";
  const stamp = new Date().toISOString().slice(0, 10);
  const today = new Date().toLocaleDateString(lang === "ne" ? "ne-NP" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  const wardCsv = () =>
    s &&
    downloadCsv(`ward-land-${s.fiscalYearBs.replace("/", "-")}-${stamp}.csv`, [
      ["ward", "registered_ha", "cultivated_ha", "fallow_or_no_data_ha", "fertilized_ha", "parcels"],
      ...s.wards.map((w) => [w.number ?? "", ha(w.registeredM2), ha(w.cultivatedM2), ha(w.fallowM2), ha(w.fertilizedM2), w.parcels]),
    ]);

  const cropCsv = () =>
    s &&
    downloadCsv(`crops-${s.fiscalYearBs.replace("/", "-")}-${stamp}.csv`, [
      ["crop", "crop_ne", "area_ha", "parcels"],
      ...s.totals.byCrop.map((c) => [CROP_EN[c.crop] ?? c.crop, c.nameNe, ha(c.areaM2), c.parcels]),
      [],
      ["fertilizer", "demand_kg", "sacks_50kg"],
      ...Object.entries(s.fertilizerDemandKg).map(([p, kg]) => [p, Math.round(kg), Math.ceil(kg / 50)]),
    ]);

  const farmerCsv = () =>
    farmers.data &&
    downloadCsv(`farmers-${stamp}.csv`, [
      ["name_ne", "ward", "tole", "land_ha", "parcels", "mapped_parcels", "verified_parcels", "app_account"],
      ...farmers.data.map((f) => [f.nameNe, f.ward, f.tole, ha(f.totalAreaM2), f.parcels, f.mappedParcels, f.verifiedParcels, f.hasPassword ? "yes" : "no"]),
    ]);

  return (
    <Shell
      title={tr("प्रतिवेदन", "Reports")}
      subtitle={tr("सरकारी प्रयोजनका लागि जग्गा, बाली र मल प्रतिवेदन", "Land, crop and fertilizer reports for government use")}
      action={
        <SecondaryButton onClick={() => window.print()} className="flex items-center gap-1">
          <Printer className="size-4" /> {tr("प्रिन्ट / PDF", "Print / PDF")}
        </SecondaryButton>
      }
    >
      <StateMessage loading={summary.loading && !s} error={summary.error ?? farmers.error} />

      <div className="no-print mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: tr("वडागत जग्गा (CSV)", "Land by ward (CSV)"), fn: wardCsv },
          { label: tr("बाली र मल माग (CSV)", "Crops and fertilizer (CSV)"), fn: cropCsv },
          { label: tr("कृषक सूची (CSV)", "Farmer list (CSV)"), fn: farmerCsv },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.fn}
            disabled={!s}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white p-4 font-semibold text-brand-800 shadow-sm hover:border-brand-500 disabled:opacity-50"
          >
            <Download className="size-5 text-brand-500" /> {b.label}
          </button>
        ))}
      </div>

      {s && t && season && (
        <Card>
          <article className="space-y-6">
            <header className="border-b border-line pb-4">
              <p className="text-sm text-ink-muted">{tr("कृषि दृष्टि, कृषि शाखा", "Krishi Dristi, agriculture office")}</p>
              <h2 className="text-2xl font-bold text-brand-800">{tr(`कृषि भूमि तथा बाली प्रतिवेदन, ${place}`, `Agricultural land and crop report, ${place}`)}</h2>
              <p className="text-sm text-ink-muted">
                {tr(`आ.व. ${s.fiscalYearBs}, ${season[0]} मौसम. मिति: ${today}`, `FY ${s.fiscalYearBs}, ${season[1]} season. Date: ${today}`)}
              </p>
            </header>

            <section>
              <h3 className="mb-2 font-semibold text-brand-800">{tr("१. जग्गाको सारांश", "1. Land summary")}</h3>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    [tr("कुल दर्ता जग्गा", "Registered land"), t.registeredM2],
                    [tr("खेती गरिएको", "Cultivated"), t.cultivatedM2],
                    [tr("घोषित बाँझो", "Declared fallow"), t.declaredFallowM2],
                    [tr("विवरण नभएको", "No declaration"), t.noDataM2],
                    [tr("मल प्रयोग भएको", "Fertilized"), t.fertilizedM2],
                    [tr("प्रमाणित खेत", "Verified parcels"), t.verifiedM2],
                  ].map(([label, m2]) => (
                    <tr key={label as string} className="border-t border-line">
                      <td className="py-1.5">{label}</td>
                      <td className="text-right font-semibold">
                        {num((m2 as number) / 10_000)} {tr("हेक्टर", "ha")}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-line">
                    <td className="py-1.5">{tr("कुल खेत", "Total parcels")}</td>
                    <td className="text-right font-semibold">{num(t.parcels)}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-brand-800">{tr("२. बाली अनुसार क्षेत्रफल", "2. Area by crop")}</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-ink-muted">
                  <tr>
                    <th className="py-1">{tr("बाली", "Crop")}</th>
                    <th className="text-right">{tr("क्षेत्रफल (हे.)", "Area (ha)")}</th>
                    <th className="text-right">{tr("खेत", "Parcels")}</th>
                  </tr>
                </thead>
                <tbody>
                  {t.byCrop.map((c) => (
                    <tr key={c.crop} className="border-t border-line">
                      <td className="py-1.5">{tr(c.nameNe, CROP_EN[c.crop] ?? c.crop)}</td>
                      <td className="text-right">{num(c.areaM2 / 10_000)}</td>
                      <td className="text-right">{num(c.parcels)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-brand-800">{tr("३. मलको अनुमानित माग", "3. Estimated fertilizer demand")}</h3>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(s.fertilizerDemandKg).map(([p, kg]) => (
                    <tr key={p} className="border-t border-line">
                      <td className="py-1.5">{p}</td>
                      <td className="text-right">
                        {num(Math.round(kg))} {tr("केजी", "kg")}
                      </td>
                      <td className="text-right font-semibold">
                        {num(Math.ceil(kg / 50))} {tr("बोरा", "sacks")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section>
              <h3 className="mb-2 font-semibold text-brand-800">{tr("४. वडागत विवरण", "4. Ward detail")}</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-ink-muted">
                  <tr>
                    <th className="py-1">{tr("वडा", "Ward")}</th>
                    <th className="text-right">{tr("दर्ता", "Registered")}</th>
                    <th className="text-right">{tr("खेती", "Cultivated")}</th>
                    <th className="text-right">{tr("बाँझो/विवरण नभएको", "Fallow / no data")}</th>
                    <th className="text-right">{tr("मल प्रयोग", "Fertilized")}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.wards.map((w) => (
                    <tr key={w.wardId} className="border-t border-line">
                      <td className="py-1.5">{num(w.number ?? 0)}</td>
                      <td className="text-right">{num(w.registeredM2 / 10_000)}</td>
                      <td className="text-right">{num(w.cultivatedM2 / 10_000)}</td>
                      <td className="text-right">{num(w.fallowM2 / 10_000)}</td>
                      <td className="text-right">{num(w.fertilizedM2 / 10_000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-ink-muted">{tr("एकाइ: हेक्टर", "Unit: hectares")}</p>
            </section>

            <footer className="border-t border-line pt-3 text-xs text-ink-muted">
              {tr(
                "स्रोत: सरकारी कृषक दर्ता, कृषक घोषणा र वितरित अनुदान। मलको माग प्रारम्भिक सिफारिस मात्रामा आधारित अनुमान हो। व्यक्तिगत विवरण (मोबाइल, नागरिकता) यस प्रतिवेदनमा समावेश छैन।",
                "Sources: government farmer registry, farmer declarations and delivered subsidy. Fertilizer demand is an estimate from initial recommended doses. Personal details (mobile, citizenship) are not included.",
              )}
            </footer>
          </article>
        </Card>
      )}
    </Shell>
  );
}
