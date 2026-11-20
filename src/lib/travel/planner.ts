import { prefSearch } from "@/lib/agent/memory";
import type { Flight, Hotel, Itinerary, ItineraryItem, PrefKey } from "@/lib/types";
import { getFlight, searchFlights } from "./flights";
import { searchHotels } from "./hotels";
import { addDays, priceItem } from "./inventory";
import { newId, sightseeing, store, transfers } from "./store";

export const CITY_BY_CODE: Record<string, string> = {
  DEL: "Delhi", BOM: "Mumbai", GOI: "Goa", BLR: "Bengaluru", MAA: "Chennai",
  HYD: "Hyderabad", CCU: "Kolkata", JAI: "Jaipur", COK: "Kochi",
};
export const CODE_BY_CITY = Object.fromEntries(Object.entries(CITY_BY_CODE).map(([c, n]) => [n.toLowerCase(), c]));

export const cityCode = (s: string) => (CITY_BY_CODE[s.toUpperCase()] ? s.toUpperCase() : CODE_BY_CITY[s.toLowerCase()] ?? null);

export interface PlanArgs {
  origin: string;
  destination: string;
  departDate: string;
  nights: number;
  adults: number;
  children: number;
  budgetINR: number | null;
  prefs: PrefKey[];
}

export interface PlanResult {
  itinerary: Itinerary;
  outboundOptions: Flight[];
  returnOptions: Flight[];
  hotelOptions: Hotel[];
  budgetINR: number | null;
  overBudgetINR: number;
}

const hm = (iso: string) => iso.slice(11, 16);
const plusMinutes = (iso: string, min: number) => {
  const d = new Date(Date.parse(iso) + min * 60_000 + 330 * 60_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
};

function rankFlights(list: Flight[], window: "morning" | "evening" | null): Flight[] {
  const hour = (f: Flight) => Number(f.departAt.slice(11, 13));
  const fit = (f: Flight) => (window === "morning" ? hour(f) < 12 : window === "evening" ? hour(f) >= 16 : true);
  return [...list].sort((a, b) => Number(fit(b)) - Number(fit(a)) || a.fareINR - b.fareINR);
}

function searchSide(from: string, to: string, date: string, pax: number, prefs: PrefKey[]): Flight[] {
  const s = prefSearch(prefs);
  let list = searchFlights({ from, to, date, adults: pax, maxStops: s.maxStops, sortBy: "price" });
  if (!list.length && s.maxStops != null) list = searchFlights({ from, to, date, adults: pax, sortBy: "price" });
  return rankFlights(list, s.window);
}

function hotelsFor(city: string, checkIn: string, checkOut: string, guests: number, prefs: PrefKey[]): Hotel[] {
  const s = prefSearch(prefs);
  const q = { city, checkIn, checkOut, guests, minStars: s.minStars, amenities: s.amenities.length ? s.amenities : null };
  let list = searchHotels(q);
  if (!list.length) list = searchHotels({ ...q, amenities: null });
  if (!list.length) list = searchHotels({ ...q, minStars: null, amenities: null });
  return s.budgetStay ? [...list].sort((a, b) => a.pricePerNightINR - b.pricePerNightINR) : list;
}

/** Item for a flight, tagged outbound/return so later edits know which leg it is. */
export function flightItem(f: Flight, pax: number, direction: "outbound" | "return"): ItineraryItem {
  return priceItem({ kind: "flight", refId: f.id, date: f.departAt.slice(0, 10), pax, priceINR: 0, meta: { direction } });
}

export function hotelItem(h: Hotel, checkIn: string, checkOut: string, pax: number, checkInTime = "14:00"): ItineraryItem {
  const room = h.roomTypes.find((r) => r.available > 0 && r.maxGuests >= Math.min(pax, 2)) ?? h.roomTypes[0];
  return priceItem({ kind: "hotel", refId: h.id, date: checkIn, pax, priceINR: 0, meta: { roomCode: room.code, checkOut, checkInTime } });
}

function transferItem(city: string, type: "airport_pickup" | "airport_drop", date: string, time: string, pax: number): ItineraryItem | null {
  const t = transfers
    .filter((x) => x.city === city && x.type === type && x.maxPax >= Math.min(pax, 6))
    .sort((a, b) => a.priceINR - b.priceINR)[0];
  return t ? priceItem({ kind: "transfer", refId: t.id, date, pax, priceINR: 0, meta: { time } }) : null;
}

function activities(city: string, start: string, nights: number, pax: number): ItineraryItem[] {
  const list = sightseeing.filter((s) => s.city === city).sort((a, b) => a.priceINR - b.priceINR);
  const days = Math.max(1, Math.min(nights - 1, 2));
  return list.slice(0, days).map((s, i) => priceItem({ kind: "sightseeing", refId: s.id, date: addDays(start, i + 1), pax, priceINR: 0, meta: { slot: s.slots[0] } }));
}

function makeItinerary(items: ItineraryItem[], adults: number, children: number): Itinerary {
  const it: Itinerary = { id: newId("ITN"), travellers: { adults, children }, items: [], totalINR: 0, status: "draft" };
  setItems(it, items);
  store.itineraries.set(it.id, it);
  return it;
}

export function setItems(it: Itinerary, items: ItineraryItem[]) {
  const order = { flight: 0, transfer: 1, hotel: 2, sightseeing: 3 };
  it.items = items.sort((a, b) => a.date.localeCompare(b.date) || itemTime(a).localeCompare(itemTime(b)) || order[a.kind] - order[b.kind]);
  it.totalINR = it.items.reduce((s, i) => s + i.priceINR, 0);
}

export function itemTime(i: ItineraryItem): string {
  if (i.kind === "flight") return hm(String(i.meta?.departAt ?? "T00:00"));
  if (i.kind === "hotel") return String(i.meta?.checkInTime ?? "14:00");
  return String(i.meta?.time ?? i.meta?.slot ?? "12:00");
}

/** Builds a complete trip: flights both ways, hotel, airport cabs and sightseeing, fitted to the budget. */
export function planTrip(a: PlanArgs): PlanResult {
  const from = cityCode(a.origin);
  const to = cityCode(a.destination);
  if (!from || !to) throw new Error(`We serve ${Object.values(CITY_BY_CODE).join(", ")}. Unknown city: ${!from ? a.origin : a.destination}`);
  if (from === to) throw new Error("Origin and destination are the same city");
  const pax = Math.max(1, a.adults + a.children);
  const nights = Math.min(Math.max(1, a.nights), 14);
  const city = CITY_BY_CODE[to];
  const returnDate = addDays(a.departDate, nights);

  const outboundOptions = searchSide(from, to, a.departDate, pax, a.prefs);
  const returnOptions = searchSide(to, from, returnDate, pax, a.prefs);
  if (!outboundOptions.length) throw new Error(`No seats from ${CITY_BY_CODE[from]} to ${city} on ${a.departDate}`);
  if (!returnOptions.length) throw new Error(`No return seats from ${city} on ${returnDate}`);

  const out = flightItem(outboundOptions[0], pax, "outbound");
  const back = flightItem(returnOptions[0], pax, "return");
  const arrival = plusMinutes(String(out.meta!.arriveAt), 30);
  const pickup = transferItem(city, "airport_pickup", arrival.date, arrival.time, pax);
  const dropAt = plusMinutes(String(back.meta!.departAt), -180);
  const drop = transferItem(city, "airport_drop", dropAt.date, dropAt.time, pax);
  const fun = activities(city, a.departDate, nights, pax);
  const fixed = [out, back, pickup, drop, ...fun].filter((x): x is ItineraryItem => !!x);
  const fixedCost = fixed.reduce((s, i) => s + i.priceINR, 0);

  const hotelOptions = hotelsFor(city, arrival.date, returnDate, pax, a.prefs);
  if (!hotelOptions.length) throw new Error(`No hotel rooms in ${city} for those dates`);
  const checkInTime = arrival.time > "14:00" ? arrival.time : "14:00";
  const priced = hotelOptions.map((h) => hotelItem(h, arrival.date, returnDate, pax, checkInTime));
  // Best-rated hotel that fits the budget; if none fits, drop sightseeing (priciest first), then take the cheapest hotel.
  let pick = 0;
  let extras = [...fun];
  if (a.budgetINR) {
    const base = fixedCost - fun.reduce((s, i) => s + i.priceINR, 0);
    const fitIndex = (extraCost: number) => priced.findIndex((p) => base + extraCost + p.priceINR <= a.budgetINR!);
    let idx = fitIndex(extras.reduce((s, i) => s + i.priceINR, 0));
    while (idx === -1 && extras.length) {
      extras = [...extras].sort((x, y) => x.priceINR - y.priceINR).slice(0, -1);
      idx = fitIndex(extras.reduce((s, i) => s + i.priceINR, 0));
    }
    pick = idx !== -1 ? idx : priced.reduce((m, p, i) => (p.priceINR < priced[m].priceINR ? i : m), 0);
    if (idx === -1) extras = [...fun];
  }
  const core = fixed.filter((i) => i.kind !== "sightseeing");
  const itinerary = makeItinerary([...core, ...extras, priced[pick]], a.adults, a.children);
  return {
    itinerary,
    outboundOptions: outboundOptions.slice(0, 3),
    returnOptions: returnOptions.slice(0, 3),
    hotelOptions: hotelOptions.slice(0, 3),
    budgetINR: a.budgetINR,
    overBudgetINR: a.budgetINR ? Math.max(0, itinerary.totalINR - a.budgetINR) : 0,
  };
}

export type Adjustment = "cheaper" | "add_day" | "remove_day" | "upgrade_hotel";

export interface AdjustResult {
  itinerary: Itinerary;
  deltaINR: number;
  changes: string[];
}

const legs = (it: Itinerary) => {
  const flights = it.items.filter((i) => i.kind === "flight");
  const outbound = flights.find((f) => f.meta?.direction === "outbound") ?? flights[0];
  const ret = flights.find((f) => f.meta?.direction === "return") ?? (flights.length > 1 ? flights[flights.length - 1] : undefined);
  return { outbound, ret, hotel: it.items.find((i) => i.kind === "hotel") };
};

/** Budget edits: cheaper options, +/- one night, or a better hotel. Mutates the itinerary. */
export function adjustTrip(itineraryId: string, action: Adjustment, prefs: PrefKey[]): AdjustResult {
  const it = store.itineraries.get(itineraryId);
  if (!it) throw new Error(`Itinerary ${itineraryId} not found`);
  if (it.status === "cancelled") throw new Error("This trip was cancelled. Plan a new one.");
  const before = it.totalINR;
  const changes: string[] = [];
  const items = [...it.items];
  const replace = (old: ItineraryItem, next: ItineraryItem) => {
    items[items.indexOf(old)] = next;
  };
  const { outbound, ret, hotel } = legs(it);

  if (action === "cheaper") {
    for (const leg of [outbound, ret]) {
      if (!leg) continue;
      const f = getFlight(leg.refId);
      if (!f) continue;
      const cheapest = searchFlights({ from: f.from, to: f.to, date: leg.date, adults: leg.pax, sortBy: "price" })[0];
      if (cheapest && cheapest.fareINR < f.fareINR) {
        replace(leg, flightItem(cheapest, leg.pax, (leg.meta?.direction as "outbound" | "return") ?? "outbound"));
        changes.push(`${f.flightNo} → ${cheapest.flightNo} (save ₹${((f.fareINR - cheapest.fareINR) * leg.pax).toLocaleString("en-IN")})`);
      }
    }
    if (hotel) {
      const checkOut = String(hotel.meta?.checkOut);
      const minStars = Math.max(3, (prefSearch(prefs).minStars ?? 3) - (prefs.includes("stars_5") ? 1 : 0));
      const alt = searchHotels({ city: String(hotel.meta?.city), checkIn: hotel.date, checkOut, guests: hotel.pax, minStars })
        .map((h) => hotelItem(h, hotel.date, checkOut, hotel.pax, String(hotel.meta?.checkInTime ?? "14:00")))
        .filter((h) => h.refId !== hotel.refId && h.priceINR < hotel.priceINR)
        .sort((a, b) => a.priceINR - b.priceINR)[0];
      if (alt) {
        replace(hotel, alt);
        changes.push(`${hotel.meta?.name} → ${alt.meta?.name} (save ₹${(hotel.priceINR - alt.priceINR).toLocaleString("en-IN")})`);
      }
    }
    if (!changes.length) {
      const priciest = items.filter((i) => i.kind === "sightseeing").sort((a, b) => b.priceINR - a.priceINR)[0];
      if (priciest) {
        items.splice(items.indexOf(priciest), 1);
        changes.push(`Dropped ${priciest.meta?.name} (save ₹${priciest.priceINR.toLocaleString("en-IN")})`);
      }
    }
  } else if (action === "add_day" || action === "remove_day") {
    const step = action === "add_day" ? 1 : -1;
    if (!hotel) throw new Error("Add a hotel first so I can change the length of stay");
    const nights = Number(hotel.meta?.nights ?? 1);
    if (step < 0 && nights <= 1) throw new Error("The trip is already one night long");
    const checkOut = addDays(String(hotel.meta?.checkOut), step);
    replace(hotel, priceItem({ ...hotel, meta: { ...hotel.meta, checkOut } }));
    changes.push(`${hotel.meta?.name}: ${nights} → ${nights + step} nights`);
    if (ret) {
      const f = getFlight(ret.refId)!;
      const newDate = addDays(ret.date, step);
      const options = searchFlights({ from: f.from, to: f.to, date: newDate, adults: ret.pax, sortBy: "price" });
      const same = options.find((o) => o.scheduleId === f.scheduleId) ?? options[0];
      if (!same) throw new Error(`No return flight on ${newDate}`);
      const next = flightItem(same, ret.pax, "return");
      replace(ret, next);
      changes.push(`Return flight moved to ${newDate} (${same.flightNo} ${hm(same.departAt)})`);
      const drop = items.find((i) => i.kind === "transfer" && i.meta?.transferType === "airport_drop");
      if (drop) {
        const at = plusMinutes(same.departAt, -180);
        replace(drop, priceItem({ ...drop, date: at.date, meta: { ...drop.meta, time: at.time } }));
      }
    }
    if (step < 0) {
      const lastDay = addDays(String(hotel.meta?.checkOut), -1);
      for (const s of items.filter((i) => i.kind === "sightseeing" && i.date >= lastDay)) items.splice(items.indexOf(s), 1);
    } else {
      const city = String(hotel.meta?.city);
      const used = new Set(items.map((i) => i.refId));
      const extra = sightseeing.find((s) => s.city === city && !used.has(s.id));
      if (extra) {
        items.push(priceItem({ kind: "sightseeing", refId: extra.id, date: addDays(checkOut, -1), pax: hotel.pax, priceINR: 0, meta: { slot: extra.slots[0] } }));
        changes.push(`Added ${extra.title}`);
      }
    }
  } else if (action === "upgrade_hotel" && hotel) {
    const checkOut = String(hotel.meta?.checkOut);
    const better = searchHotels({ city: String(hotel.meta?.city), checkIn: hotel.date, checkOut, guests: hotel.pax, minStars: Number(hotel.meta?.stars ?? 3) })
      .filter((h) => h.id !== hotel.refId && (h.stars > Number(hotel.meta?.stars ?? 0) || h.rating > 4.5))[0];
    if (better) {
      const next = hotelItem(better, hotel.date, checkOut, hotel.pax, String(hotel.meta?.checkInTime ?? "14:00"));
      replace(hotel, next);
      changes.push(`${hotel.meta?.name} → ${better.name} (${better.stars}★, ${better.rating})`);
    }
  }

  setItems(it, items);
  return { itinerary: it, deltaINR: it.totalINR - before, changes };
}
