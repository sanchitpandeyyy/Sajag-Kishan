// ISRIC SoilGrids 2.0: modelled soil properties at ~250 m. An ESTIMATE from a global model,
// not a measurement. Every value produced here must be labelled "estimated from global map".

const SOILGRIDS = "https://rest.isric.org/soilgrids/v2.0/properties/query";
const DEPTH = "0-5cm";

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

export async function soilAt(lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<SoilEstimate> {
  const params = new URLSearchParams({ lon: lng.toFixed(5), lat: lat.toFixed(5), depth: DEPTH, value: "mean" });
  for (const p of ["phh2o", "soc", "nitrogen", "clay"]) params.append("property", p);
  const res = await fetchImpl(`${SOILGRIDS}?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`SoilGrids failed: ${res.status}`);
  return parseSoilGrids(await res.json());
}
