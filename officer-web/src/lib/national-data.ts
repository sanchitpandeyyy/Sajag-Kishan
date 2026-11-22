/**
 * National snapshot copied from the public dashboard of the Ministry of Agriculture and
 * Livestock Development (Farmer Registry): https://farmer.moald.gov.np/public/dashboard/
 *
 * Read on 2083-08-05 BS. These are static public figures, kept here to show the research
 * behind Sajag Kishan. Refresh by hand when the ministry updates its page.
 */

export const NATIONAL_SOURCE = {
  url: "https://farmer.moald.gov.np/public/dashboard/",
  asOfBs: "२०८३-०८-०५",
  asOfEn: "2083-08-05 BS",
};

export const NATIONAL_KPIS = {
  households: 2_680_157,
  verified: 870_040,
  verifiedPct: 32,
  classified: 79_015,
  landHa: 1_344_451.4,
  irrigatedPct: 38,
  irrigatedHa: 507_743.4,
  productionMt: 28_968_153.7,
  livestock: 35_294_366,
  livestockUnits: 6_579_873.8,
  subsidyNpr: 8_015_198,
  subsidyRecords: 120,
  municipalities: 753,
};

export interface ProvinceRow {
  ne: string;
  en: string;
  households: number;
  verified: number;
  classified: number;
  landHa: number;
  irrigatedPct: number;
  productionMt: number;
  livestockUnits: number;
}

export const PROVINCES: ProvinceRow[] = [
  { ne: "कोशी प्रदेश", en: "Koshi", households: 506_646, verified: 235_915, classified: 25_841, landHa: 317_326.6, irrigatedPct: 38, productionMt: 7_880_123.1, livestockUnits: 1_601_044.8 },
  { ne: "मधेश प्रदेश", en: "Madhesh", households: 489_133, verified: 104_604, classified: 3_641, landHa: 224_222.2, irrigatedPct: 44, productionMt: 3_432_865.3, livestockUnits: 604_208.5 },
  { ne: "लुम्बिनी प्रदेश", en: "Lumbini", households: 485_610, verified: 155_111, classified: 8_742, landHa: 254_245.5, irrigatedPct: 43, productionMt: 11_796_890.4, livestockUnits: 1_051_507.7 },
  { ne: "बागमती प्रदेश", en: "Bagmati", households: 430_280, verified: 114_118, classified: 10_481, landHa: 168_993.7, irrigatedPct: 28, productionMt: 2_593_451.3, livestockUnits: 1_139_875.4 },
  { ne: "सुदूरपश्चिम प्रदेश", en: "Sudurpashchim", households: 296_771, verified: 118_575, classified: 19_064, landHa: 160_482.3, irrigatedPct: 42, productionMt: 1_999_712.1, livestockUnits: 789_878.0 },
  { ne: "गण्डकी प्रदेश", en: "Gandaki", households: 261_545, verified: 71_311, classified: 6_687, landHa: 94_988.4, irrigatedPct: 33, productionMt: 936_640.2, livestockUnits: 678_584.5 },
  { ne: "कर्णाली प्रदेश", en: "Karnali", households: 210_172, verified: 70_406, classified: 4_559, landHa: 124_192.6, irrigatedPct: 28, productionMt: 328_471.4, livestockUnits: 714_775.0 },
];

export interface Slice {
  ne: string;
  en: string;
  value: number;
}

/** Household heads by gender. */
export const GENDER: Slice[] = [
  { ne: "पुरुष", en: "Male", value: 1_359_696 },
  { ne: "महिला", en: "Female", value: 1_319_963 },
  { ne: "अन्य", en: "Other", value: 498 },
];

/** Farmer classes under Schedule 5 of the Agribusiness Promotion Regulation, 2080. */
export const TIERS: Slice[] = [
  { ne: "निर्वाहमुखी किसान", en: "Subsistence farmers", value: 4_555 },
  { ne: "साना व्यावसायिक किसान", en: "Small commercial farmers", value: 48_650 },
  { ne: "मझौला व्यावसायिक किसान", en: "Medium commercial farmers", value: 23_708 },
  { ne: "ठूला व्यावसायिक किसान", en: "Large commercial farmers", value: 6_784 },
];

/** Production by crop group, metric tonnes. */
export const CROP_GROUPS: Slice[] = [
  { ne: "खाद्यान्न बाली", en: "Food grains", value: 24_675_688.7 },
  { ne: "औद्योगिक बाली", en: "Industrial crops", value: 1_860_856.58 },
  { ne: "तरकारी खेती", en: "Vegetables", value: 1_015_811.68 },
  { ne: "फलफूल", en: "Fruits", value: 833_741.91 },
  { ne: "मौरी", en: "Honey bees", value: 230_564.71 },
  { ne: "दलहन बाली", en: "Pulses", value: 139_959.74 },
  { ne: "तेलहन बाली", en: "Oilseeds", value: 131_757.35 },
  { ne: "मसला बाली", en: "Spices", value: 23_149.86 },
  { ne: "बीउ र बेर्ना नर्सरी", en: "Seed and seedling nursery", value: 13_738.34 },
  { ne: "चिया", en: "Tea", value: 13_623.34 },
  { ne: "कफी", en: "Coffee", value: 12_903.42 },
  { ne: "अन्य बाली", en: "Other crops", value: 9_621.35 },
  { ne: "च्याउ", en: "Mushroom", value: 5_781.82 },
  { ne: "पुष्प खेती", en: "Flowers", value: 954.96 },
];

/** Animal counts by kind (fish excluded). */
export const LIVESTOCK: Slice[] = [
  { ne: "कुखुरा", en: "Poultry", value: 22_022_295 },
  { ne: "बाख्रा, च्याङ्ग्रा", en: "Goats", value: 8_141_362 },
  { ne: "गाई, गोरु, बाछाबाछी", en: "Cattle", value: 2_081_126 },
  { ne: "भैंसी, राँगा, पाडापाडी", en: "Buffalo", value: 1_427_234 },
  { ne: "बंगुर, सुंगुर", en: "Pigs", value: 637_871 },
  { ne: "अन्य पन्छी", en: "Other birds", value: 480_926 },
  { ne: "भेडा", en: "Sheep", value: 336_860 },
  { ne: "अन्य पशु", en: "Other animals", value: 166_692 },
];

/** Registered land by recorded use, hectares. */
export const LAND_USE: Slice[] = [
  { ne: "उल्लेख नभएको", en: "Not specified", value: 1_311_065.77 },
  { ne: "पशुपन्छी र मत्स्यपालन", en: "Livestock and fisheries", value: 14_399.75 },
  { ne: "कृषि", en: "Agriculture", value: 12_574.23 },
  { ne: "मिश्रित", en: "Mixed", value: 5_868.41 },
  { ne: "कृषि उद्योग", en: "Agro industry", value: 290 },
  { ne: "कृषि वन", en: "Agroforestry", value: 157.48 },
  { ne: "बाँझो", en: "Fallow", value: 96.3 },
];

/** Subsidy recorded against farmers, NPR. */
export const SUBSIDY: Slice[] = [
  { ne: "कृषि", en: "Agriculture", value: 6_526_197.5 },
  { ne: "पशुपन्छी पालन", en: "Livestock", value: 1_289_000 },
  { ne: "अन्य", en: "Other", value: 200_000 },
];

/** Registered households per day, 2083-06-05 to 2083-08-05 BS (62 daily readings). */
export const REGISTRATION_TREND = {
  fromBs: "२०८३-०६-०५",
  toBs: "२०८३-०८-०५",
  fromEn: "2083-06-05",
  toEn: "2083-08-05",
  values: [
    2677684, 2677684, 2677684, 2677684, 2677684, 2677684, 2677684, 2678980, 2678904, 2679318, 2679451, 2679610, 2679724, 2679839, 2680140, 2679858, 2678983, 2678907, 2677551, 2677662, 2677710, 2677626,
    2677495, 2677461, 2677650, 2677556, 2677582, 2677635, 2677669, 2677703, 2677716, 2677716, 2677716, 2677716, 2677716, 2677716, 2677716, 2677720, 2677811, 2677824, 2677864, 2677954, 2678005, 2678107,
    2678256, 2678219, 2678374, 2678435, 2678473, 2678490, 2678473, 2678482, 2678509, 2678590, 2678574, 2678658, 2678768, 2679037, 2679263, 2679522, 2679898, 2680157,
  ],
};

/**
 * The 62 dates (BS, as YYYY-MM-DD) behind every daily registration series, one per reading.
 * Month 06 has 31 days and month 07 has 30 days in this window, which matches the labels on the source chart.
 */
export const TREND_DAYS: string[] = (() => {
  const monthLength: Record<number, number> = { 6: 31, 7: 30, 8: 30 };
  const out: string[] = [];
  let month = 6;
  let day = 5;
  for (let i = 0; i < 62; i++) {
    out.push(`2083-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    day += 1;
    if (day > monthLength[month]!) {
      month += 1;
      day = 1;
    }
  }
  return out;
})();
