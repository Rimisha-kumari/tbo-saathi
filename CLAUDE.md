@AGENTS.md

# TBO Saathi — Agentic Multilingual AI Travel Consultant

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · `@anthropic-ai/sdk` · `zod` · `three` + `@react-three/fiber` + `@react-three/drei` · `qrcode`.
This Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before writing route handlers or config.

## Guardrails (non-negotiable)

1. **One repo, no separate backend.** All server logic lives in App Router route handlers (`/api/chat`, `/api/travel`, `/api/speech`). Mock data is static JSON plus an in-memory store. There is no database.
2. **Self-contained avatar, 2D by default with optional 3D.** The 2D SVG avatar (`Avatar.tsx`) is the default. It is server-rendered, appears at first paint and needs no assets or WebGL. 3D (`Avatar3D.tsx`, procedural Three.js via `@react-three/fiber` + `drei`, no `.vrm`/GLTF/HDR or network assets) is opt-in through the 2D/3D pill. `AvatarStage.tsx` loads it with `next/dynamic({ ssr: false, loading: () => null })`, mounts it invisibly over the 2D avatar, and reveals it only after `onReady` (its first rendered frame). It stays on 2D if WebGL is missing, the scene throws, or it isn't ready within 5 s. Never show a loading placeholder for the avatar.
   - Expressions: `idle | listening | thinking | speaking | concerned`, shown through face pose and aura/rim-light colour (`expressions.ts`).
   - Lip-sync: one `LipSync` driver feeds both avatars. It uses `SpeechSynthesisUtterance` `boundary` events with a text-timing fallback, and `AnalyserNode` amplitude when Sarvam/Bhashini audio plays.
3. **Zero-key speech and AI by default.** Use the browser Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition` and `speechSynthesis`). Languages (`lib/lang.ts`): `en`, `hi`, `hinglish`, `ta`, `te`, `bn`, each mapped to a TTS locale, an STT locale and a reply instruction. Voices are picked only after `voiceschanged`, and only from the language's own locale. Sarvam AI and Bhashini are optional and turn on only when their env keys are set. With no LLM key, the Smart Demo brain answers. The UI must work with no keys at all.
4. Keep files small and modular. Validate every request body and tool input with zod. Never expose API keys to the client.

## Folder structure

```
src/
  app/
    page.tsx                 # renders <Consultant/>
    api/chat/route.ts        # agent endpoint, streams NDJSON ChatEvents (see types.ts); GET = active provider
    api/travel/route.ts      # GET mock data (?op=flights|hotels|availability|itinerary|booking|bookings|weather|extras); POST = confirmation gate
    api/speech/route.ts      # GET active provider; POST TTS via Sarvam/Bhashini (204 = use browser voice)
  components/
    Consultant.tsx           # split screen (h-dvh, page never scrolls): top bar + memory bar, avatar/chat (left), workspace tabs (right)
    TopBar.tsx, MemoryBar.tsx
    avatar/                  # AvatarStage (2D default, optional 3D swapped in after first frame), Avatar (2D SVG), Avatar3D, useLipSync, expressions
    chat/                    # ChatPanel, ConfirmCard (Confirm ✅ / Edit ✏️ gate), DisruptionCard, DemoBar
    workspace/               # Workspace tabs: CompareTab, ItineraryTab (weather, budget meter, B2B pricing), BookingsTab, ClientItinerary
    voice/                   # MicButton, LanguagePicker
  lib/
    lang.ts                  # LangId ↔ locales, detectLang() (script + Hinglish vocabulary)
    agent/                   # tools.ts, handlers.ts, prompt.ts, memory.ts (prefs/budget extraction), claude.ts, openai.ts, demo/ (brain.ts, phrases.ts)
    travel/                  # store, flights, hotels, inventory (pricing), itinerary, planner (planTrip/adjustTrip), booking, actions (gate), disruption, weather
    speech/                  # webSpeech.ts + index.ts (client facade); server/ (provider.ts, sarvam.ts, bhashini.ts)
    client/                  # useChat.ts, useWorkspace.ts, i18n.ts (UI strings, 6 languages), voucherDoc.ts (QR vouchers, download/print)
    types.ts, hash.ts
  data/                      # flights.json, hotels.json, transfers.json, sightseeing.json (generated mock data)
```

Provider order: `ANTHROPIC_API_KEY` → Claude; otherwise `OPENAI_API_KEY` → OpenAI (also used when Claude fails before any text streams); otherwise **Smart Demo Mode** (`agent/demo/brain.ts`). The demo brain is rule-based and multi-turn, replies natively in all six languages from `phrases.ts`, and drives the same tool handlers.

`store.ts` holds itineraries, bookings and vouchers in a module-level `Map`, seeded from `data/`. It resets on server restart, and that is intended.

## Mock data schemas

Use ISO 8601 for dates and times, INR for money (integers, in rupees), and IATA codes for airports.

```ts
FlightSchedule (flights.json, daily) { id, airline, flightNo, from, to, departTime "HH:MM",
              durationMin, stops, cabin, fareINR, refundable }
Flight      (schedule materialised for a date; id = "<scheduleId>@YYYY-MM-DD")
            { id, scheduleId, airline, flightNo, from, to, departAt, arriveAt, durationMin, stops,
              cabin: "economy"|"premium"|"business", fareINR, seatsLeft, refundable,
              status: "scheduled"|"delayed"|"cancelled" }
Hotel       { id, name, city, area, stars, rating, pricePerNightINR, amenities: string[],
              roomTypes: { code, name, maxGuests, priceINR, available }[], lat, lng, images: string[] }
Transfer    { id, city, type: "airport_pickup"|"airport_drop"|"intercity",
              vehicle: "sedan"|"suv"|"tempo", priceINR, maxPax }
Sightseeing { id, city, title, durationHrs, priceINR, languages: string[], slots: string[] }
ItineraryItem { kind: "flight"|"hotel"|"transfer"|"sightseeing", refId, date, pax, priceINR, meta? }
Itinerary   { id, travellers: { adults, children }, items: ItineraryItem[], totalINR,
              status: "draft"|"held"|"booked" }
Booking     { id, itineraryId, pnr, leadGuest: { name, phone, email }, paidINR,
              createdAt, vouchers: Voucher[] }
Voucher     { id, bookingId, kind, refId, code, qrText, validFrom, validTo, details }
Disruption  { type: "flight_delay"|"flight_cancel"|"hotel_overbooked"|"weather",
              affectedRefId, severity: "low"|"medium"|"high" }
```

## LLM tools (`src/lib/agent/tools.ts`)

Ten tools. Each is built from a zod schema (`z.toJSONSchema`) into an `Anthropic.Beta.BetaTool` with `strict: true` and `additionalProperties: false`, and every key listed under `required`. Optional fields use `["type","null"]`. Strict schemas can't carry numeric bounds or string formats, so services enforce those. The server prices every itinerary item itself; any `priceINR` sent by the model is ignored. Handlers re-validate their input with zod and return JSON. On failure they return a `tool_result` with `is_error: true`.

| Tool | Input | Returns |
|---|---|---|
| `planTrip` | `origin, destination, departDate, nights, adults, children, budgetINR?` | New itinerary (flights both ways, hotel, airport cabs, sightseeing, fitted to budget/prefs) plus top-3 alternatives |
| `adjustTrip` | `itineraryId, action("cheaper"\|"add_day"\|"remove_day"\|"upgrade_hotel")` | `{ itinerary, deltaINR, changes[] }` |
| `searchFlights` | `from, to, date, returnDate?, adults, cabin?, maxStops?, sortBy?` | `Flight[]` (top 5) |
| `searchHotels` | `city, checkIn, checkOut, guests, minStars?, maxPriceINR?, area?, amenities?` | `Hotel[]` (top 5) |
| `checkAvailability` | `kind, refId, date, pax, roomCode?` | `{ available, priceINR, seatsOrRoomsLeft, holdExpiresAt? }` |
| `updateItinerary` | `itineraryId?, action("add"\|"remove"\|"replace"), item, replaceRefId?, travellers?` | `Itinerary` |
| `bookTrip` | `itineraryId, leadGuest?` | **Prepares** a `PendingAction` (book/amend). Nothing is booked yet. |
| `cancelBooking` | `bookingId` | **Prepares** a cancellation with the refund breakdown |
| `handleDisruption` | `bookingId, disruption` | `{ impact, options[] }`. Each option lists knock-on `changes` (new cab time, hotel check-in) and an `itineraryPatch`. The avatar switches to `concerned`. |
| `applyDisruptionOption` | `bookingId, optionIndex` | **Prepares** the rescue rebooking |

**Confirmation gate (`travel/actions.ts`).** The three "prepare" tools only create a pending action and stream it to the client as a summary card. A booking, payment, cancellation or rebooking runs only when the traveller clicks Confirm ✅, which sends `POST /api/travel {op:"confirm"}`. Edit ✏️ discards the action. Agents must never claim something is done before the traveller confirms.

**Traveller memory (`agent/memory.ts`).** Preferences (window/aisle, veg/jain, 4★+/5★, non-stop, morning/evening, pool, breakfast…) and the budget are pulled from every message in all six languages. The client sends them back on each request, they appear as removable pills, and every recommendation applies them.

## Agent loop (`/api/chat`)

- Model `claude-opus-5-5`, beta Messages API (for `fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) with a manual tool loop that runs inside the route handler. We host the loop ourselves, which follows guardrail 1.
- Stream with `client.messages.stream(...)`. Set `thinking: { type: "adaptive" }`, `output_config: { effort: "medium" }` and `tool_choice: "auto"`. Forced `tool_choice` returns a 400 on this model.
- Loop while `stop_reason === "tool_use"`. Run the tool calls in parallel and send back **all** `tool_result`s in a single user message. Append `response.content` as-is, including thinking blocks. Check `stop_reason === "refusal"` and handle it.
- The client sends text-only history plus `itineraryId`/`bookingId`. The server puts a session-state block (today's date, language, current itinerary) after the cached system prompt, and keeps it constant for the whole request.
- User messages starting with `[disruption:<type>]` are operations alerts. The UI's "simulate disruption" buttons send them.
- System prompt: a warm Indian travel consultant ("Saathi"). Reply in the user's language and script, which the client sends as `lang`. Confirm before booking. Keep replies short enough to speak aloud.
- The stream sends text deltas and an `expression` hint (`thinking` during tool calls, `concerned` on disruptions) to the client.

## Env (`.env.local`, see `.env.example`)

```
ANTHROPIC_API_KEY=            # optional: Live AI with Claude (preferred)
OPENAI_API_KEY=               # optional: fallback Live AI (OPENAI_MODEL, default gpt-4o-mini)
SPEECH_PROVIDER=webspeech     # webspeech | sarvam | bhashini
SARVAM_API_KEY=               # optional
BHASHINI_USER_ID=             # optional
BHASHINI_API_KEY=             # optional
BHASHINI_PIPELINE_ID=         # optional
SARVAM_TTS_MODEL / SARVAM_TTS_SPEAKER   # optional overrides
```

Speech input always uses the browser recogniser. Server TTS covers speech output only, and any failure falls back to `speechSynthesis`.

If `SPEECH_PROVIDER` names a provider whose keys are missing, fall back to `webspeech`.

## Commands

`npm run dev` · `npm run build` · `npm run lint`
