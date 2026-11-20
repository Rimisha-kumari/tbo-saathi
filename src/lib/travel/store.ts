import flightsData from "@/data/flights.json";
import hotelsData from "@/data/hotels.json";
import transfersData from "@/data/transfers.json";
import sightseeingData from "@/data/sightseeing.json";
import type {
  Booking,
  DisruptionResult,
  FlightSchedule,
  ItineraryPatch,
  PendingAction,
  Hotel,
  Itinerary,
  Sightseeing,
  Transfer,
} from "@/lib/types";

export const flightSchedules = flightsData as FlightSchedule[];
export const hotels = hotelsData as Hotel[];
export const transfers = transfersData as Transfer[];
export const sightseeing = sightseeingData as Sightseeing[];

/**
 * In-memory mutable state. Pinned on globalThis so dev hot-reloads keep it;
 * a server restart resets it by design.
 */
interface Store {
  itineraries: Map<string, Itinerary>;
  bookings: Map<string, Booking>;
  /** Inventory consumed by bookings: key `${refId}|${date}` -> units. */
  consumed: Map<string, number>;
  /** Flight instances flagged by simulated disruptions: key `${flightId}`. */
  flightStatus: Map<string, "delayed" | "cancelled">;
  /** Actions awaiting the traveller's Confirm click (the confirmation gate). */
  actions: Map<string, { action: PendingAction; patch: ItineraryPatch | null }>;
  /** Latest disruption assessment per booking. */
  disruptions: Map<string, DisruptionResult>;
  /** Per voucher: identity key (item+date+time) and the inventory it holds. */
  voucherMeta: Map<string, { key: string; invKey: string; units: number }>;
}

const g = globalThis as unknown as { __saathiStore?: Store };
export const store: Store = (g.__saathiStore ??= {
  itineraries: new Map(),
  bookings: new Map(),
  consumed: new Map(),
  flightStatus: new Map(),
  actions: new Map(),
  disruptions: new Map(),
  voucherMeta: new Map(),
});
// Older hot-reloaded stores may predate newer maps.
store.actions ??= new Map();
store.disruptions ??= new Map();
store.voucherMeta ??= new Map();

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export { hash01 } from "@/lib/hash";

export function nights(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  return Math.max(1, Math.round(ms / 86_400_000));
}
