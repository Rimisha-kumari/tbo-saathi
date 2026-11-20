import type { Disruption, DisruptionOption, DisruptionResult, ItineraryItem } from "@/lib/types";
import { getFlight, searchFlights } from "./flights";
import { searchHotels } from "./hotels";
import { addDays, priceItem } from "./inventory";
import { flightItem, hotelItem } from "./planner";
import { sightseeing, store } from "./store";
import { isWet, weatherFor } from "./weather";

const hm = (iso: string) => iso.slice(11, 16);
const shift = (iso: string, min: number) => {
  const d = new Date(Date.parse(iso) + (min + 330) * 60_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), iso: d.toISOString().slice(0, 19) + "+05:30" };
};
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function handleDisruption(bookingId: string, d: Disruption): DisruptionResult {
  const booking = store.bookings.get(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} not found`);
  if (booking.status === "cancelled") throw new Error("That booking is cancelled");
  const it = store.itineraries.get(booking.itineraryId)!;
  const kind = d.type.startsWith("flight") ? "flight" : d.type === "hotel_overbooked" ? "hotel" : "sightseeing";
  const affected =
    it.items.find((i) => i.refId === d.affectedRefId) ??
    it.items.find((i) => d.affectedRefId && i.refId.split("@")[0] === d.affectedRefId.split("@")[0]) ??
    it.items.find((i) => i.kind === kind && (kind !== "flight" || i.meta?.direction !== "return")) ??
    it.items.find((i) => i.kind === kind);
  if (!affected && d.type !== "weather") throw new Error(`No ${kind} in booking ${bookingId}`);

  const result =
    d.type === "flight_cancel" || d.type === "flight_delay"
      ? flightRescue(bookingId, d, affected!, it.items)
      : d.type === "hotel_overbooked"
        ? hotelRescue(bookingId, affected!, it.items)
        : weatherRescue(bookingId, it.items);
  store.disruptions.set(bookingId, result);
  return result;
}

/** Knock-on changes when a flight's arrival or departure moves. */
function knockOn(items: ItineraryItem[], leg: ItineraryItem, newDepart: string, newArrive: string) {
  const upsert: ItineraryItem[] = [];
  const changes: string[] = [];
  const outbound = leg.meta?.direction !== "return";
  if (outbound) {
    const pickup = items.find((i) => i.kind === "transfer" && i.meta?.transferType === "airport_pickup");
    const at = shift(newArrive, 30);
    if (pickup) {
      upsert.push(priceItem({ ...pickup, date: at.date, meta: { ...pickup.meta, time: at.time } }));
      changes.push(`🚖 Airport cab moved ${pickup.meta?.time ?? ""} → ${at.time}${at.date !== pickup.date ? ` on ${at.date}` : ""}`);
    }
    const hotel = items.find((i) => i.kind === "hotel");
    if (hotel) {
      const checkInTime = shift(newArrive, 75).time;
      const lateDay = at.date > hotel.date ? at.date : hotel.date;
      const lockedPriceINR = hotel.priceINR; // hotel keeps the original rate
      upsert.push(priceItem({ ...hotel, date: lateDay, meta: { ...hotel.meta, checkInTime: checkInTime > "14:00" || lateDay !== hotel.date ? checkInTime : "14:00", lockedPriceINR } }));
      changes.push(
        lateDay !== hotel.date
          ? `🏨 ${hotel.meta?.name}: check-in moved to ${lateDay} ${checkInTime} (first night protected, no charge)`
          : `🏨 ${hotel.meta?.name}: late check-in ${checkInTime} informed to hotel`,
      );
    }
  } else {
    const drop = items.find((i) => i.kind === "transfer" && i.meta?.transferType === "airport_drop");
    const at = shift(newDepart, -180);
    if (drop) {
      upsert.push(priceItem({ ...drop, date: at.date, meta: { ...drop.meta, time: at.time } }));
      changes.push(`🚖 Airport drop moved ${drop.meta?.time ?? ""} → ${at.time}${at.date !== drop.date ? ` on ${at.date}` : ""}`);
    }
    const hotel = items.find((i) => i.kind === "hotel");
    if (hotel && newDepart.slice(0, 10) > String(hotel.meta?.checkOut)) {
      const checkOut = newDepart.slice(0, 10);
      upsert.push(priceItem({ ...hotel, meta: { ...hotel.meta, checkOut, lockedPriceINR: hotel.priceINR } }));
      changes.push(`🏨 Extra night at ${hotel.meta?.name} until ${checkOut} (covered by airline)`);
    }
  }
  return { upsert, changes };
}

function flightRescue(bookingId: string, d: Disruption, leg: ItineraryItem, items: ItineraryItem[]): DisruptionResult {
  const f = getFlight(leg.refId);
  if (!f) throw new Error(`Flight ${leg.refId} not found`);
  const cancelled = d.type === "flight_cancel";
  store.flightStatus.set(f.id, cancelled ? "cancelled" : "delayed");
  const delayMin = d.severity === "high" ? 300 : d.severity === "medium" ? 180 : 60;
  const direction = (leg.meta?.direction as "outbound" | "return") ?? "outbound";
  const options: DisruptionOption[] = [];

  if (!cancelled) {
    const dep = shift(f.departAt, delayMin).iso;
    const arr = shift(f.arriveAt, delayMin).iso;
    const k = knockOn(items, leg, dep, arr);
    options.push({
      label: `Stay on ${f.flightNo}, now departing ${hm(dep)} (${Math.round(delayMin / 60)}h late)`,
      changes: [`✈️ ${f.flightNo} new time ${hm(dep)} → arrives ${hm(arr)}`, ...k.changes],
      itineraryPatch: { remove: [], upsert: [priceItem({ ...leg, meta: { ...leg.meta, departAt: dep, arriveAt: arr, delayedMin: delayMin } }), ...k.upsert].map(keepDelay(dep, arr)) },
      priceDeltaINR: 0,
    });
  }

  const alts = [leg.date, addDays(leg.date, 1)]
    .flatMap((date) => searchFlights({ from: f.from, to: f.to, date, adults: leg.pax, sortBy: "depart" }))
    .filter((x) => x.scheduleId !== f.scheduleId && x.departAt > f.departAt)
    .sort((a, b) => a.departAt.localeCompare(b.departAt))
    .slice(0, 3);
  for (const alt of alts) {
    // Airline-caused disruption: TBO rebooks with the fare difference waived.
    const next = flightItem(alt, leg.pax, direction);
    next.meta = { ...next.meta, lockedPriceINR: leg.priceINR };
    next.priceINR = leg.priceINR;
    const k = knockOn(items, leg, alt.departAt, alt.arriveAt);
    options.push({
      label: `Rebook on ${alt.airline} ${alt.flightNo} · ${alt.departAt.slice(0, 10)} ${hm(alt.departAt)} → ${hm(alt.arriveAt)}`,
      changes: [`✈️ ${f.flightNo} → ${alt.flightNo} (fare difference waived)`, ...k.changes],
      itineraryPatch: { remove: [leg.refId], upsert: [next, ...k.upsert] },
      priceDeltaINR: 0,
    });
  }
  options.push({
    label: `Cancel ${f.flightNo} for a full refund`,
    changes: [`💸 Refund ${rupees(leg.priceINR)} to original payment method`],
    itineraryPatch: { remove: [leg.refId], upsert: [] },
    priceDeltaINR: -leg.priceINR,
  });

  return {
    bookingId,
    type: d.type,
    impact: cancelled
      ? `${f.airline} ${f.flightNo} ${f.from}→${f.to} on ${leg.date} has been cancelled by the airline.`
      : `${f.airline} ${f.flightNo} ${f.from}→${f.to} is delayed by about ${Math.round(delayMin / 60)} hour(s).`,
    options,
  };
}

/** Delayed flights keep their id; pin the new times so priceItem doesn't reset them. */
const keepDelay = (dep: string, arr: string) => (i: ItineraryItem) =>
  i.kind === "flight" ? { ...i, meta: { ...i.meta, departAt: dep, arriveAt: arr } } : i;

function hotelRescue(bookingId: string, hotel: ItineraryItem, items: ItineraryItem[]): DisruptionResult {
  const city = String(hotel.meta?.city ?? "");
  const checkOut = String(hotel.meta?.checkOut ?? addDays(hotel.date, 1));
  const stars = Number(hotel.meta?.stars ?? 3);
  const alts = searchHotels({ city, checkIn: hotel.date, checkOut, guests: hotel.pax, minStars: stars })
    .filter((h) => h.id !== hotel.refId)
    .slice(0, 3);
  const drop = items.find((i) => i.kind === "transfer" && i.meta?.transferType === "airport_pickup");
  return {
    bookingId,
    type: "hotel_overbooked",
    impact: `${hotel.meta?.name ?? hotel.refId} is overbooked for ${hotel.date}.`,
    options: alts.map((h) => {
      const next = hotelItem(h, hotel.date, checkOut, hotel.pax, String(hotel.meta?.checkInTime ?? "14:00"));
      next.meta = { ...next.meta, lockedPriceINR: hotel.priceINR };
      next.priceINR = hotel.priceINR;
      return {
        label: `Move to ${h.name} (${h.stars}★, rated ${h.rating}, ${h.area}) at the same price`,
        changes: [`🏨 ${hotel.meta?.name} → ${h.name}`, ...(drop ? [`🚖 Airport cab drop-off address updated to ${h.area}`] : [])],
        itineraryPatch: { remove: [hotel.refId], upsert: [next] },
        priceDeltaINR: 0,
      };
    }),
  };
}

function weatherRescue(bookingId: string, items: ItineraryItem[]): DisruptionResult {
  const acts = items.filter((i) => i.kind === "sightseeing");
  const act = acts.find((i) => isWet(weatherFor(String(i.meta?.city), i.date))) ?? acts[0];
  if (!act) return { bookingId, type: "weather", impact: "Weather alert, but no outdoor activity is affected.", options: [] };
  const s = sightseeing.find((x) => x.id === act.refId);
  const next = addDays(act.date, 1);
  const options: DisruptionOption[] = [
    {
      label: `Move "${s?.title}" to ${next}`,
      changes: [`📍 ${s?.title}: ${act.date} → ${next} (${weatherFor(String(s?.city), next).condition} forecast)`],
      itineraryPatch: { remove: [act.refId], upsert: [{ ...act, date: next }] },
      priceDeltaINR: 0,
    },
  ];
  const swap = sightseeing.find((x) => x.city === s?.city && x.id !== s?.id && !items.some((i) => i.refId === x.id));
  if (swap) {
    const add = priceItem({ kind: "sightseeing", refId: swap.id, date: act.date, pax: act.pax, priceINR: 0 });
    options.push({
      label: `Swap to "${swap.title}"`,
      changes: [`📍 ${s?.title} → ${swap.title}`],
      itineraryPatch: { remove: [act.refId], upsert: [add] },
      priceDeltaINR: add.priceINR - act.priceINR,
    });
  }
  return { bookingId, type: "weather", impact: `Heavy rain forecast in ${s?.city} on ${act.date}.`, options };
}
