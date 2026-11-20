/**
 * The confirmation gate. Agents (LLM or demo) can only PREPARE a booking,
 * cancellation or rebooking. Nothing that moves money or changes a booking runs
 * until the traveller clicks Confirm ✅ on the summary card, which calls
 * POST /api/travel {op:"confirm"} → confirmAction().
 */
import type { Booking, ItineraryItem, ItineraryPatch, LeadGuest, PendingAction } from "@/lib/types";
import { bookingForItinerary, cancelBooking, executeBooking, refundFor } from "./booking";
import { getFlight } from "./flights";
import { setItems } from "./planner";
import { newId, store } from "./store";

const TTL_MS = 30 * 60_000;
const label = (i: ItineraryItem) =>
  i.kind === "flight"
    ? `✈️ ${i.meta?.airline ?? ""} ${i.meta?.flightNo ?? i.refId} ${i.meta?.route ?? ""} · ${i.date} ${String(i.meta?.departAt ?? "").slice(11, 16)}`
    : i.kind === "hotel"
      ? `🏨 ${i.meta?.name} · ${i.meta?.nights} night(s) from ${i.date}`
      : i.kind === "transfer"
        ? `🚖 ${i.meta?.name} · ${i.date} ${i.meta?.time ?? ""}`
        : `📍 ${i.meta?.name} · ${i.date} ${i.meta?.slot ?? ""}`;

function save(action: Omit<PendingAction, "id" | "expiresAt">, patch: ItineraryPatch | null): PendingAction {
  // One open action per itinerary/booking: a new one supersedes the old.
  for (const [id, a] of store.actions) {
    if ((action.itineraryId && a.action.itineraryId === action.itineraryId) || (action.bookingId && a.action.bookingId === action.bookingId)) {
      store.actions.delete(id);
    }
  }
  const full: PendingAction = { ...action, id: newId("ACT"), expiresAt: new Date(Date.now() + TTL_MS).toISOString() };
  store.actions.set(full.id, { action: full, patch });
  return full;
}

export function prepareBooking(itineraryId: string, leadGuest: LeadGuest | null): PendingAction {
  const it = store.itineraries.get(itineraryId);
  if (!it) throw new Error(`Itinerary ${itineraryId} not found`);
  if (!it.items.length) throw new Error("Itinerary is empty — add flights or a hotel first");
  if (it.status === "cancelled") throw new Error("This trip was cancelled. Plan a new one.");
  const existing = bookingForItinerary(it.id);
  const payable = it.totalINR - (existing?.paidINR ?? 0);
  return save(
    {
      type: "book",
      title: existing ? `Update booking ${existing.pnr}` : "Review & confirm your trip",
      lines: it.items.map((i) => ({ label: label(i), amountINR: i.priceINR })),
      totalINR: it.totalINR,
      payableINR: payable,
      itineraryId: it.id,
      bookingId: existing?.id ?? null,
      leadGuest: leadGuest ?? existing?.leadGuest ?? null,
    },
    null,
  );
}

export function prepareCancel(bookingId: string): PendingAction {
  const b = store.bookings.get(bookingId);
  if (!b || b.status === "cancelled") throw new Error("No active booking to cancel");
  const it = store.itineraries.get(b.itineraryId)!;
  const lines = it.items.map((i) => {
    const refund = refundFor(i, i.kind === "flight" ? (getFlight(i.refId)?.refundable ?? false) : false);
    return { label: `${label(i)} — refund`, amountINR: refund };
  });
  const refund = lines.reduce((s, l) => s + (l.amountINR ?? 0), 0);
  return save(
    {
      type: "cancel",
      title: `Cancel booking ${b.pnr}`,
      lines,
      totalINR: b.paidINR,
      payableINR: -refund,
      itineraryId: it.id,
      bookingId: b.id,
      leadGuest: b.leadGuest,
    },
    null,
  );
}

export function prepareRebook(bookingId: string, optionIndex: number): PendingAction {
  const b = store.bookings.get(bookingId);
  const d = store.disruptions.get(bookingId);
  if (!b || !d) throw new Error("No open disruption for this booking");
  const opt = d.options[optionIndex];
  if (!opt) throw new Error(`Option ${optionIndex + 1} does not exist`);
  const it = store.itineraries.get(b.itineraryId)!;
  const total = it.totalINR + opt.priceDeltaINR;
  return save(
    {
      type: "rebook",
      title: `Rescue plan for ${b.pnr}: ${opt.label}`,
      lines: opt.changes.map((c) => ({ label: c, amountINR: null })),
      totalINR: total,
      payableINR: opt.priceDeltaINR,
      itineraryId: it.id,
      bookingId: b.id,
      leadGuest: b.leadGuest,
    },
    opt.itineraryPatch,
  );
}

export interface ConfirmResult {
  action: PendingAction;
  booking: Booking;
}

export function confirmAction(actionId: string, leadGuest: LeadGuest | null): ConfirmResult {
  const entry = store.actions.get(actionId);
  if (!entry) throw new Error("This confirmation has expired or was replaced. Ask Saathi to prepare it again.");
  const { action, patch } = entry;
  if (Date.parse(action.expiresAt) < Date.now()) {
    store.actions.delete(actionId);
    throw new Error("This confirmation expired. Ask Saathi to prepare it again.");
  }
  const guest = leadGuest ?? action.leadGuest;
  let booking: Booking;
  if (action.type === "cancel") {
    booking = cancelBooking(action.bookingId!, -action.payableINR);
  } else {
    if (!guest?.name.trim() || !guest.phone.trim()) throw new Error("Lead guest name and phone are required");
    if (action.type === "rebook" && patch) applyPatch(action.itineraryId!, patch);
    booking = executeBooking(action.itineraryId!, guest);
    if (action.type === "rebook") store.disruptions.delete(booking.id);
  }
  store.actions.delete(actionId);
  return { action, booking };
}

export function discardAction(actionId: string) {
  store.actions.delete(actionId);
}

function applyPatch(itineraryId: string, patch: ItineraryPatch) {
  const it = store.itineraries.get(itineraryId)!;
  const removed = new Set(patch.remove);
  const upsertKeys = new Set(patch.upsert.map((u) => `${u.kind}|${u.refId}`));
  const items = it.items.filter((i) => !removed.has(i.refId) && !upsertKeys.has(`${i.kind}|${i.refId}`));
  // Upserted items are already priced (and may carry locked rescue prices / delayed times).
  setItems(it, [...items, ...patch.upsert]);
  for (const u of patch.upsert) {
    if (u.kind === "flight" && u.meta?.delayedMin) store.flightStatus.set(u.refId, "delayed");
  }
}
