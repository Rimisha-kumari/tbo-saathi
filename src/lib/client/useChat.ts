"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LangId } from "@/lib/lang";
import type { ChatEvent, DisruptionResult, Expression, LlmProvider, PendingAction, Pref } from "@/lib/types";

export type InlineCard =
  | { kind: "action"; action: PendingAction; status: "open" | "confirmed" | "edited" | "error"; error?: string }
  | { kind: "disruption"; data: DisruptionResult }
  | { kind: "link"; tab: WorkspaceTab; label: string }
  | { kind: "note"; text: string; tone: "info" | "error" };

export type WorkspaceTab = "compare" | "itinerary" | "bookings" | "client";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Text shown in the bubble when it differs from what was sent (e.g. card clicks). */
  display?: string;
  cards: InlineCard[];
  tools: string[];
  pending?: boolean;
}

export interface ChatContext {
  lang: LangId;
  itineraryId: string | null;
  bookingId: string | null;
  prefs: string[];
  budgetINR: number | null;
  b2b: { enabled: boolean; markupPct: number };
}

export interface ChatHandlers {
  onMeta(provider: LlmProvider, lang: LangId): void;
  onMemory(prefs: Pref[], budgetINR: number | null): void;
  onState(itineraryId: string | null, bookingId: string | null): void;
  onTool(name: string, data: unknown): void;
  onReply(text: string, lang: LangId, mood: Expression): void;
}

const TOOL_LABEL: Record<string, string> = {
  planTrip: "Planning trip",
  adjustTrip: "Adjusting trip",
  searchFlights: "Searching flights",
  searchHotels: "Searching hotels",
  checkAvailability: "Checking availability",
  updateItinerary: "Updating itinerary",
  bookTrip: "Preparing booking",
  cancelBooking: "Preparing cancellation",
  handleDisruption: "Assessing disruption",
  applyDisruptionOption: "Preparing rescue",
};

const TOOL_LINK: Record<string, { tab: WorkspaceTab; label: string }> = {
  planTrip: { tab: "itinerary", label: "📅 View day-by-day itinerary" },
  adjustTrip: { tab: "itinerary", label: "📅 View updated itinerary" },
  updateItinerary: { tab: "itinerary", label: "📅 View itinerary" },
  searchFlights: { tab: "compare", label: "⚖️ Compare flights side by side" },
  searchHotels: { tab: "compare", label: "⚖️ Compare hotels side by side" },
};

export const uid = () =>
  typeof globalThis.crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useChat(getContext: () => ChatContext, handlers: ChatHandlers) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [expression, setExpression] = useState<Expression>("idle");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const msgsRef = useRef(messages);
  const handlersRef = useRef(handlers);
  const ctxRef = useRef(getContext);
  useEffect(() => {
    msgsRef.current = messages;
    handlersRef.current = handlers;
    ctxRef.current = getContext;
  });
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((id: string, fn: (m: UiMessage) => UiMessage) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m))), []);

  /** Add an assistant message without calling the server (e.g. after a Confirm click). */
  const addAssistant = useCallback((text: string, cards: InlineCard[] = []) => {
    const m: UiMessage = { id: uid(), role: "assistant", text, cards, tools: [] };
    setMessages((ms) => [...ms, m]);
    return m.id;
  }, []);

  const updateCard = useCallback((actionId: string, status: "confirmed" | "edited" | "error", error?: string) => {
    setMessages((ms) =>
      ms.map((m) => ({
        ...m,
        cards: m.cards.map((c) => (c.kind === "action" && c.action.id === actionId ? { ...c, status, error } : c)),
      })),
    );
  }, []);

  const send = useCallback(
    async (text: string, opts: { autoLang?: boolean; display?: string } = {}) => {
      const content = text.trim();
      if (!content || busy) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      sessionRef.current ??= uid();
      const ctx = ctxRef.current();

      const user: UiMessage = { id: uid(), role: "user", text: content, display: opts.display, cards: [], tools: [] };
      const asst: UiMessage = { id: uid(), role: "assistant", text: "", cards: [], tools: [], pending: true };
      const history = [...msgsRef.current, user]
        .filter((m) => m.text.trim())
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.text.slice(0, 4000) }));
      setMessages((ms) => [...ms, user, asst]);
      setBusy(true);
      setExpression("thinking");

      let reply = "";
      let replyLang = ctx.lang;
      let mood: Expression = "speaking";
      const links = new Set<string>();
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionRef.current, autoLang: opts.autoLang ?? true, ...ctx, messages: history }),
          signal: ac.signal,
        });
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
            const h = handlersRef.current;
            switch (ev.type) {
              case "meta":
                replyLang = ev.lang;
                h.onMeta(ev.provider, ev.lang);
                break;
              case "memory":
                h.onMemory(ev.prefs, ev.budgetINR);
                break;
              case "text":
                reply += ev.delta;
                patch(asst.id, (m) => ({ ...m, text: m.text + ev.delta }));
                break;
              case "expression":
                if (ev.value === "concerned") mood = "concerned";
                setExpression(ev.value);
                break;
              case "state":
                h.onState(ev.itineraryId, ev.bookingId);
                break;
              case "action":
                patch(asst.id, (m) => ({ ...m, cards: [...m.cards, { kind: "action", action: ev.action, status: "open" }] }));
                break;
              case "tool":
                if (ev.status === "start") {
                  patch(asst.id, (m) => ({ ...m, tools: [...m.tools, TOOL_LABEL[ev.name] ?? ev.name] }));
                } else if (ev.status === "done") {
                  h.onTool(ev.name, ev.data);
                  if (ev.name === "handleDisruption") {
                    patch(asst.id, (m) => ({ ...m, cards: [...m.cards, { kind: "disruption", data: ev.data as DisruptionResult }] }));
                  }
                  const link = TOOL_LINK[ev.name];
                  if (link && !links.has(link.tab)) {
                    links.add(link.tab);
                    patch(asst.id, (m) => ({ ...m, cards: [...m.cards, { kind: "link", ...link }] }));
                  }
                } else {
                  const msg = (ev.data as { error?: string })?.error ?? "failed";
                  patch(asst.id, (m) => ({ ...m, cards: [...m.cards, { kind: "note", tone: "error", text: `${TOOL_LABEL[ev.name] ?? ev.name}: ${msg}` }] }));
                }
                break;
              case "error":
                mood = "concerned";
                patch(asst.id, (m) => ({ ...m, cards: [...m.cards, { kind: "note", tone: "error", text: ev.message }] }));
                break;
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          mood = "concerned";
          patch(asst.id, (m) => ({ ...m, cards: [...m.cards, { kind: "note", tone: "error", text: (e as Error).message }] }));
        }
      } finally {
        patch(asst.id, (m) => ({ ...m, pending: false }));
        setBusy(false);
        setExpression(mood === "concerned" ? "concerned" : "idle");
        if (reply.trim()) handlersRef.current.onReply(reply, replyLang, mood);
      }
    },
    [busy, patch],
  );

  return { messages, send, busy, expression, setExpression, addAssistant, updateCard };
}
