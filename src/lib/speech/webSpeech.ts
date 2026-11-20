"use client";
import type { Locale } from "@/lib/lang";

/* Minimal typings: the Web Speech recognition API is not in lib.dom for all TS versions. */
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const recognitionSupported = () => recognitionCtor() !== null;
export const synthesisSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export interface ListenHandlers {
  onPartial(text: string): void;
  onFinal(text: string): void;
  onEnd(): void;
  onError(message: string): void;
}

/** Starts one utterance of recognition in the given locale. Returns a stop function. */
export function listen(locale: Locale, h: ListenHandlers): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    h.onError("Voice input needs Chrome, Edge or Safari.");
    h.onEnd();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = locale;
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = "";
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    h.onPartial(finalText + interim);
  };
  rec.onerror = (e) => {
    if (e.error !== "no-speech" && e.error !== "aborted") h.onError(`Mic error: ${e.error}`);
  };
  rec.onend = () => {
    if (finalText.trim()) h.onFinal(finalText.trim());
    h.onEnd();
  };
  rec.start();
  return () => rec.stop();
}

/* ---------------- Voices ---------------- */

let voiceCache: SpeechSynthesisVoice[] = [];
const voiceListeners = new Set<() => void>();
let listening = false;

function refreshVoices() {
  const list = speechSynthesis.getVoices();
  if (list.length) {
    voiceCache = list;
    voiceListeners.forEach((fn) => fn());
  }
}

/** Subscribe to voice-list changes (voices load asynchronously, and again when the OS installs one). */
export function onVoicesChanged(fn: () => void): () => void {
  voiceListeners.add(fn);
  return () => voiceListeners.delete(fn);
}

/**
 * Resolves once the browser has published its voices. Chrome fills the list
 * asynchronously and fires `voiceschanged`; Safari/Firefox may fill it
 * synchronously. Never caches an empty list, so a late load is picked up.
 */
export function waitForVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  if (!synthesisSupported()) return Promise.resolve([]);
  if (!listening) {
    listening = true;
    speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  }
  refreshVoices();
  if (voiceCache.length) return Promise.resolve(voiceCache);
  return new Promise((resolve) => {
    const done = () => {
      off();
      clearTimeout(timer);
      resolve(voiceCache);
    };
    const off = onVoicesChanged(done);
    const timer = setTimeout(done, timeoutMs);
  });
}

/** Known good regional voices on Chrome (Google), Edge/Windows (Microsoft), macOS/iOS and Android. */
const PREFERRED: Record<Locale, RegExp> = {
  "hi-IN": /google हिन्दी|swara|madhur|kalpana|hemant|lekha|hindi/i,
  "ta-IN": /google தமிழ்|pallavi|valluvar|vani|tamil/i,
  "te-IN": /google తెలుగు|shruti|mohan|chitra|geeta|telugu/i,
  "bn-IN": /google বাংলা|tanishaa|bashkar|piya|bangla|bengali/i,
  "en-IN": /neerja|prabhat|heera|ravi|rishi|veena|google english.*india|india/i,
};

const norm = (l: string) => l.replace("_", "-").toLowerCase();

export interface VoiceChoice {
  voice: SpeechSynthesisVoice | null;
  /** True when the voice really is for this locale (not a fallback in another language). */
  native: boolean;
}

/** Best voice for a locale: exact locale, then same language; never a different language for Indic locales. */
export function chooseVoice(locale: Locale, voices: SpeechSynthesisVoice[] = voiceCache): VoiceChoice {
  const base = locale.slice(0, 2);
  const score = (v: SpeechSynthesisVoice) =>
    (norm(v.lang) === norm(locale) ? 100 : 0) +
    (PREFERRED[locale].test(v.name) ? 30 : 0) +
    (/google|natural|neural|online|premium|enhanced/i.test(v.name) ? 10 : 0) +
    (v.localService ? 2 : 0);
  const sameLang = voices.filter((v) => norm(v.lang).startsWith(base)).sort((a, b) => score(b) - score(a));
  if (sameLang[0]) return { voice: sameLang[0], native: true };
  // Hinglish/English fallback: any Indian voice reads Latin-script Hinglish well; then any English voice.
  if (locale === "en-IN") {
    const fallback = voices.find((v) => norm(v.lang) === "hi-in") ?? voices.find((v) => norm(v.lang).startsWith("en"));
    return { voice: fallback ?? null, native: false };
  }
  return { voice: null, native: false };
}

export interface SpeakHandlers {
  onStart(): void;
  /** Character offset into the full text. */
  onBoundary(charIndex: number): void;
  onEnd(): void;
}

/** Split into sentence chunks: Chrome silently stops utterances longer than ~15 s. */
function chunks(text: string): { text: string; offset: number }[] {
  const out: { text: string; offset: number }[] = [];
  const re = /[^.!?।॥\n]+[.!?।॥]*\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const piece = m[0];
    if (piece.trim()) {
      const last = out[out.length - 1];
      if (last && last.text.length + piece.length < 160) last.text += piece;
      else out.push({ text: piece, offset: m.index });
    }
  }
  return out.length ? out : [{ text, offset: 0 }];
}

let speakToken = 0;

/** Speak with browser TTS in the locale's voice. Resolves when done or cancelled. */
export async function speakWeb(text: string, locale: Locale, h: SpeakHandlers): Promise<VoiceChoice> {
  if (!synthesisSupported()) {
    h.onEnd();
    return { voice: null, native: false };
  }
  const token = ++speakToken;
  speechSynthesis.cancel();
  const choice = chooseVoice(locale, await waitForVoices());
  let started = false;
  for (const c of chunks(text)) {
    if (token !== speakToken) break;
    const u = new SpeechSynthesisUtterance(c.text);
    u.lang = choice.voice?.lang ?? locale;
    if (choice.voice) u.voice = choice.voice;
    u.rate = locale === "en-IN" ? 1 : 0.95;
    u.pitch = 1.05;
    await new Promise<void>((resolve) => {
      u.onstart = () => {
        if (!started) {
          started = true;
          h.onStart();
        }
        h.onBoundary(c.offset);
      };
      u.onboundary = (e) => h.onBoundary(c.offset + e.charIndex);
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
      // Chrome occasionally never fires onend; time out generously.
      setTimeout(resolve, 2000 + c.text.length * 120);
    });
  }
  if (token === speakToken) h.onEnd();
  return choice;
}

export function cancelWebSpeech() {
  speakToken++;
  if (synthesisSupported()) speechSynthesis.cancel();
}
