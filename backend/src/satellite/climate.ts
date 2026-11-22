/**
 * ERA5 reanalysis climate per ward: daily rainfall, temperature, topsoil moisture and reference
 * evapotranspiration from the Open-Meteo historical archive (free, no API key; ERA5-Land where it
 * exists, ERA5 elsewhere). ERA5-Land cells are about 9 km, so one series per ward is enough: every
 * field in the ward would read the same cell anyway.
 *
 * The archive runs about 5 days behind today. Days already stored are not fetched again.
 */
import { getPrisma } from "../db";

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const DAY = 86_400_000;

export interface ClimateDayRow {
  date: Date;
  precipMm: number | null;
  tempMeanC: number | null;
  tempMaxC: number | null;
  soilMoisture: number | null;
  et0Mm: number | null;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Daily ERA5 values for a point between two dates (inclusive). */
export async function fetchClimate(lat: number, lng: number, from: Date, to: Date, fetchImpl: typeof fetch = fetch): Promise<ClimateDayRow[]> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lng.toFixed(3),
    start_date: isoDay(from),
    end_date: isoDay(to),
    daily: "precipitation_sum,temperature_2m_mean,temperature_2m_max,soil_moisture_0_to_7cm_mean,et0_fao_evapotranspiration",
    models: "era5_seamless",
    timezone: "Asia/Kathmandu",
  });
  const res = await fetchImpl(`${ARCHIVE}?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo archive failed: ${res.status}`);
  const j = (await res.json()) as { daily?: Record<string, unknown[]> & { time: string[] } };
  const d = j.daily;
  if (!d?.time) return [];
  return d.time
    .map((t, i) => ({
      date: new Date(`${t}T00:00:00Z`),
      precipMm: num(d.precipitation_sum?.[i]),
      tempMeanC: num(d.temperature_2m_mean?.[i]),
      tempMaxC: num(d.temperature_2m_max?.[i]),
      soilMoisture: num(d.soil_moisture_0_to_7cm_mean?.[i]),
      et0Mm: num(d.et0_fao_evapotranspiration?.[i]),
    }))
    .filter((r) => r.precipMm != null || r.tempMeanC != null || r.soilMoisture != null);
}

/** Ward centre: the stored centroid, else the mean of its mapped fields. */
async function wardPoint(wardId: number): Promise<[number, number] | null> {
  const prisma = getPrisma();
  const w = await prisma.ward.findUnique({ where: { id: wardId }, select: { centroidLat: true, centroidLng: true } });
  if (w?.centroidLat != null && w.centroidLng != null) return [w.centroidLat, w.centroidLng];
  const a = await prisma.parcel.aggregate({ where: { wardId, centroidLat: { not: null }, centroidLng: { not: null } }, _avg: { centroidLat: true, centroidLng: true } });
  return a._avg.centroidLat != null && a._avg.centroidLng != null ? [a._avg.centroidLat, a._avg.centroidLng] : null;
}

/**
 * Make sure the ward has daily climate for the last `days` days (default 400, a little more than the
 * 365-day feature window). Fetches only the missing tail. Returns the number of new days stored.
 */
export async function syncWardClimate(wardId: number, opts: { days?: number; now?: Date; fetchImpl?: typeof fetch } = {}): Promise<number> {
  const prisma = getPrisma();
  const now = opts.now ?? new Date();
  const to = new Date(now.getTime() - 5 * DAY); // archive delay
  let from = new Date(now.getTime() - (opts.days ?? 400) * DAY);
  const last = await prisma.climateDay.findFirst({ where: { wardId }, orderBy: { date: "desc" }, select: { date: true } });
  if (last && last.date >= from) from = new Date(last.date.getTime() + DAY);
  if (from > to) return 0;
  const point = await wardPoint(wardId);
  if (!point) return 0;
  const rows = await fetchClimate(point[0], point[1], from, to, opts.fetchImpl);
  if (!rows.length) return 0;
  const r = await prisma.climateDay.createMany({ data: rows.map((x) => ({ wardId, ...x })), skipDuplicates: true });
  return r.count;
}

/** Stored climate for a ward within a window. */
export async function wardClimate(wardId: number, since: Date): Promise<ClimateDayRow[]> {
  return getPrisma().climateDay.findMany({
    where: { wardId, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { date: true, precipMm: true, tempMeanC: true, tempMaxC: true, soilMoisture: true, et0Mm: true },
  });
}
