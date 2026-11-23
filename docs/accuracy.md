# Accuracy of Satellite, Soil and Model Outputs

Written for: project team and officers reviewing what the platform's numbers can and cannot be trusted for.

Each source is listed with what it measures, how accurate it is known to be, and what that means here. Where a number is not confirmed, it says so.

---

## 1. Summary

| Output | Kind | Accuracy status | Use it for | Do not use it for |
|---|---|---|---|---|
| Sentinel-2 indices (NDVI, NDRE, EVI, SAVI, NDMI, NDWI) | Measured | Operational ESA product; reliable on clear pixels | Crop vigour over time | Nutrient levels |
| Sentinel-1 VV/VH backscatter | Measured | Calibrated; ~1 dB speckle per reading | Crop-cycle and paddy detection | Absolute soil moisture |
| Cloud masking (SCL) | Classified | Imperfect; thin haze can pass | Choosing clear readings | Guaranteeing clear pixels |
| Copernicus DEM elevation/slope | Modelled from satellite | Vertical error typically a few metres | Terrain context | Precise survey |
| ESA WorldCover land cover | Classified | ~77% overall accuracy (ESA, global); cropland weaker | Context | Field-level land use |
| ERA5 soil moisture (0–7 cm) | Model estimate | Typically ±0.04–0.06 m³/m³ vs in-situ sensors (general ERA5-Land finding; not checked for Nepal) | Regional wet/dry patterns | One field's actual moisture |
| Sentinel-1 moisture index | Relative score | Not validated against field data | Ranking a field's wetness over time | Any absolute moisture value |
| SoilGrids pH, organic carbon, nitrogen, clay | Global model estimate | Published global validation exists; per-property numbers not confirmed here (see §3) | Starting estimate for empty fields | Fertilizer decisions without a soil test |
| Land-use model (cultivated vs fallow) | ML prediction | **Not measured on real fields**; deployed model trained on synthetic data | Nothing yet, until retrained | Any officer decision |
| Fallow flag and season status (rules) | Rule-based | Thresholds not calibrated on local fields | Prompting an officer check | Enforcement without a check |

---

## 2. Satellite measurements

### 2.1 Sentinel-2 (optical), reflectance and indices

- **Source:** ESA Copernicus Sentinel-2 L2A, via Microsoft Planetary Computer.
- **Revisit:** about 5 days with two satellites (2A and 2B); 2C adds to this from 2024.
- **Resolution used:** 10 m (B02, B03, B04, B08) and 20 m (B05, B8A, B11).
- **Reliability:** operational, radiometrically calibrated, atmospherically corrected by ESA (Sen2Cor / L2A processing). Indices computed from it are standard and well used in agriculture.
- **Known weaknesses for this project:**
  - **Cloud:** monsoon (Barshe) season often has no clear scene. Readings are dropped, not guessed.
  - **Cloud masking:** SCL class 7 ("unclassified") can include thin cloud or haze, which slightly lowers NDVI.
  - **Point sampling:** we read a 3×3 pixel window (~30 × 30 m) at the parcel centroid, not the whole plot. Small or irregular plots mix with neighbours.
  - **Cloud check on the centre pixel only**, while NDVI averages all nine pixels.

### 2.2 Sentinel-1 (radar), VV and VH backscatter

- **Source:** ESA Copernicus Sentinel-1 RTC (radiometrically and terrain corrected), via Planetary Computer.
- **Reliability:** calibrated; works through cloud and at night.
- **Known weaknesses:**
  - **Speckle:** each pixel is noisy by roughly 1 dB. We average 3×3 pixels per reading and use the range across many dates, which is more robust than any single reading.
  - **Confounders:** surface roughness, ploughing, and crop structure all change VH as well as crop growth.

### 2.3 Copernicus DEM (elevation, slope, aspect)

- **Resolution:** 30 m; vertical error typically a few metres.
- **Use:** terrain context and a model feature. Slope is derived from a 3×3 neighbourhood, so it is smoothed.

### 2.4 ESA WorldCover 2021 (land cover)

- **Resolution:** 10 m, single year (2021).
- **Accuracy:** ESA reports about **77% overall** accuracy globally. Cropland is one of the classes with more confusion, for example against grassland and wetland.
- **Use:** displayed as context; not an input to the model.

---

## 3. Soil estimates (SoilGrids 2.0, ISRIC)

**What it is:** a global map produced by machine learning from about 240,000 soil profiles, with environmental layers such as climate, terrain and vegetation as predictors. Output is at ~250 m, for depths 0–5 cm, 5–15 cm, 15–30 cm and deeper.

**What we use:** pH (water), soil organic carbon, total nitrogen and clay at 0–5 cm. Values are stored with `soilPhSource = "ESTIMATED_SOILGRIDS"` where they fill an empty pH, and are always labelled "estimated from global map".

**Published validation (Poggio et al., 2021, SOIL 7, 217–240):**
- Validation method: **10-fold cross-validation with spatially stratified folds**, so that all horizons of one profile stay in the same fold. The authors say random splitting is unsuitable because observations are unevenly distributed.
- Metrics used in the paper: **RMSE** and the **model efficiency coefficient (MEC)**. The paper's text does not report R², CCC or MAE.
- Uncertainty: 90% prediction intervals from quantile regression forests. Empirical coverage is close to the expected 90% for most properties. Sand is somewhat under-covered (~78–80%), and clay has no separate figure in the text.
- Qualitative findings: performance decreases with depth. Clay is less well modelled than sand and silt.

**What is not confirmed here:** the per-property numbers for pH, organic carbon, nitrogen and clay. They are in tables that the source page displays as images, and I could not read them. Get them from Tables 4–5 of the paper before quoting any figure. Do not quote a number from this file as the SoilGrids accuracy.

**Practical accuracy for this project (judgement, not measured):**
- **pH:** the most reliable of the four, but still off by a fraction of a pH unit at a single site. Treat as "roughly acidic / neutral / alkaline", not as a value for liming decisions.
- **Organic carbon and nitrogen:** less reliable than pH; a value can be off by a large relative amount in any one place.
- **Clay:** the weakest of the four according to the paper's own qualitative findings.
- **Resolution:** 250 m is far coarser than a field. The value describes the surroundings, not the parcel.

**Local check (done in this session):** the live query for the pilot point (28.995, 80.17) returned pH 6.5, organic carbon 33.9 g/kg, nitrogen 2.03 g/kg, clay 23.1%. These are plausible for Terai alluvial soil, but **no local lab test was used to check them.**

---

## 4. Soil moisture

### 4.1 ERA5 / ERA5-Land (Open-Meteo, 0–7 cm)

- **What it is:** a reanalysis, i.e. a numerical land-surface model driven by observed weather. Not a sensor.
- **Grid:** coarse (~9 km for ERA5-Land; Open-Meteo serves a version on this scale), with one value per ward centre here, so every field in a ward gets the same number.
- **Published validation (general ERA5-Land results, not checked for Nepal):** typical error about 0.04–0.06 m³/m³ against in-situ sensors, correlation roughly 0.6–0.8. Errors are larger in arid areas, irrigated fields, heavy clay and heterogeneous terrain.
- **Local status:** no local validation exists. The Terai climate is humid in the monsoon, which is one of the regimes where these products tend to do reasonably well, but that is not a measured result.

### 4.2 Sentinel-1 moisture index

- Computed as relative position in the field's own VV range, 0 to 1. **Not calibrated to volumetric moisture** and not validated.
- Crop growth and ploughing change VV as much as soil water does.
- Use it only to rank a field's wetness over time, never as a number to report.

### 4.3 NDMI

- Measures water **in the leaves**, not in the soil. Do not label NDMI as soil moisture.

---

## 5. Detection and prediction

### 5.1 Fallow flag and season status (rule-based)

- Thresholds: NDVI peak < 0.35 for fallow, ≥ 0.50 for cultivated; VH range ≥ 3 dB for a crop cycle; VH ≤ −21 dB for a paddy flood signature.
- **Not calibrated on local fields.** Typical values from the literature, adopted without local tuning.
- Ways each can be wrong:
  - **False "fallow":** a field with a late sowing, a drought-stressed crop, or cloud-reduced readings. Peak NDVI can stay below 0.35 in a real crop.
  - **False "cultivated":** a weedy or grassy fallow with high NDVI.
- Officer check is required before any action.

### 5.2 Land-use model (cultivated vs fallow)

- **Status: not validated on real fields.** The model in `backend/models/landuse.json` was trained on 1,500 **synthetic** fields with **0 real** labels.
- **The reported numbers are not accuracy:** CV AUC 1.0 and accuracy 99.7% come from the synthetic generator, where cultivated and fallow fields are separable by construction.
- **Real accuracy:** unknown. It needs at least 30 officer-verified fields (200+ recommended, across several wards) before a meaningful cross-validation can be run.
- **Known validity gaps before real training:**
  1. Features cover the last 365 days, but labels refer to one declared season.
  2. Point sampling at the centroid, not the plot.
  3. Climate is shared by all fields in a ward.
  4. Labels come from self-declarations unless officer-verified.

### 5.3 Ground-truth standard for everything above

Only officer-verified observations count as ground truth: a field visited and checked, its crop and status recorded. Declarations are self-reported and can be wrong.

---

## 6. How to measure real accuracy (recommended)

| Output | Method | Minimum sample |
|---|---|---|
| Fallow flag / season status | Officer visit compares flag with field status | ~50 fields across 3+ wards |
| Land-use model | Ward-grouped cross-validation on verified labels | 30 minimum; 200+ recommended |
| ERA5 soil moisture | Spot readings with a handheld TDR or capacitance probe, compared with ERA5 for the same date | 20–30 readings across the season |
| Soil pH and nutrients | Laboratory soil test on the same fields | 20+ fields, spanning the range of SoilGrids pH |
| Sentinel-1 moisture index | Same probe readings, correlation over time | Same as ERA5 test |

Report each as: sample size, method, error figure, and the date range. Do not report a figure without the sample it came from.

---

## 7. Sources

- Poggio et al. (2021), *SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty*, SOIL 7, 217–240: https://soil.copernicus.org/articles/7/217/2021/
- Copernicus Sentinel-2 mission (ESA): https://sentiwiki.copernicus.eu
- Copernicus Sentinel-1 mission (ESA): https://sentiwiki.copernicus.eu
- ESA WorldCover (accuracy statement): https://esa-worldcover.org
- ERA5-Land reanalysis (ECMWF / Copernicus Climate Change Service): https://cds.climate.copernicus.eu
- Microsoft Planetary Computer (data hosting): https://planetarycomputer.microsoft.com
- ISRIC SoilGrids REST API: https://rest.isric.org/soilgrids/v2.0/docs
