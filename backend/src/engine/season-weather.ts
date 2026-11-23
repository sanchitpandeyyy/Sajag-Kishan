import type { SeasonWindow } from "./land-transparency";

const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const DAY = 86_400_000;
/** Past years averaged to get the "normal" for a season. */
export const NORMAL_YEARS = 10;
/** The reanalysis archive runs a few days behind today. */
const ARCHIVE_LAG_DAYS = 6;

export interface SeasonWeather {
  /** Total rain so far in the season (or the whole season once it is over). */
  rainMm: number;
  /** Average rain for the same days of this season over the past NORMAL_YEARS years. */
  normalRainMm: number | null;
  /** rainMm as a share of normal, e.g. 0.8 = 20% below normal. */
  rainVsNormal: number | null;
  tempMeanC: number | null;
  normalTempC: number | null;
  /** Days of data counted, and whether that covers the whole season. */
  days: number;
  complete: boolean;
}

interface Daily {
  t: number[];
  rain: (number | null)[];
  temp: (number | null)[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const cache = new Map<string, { at: number; value: Promise<Daily | null> }>();

async function fetchDaily(lat: number, lng: number, from: Date, to: Date): Promise<Daily | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lng.toFixed(3),
    start_date: iso(from),
    end_date: iso(to),
    daily: "precipitation_sum,temperature_2m_mean",
    models: "era5_seamless",
    timezone: "Asia/Kathmandu",
  });
  const res = await fetch(`${ARCHIVE}?${params}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`);
  const j = (await res.json()) as { daily?: { time: string[]; precipitation_sum?: (number | null)[]; temperature_2m_mean?: (number | null)[] } };
  if (!j.daily?.time?.length) return null;
  return { t: j.daily.time.map((x) => Date.parse(`${x}T00:00:00Z`)), rain: j.daily.precipitation_sum ?? [], temp: j.daily.temperature_2m_mean ?? [] };
}

/** One request covers the shown seasons plus the years used for the normal; kept for 12 hours. */
function dailyFor(lat: number, lng: number, from: Date, to: Date): Promise<Daily | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${iso(from)},${iso(to)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 12 * 60 * 60_000) return hit.value;
  const value = fetchDaily(lat, lng, from, to).catch((e) => {
    console.warn("[season-weather]", e instanceof Error ? e.message : e);
    cache.delete(key);
    return null;
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}

function stats(d: Daily, from: number, to: number) {
  let rain = 0;
  let days = 0;
  let tSum = 0;
  let tN = 0;
  for (let i = 0; i < d.t.length; i++) {
    const t = d.t[i]!;
    if (t < from || t > to) continue;
    const r = d.rain[i];
    if (r != null) {
      rain += r;
      days++;
    }
    const x = d.temp[i];
    if (x != null) {
      tSum += x;
      tN++;
    }
  }
  return { rain, days, temp: tN ? tSum / tN : null };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Real rain and temperature for each season at one point, compared with the same days in past years. */
export async function seasonWeather(lat: number, lng: number, windows: SeasonWindow[], now = new Date()): Promise<(SeasonWeather | null)[]> {
  const last = new Date(now.getTime() - ARCHIVE_LAG_DAYS * DAY);
  const first = new Date(Date.UTC(windows[0]!.from.getUTCFullYear() - NORMAL_YEARS, windows[0]!.from.getUTCMonth(), 1));
  const d = await dailyFor(lat, lng, first, new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())));
  if (!d) return windows.map(() => null);

  return windows.map((w) => {
    const from = w.from.getTime();
    const end = Math.min(w.to.getTime(), last.getTime());
    if (end <= from) return null;
    const cur = stats(d, from, end);
    if (!cur.days) return null;
    const span = end - from;
    const past: { rain: number; temp: number | null }[] = [];
    for (let y = 1; y <= NORMAL_YEARS; y++) {
      const pf = Date.UTC(w.from.getUTCFullYear() - y, w.from.getUTCMonth(), w.from.getUTCDate());
      const s = stats(d, pf, pf + span);
      if (s.days >= cur.days * 0.9) past.push(s);
    }
    const normalRain = past.length >= 3 ? past.reduce((a, b) => a + b.rain, 0) / past.length : null;
    const temps = past.map((p) => p.temp).filter((x): x is number => x != null);
    return {
      rainMm: Math.round(cur.rain),
      normalRainMm: normalRain != null ? Math.round(normalRain) : null,
      rainVsNormal: normalRain != null && normalRain >= 5 ? Math.round((cur.rain / normalRain) * 100) / 100 : null,
      tempMeanC: cur.temp != null ? round1(cur.temp) : null,
      normalTempC: temps.length >= 3 ? round1(temps.reduce((a, b) => a + b, 0) / temps.length) : null,
      days: cur.days,
      complete: w.to.getTime() <= last.getTime(),
    };
  });
}
