import type { Expression, ItineraryItem, PendingAction, PrefKey } from "@/lib/types";
import { prepareBooking, prepareCancel, prepareRebook } from "@/lib/travel/actions";
import { handleDisruption } from "@/lib/travel/disruption";
import { searchFlights } from "@/lib/travel/flights";
import { searchHotels } from "@/lib/travel/hotels";
import { checkAvailability } from "@/lib/travel/inventory";
import { updateItinerary } from "@/lib/travel/itinerary";
import { adjustTrip, planTrip } from "@/lib/travel/planner";
import { prefSearch } from "./memory";
import { schemas, type ToolName } from "./tools";

export interface ToolContext {
  prefs: PrefKey[];
  budgetINR: number | null;
}

export interface ToolOutcome {
  ok: boolean;
  /** Full data for the UI. */
  data: unknown;
  /** What the LLM sees (defaults to data). */
  forModel?: unknown;
  expression?: Expression;
  state?: { itineraryId?: string; bookingId?: string };
  action?: PendingAction;
}

const nullToUndef = <T extends Record<string, unknown>>(m: T | null) =>
  m ? (Object.fromEntries(Object.entries(m).filter(([, v]) => v != null)) as ItineraryItem["meta"]) : undefined;

const gate = (action: PendingAction) => ({
  status: "awaiting_user_confirmation",
  actionId: action.id,
  summary: action.title,
  payableINR: action.payableINR,
  instruction: "Tell the traveller to review the card and click Confirm ✅ (or Edit ✏️). Do not claim it is done.",
});

export function runTool(name: string, rawInput: unknown, ctx: ToolContext): ToolOutcome {
  if (!(name in schemas)) return { ok: false, data: { error: `Unknown tool ${name}` } };
  const parsed = schemas[name as ToolName].safeParse(rawInput);
  if (!parsed.success) return { ok: false, data: { error: "Invalid input", issues: parsed.error.issues } };

  try {
    switch (name as ToolName) {
      case "planTrip": {
        const i = schemas.planTrip.parse(rawInput);
        const r = planTrip({ ...i, budgetINR: i.budgetINR ?? ctx.budgetINR, prefs: ctx.prefs });
        return {
          ok: true,
          data: r,
          forModel: { itinerary: r.itinerary, overBudgetINR: r.overBudgetINR, alternativesShownOnScreen: true },
          state: { itineraryId: r.itinerary.id },
        };
      }
      case "adjustTrip": {
        const i = schemas.adjustTrip.parse(rawInput);
        const r = adjustTrip(i.itineraryId, i.action, ctx.prefs);
        return { ok: true, data: r, state: { itineraryId: r.itinerary.id } };
      }
      case "searchFlights": {
        const i = schemas.searchFlights.parse(rawInput);
        const q = { ...i, maxStops: i.maxStops ?? prefSearch(ctx.prefs).maxStops };
        const outbound = searchFlights(q);
        const inbound = i.returnDate ? searchFlights({ ...q, from: i.to, to: i.from, date: i.returnDate }) : null;
        return { ok: true, data: inbound ? { outbound, inbound } : outbound };
      }
      case "searchHotels": {
        const i = schemas.searchHotels.parse(rawInput);
        return { ok: true, data: searchHotels({ ...i, minStars: i.minStars ?? prefSearch(ctx.prefs).minStars }) };
      }
      case "checkAvailability":
        return { ok: true, data: checkAvailability(schemas.checkAvailability.parse(rawInput)) };
      case "updateItinerary": {
        const i = schemas.updateItinerary.parse(rawInput);
        const it = updateItinerary({ ...i, item: { ...i.item, priceINR: 0, meta: nullToUndef(i.item.meta) } });
        return { ok: true, data: it, state: { itineraryId: it.id } };
      }
      case "bookTrip": {
        const i = schemas.bookTrip.parse(rawInput);
        const action = prepareBooking(i.itineraryId, i.leadGuest);
        return { ok: true, data: action, forModel: gate(action), action };
      }
      case "cancelBooking": {
        const action = prepareCancel(schemas.cancelBooking.parse(rawInput).bookingId);
        return { ok: true, data: action, forModel: gate(action), action, expression: "concerned" };
      }
      case "handleDisruption": {
        const i = schemas.handleDisruption.parse(rawInput);
        return { ok: true, data: handleDisruption(i.bookingId, i.disruption), expression: "concerned" };
      }
      case "applyDisruptionOption": {
        const i = schemas.applyDisruptionOption.parse(rawInput);
        const action = prepareRebook(i.bookingId, i.optionIndex);
        return { ok: true, data: action, forModel: gate(action), action, expression: "concerned" };
      }
    }
  } catch (e) {
    return { ok: false, data: { error: e instanceof Error ? e.message : String(e) } };
  }
}
