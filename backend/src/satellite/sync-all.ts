/**
 * Sync satellite data for mapped fields from the command line (no officer session needed):
 *   npx tsx src/satellite/sync-all.ts [limit]
 * Same work as POST /v1/satellite/sync, run in the foreground with a log line per field.
 */
import { getPrisma } from "../db";
import { syncParcel } from "./sync";

const limit = Number(process.argv[2] ?? 30);
const parcels = await getPrisma().parcel.findMany({ where: { centroidLat: { not: null } }, select: { id: true, localName: true }, orderBy: { updatedAt: "desc" }, take: limit });
console.log(`syncing ${parcels.length} fields`);
let total = 0;
for (const [i, p] of parcels.entries()) {
  const t = Date.now();
  try {
    const n = await syncParcel(p.id, { months: 6, maxScenes: 6 });
    total += n;
    console.log(`${i + 1}/${parcels.length} ${p.localName ?? p.id}: +${n} readings (${Math.round((Date.now() - t) / 1000)} s)`);
  } catch (e) {
    console.log(`${i + 1}/${parcels.length} ${p.id}: ERROR ${e instanceof Error ? e.message.split("\n").at(-1) : e}`);
  }
}
console.log(`done, ${total} new readings`);
process.exit(0);
