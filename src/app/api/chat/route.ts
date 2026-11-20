import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { describeApiError, runClaude } from "@/lib/agent/claude";
import { runOffline } from "@/lib/agent/offline";
import { sessionState } from "@/lib/agent/prompt";
import type { ChatEvent } from "@/lib/types";

const LANGS = ["en-IN", "hi-IN", "ta-IN", "te-IN", "bn-IN"] as const;

const bodySchema = z.object({
  sessionId: z.string().min(1).max(64),
  lang: z.enum(LANGS),
  itineraryId: z.string().max(32).nullable(),
  bookingId: z.string().max(32).nullable(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === "user", "Last message must be from the user"),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;
  const lastUserText = body.messages[body.messages.length - 1].content;
  const useClaude = Boolean(process.env.ANTHROPIC_API_KEY);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      try {
        emit({ type: "expression", value: "thinking" });
        if (useClaude) {
          // Text-only history from the client; drop empty turns and merge nothing else.
          const messages: Anthropic.Beta.BetaMessageParam[] = body.messages
            .filter((m) => m.content.trim())
            .map((m) => ({ role: m.role, content: m.content }));
          await runClaude({
            messages,
            sessionState: sessionState(body),
            ctx: { lastUserText },
            emit,
            signal: req.signal,
          });
        } else {
          await runOffline({ ...body, text: lastUserText, emit });
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
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Saathi-Mode": useClaude ? "claude" : "offline",
    },
  });
}
