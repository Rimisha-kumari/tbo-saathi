import flightsData from "@/data/flights.json";
import hotelsData from "@/data/hotels.json";
import transfersData from "@/data/transfers.json";
import sightseeingData from "@/data/sightseeing.json";
import type {
  Booking,
  FlightSchedule,
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
}

const g = globalThis as unknown as { __saathiStore?: Store };
export const store: Store = (g.__saathiStore ??= {
  itineraries: new Map(),
  bookings: new Map(),
  consumed: new Map(),
  flightStatus: new Map(),
});

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** Deterministic 0..1 hash so availability is stable per (id, date). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function nights(checkIn: string, checkOut: string): number {
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  return Math.max(1, Math.round(ms / 86_400_000));
}
