/**
 * Land-use prediction for a field: cultivated or fallow, with a probability.
 * Uses the trained model in backend/models/landuse.json when present (trained by ml/train_landuse.py),
 * otherwise the satellite rules (rules-v1). Either way the result is an indicator for the officer,
 * never ground truth (AGENT.md rule 6).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LANDUSE_FEATURES, toVector, type LanduseFeature } from "./features";
import { predictProba, type LightGbmDump } from "./gbdt";
import { logisticProba, type LogisticModel } from "./linear";

/** Model families the trainer can pick; each has an evaluator here. */
export type LanduseModelKind = "logistic" | "random_forest" | "lightgbm";

interface ModelFileBase {
  name: "landuse";
  version: string;
  trainedAt: string;
  /** "verified-fields", "mixed" or "synthetic" (bootstrap only). */
  trainedOn: string;
  rows: number;
  metrics: Record<string, number | string>;
  features: string[];
  threshold: number;
  /** Cross-validation results for every candidate the trainer compared. */
  comparison?: Record<string, Record<string, number>>;
}

export type LanduseModelFile =
  | (ModelFileBase & { kind: "logistic"; model: LogisticModel })
  | (ModelFileBase & { kind?: "random_forest" | "lightgbm"; model: LightGbmDump });

/** Probability that the field is cultivated, from whichever model family was exported. */
export function modelProba(file: LanduseModelFile, x: number[]): number {
  return file.kind === "logistic" ? logisticProba(file.model, x) : predictProba(file.model, x);
}

export interface LandusePrediction {
  label: "cultivated" | "fallow";
  probability: number; // probability that the field is cultivated
  version: string;
  source: "model" | "rules";
  trainedOn?: string;
}

const MODEL_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../models/landuse.json");
let cached: { mtime: number; model: LanduseModelFile | null } | null = null;

/** Load (and cache) the model file; returns null if none, or if its features do not match this code. */
export function loadLanduseModel(path = MODEL_PATH): LanduseModelFile | null {
  if (!existsSync(path)) return null;
  const mtime = statSync(path).mtimeMs; // reload when the file is replaced by a new training run
  if (cached && cached.mtime === mtime) return cached.model;
  const file = JSON.parse(readFileSync(path, "utf8")) as LanduseModelFile;
  const known = file.kind == null || file.kind === "logistic" || file.kind === "random_forest" || file.kind === "lightgbm";
  if (!known) console.warn(`[ml] landuse.json has an unknown model kind "${String(file.kind)}"; using rules`);
  const ok = known && file.features.length === LANDUSE_FEATURES.length && file.features.every((f, i) => f === LANDUSE_FEATURES[i]);
  if (!ok) console.warn("[ml] landuse.json features do not match LANDUSE_FEATURES; using rules");
  cached = { mtime, model: ok ? file : null };
  return cached.model;
}

/** Rule fallback, mirrors satellite/sync.ts combinedFallow with soft probabilities. */
export function landuseRules(f: Record<LanduseFeature, number>): LandusePrediction {
  const opticalFallow = f.ndvi_count >= 3 ? f.ndvi_max < 0.35 : null;
  const radarCrop = f.s1_count >= 4 ? f.vh_range >= 3 : null;
  let p = 0.5;
  if (radarCrop === true) p = opticalFallow === false ? 0.95 : 0.8;
  else if (opticalFallow === false) p = 0.85;
  else if (opticalFallow === true) p = radarCrop === false ? 0.05 : 0.2;
  else if (radarCrop === false) p = 0.3;
  return { label: p >= 0.5 ? "cultivated" : "fallow", probability: p, version: "rules-v1", source: "rules" };
}

export function predictLanduse(f: Record<LanduseFeature, number>, model: LanduseModelFile | null = loadLanduseModel()): LandusePrediction {
  if (!model) return landuseRules(f);
  const p = Math.round(modelProba(model, toVector(f)) * 1000) / 1000;
  return { label: p >= model.threshold ? "cultivated" : "fallow", probability: p, version: model.version, source: "model", trainedOn: model.trainedOn };
}
