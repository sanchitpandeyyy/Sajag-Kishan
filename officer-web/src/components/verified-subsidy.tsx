"use client";

import { ArrowRight, BadgeCheck, HandCoins } from "lucide-react";
import Link from "next/link";
import { ha } from "@/components/land-charts";
import { Card } from "@/components/shell";
import type { VerifiedSubsidy } from "@/lib/dashboard";
import { useLang } from "@/lib/i18n";

const STATUS_LABEL: Record<string, [string, string, string]> = {
  PLANNED: ["योजनामा", "Planned", "bg-fill text-body"],
  APPROVED: ["स्वीकृत", "Approved", "bg-[#1b7a95]/10 text-[#155f74]"],
  DELIVERED: ["वितरण भयो", "Delivered", "bg-brand-700/10 text-brand-800"],
};

const pctOf = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-control bg-page px-4 py-3">
      <p className="text-caption font-medium text-muted">{label}</p>
      <p className="font-heading text-h3 leading-tight text-ink tnum">{value}</p>
      {note && <p className="text-caption text-muted">{note}</p>}
    </div>
  );
}

export function VerifiedSubsidyCard({ data }: { data: VerifiedSubsidy }) {
  const { tr, num } = useLang();
  const unit = data.lines[0]?.unit ?? "kg";
  const u = unit === "kg" ? tr("केजी", "kg") : unit;
  const cover = pctOf(data.allocatedQty, data.needQty);

  return (
    <Card
      icon={HandCoins}
      title={tr("प्रमाणित कृषकलाई अनुदान", "Subsidy for verified farmers")}
      action={
        <Link href="/subsidy" className="flex items-center gap-1 text-small font-semibold text-brand-700 hover:underline">
          {tr("अनुदान वितरण", "Manage subsidy")} <ArrowRight className="size-4" />
        </Link>
      }
    >
      {data.lines.length === 0 ? (
        <p className="text-small text-muted">
          {tr(
            `आ.व. ${data.fiscalYearBs} मा प्रमाणित खेत भएका कृषकलाई अहिलेसम्म अनुदान छुट्याइएको छैन।`,
            `No subsidy has been allocated to farmers with a verified field in FY ${data.fiscalYearBs} yet.`,
          )}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure label={tr("प्रमाणित कृषक", "Verified farmers")} value={num(data.farmers)} note={tr(`आ.व. ${data.fiscalYearBs}`, `FY ${data.fiscalYearBs}`)} />
            <Figure label={tr("आवश्यकता", "Need")} value={`${num(data.needQty, 0)} ${u}`} note={tr("बाली क्षेत्र × सिफारिस मात्रा", "crop area × recommended dose")} />
            <Figure label={tr("छुट्याइएको", "Allocated")} value={`${num(data.allocatedQty, 0)} ${u}`} note={tr(`आवश्यकताको ${num(cover)}%`, `${cover}% of need`)} />
            <Figure label={tr("वितरण भएको", "Delivered")} value={`${num(data.deliveredQty, 0)} ${u}`} note={tr(`छुट्याइएकोको ${num(pctOf(data.deliveredQty, data.allocatedQty))}%`, `${pctOf(data.deliveredQty, data.allocatedQty)}% of allocated`)} />
          </div>

          <div className="scroll-thin mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-small">
              <thead>
                <tr className="border-b border-line text-left text-caption font-medium text-muted">
                  <th className="py-2 pr-3 font-medium">{tr("कृषक", "Farmer")}</th>
                  <th className="py-2 pr-3 font-medium">{tr("हिसाब (यो मौसम)", "Calculation (this season)")}</th>
                  <th className="py-2 pr-3 text-right font-medium">{tr("आवश्यकता", "Need")}</th>
                  <th className="w-44 py-2 pr-3 font-medium">{tr("छुट्याइएको", "Allocated")}</th>
                  <th className="py-2 text-right font-medium">{tr("अवस्था", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.lines.map((l) => {
                  const p = pctOf(l.allocatedQty, l.needQty);
                  const st = STATUS_LABEL[l.status] ?? STATUS_LABEL.PLANNED!;
                  return (
                    <tr key={l.id} className="align-top">
                      <td className="py-3 pr-3">
                        <Link href={`/farmers/${l.farmerId}`} className="flex items-center gap-1.5 font-semibold text-ink hover:text-brand-700 hover:underline">
                          {l.farmerNameNe}
                          <BadgeCheck className="size-4 shrink-0 text-brand-700" aria-label={tr("प्रमाणित", "Verified")} />
                        </Link>
                        <p className="text-caption text-muted">
                          {tr(`वडा ${num(l.ward)} · प्रमाणित ${num(ha(l.verifiedAreaM2), 2)} हे.`, `Ward ${l.ward} · ${ha(l.verifiedAreaM2).toFixed(2)} ha verified`)}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        {l.calc.length ? (
                          <ul className="space-y-0.5 text-caption text-body tnum">
                            {l.calc.map((c) => (
                              <li key={c.cropEn}>
                                <span className="font-medium text-ink">{tr(c.cropNe, c.cropEn)}</span>{" "}
                                {tr(`${num(ha(c.areaM2), 2)} हे. × ${num(c.doseKgHa)} = ${num(c.kg)} केजी`, `${ha(c.areaM2).toFixed(2)} ha × ${c.doseKgHa} = ${c.kg} kg`)}
                              </li>
                            ))}
                            <li className="text-muted">{tr(`${l.product}, सिफारिस मात्रा केजी/हे.`, `${l.product}, dose in kg/ha`)}</li>
                          </ul>
                        ) : (
                          <p className="text-caption text-muted">{tr("यो मौसम बाली घोषणा छैन, त्यसैले अनुदान छैन।", "No crop declared this season, so no subsidy.")}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold text-ink tnum">{num(l.needQty, 0)}</td>
                      <td className="py-3 pr-3">
                        <div className="flex items-baseline justify-between gap-2 tnum">
                          <span className="font-semibold text-ink">{num(l.allocatedQty, 0)}</span>
                          <span className="text-caption text-muted">{l.needQty > 0 ? `${num(p)}%` : "–"}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-fill">
                          <div className="h-full rounded-full bg-brand-700" style={{ width: `${p}%` }} />
                        </div>
                        {l.deliveredQty != null && <p className="mt-1 text-caption text-muted">{tr(`वितरण ${num(l.deliveredQty, 0)}`, `delivered ${l.deliveredQty}`)}</p>}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-caption font-semibold ${st[2]}`}>{tr(st[0], st[1])}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-caption leading-relaxed text-muted">
            {tr(
              `आवश्यकता = घोषणा गरिएको बाली क्षेत्र × सिफारिस मल मात्रा, पहिले पाएको घटाएर। मौज्दात कम भए आवश्यकता र प्राथमिकता (साना, भाडामा खेती, प्रमाणित, हालै नपाएको) अनुसार बाँडिन्छ। एकाइ: ${u}।`,
              `Need = declared crop area × recommended fertilizer dose, minus anything already received. When stock is short it is shared by need and priority (smallholder, tenant, verified, not served recently). Unit: ${u}.`,
            )}
            {data.hiddenUnverified > 0 &&
              tr(` प्रमाणित खेत नभएका ${num(data.hiddenUnverified)} कृषकको अनुदान यहाँ देखाइएको छैन।`, ` ${data.hiddenUnverified} farmers without a verified field are not shown here.`)}
          </p>
        </>
      )}
    </Card>
  );
}
