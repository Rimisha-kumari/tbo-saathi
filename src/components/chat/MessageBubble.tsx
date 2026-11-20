"use client";
import type { UiMessage } from "@/lib/client/useChat";
import { BookingCard, DisruptionCard, FlightList, HotelList, ItineraryCard } from "./Cards";

export function MessageBubble({ m, onAct, busy }: { m: UiMessage; onAct: (t: string) => void; busy: boolean }) {
  const mine = m.role === "user";
  const shownText = mine ? m.text.replace(/^\[disruption:\w+\]\s*/, "⚠ ") : m.text;
  return (
    <div className={`flex flex-col gap-2 ${mine ? "items-end" : "items-start"}`}>
      {m.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {[...new Set(m.tools)].map((t) => (
            <span key={t} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-600 dark:text-indigo-300">
              {m.pending ? "⏳" : "✓"} {t}
            </span>
          ))}
        </div>
      )}
      {(shownText || m.pending) && (
        <div
          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
            mine ? "rounded-br-sm bg-brand text-white dark:text-stone-900" : "rounded-bl-sm border border-line bg-card"
          }`}
        >
          {shownText || <span className="animate-pulse text-muted">…</span>}
        </div>
      )}
      {m.cards.map((c, i) => (
        <div key={i} className="w-full max-w-[95%]">
          {c.kind === "flights" && <FlightList flights={c.data} label={c.label} onAct={onAct} disabled={busy} />}
          {c.kind === "hotels" && <HotelList hotels={c.data} onAct={onAct} disabled={busy} />}
          {c.kind === "itinerary" && <ItineraryCard itinerary={c.data} onAct={onAct} disabled={busy} />}
          {c.kind === "booking" && <BookingCard booking={c.data} />}
          {c.kind === "disruption" && <DisruptionCard d={c.data} onAct={onAct} disabled={busy} />}
          {c.kind === "note" && (
            <div className={`rounded-lg px-3 py-1.5 text-xs ${c.tone === "error" ? "bg-rose-500/10 text-rose-600" : "bg-line text-muted"}`}>
              {c.text}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
