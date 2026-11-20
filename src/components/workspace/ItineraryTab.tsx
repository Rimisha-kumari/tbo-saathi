"use client";
import { fmtDate, hhmm, inr } from "@/lib/client/i18n";
import { weatherFor } from "@/lib/travel/weather";
import type { Booking, Itinerary } from "@/lib/types";
import { Empty } from "./CompareTab";

const ICON = { flight: "✈️", hotel: "🏨", transfer: "🚖", sightseeing: "📍" } as const;

export const clientPrice = (net: number, markupPct: number) => Math.round((net * (1 + markupPct / 100)) / 10) * 10;

export function tripDestination(it: Itinerary): string | null {
  const hotel = it.items.find((i) => i.kind === "hotel");
  if (hotel?.meta?.city) return String(hotel.meta.city);
  const out = it.items.find((i) => i.kind === "flight");
  return out?.meta?.to ? String(out.meta.to) : null;
}

interface Row {
  time: string;
  icon: string;
  title: string;
  sub: string;
  priceINR: number | null;
  flag?: string;
}

function rowsByDay(it: Itinerary): Map<string, Row[]> {
  const days = new Map<string, Row[]>();
  const push = (d: string, r: Row) => days.set(d, [...(days.get(d) ?? []), r]);
  for (const i of it.items) {
    const m = i.meta ?? {};
    if (i.kind === "flight") {
      push(i.date, {
        time: hhmm(String(m.departAt ?? "")),
        icon: ICON.flight,
        title: `${m.airline ?? ""} ${m.flightNo ?? i.refId}`.trim(),
        sub: `${m.route ?? ""} · arrives ${hhmm(String(m.arriveAt ?? ""))}${Number(m.stops) ? " · 1 stop" : " · non-stop"} · ${i.pax} pax`,
        priceINR: i.priceINR,
        flag: m.delayedMin ? `Delayed ${Math.round(Number(m.delayedMin) / 60)}h` : m.lockedPriceINR != null ? "Rebooked" : undefined,
      });
    } else if (i.kind === "hotel") {
      push(i.date, { time: String(m.checkInTime ?? "14:00"), icon: ICON.hotel, title: `Check-in · ${m.name}`, sub: `${m.roomName ?? m.roomCode} · ${m.nights} night(s) · ${"★".repeat(Number(m.stars ?? 0))}`, priceINR: i.priceINR });
      if (m.checkOut) push(String(m.checkOut), { time: "11:00", icon: ICON.hotel, title: `Check-out · ${m.name}`, sub: "Late checkout on request", priceINR: null });
    } else if (i.kind === "transfer") {
      push(i.date, { time: String(m.time ?? ""), icon: ICON.transfer, title: String(m.name ?? "Transfer"), sub: `${i.pax} pax · driver details 2h before pickup`, priceINR: i.priceINR });
    } else {
      push(i.date, { time: String(m.slot ?? ""), icon: ICON.sightseeing, title: String(m.name ?? "Activity"), sub: `${m.durationHrs ?? ""}h guided · ${i.pax} pax`, priceINR: i.priceINR });
    }
  }
  for (const [d, rows] of days) days.set(d, rows.sort((a, b) => a.time.localeCompare(b.time)));
  return new Map([...days.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function BudgetMeter({ total, budget, label }: { total: number; budget: number | null; label: string }) {
  if (!budget) {
    return (
      <div className="rounded-xl border border-line bg-card p-3 text-xs">
        <div className="flex justify-between font-semibold">
          <span>{label}</span>
          <span>{inr(total)}</span>
        </div>
        <div className="mt-1 text-muted">Tell Saathi a budget (e.g. “budget ₹50k”) to see the budget meter.</div>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((total / budget) * 100));
  const over = total > budget;
  const color = over ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="rounded-xl border border-line bg-card p-3 text-xs">
      <div className="flex justify-between font-semibold">
        <span>{label}</span>
        <span>
          {inr(total)} <span className="font-normal text-muted">of {inr(budget)}</span>
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={total} aria-label="Budget used">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-1 ${over ? "font-semibold text-rose-600" : "text-muted"}`}>
        {over ? `${inr(total - budget)} over budget — try “Make it cheaper”` : `${inr(budget - total)} left · ${pct}% used`}
      </div>
    </div>
  );
}

function AgentPricing({ it, markupPct, setMarkup }: { it: Itinerary; markupPct: number; setMarkup: (n: number) => void }) {
  const client = it.items.reduce((s, i) => s + clientPrice(i.priceINR, markupPct), 0);
  return (
    <div className="rounded-xl border-2 border-violet-400/50 bg-violet-500/5 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-violet-700 dark:text-violet-300">💼 Agent pricing (B2B)</span>
        <label className="flex items-center gap-2">
          Markup
          <input type="range" min={0} max={30} value={markupPct} onChange={(e) => setMarkup(Number(e.target.value))} aria-label="Agency markup percent" />
          <b className="w-8 text-right">{markupPct}%</b>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-card p-2">
          <div className="text-muted">Net (TBO)</div>
          <div className="text-sm font-bold">{inr(it.totalINR)}</div>
        </div>
        <div className="rounded-lg bg-card p-2">
          <div className="text-muted">Client price</div>
          <div className="text-sm font-bold">{inr(client)}</div>
        </div>
        <div className="rounded-lg bg-card p-2">
          <div className="text-muted">Agency margin</div>
          <div className="text-sm font-bold text-emerald-600">{inr(client - it.totalINR)}</div>
        </div>
      </div>
    </div>
  );
}

export function ItineraryTab({
  itinerary,
  booking,
  budgetINR,
  b2b,
  setMarkup,
  quick,
  onBook,
  disabled,
}: {
  itinerary: Itinerary | null;
  booking: Booking | null;
  budgetINR: number | null;
  b2b: { enabled: boolean; markupPct: number };
  setMarkup: (n: number) => void;
  quick: { label: string; onClick: () => void }[];
  onBook: () => void;
  disabled: boolean;
}) {
  if (!itinerary || !itinerary.items.length) return <Empty text="Your day-by-day itinerary appears here. Try “Plan Goa in Hindi (₹50k)” from the demo bar." />;
  const days = rowsByDay(itinerary);
  const city = tripDestination(itinerary);
  const dates = [...days.keys()];
  const booked = itinerary.status === "booked";
  const changed = booked && booking && booking.paidINR !== itinerary.totalINR;
  const priceOf = (n: number | null) => (n == null ? "" : b2b.enabled ? `${inr(n)} → ${inr(clientPrice(n, b2b.markupPct))}` : inr(n));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-base font-semibold">{city ? `${city} trip` : "Your trip"}</div>
          <div className="text-xs text-muted">
            {fmtDate(dates[0])} – {fmtDate(dates[dates.length - 1])} · {itinerary.travellers.adults} adult(s)
            {itinerary.travellers.children ? `, ${itinerary.travellers.children} child(ren)` : ""}
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            booked ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : itinerary.status === "cancelled" ? "bg-rose-500/15 text-rose-600" : "bg-accent/20"
          }`}
        >
          {booked && booking ? `Booked · PNR ${booking.pnr}` : itinerary.status}
        </span>
      </div>

      <BudgetMeter total={itinerary.totalINR} budget={budgetINR} label={b2b.enabled ? "Net trip cost" : "Trip total"} />
      {b2b.enabled && <AgentPricing it={itinerary} markupPct={b2b.markupPct} setMarkup={setMarkup} />}

      <ol className="space-y-2">
        {dates.map((d, idx) => {
          const w = city ? weatherFor(city, d) : null;
          return (
            <li key={d} className="rounded-xl border border-line bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  Day {idx + 1} <span className="font-normal text-muted">· {fmtDate(d)}</span>
                </div>
                {w && (
                  <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300" title={`${city} forecast`}>
                    {w.icon} {w.tempC}°C {w.condition}
                  </span>
                )}
              </div>
              <ul className="space-y-1.5">
                {days.get(d)!.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-10 shrink-0 pt-0.5 font-mono text-muted">{r.time}</span>
                    <span aria-hidden>{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {r.title} {r.flag && <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] font-semibold">{r.flag}</span>}
                      </div>
                      <div className="text-muted">{r.sub}</div>
                    </div>
                    <span className="shrink-0 font-mono">{priceOf(r.priceINR)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      {itinerary.status !== "cancelled" && (
        <div className="sticky bottom-0 space-y-2 bg-background/95 pt-2 pb-1 backdrop-blur">
          <div className="flex flex-wrap gap-1.5">
            {quick.map((q) => (
              <button key={q.label} disabled={disabled} onClick={q.onClick} className="rounded-full border border-line bg-card px-2.5 py-1 text-xs hover:border-brand disabled:opacity-40">
                {q.label}
              </button>
            ))}
          </div>
          {(!booked || changed) && (
            <button disabled={disabled} onClick={onBook} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              {changed ? "Review & update booking" : `Review & book · ${inr(itinerary.totalINR)}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
