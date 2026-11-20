"use client";
/**
 * Client speech facade. Default: browser Web Speech (zero keys). When the
 * server reports Sarvam/Bhashini is configured, TTS audio comes from
 * /api/speech and lip-sync follows its amplitude; any failure falls back to
 * Web Speech. Speech input always uses the browser recogniser.
 */
import type { LipSync } from "@/components/avatar/useLipSync";
import type { Lang } from "@/lib/types";
import { cancelWebSpeech, speakWeb } from "./webSpeech";

export { listen, recognitionSupported, synthesisSupported } from "./webSpeech";

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
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export async function speak(text: string, lang: Lang, lip: LipSync): Promise<void> {
  const clean = speakable(text);
  if (!clean) return;
  stopSpeaking(lip);
  if ((await speechProvider()) !== "webspeech") {
    try {
      return await speakServer(clean, lang, lip);
    } catch {
      /* fall through to Web Speech */
    }
  }
  await speakWeb(clean, lang, {
    onStart: () => lip.startText(clean),
    onBoundary: (i) => lip.syncTo(i),
    onEnd: () => lip.stop(),
  });
}

async function speakServer(text: string, lang: Lang, lip: LipSync): Promise<void> {
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
