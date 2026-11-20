import type { NextRequest } from "next/server";
import { z } from "zod";
import { schemas } from "@/lib/agent/tools";
import { confirmAction, discardAction, prepareCancel, prepareRebook } from "@/lib/travel/actions";
import { bookingForItinerary } from "@/lib/travel/booking";
import { searchFlights } from "@/lib/travel/flights";
import { searchHotels } from "@/lib/travel/hotels";
import { checkAvailability } from "@/lib/travel/inventory";
import { getItinerary } from "@/lib/travel/itinerary";
import { sightseeing, store, transfers } from "@/lib/travel/store";
import { weatherFor } from "@/lib/travel/weather";

/**
 * Read-only REST over the mock inventory for UI widgets.
 *   GET /api/travel?op=flights&from=DEL&to=GOI&date=2026-12-05&adults=2
 *   GET /api/travel?op=hotels&city=Goa&checkIn=...&checkOut=...&guests=2
 *   GET /api/travel?op=availability&kind=hotel&refId=H001&date=...&pax=2&roomCode=STD
 *   GET /api/travel?op=itinerary&id=ITN-XXXX   (includes booking if any)
 *   GET /api/travel?op=extras&city=Goa         (transfers + sightseeing)
 *   GET /api/travel?op=bookings&ids=BKG-1,BKG-2
 *   GET /api/travel?op=weather&city=Goa&date=2026-12-05
 * POST is the confirmation gate (see lib/travel/actions.ts):
 *   {op:"confirm", actionId, leadGuest?} · {op:"discard", actionId}
 *   {op:"prepareCancel", bookingId} · {op:"prepareRebook", bookingId, optionIndex}
 */
const num = z.coerce.number();

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const n = (v: string | undefined) => (v == null || v === "" ? null : v);
  try {
    switch (q.op) {
      case "flights": {
        const i = schemas.searchFlights.parse({
          from: q.from, to: q.to, date: q.date, returnDate: n(q.returnDate),
          adults: num.parse(q.adults ?? 1), cabin: n(q.cabin), maxStops: q.maxStops ? num.parse(q.maxStops) : null,
          sortBy: n(q.sortBy),
        });
        return Response.json(searchFlights(i));
      }
      case "hotels": {
        const i = schemas.searchHotels.parse({
          city: q.city, checkIn: q.checkIn, checkOut: q.checkOut, guests: num.parse(q.guests ?? 1),
          minStars: q.minStars ? num.parse(q.minStars) : null, maxPriceINR: q.maxPriceINR ? num.parse(q.maxPriceINR) : null,
          area: n(q.area), amenities: q.amenities ? q.amenities.split(",") : null,
        });
        return Response.json(searchHotels(i));
      }
      case "availability": {
        const i = schemas.checkAvailability.parse({
          kind: q.kind, refId: q.refId, date: q.date, pax: num.parse(q.pax ?? 1), roomCode: n(q.roomCode),
        });
        return Response.json(checkAvailability(i));
      }
      case "itinerary": {
        const it = getItinerary(z.string().parse(q.id));
        if (!it) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json({ itinerary: it, booking: bookingForItinerary(it.id) });
      }
      case "booking": {
        const b = store.bookings.get(z.string().parse(q.id));
        return b ? Response.json(b) : Response.json({ error: "Not found" }, { status: 404 });
      }
      case "bookings": {
        const ids = z.string().max(400).parse(q.ids ?? "").split(",").filter(Boolean);
        return Response.json(ids.map((id) => store.bookings.get(id)).filter(Boolean));
      }
      case "weather":
        return Response.json(weatherFor(z.string().parse(q.city), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(q.date)));
      case "extras": {
        const city = z.string().parse(q.city).toLowerCase();
        return Response.json({
          transfers: transfers.filter((t) => t.city.toLowerCase() === city),
          sightseeing: sightseeing.filter((s) => s.city.toLowerCase() === city),
        });
      }
      default:
        return Response.json({ error: "Unknown op" }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof z.ZodError ? "Invalid query" : e instanceof Error ? e.message : String(e);
    return Response.json({ error: message, issues: e instanceof z.ZodError ? e.issues : undefined }, { status: 400 });
  }
}

const leadGuestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().max(120),
});

const postSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("confirm"), actionId: z.string().max(32), leadGuest: leadGuestSchema.nullable().default(null) }),
  z.object({ op: z.literal("discard"), actionId: z.string().max(32) }),
  z.object({ op: z.literal("prepareCancel"), bookingId: z.string().max(32) }),
  z.object({ op: z.literal("prepareRebook"), bookingId: z.string().max(32), optionIndex: z.number().int().min(0).max(10) }),
]);

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  try {
    switch (b.op) {
      case "confirm":
        return Response.json(confirmAction(b.actionId, b.leadGuest));
      case "discard":
        discardAction(b.actionId);
        return Response.json({ ok: true });
      case "prepareCancel":
        return Response.json({ action: prepareCancel(b.bookingId) });
      case "prepareRebook":
        return Response.json({ action: prepareRebook(b.bookingId, b.optionIndex) });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
  }
}
