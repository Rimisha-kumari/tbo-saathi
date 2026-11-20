import type { Booking, ItineraryItem, LeadGuest, Voucher } from "@/lib/types";
import { checkAvailability, inventoryKey, unitsNeeded } from "./inventory";
import { newId, store } from "./store";

/** Booking already issued for an itinerary (re-booking amends it in place). */
export function bookingForItinerary(itineraryId: string): Booking | null {
  for (const b of store.bookings.values()) if (b.itineraryId === itineraryId && b.status === "confirmed") return b;
  return null;
}

/** Identity of a voucher: a changed time or date (e.g. a moved cab) means a new voucher. */
const voucherKey = (i: Pick<ItineraryItem, "kind" | "refId" | "date" | "meta">) =>
  `${i.kind}|${i.refId}|${i.date}|${i.meta?.time ?? i.meta?.checkInTime ?? i.meta?.departAt ?? ""}|${i.meta?.checkOut ?? ""}`;

/**
 * Issues or amends a booking. Only called from confirmAction(), i.e. after the
 * traveller clicked Confirm on the summary card.
 */
export function executeBooking(itineraryId: string, leadGuest: LeadGuest): Booking {
  const it = store.itineraries.get(itineraryId);
  if (!it) throw new Error(`Itinerary ${itineraryId} not found`);
  if (!it.items.length) throw new Error("Itinerary is empty");
  if (it.status === "cancelled") throw new Error("This itinerary was cancelled");

  const existing = bookingForItinerary(it.id);
  const keyOf = (v: Voucher) => store.voucherMeta.get(v.id)?.key;
  const issued = new Set(existing?.vouchers.map(keyOf) ?? []);
  const fresh = it.items.filter((i) => !issued.has(voucherKey(i)));
  const live = new Set(it.items.map(voucherKey));
  const removed = existing ? existing.vouchers.filter((v) => !live.has(keyOf(v) ?? "")) : [];

  for (const item of fresh) {
    const alreadyHeld = existing?.vouchers.some((v) => v.kind === item.kind && v.refId === item.refId && v.validFrom === item.date);
    if (alreadyHeld) continue; // same inventory, only details (e.g. time) changed
    const a = checkAvailability({
      kind: item.kind,
      refId: item.refId,
      date: item.date,
      pax: item.pax,
      roomCode: (item.meta?.roomCode as string | undefined) ?? null,
    });
    if (!a.available) throw new Error(`${item.meta?.name ?? item.meta?.flightNo ?? item.refId} is no longer available on ${item.date}`);
  }
  for (const v of removed) release(v);
  for (const item of fresh) {
    const key = inventoryKey(item);
    store.consumed.set(key, (store.consumed.get(key) ?? 0) + unitsNeeded(item));
  }

  const booking: Booking = existing ?? {
    id: newId("BKG"),
    itineraryId: it.id,
    pnr: newId("TBO").slice(4),
    leadGuest,
    paidINR: 0,
    createdAt: new Date().toISOString(),
    status: "confirmed",
    refundINR: 0,
    vouchers: [],
  };
  const keep = booking.vouchers.filter((v) => !removed.includes(v));
  booking.vouchers = keep.concat(fresh.map((i) => makeVoucher(booking, i)));
  booking.leadGuest = leadGuest;
  booking.paidINR = it.totalINR;
  it.status = "booked";
  store.bookings.set(booking.id, booking);
  return booking;
}

function release(v: Voucher) {
  const m = store.voucherMeta.get(v.id);
  if (!m) return;
  store.consumed.set(m.invKey, Math.max(0, (store.consumed.get(m.invKey) ?? 0) - m.units));
  m.units = 0;
}

/** Refund policy for the demo: refundable fares 100%, others 30% (taxes); hotels 90%; cabs and tours 100%. */
export function refundFor(item: ItineraryItem, refundableFare: boolean): number {
  if (item.kind === "flight") return Math.round(item.priceINR * (refundableFare ? 1 : 0.3));
  if (item.kind === "hotel") return Math.round(item.priceINR * 0.9);
  return item.priceINR;
}

export function cancelBooking(bookingId: string, refundINR: number): Booking {
  const b = store.bookings.get(bookingId);
  if (!b) throw new Error(`Booking ${bookingId} not found`);
  if (b.status === "cancelled") throw new Error("Booking is already cancelled");
  for (const v of b.vouchers) release(v);
  b.status = "cancelled";
  b.refundINR = refundINR;
  const it = store.itineraries.get(b.itineraryId);
  if (it) it.status = "cancelled";
  return b;
}

function makeVoucher(b: Booking, i: ItineraryItem): Voucher {
  const code = `${i.kind.slice(0, 2).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const validTo = String(i.meta?.checkOut ?? i.date);
  const name = String(i.meta?.name ?? `${i.meta?.airline ?? ""} ${i.meta?.flightNo ?? i.refId}`.trim());
  const when =
    i.kind === "flight"
      ? ` · departs ${String(i.meta?.departAt).slice(11, 16)}`
      : i.kind === "hotel"
        ? ` · check-in ${i.meta?.checkInTime ?? "14:00"}`
        : i.meta?.time
          ? ` · pickup ${i.meta.time}`
          : i.meta?.slot
            ? ` · ${i.meta.slot}`
            : "";
  const id = newId("VCH");
  store.voucherMeta.set(id, { key: voucherKey(i), invKey: inventoryKey(i), units: unitsNeeded(i) });
  return {
    id,
    bookingId: b.id,
    kind: i.kind,
    refId: i.refId,
    code,
    qrText: `TBO|${b.pnr}|${code}|${i.refId}|${i.date}`,
    validFrom: i.date,
    validTo,
    details: `${name} · ${i.pax} pax${i.meta?.route ? ` · ${i.meta.route}` : ""}${when}`,
  };
}
