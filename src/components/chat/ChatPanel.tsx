"use client";
import { useEffect, useRef } from "react";
import type { UiMessage } from "@/lib/client/useChat";
import { MessageBubble } from "./MessageBubble";

export function ChatPanel({
  messages,
  greeting,
  suggestions,
  onSend,
  busy,
}: {
  messages: UiMessage[];
  greeting: string;
  suggestions: string[];
  onSend: (t: string) => void;
  busy: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-line bg-card px-3.5 py-2 text-[15px]">{greeting}</div>
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              disabled={busy}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-left text-sm hover:border-brand"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {messages.map((m) => (
        <MessageBubble key={m.id} m={m} onAct={onSend} busy={busy} />
      ))}
      <div ref={end} />
    </div>
  );
}
