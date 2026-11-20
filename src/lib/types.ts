import type { LangId } from "./lang";

export type { LangId } from "./lang";
export type Cabin = "economy" | "premium" | "business";
export type ItemKind = "flight" | "hotel" | "transfer" | "sightseeing";
export type Expression = "idle" | "listening" | "thinking" | "speaking" | "concerned";

/** Daily schedule row as stored in data/flights.json. */
export interface FlightSchedule {
  id: string;
  airline: string;
  flightNo: string;
  from: string;
  to: string;
  departTime: string; // "HH:MM" local
  durationMin: number;
  stops: number;
  cabin: Cabin;
  fareINR: number;
  refundable: boolean;
}

/** A dated flight instance (schedule materialised for a date). */
export interface Flight extends Omit<FlightSchedule, "departTime"> {
  scheduleId: string;
  departAt: string;
  arriveAt: string;
  seatsLeft: number;
  status: "scheduled" | "delayed" | "cancelled";
}

export interface RoomType {
  code: string;
  name: string;
  maxGuests: number;
  priceINR: number;
  available: number;
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  area: string;
  stars: number;
  rating: number;
  pricePerNightINR: number;
  amenities: string[];
  roomTypes: RoomType[];
  lat: number;
  lng: number;
  images: string[];
}

export interface Transfer {
  id: string;
  city: string;
  type: "airport_pickup" | "airport_drop" | "intercity";
  vehicle: "sedan" | "suv" | "tempo";
  priceINR: number;
  maxPax: number;
}

export interface Sightseeing {
  id: string;
  city: string;
  title: string;
  durationHrs: number;
  priceINR: number;
  languages: string[];
  slots: string[];
}

export type ItemMeta = Record<string, string | number | null>;

export interface ItineraryItem {
  kind: ItemKind;
  refId: string;
  date: string;
  pax: number;
  priceINR: number;
  meta?: ItemMeta;
}

export interface Itinerary {
  id: string;
  travellers: { adults: number; children: number };
  items: ItineraryItem[];
  totalINR: number;
  status: "draft" | "held" | "booked" | "cancelled";
}

export interface Voucher {
  id: string;
  bookingId: string;
  kind: ItemKind;
  refId: string;
  code: string;
  qrText: string;
  validFrom: string;
  validTo: string;
  details: string;
}

export interface LeadGuest {
  name: string;
  phone: string;
  email: string;
}

export interface Booking {
  id: string;
  itineraryId: string;
  pnr: string;
  leadGuest: LeadGuest;
  paidINR: number;
  createdAt: string;
  status: "confirmed" | "cancelled";
  refundINR: number;
  vouchers: Voucher[];
}

export type DisruptionType = "flight_delay" | "flight_cancel" | "hotel_overbooked" | "weather";

export interface Disruption {
  type: DisruptionType;
  affectedRefId: string;
  severity: "low" | "medium" | "high";
}

export interface ItineraryPatch {
  /** refIds removed from the itinerary. */
  remove: string[];
  /** Items added, or replacing an item with the same kind+refId. */
  upsert: ItineraryItem[];
}

export interface DisruptionOption {
  label: string;
  /** Human-readable knock-on changes (new cab time, hotel check-in…). */
  changes: string[];
  itineraryPatch: ItineraryPatch;
  priceDeltaINR: number;
}

export interface DisruptionResult {
  bookingId: string;
  type: DisruptionType;
  impact: string;
  options: DisruptionOption[];
}

export interface Availability {
  kind: ItemKind;
  refId: string;
  available: boolean;
  priceINR: number;
  seatsOrRoomsLeft: number;
  holdExpiresAt: string | null;
}

/** Something that changes money or a booking: only runs after the user clicks Confirm. */
export interface PendingAction {
  id: string;
  type: "book" | "cancel" | "rebook";
  title: string;
  lines: { label: string; amountINR: number | null }[];
  totalINR: number;
  /** Positive = traveller pays, negative = refund. */
  payableINR: number;
  itineraryId: string | null;
  bookingId: string | null;
  leadGuest: LeadGuest | null;
  expiresAt: string;
}

export interface Weather {
  tempC: number;
  condition: "Sunny" | "Partly cloudy" | "Cloudy" | "Rain" | "Thunderstorm" | "Haze" | "Pleasant";
  icon: string;
}

export type PrefKey =
  | "window_seat"
  | "aisle_seat"
  | "veg"
  | "jain"
  | "non_veg"
  | "stars_4"
  | "stars_5"
  | "budget_stay"
  | "non_stop"
  | "morning_flight"
  | "evening_flight"
  | "pool"
  | "breakfast"
  | "family"
  | "wheelchair";

export interface Pref {
  key: PrefKey;
  label: string;
}

export type LlmProvider = "claude" | "openai" | "demo";

/** Events streamed from /api/chat as NDJSON lines. */
export type ChatEvent =
  | { type: "meta"; provider: LlmProvider; lang: LangId }
  | { type: "text"; delta: string }
  | { type: "expression"; value: Expression }
  | { type: "tool"; name: string; status: "start" | "done" | "error"; data?: unknown }
  | { type: "state"; itineraryId: string | null; bookingId: string | null }
  | { type: "memory"; prefs: Pref[]; budgetINR: number | null }
  | { type: "action"; action: PendingAction }
  | { type: "error"; message: string }
  | { type: "done" };
