"use client";

import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { Card, inputClass, PrimaryButton, Shell, StateMessage, useMe } from "@/components/shell";
import { api } from "@/lib/api";
import { ROLE_LABEL, useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface OfficerRow {
  id: string;
  fullName: string;
  designation: string | null;
  user: { phoneNumber: string | null; role: keyof typeof ROLE_LABEL | null; banned: boolean | null };
  localLevel: { id: number; nameNe: string; nameEn: string };
}
interface LocalLevel {
  id: number;
  nameNe: string;
  nameEn: string;
}

/** Super admin: agriculture-officer accounts. */
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
              </tr>
            </thead>
            <tbody>
              {officers.data?.map((o) => {
                const role = o.user.role ? ROLE_LABEL[o.user.role] : null;
                return (
                  <tr key={o.id} className="border-t border-line">
                    <td className="py-2 font-semibold">
                      {o.fullName}
                      {o.designation && <span className="block text-xs font-normal text-ink-muted">{o.designation}</span>}
                    </td>
                    <td>{o.user.phoneNumber}</td>
                    <td>{role ? tr(role[0], role[1]) : ""}</td>
                    <td>{tr(o.localLevel.nameNe, o.localLevel.nameEn)}</td>
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
