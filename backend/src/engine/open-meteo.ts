import type { DailyForecast, HourlyForecast } from "./weather-alerts";

const BASE = "https://api.open-meteo.com/v1";

export interface ForecastResult {
  elevationM: number;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

export async function fetchForecast(
  lat: number,
  lng: number,
  opts: { days?: number; fetchImpl?: typeof fetch } = {},
): Promise<ForecastResult> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    daily: "precipitation_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max",
    hourly: "temperature_2m,relative_humidity_2m",
    timezone: "Asia/Kathmandu",
    forecast_days: String(opts.days ?? 16),
  });
  const res = await (opts.fetchImpl ?? fetch)(`${BASE}/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo forecast failed: ${res.status}`);
  const j = (await res.json()) as {
    elevation: number;
    daily: {
      time: string[];
      precipitation_sum: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      wind_gusts_10m_max: number[];
    };
    hourly: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[] };
  };

  return {
    elevationM: j.elevation,
    daily: j.daily.time.map((date, i) => ({
      date,
      precipitationMm: j.daily.precipitation_sum[i] ?? 0,
      tempMaxC: j.daily.temperature_2m_max[i] ?? Number.NaN,
      tempMinC: j.daily.temperature_2m_min[i] ?? Number.NaN,
      windGustMaxKmh: j.daily.wind_gusts_10m_max[i],
    })),
    hourly: j.hourly.time.map((time, i) => ({
      time,
      tempC: j.hourly.temperature_2m[i] ?? Number.NaN,
      relativeHumidity: j.hourly.relative_humidity_2m[i] ?? 0,
    })),
  };
}

export async function fetchElevation(lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<number> {
  const res = await fetchImpl(`${BASE}/elevation?latitude=${lat}&longitude=${lng}`);
  if (!res.ok) throw new Error(`Open-Meteo elevation failed: ${res.status}`);
  const j = (await res.json()) as { elevation: number[] };
  const e = j.elevation[0];
  if (e == null) throw new Error("No elevation returned");
  return e;
}
