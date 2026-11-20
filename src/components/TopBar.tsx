"use client";
import type { LangId } from "@/lib/lang";
import type { LlmProvider } from "@/lib/types";
import { LanguagePicker } from "./voice/LanguagePicker";

function ModeBadge({ provider }: { provider: LlmProvider | null }) {
  if (!provider) return null;
  if (provider === "demo") {
    return (
      <span className="rounded-full border border-amber-400/60 bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200" title="Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in .env.local">
        ✨ Smart Demo Mode — Add API Key for Live AI
      </span>
    );
  }
  return (
    <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
      ● Live AI · {provider === "claude" ? "Claude" : "OpenAI"}
    </span>
  );
}

export function TopBar({
  provider,
  lang,
  onLang,
  b2b,
  onB2b,
  voiceOn,
  onVoice,
}: {
  provider: LlmProvider | null;
  lang: LangId;
  onLang: (l: LangId) => void;
  b2b: boolean;
  onB2b: () => void;
  voiceOn: boolean;
  onVoice: () => void;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-card px-3 py-2">
      <div className="mr-auto flex items-center gap-2">
        <div className="text-lg leading-none font-bold tracking-tight">
          TBO <span className="text-brand">Saathi</span>
        </div>
        <ModeBadge provider={provider} />
      </div>
      <LanguagePicker value={lang} onChange={onLang} />
      <div className="flex items-center gap-2">
        <button
          onClick={onB2b}
          aria-pressed={b2b}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${b2b ? "bg-violet-600 text-white" : "border border-line bg-card hover:border-violet-400"}`}
          title="Travel agent copilot: net vs client price, markup and a printable English client itinerary"
        >
          💼 B2B Agent {b2b ? "ON" : "OFF"}
        </button>
        <button onClick={onVoice} aria-pressed={voiceOn} className="rounded-full border border-line px-2.5 py-1 text-xs" title="Toggle spoken replies">
          {voiceOn ? "🔊" : "🔇"}
        </button>
      </div>
    </header>
  );
}
