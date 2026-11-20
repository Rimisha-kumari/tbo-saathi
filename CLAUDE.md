@AGENTS.md

# TBO Saathi — Agentic Multilingual AI Travel Consultant

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · `@anthropic-ai/sdk` · `zod`.
This Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before writing route handlers or config.

## Guardrails (non-negotiable)

1. **One repo, no separate backend.** All server logic lives in App Router route handlers (`/api/chat`, `/api/travel`, `/api/speech`). Mock data is static JSON plus an in-memory store. There is no database.
2. **2D avatar only.** Draw a custom SVG avatar in React and animate it with CSS and `requestAnimationFrame`. No `.vrm`, Three.js, WebGL or binary model assets.
   - Expressions: `idle | listening | thinking | speaking | concerned`.
   - Lip-sync: drive mouth visemes from `SpeechSynthesisUtterance` `boundary` events, with a text-timing fallback. When an audio stream is playing (Sarvam/Bhashini), drive them from `AnalyserNode` amplitude instead.
3. **Zero-key speech by default.** Use the browser Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition` and `speechSynthesis`). Locales: `en-IN`, `hi-IN`, `ta-IN`, `te-IN`, `bn-IN`. Sarvam AI and Bhashini are optional providers that turn on only when their env keys are set. The UI must work with no keys at all.
4. Keep files small and modular. Validate every request body and tool input with zod. Never expose API keys to the client.

## Folder structure

```
src/
  app/
    page.tsx                 # renders <Consultant/>
    api/chat/route.ts        # agent endpoint, streams NDJSON ChatEvents (see types.ts)
    api/travel/route.ts      # read-only REST over mock data (?op=flights|hotels|availability|itinerary|booking|extras)
    api/speech/route.ts      # GET active provider; POST TTS via Sarvam/Bhashini (204 = use browser voice)
  components/
    Consultant.tsx           # main screen: avatar column + chat column
    avatar/                  # Avatar.tsx (SVG + rAF), useLipSync.ts (LipSync class), expressions.ts (poses)
    chat/                    # ChatPanel, MessageBubble, Cards (flights, hotels, itinerary, booking/vouchers, disruption)
    voice/                   # MicButton, LanguagePicker
  lib/
    agent/                   # tools.ts (zod → strict schemas), handlers.ts, prompt.ts, claude.ts (loop), offline.ts (keyless rules agent)
    travel/                  # store.ts, flights.ts, hotels.ts, inventory.ts (pricing/availability), itinerary.ts, booking.ts, disruption.ts
    speech/                  # webSpeech.ts + index.ts (client facade); server/ (provider.ts, sarvam.ts, bhashini.ts)
    client/                  # useChat.ts (NDJSON stream → UI state), i18n.ts (UI strings per locale)
    types.ts                 # shared domain types
  data/                      # flights.json, hotels.json, transfers.json, sightseeing.json (generated mock data)
```

If `ANTHROPIC_API_KEY` is unset, `/api/chat` uses `offline.ts`, a rule-based agent that calls the same tool handlers, so the demo works with zero keys. Its replies are English with a short localised greeting.

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

Each tool is built from a zod schema (`z.toJSONSchema`) into an `Anthropic.Beta.BetaTool` with `strict: true` and `additionalProperties: false`, and every key listed under `required`. Optional fields use `["type","null"]`. Strict schemas can't carry numeric bounds or string formats, so services enforce those. The server prices every itinerary item itself; any `priceINR` sent by the model is ignored. Handlers re-validate their input with zod and return JSON. On failure they return a `tool_result` with `is_error: true`.

| Tool | Input | Returns |
|---|---|---|
| `searchFlights` | `from, to, date, returnDate?, adults, cabin?, maxStops?, sortBy?("price"\|"duration"\|"depart")` | `Flight[]` (top 5) |
| `searchHotels` | `city, checkIn, checkOut, guests, minStars?, maxPriceINR?, area?, amenities?` | `Hotel[]` (top 5) |
| `checkAvailability` | `kind("flight"\|"hotel"\|"transfer"\|"sightseeing"), refId, date, pax, roomCode?` | `{ available, priceINR, seatsOrRoomsLeft, holdExpiresAt? }` |
| `updateItinerary` | `itineraryId?, action("add"\|"remove"\|"replace"), item: ItineraryItem, replaceRefId?` | `Itinerary` (recomputed `totalINR`) |
| `bookTrip` | `itineraryId, leadGuest{name,phone,email}, confirm: boolean` | `Booking` with `Voucher[]`. It refuses unless `confirm === true` **and** the user confirmed explicitly in the chat. |
| `handleDisruption` | `bookingId, disruption: Disruption` | `{ impact, options: { label, itineraryPatch, priceDeltaINR }[] }`. The avatar switches to `concerned`. |

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
ANTHROPIC_API_KEY=            # required for /api/chat
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
