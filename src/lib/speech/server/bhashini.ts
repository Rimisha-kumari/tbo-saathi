import "server-only";
import type { Locale } from "@/lib/lang";

/**
 * Bhashini (ULCA / Dhruva) text-to-speech. Enabled when BHASHINI_USER_ID,
 * BHASHINI_API_KEY (ULCA API key) and BHASHINI_PIPELINE_ID are set and
 * SPEECH_PROVIDER=bhashini. Step 1 resolves the per-language TTS service and
 * inference endpoint from the pipeline config (cached); step 2 runs inference.
 */
export const bhashiniConfigured = () =>
  Boolean(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY && process.env.BHASHINI_PIPELINE_ID);

interface Resolved {
  serviceId: string;
  endpoint: string;
  authHeader: { name: string; value: string };
}
const cache = new Map<string, Resolved>();

async function resolve(src: string): Promise<Resolved> {
  const hit = cache.get(src);
  if (hit) return hit;
  const res = await fetch("https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      userID: process.env.BHASHINI_USER_ID!,
      ulcaApiKey: process.env.BHASHINI_API_KEY!,
    },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: "tts", config: { language: { sourceLanguage: src } } }],
      pipelineRequestConfig: { pipelineId: process.env.BHASHINI_PIPELINE_ID },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Bhashini config ${res.status}`);
  const j = await res.json();
  const resolved: Resolved = {
    serviceId: j?.pipelineResponseConfig?.[0]?.config?.[0]?.serviceId,
    endpoint: j?.pipelineInferenceAPIEndPoint?.callbackUrl,
    authHeader: j?.pipelineInferenceAPIEndPoint?.inferenceApiKey,
  };
  if (!resolved.serviceId || !resolved.endpoint || !resolved.authHeader?.name) {
    throw new Error("Bhashini pipeline config missing TTS service for " + src);
  }
  cache.set(src, resolved);
  return resolved;
}

export async function bhashiniTts(text: string, lang: Locale): Promise<Uint8Array> {
  const src = lang.slice(0, 2);
  const r = await resolve(src);
  const res = await fetch(r.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", [r.authHeader.name]: r.authHeader.value },
    body: JSON.stringify({
      pipelineTasks: [
        { taskType: "tts", config: { language: { sourceLanguage: src }, serviceId: r.serviceId, gender: "female", samplingRate: 22050 } },
      ],
      inputData: { input: [{ source: text.slice(0, 1500) }] },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Bhashini TTS ${res.status}`);
  const j = await res.json();
  const b64: string | undefined = j?.pipelineResponse?.[0]?.audio?.[0]?.audioContent;
  if (!b64) throw new Error("Bhashini TTS returned no audio");
  return Uint8Array.from(Buffer.from(b64, "base64"));
}
