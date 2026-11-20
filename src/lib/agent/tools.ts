import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/*
 * One zod schema per tool: it generates the strict JSON Schema sent to Claude
 * and re-validates the input in the handler. Strict tool schemas reject numeric
 * bounds and string formats, so constraints live in descriptions and are
 * enforced by the services instead. Optional fields are `.nullable()`.
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
    })
    .nullable(),
});

export const schemas = {
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
    leadGuest: z.object({ name: z.string(), phone: z.string(), email: z.string() }),
    confirm: z.boolean().describe("true only after the traveller explicitly said yes to the summarised total"),
  }),
  handleDisruption: z.object({
    bookingId: z.string(),
    disruption: z.object({
      type: z.enum(["flight_delay", "flight_cancel", "hotel_overbooked", "weather"]),
      affectedRefId: z.string().describe("refId of the affected itinerary item (empty string if unknown)"),
      severity: z.enum(["low", "medium", "high"]),
    }),
  }),
} as const;

export type ToolName = keyof typeof schemas;
export type ToolInput<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const descriptions: Record<ToolName, string> = {
  searchFlights:
    "Search domestic Indian flights for one date. Returns up to 5 dated flights with fare per person, seats left and ids to use in checkAvailability/updateItinerary. For a round trip call it once per direction.",
  searchHotels:
    "Search hotels in an Indian city for given dates. Returns up to 5 hotels with room types (STD/DLX/FAM), per-night prices and live availability.",
  checkAvailability:
    "Re-check live availability and total price for one flight, hotel room, transfer or activity before adding it or booking.",
  updateItinerary:
    "Add, remove or replace an item in the traveller's itinerary. Creates an itinerary when itineraryId is null. Returns the full itinerary with server-computed prices and total. Also use it to apply a chosen disruption option.",
  bookTrip:
    "Book the itinerary and issue vouchers. Only call after you summarised items and total AND the traveller explicitly confirmed in their latest message. Calling it again on a booked itinerary amends the booking.",
  handleDisruption:
    "Assess a disruption (flight delay/cancellation, hotel overbooking, weather) on a booking and return the impact and re-accommodation options with price differences.",
};

export const tools: Anthropic.Beta.BetaTool[] = (Object.keys(schemas) as ToolName[]).map((name) => {
  const { $schema: _ignored, ...input_schema } = z.toJSONSchema(schemas[name]) as Record<string, unknown>;
  void _ignored;
  return {
    name,
    description: descriptions[name],
    strict: true,
    input_schema: input_schema as Anthropic.Beta.BetaTool.InputSchema,
  };
});
