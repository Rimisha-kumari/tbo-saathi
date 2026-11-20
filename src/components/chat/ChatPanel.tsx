"use client";
import { useEffect, useRef } from "react";
import type { InlineCard, UiMessage, WorkspaceTab } from "@/lib/client/useChat";
import type { LeadGuest, PendingAction } from "@/lib/types";
import { ConfirmCard } from "./ConfirmCard";
import { DisruptionCard } from "./DisruptionCard";

export interface CardHandlers {
  confirm(action: PendingAction, guest: LeadGuest | null): Promise<void>;
  edit(action: PendingAction): void;
  choose(bookingId: string, index: number): void;
  openTab(tab: WorkspaceTab): void;
}

function Card({ c, h, busy }: { c: InlineCard; h: CardHandlers; busy: boolean }) {
  switch (c.kind) {
    case "action":
      return <ConfirmCard action={c.action} status={c.status} error={c.error} onConfirm={(g) => h.confirm(c.action, g)} onEdit={() => h.edit(c.action)} />;
    case "disruption":
      return <DisruptionCard d={c.data} disabled={busy} onChoose={(i) => h.choose(c.data.bookingId, i)} />;
    case "link":
      return (
        <button onClick={() => h.openTab(c.tab)} className="rounded-full border border-brand/40 bg-brand/5 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/10">
          {c.label} →
        </button>
      );
    case "note":
      return <div className={`rounded-lg px-3 py-1.5 text-xs ${c.tone === "error" ? "bg-rose-500/10 text-rose-600" : "bg-line text-muted"}`}>{c.text}</div>;
  }
}

export function ChatPanel({
  messages,
  greeting,
  suggestions,
  onSend,
  busy,
  handlers,
}: {
  messages: UiMessage[];
  greeting: string;
  suggestions: string[];
  onSend: (t: string) => void;
  busy: boolean;
  handlers: CardHandlers;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-line bg-card px-3.5 py-2 text-[15px]">{greeting}</div>
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => onSend(s)} disabled={busy} className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-sm hover:border-brand">
              {s}
            </button>
          ))}
        </div>
      )}
      {messages.map((m) => {
        const mine = m.role === "user";
        const shown = mine ? (m.display ?? m.text.replace(/^\[disruption:\w+\]\s*/, "🚨 ")) : m.text;
        return (
          <div key={m.id} className={`flex flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
            {m.tools.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {[...new Set(m.tools)].map((t) => (
                  <span key={t} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-600 dark:text-indigo-300">
                    {m.pending ? "⏳" : "✓"} {t}
                  </span>
                ))}
              </div>
            )}
            {(shown || m.pending) && (
              <div
                className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                  mine ? "rounded-br-sm bg-brand text-white dark:text-stone-900" : "rounded-bl-sm border border-line bg-card"
                }`}
              >
                {shown || <span className="animate-pulse text-muted">…</span>}
              </div>
            )}
            {m.cards.map((c, i) => (
              <div key={i} className={c.kind === "link" || c.kind === "note" ? "" : "w-full max-w-[96%]"}>
                <Card c={c} h={handlers} busy={busy} />
              </div>
            ))}
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}
