"use client";

import { KeyRound, Search, Smartphone, Users } from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import Link from "next/link";
import { useState } from "react";
import { Card, inputClass, SecondaryButton, Shell, StateMessage } from "@/components/shell";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface FarmerRow {
  id: string;
  nameNe: string;
  mobile: string | null;
  hasPassword: boolean;
  ward: number;
  tole: string;
  citizenshipNo: string;
  totalAreaM2: number;
  parcels: number;
  mappedParcels: number;
  verifiedParcels: number;
  source: string;
}
interface Issued {
  farmerId: string;
  nameNe: string;
  mobile: string | null;
  temporaryPassword: string;
}

export default function FarmersPage() {
  const { tr, num } = useLang();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useApi<FarmerRow[]>(`/v1/farmers${query ? `?q=${encodeURIComponent(query)}` : ""}`);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  async function issue(f: FarmerRow) {
    const message = f.hasPassword
      ? tr(`${f.nameNe}: नयाँ अस्थायी पासवर्ड जारी गर्दा पुरानो पासवर्ड काम गर्दैन। जारी गर्ने?`, `${f.nameNe}: issuing a new temporary password stops the old one working. Continue?`)
      : tr(`${f.nameNe}: अस्थायी पासवर्ड जारी गर्ने?`, `Issue a temporary password to ${f.nameNe}?`);
    if (!window.confirm(message)) return;
    setBusyId(f.id);
    setIssueError(null);
    try {
      const res = await api<{ mobile: string | null; temporaryPassword: string }>(`/v1/farmers/${f.id}/password`, { method: "POST" });
      setIssued({ farmerId: f.id, nameNe: f.nameNe, ...res });
      await reload();
    } catch (e) {
      setIssueError(e instanceof Error ? e.message : tr("जारी गर्न सकिएन", "Could not issue the password"));
    } finally {
      setBusyId(null);
    }
  }

  const total = data?.length ?? 0;
  const withAccount = data?.filter((f) => f.hasPassword).length ?? 0;

  return (
    <Shell title={tr("कृषक र खाता", "Farmers and accounts")} subtitle={tr("तपाईंको स्थानीय तहका दर्ता भएका कृषक", "Registered farmers in your local level")}>
      {issued && (
        <div role="status" className="mb-4 rounded-xl border-2 border-accent bg-white p-4">
          <p className="font-semibold text-brand-800">{tr("अस्थायी पासवर्ड (एक पटक मात्र देखिन्छ)", "Temporary password (shown once)")}</p>
          <p className="mt-1 text-sm">
            {issued.nameNe}, {tr("मोबाइल", "mobile")} <span className="font-heading">{issued.mobile}</span>:{" "}
            <span className="select-all rounded bg-surface-muted px-2 py-0.5 font-heading text-lg tracking-wider">{issued.temporaryPassword}</span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {tr("कृषकलाई आफैं दिनुहोस्। पहिलो लगइनमा कृषकले आफ्नै पासवर्ड बनाउनुपर्छ।", "Give it to the farmer in person. They must set their own password at first sign in.")}
          </p>
          <button onClick={() => setIssued(null)} className="mt-2 text-sm font-semibold text-brand-700 hover:underline">
            {tr("बन्द गर्नुहोस्", "Close")}
          </button>
        </div>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatTile icon={Users} tone="blue" label={tr("दर्ता भएका कृषक", "Registered farmers")} value={num(total)} />
        <StatTile icon={Smartphone} tone="green" label={tr("एप खाता सक्रिय", "App account active")} value={num(withAccount)} />
        <StatTile icon={KeyRound} tone="brown" label={tr("पासवर्ड जारी गर्न बाँकी", "Waiting for a password")} value={num(total - withAccount)} />
      </div>

      <Card>
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <label className="sr-only" htmlFor="farmer-search">
            {tr("खोज्नुहोस्", "Search")}
          </label>
          <input id="farmer-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("नाम वा मोबाइल नम्बर", "Name or mobile number")} className={inputClass} />
          <SecondaryButton type="submit" className="flex items-center gap-1">
            <Search className="size-4" /> {tr("खोज्नुहोस्", "Search")}
          </SecondaryButton>
        </form>
        <StateMessage loading={loading} error={error ?? issueError} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="text-left text-ink-muted">
              <tr>
                <th className="py-2">{tr("नाम", "Name")}</th>
                <th>{tr("मोबाइल", "Mobile")}</th>
                <th>{tr("वडा, टोल", "Ward, tole")}</th>
                <th>{tr("जग्गा (हे.)", "Land (ha)")}</th>
                <th>{tr("खेत: नक्सामा / प्रमाणित", "Parcels: mapped / verified")}</th>
                <th>{tr("नागरिकता", "Citizenship")}</th>
                <th>{tr("खाता", "Account")}</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((f) => (
                <tr key={f.id} className="border-t border-line">
                  <td className="py-2 font-semibold">
                    <Link href={`/farmers/${f.id}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                      {f.nameNe}
                    </Link>
                  </td>
                  <td>{f.mobile}</td>
                  <td>
                    {num(f.ward)}, {f.tole}
                  </td>
                  <td>{num(f.totalAreaM2 / 10_000)}</td>
                  <td>
                    {num(f.parcels)}: {num(f.mappedParcels)} / {num(f.verifiedParcels)}
                  </td>
                  <td className="font-mono text-xs">{f.citizenshipNo}</td>
                  <td>
                    <button
                      onClick={() => issue(f)}
                      disabled={busyId === f.id}
                      className="flex items-center gap-1 rounded-md border border-brand-700 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-surface-muted disabled:opacity-50"
                    >
                      <KeyRound className="size-3" />
                      {f.hasPassword ? tr("पासवर्ड रिसेट", "Reset Password") : tr("पासवर्ड जारी", "Issue password")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.length === 0 && <p className="py-4 text-sm text-ink-muted">{tr("कुनै कृषक भेटिएन।", "No farmers found.")}</p>}
        </div>
      </Card>
    </Shell>
  );
}

