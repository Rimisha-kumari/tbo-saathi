import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/*
 * One zod schema per tool: it generates the strict JSON Schema sent to the LLM
 * (Claude or OpenAI) and re-validates the input in the handler. Strict tool
 * schemas reject numeric bounds and string formats, so constraints live in
 * descriptions and are enforced by the services. Optional fields are `.nullable()`.
 */

const date = z.string().describe("ISO date YYYY-MM-DD");
const kind = z.enum(["flight", "hotel", "transfer", "sightseeing"]);

const itemSchema = z.object({
  kind,
  refId: z.string().describe("Id from a search result: dated flight id (e.g. 6E101-e@2026-12-05), hotel H###, transfer T###, activity S###"),
  date: date.describe("Travel / check-in / activity date YYYY-MM-DD"),
  pax: z.number().describe("Number of travellers for this item"),
  priceINR: z.number().nullable().describe("Ignored; the server prices every item"),
  meta: z
    .object({
      roomCode: z.string().nullable().describe("Hotel room code: STD, DLX or FAM"),
      checkOut: z.string().nullable().describe("Hotel check-out date YYYY-MM-DD"),
      slot: z.string().nullable().describe("Activity start time HH:MM"),
      time: z.string().nullable().describe("Transfer pickup time HH:MM"),
    })
    .nullable(),
});

const leadGuest = z.object({ name: z.string(), phone: z.string(), email: z.string() });

export const schemas = {
  planTrip: z.object({
    origin: z.string().describe("Origin city name or IATA code, e.g. Delhi or DEL"),
    destination: z.string().describe("Destination city name or IATA code"),
    departDate: date,
    nights: z.number().describe("Number of nights (1-14)"),
    adults: z.number(),
    children: z.number(),
    budgetINR: z.number().nullable().describe("Total trip budget in INR if the traveller gave one, else null (session budget is used)"),
  }),
  adjustTrip: z.object({
    itineraryId: z.string(),
    action: z.enum(["cheaper", "add_day", "remove_day", "upgrade_hotel"]),
  }),
  searchFlights: z.object({
    from: z.string().describe("Origin IATA code, e.g. DEL"),
    to: z.string().describe("Destination IATA code, e.g. GOI"),
    date,
    returnDate: date.nullable().describe("Return date for a round trip, else null"),
    adults: z.number().describe("Number of passengers (1-9)"),
    cabin: z.enum(["economy", "premium", "business"]).nullable(),
    maxStops: z.number().nullable(),
    sortBy: z.enum(["price", "duration", "depart"]).nullable(),
  }),
  searchHotels: z.object({
    city: z.string().describe("City name in English, e.g. Goa"),
    checkIn: date,
    checkOut: date,
    guests: z.number(),
    minStars: z.number().nullable(),
    maxPriceINR: z.number().nullable().describe("Max price per night in INR"),
    area: z.string().nullable(),
    amenities: z
      .array(z.enum(["wifi", "breakfast", "pool", "spa", "gym", "airport_shuttle", "parking", "veg_kitchen", "family_rooms"]))
      .nullable(),
  }),
  checkAvailability: z.object({
    kind,
    refId: z.string(),
    date,
    pax: z.number(),
    roomCode: z.string().nullable(),
  }),
  updateItinerary: z.object({
    itineraryId: z.string().nullable().describe("Current itinerary id, or null to start a new one"),
    action: z.enum(["add", "remove", "replace"]),
    item: itemSchema,
    replaceRefId: z.string().nullable().describe("For replace: refId of the item being swapped out"),
    travellers: z.object({ adults: z.number(), children: z.number() }).nullable(),
  }),
  bookTrip: z.object({
    itineraryId: z.string(),
    leadGuest: leadGuest.nullable().describe("Lead guest if the traveller gave details; null lets them fill it on the confirmation card"),
  }),
  cancelBooking: z.object({ bookingId: z.string() }),
  handleDisruption: z.object({
    bookingId: z.string(),
    disruption: z.object({
      type: z.enum(["flight_delay", "flight_cancel", "hotel_overbooked", "weather"]),
      affectedRefId: z.string().describe("refId of the affected itinerary item (empty string if unknown)"),
      severity: z.enum(["low", "medium", "high"]),
    }),
  }),
  applyDisruptionOption: z.object({
    bookingId: z.string(),
    optionIndex: z.number().describe("0-based index into the options returned by handleDisruption"),
  }),
} as const;

export type ToolName = keyof typeof schemas;
export type ToolInput<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const descriptions: Record<ToolName, string> = {
  planTrip:
    "Build a complete trip in one call: cheapest suitable flights both ways, a hotel that fits the budget and the traveller's remembered preferences, airport pickup/drop cabs and sightseeing. Returns the new itinerary plus top-3 alternatives for side-by-side comparison. Prefer this whenever the traveller wants a trip planned.",
  adjustTrip:
    "Edit an existing itinerary: 'cheaper' swaps to cheaper flights/hotel, 'add_day'/'remove_day' changes the stay by one night (moves the return flight and cab), 'upgrade_hotel' picks a better hotel. Returns the itinerary, price change and a list of changes.",
  searchFlights:
    "Search domestic Indian flights for one date. Returns up to 5 dated flights with fare per person, seats left and ids to use in checkAvailability/updateItinerary. For a round trip set returnDate.",
  searchHotels:
    "Search hotels in an Indian city for given dates. Returns up to 5 hotels with room types (STD/DLX/FAM), per-night prices and live availability.",
  checkAvailability:
    "Re-check live availability and total price for one flight, hotel room, transfer or activity.",
  updateItinerary:
    "Add, remove or replace one item in the traveller's itinerary. Creates an itinerary when itineraryId is null. Returns the full itinerary with server-computed prices and total.",
  bookTrip:
    "PREPARE a booking (or an update to an existing booking) for the traveller to confirm. It does not book: it shows a summary card with Confirm ✅ / Edit ✏️ buttons and the booking happens only when the traveller clicks Confirm.",
  cancelBooking:
    "PREPARE a cancellation with the refund breakdown. Nothing is cancelled until the traveller clicks Confirm on the card.",
  handleDisruption:
    "Assess a disruption (flight delay/cancellation, hotel overbooking, weather) on a booking. Returns the impact and rescue options; each option lists knock-on changes such as new airport-cab time and hotel check-in.",
  applyDisruptionOption:
    "PREPARE the chosen rescue option from handleDisruption for confirmation. The traveller must click Confirm on the card to apply it and reissue vouchers.",
};

const jsonSchema = (name: ToolName) => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(schemas[name]) as Record<string, unknown>;
  void _ignored;
  return schema;
};

export const tools: Anthropic.Beta.BetaTool[] = (Object.keys(schemas) as ToolName[]).map((name) => ({
  name,
  description: descriptions[name],
  strict: true,
  input_schema: jsonSchema(name) as Anthropic.Beta.BetaTool.InputSchema,
}));

/** Same tools in OpenAI Chat Completions function format (used only as a fallback provider). */
export const openAiTools = (Object.keys(schemas) as ToolName[]).map((name) => ({
  type: "function" as const,
  function: { name, description: descriptions[name], parameters: jsonSchema(name), strict: true },
}));
