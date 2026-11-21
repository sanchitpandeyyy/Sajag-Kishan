/**
 * Database side of the land-use model: build features for a field, store a prediction, and export
 * the training table for ml/train_landuse.py.
 */
import { getPrisma, type Prisma } from "../db";
import { landuseFeatures, LANDUSE_FEATURES } from "./features";
import { predictLanduse } from "./landuse";

const OBS_SELECT = { sensor: true, observedOn: true, ndvi: true, ndre: true, ndwi: true, ndmi: true, vvDb: true, vhDb: true } as const;

/** Predict and store one field. Returns null when the field has no satellite readings yet. */
export async function predictParcel(parcelId: string) {
  const prisma = getPrisma();
  const p = await prisma.parcel.findUnique({ where: { id: parcelId }, select: { id: true, elevationM: true, slopeDeg: true, irrigation: true, observations: { select: OBS_SELECT } } });
  if (!p || !p.observations.length) return null;
  const features = landuseFeatures(p.observations, p);
  const pred = predictLanduse(features);
  // JSON has no NaN; store missing features as null.
  const stored = Object.fromEntries(Object.entries(features).map(([k, v]) => [k, Number.isFinite(v) ? v : null]));
  await prisma.modelPrediction.create({
    data: { parcelId: p.id, model: "landuse", version: pred.version, label: pred.label, probability: pred.probability, features: { ...stored, source: pred.source, trainedOn: pred.trainedOn ?? null } as Prisma.InputJsonValue },
  });
  return pred;
}

/**
 * Training table, one row per field and season with a label:
 *   label_source "verified": the officer verified the field or the declaration (strong label)
 *   label_source "farmer":   the farmer declared it, nobody checked yet (weak label)
 * Features use the 365 days before the export, so labels should be this or last season.
 */
export async function exportLanduseRows(): Promise<string> {
  const prisma = getPrisma();
  const parcels = await prisma.parcel.findMany({
    where: { observations: { some: {} } },
    select: {
      id: true,
      elevationM: true,
      slopeDeg: true,
      irrigation: true,
      verification: true,
      observations: { select: OBS_SELECT },
      declarations: { select: { isFallow: true, verification: true, fiscalYearBs: true, season: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const header = ["parcel_id", ...LANDUSE_FEATURES, "label", "label_source"].join(",");
  const lines = [header];
  for (const p of parcels) {
    const d = p.declarations[0];
    if (!d) continue; // no label at all
    const f = landuseFeatures(p.observations, p);
    const strong = p.verification === "VERIFIED" || d.verification === "VERIFIED";
    if (p.verification === "DISPUTED" || d.verification === "DISPUTED") continue; // label in doubt
    const cells = LANDUSE_FEATURES.map((k) => (Number.isFinite(f[k]) ? String(f[k]) : ""));
    lines.push([p.id, ...cells, d.isFallow ? "0" : "1", strong ? "verified" : "farmer"].join(","));
  }
  return `${lines.join("\n")}\n`;
}
