"use client";

import { Download, FileSpreadsheet, ListChecks, MapPin, UploadCloud } from "lucide-react";
import { useState } from "react";
import { Card, PrimaryButton, SecondaryButton, Shell, useMe } from "@/components/shell";
import { apiForm } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface ImportReport {
  adapter: string;
  received: number;
  created: number;
  updated: number;
  parcelsCreated: number;
  errors: { index: number; message: string }[];
  archivedKey: string | null;
}

const COLUMNS = [
  "externalId",
  "mobile",
  "firstNameNe",
  "middleNameNe",
  "lastNameNe",
  "firstNameEn",
  "lastNameEn",
  "gender",
  "dobBs",
  "education",
  "wardId",
  "tole",
  "farmingWardId",
  "farmingTole",
  "citizenshipNo",
  "citizenshipDistrictId",
  "nationalId",
  "farmingSectors",
  "farmingMonthsPerYear",
  "kittaNo",
  "bigha",
  "kattha",
  "dhur",
  "ropani",
  "aana",
  "paisa",
  "daam",
];

export default function ImportPage() {
  const { tr, num } = useLang();
  const { data: me } = useMe();
  const wards = useApi<{ id: number; number: number }[]>(me?.officer ? `/v1/geo/wards?localLevelId=${me.officer.localLevelId}` : null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    const wardId = wards.data?.[0]?.id ?? 1;
    const example = [
      "REG-0001",
      "9812345678",
      "राम",
      "",
      "थारु",
      "Ram",
      "Tharu",
      "MALE",
      "2040-05-12",
      "माध्यमिक",
      wardId,
      "शिवनगर",
      wardId,
      "शिवनगर",
      "35-01-12345",
      "35",
      "",
      "अन्नबाली|तरकारी",
      "8",
      "123",
      "1",
      "5",
      "",
      "",
      "",
      "",
      "",
    ];
    const csv = "﻿" + [COLUMNS.join(","), example.join(",")].join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sajag-kishan-registry-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      setReport(await apiForm<ImportReport>("/v1/integrations/registry/import", form));
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("आयात हुन सकेन", "Import failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={tr("कृषक दर्ता आयात", "Farmer registry import")} subtitle={tr("सरकारी कृषक दर्ताबाट कृषक स्वतः समावेश गर्नुहोस्", "Enroll farmers automatically from the government registry")}>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card icon={FileSpreadsheet} title={tr("CSV फाइल अपलोड", "Upload CSV file")} className="lg:col-span-2">
          <form onSubmit={upload} className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-surface-muted px-4 py-10 text-center hover:border-brand-500">
              <UploadCloud className="size-10 text-brand-500" aria-hidden />
              <span className="font-semibold text-brand-800">{file ? file.name : tr("CSV फाइल छान्नुहोस्", "Choose a CSV file")}</span>
              <span className="text-xs text-ink-muted">{tr("बढीमा ५ MB, UTF-8 (नेपाली अक्षर सहित)", "Up to 5 MB, UTF-8 (Nepali text supported)")}</span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="submit" disabled={!file || busy} className="flex items-center gap-1">
                <FileSpreadsheet className="size-4" /> {busy ? tr("आयात हुँदैछ", "Importing") : tr("आयात गर्नुहोस्", "Import")}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={downloadTemplate} className="flex items-center gap-1">
                <Download className="size-4" /> {tr("नमुना CSV", "CSV template")}
              </SecondaryButton>
            </div>
          </form>

          {error && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {error}
            </p>
          )}

          {report && (
            <div role="status" className="mt-6">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label={tr("प्राप्त पङ्क्ति", "Rows received")} value={num(report.received)} />
                <Stat label={tr("नयाँ कृषक", "New farmers")} value={num(report.created)} tone="text-brand-500" />
                <Stat label={tr("अद्यावधिक", "Updated")} value={num(report.updated)} />
                <Stat label={tr("त्रुटि", "Errors")} value={num(report.errors.length)} tone={report.errors.length ? "text-danger" : "text-brand-800"} />
              </div>
              <p className="mt-3 text-sm text-ink-muted">
                {tr(`${num(report.parcelsCreated)} खेत दर्ता बाट बने।`, `${report.parcelsCreated} parcels created from registry land.`)}{" "}
                {report.archivedKey ? tr("मूल फाइल सुरक्षित भण्डारणमा राखियो।", "The original file was archived to storage.") : ""}
              </p>
              {report.errors.length > 0 && (
                <ul className="mt-3 max-h-60 space-y-1 overflow-auto rounded-lg bg-danger/5 p-3 text-xs text-danger">
                  {report.errors.map((e) => (
                    <li key={e.index}>
                      {tr("पङ्क्ति", "Row")} {num(e.index)}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink-muted">
                {tr(
                  "नयाँ कृषकको एप खाता पासवर्ड बिना बन्छ। 'कृषक र खाता' पृष्ठबाट अस्थायी पासवर्ड जारी गर्नुहोस्।",
                  "New farmers get an app account without a password. Issue a temporary password from the Farmers page.",
                )}
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card icon={ListChecks} title={tr("फाइल कस्तो हुनुपर्छ", "File format")}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
              <li>{tr("मोबाइल: ९८, ९७ वा ९६ बाट सुरु हुने १० अङ्क", "Mobile: 10 digits starting with 98, 97 or 96")}</li>
              <li>{tr("नाम देवनागरीमा, लिङ्ग MALE / FEMALE / OTHER", "Name in Devanagari, gender MALE / FEMALE / OTHER")}</li>
              <li>{tr("जन्म मिति वि.सं. yyyy-mm-dd", "Date of birth in BS, yyyy-mm-dd")}</li>
              <li>{tr("नागरिकता नम्बरमा / को सट्टा -", "Citizenship number with - instead of /")}</li>
              <li>{tr("जग्गा: बिघा/कट्ठा/धुर वा रोपनी/आना/पैसा/दाम", "Land: bigha/kattha/dhur or ropani/aana/paisa/daam")}</li>
              <li>{tr("एउटै नागरिकता नम्बर फेरि आए अद्यावधिक हुन्छ", "A repeated citizenship number updates the farmer")}</li>
            </ul>
          </Card>
          <Card icon={MapPin} title={tr("वडा आईडी", "Ward IDs")}>
            <p className="mb-2 text-xs text-ink-muted">{tr("wardId स्तम्भमा यो आईडी प्रयोग गर्नुहोस्।", "Use these IDs in the wardId column.")}</p>
            <div className="grid grid-cols-4 gap-1 text-xs">
              {wards.data?.map((w) => (
                <span key={w.id} className="rounded bg-surface-muted px-2 py-1">
                  {tr("वडा", "W")} {num(w.number)}: <b>{w.id}</b>
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value, tone = "text-brand-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className={`font-heading text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
