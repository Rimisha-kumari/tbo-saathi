@AGENTS.md

# TBO Saathi — Agentic Multilingual AI Travel Consultant

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · `@anthropic-ai/sdk` · `zod`.
This Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before writing route handlers or config.

## Guardrails (non-negotiable)

1. **One repo, no separate backend.** All server logic lives in App Router route handlers (`/api/chat`, `/api/travel`). Mock data is static JSON plus an in-memory store. There is no database.
2. **2D avatar only.** Draw a custom SVG avatar in React and animate it with CSS and `requestAnimationFrame`. No `.vrm`, Three.js, WebGL or binary model assets.
   - Expressions: `idle | listening | thinking | speaking | concerned`.
   - Lip-sync: drive mouth visemes from `SpeechSynthesisUtterance` `boundary` events, with a text-timing fallback. When an audio stream is playing (Sarvam/Bhashini), drive them from `AnalyserNode` amplitude instead.
3. **Zero-key speech by default.** Use the browser Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition` and `speechSynthesis`). Locales: `en-IN`, `hi-IN`, `ta-IN`, `te-IN`, `bn-IN`. Sarvam AI and Bhashini are optional providers that turn on only when their env keys are set. The UI must work with no keys at all.
4. Keep files small and modular. Validate every request body and tool input with zod. Never expose API keys to the client.

## Folder structure (target — create files as features land)

```
src/
  app/
    page.tsx                 # consultant UI shell
    api/chat/route.ts        # LLM agent loop (Claude + tools), streams to client
    api/travel/route.ts      # REST over mock data (search/avail/book) for UI widgets
  components/
    avatar/                  # Avatar.tsx (SVG), useLipSync.ts, expressions.ts
    chat/                    # ChatPanel, MessageBubble, ItineraryCard, VoucherCard
    voice/                   # MicButton, LanguagePicker
  lib/
    agent/                   # tools.ts (schemas), handlers.ts (tool → service), prompt.ts
    travel/                  # services: flights.ts, hotels.ts, booking.ts, disruption.ts, store.ts
    speech/                  # webSpeech.ts (default), sarvam.ts, bhashini.ts, index.ts (provider select)
    types.ts                 # shared domain types (mirror the schemas below)
  data/                      # flights.json, hotels.json, transfers.json, sightseeing.json
```

`store.ts` holds itineraries, bookings and vouchers in a module-level `Map`, seeded from `data/`. It resets on server restart, and that is intended.

## Mock data schemas

Use ISO 8601 for dates and times, INR for money (integers, in rupees), and IATA codes for airports.

```ts
Flight      { id, airline, flightNo, from, to, departAt, arriveAt, durationMin, stops,
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

Each tool is defined as an `Anthropic.Tool` with `strict: true` and `additionalProperties: false`, and every key listed under `required`. Optional fields use `["type","null"]`. Handlers re-validate their input with zod and return JSON. On failure they return a `tool_result` with `is_error: true`.

| Tool | Input | Returns |
|---|---|---|
| `searchFlights` | `from, to, date, returnDate?, adults, cabin?, maxStops?, sortBy?("price"\|"duration"\|"depart")` | `Flight[]` (top 5) |
| `searchHotels` | `city, checkIn, checkOut, guests, minStars?, maxPriceINR?, area?, amenities?` | `Hotel[]` (top 5) |
| `checkAvailability` | `kind("flight"\|"hotel"\|"transfer"\|"sightseeing"), refId, date, pax, roomCode?` | `{ available, priceINR, seatsOrRoomsLeft, holdExpiresAt? }` |
| `updateItinerary` | `itineraryId?, action("add"\|"remove"\|"replace"), item: ItineraryItem, replaceRefId?` | `Itinerary` (recomputed `totalINR`) |
| `bookTrip` | `itineraryId, leadGuest{name,phone,email}, confirm: boolean` | `Booking` with `Voucher[]`. It refuses unless `confirm === true` **and** the user confirmed explicitly in the chat. |
| `handleDisruption` | `bookingId, disruption: Disruption` | `{ impact, options: { label, itineraryPatch, priceDeltaINR }[] }`. The avatar switches to `concerned`. |

## Agent loop (`/api/chat`)

- Model `claude-opus-5-5`, Messages API with a manual tool loop that runs inside the route handler. We host the loop ourselves, which follows guardrail 1.
- Stream with `client.messages.stream(...)`. Set `thinking: { type: "adaptive" }`, `output_config: { effort: "medium" }` and `tool_choice: "auto"`. Forced `tool_choice` returns a 400 on this model.
- Loop while `stop_reason === "tool_use"`. Run the tool calls in parallel and send back **all** `tool_result`s in a single user message. Append `response.content` as-is, including thinking blocks. Check `stop_reason === "refusal"` and handle it.
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
```

If `SPEECH_PROVIDER` names a provider whose keys are missing, fall back to `webspeech`.

## Commands

`npm run dev` · `npm run build` · `npm run lint`
