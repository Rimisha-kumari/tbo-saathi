export type Cabin = "economy" | "premium" | "business";
export type ItemKind = "flight" | "hotel" | "transfer" | "sightseeing";
export type Expression = "idle" | "listening" | "thinking" | "speaking" | "concerned";
export type Lang = "en-IN" | "hi-IN" | "ta-IN" | "te-IN" | "bn-IN";

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

export interface ItineraryItem {
  kind: ItemKind;
  refId: string;
  date: string;
  pax: number;
  priceINR: number;
  meta?: Record<string, string | number | null>;
}

export interface Itinerary {
  id: string;
  travellers: { adults: number; children: number };
  items: ItineraryItem[];
  totalINR: number;
  status: "draft" | "held" | "booked";
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

export interface Booking {
  id: string;
  itineraryId: string;
  pnr: string;
  leadGuest: { name: string; phone: string; email: string };
  paidINR: number;
  createdAt: string;
  vouchers: Voucher[];
}

export type DisruptionType = "flight_delay" | "flight_cancel" | "hotel_overbooked" | "weather";

export interface Disruption {
  type: DisruptionType;
  affectedRefId: string;
  severity: "low" | "medium" | "high";
}

export interface DisruptionOption {
  label: string;
  itineraryPatch: { remove: string | null; add: ItineraryItem | null };
  priceDeltaINR: number;
}

export interface DisruptionResult {
  bookingId: string;
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

/** Events streamed from /api/chat as NDJSON lines. */
export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "expression"; value: Expression }
  | { type: "tool"; name: string; status: "start" | "done" | "error"; data?: unknown }
  | { type: "state"; itineraryId: string | null; bookingId: string | null }
  | { type: "error"; message: string }
  | { type: "done" };
