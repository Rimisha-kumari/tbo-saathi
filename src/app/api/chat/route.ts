import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describeApiError, runClaude } from "@/lib/agent/claude";
import { runDemo } from "@/lib/agent/demo/brain";
import { extractBudget, extractPrefs, mergePrefs, toPrefs } from "@/lib/agent/memory";
import { runOpenAI } from "@/lib/agent/openai";
import { sessionState } from "@/lib/agent/prompt";
import { detectLang, LANG_IDS } from "@/lib/lang";
import type { ChatEvent, LlmProvider, PrefKey } from "@/lib/types";

const PREF_KEYS = [
  "window_seat", "aisle_seat", "veg", "jain", "non_veg", "stars_4", "stars_5", "budget_stay",
  "non_stop", "morning_flight", "evening_flight", "pool", "breakfast", "family", "wheelchair",
] as const satisfies readonly PrefKey[];

const bodySchema = z.object({
  sessionId: z.string().min(1).max(64),
  lang: z.enum(LANG_IDS),
  /** When true the server switches language if the message is clearly in another one. */
  autoLang: z.boolean().default(true),
  itineraryId: z.string().max(32).nullable(),
  bookingId: z.string().max(32).nullable(),
  prefs: z.array(z.enum(PREF_KEYS)).max(20).default([]),
  budgetINR: z.number().int().positive().max(10_000_000).nullable().default(null),
  b2b: z.object({ enabled: z.boolean(), markupPct: z.number().min(0).max(100) }).default({ enabled: false, markupPct: 12 }),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === "user", "Last message must be from the user"),
});

function pickProvider(): LlmProvider {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "demo";
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;
  const lastUserText = body.messages[body.messages.length - 1].content;
  const isAlert = lastUserText.startsWith("[disruption:");

  // True language switching: a message clearly in another language/script switches the reply + voice.
  const detected = body.autoLang && !isAlert ? detectLang(lastUserText) : null;
  const lang = detected ?? body.lang;

  // Traveller memory: preferences and budget remembered across turns.
  const newPrefs = extractPrefs(lastUserText).filter((k) => !body.prefs.includes(k));
  const prefs = mergePrefs(body.prefs, newPrefs);
  const budgetINR = extractBudget(lastUserText) ?? body.budgetINR;
  const ctx = { prefs, budgetINR };
  const provider = pickProvider();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let textSent = false;
      const emit = (ev: ChatEvent) => {
        if (ev.type === "text") textSent = true;
        controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      };
      try {
        emit({ type: "meta", provider, lang });
        emit({ type: "memory", prefs: toPrefs(prefs), budgetINR });
        emit({ type: "expression", value: "thinking" });
        const state = sessionState({ lang, itineraryId: body.itineraryId, bookingId: body.bookingId, prefs, budgetINR, b2b: body.b2b });
        const history = body.messages.filter((m) => m.content.trim());

        if (provider === "claude") {
          const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
          try {
            await runClaude({ messages, sessionState: state, ctx, emit, signal: req.signal });
          } catch (e) {
            // Optional fallback: OpenAI, only if Claude failed before saying anything.
            if (!process.env.OPENAI_API_KEY || textSent || req.signal.aborted) throw e;
            emit({ type: "meta", provider: "openai", lang });
            await runOpenAI({ history, sessionState: state, ctx, emit, signal: req.signal });
          }
        } else if (provider === "openai") {
          await runOpenAI({ history, sessionState: state, ctx, emit, signal: req.signal });
        } else {
          await runDemo({ text: lastUserText, lang, sessionId: body.sessionId, itineraryId: body.itineraryId, bookingId: body.bookingId, ctx, newPrefs, emit });
        }
      } catch (e) {
        emit({ type: "error", message: describeApiError(e) });
        emit({ type: "expression", value: "concerned" });
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

/** Which brain answers: lets the UI label the mode before the first message. */
export async function GET() {
  return Response.json({ provider: pickProvider() });
}
