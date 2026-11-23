"use client";

import { KeyRound, Lock, LockOpen, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Card, inputClass, PrimaryButton, Shell, StateMessage, useMe } from "@/components/shell";
import { api } from "@/lib/api";
import { ROLE_LABEL, useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface OfficerRow {
  id: string;
  fullName: string;
  designation: string | null;
  user: { id: string; phoneNumber: string | null; role: keyof typeof ROLE_LABEL | null; banned: boolean | null };
  localLevel: { id: number; nameNe: string; nameEn: string };
}
interface LocalLevel {
  id: number;
  nameNe: string;
  nameEn: string;
}

export default function OfficersPage() {
  const { tr } = useLang();
  const { data: me } = useMe();
  const isAdmin = me?.role === "SUPER_ADMIN";
  const officers = useApi<OfficerRow[]>(isAdmin ? "/v1/officers" : null);
  const localLevels = useApi<LocalLevel[]>(isAdmin ? "/v1/geo/local-levels" : null);

  const [form, setForm] = useState({ mobile: "", fullName: "", designation: "", localLevelId: "" });
  const [created, setCreated] = useState<{ mobile: string; temporaryPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ mobile: string; temporaryPassword: string }>("/v1/officers", {
        method: "POST",
        body: JSON.stringify({ ...form, designation: form.designation || undefined, localLevelId: Number(form.localLevelId) }),
      });
      setCreated(res);
      setForm({ mobile: "", fullName: "", designation: "", localLevelId: "" });
      await officers.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("खाता बनाउन सकिएन", "Could not create the account"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleAccess(o: OfficerRow) {
    const turningOff = !o.user.banned;
    const reason = turningOff ? window.prompt(tr(`${o.fullName} को खाता बन्द गर्ने कारण (जस्तै: सरुवा)`, `Why turn off ${o.fullName}'s account? (for example: transferred)`)) : null;
    if (turningOff && reason === null) return;
    if (!turningOff && !window.confirm(tr(`${o.fullName} को खाता फेरि खोल्ने?`, `Turn ${o.fullName}'s account back on?`))) return;
    setBusyId(o.user.id);
    setError(null);
    try {
      await api(`/v1/officers/${o.user.id}/access`, { method: "POST", body: JSON.stringify({ disabled: turningOff, reason: reason || undefined }) });
      await officers.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("खाता बदल्न सकिएन", "Could not change the account"));
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(o: OfficerRow) {
    if (!window.confirm(tr(`${o.fullName} लाई नयाँ अस्थायी पासवर्ड दिने? पुरानो पासवर्ड काम गर्दैन।`, `Give ${o.fullName} a new temporary password? The old one stops working.`))) return;
    setBusyId(o.user.id);
    setError(null);
    try {
      setCreated(await api<{ mobile: string; temporaryPassword: string }>(`/v1/officers/${o.user.id}/password`, { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("पासवर्ड दिन सकिएन", "Could not issue the password"));
    } finally {
      setBusyId(null);
    }
  }

  if (me && !isAdmin) {
    return (
      <Shell title={tr("कृषि अधिकृतहरू", "Officers")}>
        <p className="text-sm text-danger">{tr("यो पृष्ठ सुपर एडमिनका लागि मात्र हो।", "This page is for the super admin only.")}</p>
      </Shell>
    );
  }

  return (
    <Shell title={tr("कृषि अधिकृतहरू", "Agriculture officers")} subtitle={tr("सुपर एडमिन", "Super admin")}>
      {created && (
        <div role="status" className="mb-4 rounded-xl border-2 border-accent bg-white p-4 text-sm">
          <p className="font-semibold text-brand-800">{tr("खाता बन्यो। अस्थायी पासवर्ड (एक पटक मात्र देखिन्छ):", "Account created. Temporary password (shown once):")}</p>
          <p className="mt-1">
            {tr("मोबाइल", "Mobile")} <span className="font-heading">{created.mobile}</span>:{" "}
            <span className="select-all rounded bg-surface-muted px-2 py-0.5 font-heading text-lg tracking-wider">{created.temporaryPassword}</span>
          </p>
          <button onClick={() => setCreated(null)} className="mt-2 font-semibold text-brand-700 hover:underline">
            {tr("बन्द गर्नुहोस्", "Close")}
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon={UserPlus} title={tr("नयाँ कृषि अधिकृत", "New agriculture officer")}>
          <form onSubmit={create} className="space-y-3 text-sm">
            <label className="block">
              {tr("मोबाइल नम्बर", "Mobile number")}
              <input className={`mt-1 ${inputClass}`} inputMode="numeric" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} required />
            </label>
            <label className="block">
              {tr("पूरा नाम", "Full name")}
              <input className={`mt-1 ${inputClass}`} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            </label>
            <label className="block">
              {tr("पद", "Designation")}
              <input className={`mt-1 ${inputClass}`} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </label>
            <label className="block">
              {tr("स्थानीय तह (कृषि शाखा)", "Local level (agriculture section)")}
              <select className={`mt-1 ${inputClass}`} value={form.localLevelId} onChange={(e) => setForm({ ...form, localLevelId: e.target.value })} required>
                <option value="">{tr("छान्नुहोस्", "Choose")}</option>
                {localLevels.data?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {tr(l.nameNe, l.nameEn)}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="text-danger">{error}</p>}
            <PrimaryButton type="submit" disabled={busy} className="w-full">
              {busy ? tr("बनाउँदै", "Creating") : tr("खाता बनाउनुहोस्", "Create account")}
            </PrimaryButton>
          </form>
        </Card>

        <Card icon={Users} title={tr("खाताहरू", "Accounts")} className="overflow-x-auto lg:col-span-2">
          <StateMessage loading={officers.loading} error={officers.error} />
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-ink-muted">
              <tr>
                <th className="py-2">{tr("नाम", "Name")}</th>
                <th>{tr("मोबाइल", "Mobile")}</th>
                <th>{tr("भूमिका", "Role")}</th>
                <th>{tr("स्थानीय तह", "Local level")}</th>
                <th>{tr("खाता", "Account")}</th>
              </tr>
            </thead>
            <tbody>
              {officers.data?.map((o) => {
                const role = o.user.role ? ROLE_LABEL[o.user.role] : null;
                const self = !!me?.phoneNumber && me.phoneNumber === o.user.phoneNumber;
                return (
                  <tr key={o.id} className="border-t border-line">
                    <td className="py-2 font-semibold">
                      {o.fullName}
                      {o.designation && <span className="block text-xs font-normal text-ink-muted">{o.designation}</span>}
                    </td>
                    <td>{o.user.phoneNumber}</td>
                    <td>{role ? tr(role[0], role[1]) : ""}</td>
                    <td>{tr(o.localLevel.nameNe, o.localLevel.nameEn)}</td>
                    <td className="flex flex-wrap items-center gap-2 py-2">
                      {o.user.banned && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-danger">
                          <Lock className="size-3" aria-hidden /> {tr("बन्द", "Off")}
                        </span>
                      )}
                      <button
                        onClick={() => resetPassword(o)}
                        disabled={busyId === o.user.id}
                        className="flex items-center gap-1 rounded-md border border-brand-700 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-surface-muted disabled:opacity-50"
                      >
                        <KeyRound className="size-3" /> {tr("पासवर्ड रिसेट", "Reset password")}
                      </button>
                      {!self && (
                        <button
                          onClick={() => toggleAccess(o)}
                          disabled={busyId === o.user.id}
                          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-surface-muted disabled:opacity-50 ${o.user.banned ? "border-brand-700 text-brand-700" : "border-danger text-danger"}`}
                        >
                          {o.user.banned ? <LockOpen className="size-3" /> : <Lock className="size-3" />}
                          {o.user.banned ? tr("खाता खोल्नुहोस्", "Turn on") : tr("खाता बन्द", "Turn off")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </Shell>
  );
}
