import type { Cabin, Flight, FlightSchedule } from "@/lib/types";
import { flightSchedules, hash01, store } from "./store";

/** IST offset: all schedule times are local Indian time. */
const IST = "+05:30";

export function materialise(s: FlightSchedule, date: string): Flight {
  const departAt = `${date}T${s.departTime}:00${IST}`;
  const arrive = new Date(Date.parse(departAt) + s.durationMin * 60_000);
  const id = `${s.id}@${date}`;
  const baseSeats = 2 + Math.floor(hash01(id) * 30);
  const consumed = store.consumed.get(`${id}|${date}`) ?? 0;
  // Fares rise a little on busier dates.
  const surge = 1 + Math.round(hash01(`fare${id}`) * 4) / 20;
  return {
    id,
    scheduleId: s.id,
    airline: s.airline,
    flightNo: s.flightNo,
    from: s.from,
    to: s.to,
    departAt,
    arriveAt: toIstIso(arrive),
    durationMin: s.durationMin,
    stops: s.stops,
    cabin: s.cabin,
    fareINR: Math.round((s.fareINR * surge) / 10) * 10,
    seatsLeft: Math.max(0, baseSeats - consumed),
    refundable: s.refundable,
    status: store.flightStatus.get(id) ?? "scheduled",
  };
}

function toIstIso(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return ist.toISOString().slice(0, 19) + IST;
}

export interface FlightQuery {
  from: string;
  to: string;
  date: string;
  adults: number;
  cabin?: Cabin | null;
  maxStops?: number | null;
  sortBy?: "price" | "duration" | "depart" | null;
}

export function searchFlights(q: FlightQuery): Flight[] {
  const cabin = q.cabin ?? "economy";
  const list = flightSchedules
    .filter(
      (s) =>
        s.from === q.from.toUpperCase() &&
        s.to === q.to.toUpperCase() &&
        s.cabin === (cabin === "premium" ? "business" : cabin) &&
        (q.maxStops == null || s.stops <= q.maxStops),
    )
    .map((s) => materialise(s, q.date))
    .filter((f) => f.status !== "cancelled" && f.seatsLeft >= q.adults);

  const sortBy = q.sortBy ?? "price";
  list.sort((a, b) =>
    sortBy === "duration"
      ? a.durationMin - b.durationMin
      : sortBy === "depart"
        ? a.departAt.localeCompare(b.departAt)
        : a.fareINR - b.fareINR,
  );
  return list.slice(0, 5);
}

/** Resolve "6E101-e@2026-12-01" back to a dated flight. */
export function getFlight(id: string): Flight | null {
  const [scheduleId, date] = id.split("@");
  const s = flightSchedules.find((x) => x.id === scheduleId);
  if (!s || !date) return null;
  return materialise(s, date);
}
