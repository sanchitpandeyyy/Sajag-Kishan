import { getPrisma } from "../db";
import { ensurePhoneUser } from "../lib/accounts";
import { registryFarmerSchema, toSquareMetres, type CompoundArea, type RegistryFarmerRecord } from "../shared";
import { z } from "zod";

export const registryRowSchema = registryFarmerSchema.extend({
  land: z
    .array(z.object({ wardId: z.number().int().positive(), tole: z.string().min(1), area: z.record(z.string(), z.number().nonnegative()), kittaNo: z.string().optional() }))
    .default([]),
});
export type RegistryRow = z.infer<typeof registryRowSchema>;

export interface RegistryAdapter {
  name: string;
  fetchFarmers(since?: Date): AsyncIterable<unknown>;
}

export class CsvRegistryAdapter implements RegistryAdapter {
  name = "csv";
  private readonly csv: string;
  constructor(csv: string) {
    this.csv = csv.replace(/^﻿/, "");
  }

  async *fetchFarmers(): AsyncIterable<unknown> {
    const [header, ...lines] = parseCsv(this.csv);
    if (!header) return;
    for (const cells of lines) {
      const r = Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()]));
      const wardId = Number(r.wardId);
      const farmingWardId = Number(r.farmingWardId || r.wardId);
      yield {
        externalId: r.externalId || undefined,
        mobile: r.mobile,
        firstNameNe: r.firstNameNe,
        middleNameNe: r.middleNameNe || undefined,
        lastNameNe: r.lastNameNe || undefined,
        firstNameEn: r.firstNameEn || undefined,
        lastNameEn: r.lastNameEn || undefined,
        gender: r.gender,
        dobBs: r.dobBs,
        education: r.education,
        permanentAddress: { wardId, tole: r.tole },
        farmingSameAsPermanent: farmingWardId === wardId,
        farmingAddress: { wardId: farmingWardId, tole: r.farmingTole || r.tole },
        citizenshipNo: r.citizenshipNo,
        citizenshipDistrictId: Number(r.citizenshipDistrictId),
        nationalId: r.nationalId || undefined,
        farmingSectors: (r.farmingSectors || "अन्नबाली").split("|"),
        farmingMonthsPerYear: Number(r.farmingMonthsPerYear || 6),
        land: [
          {
            wardId: farmingWardId,
            tole: r.farmingTole || r.tole,
            kittaNo: r.kittaNo || undefined,
            area: Object.fromEntries(
              ["bigha", "kattha", "dhur", "ropani", "aana", "paisa", "daam"].filter((u) => r[u]).map((u) => [u, Number(r[u])]),
            ),
          },
        ].filter((l) => Object.keys(l.area).length > 0),
      } satisfies Record<string, unknown>;
    }
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

export interface ImportReport {
  adapter: string;
  received: number;
  created: number;
  updated: number;
  parcelsCreated: number;
  errors: { index: number; message: string }[];
}

export async function importRecords(adapter: RegistryAdapter): Promise<ImportReport> {
  const prisma = getPrisma();
  const report: ImportReport = { adapter: adapter.name, received: 0, created: 0, updated: 0, parcelsCreated: 0, errors: [] };

  let index = 0;
  for await (const raw of adapter.fetchFarmers()) {
    index++;
    report.received++;
    const parsed = registryRowSchema.safeParse(raw);
    if (!parsed.success) {
      report.errors.push({ index, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    const r = parsed.data;
    try {
      const farmerData = toFarmerData(r);
      const existing =
        (await prisma.farmer.findUnique({
          where: { citizenshipNo_citizenshipDistrictId: { citizenshipNo: r.citizenshipNo, citizenshipDistrictId: r.citizenshipDistrictId } },
        })) ?? (await prisma.farmer.findFirst({ where: { user: { phoneNumber: r.mobile } } }));

      if (existing) {
        await prisma.farmer.update({ where: { id: existing.id }, data: farmerData });
        report.updated++;
      } else {
        const userId = await ensurePhoneUser(prisma, {
          mobile: r.mobile,
          name: [r.firstNameEn ?? r.firstNameNe, r.lastNameEn ?? r.lastNameNe].filter(Boolean).join(" "),
          role: "FARMER",
        });
        const farmer = await prisma.farmer.create({ data: { ...farmerData, userId } });
        for (const land of r.land) {
          await prisma.parcel.create({
            data: {
              farmerId: farmer.id,
              wardId: land.wardId,
              tole: land.tole,
              kittaNo: land.kittaNo,
              areaM2: toSquareMetres(land.area as CompoundArea),
              areaOriginal: land.area,
              source: "REGISTRY",
            },
          });
          report.parcelsCreated++;
        }
        report.created++;
      }
    } catch (e) {
      report.errors.push({ index, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}

function toFarmerData(r: RegistryFarmerRecord) {
  const farming = r.farmingSameAsPermanent || !r.farmingAddress ? r.permanentAddress : r.farmingAddress;
  return {
    externalRegistryId: r.externalId,
    source: "REGISTRY" as const,
    firstNameNe: r.firstNameNe,
    middleNameNe: r.middleNameNe,
    lastNameNe: r.lastNameNe,
    firstNameEn: r.firstNameEn,
    middleNameEn: r.middleNameEn,
    lastNameEn: r.lastNameEn,
    gender: r.gender,
    dobBs: r.dobBs,
    education: r.education,
    permanentWardId: r.permanentAddress.wardId,
    permanentTole: r.permanentAddress.tole,
    farmingSameAsPermanent: r.farmingSameAsPermanent,
    farmingWardId: farming.wardId,
    farmingTole: farming.tole,
    citizenshipNo: r.citizenshipNo,
    citizenshipDistrictId: r.citizenshipDistrictId,
    nationalId: r.nationalId,
    farmingSectors: r.farmingSectors,
    farmingMonthsPerYear: r.farmingMonthsPerYear,
  };
}
