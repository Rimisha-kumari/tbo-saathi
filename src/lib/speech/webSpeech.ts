"use client";
import type { Lang } from "@/lib/types";

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

/** Starts one utterance of recognition. Returns a stop function. */
export function listen(lang: Lang, h: ListenHandlers): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    h.onError("Voice input needs Chrome, Edge or Safari.");
    h.onEnd();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = lang;
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

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return (voicesReady ??= new Promise((resolve) => {
    const got = speechSynthesis.getVoices();
    if (got.length) return resolve(got);
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1200); // some browsers never fire voiceschanged
  }));
}

/** Best voice for a locale: exact match, then same language, preferring female/Google/natural voices. */
export async function pickVoice(lang: Lang): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  const base = lang.slice(0, 2);
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.replace("_", "-") === lang ? 10 : v.lang.startsWith(base) ? 5 : 0) +
    (/google|natural|neural/i.test(v.name) ? 2 : 0) +
    (/female|heera|lekha|swara|kalpana|veena/i.test(v.name) ? 1 : 0);
  const best = voices.filter((v) => v.lang.startsWith(base)).sort((a, b) => score(b) - score(a))[0];
  return best ?? null;
}

export interface SpeakHandlers {
  onStart(): void;
  onBoundary(charIndex: number): void;
  onEnd(): void;
}

/** Speak with browser TTS. Resolves when done; returns a cancel handle via the promise's `cancel`. */
export async function speakWeb(text: string, lang: Lang, h: SpeakHandlers): Promise<void> {
  if (!synthesisSupported()) {
    h.onEnd();
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const voice = await pickVoice(lang);
  if (voice) u.voice = voice;
  u.rate = 1;
  u.pitch = 1.05;
  await new Promise<void>((resolve) => {
    u.onstart = () => h.onStart();
    u.onboundary = (e) => h.onBoundary(e.charIndex);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
  h.onEnd();
}

export function cancelWebSpeech() {
  if (synthesisSupported()) speechSynthesis.cancel();
}
