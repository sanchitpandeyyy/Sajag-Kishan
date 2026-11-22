import { getPrisma } from "../db";
import { syncParcelHistory } from "./history";

const seasons = Number(process.argv[2] ?? 6);
const localLevelId = process.argv[3] ? Number(process.argv[3]) : undefined;
const parcels = await getPrisma().parcel.findMany({
  where: { centroidLat: { not: null }, ...(localLevelId ? { ward: { localLevelId } } : {}) },
  select: { id: true, localName: true },
});
console.log(`history for ${parcels.length} fields, ${seasons} seasons`);
let total = 0;
for (const [i, p] of parcels.entries()) {
  const t = Date.now();
  try {
    const n = await syncParcelHistory(p.id, { seasons });
    total += n;
    console.log(`${i + 1}/${parcels.length} ${p.localName ?? p.id}: +${n} (${Math.round((Date.now() - t) / 1000)} s)`);
  } catch (e) {
    console.log(`${i + 1}/${parcels.length} ${p.id}: ERROR ${e instanceof Error ? e.message.split("\n").at(-1) : e}`);
  }
}
console.log(`done, ${total} new readings`);
process.exit(0);
