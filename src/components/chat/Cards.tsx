"use client";
import type { Booking, DisruptionResult, Flight, Hotel, Itinerary, Voucher } from "@/lib/types";
import { dur, hhmm, inr } from "@/lib/client/i18n";

type Act = (text: string) => void;

const box = "rounded-xl border border-line bg-card p-3 text-sm shadow-sm";
const btn =
  "rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 dark:text-stone-900";

export function FlightList({ flights, label, onAct, disabled }: { flights: Flight[]; label?: string; onAct: Act; disabled: boolean }) {
  if (!flights.length) return <div className={box}>No flights found.</div>;
  return (
    <div className={box}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        ✈ {label ?? "Flights"} · {flights[0].from} → {flights[0].to} · {flights[0].departAt.slice(0, 10)}
      </div>
      <ul className="divide-y divide-line">
        {flights.map((f) => (
          <li key={f.id} className="flex items-center gap-3 py-2">
            <div className="w-24 shrink-0">
              <div className="font-semibold">{f.airline}</div>
              <div className="text-xs text-muted">{f.flightNo}</div>
            </div>
            <div className="flex-1 text-xs">
              <div className="font-mono text-sm">
                {hhmm(f.departAt)} – {hhmm(f.arriveAt)}
              </div>
              <div className="text-muted">
                {dur(f.durationMin)} · {f.stops ? `${f.stops} stop` : "non-stop"} · {f.seatsLeft} seats
                {f.refundable ? " · refundable" : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{inr(f.fareINR)}</div>
              <button className={btn} disabled={disabled} onClick={() => onAct(`Add flight ${f.flightNo} (id ${f.id}) to my trip`)}>
                Select
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HotelList({ hotels, onAct, disabled }: { hotels: Hotel[]; onAct: Act; disabled: boolean }) {
  if (!hotels.length) return <div className={box}>No hotels found.</div>;
  return (
    <div className={`${box} grid gap-2 sm:grid-cols-2`}>
      {hotels.map((h) => {
        const room = h.roomTypes.find((r) => r.available > 0) ?? h.roomTypes[0];
        return (
          <div key={h.id} className="flex flex-col rounded-lg border border-line p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold leading-tight">{h.name}</div>
              <span className="shrink-0 rounded bg-accent/20 px-1.5 text-xs font-semibold">★ {h.rating}</span>
            </div>
            <div className="text-xs text-muted">
              {"★".repeat(h.stars)} · {h.area}, {h.city}
            </div>
            <div className="mt-1 line-clamp-1 text-xs text-muted">{h.amenities.join(" · ").replaceAll("_", " ")}</div>
            <div className="mt-2 flex items-center justify-between">
              <span>
                <b>{inr(room.priceINR)}</b>
                <span className="text-xs text-muted"> /night · {room.name}</span>
              </span>
              <button className={btn} disabled={disabled} onClick={() => onAct(`Add ${h.name} (id ${h.id}), ${room.name} (room code ${room.code}) to my trip`)}>
                Choose
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ICON = { flight: "✈", hotel: "🏨", transfer: "🚖", sightseeing: "📍" } as const;

export function ItineraryCard({ itinerary, onAct, disabled, compact }: { itinerary: Itinerary; onAct?: Act; disabled?: boolean; compact?: boolean }) {
  return (
    <div className={box}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Itinerary {itinerary.id}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${itinerary.status === "booked" ? "bg-emerald-500/15 text-emerald-600" : "bg-accent/20"}`}>
          {itinerary.status}
        </span>
      </div>
      {itinerary.items.length === 0 ? (
        <div className="text-muted">Nothing added yet.</div>
      ) : (
        <ul className="space-y-1.5">
          {itinerary.items.map((i) => (
            <li key={`${i.kind}-${i.refId}`} className="flex items-start gap-2">
              <span aria-hidden>{ICON[i.kind]}</span>
              <div className="flex-1">
                <div className="font-medium leading-tight">
                  {String(i.meta?.name ?? i.meta?.flightNo ?? i.refId)}
                  {i.meta?.route ? <span className="text-muted"> · {String(i.meta.route)}</span> : null}
                </div>
                <div className="text-xs text-muted">
                  {i.date}
                  {i.meta?.departAt ? ` ${hhmm(String(i.meta.departAt))}` : ""}
                  {i.meta?.nights ? ` · ${i.meta.nights} night(s)` : ""} · {i.pax} pax
                </div>
              </div>
              <span className="font-mono text-xs">{inr(i.priceINR)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <span className="font-semibold">Total {inr(itinerary.totalINR)}</span>
        {!compact && onAct && itinerary.status !== "booked" && itinerary.items.length > 0 && (
          <button className={btn} disabled={disabled} onClick={() => onAct("Please book this trip")}>
            Book trip
          </button>
        )}
      </div>
    </div>
  );
}

/** Decorative QR-style grid derived from the voucher text (demo only, not scannable). */
function PseudoQr({ text }: { text: string }) {
  let h = 2166136261;
  const cells: boolean[] = [];
  for (let i = 0; i < 81; i++) {
    h ^= text.charCodeAt(i % text.length) + i;
    h = Math.imul(h, 16777619);
    cells.push(((h >>> 0) & 3) === 0 || ((h >>> 3) & 1) === 1);
  }
  const finder = (x: number, y: number) => (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5);
  return (
    <svg viewBox="0 0 9 9" className="h-14 w-14 shrink-0 rounded bg-white p-0.5" aria-label="Voucher code">
      {cells.map((on, i) => {
        const x = i % 9;
        const y = Math.floor(i / 9);
        const f = finder(x, y);
        const fOn = f && !(x % 6 === 1 && y % 6 === 1);
        return (f ? fOn : on) ? <rect key={i} x={x} y={y} width="1" height="1" fill="#111" /> : null;
      })}
    </svg>
  );
}

export function VoucherCard({ v }: { v: Voucher }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-brand/50 bg-brand/5 p-2.5">
      <PseudoQr text={v.qrText} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase text-brand">
          {ICON[v.kind]} {v.kind} voucher
        </div>
        <div className="truncate text-sm font-medium">{v.details}</div>
        <div className="text-xs text-muted">
          Code <span className="font-mono font-semibold">{v.code}</span> · valid {v.validFrom}
          {v.validTo !== v.validFrom ? ` → ${v.validTo}` : ""}
        </div>
      </div>
    </div>
  );
}

export function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className={`${box} border-emerald-500/40`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-emerald-600">✓ Booking confirmed</span>
        <span className="font-mono text-xs">PNR {booking.pnr}</span>
      </div>
      <div className="mb-2 text-xs text-muted">
        {booking.leadGuest.name} · paid {inr(booking.paidINR)} · {booking.id}
      </div>
      <div className="space-y-2">
        {booking.vouchers.map((v) => (
          <VoucherCard key={v.id} v={v} />
        ))}
      </div>
    </div>
  );
}

export function DisruptionCard({ d, onAct, disabled }: { d: DisruptionResult; onAct: Act; disabled: boolean }) {
  return (
    <div className={`${box} border-rose-500/50 bg-rose-500/5`}>
      <div className="mb-1 font-semibold text-rose-600">⚠ Disruption</div>
      <div className="mb-2">{d.impact}</div>
      <ol className="space-y-1.5">
        {d.options.map((o, i) => (
          <li key={o.label} className="flex items-center gap-2">
            <span className="flex-1 text-xs">
              {i + 1}. {o.label}{" "}
              <span className="text-muted">
                ({o.priceDeltaINR === 0 ? "no extra cost" : o.priceDeltaINR > 0 ? `+${inr(o.priceDeltaINR)}` : `refund ${inr(-o.priceDeltaINR)}`})
              </span>
            </span>
            <button className={btn} disabled={disabled} onClick={() => onAct(`I choose option ${i + 1}: ${o.label}. Yes, please go ahead.`)}>
              Choose
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
