"""
Train the land-use model (cultivated vs fallow) and export it for the backend.

Setup (once):
    cd ml
    python -m venv .venv
    .venv\\Scripts\\python -m pip install -r requirements.txt

Steps:
    1. Fresh satellite and climate data for mapped fields:   cd backend && npx tsx src/satellite/sync-all.ts 30
    2. Export the labelled table to ml/data/landuse.csv:     cd backend && npx tsx src/ml/export-landuse.ts
    3. Train:                                                .venv\\Scripts\\python train_landuse.py
       Demo only, bootstrap from synthetic fields:           .venv\\Scripts\\python train_landuse.py --synthetic 1500
    4. Re-score every field:                                 cd backend && npx tsx src/ml/predict-all.ts
    5. Check the TypeScript evaluator still matches:         cd backend && npm test

How it decides:
    * Cross-validation holds out whole wards (StratifiedGroupKFold on ward_id), so neighbouring fields
      never sit on both sides of a split and the score is not inflated.
    * Four model families are compared: logistic regression, random forest, LightGBM and CatBoost.
    * One-standard-error rule: take the best mean AUC, then pick the simplest deployable model whose
      AUC is within one standard error of it. Simpler models are easier to explain and less likely to
      overfit a small table.
    * Deployable means the backend can run it in TypeScript: logistic, random forest (LightGBM rf mode)
      and LightGBM. CatBoost is scored for comparison only.

Labels: label 1 = cultivated, 0 = fallow. label_source "verified" (officer checked, weight 1) or
"farmer" (declared, not checked yet, weight --farmer-weight). A real model is refused with fewer
than --min-verified officer-verified fields.

Outputs: ../backend/models/landuse.json (model + metadata + comparison) and
../backend/src/ml/landuse-parity.json (cases the TypeScript evaluator must reproduce).

Python is used only here, offline, for training. Production needs no Python.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import StratifiedGroupKFold, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    from catboost import CatBoostClassifier
except ImportError:  # optional: comparison only
    CatBoostClassifier = None

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent / "backend"

# Must match LANDUSE_FEATURES in backend/src/ml/features.ts (same names, same order).
FEATURES = [
    "ndvi_max", "ndvi_mean", "ndvi_min", "ndvi_latest", "ndvi_amplitude", "ndvi_count",
    "ndre_max", "ndwi_max", "ndmi_mean", "evi_max", "savi_max",
    "vh_mean", "vh_range", "vh_std", "vv_mean", "vv_std", "vh_minus_vv", "s1_count",
    "elevation_m", "slope_deg", "irrigated",
    "rain_365_mm", "rain_90_mm", "temp_mean_c", "hot_days", "soil_moisture_mean", "water_balance_mm",
]

# Simplest first: the one-standard-error rule prefers earlier entries.
SIMPLICITY = ["logistic", "random_forest", "lightgbm", "catboost"]
DEPLOYABLE = {"logistic", "random_forest", "lightgbm"}

LGB_PARAMS = dict(n_estimators=150, learning_rate=0.05, num_leaves=15, min_child_samples=10, subsample=0.9, subsample_freq=1, colsample_bytree=0.9, reg_lambda=1.0, random_state=42, verbose=-1)
RF_PARAMS = dict(boosting_type="rf", n_estimators=300, num_leaves=31, min_child_samples=5, subsample=0.8, subsample_freq=1, colsample_bytree=0.7, random_state=42, verbose=-1)


def make_model(kind: str):
    if kind == "logistic":
        return Pipeline([
            ("impute", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(C=1.0, max_iter=5000)),
        ])
    if kind == "random_forest":
        return lgb.LGBMClassifier(**RF_PARAMS)
    if kind == "lightgbm":
        return lgb.LGBMClassifier(**LGB_PARAMS)
    if kind == "catboost":
        return CatBoostClassifier(iterations=300, depth=4, learning_rate=0.05, random_seed=42, verbose=False, allow_writing_files=False)
    raise ValueError(kind)


def fit(kind: str, x: np.ndarray, y: np.ndarray, w: np.ndarray):
    m = make_model(kind)
    if kind == "logistic":
        return m.fit(x, y, clf__sample_weight=w)
    return m.fit(x, y, sample_weight=w)


def synthetic_fields(n: int, seed: int = 42, wards: int = 20) -> pd.DataFrame:
    """
    Physics-inspired fake fields for a bootstrap model ONLY (never presented as real accuracy).
    Cultivated: NDVI rises to 0.55-0.9, VH swings 3-10 dB through the season, NDRE/EVI/SAVI follow NDVI.
    Fallow: NDVI stays 0.1-0.35, VH flat (range < 2.5 dB), drier canopy (lower NDMI).
    About 15% of fields lose most optical readings to monsoon cloud, so radar must carry them.
    Climate is shared by every field in a ward and does not decide the label: within one
    municipality the weather is much the same for farmed and fallow fields.
    """
    rng = np.random.default_rng(seed)
    ward_climate = {
        w: {
            "rain_365_mm": rng.uniform(1300, 2100),
            "rain_90_mm": rng.uniform(40, 900),
            "temp_mean_c": rng.uniform(22, 26),
            "hot_days": int(rng.integers(30, 90)),
            "soil_moisture_mean": rng.uniform(0.22, 0.36),
        }
        for w in range(1, wards + 1)
    }
    rows = []
    for _ in range(n):
        ward = int(rng.integers(1, wards + 1))
        cultivated = rng.random() < 0.7
        cloudy = rng.random() < 0.15
        if cultivated:
            peak = rng.uniform(0.55, 0.92)
            low = rng.uniform(0.08, 0.3)
            vh_range = rng.uniform(3.0, 10.0)
            vh_mean = rng.uniform(-19, -13)
            ndmi = rng.uniform(0.05, 0.4)
        else:
            peak = rng.uniform(0.12, 0.36)
            low = rng.uniform(0.05, min(peak, 0.2))
            vh_range = rng.uniform(0.3, 2.6)
            vh_mean = rng.uniform(-22, -16)
            ndmi = rng.uniform(-0.15, 0.12)
        n_opt = int(rng.integers(0, 3)) if cloudy else int(rng.integers(3, 14))
        latest = rng.uniform(low, peak)
        vv_mean = rng.uniform(-13, -6)
        c = ward_climate[ward]
        opt = lambda v: v if n_opt else math.nan  # noqa: E731
        row = {
            "ward_id": ward,
            "ndvi_max": opt(peak),
            "ndvi_mean": opt((peak + low) / 2),
            "ndvi_min": opt(low),
            "ndvi_latest": opt(latest),
            "ndvi_amplitude": opt(peak - low),
            "ndvi_count": n_opt,
            "ndre_max": opt(peak * rng.uniform(0.55, 0.75)),
            "ndwi_max": opt(rng.uniform(-0.6, 0.15 if cultivated else -0.2)),
            "ndmi_mean": opt(ndmi),
            "evi_max": opt(peak * rng.uniform(0.7, 0.9)),
            "savi_max": opt(peak * rng.uniform(0.65, 0.8)),
            "vh_mean": vh_mean,
            "vh_range": vh_range,
            "vh_std": vh_range * rng.uniform(0.25, 0.4),
            "vv_mean": vv_mean,
            "vv_std": rng.uniform(0.8, 2.5) if cultivated else rng.uniform(0.3, 1.5),
            "vh_minus_vv": vh_mean - vv_mean,
            "s1_count": int(rng.integers(4, 30)),
            "elevation_m": rng.uniform(150, 260),
            "slope_deg": rng.uniform(0, 5),
            "irrigated": int(rng.random() < (0.5 if cultivated else 0.2)),
            **c,
            "water_balance_mm": c["rain_365_mm"] - rng.uniform(1100, 1400),
            "label": int(cultivated),
            "label_source": "synthetic",
        }
        rows.append(row)
    return pd.DataFrame(rows)


def load_real(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=["ward_id", *FEATURES, "label", "label_source"])
    df = pd.read_csv(path)
    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        raise SystemExit(f"{path} is missing columns {missing}. Re-export with: cd backend && npx tsx src/ml/export-landuse.ts")
    for f in FEATURES:
        df[f] = pd.to_numeric(df[f], errors="coerce")
    if "ward_id" not in df.columns:
        df["ward_id"] = -1
    return df


def cv_splits(y: np.ndarray, groups: np.ndarray):
    """Ward-grouped folds when there are enough wards, else plain stratified folds (reported)."""
    min_class = int(min(np.bincount(y))) if len(np.unique(y)) == 2 else 0
    n_groups = len(np.unique(groups))
    if min_class < 2:
        return [], "none"
    if n_groups >= 3:
        folds = min(5, n_groups, min_class)
        return list(StratifiedGroupKFold(n_splits=folds, shuffle=True, random_state=42).split(np.zeros(len(y)), y, groups)), "ward"
    folds = min(5, min_class)
    return list(StratifiedKFold(n_splits=folds, shuffle=True, random_state=42).split(np.zeros(len(y)), y)), "random (fewer than 3 wards)"


def cross_validate(kind: str, x: np.ndarray, y: np.ndarray, w: np.ndarray, splits) -> dict[str, float]:
    probs = np.full(len(y), np.nan)
    aucs = []
    for train, test in splits:
        m = fit(kind, x[train], y[train], w[train])
        p = m.predict_proba(x[test])[:, 1]
        probs[test] = p
        if len(np.unique(y[test])) == 2:
            aucs.append(roc_auc_score(y[test], p))
    if not aucs:
        return {}
    done = ~np.isnan(probs)
    pred = (probs[done] >= 0.5).astype(int)
    return {
        "auc_mean": round(float(np.mean(aucs)), 4),
        "auc_se": round(float(np.std(aucs, ddof=1) / math.sqrt(len(aucs))) if len(aucs) > 1 else 0.0, 4),
        "accuracy": round(float(accuracy_score(y[done], pred)), 4),
        "f1": round(float(f1_score(y[done], pred)), 4),
        "folds": len(aucs),
    }


def choose(comparison: dict[str, dict[str, float]]) -> tuple[str, str]:
    """One-standard-error rule over the candidates, restricted to deployable families."""
    scored = {k: v for k, v in comparison.items() if v}
    deployable = [k for k in SIMPLICITY if k in scored and k in DEPLOYABLE]
    if not deployable:
        return "lightgbm", "no cross-validation possible; default LightGBM"
    best = max(scored, key=lambda k: scored[k]["auc_mean"])
    bar = scored[best]["auc_mean"] - scored[best]["auc_se"]
    within = [k for k in deployable if scored[k]["auc_mean"] >= bar]
    pick = within[0] if within else max(deployable, key=lambda k: scored[k]["auc_mean"])
    why = f"best AUC {best} {scored[best]['auc_mean']}; simplest deployable within one SE ({bar:.4f}) is {pick}"
    if not within:
        why = f"best AUC {best} is not deployable and no deployable model is within one SE; using best deployable {pick}"
    return pick, why


def export_model(kind: str, model) -> tuple[dict, dict[str, float]]:
    if kind == "logistic":
        imp, sc, clf = model.named_steps["impute"], model.named_steps["scale"], model.named_steps["clf"]
        spec = {
            "impute": [float(v) for v in imp.statistics_],
            "mean": [float(v) for v in sc.mean_],
            "scale": [float(v) for v in sc.scale_],
            "coef": [float(v) for v in clf.coef_[0]],
            "intercept": float(clf.intercept_[0]),
        }
        importance = {f: round(abs(c), 4) for f, c in zip(FEATURES, spec["coef"])}
    else:
        booster = model.booster_
        spec = booster.dump_model()
        importance = dict(zip(FEATURES, booster.feature_importance("gain").round(1).tolist()))
    return spec, dict(sorted(importance.items(), key=lambda kv: -kv[1]))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(HERE / "data" / "landuse.csv"))
    ap.add_argument("--out", default=str(BACKEND / "models" / "landuse.json"))
    ap.add_argument("--synthetic", type=int, default=0, help="add N synthetic fields (bootstrap only)")
    ap.add_argument("--min-verified", type=int, default=30, help="refuse a real model with fewer officer-verified fields")
    ap.add_argument("--farmer-weight", type=float, default=0.5, help="weight of unverified farmer declarations")
    ap.add_argument("--kind", choices=sorted(DEPLOYABLE), help="skip the selection rule and export this model family")
    ap.add_argument("--parity-out", default=str(BACKEND / "src" / "ml" / "landuse-parity.json"))
    args = ap.parse_args()

    real = load_real(Path(args.data))
    verified = int((real["label_source"] == "verified").sum()) if len(real) else 0
    print(f"real labelled fields: {len(real)} ({verified} officer-verified)")

    parts = [real]
    if args.synthetic:
        syn = synthetic_fields(args.synthetic)
        syn["ward_id"] = syn["ward_id"] + 1_000_000  # never collide with real ward ids
        parts.append(syn)
    elif verified < args.min_verified:
        raise SystemExit(f"Only {verified} verified fields (need {args.min_verified}). Collect more officer checks, or pass --synthetic N for a demo bootstrap model.")
    df = pd.concat([p for p in parts if len(p)], ignore_index=True)

    x = df[FEATURES].to_numpy(dtype=float)
    y = df["label"].astype(int).to_numpy()
    w = df["label_source"].map({"verified": 1.0, "farmer": args.farmer_weight, "synthetic": 1.0}).fillna(1.0).to_numpy()
    groups = df["ward_id"].fillna(-1).astype(int).to_numpy()

    splits, grouping = cv_splits(y, groups)
    candidates = [k for k in SIMPLICITY if k != "catboost" or CatBoostClassifier is not None]
    comparison = {k: cross_validate(k, x, y, w, splits) for k in candidates}
    if CatBoostClassifier is None:
        print("catboost not installed: compared logistic, random forest and LightGBM only")
    for k, v in comparison.items():
        print(f"  {k:<14} {v}")
    kind, why = choose(comparison)
    if args.kind:
        kind, why = args.kind, f"forced with --kind {args.kind} (rule would pick {kind})"
    print(f"selected: {kind} ({why})")

    model = fit(kind, x, y, w)
    spec, importance = export_model(kind, model)

    trained_on = "synthetic" if verified == 0 and args.synthetic else ("verified-fields" if verified >= args.min_verified else "mixed")
    stamp = datetime.now(timezone.utc)
    chosen = comparison.get(kind) or {}
    out = {
        "name": "landuse",
        "version": f"landuse-{stamp:%Y%m%d}-{trained_on}-{kind}",
        "kind": kind,
        "trainedAt": stamp.isoformat(),
        "trainedOn": trained_on,
        "rows": int(len(df)),
        "metrics": {
            "cv_grouping": grouping,
            "cv_folds": chosen.get("folds", 0),
            "cv_auc": chosen.get("auc_mean", 0),
            "cv_auc_se": chosen.get("auc_se", 0),
            "cv_accuracy": chosen.get("accuracy", 0),
            "cv_f1": chosen.get("f1", 0),
            "rows_real": int(len(real)),
            "rows_verified": verified,
            "rows_synthetic": int(args.synthetic),
            "selection": why,
        },
        "comparison": comparison,
        "featureImportance": importance,
        "features": FEATURES,
        "threshold": 0.5,
        "model": spec,
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(out, allow_nan=False, default=float))

    # Parity fixture: the TypeScript evaluator must reproduce these probabilities.
    sample = x[:: max(1, len(x) // 25)][:25]
    fixture = {
        "version": out["version"],
        "kind": kind,
        "cases": [{"x": [None if math.isnan(v) else v for v in row], "p": float(p)} for row, p in zip(sample.tolist(), model.predict_proba(sample)[:, 1])],
    }
    fx = Path(args.parity_out)
    fx.write_text(json.dumps(fixture))

    print(json.dumps({k: out[k] for k in ("version", "trainedOn", "rows", "metrics")}, indent=2))
    print("top features:", list(importance)[:6])
    print(f"wrote {args.out} and {fx}")


if __name__ == "__main__":
    main()
