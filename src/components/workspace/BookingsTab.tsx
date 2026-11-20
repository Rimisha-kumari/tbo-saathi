"use client";
import { useEffect, useState } from "react";
import { DisruptionCard } from "@/components/chat/DisruptionCard";
import { inr } from "@/lib/client/i18n";
import { downloadVouchers, printVouchers, qrSvg } from "@/lib/client/voucherDoc";
import type { Booking, DisruptionResult, Voucher } from "@/lib/types";
import { Empty } from "./CompareTab";

const ICON = { flight: "✈️", hotel: "🏨", transfer: "🚖", sightseeing: "📍" } as const;

function VoucherQr({ text }: { text: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    void qrSvg(text).then((s) => live && setSvg(s));
    return () => {
      live = false;
    };
  }, [text]);
  // Markup is generated locally by the qrcode library from our own voucher text.
  return <div className="h-16 w-16 shrink-0 rounded bg-white p-0.5 [&_svg]:h-full [&_svg]:w-full" aria-label="Voucher QR code" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function VoucherRow({ v, cancelled }: { v: Voucher; cancelled: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-dashed border-brand/50 bg-brand/5 p-2 ${cancelled ? "opacity-50 grayscale" : ""}`}>
      <VoucherQr text={v.qrText} />
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-semibold uppercase text-brand">
          {ICON[v.kind]} {v.kind} voucher
        </div>
        <div className="truncate text-sm font-medium">{v.details}</div>
        <div className="text-muted">
          Code <span className="font-mono font-semibold">{v.code}</span> · {v.validFrom}
          {v.validTo !== v.validFrom ? ` → ${v.validTo}` : ""}
        </div>
      </div>
    </div>
  );
}

export function BookingsTab({
  bookings,
  disruptions,
  onCancel,
  onModify,
  onSimulate,
  onChoose,
  disabled,
}: {
  bookings: Booking[];
  disruptions: Record<string, DisruptionResult>;
  onCancel: (b: Booking) => void;
  onModify: (b: Booking) => void;
  onSimulate: (b: Booking) => void;
  onChoose: (bookingId: string, index: number) => void;
  disabled: boolean;
}) {
  if (!bookings.length) return <Empty text="Confirmed bookings and vouchers appear here. Plan a trip, then tap Confirm ✅ on the summary card." />;
  return (
    <div className="space-y-4">
      {[...bookings].reverse().map((b) => {
        const cancelled = b.status === "cancelled";
        const d = disruptions[b.id];
        return (
          <article key={b.id} className={`rounded-2xl border bg-card p-3 ${cancelled ? "border-rose-400/50" : "border-emerald-500/40"}`}>
            <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className={`font-semibold ${cancelled ? "text-rose-600" : "text-emerald-600"}`}>{cancelled ? "✗ Cancelled" : "✓ Confirmed"}</div>
                <div className="text-xs text-muted">
                  {b.leadGuest.name} · paid {inr(b.paidINR)}
                  {cancelled ? ` · refund ${inr(b.refundINR)}` : ""} · {b.id}
                </div>
              </div>
              <span className="font-mono text-sm font-semibold">PNR {b.pnr}</span>
            </header>
            <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
              <button onClick={() => void downloadVouchers(b)} className="rounded-full border border-line px-2.5 py-1 hover:border-brand">
                ⬇️ Download vouchers
              </button>
              <button onClick={() => printVouchers(b)} className="rounded-full border border-line px-2.5 py-1 hover:border-brand">
                🖨️ Print / PDF
              </button>
              {!cancelled && (
                <>
                  <button disabled={disabled} onClick={() => onModify(b)} className="rounded-full border border-line px-2.5 py-1 hover:border-brand disabled:opacity-40">
                    ✏️ Modify
                  </button>
                  <button disabled={disabled} onClick={() => onCancel(b)} className="rounded-full border border-line px-2.5 py-1 hover:border-rose-400 disabled:opacity-40">
                    ✗ Cancel booking
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() => onSimulate(b)}
                    className="rounded-full border border-rose-400/70 px-2.5 py-1 font-semibold text-rose-600 hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    Simulate Flight Cancellation 🚨
                  </button>
                </>
              )}
            </div>
            {d && !cancelled && (
              <div className="mb-3">
                <DisruptionCard d={d} disabled={disabled} onChoose={(i) => onChoose(b.id, i)} />
              </div>
            )}
            <div className="space-y-2">
              {b.vouchers.map((v) => (
                <VoucherRow key={v.id} v={v} cancelled={cancelled} />
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
