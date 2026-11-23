import { backscatterAt, radarVerdict, searchRadarScenes } from "./sentinel1";
import { greennessVerdict, indicesAt, searchScenes } from "./sentinel2";
import { terrainAt } from "./terrain";

const [lat, lng] = [Number(process.argv[2] ?? 27.6215), Number(process.argv[3] ?? 84.5031)];
const to = new Date();
const from = new Date(to.getTime() - 180 * 86_400_000);

console.log("terrain", await terrainAt(lat, lng));

const scenes = await searchScenes(lat, lng, { from, to, maxCloud: 60, limit: 4 });
const optical = [];
for (const s of scenes) {
  try {
    const r = await indicesAt(s, lat, lng);
    optical.push(r);
    console.log("S2", r.date, { ndvi: r.ndvi, ndre: r.ndre, ndwi: r.ndwi, ndmi: r.ndmi, scl: r.scl });
  } catch (e) {
    console.log("S2", s.datetime.slice(0, 10), "ERROR", e instanceof Error ? e.message : e);
  }
}
console.log("S2 verdict", greennessVerdict(optical));

const radar = await searchRadarScenes(lat, lng, { from, to, limit: 6 });
const readings = [];
for (const s of radar) {
  try {
    const r = await backscatterAt(s, lat, lng);
    readings.push(r);
    console.log("S1", r.date, r.orbit, { vvDb: r.vvDb, vhDb: r.vhDb });
  } catch (e) {
    console.log("S1", s.datetime.slice(0, 10), "ERROR", e instanceof Error ? e.message : e);
  }
}
console.log("S1 verdict", radarVerdict(readings));
