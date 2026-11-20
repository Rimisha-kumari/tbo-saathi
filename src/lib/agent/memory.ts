import type { Pref, PrefKey } from "@/lib/types";

export const PREF_LABEL: Record<PrefKey, string> = {
  window_seat: "🪟 Window seat",
  aisle_seat: "💺 Aisle seat",
  veg: "🥗 Veg meals",
  jain: "🌿 Jain meals",
  non_veg: "🍗 Non-veg OK",
  stars_4: "⭐ 4-star+",
  stars_5: "🌟 5-star",
  budget_stay: "💰 Budget stays",
  non_stop: "✈️ Non-stop only",
  morning_flight: "🌅 Morning flights",
  evening_flight: "🌇 Evening flights",
  pool: "🏊 Pool",
  breakfast: "🍳 Breakfast included",
  family: "👨‍👩‍👧 Family friendly",
  wheelchair: "♿ Wheelchair assistance",
};

/** Multilingual cues (English, Hinglish, Hindi, Tamil, Telugu, Bengali). Order matters for conflicts. */
const CUES: [PrefKey, RegExp][] = [
  ["window_seat", /window|खिड़की|खिडकी|विंडो|ஜன்னல்|విండో|కిటికీ|জানালা|উইন্ডো/i],
  ["aisle_seat", /aisle|गलियारा|आइल|இடைகழி|ఐల్|আইল/i],
  ["jain", /\bjain\b|जैन|ஜெயின்|జైన|জৈন/i],
  ["non_veg", /non[- ]?veg|नॉन[- ]?वेज|मांसाहारी|அசைவ|మాంసాహార|నాన్ వెజ్|আমিষ|নন[- ]?ভেজ/i],
  ["veg", /\b(veg|vegetarian|pure veg|shakahari)\b|शाकाहारी|वेज|சைவ|శాకాహార|వెజ్|নিরামিষ|ভেজ/i],
  ["stars_5", /5[- ]?star|five[- ]?star|luxury|लग्ज़री|लग्जरी|5 सितारा|ஐந்து நட்சத்திர|5 నక్షత్ర|লাক্সারি|৫ তারা|5 তারা/i],
  ["stars_4", /4[- ]?star|four[- ]?star|4 सितारा|4 स्टार|4 நட்சத்திர|4 ஸ்டார்|4 నక్షత్ర|4 స్టార్|৪ তারা|4 তারা|৪ স্টার/i],
  ["budget_stay", /budget (hotel|stay)|cheap (hotel|stay)|sasta hotel|सस्ता होटल|மலிவான ஹோட்டல்|చౌక హోటల్|সস্তা হোটেল/i],
  ["non_stop", /non[- ]?stop|direct flight|सीधी फ्लाइट|नॉन[- ]?स्टॉप|நேரடி விமான|నాన్[- ]?స్టాప్|నేరుగా|সরাসরি ফ্লাইট|নন[- ]?স্টপ/i],
  ["morning_flight", /morning (flight)?|subah|सुबह|காலை|ఉదయం|সকাল/i],
  ["evening_flight", /evening (flight)?|shaam|शाम|மாலை|సాయంత్రం|সন্ধ্যা/i],
  ["pool", /\bpool\b|swimming|पूल|ஸ்விம்மிங்|நீச்சல்|పూల్|ఈత|পুল|সুইমিং/i],
  ["breakfast", /breakfast|nashta|नाश्ता|காலை உணவு|అల్పాహార|బ్రేక్‌ఫాస్ట్|নাস্তা|প্রাতরাশ|ব্রেকফাস্ট/i],
  ["family", /\b(kids?|children|family|baby|bachche|bacche)\b|बच्चे|परिवार|குழந்தை|குடும்ப|పిల్ల|కుటుంబ|বাচ্চা|পরিবার/i],
  ["wheelchair", /wheel ?chair|व्हीलचेयर|சக்கர நாற்காலி|వీల్‌చైర్|হুইলচেয়ার/i],
];

/** Pairs that cannot both hold: the newer one wins. */
const EXCLUSIVE: PrefKey[][] = [
  ["window_seat", "aisle_seat"],
  ["veg", "non_veg", "jain"],
  ["stars_4", "stars_5", "budget_stay"],
  ["morning_flight", "evening_flight"],
];

export function extractPrefs(text: string): PrefKey[] {
  const found = CUES.filter(([, re]) => re.test(text)).map(([k]) => k);
  // "non-veg" also matches the veg cue; jain implies veg-only food.
  if (found.includes("non_veg") || found.includes("jain")) return found.filter((k) => k !== "veg");
  return found;
}

export function mergePrefs(existing: PrefKey[], incoming: PrefKey[]): PrefKey[] {
  let out = [...existing];
  for (const k of incoming) {
    const group = EXCLUSIVE.find((g) => g.includes(k));
    if (group) out = out.filter((x) => !group.includes(x) || x === k);
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

export const toPrefs = (keys: PrefKey[]): Pref[] => keys.map((key) => ({ key, label: PREF_LABEL[key] }));

/** Normalise Devanagari, Bengali, Tamil and Telugu digits to ASCII. */
export function asciiDigits(text: string): string {
  return text.replace(/[०-९০-৯௦-௯౦-౯]/g, (d) => {
    const c = d.codePointAt(0)!;
    const base = c >= 0x0c66 ? 0x0c66 : c >= 0x0be6 ? 0x0be6 : c >= 0x09e6 ? 0x09e6 : 0x0966;
    return String(c - base);
  });
}

/** "₹50k", "50,000", "50 hazaar", "1.5 lakh", "५० हज़ार" → rupees. Null when no budget is stated. */
export function extractBudget(raw: string): number | null {
  const text = asciiDigits(raw).replace(/,/g, "");
  const m = text.match(
    /(?:₹|rs\.?|inr|rupees?|budget|बजट|பட்ஜெட்|బడ్జెట్|বাজেট)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|hazaa?r|हज़ार|हजार|ஆயிரம்|వేలు|వేల|হাজার|lakh|lac|लाख|லட்சம்|లక్ష|লাখ|l)?(?![a-z0-9])/gi,
  );
  if (!m) return null;
  let best: number | null = null;
  for (const hit of m) {
    const parts = hit.match(/(\d+(?:\.\d+)?)\s*(\S+)?$/);
    if (!parts) continue;
    const n = Number(parts[1]);
    const unit = (parts[2] ?? "").toLowerCase();
    const hasMoneyCue = /₹|rs|inr|rupee|budget|बजट|பட்ஜெட்|బడ్జెట్|বাজেট/i.test(hit);
    let value: number | null = null;
    if (/^(k|thousand|hazaa?r|हज़ार|हजार|ஆயிரம்|వేలు|వేల|হাজার)$/.test(unit)) value = n * 1000;
    else if (/^(lakh|lac|लाख|லட்சம்|లక్ష|লাখ|l)$/.test(unit)) value = n * 100000;
    else if (hasMoneyCue && n >= 1000) value = n;
    if (value && value >= 3000 && value <= 5_000_000) best = Math.max(best ?? 0, value);
  }
  return best ? Math.round(best) : null;
}

/** Search knobs derived from remembered preferences. */
export function prefSearch(prefs: PrefKey[]) {
  return {
    minStars: prefs.includes("stars_5") ? 5 : prefs.includes("stars_4") ? 4 : null,
    maxStops: prefs.includes("non_stop") ? 0 : null,
    amenities: [...(prefs.includes("pool") ? ["pool"] : []), ...(prefs.includes("breakfast") ? ["breakfast"] : [])],
    window: prefs.includes("morning_flight") ? ("morning" as const) : prefs.includes("evening_flight") ? ("evening" as const) : null,
    budgetStay: prefs.includes("budget_stay"),
  };
}
