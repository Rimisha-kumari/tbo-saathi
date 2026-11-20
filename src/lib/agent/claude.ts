import Anthropic from "@anthropic-ai/sdk";
import type { ChatEvent, Expression } from "@/lib/types";
import { runTool, type ToolContext, type ToolOutcome } from "./handlers";
import { SYSTEM_PROMPT } from "./prompt";
import { tools } from "./tools";

export const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;

type Emit = (ev: ChatEvent) => void;

interface RunArgs {
  messages: Anthropic.Beta.BetaMessageParam[];
  /** Volatile per-request context (date, language, itinerary). Constant within the request. */
  sessionState: string;
  ctx: ToolContext;
  emit: Emit;
  signal: AbortSignal;
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/**
 * Manual tool loop on the Messages API, hosted in our route handler.
 * Appends each assistant response verbatim (thinking blocks included) and
 * returns all tool results for a turn in one user message.
 */
export async function runClaude({ messages, sessionState, ctx, emit, signal }: RunArgs): Promise<void> {
  const anthropic = getClient();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = anthropic.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: sessionState },
        ],
        tools,
        tool_choice: { type: "auto" },
        messages,
      },
      { signal },
    );

    for await (const ev of stream) {
      if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
        emit({ type: "expression", value: "thinking" });
        emit({ type: "tool", name: ev.content_block.name, status: "start" });
      } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        emit({ type: "text", delta: ev.delta.text });
      }
    }
    const msg = await stream.finalMessage();
    messages.push({ role: "assistant", content: msg.content });

    if (msg.stop_reason === "refusal") {
      emit({ type: "text", delta: "\nSorry, I can't help with that request. Shall we get back to planning your trip?" });
      return;
    }
    const toolUses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (msg.stop_reason !== "tool_use" || toolUses.length === 0) return;

    let expression: Expression | undefined;
    const results = await Promise.all(
      toolUses.map(async (tu): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const out = emitTool(tu.name, tu.input, ctx, emit);
        if (out.expression) expression = out.expression;
        return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out.forModel ?? out.data), is_error: !out.ok };
      }),
    );
    if (expression) emit({ type: "expression", value: expression });
    messages.push({ role: "user", content: results });
  }
  emit({ type: "text", delta: "\nI need a moment to finish that — could you repeat what you'd like next?" });
}

/** Runs a tool and streams its result, state changes and any pending confirmation to the client. */
export function emitTool(name: string, input: unknown, ctx: ToolContext, emit: Emit): ToolOutcome {
  const out = runTool(name, input, ctx);
  emit({ type: "tool", name, status: out.ok ? "done" : "error", data: out.data });
  if (out.state) emit({ type: "state", itineraryId: out.state.itineraryId ?? null, bookingId: out.state.bookingId ?? null });
  if (out.action) emit({ type: "action", action: out.action });
  return out;
}

export function describeApiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "The ANTHROPIC_API_KEY is invalid.";
  if (e instanceof Anthropic.RateLimitError) return "Saathi is busy right now (rate limited). Please try again in a moment.";
  if (e instanceof Anthropic.BadRequestError) return `Request rejected: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status ?? ""}: ${e.message}`;
  if (e instanceof Error && e.name === "AbortError") return "Request cancelled.";
  return e instanceof Error ? e.message : String(e);
}
