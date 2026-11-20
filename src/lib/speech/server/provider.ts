import "server-only";
import type { Lang } from "@/lib/types";
import { bhashiniConfigured, bhashiniTts } from "./bhashini";
import { sarvamConfigured, sarvamTts } from "./sarvam";

export type SpeechProvider = "webspeech" | "sarvam" | "bhashini";

/** Requested provider, downgraded to webspeech when its keys are missing. */
export function activeProvider(): SpeechProvider {
  const want = (process.env.SPEECH_PROVIDER ?? "webspeech").toLowerCase();
  if (want === "sarvam" && sarvamConfigured()) return "sarvam";
  if (want === "bhashini" && bhashiniConfigured()) return "bhashini";
  return "webspeech";
}

/** Returns WAV bytes, or null when the browser should synthesise locally. */
export async function synthesize(text: string, lang: Lang): Promise<Uint8Array | null> {
  switch (activeProvider()) {
    case "sarvam":
      return sarvamTts(text, lang);
    case "bhashini":
      return bhashiniTts(text, lang);
    default:
      return null;
  }
}
