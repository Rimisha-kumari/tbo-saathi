import type { Availability, ItemKind, ItineraryItem } from "@/lib/types";
import { getFlight } from "./flights";
import { getHotel, hotelForDate } from "./hotels";
import { nights, sightseeing, transfers } from "./store";

/** Inventory key used by store.consumed for one unit of an item on a date. */
export function inventoryKey(item: Pick<ItineraryItem, "kind" | "refId" | "date" | "meta">): string {
  if (item.kind === "hotel") return `${item.refId}:${item.meta?.roomCode ?? "STD"}|${item.date}`;
  return `${normaliseFlightId(item)}|${item.date}`;
}

function normaliseFlightId(item: Pick<ItineraryItem, "kind" | "refId" | "date">): string {
  if (item.kind !== "flight" || item.refId.includes("@")) return item.refId;
  return `${item.refId}@${item.date}`;
}

/** Units of inventory an item needs (seats, rooms, vehicles). */
export function unitsNeeded(item: ItineraryItem): number {
  if (item.kind === "hotel") {
    const h = getHotel(item.refId);
    const room = h?.roomTypes.find((r) => r.code === (item.meta?.roomCode ?? "STD"));
    return Math.ceil(item.pax / (room?.maxGuests ?? 2));
  }
  if (item.kind === "transfer") {
    const t = transfers.find((x) => x.id === item.refId);
    return Math.ceil(item.pax / (t?.maxPax ?? 3));
  }
  if (item.kind === "flight") return item.pax;
  return 0; // sightseeing is unlimited in the mock
}

/** Server-side price: never trust a price coming from the model. */
export function priceItem(item: ItineraryItem): ItineraryItem {
  const out: ItineraryItem = { ...item, refId: normaliseFlightId(item) };
  switch (item.kind) {
    case "flight": {
      const f = getFlight(out.refId);
      if (!f) throw new Error(`Unknown flight ${item.refId}`);
      out.priceINR = f.fareINR * item.pax;
      out.meta = { ...item.meta, flightNo: f.flightNo, route: `${f.from}→${f.to}`, departAt: f.departAt };
      break;
    }
    case "hotel": {
      const h = getHotel(item.refId);
      if (!h) throw new Error(`Unknown hotel ${item.refId}`);
      const roomCode = String(item.meta?.roomCode ?? "STD");
      const room = h.roomTypes.find((r) => r.code === roomCode) ?? h.roomTypes[0];
      const checkOut = String(item.meta?.checkOut ?? addDays(item.date, 1));
      const n = nights(item.date, checkOut);
      out.priceINR = room.priceINR * n * Math.ceil(item.pax / room.maxGuests);
      out.meta = { ...item.meta, roomCode: room.code, checkOut, nights: n, name: h.name, city: h.city };
      break;
    }
    case "transfer": {
      const t = transfers.find((x) => x.id === item.refId);
      if (!t) throw new Error(`Unknown transfer ${item.refId}`);
      out.priceINR = t.priceINR * Math.ceil(item.pax / t.maxPax);
      out.meta = { ...item.meta, name: `${t.city} ${t.type.replace("_", " ")} (${t.vehicle})` };
      break;
    }
    case "sightseeing": {
      const s = sightseeing.find((x) => x.id === item.refId);
      if (!s) throw new Error(`Unknown activity ${item.refId}`);
      out.priceINR = s.priceINR * item.pax;
      out.meta = { ...item.meta, name: s.title, slot: item.meta?.slot ?? s.slots[0] };
      break;
    }
  }
  return out;
}

export function checkAvailability(args: {
  kind: ItemKind;
  refId: string;
  date: string;
  pax: number;
  roomCode?: string | null;
}): Availability {
  const item: ItineraryItem = {
    kind: args.kind,
    refId: args.refId,
    date: args.date,
    pax: args.pax,
    priceINR: 0,
    meta: args.roomCode ? { roomCode: args.roomCode } : undefined,
  };
  const priced = priceItem(item);
  let left = 99;
  if (args.kind === "flight") {
    const f = getFlight(priced.refId);
    left = f && f.status !== "cancelled" ? f.seatsLeft : 0;
  } else if (args.kind === "hotel") {
    const h = getHotel(args.refId)!;
    const room = hotelForDate(h, args.date).roomTypes.find((r) => r.code === (args.roomCode ?? "STD"));
    left = room?.available ?? 0;
  }
  const available = left >= unitsNeeded(priced);
  return {
    kind: args.kind,
    refId: priced.refId,
    available,
    priceINR: priced.priceINR,
    seatsOrRoomsLeft: left,
    holdExpiresAt: available ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
  };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
