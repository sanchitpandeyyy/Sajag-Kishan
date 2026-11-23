import { getPrisma, type Prisma } from "../db";
import { bumpDataVersion } from "../lib/cache";
import { wardClimate, type ClimateDayRow } from "../satellite/climate";
import { landuseFeatures, LANDUSE_FEATURES } from "./features";
import { predictLanduse } from "./landuse";

const OBS_SELECT = { sensor: true, observedOn: true, ndvi: true, ndre: true, ndwi: true, ndmi: true, evi: true, savi: true, vvDb: true, vhDb: true } as const;
const WINDOW_DAYS = 365;

function climateLoader(now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const byWard = new Map<number, Promise<ClimateDayRow[]>>();
  return (wardId: number) => {
    if (!byWard.has(wardId)) byWard.set(wardId, wardClimate(wardId, since).catch(() => []));
    return byWard.get(wardId)!;
  };
}

export async function predictParcel(parcelId: string) {
  const prisma = getPrisma();
  const p = await prisma.parcel.findUnique({ where: { id: parcelId }, select: { id: true, wardId: true, elevationM: true, slopeDeg: true, irrigation: true, observations: { select: OBS_SELECT } } });
  if (!p || !p.observations.length) return null;
  const climate = await climateLoader()(p.wardId);
  const features = landuseFeatures(p.observations, p, { climate });
  const pred = predictLanduse(features);
  const stored = Object.fromEntries(Object.entries(features).map(([k, v]) => [k, Number.isFinite(v) ? v : null]));
  await prisma.modelPrediction.create({
    data: { parcelId: p.id, model: "landuse", version: pred.version, label: pred.label, probability: pred.probability, features: { ...stored, source: pred.source, trainedOn: pred.trainedOn ?? null } as Prisma.InputJsonValue },
  });
  bumpDataVersion();
  return pred;
}

export async function exportLanduseRows(): Promise<string> {
  const prisma = getPrisma();
  const parcels = await prisma.parcel.findMany({
    where: { observations: { some: {} } },
    select: {
      id: true,
      wardId: true,
      elevationM: true,
      slopeDeg: true,
      irrigation: true,
      verification: true,
      observations: { select: OBS_SELECT },
      declarations: { select: { isFallow: true, verification: true, fiscalYearBs: true, season: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const climateFor = climateLoader();
  const header = ["parcel_id", "ward_id", ...LANDUSE_FEATURES, "label", "label_source"].join(",");
  const lines = [header];
  for (const p of parcels) {
    const d = p.declarations[0];
    if (!d) continue;
    if (p.verification === "DISPUTED" || d.verification === "DISPUTED") continue;
    const f = landuseFeatures(p.observations, p, { climate: await climateFor(p.wardId) });
    const strong = p.verification === "VERIFIED" || d.verification === "VERIFIED";
    const cells = LANDUSE_FEATURES.map((k) => (Number.isFinite(f[k]) ? String(f[k]) : ""));
    lines.push([p.id, String(p.wardId), ...cells, d.isFallow ? "0" : "1", strong ? "verified" : "farmer"].join(","));
  }
  return `${lines.join("\n")}\n`;
}
