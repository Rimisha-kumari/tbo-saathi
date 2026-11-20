"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Booking, ChatEvent, DisruptionResult, Expression, Flight, Hotel, Itinerary, Lang } from "@/lib/types";

export type Card =
  | { kind: "flights"; data: Flight[]; label?: string }
  | { kind: "hotels"; data: Hotel[] }
  | { kind: "itinerary"; data: Itinerary }
  | { kind: "booking"; data: Booking }
  | { kind: "disruption"; data: DisruptionResult }
  | { kind: "note"; text: string; tone: "info" | "error" };

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards: Card[];
  tools: string[];
  pending?: boolean;
}

const TOOL_LABEL: Record<string, string> = {
  searchFlights: "Searching flights",
  searchHotels: "Searching hotels",
  checkAvailability: "Checking availability",
  updateItinerary: "Updating itinerary",
  bookTrip: "Booking",
  handleDisruption: "Assessing disruption",
};

const uid = () => (typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function cardsFor(name: string, data: unknown): Card[] {
  switch (name) {
    case "searchFlights":
      if (Array.isArray(data)) return [{ kind: "flights", data: data as Flight[] }];
      {
        const d = data as { outbound: Flight[]; inbound: Flight[] };
        return [
          { kind: "flights", data: d.outbound, label: "Outbound" },
          { kind: "flights", data: d.inbound, label: "Return" },
        ];
      }
    case "searchHotels":
      return [{ kind: "hotels", data: data as Hotel[] }];
    case "updateItinerary":
      return [{ kind: "itinerary", data: data as Itinerary }];
    case "bookTrip":
      return [{ kind: "booking", data: data as Booking }];
    case "handleDisruption":
      return [{ kind: "disruption", data: data as DisruptionResult }];
    default:
      return [];
  }
}

export function useChat(opts: { lang: Lang; onReply: (text: string, mood: Expression) => void }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [expression, setExpression] = useState<Expression>("idle");
  const [busy, setBusy] = useState(false);
  const [ids, setIds] = useState<{ itineraryId: string | null; bookingId: string | null }>({ itineraryId: null, bookingId: null });
  const [mode, setMode] = useState<"claude" | "offline" | null>(null);
  const sessionRef = useRef<string | null>(null);
  const idsRef = useRef(ids);
  const msgsRef = useRef(messages);
  useEffect(() => {
    msgsRef.current = messages;
  }, [messages]);
  const abortRef = useRef<AbortController | null>(null);

  const patchLast = (fn: (m: UiMessage) => UiMessage) =>
    setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? fn(m) : m)));

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      sessionRef.current ??= uid();

      const user: UiMessage = { id: uid(), role: "user", text: content, cards: [], tools: [] };
      const asst: UiMessage = { id: `${user.id}-a`, role: "assistant", text: "", cards: [], tools: [], pending: true };
      const history = [...msgsRef.current, user]
        .filter((m) => m.text.trim())
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.text.slice(0, 4000) }));
      setMessages((ms) => [...ms, user, asst]);
      setBusy(true);
      setExpression("thinking");

      let reply = "";
      let mood: Expression = "speaking";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionRef.current, lang: opts.lang, ...idsRef.current, messages: history }),
          signal: ac.signal,
        });
        setMode(res.headers.get("X-Saathi-Mode") === "claude" ? "claude" : "offline");
        if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as ChatEvent;
            switch (ev.type) {
              case "text":
                reply += ev.delta;
                patchLast((m) => ({ ...m, text: m.text + ev.delta }));
                break;
              case "expression":
                if (ev.value === "concerned") mood = "concerned";
                setExpression(ev.value);
                break;
              case "tool":
                if (ev.status === "start") patchLast((m) => ({ ...m, tools: [...m.tools, TOOL_LABEL[ev.name] ?? ev.name] }));
                else if (ev.status === "done") patchLast((m) => ({ ...m, cards: [...m.cards, ...cardsFor(ev.name, ev.data)] }));
                else
                  patchLast((m) => ({
                    ...m,
                    cards: [...m.cards, { kind: "note", tone: "error", text: `${TOOL_LABEL[ev.name] ?? ev.name}: ${(ev.data as { error?: string })?.error ?? "failed"}` }],
                  }));
                break;
              case "state": {
                const next = {
                  itineraryId: ev.itineraryId ?? idsRef.current.itineraryId,
                  bookingId: ev.bookingId ?? idsRef.current.bookingId,
                };
                idsRef.current = next;
                setIds(next);
                break;
              }
              case "error":
                mood = "concerned";
                patchLast((m) => ({ ...m, cards: [...m.cards, { kind: "note", tone: "error", text: ev.message }] }));
                break;
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          mood = "concerned";
          patchLast((m) => ({ ...m, cards: [...m.cards, { kind: "note", tone: "error", text: (e as Error).message }] }));
        }
      } finally {
        patchLast((m) => ({ ...m, pending: false }));
        setBusy(false);
        setExpression(mood === "concerned" ? "concerned" : "idle");
        if (reply.trim()) opts.onReply(reply, mood);
      }
    },
    [busy, opts],
  );

  return { messages, send, busy, expression, setExpression, ids, mode };
}
