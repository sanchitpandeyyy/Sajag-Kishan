/** Re-run the land-use model for every field with satellite readings: npx tsx src/ml/predict-all.ts */
import { getPrisma } from "../db";
import { predictParcel } from "./jobs";

const parcels = await getPrisma().parcel.findMany({ where: { observations: { some: {} } }, select: { id: true } });
const counts: Record<string, number> = {};
for (const p of parcels) {
  const r = await predictParcel(p.id);
  if (r) counts[`${r.label} (${r.source})`] = (counts[`${r.label} (${r.source})`] ?? 0) + 1;
}
console.log(`predicted ${parcels.length} fields`, counts);
process.exit(0);
