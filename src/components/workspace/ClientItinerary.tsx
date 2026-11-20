"use client";
import { useState } from "react";
import { fmtDate, hhmm, inr } from "@/lib/client/i18n";
import { weatherFor } from "@/lib/travel/weather";
import type { Booking, Itinerary } from "@/lib/types";
import { Empty } from "./CompareTab";
import { clientPrice, tripDestination } from "./ItineraryTab";

const KIND = { flight: "Flight", hotel: "Hotel", transfer: "Transfer", sightseeing: "Sightseeing" } as const;

/**
 * B2B Copilot: a clean English client itinerary with client prices only (net
 * prices and margin stay hidden). Printing uses the .print-area rules in globals.css.
 */
export function ClientItinerary({ itinerary, booking, markupPct }: { itinerary: Itinerary | null; booking: Booking | null; markupPct: number }) {
  const [agency, setAgency] = useState("Your Travel Agency");
  const [client, setClient] = useState("");
  if (!itinerary || !itinerary.items.length) return <Empty text="Plan a trip (in any language) and a clean English client itinerary appears here, ready to print." />;
  const city = tripDestination(itinerary);
  const total = itinerary.items.reduce((s, i) => s + clientPrice(i.priceINR, markupPct), 0);
  const dates = [...new Set(itinerary.items.map((i) => i.date))].sort();
  const describe = (i: Itinerary["items"][number]) => {
    const m = i.meta ?? {};
    if (i.kind === "flight") return `${m.airline} ${m.flightNo}, ${m.route}, departs ${hhmm(String(m.departAt))}, arrives ${hhmm(String(m.arriveAt))}`;
    if (i.kind === "hotel") return `${m.name} (${m.stars}★), ${m.roomName ?? "room"}, ${m.nights} night(s), check-in ${m.checkInTime ?? "14:00"}, check-out ${m.checkOut}`;
    if (i.kind === "transfer") return `${m.name}, pickup ${m.time ?? ""}`;
    return `${m.name}, starts ${m.slot ?? ""}, ${m.durationHrs}h guided`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col gap-0.5">
          Agency name
          <input value={agency} onChange={(e) => setAgency(e.target.value)} className="rounded-lg border border-line bg-card px-2 py-1" />
        </label>
        <label className="flex flex-col gap-0.5">
          Client name
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={booking?.leadGuest.name ?? "Client name"} className="rounded-lg border border-line bg-card px-2 py-1" />
        </label>
        <button onClick={() => window.print()} className="ml-auto rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
          🖨️ Print / Save as PDF
        </button>
      </div>

      <section className="print-area rounded-xl border border-line bg-white p-5 text-[13px] text-stone-900" lang="en">
        <header className="mb-4 flex items-end justify-between border-b-2 border-teal-700 pb-2">
          <div>
            <h2 className="text-lg font-bold text-teal-800">{agency}</h2>
            <div className="text-xs text-stone-500">Travel itinerary prepared with TBO Saathi</div>
          </div>
          <div className="text-right text-xs text-stone-600">
            <div>Prepared for <b>{client || booking?.leadGuest.name || "Valued Guest"}</b></div>
            {booking && <div>Booking ref {booking.pnr}</div>}
          </div>
        </header>
        <div className="mb-3">
          <div className="text-base font-semibold">{city ? `${city} Getaway` : "Your Trip"}</div>
          <div className="text-xs text-stone-600">
            {fmtDate(dates[0])} – {fmtDate(dates[dates.length - 1])} · {itinerary.travellers.adults} adult(s)
            {itinerary.travellers.children ? `, ${itinerary.travellers.children} child(ren)` : ""}
          </div>
        </div>
        {dates.map((d, n) => {
          const w = city ? weatherFor(city, d) : null;
          return (
            <div key={d} className="mb-3">
              <div className="mb-1 flex justify-between border-b border-stone-200 font-semibold">
                <span>
                  Day {n + 1} — {fmtDate(d)}
                </span>
                {w && (
                  <span className="text-xs font-normal text-stone-500">
                    Expected {w.tempC}°C, {w.condition}
                  </span>
                )}
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {itinerary.items
                    .filter((i) => i.date === d)
                    .map((i) => (
                      <tr key={i.kind + i.refId}>
                        <td className="w-24 py-0.5 align-top font-medium">{KIND[i.kind]}</td>
                        <td className="py-0.5">{describe(i)}</td>
                        <td className="w-24 py-0.5 text-right font-mono">{inr(clientPrice(i.priceINR, markupPct))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          );
        })}
        <div className="mt-4 flex justify-between border-t-2 border-teal-700 pt-2 text-sm font-bold">
          <span>Total package price (taxes included)</span>
          <span>{inr(total)}</span>
        </div>
        <ul className="mt-3 list-disc pl-5 text-[11px] text-stone-500">
          <li>Prices are per the itinerary above for all travellers. Valid for 24 hours, subject to availability.</li>
          <li>Hotel check-in 14:00, check-out 11:00 unless stated. Carry a government photo ID.</li>
          <li>Cancellation and refund rules apply as per supplier policy.</li>
        </ul>
      </section>
    </div>
  );
}
