"use client";

import { AlertTriangle, HandCoins, PackageCheck, Plus, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, inputClass, PrimaryButton, SecondaryButton, Shell, StateMessage } from "@/components/shell";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

type Kind = "FERTILIZER" | "SEED" | "PESTICIDE" | "MACHINERY" | "OTHER";

interface Scheme {
  id: string;
  name: string;
  kind: Kind;
  product: string | null;
  unit: string;
  fiscalYearBs: string;
  totalStock: number | null;
  allocations: number;
  allocatedQty: number;
  deliveredQty: number;
  deliveredCount: number;
}

interface PlanLine {
  farmerId: string;
  farmerNameNe?: string;
  needKg: number;
  priority: number;
  allocatedKg: number;
  flags: string[];
}

interface Allocation {
  id: string;
  farmerNameNe: string;
  ward: number;
  tole: string;
  needQty: number;
  allocatedQty: number;
  deliveredQty: number | null;
  status: "PLANNED" | "APPROVED" | "DELIVERED" | "CANCELLED";
  priorityScore: number | null;
  flags: string[];
}

const KIND: Record<Kind, readonly [string, string]> = {
  FERTILIZER: ["मल", "Fertilizer"],
  SEED: ["बीउ", "Seed"],
  PESTICIDE: ["विषादी", "Pesticide"],
  MACHINERY: ["कृषि यन्त्र", "Machinery"],
  OTHER: ["अन्य", "Other"],
};

const FLAG: Record<string, readonly [string, string]> = {
  NO_CULTIVATION_DECLARED: ["यो मौसम खेती घोषणा छैन", "No cultivation declared this season"],
  CULTIVATED_EXCEEDS_REGISTERED_AREA: ["खेती क्षेत्र दर्ता भन्दा बढी", "Cultivated area exceeds registered land"],
  CLAIM_EXCEEDS_REGISTERED_AREA: ["दाबी दर्ता भन्दा बढी", "Claim exceeds registered land"],
  DELIVERY_EXCEEDS_NEED: ["वितरण आवश्यकताभन्दा धेरै", "Delivery exceeds need"],
};

export default function SubsidyPage() {
  const { tr, num } = useLang();
  const schemes = useApi<Scheme[]>("/v1/subsidies/schemes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = schemes.data?.find((s) => s.id === selectedId) ?? null;
  const allocations = useApi<Allocation[]>(selectedId ? `/v1/subsidies/schemes/${selectedId}/allocations` : null);

  const [preview, setPreview] = useState<{ totals: { needKg: number; allocatedKg: number; flagged: number }; lines: PlanLine[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "FERTILIZER" as Kind, product: "Urea", unit: "kg", totalStock: "" });
  const [deliverQty, setDeliverQty] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedId && schemes.data?.[0]) setSelectedId(schemes.data[0].id);
  }, [schemes.data, selectedId]);
  useEffect(() => setPreview(null), [selectedId]);

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("त्रुटि भयो", "Something went wrong"));
    } finally {
      setBusy(null);
    }
  }

  const createScheme = (e: React.FormEvent) => {
    e.preventDefault();
    void run("create", async () => {
      const s = await api<Scheme>("/v1/subsidies/schemes", {
        method: "POST",
        body: JSON.stringify({ name: form.name, kind: form.kind, product: form.product, unit: form.unit, totalStock: Number(form.totalStock) }),
      });
      setShowForm(false);
      setForm({ name: "", kind: "FERTILIZER", product: "Urea", unit: "kg", totalStock: "" });
      await schemes.reload();
      setSelectedId(s.id);
    });
  };

  const plan = (save: boolean) =>
    run(save ? "save" : "preview", async () => {
      if (!selectedId) return;
      const res = await api<{ totals: { needKg: number; allocatedKg: number; flagged: number }; lines: PlanLine[] }>(`/v1/subsidies/schemes/${selectedId}/plan`, {
        method: "POST",
        body: JSON.stringify({ save }),
      });
      setPreview(res);
      if (save) await Promise.all([allocations.reload(), schemes.reload()]);
    });

  const deliver = (a: Allocation) =>
    run(a.id, async () => {
      const qty = Number(deliverQty[a.id] ?? a.allocatedQty);
      await api(`/v1/subsidies/allocations/${a.id}/deliver`, { method: "POST", body: JSON.stringify({ deliveredQty: qty }) });
      await Promise.all([allocations.reload(), schemes.reload()]);
    });

  const unit = selected?.unit ?? "kg";
  const flagText = (f: string) => (FLAG[f] ? tr(FLAG[f][0], FLAG[f][1]) : f);

  return (
    <Shell
      title={tr("अनुदान वितरण", "Subsidy distribution")}
      subtitle={tr("खेती क्षेत्र र बाली अनुसार आवश्यकतामा आधारित वितरण", "Need-based distribution from cultivated area and crop")}
      action={
        <PrimaryButton onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1">
          <Plus className="size-4" /> {tr("नयाँ योजना", "New scheme")}
        </PrimaryButton>
      }
    >
      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}

      {showForm && (
        <Card icon={Plus} title={tr("नयाँ अनुदान योजना", "New subsidy scheme")} className="mb-4">
          <form onSubmit={createScheme} className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            <label className="lg:col-span-2">
              {tr("योजनाको नाम", "Scheme name")}
              <input className={`mt-1 ${inputClass}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
            </label>
            <label>
              {tr("प्रकार", "Type")}
              <select className={`mt-1 ${inputClass}`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
                {(Object.keys(KIND) as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {tr(KIND[k][0], KIND[k][1])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("सामग्री", "Product")}
              {form.kind === "FERTILIZER" ? (
                <select className={`mt-1 ${inputClass}`} value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })}>
                  <option>Urea</option>
                  <option>DAP</option>
                  <option>MOP</option>
                </select>
              ) : (
                <input className={`mt-1 ${inputClass}`} value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} required />
              )}
            </label>
            <label>
              {tr("उपलब्ध मौज्दात", "Available stock")} ({form.unit})
              <input type="number" min={1} className={`mt-1 ${inputClass}`} value={form.totalStock} onChange={(e) => setForm({ ...form, totalStock: e.target.value })} required />
            </label>
            <div className="sm:col-span-2 lg:col-span-5">
              <PrimaryButton type="submit" disabled={busy === "create"}>
                {tr("योजना बनाउनुहोस्", "Create scheme")}
              </PrimaryButton>
            </div>
          </form>
          {form.kind !== "FERTILIZER" && (
            <p className="mt-2 text-xs text-ink-muted">
              {tr("आवश्यकता गणना हाल मल (Urea, DAP, MOP) का लागि मात्र उपलब्ध छ।", "Need calculation is currently available for fertilizer (Urea, DAP, MOP) only.")}
            </p>
          )}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon={HandCoins} title={tr("योजनाहरू", "Schemes")}>
          <StateMessage loading={schemes.loading && !schemes.data} error={schemes.error} />
          {schemes.data?.length === 0 && <p className="text-sm text-ink-muted">{tr("अहिलेसम्म कुनै योजना छैन।", "No schemes yet.")}</p>}
          <ul className="space-y-2">
            {schemes.data?.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelectedId(s.id)}
                  aria-pressed={s.id === selectedId}
                  className={`w-full rounded-lg border p-3 text-left text-sm ${s.id === selectedId ? "border-accent bg-accent/10" : "border-line hover:bg-surface-muted"}`}
                >
                  <span className="block font-semibold">{s.name}</span>
                  <span className="text-xs text-ink-muted">
                    {tr(KIND[s.kind][0], KIND[s.kind][1])}
                    {s.product ? `, ${s.product}` : ""}. {tr("आ.व.", "FY")} {s.fiscalYearBs}
                  </span>
                  <span className="mt-2 block text-xs">
                    {tr("वितरित", "Delivered")} {num(s.deliveredQty)} / {tr("बाँडफाँड", "allocated")} {num(s.allocatedQty)} / {tr("मौज्दात", "stock")} {num(s.totalStock ?? 0)} {s.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {selected && (
            <Card
              title={selected.name}
              action={
                <div className="flex gap-2">
                  <SecondaryButton onClick={() => plan(false)} disabled={!!busy}>
                    {tr("योजना पूर्वावलोकन", "Preview plan")}
                  </SecondaryButton>
                  <PrimaryButton onClick={() => plan(true)} disabled={!!busy}>
                    {tr("योजना सुरक्षित गर्नुहोस्", "Save plan")}
                  </PrimaryButton>
                </div>
              }
            >
              <p className="text-sm text-ink-muted">
                {tr(
                  "आवश्यकता = घोषित खेती क्षेत्र × सिफारिस मात्रा। मौज्दात कम भए साना, अधिया र प्रमाणित कृषकलाई प्राथमिकता दिइन्छ। खेती घोषणा नभएका वा दर्ता भन्दा बढी दाबी भएकालाई रोकिन्छ।",
                  "Need = declared cultivated area × recommended dose. When stock is short, smallholders, tenants and verified farmers get priority. Farmers with no declaration or claims above their registered land are held back.",
                )}
              </p>
              {preview && (
                <div className="mt-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Stat label={tr("कुल आवश्यकता", "Total need")} value={`${num(preview.totals.needKg)} ${unit}`} />
                    <Stat label={tr("बाँडफाँड", "Allocated")} value={`${num(preview.totals.allocatedKg)} ${unit}`} tone="text-brand-500" />
                    <Stat label={tr("जाँच चाहिने", "Flagged")} value={num(preview.totals.flagged)} tone="text-danger" />
                  </div>
                  <div className="mt-3 max-h-72 overflow-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="text-left text-ink-muted">
                        <tr>
                          <th className="py-2">{tr("कृषक", "Farmer")}</th>
                          <th>{tr("आवश्यकता", "Need")}</th>
                          <th>{tr("प्राथमिकता", "Priority")}</th>
                          <th>{tr("बाँडफाँड", "Allocated")}</th>
                          <th>{tr("जाँच", "Checks")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.lines.map((l) => (
                          <tr key={l.farmerId} className="border-t border-line">
                            <td className="py-1.5">{l.farmerNameNe}</td>
                            <td>{num(l.needKg)}</td>
                            <td>{num(l.priority)}</td>
                            <td className="font-semibold">{num(l.allocatedKg)}</td>
                            <td className="text-xs text-danger">{l.flags.map(flagText).join(", ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          )}

          {selected && (
            <Card icon={Truck} title={tr("वितरण विवरण", "Deliveries")}>
              <StateMessage loading={allocations.loading && !allocations.data} error={allocations.error} />
              {allocations.data?.length === 0 && (
                <p className="text-sm text-ink-muted">{tr("योजना सुरक्षित गरेपछि यहाँ कृषक अनुसार वितरण देखिन्छ।", "Save the plan to see per-farmer deliveries here.")}</p>
              )}
              {!!allocations.data?.length && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-left text-ink-muted">
                      <tr>
                        <th className="py-2">{tr("कृषक", "Farmer")}</th>
                        <th>{tr("वडा", "Ward")}</th>
                        <th>{tr("बाँडफाँड", "Allocated")}</th>
                        <th>{tr("वितरित", "Delivered")}</th>
                        <th>{tr("जाँच", "Checks")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.data.map((a) => (
                        <tr key={a.id} className="border-t border-line align-top">
                          <td className="py-2 font-semibold">{a.farmerNameNe}</td>
                          <td>{num(a.ward)}</td>
                          <td>
                            {num(a.allocatedQty)} {unit}
                          </td>
                          <td>{a.status === "DELIVERED" ? `${num(a.deliveredQty ?? 0)} ${unit}` : tr("बाँकी", "Pending")}</td>
                          <td className="text-xs text-danger">
                            {a.flags.length > 0 && (
                              <span className="flex items-start gap-1">
                                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                                {a.flags.map(flagText).join(", ")}
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            {a.status !== "DELIVERED" && a.allocatedQty > 0 && (
                              <span className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  aria-label={tr("वितरित मात्रा", "Delivered quantity")}
                                  className="w-20 rounded-md border border-line px-2 py-1"
                                  value={deliverQty[a.id] ?? String(a.allocatedQty)}
                                  onChange={(e) => setDeliverQty({ ...deliverQty, [a.id]: e.target.value })}
                                />
                                <button
                                  onClick={() => deliver(a)}
                                  disabled={busy === a.id}
                                  className="flex items-center gap-1 rounded-md bg-brand-800 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
                                >
                                  <PackageCheck className="size-3" /> {tr("वितरण", "Deliver")}
                                </button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value, tone = "text-brand-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`font-heading text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
