import type { NextRequest } from "next/server";
import { z } from "zod";
import { schemas } from "@/lib/agent/tools";
import { bookingForItinerary } from "@/lib/travel/booking";
import { searchFlights } from "@/lib/travel/flights";
import { searchHotels } from "@/lib/travel/hotels";
import { checkAvailability } from "@/lib/travel/inventory";
import { getItinerary } from "@/lib/travel/itinerary";
import { sightseeing, store, transfers } from "@/lib/travel/store";

/**
 * Read-only REST over the mock inventory for UI widgets.
 *   GET /api/travel?op=flights&from=DEL&to=GOI&date=2026-12-05&adults=2
 *   GET /api/travel?op=hotels&city=Goa&checkIn=...&checkOut=...&guests=2
 *   GET /api/travel?op=availability&kind=hotel&refId=H001&date=...&pax=2&roomCode=STD
 *   GET /api/travel?op=itinerary&id=ITN-XXXX   (includes booking if any)
 *   GET /api/travel?op=extras&city=Goa         (transfers + sightseeing)
 * Mutations (itinerary edits, booking, disruptions) go through the agent tools in /api/chat.
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
