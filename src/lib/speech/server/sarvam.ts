import "server-only";
import type { Locale } from "@/lib/lang";

/**
 * Sarvam AI text-to-speech (Bulbul). Enabled when SARVAM_API_KEY is set and
 * SPEECH_PROVIDER=sarvam. Override model/speaker with SARVAM_TTS_MODEL /
 * SARVAM_TTS_SPEAKER if your account uses different ones.
 */
export const sarvamConfigured = () => Boolean(process.env.SARVAM_API_KEY);

export async function sarvamTts(text: string, lang: Locale): Promise<Uint8Array> {
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-subscription-key": process.env.SARVAM_API_KEY! },
    body: JSON.stringify({
      text: text.slice(0, 1500),
      target_language_code: lang,
      model: process.env.SARVAM_TTS_MODEL ?? "bulbul:v2",
      speaker: process.env.SARVAM_TTS_SPEAKER ?? "anushka",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Sarvam TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { audios?: string[] };
  const b64 = json.audios?.[0];
  if (!b64) throw new Error("Sarvam TTS returned no audio");
  return Uint8Array.from(Buffer.from(b64, "base64"));
}
