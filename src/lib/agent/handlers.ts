import type { Expression, ItineraryItem } from "@/lib/types";
import { bookTrip } from "@/lib/travel/booking";
import { handleDisruption } from "@/lib/travel/disruption";
import { searchFlights } from "@/lib/travel/flights";
import { searchHotels } from "@/lib/travel/hotels";
import { checkAvailability } from "@/lib/travel/inventory";
import { updateItinerary } from "@/lib/travel/itinerary";
import { schemas, type ToolName } from "./tools";

export interface ToolContext {
  /** Latest user utterance — bookTrip requires an explicit yes in it. */
  lastUserText: string;
}

export interface ToolOutcome {
  ok: boolean;
  data: unknown;
  /** Expression hint for the avatar after this tool. */
  expression?: Expression;
  state?: { itineraryId?: string; bookingId?: string };
}

// Yes / confirm in English, Hindi, Tamil, Telugu, Bengali (native + romanised).
const CONFIRM =
  /\b(yes|yeah|yep|confirm(ed)?|book it|go ahead|proceed|ok(ay)?|sure|haan|haa|ji|theek|aamaa|avunu|hyan|haan ji)\b|हाँ|हां|जी|ठीक|कन्फर्म|ஆம்|சரி|உறுதி|అవును|సరే|నిర్ధారించు|হ্যাঁ|ঠিক আছে|নিশ্চিত/i;

const DECLINE = /\b(no|nope|nahi|nahin|don'?t|wait|stop)\b|नहीं|मत|இல்லை|வேண்டாம்|కాదు|వద్దు|না\b/i;

export function userConfirmed(text: string): boolean {
  return CONFIRM.test(text) && !DECLINE.test(text);
}

const nullToUndef = <T extends Record<string, unknown>>(m: T | null) =>
  m ? (Object.fromEntries(Object.entries(m).filter(([, v]) => v != null)) as ItineraryItem["meta"]) : undefined;

export function runTool(name: string, rawInput: unknown, ctx: ToolContext): ToolOutcome {
  if (!(name in schemas)) return { ok: false, data: { error: `Unknown tool ${name}` } };
  const parsed = schemas[name as ToolName].safeParse(rawInput);
  if (!parsed.success) return { ok: false, data: { error: "Invalid input", issues: parsed.error.issues } };

  try {
    switch (name as ToolName) {
      case "searchFlights": {
        const i = schemas.searchFlights.parse(rawInput);
        const outbound = searchFlights(i);
        const inbound = i.returnDate ? searchFlights({ ...i, from: i.to, to: i.from, date: i.returnDate }) : null;
        return { ok: true, data: inbound ? { outbound, inbound } : outbound };
      }
      case "searchHotels":
        return { ok: true, data: searchHotels(schemas.searchHotels.parse(rawInput)) };
      case "checkAvailability":
        return { ok: true, data: checkAvailability(schemas.checkAvailability.parse(rawInput)) };
      case "updateItinerary": {
        const i = schemas.updateItinerary.parse(rawInput);
        const it = updateItinerary({
          ...i,
          item: { ...i.item, priceINR: 0, meta: nullToUndef(i.item.meta) },
        });
        return { ok: true, data: it, state: { itineraryId: it.id } };
      }
      case "bookTrip": {
        const i = schemas.bookTrip.parse(rawInput);
        const b = bookTrip(i, userConfirmed(ctx.lastUserText));
        return { ok: true, data: b, state: { itineraryId: i.itineraryId, bookingId: b.id } };
      }
      case "handleDisruption": {
        const i = schemas.handleDisruption.parse(rawInput);
        return { ok: true, data: handleDisruption(i.bookingId, i.disruption), expression: "concerned" };
      }
    }
  } catch (e) {
    return { ok: false, data: { error: e instanceof Error ? e.message : String(e) } };
  }
}
