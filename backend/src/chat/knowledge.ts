import { CALENDAR_TEMPLATES, CROPS, diseaseKnowledge, FERTILIZER_DOSE_KG_HA, ZONE_LABEL_NE } from "../engine";
import { glossTokens, tokens } from "./lexicon";

export interface KnowledgeDoc {
  id: string;
  kind: "disease" | "crop" | "fertilizer" | "general";
  crop?: string;
  titleNe: string;
  titleEn: string;
  textNe: string;
  textEn: string;
}

const M2_PER_KATTHA = 338.63;
const M2_PER_ROPANI = 508.72;
const MONTH_NE = ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"];
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEASON_NE: Record<string, string> = { BARSHE: "बर्खे", HIUDE: "हिउँदे", CHAITE: "चैते" };

export function perLocalUnit(kgHa: number): { kattha: number; ropani: number } {
  return { kattha: Math.round((kgHa * M2_PER_KATTHA) / 1000) / 10, ropani: Math.round((kgHa * M2_PER_ROPANI) / 1000) / 10 };
}

const GENERAL: Omit<KnowledgeDoc, "kind">[] = [
  {
    id: "general.soil-test",
    titleNe: "माटो परीक्षण",
    titleEn: "Soil testing",
    textNe: "मल धेरै वा थोरै नहोस् भन्न ३ वर्षमा एक पटक माटो परीक्षण गराउनुहोस्। खेतका ५-६ ठाउँबाट ६ इन्च गहिराइको माटो मिसाएर आधा केजी नमूना कृषि ज्ञान केन्द्र वा पालिकाको कृषि शाखामा लैजानुहोस्।",
    textEn: "Test the soil once every 3 years so fertilizer is neither too much nor too little. Mix soil from 5-6 spots at 6 inch depth and take a half-kg sample to the Agriculture Knowledge Centre or the municipality agriculture section.",
  },
  {
    id: "general.subsidy",
    titleNe: "अनुदान (मल, बीउ, मेसिन)",
    titleEn: "Subsidy (fertilizer, seed, machines)",
    textNe: "अनुदान पाउन कृषक दर्ता र बाली घोषणा हुनुपर्छ। एपमा 'मेरो खेत' मा बाली छान्नुहोस् र खेतको स्थान राख्नुहोस्। अधिकृतले जग्गा र बालीका आधारमा मल/बीउ बाँडफाँट गर्नुहुन्छ, साना र मोही किसानलाई प्राथमिकता हुन्छ। तपाईंको भाग एपको 'मेरो खेत' मा देखिन्छ।",
    textEn: "To get subsidy you must be a registered farmer with a crop declared. In the app, choose your crop under My fields and save the field location. The officer allocates fertilizer/seed by land and crop, with priority for small and tenant farmers. Your share shows under My fields.",
  },
  {
    id: "general.storage",
    titleNe: "अन्न भण्डारण",
    titleEn: "Grain storage",
    textNe: "अन्न १२-१४% चिस्यानसम्म राम्ररी सुकाएर मात्र भण्डार गर्नुहोस् (दाना दाँतले टोक्दा कट्ट आवाज आउनुपर्छ)। सफा, हावा नछिर्ने भाँडो वा हर्मेटिक झोला प्रयोग गर्नुहोस्। भुइँमा सिधै नराखी काठको पाटीमाथि राख्नुहोस्।",
    textEn: "Store grain only after drying it to 12-14% moisture (the grain should crack when bitten). Use clean airtight containers or hermetic bags. Keep them on a wooden pallet, not on the floor.",
  },
  {
    id: "general.irrigation",
    titleNe: "सिँचाइ",
    titleEn: "Irrigation",
    textNe: "भोलि-पर्सि ठूलो पानी पर्ने भए सिँचाइ नगर्नुहोस्। गहुँमा जरा फुट्ने (२१ दिन) र बाला निस्कने बेला सिँचाइ सबैभन्दा जरुरी हुन्छ। धानमा रोपाइँपछि २-५ सेमी पानी जमाउनुहोस्, फूल फुल्ने बेला खेत सुक्न नदिनुहोस्।",
    textEn: "Skip irrigation if heavy rain is forecast in the next two days. Wheat needs water most at crown root initiation (day 21) and at heading. In paddy keep 2-5 cm standing water after transplanting and never let the field dry at flowering.",
  },
  {
    id: "general.pesticide-safety",
    titleNe: "विषादी सुरक्षा",
    titleEn: "Pesticide safety",
    textNe: "विषादी कृषि प्राविधिकको सल्लाहमा मात्र प्रयोग गर्नुहोस्। मास्क, पन्जा र लामो लुगा लगाउनुहोस्। हावा चलेको र पानी पर्ने बेला नछर्कनुहोस्। छर्केपछि लेबलमा लेखिएको दिनसम्म बाली नटिप्नुहोस्। खाली बोतल पानीको मुहानमा नफाल्नुहोस्।",
    textEn: "Use pesticides only on a technician's advice. Wear a mask, gloves and long clothes. Do not spray in wind or before rain. Respect the waiting days on the label before harvest. Never throw empty bottles near water sources.",
  },
  {
    id: "general.app-help",
    titleNe: "एप कसरी चलाउने",
    titleEn: "How to use the app",
    textNe: "'आज' मा आजको काम र अर्को काम देखिन्छ। 'पात्रो' मा पूरै बालीको काम छ। 'मेरो खेत' मा बाली छान्ने, स्थान राख्ने र फोटो पठाउने गर्न सकिन्छ। 'सूचना' मा मौसम र रोगको चेतावनी आउँछ। घण्टी खोल्नुभयो भने बिहान ७ बजे कामको सम्झना आउँछ।",
    textEn: "Today shows today's job and the next one. Calendar shows the whole crop plan. My fields lets you choose a crop, save the location and send a photo. Alerts shows weather and disease warnings. Turn on reminders to get a 7 am alarm for each job.",
  },
  {
    id: "general.compost",
    titleNe: "कम्पोस्ट र गोबर मल",
    titleEn: "Compost and manure",
    textNe: "रासायनिक मलसँगै प्रति कट्ठा २-३ क्विन्टल (प्रति रोपनी ३-४ क्विन्टल) पाकेको गोबर मल वा कम्पोस्ट हाल्दा माटो खुकुलो र उर्वर हुन्छ। काँचो गोबर नहाल्नुहोस्, यसले धमिरा र रोग ल्याउँछ।",
    textEn: "Along with chemical fertilizer, apply 2-3 quintal of well-rotted manure or compost per kattha (3-4 per ropani) to keep the soil loose and fertile. Avoid fresh dung; it brings termites and disease.",
  },
];

let cache: KnowledgeDoc[] | null = null;

export function knowledgeBase(): KnowledgeDoc[] {
  if (cache) return cache;
  const docs: KnowledgeDoc[] = [];

  for (const d of diseaseKnowledge()) {
    const crop = CROPS.find((c) => c.code === d.crop);
    docs.push({
      id: `disease.${d.code}.${d.crop}`,
      kind: "disease",
      crop: d.crop,
      titleNe: `${crop?.nameNe ?? d.crop}: ${d.name.ne}`,
      titleEn: `${crop?.nameEn ?? d.crop}: ${d.name.en}`,
      textNe: `${d.why.ne} बचाउ: ${d.prevent.map((p) => p.ne).join(" ")} लक्षण देखिए: ${d.ifSigns.map((p) => p.ne).join(" ")}`,
      textEn: `${d.why.en} Prevent: ${d.prevent.map((p) => p.en).join(" ")} If signs appear: ${d.ifSigns.map((p) => p.en).join(" ")}`,
    });
  }

  for (const crop of CROPS) {
    const tpls = CALENDAR_TEMPLATES.filter((t) => t.crop === crop.code);
    const windowsNe = tpls.map((t) => `${ZONE_LABEL_NE[t.zone]} (${SEASON_NE[t.season]}): ${MONTH_NE[t.sowingStart.month - 1]} ${t.sowingStart.day} देखि करिब ${t.sowingWindowDays} दिनभित्र`);
    const windowsEn = tpls.map((t) => `${t.zone} (${t.season}): from ${MONTH_EN[t.sowingStart.month - 1]} ${t.sowingStart.day} within about ${t.sowingWindowDays} days`);
    const stagesNe = tpls[0]?.stages.map((s) => `${s.titleNe} (रोपेको ${s.offsetDays} दिनमा)`).join(", ");
    docs.push({
      id: `crop.${crop.code}`,
      kind: "crop",
      crop: crop.code,
      titleNe: `${crop.nameNe} लगाउने समय र काम`,
      titleEn: `${crop.nameEn}: sowing time and tasks`,
      textNe: `${crop.nameNe} करिब ${crop.durationDays} दिनमा तयार हुन्छ। राम्रो तापक्रम ${crop.temp[1]}-${crop.temp[2]}°C, माटोको pH ${crop.soilPh[1]}-${crop.soilPh[2]}। ${windowsNe.length ? `रोप्ने समय: ${windowsNe.join("; ")}।` : ""} ${stagesNe ? `मुख्य काम: ${stagesNe}।` : ""}`,
      textEn: `${crop.nameEn} is ready in about ${crop.durationDays} days. Best temperature ${crop.temp[1]}-${crop.temp[2]} C, soil pH ${crop.soilPh[1]}-${crop.soilPh[2]}. ${windowsEn.length ? `Sowing: ${windowsEn.join("; ")}.` : ""}`,
    });

    const dose = FERTILIZER_DOSE_KG_HA[crop.code];
    if (dose) {
      const parts = Object.entries(dose).map(([p, kg]) => ({ p, kg, ...perLocalUnit(kg) }));
      docs.push({
        id: `fertilizer.${crop.code}`,
        kind: "fertilizer",
        crop: crop.code,
        titleNe: `${crop.nameNe}मा मल कति हाल्ने`,
        titleEn: `${crop.nameEn}: how much fertilizer`,
        textNe: `${crop.nameEn === "Lentil" ? "दलहन बालीलाई युरिया थोरै चाहिन्छ। " : ""}${crop.nameNe}का लागि सिफारिस मल: ${parts.map((x) => `${x.p} प्रति कट्ठा ${x.kattha} केजी (प्रति रोपनी ${x.ropani} केजी)`).join(", ")}। DAP र पोटास सबै रोप्दा हाल्ने, युरिया आधा रोप्दा र बाँकी दुई पटक टप ड्रेस गर्ने। माटो परीक्षण गरे अझ सही हुन्छ।`,
        textEn: `Recommended for ${crop.nameEn}: ${parts.map((x) => `${x.p} ${x.kg} kg/ha (${x.kattha} kg per kattha)`).join(", ")}. All DAP and potash at sowing; half the urea at sowing and the rest as two top dressings.`,
      });
    }
  }

  for (const g of GENERAL) docs.push({ ...g, kind: "general" });
  cache = docs;
  return docs;
}

interface Indexed {
  doc: KnowledgeDoc;
  terms: Map<string, number>;
  length: number;
}

let index: { items: Indexed[]; df: Map<string, number>; avgLen: number } | null = null;

function docTerms(d: KnowledgeDoc): string[] {
  const ne = `${d.titleNe} ${d.titleNe} ${d.textNe}`;
  const en = `${d.titleEn} ${d.titleEn} ${d.textEn}`;
  return [...tokens(ne), ...glossTokens(ne), ...tokens(en)];
}

function buildIndex() {
  const items = knowledgeBase().map((doc) => {
    const terms = new Map<string, number>();
    const list = docTerms(doc);
    for (const t of list) terms.set(t, (terms.get(t) ?? 0) + 1);
    return { doc, terms, length: list.length };
  });
  const df = new Map<string, number>();
  for (const it of items) for (const t of it.terms.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLen = items.reduce((s, i) => s + i.length, 0) / Math.max(1, items.length);
  return { items, df, avgLen };
}

export function retrieve(question: string, opts: { k?: number; crops?: string[] } = {}): { doc: KnowledgeDoc; score: number }[] {
  index ??= buildIndex();
  const { items, df, avgLen } = index;
  const q = [...new Set([...tokens(question), ...glossTokens(question)])];
  const N = items.length;
  const k1 = 1.4;
  const b = 0.75;
  const scored = items.map((it) => {
    let s = 0;
    for (const t of q) {
      const f = it.terms.get(t);
      if (!f) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * it.length) / avgLen));
    }
    if (s > 0 && it.doc.crop && opts.crops?.includes(it.doc.crop)) s *= 1.5;
    return { doc: it.doc, score: s };
  });
  return scored
    .filter((x) => x.score > 0.5)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, opts.k ?? 3);
}
