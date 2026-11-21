/**
 * Nepali -> English farming glossary. Used to (1) show the farmer's question in English for
 * officers and logs, and (2) match Nepali questions against the knowledge base without any
 * paid service. When an LLM key is configured, the model does the full translation instead.
 */

/** Nepali word (or stem) -> English words. Matching is by "token starts with stem". */
export const GLOSSARY: [string, string][] = [
  // crops
  ["धान", "paddy rice"], ["चामल", "rice"], ["गहुँ", "wheat"], ["मकै", "maize corn"], ["आलु", "potato"],
  ["तोरी", "mustard"], ["मसुरो", "lentil"], ["कोदो", "millet"], ["गोलभेडा", "tomato"], ["तरकारी", "vegetable"],
  ["बाली", "crop"], ["बीउ", "seed"], ["बेर्ना", "seedling"], ["ब्याड", "nursery"],
  // problems
  ["रोग", "disease"], ["कीरा", "insect pest"], ["किरा", "insect pest"], ["लाही", "aphid"], ["डढुवा", "blight"],
  ["मरुवा", "blast"], ["सिन्दूरे", "rust"], ["रस्ट", "rust"], ["फौजी", "armyworm"], ["झार", "weed"],
  ["पहेँलो", "yellow"], ["पहेलो", "yellow"], ["कालो", "black"], ["दाग", "spot"], ["सुक", "dry wilt"], ["ओइल", "wilt"],
  ["कुहि", "rot"], ["पात", "leaf"], ["जरा", "root"], ["बाला", "ear panicle"], ["घोगा", "cob"], ["डाँठ", "stem"],
  // inputs
  ["मल", "fertilizer"], ["युरिया", "urea"], ["डीएपी", "dap"], ["पोटास", "potash mop"], ["गोबर", "manure"],
  ["कम्पोस्ट", "compost"], ["विषादी", "pesticide"], ["औषधि", "medicine pesticide"], ["दबाई", "medicine pesticide"],
  ["माटो", "soil"], ["सिँचाइ", "irrigation"], ["सिंचाइ", "irrigation"], ["पानी", "water rain"],
  // weather
  ["मौसम", "weather"], ["वर्षा", "rain"], ["झरी", "rain"], ["असिना", "hail"], ["हावा", "wind"], ["तुफान", "storm"],
  ["चिसो", "cold"], ["शीतलहर", "cold wave"], ["तुसारो", "frost"], ["गर्मी", "heat"], ["कुहिरो", "fog"], ["खडेरी", "drought"],
  ["भोलि", "tomorrow"], ["आज", "today"], ["हप्ता", "week"],
  // actions
  ["रोप", "plant transplant"], ["छर", "sow"], ["काट", "harvest cut"], ["भित्र्या", "harvest"], ["खन", "dig harvest"],
  ["गोड", "weeding"], ["भण्डार", "storage"], ["बेच", "sell"], ["मूल्य", "price"], ["भाउ", "price"],
  // admin
  ["अनुदान", "subsidy"], ["सहुलियत", "subsidy"], ["सहयोग", "support"], ["दर्ता", "registration"], ["अधिकृत", "officer"],
  ["कार्यालय", "office"], ["ट्र्याक्टर", "tractor"], ["मेसिन", "machine"], ["बिमा", "insurance"], ["ऋण", "loan"],
  ["खेत", "field"], ["जग्गा", "land"], ["रोपनी", "ropani"], ["कट्ठा", "kattha"], ["बिघा", "bigha"],
  // question words
  ["कहिले", "when"], ["के", "what"], ["कसरी", "how"], ["कति", "how much"], ["किन", "why"], ["कुन", "which"],
  ["कहाँ", "where"], ["गर्ने", "do"], ["लगाउने", "apply"], ["हाल्ने", "apply"], ["चाहिन्छ", "need"], ["पाउने", "get"],
];

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .replace(/[?।,.!"'()\-:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t.length > 1 || /[0-9]/.test(t));
}

/** English words for each Nepali token we recognise (plus any English already typed). */
export function glossTokens(text: string): string[] {
  const out: string[] = [];
  for (const t of tokens(text)) {
    if (/^[a-z0-9]+$/.test(t)) {
      out.push(t);
      continue;
    }
    for (const [ne, en] of GLOSSARY) if (t.startsWith(ne)) out.push(...en.split(" "));
  }
  return out;
}

/** A rough English rendering of the question, word by word (used when no LLM is configured). */
export function roughEnglish(text: string): string {
  const words: string[] = [];
  for (const t of tokens(text)) {
    if (/^[a-z0-9]+$/.test(t)) words.push(t);
    else {
      const hit = GLOSSARY.find(([ne]) => t.startsWith(ne));
      if (hit) words.push(hit[1].split(" ")[0]!);
    }
  }
  return words.join(" ");
}

export const CROP_WORDS: Record<string, string[]> = {
  paddy: ["धान", "चामल", "paddy", "rice"],
  wheat: ["गहुँ", "wheat"],
  maize: ["मकै", "maize", "corn"],
  potato: ["आलु", "potato"],
  mustard: ["तोरी", "mustard"],
  lentil: ["मसुरो", "lentil"],
  millet: ["कोदो", "millet"],
};

export function cropsMentioned(text: string): string[] {
  const n = normalize(text);
  return Object.entries(CROP_WORDS)
    .filter(([, words]) => words.some((w) => n.includes(w)))
    .map(([code]) => code);
}
