import type { Disruption, DisruptionOption, DisruptionResult, ItineraryItem } from "@/lib/types";
import { getFlight, searchFlights } from "./flights";
import { searchHotels } from "./hotels";
import { addDays, priceItem } from "./inventory";
import { sightseeing, store } from "./store";

export function handleDisruption(bookingId: string, d: Disruption): DisruptionResult {
  const booking = store.bookings.get(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} not found`);
  const it = store.itineraries.get(booking.itineraryId)!;
  const affected =
    it.items.find((i) => i.refId === d.affectedRefId) ??
    it.items.find((i) => i.refId.split("@")[0] === d.affectedRefId.split("@")[0]) ??
    it.items.find((i) => kindFor(d) === i.kind);
  if (!affected) throw new Error(`No ${kindFor(d)} in booking ${bookingId} matches ${d.affectedRefId}`);

  switch (d.type) {
    case "flight_cancel":
    case "flight_delay":
      return flightOptions(bookingId, d, affected);
    case "hotel_overbooked":
      return hotelOptions(bookingId, affected);
    case "weather":
      return weatherOptions(bookingId, d, it.items);
  }
}

function kindFor(d: Disruption): ItineraryItem["kind"] {
  return d.type.startsWith("flight") ? "flight" : d.type === "hotel_overbooked" ? "hotel" : "sightseeing";
}

function flightOptions(bookingId: string, d: Disruption, item: ItineraryItem): DisruptionResult {
  const f = getFlight(item.refId);
  if (!f) throw new Error(`Flight ${item.refId} not found`);
  store.flightStatus.set(f.id, d.type === "flight_cancel" ? "cancelled" : "delayed");
  const delayHrs = d.severity === "high" ? 5 : d.severity === "medium" ? 3 : 1;

  const alternatives = [item.date, addDays(item.date, 1)]
    .flatMap((date) => searchFlights({ from: f.from, to: f.to, date, adults: item.pax, cabin: f.cabin, sortBy: "depart" }))
    .filter((x) => x.scheduleId !== f.scheduleId && x.departAt > f.departAt)
    .slice(0, 3);

  const options: DisruptionOption[] = alternatives.map((alt) => {
    const add = priceItem({ kind: "flight", refId: alt.id, date: alt.departAt.slice(0, 10), pax: item.pax, priceINR: 0 });
    // Airline-caused disruption: fare difference waived when cheaper, capped when dearer.
    const delta = Math.max(0, add.priceINR - item.priceINR);
    return {
      label: `Rebook on ${alt.flightNo} departing ${alt.departAt.slice(11, 16)} on ${alt.departAt.slice(0, 10)}`,
      itineraryPatch: { remove: item.refId, add: { ...add, priceINR: item.priceINR + delta } },
      priceDeltaINR: delta,
    };
  });
  options.sort((a, b) => a.priceDeltaINR - b.priceDeltaINR);
  if (d.type === "flight_delay") {
    options.unshift({ label: `Keep ${f.flightNo} (about ${delayHrs}h late) and shift the airport pickup`, itineraryPatch: { remove: null, add: null }, priceDeltaINR: 0 });
  }
  options.push({ label: `Cancel ${f.flightNo} for a full refund`, itineraryPatch: { remove: item.refId, add: null }, priceDeltaINR: -item.priceINR });

  return {
    bookingId,
    impact:
      d.type === "flight_cancel"
        ? `${f.flightNo} ${f.from}→${f.to} on ${item.date} has been cancelled by the airline.`
        : `${f.flightNo} ${f.from}→${f.to} is delayed by about ${delayHrs} hour(s).`,
    options,
  };
}

function hotelOptions(bookingId: string, item: ItineraryItem): DisruptionResult {
  const city = String(item.meta?.city ?? "");
  const checkOut = String(item.meta?.checkOut ?? addDays(item.date, 1));
  const alts = searchHotels({ city, checkIn: item.date, checkOut, guests: item.pax }).filter((h) => h.id !== item.refId).slice(0, 3);
  return {
    bookingId,
    impact: `${item.meta?.name ?? item.refId} is overbooked for ${item.date}.`,
    options: alts.map((h) => {
      const add = priceItem({ kind: "hotel", refId: h.id, date: item.date, pax: item.pax, priceINR: 0, meta: { roomCode: "STD", checkOut } });
      return {
        label: `Move to ${h.name} (${h.stars}★, ${h.area})`,
        itineraryPatch: { remove: item.refId, add },
        priceDeltaINR: Math.max(0, add.priceINR - item.priceINR),
      };
    }),
  };
}

function weatherOptions(bookingId: string, d: Disruption, items: ItineraryItem[]): DisruptionResult {
  const act = items.find((i) => i.kind === "sightseeing" && (i.refId === d.affectedRefId || !d.affectedRefId));
  if (!act) return { bookingId, impact: "Weather alert, but no outdoor activity is affected.", options: [] };
  const s = sightseeing.find((x) => x.id === act.refId);
  const indoor = sightseeing.find((x) => x.city === s?.city && x.id !== s?.id);
  const options: DisruptionOption[] = [
    { label: `Move "${s?.title}" to ${addDays(act.date, 1)}`, itineraryPatch: { remove: act.refId, add: { ...act, date: addDays(act.date, 1) } }, priceDeltaINR: 0 },
  ];
  if (indoor) {
    const add = priceItem({ kind: "sightseeing", refId: indoor.id, date: act.date, pax: act.pax, priceINR: 0 });
    options.push({ label: `Swap to "${indoor.title}"`, itineraryPatch: { remove: act.refId, add }, priceDeltaINR: add.priceINR - act.priceINR });
  }
  return { bookingId, impact: `Heavy rain forecast in ${s?.city} on ${act.date}.`, options };
}
