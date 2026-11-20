"use client";
/**
 * Client speech facade. Default: browser Web Speech (zero keys) with a voice
 * picked for the language's locale. When the server reports Sarvam/Bhashini is
 * configured (SARVAM_API_KEY / BHASHINI_* in .env.local), TTS audio comes from
 * /api/speech and lip-sync follows its amplitude; any failure falls back to
 * Web Speech. Speech input always uses the browser recogniser.
 */
import type { LipSync } from "@/components/avatar/useLipSync";
import { LANG_META, type LangId } from "@/lib/lang";
import { cancelWebSpeech, speakWeb } from "./webSpeech";

export { chooseVoice, listen, onVoicesChanged, recognitionSupported, synthesisSupported, waitForVoices } from "./webSpeech";

let providerPromise: Promise<string> | null = null;
export function speechProvider(): Promise<string> {
  return (providerPromise ??= fetch("/api/speech")
    .then((r) => r.json())
    .then((j: { provider: string }) => j.provider)
    .catch(() => "webspeech"));
}

let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

/** Strip things that sound bad when read aloud. */
export function speakable(text: string): string {
  return text
    .replace(/[*_#`>|]/g, " ")
    .replace(/[✅✏️🚨⚠️]/gu, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SpokenWith {
  engine: "sarvam" | "bhashini" | "webspeech";
  voiceName: string | null;
  native: boolean;
}

export async function speak(text: string, lang: LangId, lip: LipSync): Promise<SpokenWith> {
  const clean = speakable(text);
  if (!clean) return { engine: "webspeech", voiceName: null, native: true };
  stopSpeaking(lip);
  const provider = await speechProvider();
  if (provider === "sarvam" || provider === "bhashini") {
    try {
      await speakServer(clean, lang, lip);
      return { engine: provider, voiceName: provider === "sarvam" ? "Sarvam Bulbul" : "Bhashini", native: true };
    } catch {
      /* fall through to Web Speech */
    }
  }
  const choice = await speakWeb(clean, LANG_META[lang].ttsLocale, {
    onStart: () => lip.startText(clean),
    onBoundary: (i) => lip.syncTo(i),
    onEnd: () => lip.stop(),
  });
  return { engine: "webspeech", voiceName: choice.voice?.name ?? null, native: choice.native };
}

async function speakServer(text: string, lang: LangId, lip: LipSync): Promise<void> {
  const res = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 1500), lang }),
  });
  if (res.status !== 200) throw new Error(`TTS ${res.status}`);
  audioCtx ??= new AudioContext();
  if (audioCtx.state === "suspended") await audioCtx.resume();
  const buf = await audioCtx.decodeAudioData(await res.arrayBuffer());
  const src = audioCtx.createBufferSource();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  src.buffer = buf;
  src.connect(analyser).connect(audioCtx.destination);
  currentSource = src;
  lip.startAnalyser(analyser);
  await new Promise<void>((resolve) => {
    src.onended = () => resolve();
    src.start();
  });
  currentSource = null;
  lip.stop();
}

export function stopSpeaking(lip?: LipSync) {
  cancelWebSpeech();
  try {
    currentSource?.stop();
  } catch {
    /* already stopped */
  }
  currentSource = null;
  lip?.stop();
}
