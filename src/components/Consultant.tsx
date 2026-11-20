"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/avatar/Avatar";
import { EXPRESSION_LABEL } from "@/components/avatar/expressions";
import { useLipSync } from "@/components/avatar/useLipSync";
import { BookingCard, ItineraryCard } from "@/components/chat/Cards";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { LanguagePicker } from "@/components/voice/LanguagePicker";
import { MicButton } from "@/components/voice/MicButton";
import { STRINGS } from "@/lib/client/i18n";
import { useChat } from "@/lib/client/useChat";
import { listen, recognitionSupported, speak, speechProvider, stopSpeaking } from "@/lib/speech";
import type { Booking, DisruptionType, Expression, Itinerary, Lang } from "@/lib/types";

const DISRUPTIONS: { type: DisruptionType; label: string }[] = [
  { type: "flight_cancel", label: "Flight cancelled" },
  { type: "flight_delay", label: "Flight delayed" },
  { type: "hotel_overbooked", label: "Hotel overbooked" },
];

const noopSubscribe = () => () => {};

export function Consultant() {
  const [lang, setLang] = useState<Lang>("en-IN");
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<Expression | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const micOk = useSyncExternalStore(noopSubscribe, recognitionSupported, () => false);
  const [provider, setProvider] = useState("webspeech");
  const [trip, setTrip] = useState<{ itinerary: Itinerary; booking: Booking | null } | null>(null);
  const stopListen = useRef<(() => void) | null>(null);
  const lip = useLipSync();
  const t = STRINGS[lang];

  useEffect(() => {
    speechProvider().then(setProvider);
  }, []);

  const onReply = useCallback(
    (text: string, mood: Expression) => {
      if (!voiceOn) return;
      setSpeaking(mood === "concerned" ? "concerned" : "speaking");
      speak(text, lang, lip).finally(() => setSpeaking(null));
    },
    [voiceOn, lang, lip],
  );

  const chat = useChat({ lang, onReply });
  const { send, busy, ids } = chat;

  // Refresh the trip sidebar from /api/travel whenever a turn finishes.
  useEffect(() => {
    if (!ids.itineraryId || busy) return;
    fetch(`/api/travel?op=itinerary&id=${encodeURIComponent(ids.itineraryId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTrip(j))
      .catch(() => {});
  }, [ids.itineraryId, busy, chat.messages.length]);

  const submit = (text: string) => {
    stopSpeaking(lip);
    setSpeaking(null);
    setInput("");
    void send(text);
  };

  const toggleMic = () => {
    if (listening) {
      stopListen.current?.();
      return;
    }
    stopSpeaking(lip);
    setSpeaking(null);
    setListening(true);
    stopListen.current = listen(lang, {
      onPartial: setInput,
      onFinal: (text) => submit(text),
      onEnd: () => setListening(false),
      onError: (msg) => setInput(msg),
    });
  };

  const changeLang = (l: Lang) => {
    stopListen.current?.();
    stopSpeaking(lip);
    setSpeaking(null);
    setLang(l);
  };

  const expression: Expression = listening ? "listening" : (speaking ?? chat.expression);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-6xl flex-col md:flex-row md:gap-4 md:p-4">
      {/* Avatar column */}
      <aside className="flex shrink-0 flex-col items-center gap-2 border-b md:gap-3 border-line px-4 pt-3 pb-3 md:w-[360px] md:overflow-y-auto md:rounded-2xl md:border md:bg-card md:pt-5">
        <header className="flex w-full items-center justify-between">
          <div>
            <div className="text-lg font-bold tracking-tight">
              TBO <span className="text-brand">Saathi</span>
            </div>
            <div className="text-xs text-muted">Your multilingual travel consultant</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {chat.mode === "claude" ? "Claude agent" : chat.mode === "offline" ? "Offline demo" : "Ready"}
            </span>
            <button
              onClick={() => {
                if (voiceOn) stopSpeaking(lip);
                setVoiceOn((v) => !v);
              }}
              className="text-xs text-muted underline-offset-2 hover:underline"
              aria-pressed={voiceOn}
            >
              {voiceOn ? "🔊 Voice on" : "🔇 Voice off"}
            </button>
          </div>
        </header>

        <div className="w-32 sm:w-44 md:w-64">
          <Avatar expression={expression} lip={lip} />
        </div>
        <div className="text-sm font-medium text-muted" aria-live="polite">
          {EXPRESSION_LABEL[expression]}
        </div>
        <LanguagePicker value={lang} onChange={changeLang} />
        <div className="text-[11px] text-muted">
          Voice: {provider === "webspeech" ? "browser speech (no keys)" : provider}
        </div>

        <div className="hidden w-full space-y-3 md:block">
          {trip && <ItineraryCard itinerary={trip.itinerary} compact />}
          {trip?.booking && (
            <>
              <BookingCard booking={trip.booking} />
              <div className="rounded-xl border border-dashed border-rose-400/60 p-3 text-xs">
                <div className="mb-2 font-semibold text-rose-600">Demo: simulate a disruption</div>
                <div className="flex flex-wrap gap-1.5">
                  {DISRUPTIONS.map((d) => (
                    <button
                      key={d.type}
                      disabled={busy}
                      onClick={() => submit(`[disruption:${d.type}] ${t.disruptionAlert}`)}
                      className="rounded-full border border-rose-400/60 px-2.5 py-1 hover:bg-rose-500/10 disabled:opacity-40"
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Conversation column */}
      <main className="flex min-h-0 flex-1 flex-col md:rounded-2xl md:border md:border-line md:bg-background">
        <ChatPanel messages={chat.messages} greeting={t.greeting} suggestions={t.suggestions} onSend={submit} busy={busy} />
        {trip?.booking && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 text-xs md:hidden">
            {DISRUPTIONS.map((d) => (
              <button
                key={d.type}
                disabled={busy}
                onClick={() => submit(`[disruption:${d.type}] ${t.disruptionAlert}`)}
                className="shrink-0 rounded-full border border-rose-400/60 px-2.5 py-1 text-rose-600"
              >
                ⚠ {d.label}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex items-center gap-2 border-t border-line p-3"
        >
          <MicButton listening={listening} supported={micOk} disabled={busy} onToggle={toggleMic} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "…" : t.placeholder}
            lang={lang}
            className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-[15px] outline-none focus:border-brand"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-stone-900 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
