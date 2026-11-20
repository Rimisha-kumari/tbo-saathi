"use client";
import { dur, hhmm, inr } from "@/lib/client/i18n";
import type { CompareData } from "@/lib/client/useWorkspace";
import type { Flight, Hotel, PrefKey } from "@/lib/types";

type Select = (text: string, display: string) => void;

const Badge = ({ children, tone = "brand" }: { children: React.ReactNode; tone?: "brand" | "accent" | "violet" }) => (
  <span
    className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
      tone === "accent" ? "bg-accent/25 text-amber-800 dark:text-amber-200" : tone === "violet" ? "bg-violet-500/15 text-violet-700 dark:text-violet-300" : "bg-brand/15 text-brand"
    }`}
  >
    {children}
  </span>
);

function FlightCompare({ title, flights, prefs, onSelect, disabled }: { title: string; flights: Flight[]; prefs: PrefKey[]; onSelect: Select; disabled: boolean }) {
  if (!flights.length) return null;
  const cheapest = Math.min(...flights.map((f) => f.fareINR));
  const fastest = Math.min(...flights.map((f) => f.durationMin));
  const hour = (f: Flight) => Number(f.departAt.slice(11, 13));
  const matches = (f: Flight) =>
    (!prefs.includes("non_stop") || f.stops === 0) &&
    (!prefs.includes("morning_flight") || hour(f) < 12) &&
    (!prefs.includes("evening_flight") || hour(f) >= 16);
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        ✈️ {title} · {flights[0].from} → {flights[0].to} · {flights[0].departAt.slice(0, 10)}
      </h3>
      <div className="grid gap-2 overflow-x-auto pb-1" style={{ gridTemplateColumns: `repeat(${flights.length}, minmax(140px, 1fr))` }}>
        {flights.map((f) => (
          <div key={f.id} className="flex flex-col rounded-xl border border-line bg-card p-2.5 text-xs">
            <div className="mb-1 flex flex-wrap gap-1">
              {f.fareINR === cheapest && <Badge>Cheapest</Badge>}
              {f.durationMin === fastest && <Badge tone="violet">Fastest</Badge>}
              {prefs.length > 0 && matches(f) && <Badge tone="accent">Fits you</Badge>}
            </div>
            <div className="text-sm font-semibold leading-tight">{f.airline}</div>
            <div className="text-muted">{f.flightNo}</div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              <dt className="text-muted">Time</dt>
              <dd className="font-mono">{hhmm(f.departAt)}–{hhmm(f.arriveAt)}</dd>
              <dt className="text-muted">Duration</dt>
              <dd>{dur(f.durationMin)}</dd>
              <dt className="text-muted">Stops</dt>
              <dd>{f.stops ? `${f.stops} stop` : "Non-stop"}</dd>
              <dt className="text-muted">Seats</dt>
              <dd>{f.seatsLeft} left</dd>
              <dt className="text-muted">Fare</dt>
              <dd>{f.refundable ? "Refundable" : "Saver"}</dd>
            </dl>
            <div className="mt-auto pt-2">
              <div className="text-base font-bold">{inr(f.fareINR)}</div>
              <div className="mb-1.5 text-[10px] text-muted">per person</div>
              <button
                disabled={disabled}
                onClick={() => onSelect(`Add flight ${f.airline} ${f.flightNo} (id ${f.id}) to my trip`, `✓ Selected ${f.airline} ${f.flightNo}`)}
                className="w-full rounded-lg bg-brand py-1.5 font-semibold text-white disabled:opacity-40 dark:text-stone-900"
              >
                Select
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const AMENITY = ["wifi", "breakfast", "pool", "spa", "gym", "airport_shuttle", "veg_kitchen", "family_rooms"];

function HotelCompare({ hotels, prefs, onSelect, disabled }: { hotels: Hotel[]; prefs: PrefKey[]; onSelect: Select; disabled: boolean }) {
  if (!hotels.length) return null;
  const price = (h: Hotel) => (h.roomTypes.find((r) => r.available > 0) ?? h.roomTypes[0]).priceINR;
  const cheapest = Math.min(...hotels.map(price));
  const best = Math.max(...hotels.map((h) => h.rating));
  const minStars = prefs.includes("stars_5") ? 5 : prefs.includes("stars_4") ? 4 : 0;
  const fits = (h: Hotel) => h.stars >= minStars && (!prefs.includes("pool") || h.amenities.includes("pool")) && (!prefs.includes("breakfast") || h.amenities.includes("breakfast"));
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">🏨 Hotels · {hotels[0].city}</h3>
      <div className="grid gap-2 overflow-x-auto pb-1" style={{ gridTemplateColumns: `repeat(${hotels.length}, minmax(150px, 1fr))` }}>
        {hotels.map((h) => {
          const room = h.roomTypes.find((r) => r.available > 0) ?? h.roomTypes[0];
          return (
            <div key={h.id} className="flex flex-col rounded-xl border border-line bg-card p-2.5 text-xs">
              <div className="mb-1 flex flex-wrap gap-1">
                {price(h) === cheapest && <Badge>Best price</Badge>}
                {h.rating === best && <Badge tone="violet">Top rated</Badge>}
                {prefs.length > 0 && fits(h) && <Badge tone="accent">Fits you</Badge>}
              </div>
              <div className="text-sm font-semibold leading-tight">{h.name}</div>
              <div className="text-muted">
                {"★".repeat(h.stars)} · {h.area}
              </div>
              <div className="mt-1 font-semibold">⭐ {h.rating} / 5</div>
              <ul className="mt-2 space-y-0.5">
                {AMENITY.map((a) => (
                  <li key={a} className={h.amenities.includes(a) ? "" : "text-muted line-through opacity-50"}>
                    {h.amenities.includes(a) ? "✓" : "✗"} {a.replace("_", " ")}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-2">
                <div className="text-base font-bold">{inr(room.priceINR)}</div>
                <div className="mb-1.5 text-[10px] text-muted">per night · {room.name}</div>
                <button
                  disabled={disabled}
                  onClick={() => onSelect(`Add ${h.name} (id ${h.id}), ${room.name} (room code ${room.code}) to my trip`, `✓ Selected ${h.name}`)}
                  className="w-full rounded-lg bg-brand py-1.5 font-semibold text-white disabled:opacity-40 dark:text-stone-900"
                >
                  Select
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CompareTab({ data, prefs, onSelect, disabled }: { data: CompareData; prefs: PrefKey[]; onSelect: Select; disabled: boolean }) {
  if (!data.outbound.length && !data.hotels.length) {
    return <Empty text="Ask Saathi to plan a trip or search flights/hotels — the top options appear here side by side." />;
  }
  return (
    <div className="space-y-5">
      <FlightCompare title="Outbound" flights={data.outbound} prefs={prefs} onSelect={onSelect} disabled={disabled} />
      <FlightCompare title="Return" flights={data.ret} prefs={prefs} onSelect={onSelect} disabled={disabled} />
      <HotelCompare hotels={data.hotels} prefs={prefs} onSelect={onSelect} disabled={disabled} />
    </div>
  );
}

export const Empty = ({ text }: { text: string }) => <div className="grid h-40 place-items-center rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{text}</div>;
