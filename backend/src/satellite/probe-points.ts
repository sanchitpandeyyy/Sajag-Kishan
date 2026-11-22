import { greennessVerdict, indicesAt, searchScenes } from "./sentinel2";

const points = process.argv.slice(2).map((s) => s.split(",").map(Number) as [number, number]);
const to = new Date();
const from = new Date(to.getTime() - 365 * 86_400_000);
for (const [lat, lng] of points) {
  const scenes = (await searchScenes(lat, lng, { from, to, maxCloud: 15, limit: 40 })).filter((_, i) => i % 5 === 0).slice(0, 7);
  const readings = [];
  for (const s of scenes) {
    try {
      readings.push(await indicesAt(s, lat, lng));
    } catch {
    }
  }
  const v = greennessVerdict(readings);
  console.log(`${lat},${lng}`, "peak", v.peakNdvi, "latest", v.latestNdvi, "n", v.validCount, readings.map((r) => `${r.date}:${r.ndvi}`).join(" "));
}
process.exit(0);
