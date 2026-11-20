import { z } from "zod";
import { LANG_IDS, LANG_META } from "@/lib/lang";
import { activeProvider, synthesize } from "@/lib/speech/server/provider";

/** GET: which speech provider is active (never exposes keys). */
export async function GET() {
  return Response.json({ provider: activeProvider() });
}

const ttsSchema = z.object({
  text: z.string().min(1).max(1500),
  lang: z.enum(LANG_IDS),
});

/** POST: server TTS via Sarvam/Bhashini. 204 means "use browser speechSynthesis". */
export async function POST(req: Request) {
  const parsed = ttsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    const audio = await synthesize(parsed.data.text, LANG_META[parsed.data.lang].serverTtsLocale);
    if (!audio) return new Response(null, { status: 204 });
    return new Response(audio as BodyInit, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (e) {
    // Client falls back to Web Speech on any failure.
    return Response.json({ error: e instanceof Error ? e.message : "TTS failed" }, { status: 502 });
  }
}
