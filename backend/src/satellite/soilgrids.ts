// ISRIC SoilGrids 2.0: modelled soil properties at ~250 m. An ESTIMATE from a global model,
// not a measurement. Every value produced here must be labelled "estimated from global map".
//
// The public API has no documented rate limit, but measured behaviour is uneven: several
// concurrent requests each take 15-25 s (sequential ones take about 2 s). So requests are sent
// one at a time with a short gap, each attempt gets a generous timeout, and transient failures retry.

const SOILGRIDS = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const DEPTH = "0-5cm";

export const SOIL_FETCH = { timeoutMs: 30_000, attempts: 3, backoffMs: [2_000, 6_000], maxRetryAfterMs: 30_000, minGapMs: 300 } as const;

export interface SoilEstimate {
  soilPh: number | null;
  soilOrganicC: number | null; // g/kg
  soilNitrogen: number | null; // g/kg
  clayPct: number | null; // %
  depth: typeof DEPTH;
  source: "SoilGrids 2.0 (ISRIC)";
}

interface SoilGridsLayer {
  name: string;
  unit_measure?: { d_factor?: number; target_units?: string };
  depths?: { label: string; values?: { mean?: number | null } }[];
}

const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

/** Pure parser: the API stores integers scaled by `d_factor`; dividing gives the target unit. */
export function parseSoilGrids(json: unknown): SoilEstimate {
  const layers = ((json as { properties?: { layers?: SoilGridsLayer[] } })?.properties?.layers ?? []) as SoilGridsLayer[];
  const get = (name: string, dp: number): number | null => {
    const layer = layers.find((l) => l.name === name);
    const raw = layer?.depths?.find((d) => d.label === DEPTH)?.values?.mean;
    const factor = layer?.unit_measure?.d_factor || 1;
    if (raw == null || !Number.isFinite(raw) || raw <= -32768) return null; // SoilGrids nodata
    return round(raw / factor, dp);
  };
  return {
    soilPh: get("phh2o", 1),
    soilOrganicC: get("soc", 1),
    soilNitrogen: get("nitrogen", 2),
    clayPct: get("clay", 1),
    depth: DEPTH,
    source: "SoilGrids 2.0 (ISRIC)",
  };
}

export interface SoilFetchOptions {
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  attempts?: number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// One request in flight at a time, process-wide; the next starts a short gap after the last one ends.
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>, sleep: (ms: number) => Promise<void>): Promise<T> {
  const run = tail.then(task);
  tail = run.then(
    () => sleep(SOIL_FETCH.minGapMs),
    () => sleep(SOIL_FETCH.minGapMs),
  );
  return run;
}

const retryable = (status: number) => status === 429 || status >= 500;

function retryAfterMs(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const s = Number(h);
  return Number.isFinite(s) && s >= 0 ? Math.min(s * 1000, SOIL_FETCH.maxRetryAfterMs) : null;
}

class PermanentError extends Error {}

async function fetchJson(url: string, fetchImpl: typeof fetch, opts: Required<SoilFetchOptions>): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    let wait: number | null = null;
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(opts.timeoutMs) });
      if (res.ok) return await res.json();
      const err = new Error(`SoilGrids failed: ${res.status}`);
      if (!retryable(res.status)) throw new PermanentError(err.message); // a bad request will not get better
      lastError = err;
      wait = retryAfterMs(res);
    } catch (e) {
      if (e instanceof PermanentError) throw e;
      lastError = e; // timeout or network error: retry
    }
    if (attempt < opts.attempts) await opts.sleep(wait ?? SOIL_FETCH.backoffMs[Math.min(attempt - 1, SOIL_FETCH.backoffMs.length - 1)]!);
  }
  throw lastError instanceof Error ? lastError : new Error("SoilGrids failed");
}

export async function soilAt(lat: number, lng: number, fetchImpl: typeof fetch = fetch, options: SoilFetchOptions = {}): Promise<SoilEstimate> {
  const opts: Required<SoilFetchOptions> = { sleep: options.sleep ?? realSleep, timeoutMs: options.timeoutMs ?? SOIL_FETCH.timeoutMs, attempts: options.attempts ?? SOIL_FETCH.attempts };
  const params = new URLSearchParams({ lon: lng.toFixed(5), lat: lat.toFixed(5), depth: DEPTH, value: "mean" });
  for (const p of ["phh2o", "soc", "nitrogen", "clay"]) params.append("property", p);
  const json = await serial(() => fetchJson(`${SOILGRIDS}?${params}`, fetchImpl, opts), opts.sleep);
  return parseSoilGrids(json);
}
