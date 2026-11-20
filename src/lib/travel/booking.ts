import type { Booking, ItineraryItem, Voucher } from "@/lib/types";
import { checkAvailability, inventoryKey, unitsNeeded } from "./inventory";
import { newId, store } from "./store";

export interface BookTripArgs {
  itineraryId: string;
  leadGuest: { name: string; phone: string; email: string };
  confirm: boolean;
}

/** Booking already issued for an itinerary (bookTrip amends it in place). */
export function bookingForItinerary(itineraryId: string): Booking | null {
  for (const b of store.bookings.values()) if (b.itineraryId === itineraryId) return b;
  return null;
}

export function bookTrip(args: BookTripArgs, userConfirmed: boolean): Booking {
  if (!args.confirm || !userConfirmed) {
    throw new Error(
      "Booking not confirmed. Summarise the itinerary and total, then ask the traveller to say yes explicitly.",
    );
  }
  const it = store.itineraries.get(args.itineraryId);
  if (!it) throw new Error(`Itinerary ${args.itineraryId} not found`);
  if (!it.items.length) throw new Error("Itinerary is empty");

  const existing = bookingForItinerary(it.id);
  const alreadyVouchered = new Set(existing?.vouchers.map((v) => `${v.kind}|${v.refId}`) ?? []);
  const fresh = it.items.filter((i) => !alreadyVouchered.has(`${i.kind}|${i.refId}`));

  for (const item of fresh) {
    const a = checkAvailability({
      kind: item.kind,
      refId: item.refId,
      date: item.date,
      pax: item.pax,
      roomCode: (item.meta?.roomCode as string | undefined) ?? null,
    });
    if (!a.available) throw new Error(`${item.kind} ${item.refId} is no longer available on ${item.date}`);
  }
  for (const item of fresh) {
    const key = inventoryKey(item);
    store.consumed.set(key, (store.consumed.get(key) ?? 0) + unitsNeeded(item));
  }

  const booking: Booking = existing ?? {
    id: newId("BKG"),
    itineraryId: it.id,
    pnr: newId("TBO").slice(4),
    leadGuest: args.leadGuest,
    paidINR: 0,
    createdAt: new Date().toISOString(),
    vouchers: [],
  };
  const live = new Set(it.items.map((i) => `${i.kind}|${i.refId}`));
  booking.vouchers = booking.vouchers
    .filter((v) => live.has(`${v.kind}|${v.refId}`))
    .concat(fresh.map((i) => makeVoucher(booking, i)));
  booking.leadGuest = args.leadGuest;
  booking.paidINR = it.totalINR;
  it.status = "booked";
  store.bookings.set(booking.id, booking);
  return booking;
}

function makeVoucher(b: Booking, i: ItineraryItem): Voucher {
  const code = `${i.kind.slice(0, 2).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const validTo = String(i.meta?.checkOut ?? i.date);
  const name = String(i.meta?.name ?? i.meta?.flightNo ?? i.refId);
  return {
    id: newId("VCH"),
    bookingId: b.id,
    kind: i.kind,
    refId: i.refId,
    code,
    qrText: `TBO|${b.pnr}|${code}|${i.refId}|${i.date}`,
    validFrom: i.date,
    validTo,
    details: `${name} · ${i.pax} pax${i.meta?.route ? ` · ${i.meta.route}` : ""}${i.meta?.slot ? ` · ${i.meta.slot}` : ""}`,
  };
}
