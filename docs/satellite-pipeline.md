# Satellite and Field Detection Pipeline

How the platform turns satellite data into a field-level verdict: **cultivated**, **weak** or **fallow**.

---

## 0. What is real and what is dummy

| Part | Status | Where it comes from |
|---|---|---|
| Pilot area (Bhimdatta Municipality, Kanchanpur, 19 wards, ~28.94–29.01 N, 80.13–80.245 E) | **Real coordinates** | `backend/prisma/seed.ts` |
| Farmers, parcels, declarations, subsidies | **Dummy** (seeded demo records placed on real coordinates) | `backend/prisma/seed.ts` |
| Satellite readings (NDVI, NDRE, NDWI, NDMI, EVI, SAVI, VV, VH) | **Real**: measured by Sentinel-2 / Sentinel-1 over those exact coordinates | `backend/src/satellite/sync.ts`, `history.ts` |
| Satellite images (true colour + NDVI map) | **Real** scenes, rendered from the same satellite files | `backend/src/satellite/images.ts` |
| Elevation, slope, aspect | **Real** (Copernicus DEM) | `backend/src/satellite/terrain.ts` |
| Land cover class | **Real** (ESA WorldCover 2021) | `backend/src/satellite/landcover.ts` |
| Rainfall, temperature, soil moisture, evapotranspiration | **Real** (ERA5 reanalysis via Open-Meteo) | `backend/src/satellite/climate.ts` |
| ML model currently deployed | **Trained on synthetic fields** (bootstrap only) | `backend/models/landuse.json` |

The seed script never writes satellite readings. Every row in `SatelliteObservation` comes from a real satellite file read at the parcel's coordinates. The only dummy parts are *who owns the field* and *what the owner declared*, so the greenness and radar values you see for any mapped point are real measurements of that ground.

---

## 1. What a satellite actually measures

### 1.1 Sentinel-2: optical (reflected sunlight)

- Two or three ESA satellites (Copernicus programme) in sun-synchronous orbit at ~786 km. They pass over Nepal around 10:30 local time.
- The same spot is revisited about every **5 days**.
- The sensor (MSI) records how much sunlight the ground reflects in 13 wavelength bands. We use 8:

| Band | Wavelength (centre) | Pixel | What it tells us |
|---|---|---|---|
| B02 Blue | 490 nm | 10 m | Atmosphere/soil correction (EVI) |
| B03 Green | 560 nm | 10 m | Water, leaf colour (NDWI) |
| B04 Red | 665 nm | 10 m | **Chlorophyll absorbs red**: healthy leaves look dark here |
| B05 Red edge | 705 nm | 20 m | Chlorophyll content, does not saturate in dense crops |
| B08 NIR | 842 nm | 10 m | **Leaf cell structure reflects NIR strongly**: healthy leaves look bright |
| B8A Narrow NIR | 865 nm | 20 m | Used with red edge and SWIR |
| B11 SWIR | 1610 nm | 20 m | **Water in leaves absorbs SWIR**: canopy moisture |
| SCL | (classification) | 20 m | ESA's per-pixel label: vegetation, bare soil, water, cloud, cloud shadow, snow... |

The core physics is simple: a green plant **absorbs red light and reflects near-infrared light**. Bare soil reflects both roughly equally. The gap between NIR and red is therefore a direct measure of living green leaf. All the vegetation indices below exploit this.

We use the **Level-2A** product, which ESA has already corrected for the atmosphere. Values are *surface reflectance* (fraction of sunlight reflected, 0–1), stored as integers ×10,000. Since processing baseline 04.00 (25 Jan 2022) ESA adds +1000 to every value, so we subtract it for newer scenes (`reflectance()` in `indices.ts`).

**Limitation:** optical sensors cannot see through cloud. In the monsoon (Barshe season) many scenes are useless, which is why radar is also used.

### 1.2 Sentinel-1: radar (microwave echo)

- C-band synthetic aperture radar (5.405 GHz, ~5.5 cm wavelength) at ~693 km.
- It sends its own microwave pulse and measures the echo, so it **works through cloud, rain and at night**.
- Revisit is about 6–12 days, depending on how many Sentinel-1 satellites are in orbit.
- Two polarisations:
  - **VV** (sent vertical, received vertical): sensitive to soil moisture and surface roughness.
  - **VH** (sent vertical, received horizontal): sensitive to **volume scattering from leaves and stems**. VH rises as a crop canopy grows.
- We use the **RTC** (Radiometric Terrain Corrected) product. Hill slopes are already corrected and values are gamma-nought backscatter in linear power, which we convert to decibels: `dB = 10 · log10(power)`.

Typical patterns:
- Bare or fallow field: VH stays low and flat across the season.
- Growing crop: VH climbs several dB from sowing to peak.
- Flooded paddy at transplanting: very dark VH (≤ −21 dB, water reflects the pulse away), then a sharp rise as rice grows.

### 1.3 Supporting layers

| Layer | Source | Resolution | Used for |
|---|---|---|---|
| Elevation, slope, aspect | Copernicus DEM GLO-30 | 30 m | Field terrain (computed once per parcel; slope from a 3×3 Horn kernel) |
| Land cover | ESA WorldCover 2021 v200 | 10 m | Context: is this pixel mapped as cropland, trees, built-up...? ESA reports ~77% overall accuracy globally. Displayed only; not a model input |
| Daily weather | ERA5 reanalysis via Open-Meteo archive (`era5_seamless`) | ~9–25 km grid | Rain, mean/max temperature, 0–7 cm soil moisture, reference evapotranspiration (ET0). Fetched once per ward centroid |

---

## 2. How the data is fetched

All imagery comes from **Microsoft Planetary Computer**, which hosts the full Sentinel archives free of charge.

1. **Search** (`pc.ts → stacSearch`): a STAC API query of the form "all `sentinel-2-l2a` scenes that cover point (lat, lng) between dates X and Y with cloud cover < 60%". The answer is JSON describing each scene and links to its band files.
2. **Sign** (`sasToken`): Planetary Computer issues a short-lived access token per collection. It is cached until it expires.
3. **Read** (`readWindow`): each band is a **Cloud-Optimized GeoTIFF (COG)**. Using HTTP range requests (`geotiff.js`) we download *only the few pixels around the field*, not the whole 100 × 100 km tile.
4. **Reproject**: the field's lat/lng is converted to the scene's UTM zone (`proj4`) to find the right pixel.

Formats received:

| Data | Format | Raw value type |
|---|---|---|
| Scene catalogue | STAC JSON | – |
| Sentinel-2 bands | COG | uint16 digital number (reflectance × 10,000, +1000 offset after 2022) |
| Sentinel-2 SCL | COG | uint8 class code |
| Sentinel-1 VV/VH | COG | float32 linear backscatter |
| DEM | COG | float32 metres |
| WorldCover | COG | uint8 class code |
| Weather | JSON (Open-Meteo) | daily floats |
| Preview images | JPEG, rendered by the Planetary Computer data API, then stored in object storage | – |

---

## 3. Per-scene processing

For every Sentinel-2 scene over a field (`sentinel2.ts → indicesAt`):

1. Read the **SCL** pixel at the field centre. The reading is kept only if the class is 4 (vegetation), 5 (bare), 6 (water) or 7 (unclassified). Cloud, cloud shadow, cirrus and snow readings are stored with null indices.
2. Read a **3×3 window of 10 m pixels** (~30 × 30 m) for blue, green, red and NIR, plus the centre 20 m pixel for red edge, narrow NIR and SWIR.
3. Convert to reflectance and compute the indices:

| Index | Formula (S2 bands) | Measures | Typical range |
|---|---|---|---|
| **NDVI** | (B08 − B04) / (B08 + B04) | Green leaf amount | Water < 0, bare soil 0.1–0.2, sparse 0.2–0.4, crop 0.4–0.9 |
| **NDRE** | (B8A − B05) / (B8A + B05) | Chlorophyll / nitrogen status, works in dense canopy | 0.1–0.6 |
| **NDWI** | (B03 − B08) / (B03 + B08) | Open water / flooding | > 0 means water |
| **NDMI** | (B8A − B11) / (B8A + B11) | Water inside leaves (drought stress) | Dry < 0, well watered 0.2–0.4 |
| **EVI** | 2.5 (NIR − Red) / (NIR + 6 Red − 7.5 Blue + 1) | Greenness, less saturated, corrects haze | 0.2–0.8 for crops |
| **SAVI** | 1.5 (NIR − Red) / (NIR + Red + 0.5) | Greenness with soil brightness suppressed | Useful early season when soil shows |

4. Store one row in `SatelliteObservation` (`sensor = "S2"`), with the scene id, cloud % and SCL code in `meta`.

For every Sentinel-1 scene (`sentinel1.ts → backscatterAt`): read 3×3 pixels of VV and VH, average them, convert to dB, and store a row with `sensor = "S1"` and the orbit direction.

NDVI classes shown in the UI (`NDVI_CLASSES` in `indices.ts`):

| NDVI ≥ | Class |
|---|---|
| −1 | Water, cloud or snow |
| 0 | Bare soil or built up |
| 0.2 | Sparse plants |
| 0.4 | Moderate crop |
| 0.6 | Dense, healthy crop |
| 0.75 | Very dense crop |
| 0.9 | Peak greenness |

### Images

`images.ts` builds two JPEG previews per scene from the same Sentinel-2 file:
- **True colour**: bands B04/B03/B02 as red/green/blue, gamma and saturation adjusted.
- **NDVI map**: NDVI computed per pixel and coloured red → yellow → green.

These are what officers see in the parcel's satellite timeline. They are real images of the field on that date.

### When syncing happens

| Job | Window | Trigger |
|---|---|---|
| `syncParcel` (`sync.ts`) | Last 6 months, up to 8 S2 + 8 S1 scenes | Officer clicks Sync (`POST /satellite/sync`), or `npx tsx src/satellite/sync-all.ts 30` |
| `syncParcelHistory` (`history.ts`) | Last 6 seasons (Chaite: Mar–mid Jun; Barshe: mid Jun–Oct; Hiude: Nov–Feb), up to 3 clearest scenes per season (cloud < 30%, ≥ 15 days apart) | Land transparency history |
| `syncWardClimate` (`climate.ts`) | ~400 days of daily weather, incremental | During parcel sync, refreshed at most every 12 h per ward |

---

## 4. Detection: turning readings into a verdict

There are three detection layers. Only the third is machine learning.

### 4.1 Fallow flag (rules, `sync.ts`)

Over the last 365 days:
- **Optical says fallow** if there are ≥ 3 clear readings and peak NDVI < 0.35.
- **Radar says a crop cycle happened** if there are ≥ 4 readings and the VH range is ≥ 3 dB.
- **Paddy signature**: VH dips to ≤ −21 dB (flooding) and then rises ≥ 3 dB.
- Combined: radar crop cycle → cultivated. Otherwise the optical verdict. Otherwise the radar verdict. Otherwise unknown.

### 4.2 Season status (rules, `engine/land-transparency.ts`)

For each season window, take the peak NDVI of clear readings:

| Peak NDVI | Status |
|---|---|
| ≥ 0.50 | Cultivated |
| 0.35 – 0.50 | Weak |
| < 0.35 with ≥ 2 readings | Fallow |
| No clear readings | Unknown |

A season is judged only after 75 days have passed. Officer review flags (`subsidy_on_fallow`, `declared_not_seen`, `abandoned`, `area_overclaim`, `farmed_not_declared`) come from comparing this status with the farmer's declaration and subsidies.

### 4.3 Land-use model (ML, `backend/src/ml/`)

Predicts the probability that a field is **cultivated** (vs fallow) from 27 features.

#### Input: one row per field

| Group | Features |
|---|---|
| Optical (S2, 365 days) | `ndvi_max`, `ndvi_mean`, `ndvi_min`, `ndvi_latest`, `ndvi_amplitude`, `ndvi_count`, `ndre_max`, `ndwi_max`, `ndmi_mean`, `evi_max`, `savi_max` |
| Radar (S1, 365 days) | `vh_mean`, `vh_range`, `vh_std`, `vv_mean`, `vv_std`, `vh_minus_vv`, `s1_count` |
| Terrain / field | `elevation_m`, `slope_deg`, `irrigated` (0 if rainfed, else 1) |
| Climate (ward) | `rain_365_mm`, `rain_90_mm`, `temp_mean_c`, `hot_days` (max ≥ 35 °C), `soil_moisture_mean`, `water_balance_mm` (rain − ET0) |

Missing values (e.g. no clear optical scene) are left as NaN. Climate features are blanked if less than 80% of days are available.

#### Labels

From the farmer's latest declaration (`isFallow`): **1 = cultivated, 0 = fallow**.
- Officer-verified declaration or parcel: weight 1.0
- Unverified farmer declaration: weight 0.5
- Disputed: excluded

Training CSV (`ml/data/landuse.csv`): `parcel_id, ward_id, <27 features>, label, label_source`.

#### Training (`ml/train_landuse.py`, offline, Python)

1. Four model families are compared:
   - Logistic regression (with median imputation + standard scaling)
   - Random forest (LightGBM in `rf` mode, 300 trees)
   - **LightGBM** gradient boosting (150 trees, 15 leaves, learning rate 0.05)
   - CatBoost (for comparison only, not deployable)
2. **Cross-validation**: 5-fold `StratifiedGroupKFold` grouped by **ward**, so neighbouring fields never appear in both the training and test folds and the score is not inflated.
3. Metrics: ROC AUC (mean ± standard error), accuracy and F1 at threshold 0.5.
4. **Selection**: one-standard-error rule. Take the best mean AUC, then deploy the simplest deployable model whose AUC is within one SE of it.
5. **Export** to `backend/models/landuse.json`: logistic coefficients, or the full LightGBM tree dump. A parity file (`landuse-parity.json`) lets the TypeScript tests check that the backend reproduces Python's probabilities exactly.
6. A real model is refused with fewer than 30 officer-verified fields.

#### What LightGBM does

LightGBM builds many small decision trees one after another, each correcting the errors of the trees before it (gradient boosting). For a field, every tree asks threshold questions such as "is `vh_range` ≤ 2.8?" or "is `ndvi_max` ≤ 0.41?" and lands on a leaf score. The scores are summed and passed through a sigmoid to give a probability.

It suits this data because:
- It handles **missing values natively**: it learns which branch a cloud-hidden field should take, so radar can carry the decision in the monsoon.
- It captures interactions, e.g. "low NDVI is fallow *unless* VH shows a crop cycle".
- It needs no feature scaling.

In production, `backend/src/ml/gbdt.ts` walks the exported trees in TypeScript, so no Python runs on the server. LightGBM also powers the random-forest candidate (`boosting_type="rf"`).

#### Inference

`predictParcel` (`ml/jobs.ts`) runs after every sync that adds readings. It computes the 27 features and the probability, then stores a `ModelPrediction` row with the label, probability, model version and the feature values used. If no model file is present, a rule fallback (`rules-v1`) gives the probability instead.

---

## 5. Accuracy and validity

### Satellite measurements (real)

| Measurement | Reliability |
|---|---|
| Sentinel-2 L2A reflectance | Operational ESA product, radiometrically calibrated and atmospherically corrected. Indices are reliable on clear pixels |
| Cloud screening | Depends on ESA's SCL mask. Thin haze can be labelled class 7 and slightly lower NDVI |
| Sentinel-1 RTC | Calibrated and terrain corrected. Individual readings carry speckle noise (~1 dB), reduced by 3×3 averaging and by using ranges over many dates |
| Copernicus DEM | ~30 m, vertical error typically a few metres |
| ERA5 weather | Reanalysis, not a rain gauge. Good for seasonal totals, coarse for a single field |

### Detection (rules and model)

| Item | Status |
|---|---|
| Deployed model | `landuse-<date>-synthetic-logistic`, trained on **1,500 synthetic fields, 0 real fields** |
| Reported CV AUC 1.0 / accuracy 99.7% | **Not a real-world accuracy.** Synthetic cultivated and fallow fields are cleanly separable by construction |
| Real-world accuracy | **Not yet measured.** Requires officer-verified fields (≥ 30 minimum, 200+ recommended, across several wards) |
| Rule thresholds (NDVI 0.35 / 0.5, VH 3 dB, −21 dB) | Standard values for this kind of analysis; not yet calibrated on local fields |

So the input data is real; the decision layer on top of it still needs calibration with ground truth.

---

## 6. Known limitations

1. **Season alignment**: labels refer to one declared season, but model features always cover the 365 days ending today. Features should be computed over the declared season's window before training on real data.
2. **Point sampling**: we read ~30 × 30 m around the parcel centroid, not the parcel polygon. Plots smaller than ~0.1 ha, or irregular plots whose centroid lies outside the field, mix in neighbouring land.
3. **Cloud check uses the centre pixel only**, while NDVI averages 9 pixels. A cloud edge can lower NDVI.
4. **Climate is per ward**: every field in a ward gets the same weather values, so these features cannot tell fields in one ward apart.
5. **Declarations are self-reported**: only officer-verified labels are trustworthy ground truth.

---

## 7. Running the pipeline

```bash
# 1. Fetch real satellite and climate data for mapped fields
cd backend && npx tsx src/satellite/sync-all.ts 30

# 2. Export the labelled feature table
npx tsx src/ml/export-landuse.ts          # -> ml/data/landuse.csv

# 3. Train (Python, offline)
cd ../ml
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python train_landuse.py                 # real labels (needs >= 30 verified)
.venv\Scripts\python train_landuse.py --synthetic 1500  # demo bootstrap only

# 4. Re-score every field
cd ../backend && npx tsx src/ml/predict-all.ts

# 5. Check the TypeScript evaluator matches Python
npm test
```

Quick check of real NDVI at any point (no database needed):

```bash
cd backend && npx tsx src/satellite/probe-points.ts 28.995,80.17 28.951,80.23
```

---

## 8. Code map

| File | Role |
|---|---|
| `backend/src/satellite/pc.ts` | Planetary Computer STAC search, token signing, COG window reads, UTM reprojection |
| `backend/src/satellite/sentinel2.ts` | S2 scene search, cloud mask, indices, greenness verdict |
| `backend/src/satellite/sentinel1.ts` | S1 scene search, VV/VH backscatter, radar verdict |
| `backend/src/satellite/indices.ts` | Index formulas, reflectance conversion, NDVI classes, slope/aspect |
| `backend/src/satellite/terrain.ts` | Copernicus DEM elevation and slope |
| `backend/src/satellite/landcover.ts` | ESA WorldCover class at the field |
| `backend/src/satellite/climate.ts` | Open-Meteo ERA5 daily weather per ward |
| `backend/src/satellite/images.ts`, `image-store.ts` | True-colour and NDVI preview images, stored in object storage |
| `backend/src/satellite/sync.ts`, `history.ts` | Recent and per-season sync jobs |
| `backend/src/engine/land-transparency.ts` | Season windows, season status rules, officer flags |
| `backend/src/ml/features.ts` | The 27 model features |
| `backend/src/ml/jobs.ts` | Prediction job and training-data export |
| `backend/src/ml/landuse.ts`, `gbdt.ts`, `linear.ts` | Model loading, LightGBM tree evaluator, logistic evaluator, rule fallback |
| `ml/train_landuse.py` | Offline training, cross-validation and model selection |
| `backend/src/routes/satellite.ts` | API: sync, status, predictions, parcel images and readings |
