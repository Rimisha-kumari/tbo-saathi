/**
 * Optional fallback provider: OpenAI Chat Completions with the same strict
 * tools, used when OPENAI_API_KEY is set and Claude is unavailable (no
 * ANTHROPIC_API_KEY, or a Claude API error before any text was streamed).
 * Model via OPENAI_MODEL (default gpt-4o-mini).
 */
import type { ChatEvent, Expression } from "@/lib/types";
import { emitTool } from "./claude";
import type { ToolContext } from "./handlers";
import { SYSTEM_PROMPT } from "./prompt";
import { openAiTools } from "./tools";

type Emit = (ev: ChatEvent) => void;

interface OaToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
type OaMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OaToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export async function runOpenAI(args: {
  history: { role: "user" | "assistant"; content: string }[];
  sessionState: string;
  ctx: ToolContext;
  emit: Emit;
  signal: AbortSignal;
}): Promise<void> {
  const { emit, ctx } = args;
  const messages: OaMessage[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${args.sessionState}` },
    ...args.history.map((m) => ({ role: m.role, content: m.content }) as OaMessage),
  ];

  for (let round = 0; round < 8; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", messages, tools: openAiTools, tool_choice: "auto" }),
      signal: args.signal,
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices: { message: { content: string | null; tool_calls?: OaToolCall[] }; finish_reason: string }[] };
    const msg = json.choices[0]?.message;
    if (!msg) throw new Error("OpenAI returned no choices");
    messages.push({ role: "assistant", content: msg.content, tool_calls: msg.tool_calls });
    if (msg.content) emit({ type: "text", delta: msg.content });
    if (!msg.tool_calls?.length) return;

    emit({ type: "expression", value: "thinking" });
    let expression: Expression | undefined;
    for (const call of msg.tool_calls) {
      emit({ type: "tool", name: call.function.name, status: "start" });
      let input: unknown;
      try {
        input = JSON.parse(call.function.arguments);
      } catch {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Arguments were not valid JSON" }) });
        continue;
      }
      const out = emitTool(call.function.name, input, ctx, emit);
      if (out.expression) expression = out.expression;
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out.forModel ?? out.data) });
    }
    if (expression) emit({ type: "expression", value: expression });
  }
  emit({ type: "text", delta: "\nI need a moment to finish that — could you repeat what you'd like next?" });
}
