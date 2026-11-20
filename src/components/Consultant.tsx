"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AvatarStage } from "@/components/avatar/AvatarStage";
import { useLipSync } from "@/components/avatar/useLipSync";
import { ChatPanel, type CardHandlers } from "@/components/chat/ChatPanel";
import { DemoBar } from "@/components/chat/DemoBar";
import { MemoryBar } from "@/components/MemoryBar";
import { TopBar } from "@/components/TopBar";
import { MicButton } from "@/components/voice/MicButton";
import { BookingsTab } from "@/components/workspace/BookingsTab";
import { ClientItinerary } from "@/components/workspace/ClientItinerary";
import { CompareTab } from "@/components/workspace/CompareTab";
import { ItineraryTab } from "@/components/workspace/ItineraryTab";
import { Workspace } from "@/components/workspace/Workspace";
import { PHRASES } from "@/lib/agent/demo/phrases";
import { inr, PLAN_GOA_HINDI, STRINGS } from "@/lib/client/i18n";
import { useChat, type ChatContext, type WorkspaceTab } from "@/lib/client/useChat";
import { useWorkspace } from "@/lib/client/useWorkspace";
import { LANG_META, type LangId } from "@/lib/lang";
import { chooseVoice, listen, onVoicesChanged, recognitionSupported, speak, speechProvider, stopSpeaking, waitForVoices } from "@/lib/speech";
import type { Booking, Expression, LlmProvider, PendingAction, Pref, PrefKey } from "@/lib/types";

const noopSubscribe = () => () => {};

export function Consultant() {
  const [lang, setLangState] = useState<LangId>("en");
  const langRef = useRef<LangId>("en");
  const [provider, setProvider] = useState<LlmProvider | null>(null);
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [budgetINR, setBudget] = useState<number | null>(null);
  const [b2b, setB2b] = useState({ enabled: false, markupPct: 12 });
  const idsRef = useRef<{ itineraryId: string | null; bookingId: string | null }>({ itineraryId: null, bookingId: null });
  const [ids, setIds] = useState<{ itineraryId: string | null; bookingId: string | null }>({ itineraryId: null, bookingId: null });
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState<Expression | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceLabel, setVoiceLabel] = useState("Voice: checking…");
  const [view, setView] = useState<"chat" | "workspace">("chat");
  const micOk = useSyncExternalStore(noopSubscribe, recognitionSupported, () => false);
  const stopListen = useRef<(() => void) | null>(null);
  const lip = useLipSync();
  const ws = useWorkspace();
  const t = STRINGS[lang];

  const setLang = useCallback((l: LangId) => {
    langRef.current = l;
    setLangState(l);
  }, []);
  const setIdsBoth = useCallback((next: Partial<typeof idsRef.current>) => {
    idsRef.current = { ...idsRef.current, ...next };
    setIds(idsRef.current);
  }, []);

  // Which brain is answering (Claude / OpenAI / Smart Demo), shown in the top bar.
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((j: { provider: LlmProvider }) => setProvider(j.provider))
      .catch(() => setProvider("demo"));
  }, []);

  // Voice for the current language: waits for voiceschanged and reports what will actually speak.
  useEffect(() => {
    let live = true;
    const update = async () => {
      const engine = await speechProvider();
      if (!live) return;
      if (engine === "sarvam" || engine === "bhashini") {
        setVoiceLabel(`🔊 ${engine === "sarvam" ? "Sarvam AI" : "Bhashini"} voice · ${LANG_META[lang].serverTtsLocale}`);
        return;
      }
      const locale = LANG_META[lang].ttsLocale;
      const choice = chooseVoice(locale, await waitForVoices());
      if (!live) return;
      setVoiceLabel(
        choice.voice
          ? `🔊 ${choice.voice.name} · ${choice.voice.lang}${choice.native ? "" : " (closest match)"}`
          : `⚠️ No ${LANG_META[lang].label} voice on this device — install it in OS speech settings or add SARVAM_API_KEY`,
      );
    };
    void update();
    const off = onVoicesChanged(() => void update());
    return () => {
      live = false;
      off();
    };
  }, [lang]);

  const say = useCallback(
    (text: string, replyLang: LangId, mood: Expression = "speaking") => {
      if (!voiceOn) return;
      setSpeaking(mood === "concerned" ? "concerned" : "speaking");
      speak(text, replyLang, lip)
        .then((v) => {
          if (v.engine !== "webspeech") setVoiceLabel(`🔊 ${v.voiceName} · ${LANG_META[replyLang].serverTtsLocale}`);
        })
        .finally(() => setSpeaking(null));
    },
    [voiceOn, lip],
  );

  const getContext = useCallback(
    (): ChatContext => ({ lang: langRef.current, ...idsRef.current, prefs: prefs.map((p) => p.key), budgetINR, b2b }),
    [prefs, budgetINR, b2b],
  );

  const chat = useChat(getContext, {
    onMeta: (p, l) => {
      setProvider(p);
      if (l !== langRef.current) setLang(l); // true language switching follows the traveller
    },
    onMemory: (p, b) => {
      setPrefs(p);
      setBudget(b);
    },
    onState: (itineraryId, bookingId) => {
      setIdsBoth({ ...(itineraryId ? { itineraryId } : {}), ...(bookingId ? { bookingId } : {}) });
      if (bookingId) ws.addBookingId(bookingId);
    },
    onTool: ws.onTool,
    onReply: (text, replyLang, mood) => say(text, replyLang, mood),
  });
  const { send, busy } = chat;
  const { refresh, bookingIds } = ws;

  // Keep the workspace in sync after every turn.
  useEffect(() => {
    if (!busy) void refresh(ids.itineraryId, bookingIds);
  }, [busy, ids.itineraryId, bookingIds, refresh]);

  const submit = (text: string, opts?: { autoLang?: boolean; display?: string }) => {
    stopSpeaking(lip);
    setSpeaking(null);
    setInput("");
    void send(text, opts);
  };
  /** UI-generated prompts are already in the chosen language: don't let them switch it. */
  const ui = (text: string, display?: string) => submit(text, { autoLang: false, display });

  const toggleMic = () => {
    if (listening) {
      stopListen.current?.();
      return;
    }
    stopSpeaking(lip);
    setSpeaking(null);
    setListening(true);
    stopListen.current = listen(LANG_META[langRef.current].sttLocale, {
      onPartial: setInput,
      onFinal: (text) => submit(text),
      onEnd: () => setListening(false),
      onError: (msg) => setInput(msg),
    });
  };

  const changeLang = (l: LangId) => {
    stopListen.current?.();
    stopSpeaking(lip);
    setSpeaking(null);
    setLang(l);
  };

  const activeBooking = [...ws.bookings].reverse().find((b) => b.status === "confirmed") ?? null;
  const openTab = (tab: WorkspaceTab) => {
    ws.setTab(tab);
    setView("workspace");
  };

  const simulate = (b: Booking) => {
    setIdsBoth({ bookingId: b.id, itineraryId: b.itineraryId });
    setView("chat");
    ui(`[disruption:flight_cancel] ${t.disruptionAlert}`);
  };

  const showAction = (action: PendingAction, text: string) => {
    chat.addAssistant(text, [{ kind: "action", action, status: "open" }]);
    say(text, langRef.current, action.type === "book" ? "speaking" : "concerned");
    setView("chat");
  };

  const handlers: CardHandlers = {
    async confirm(action, guest) {
      try {
        const { booking } = await ws.confirm(action.id, guest);
        chat.updateCard(action.id, "confirmed");
        setIdsBoth({ bookingId: booking.id, itineraryId: booking.itineraryId });
        ws.addBookingId(booking.id);
        if (action.type === "rebook") ws.clearDisruption(booking.id);
        const S = STRINGS[langRef.current];
        const msg =
          action.type === "cancel"
            ? S.cancelled(inr(booking.refundINR))
            : action.type === "rebook"
              ? S.rescued(booking.pnr)
              : action.bookingId
                ? S.updated(booking.pnr)
                : S.booked(booking.pnr, inr(booking.paidINR));
        chat.addAssistant(msg);
        chat.setExpression(action.type === "cancel" ? "idle" : "speaking");
        say(msg, langRef.current);
        await refresh(booking.itineraryId, [...new Set([...bookingIds, booking.id])]);
        ws.setTab("bookings");
      } catch (e) {
        chat.updateCard(action.id, "error", (e as Error).message);
      }
    },
    edit(action) {
      void ws.discard(action.id);
      chat.updateCard(action.id, "edited");
      const msg = STRINGS[langRef.current].editHint;
      chat.addAssistant(msg);
      say(msg, langRef.current);
      openTab("itinerary");
    },
    choose(bookingId, index) {
      ws.prepareRebook(bookingId, index)
        .then(({ action }) => showAction(action, PHRASES[langRef.current].rebookReady))
        .catch((e: Error) => chat.addAssistant("", [{ kind: "note", tone: "error", text: e.message }]));
    },
    openTab,
  };

  const cancelBooking = (b: Booking) => {
    ws.prepareCancel(b.id)
      .then(({ action }) => showAction(action, PHRASES[langRef.current].cancelReady(inr(-action.payableINR))))
      .catch((e: Error) => chat.addAssistant("", [{ kind: "note", tone: "error", text: e.message }]));
  };

  const expression: Expression = listening ? "listening" : (speaking ?? chat.expression);
  const prefKeys = prefs.map((p) => p.key);

  const chips = [
    { label: "Plan Goa in Hindi (₹50k)", onClick: () => (changeLang("hi"), submit(PLAN_GOA_HINDI)), disabled: busy },
    { label: "Compare Hotels", onClick: () => (openTab("compare"), setView("chat"), ui(t.compareHotels)), disabled: busy },
    { label: "Make it Cheaper", onClick: () => ui(t.makeCheaper), disabled: busy },
    {
      label: "Simulate Flight Cancellation 🚨",
      onClick: () => activeBooking && simulate(activeBooking),
      disabled: busy || !activeBooking,
      hint: activeBooking ? "Trigger a live airline cancellation on your booking" : "Book a trip first (Plan Goa → Confirm ✅)",
      tone: "alert" as const,
    },
    {
      label: "B2B Agent View",
      onClick: () => {
        setB2b((b) => ({ ...b, enabled: true }));
        openTab("client");
      },
    },
  ];

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        provider={provider}
        lang={lang}
        onLang={changeLang}
        b2b={b2b.enabled}
        onB2b={() => {
          setB2b((b) => ({ ...b, enabled: !b.enabled }));
          if (ws.tab === "client") ws.setTab("itinerary");
        }}
        voiceOn={voiceOn}
        onVoice={() => {
          if (voiceOn) stopSpeaking(lip);
          setVoiceOn((v) => !v);
        }}
      />
      <MemoryBar
        prefs={prefs}
        budgetINR={budgetINR}
        onRemove={(k: PrefKey) => setPrefs((p) => p.filter((x) => x.key !== k))}
        onClearBudget={() => setBudget(null)}
      />

      <div className="flex min-h-0 flex-1 lg:gap-3 lg:p-3">
        {/* Left: avatar + conversation */}
        <section className={`${view === "chat" ? "flex" : "hidden"} min-h-0 w-full flex-col border-line bg-card lg:flex lg:w-[440px] lg:shrink-0 lg:rounded-2xl lg:border`}>
          <div className="flex items-center gap-3 border-b border-line px-3 py-2 lg:block lg:py-3">
            <AvatarStage expression={expression} lip={lip} voiceLabel={voiceLabel} />
          </div>
          <ChatPanel messages={chat.messages} greeting={t.greeting} suggestions={t.suggestions} onSend={(s) => submit(s)} busy={busy} handlers={handlers} />
          <DemoBar chips={chips} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex items-center gap-2 border-t border-line p-2.5"
          >
            <MicButton listening={listening} supported={micOk} disabled={busy} onToggle={toggleMic} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "…" : t.placeholder}
              lang={lang === "hinglish" ? "en" : lang}
              className="min-w-0 flex-1 rounded-full border border-line bg-background px-4 py-2.5 text-[15px] outline-none focus:border-brand"
              aria-label="Message"
            />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-stone-900 disabled:opacity-40">
              Send
            </button>
          </form>
        </section>

        {/* Right: trip workspace */}
        <section className={`${view === "workspace" ? "flex" : "hidden"} min-h-0 flex-1 flex-col bg-background lg:flex lg:rounded-2xl lg:border lg:border-line`}>
          <Workspace tab={ws.tab} setTab={ws.setTab} b2b={b2b.enabled} counts={{ bookings: ws.bookings.filter((b) => b.status === "confirmed").length }}>
            {ws.tab === "compare" && <CompareTab data={ws.compare} prefs={prefKeys} onSelect={(text, display) => ui(text, display)} disabled={busy} />}
            {ws.tab === "itinerary" && (
              <ItineraryTab
                itinerary={ws.trip?.itinerary ?? null}
                booking={ws.trip?.booking ?? null}
                budgetINR={budgetINR}
                b2b={b2b}
                setMarkup={(n) => setB2b((b) => ({ ...b, markupPct: n }))}
                quick={[
                  { label: "💸 Make it cheaper", onClick: () => ui(t.makeCheaper) },
                  { label: "➕ Add 1 day", onClick: () => ui(t.addDay) },
                  { label: "➖ Remove 1 day", onClick: () => ui(t.removeDay) },
                  { label: "⭐ Upgrade hotel", onClick: () => ui(t.upgradeHotel) },
                ]}
                onBook={() => {
                  setView("chat");
                  ui(t.reviewBook);
                }}
                disabled={busy}
              />
            )}
            {ws.tab === "bookings" && (
              <BookingsTab
                bookings={ws.bookings}
                disruptions={ws.disruptions}
                onCancel={cancelBooking}
                onModify={() => openTab("itinerary")}
                onSimulate={simulate}
                onChoose={handlers.choose}
                disabled={busy}
              />
            )}
            {ws.tab === "client" && b2b.enabled && <ClientItinerary itinerary={ws.trip?.itinerary ?? null} booking={ws.trip?.booking ?? null} markupPct={b2b.markupPct} />}
          </Workspace>
        </section>
      </div>

      {/* Mobile: switch between conversation and workspace */}
      <nav className="grid grid-cols-2 border-t border-line bg-card lg:hidden" aria-label="View">
        {(["chat", "workspace"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`py-2.5 text-sm font-semibold ${view === v ? "text-brand" : "text-muted"}`}>
            {v === "chat" ? "💬 Chat with Saathi" : "🗂️ Trip workspace"}
          </button>
        ))}
      </nav>
    </div>
  );
}
