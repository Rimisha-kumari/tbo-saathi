/**
 * Language model shared by client and server. A LangId decides three things:
 * the reply language/script, the TTS voice locale and the speech-recognition locale.
 */
export const LANG_IDS = ["en", "hi", "hinglish", "ta", "te", "bn"] as const;
export type LangId = (typeof LANG_IDS)[number];
export type Locale = "en-IN" | "hi-IN" | "ta-IN" | "te-IN" | "bn-IN";

interface LangMeta {
  label: string;
  /** Voice used to speak replies. Hinglish is Latin script, so an Indian-English voice reads it best. */
  ttsLocale: Locale;
  /** Locale for server TTS (Sarvam/Bhashini handle code-mixed Hindi). */
  serverTtsLocale: Locale;
  /** Recogniser locale. en-IN transcribes Hinglish in Latin script. */
  sttLocale: Locale;
  /** How the LLM should write replies. */
  replyAs: string;
}

export const LANG_META: Record<LangId, LangMeta> = {
  en: { label: "English", ttsLocale: "en-IN", serverTtsLocale: "en-IN", sttLocale: "en-IN", replyAs: "English (Indian English)" },
  hi: { label: "हिन्दी", ttsLocale: "hi-IN", serverTtsLocale: "hi-IN", sttLocale: "hi-IN", replyAs: "Hindi in Devanagari script" },
  hinglish: {
    label: "Hinglish",
    ttsLocale: "en-IN",
    serverTtsLocale: "hi-IN",
    sttLocale: "en-IN",
    replyAs: "Hinglish: conversational Hindi written in Latin script, mixed naturally with English words (e.g. 'Aapke liye 3 options mile hain')",
  },
  ta: { label: "தமிழ்", ttsLocale: "ta-IN", serverTtsLocale: "ta-IN", sttLocale: "ta-IN", replyAs: "Tamil in Tamil script" },
  te: { label: "తెలుగు", ttsLocale: "te-IN", serverTtsLocale: "te-IN", sttLocale: "te-IN", replyAs: "Telugu in Telugu script" },
  bn: { label: "বাংলা", ttsLocale: "bn-IN", serverTtsLocale: "bn-IN", sttLocale: "bn-IN", replyAs: "Bengali in Bengali script" },
};

const HINGLISH_WORDS =
  /\b(mujhe|muje|hume|humein|chahiye|chaiye|kya|kyaa|hai|hain|karo|kariye|kijiye|batao|bataiye|dikhao|dikhaiye|se|tak|ke liye|keliye|wala|wali|sasta|saste|kitna|kitne|jana|jaana|ghoomna|ghumna|kahan|kaha|aur|nahi|nahin|haan|accha|acha|theek|thik|bhai|yaar|log|logon|raat|din|kal|parso|zyada|kam|karna|karni|krdo|kardo|chalo|chaliye)\b/gi;

/**
 * Detect the language of a user utterance from its script, or Hinglish from
 * romanised Hindi vocabulary. Returns null when the text gives no signal
 * (numbers, ids, very short English), so the selected language stays.
 */
export function detectLang(text: string): LangId | null {
  const counts = { hi: 0, ta: 0, te: 0, bn: 0, latin: 0 };
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x0900 && c <= 0x097f) counts.hi++;
    else if (c >= 0x0980 && c <= 0x09ff) counts.bn++;
    else if (c >= 0x0b80 && c <= 0x0bff) counts.ta++;
    else if (c >= 0x0c00 && c <= 0x0c7f) counts.te++;
    else if (/[a-z]/i.test(ch)) counts.latin++;
  }
  const scripts: ("hi" | "ta" | "te" | "bn")[] = ["hi", "ta", "te", "bn"];
  const indic = scripts.sort((a, b) => counts[b] - counts[a])[0];
  if (counts[indic] >= 2 && counts[indic] >= counts.latin * 0.3) return indic;
  if (counts.latin < 4) return null;
  const hits = text.match(HINGLISH_WORDS)?.length ?? 0;
  const words = text.trim().split(/\s+/).length;
  if (hits >= 2 || (hits >= 1 && words <= 4)) return "hinglish";
  return /\b(the|please|show|find|book|want|need|flight|hotel|trip|from|to|for|cheaper|compare)\b/i.test(text) ? "en" : null;
}

export const isLangId = (v: unknown): v is LangId => typeof v === "string" && (LANG_IDS as readonly string[]).includes(v);
