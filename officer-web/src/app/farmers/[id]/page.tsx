"use client";

import { ArrowLeft, CheckCircle2, HandCoins, MapPin, MapPinOff, User, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { FieldImages } from "@/components/field-images";
import { FieldPhotos } from "@/components/field-photos";
import { ParcelMap } from "@/components/parcel-map";
import { FieldGreenness } from "@/components/satellite";
import { Card, inputClass, PrimaryButton, Shell, StateMessage } from "@/components/shell";
import { api } from "@/lib/api";
import { SEASON_LABEL, useLang } from "@/lib/i18n";
import { CROP_EN } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Season = keyof typeof SEASON_LABEL;

interface FarmerDetail {
  id: string;
  nameNe: string;
  nameEn: string | null;
  mobile: string | null;
  hasPassword: boolean;
  mustChangePassword: boolean;
  gender: string;
  dobBs: string;
  education: string;
  farmingSectors: string[];
  farmingMonthsPerYear: number;
  citizenshipNo: string;
  ward: number;
  tole: string;
  localLevel: { nameNe: string; nameEn: string };
  parcels: {
    id: string;
    ward: number;
    tole: string;
    kittaNo: string | null;
    areaM2: number;
    ownershipType: string;
    irrigation: string;
    verification: "UNVERIFIED" | "VERIFIED" | "DISPUTED";
    mapped: boolean;
    lat: number | null;
    lng: number | null;
    localName: string | null;
    elevationM: number | null;
    declarations: { id: string; fiscalYearBs: string; season: Season; crop: { code: string; nameNe: string; nameEn: string }; sownAreaM2: number; isFallow: boolean; source: string }[];
  }[];
  allocations: { id: string; scheme: { name: string; unit: string; fiscalYearBs: string }; allocatedQty: number; deliveredQty: number | null; status: string; flags: string[] }[];
}

interface Crop {
  code: string;
  nameNe: string;
  nameEn: string;
}

const VERIFICATION = {
  UNVERIFIED: ["प्रमाणित हुन बाँकी", "Not verified"],
  VERIFIED: ["प्रमाणित", "Verified"],
  DISPUTED: ["विवादित", "Disputed"],
} as const;

export default function FarmerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tr, num } = useLang();
  const farmer = useApi<FarmerDetail>(`/v1/farmers/${id}`);
  const crops = useApi<Crop[]>("/v1/crops");
  const [cropFor, setCropFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await farmer.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("त्रुटि भयो", "Something went wrong"));
    } finally {
      setBusy(null);
    }
  }

  const f = farmer.data;
  const cropName = (c: { code: string; nameNe: string }) => tr(c.nameNe, CROP_EN[c.code] ?? c.code);

  return (
    <Shell
      title={f?.nameNe ?? tr("कृषक", "Farmer")}
      subtitle={f ? `${tr(f.localLevel.nameNe, f.localLevel.nameEn)}, ${tr("वडा", "ward")} ${num(f.ward)}, ${f.tole}` : undefined}
      action={
        <Link href="/farmers" className="inline-flex min-h-12 items-center gap-2 rounded-control px-3 font-semibold text-ink hover:bg-fill">
          <ArrowLeft className="size-4" /> {tr("सबै कृषक", "All farmers")}
        </Link>
      }
    >
      <StateMessage loading={farmer.loading && !f} error={farmer.error ?? error} />

      {f && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card icon={User} title={tr("विवरण", "Details")}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-small">
              {[
                [tr("मोबाइल", "Mobile"), f.mobile ?? ""],
                [tr("नागरिकता", "Citizenship"), f.citizenshipNo],
                [tr("जन्म मिति (वि.सं.)", "Date of birth (BS)"), f.dobBs],
                [tr("शिक्षा", "Education"), f.education],
                [tr("कृषि क्षेत्र", "Farming sector"), f.farmingSectors.join(", ")],
                [tr("वर्षमा कृषि (महिना)", "Months farming a year"), num(f.farmingMonthsPerYear)],
                [
                  tr("एप खाता", "App account"),
                  !f.hasPassword ? tr("पासवर्ड जारी हुन बाँकी", "No password yet") : f.mustChangePassword ? tr("अस्थायी पासवर्ड", "Temporary password") : tr("सक्रिय", "Active"),
                ],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="flex flex-col gap-6 lg:col-span-2">
            {f.parcels.length === 0 && (
              <Card>
                <p className="text-body">{tr("यो कृषकको खेत दर्ता छैन।", "This farmer has no registered field.")}</p>
              </Card>
            )}

            {f.parcels.some((p) => p.lat != null && p.lng != null) && (
              <Card icon={MapPin} title={tr("खेतहरू नक्सामा", "Fields on the map")}>
                <ParcelMap
                  height="h-[320px]"
                  features={f.parcels
                    .filter((p) => p.lat != null && p.lng != null)
                    .map((p) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [p.lng!, p.lat!] as [number, number] }, properties: { id: p.id, ward: p.ward, areaM2: p.areaM2, verification: p.verification, farmerNameNe: "", tole: p.localName ?? p.tole, crop: p.declarations[0]?.crop.code ?? null, cropNe: p.declarations[0]?.crop.nameNe ?? null } }))}
                />
              </Card>
            )}

            {f.parcels.map((p, i) => {
              const v = VERIFICATION[p.verification];
              return (
                <Card
                  key={p.id}
                  title={`${tr("खेत", "Field")} ${num(i + 1)}`}
                  action={<span className={`text-small font-semibold ${p.verification === "DISPUTED" ? "text-danger" : p.verification === "VERIFIED" ? "text-brand-700" : "text-muted"}`}>{tr(v[0], v[1])}</span>}
                >
                  <dl className="grid grid-cols-2 gap-4 text-small sm:grid-cols-4">
                    {[
                      [tr("क्षेत्रफल", "Area"), `${num(p.areaM2 / 10_000)} ${tr("हे.", "ha")}`],
                      [tr("ठाउँ", "Place"), `${tr("वडा", "Ward")} ${num(p.ward)}, ${p.tole}`],
                      [tr("कित्ता नं.", "Plot no."), p.kittaNo ?? "-"],
                      [tr("उचाइ", "Elevation"), p.elevationM != null ? `${num(Math.round(p.elevationM))} m` : "-"],
                    ].map(([k, val]) => (
                      <div key={k}>
                        <dt className="text-muted">{k}</dt>
                        <dd className="font-semibold text-ink">{val}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 flex items-center gap-2 text-small text-muted">
                    {p.mapped ? <MapPin className="size-4 text-brand-700" /> : <MapPinOff className="size-4 text-soil" />}
                    {p.mapped ? tr("नक्सामा छ", "On the map") : tr("नक्सामा छैन", "Not on the map yet")}
                  </p>

                  {p.mapped && <FieldGreenness parcelId={p.id} />}
                  {p.mapped && (
                    <div className="mt-4 border-t border-line pt-4">
                      <h3 className="mb-3 font-heading text-h4 text-ink">{tr("भू-उपग्रह तस्बिर", "Satellite pictures")}</h3>
                      <FieldImages parcelId={p.id} limit={3} />
                    </div>
                  )}
                  <FieldPhotos parcelId={p.id} />

                  <div className="mt-5 border-t border-line pt-4">
                    <h3 className="font-heading text-h4 text-ink">{tr("बाली इतिहास", "Crop history")}</h3>
                    {p.declarations.length === 0 ? (
                      <p className="mt-2 text-small text-muted">{tr("कुनै बाली घोषणा छैन।", "No crop declarations.")}</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-line text-small">
                        {p.declarations.map((d) => (
                          <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
                            <span className="font-semibold text-ink">{d.isFallow ? tr("बाँझो", "Fallow") : cropName(d.crop)}</span>
                            <span className="text-muted">
                              {tr(`आ.व. ${d.fiscalYearBs}, ${SEASON_LABEL[d.season][0]}`, `FY ${d.fiscalYearBs}, ${SEASON_LABEL[d.season][1]}`)}, {num(d.sownAreaM2 / 10_000)} {tr("हे.", "ha")}
                              {d.source === "OFFICER" ? tr(" (कृषि शाखाले)", " (by office)") : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
                    <label className="min-w-[200px] flex-1 text-small font-semibold text-ink">
                      {tr("यो मौसमको बाली जनाउनुहोस्", "Record this season's crop")}
                      <select className={`mt-2 ${inputClass}`} value={cropFor[p.id] ?? ""} onChange={(e) => setCropFor({ ...cropFor, [p.id]: e.target.value })}>
                        <option value="">{tr("बाली छान्नुहोस्", "Choose a crop")}</option>
                        {crops.data?.map((c) => (
                          <option key={c.code} value={c.code}>
                            {cropName(c)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <PrimaryButton
                      disabled={!cropFor[p.id] || busy === `crop-${p.id}`}
                      onClick={() => act(`crop-${p.id}`, () => api("/v1/declarations", { method: "POST", body: JSON.stringify({ parcelId: p.id, cropCode: cropFor[p.id] }) }))}
                    >
                      {tr("सेभ गर्नुहोस्", "Save")}
                    </PrimaryButton>
                    {p.verification !== "VERIFIED" && (
                      <button
                        disabled={busy === `v-${p.id}`}
                        onClick={() => act(`v-${p.id}`, () => api(`/v1/parcels/${p.id}/verify`, { method: "POST", body: JSON.stringify({ status: "VERIFIED" }) }))}
                        className="inline-flex min-h-12 items-center gap-2 rounded-control bg-brand-800 px-4 font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-4" /> {tr("प्रमाणित गर्नुहोस्", "Verify")}
                      </button>
                    )}
                    {p.verification === "UNVERIFIED" && (
                      <button
                        disabled={busy === `d-${p.id}`}
                        onClick={() => act(`d-${p.id}`, () => api(`/v1/parcels/${p.id}/verify`, { method: "POST", body: JSON.stringify({ status: "DISPUTED" }) }))}
                        className="inline-flex min-h-12 items-center gap-2 rounded-control border-[1.5px] border-danger px-4 font-semibold text-danger hover:bg-fill disabled:opacity-50"
                      >
                        <XCircle className="size-4" /> {tr("विवादित", "Dispute")}
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}

            <Card icon={HandCoins} title={tr("अनुदान", "Subsidy")}>
              {f.allocations.length === 0 ? (
                <p className="text-small text-muted">
                  {tr("अहिलेसम्म कुनै अनुदान छैन।", "No subsidy yet.")}{" "}
                  <Link href="/subsidy" className="font-semibold text-brand-700 hover:underline">
                    {tr("अनुदान पृष्ठमा योजना बनाएर बाँडफाँड गर्नुहोस्", "Create a scheme and allocate on the Subsidy page")}
                  </Link>
                </p>
              ) : (
                <ul className="divide-y divide-line text-small">
                  {f.allocations.map((a) => (
                    <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                      <span className="font-semibold text-ink">{a.scheme.name}</span>
                      <span className="text-muted">
                        {a.status === "DELIVERED"
                          ? `${tr("वितरित", "Delivered")} ${num(a.deliveredQty ?? 0)} ${a.scheme.unit}`
                          : `${tr("बाँडफाँड", "Allocated")} ${num(a.allocatedQty)} ${a.scheme.unit}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </Shell>
  );
}
