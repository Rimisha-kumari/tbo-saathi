"use client";
import { useState } from "react";
import { inr } from "@/lib/client/i18n";
import type { LeadGuest, PendingAction } from "@/lib/types";

const DEMO_GUEST: LeadGuest = { name: "Demo Traveller", phone: "+91 90000 00000", email: "traveller@example.com" };

/**
 * The strict confirmation gate: nothing is booked, paid, cancelled or changed
 * until the traveller clicks Confirm here (POST /api/travel {op:"confirm"}).
 */
export function ConfirmCard({
  action,
  status,
  error,
  onConfirm,
  onEdit,
}: {
  action: PendingAction;
  status: "open" | "confirmed" | "edited" | "error";
  error?: string;
  onConfirm: (guest: LeadGuest | null) => Promise<void>;
  onEdit: () => void;
}) {
  const [guest, setGuest] = useState<LeadGuest>(action.leadGuest ?? { name: "", phone: "", email: "" });
  const [working, setWorking] = useState(false);
  const needsGuest = action.type === "book";
  const valid = !needsGuest || (guest.name.trim().length > 0 && guest.phone.trim().length >= 6);
  const tone = action.type === "cancel" ? "rose" : action.type === "rebook" ? "amber" : "emerald";
  const border = { rose: "border-rose-400/60", amber: "border-amber-400/70", emerald: "border-emerald-500/50" }[tone];
  const closed = status === "confirmed" || status === "edited";

  return (
    <div className={`rounded-2xl border-2 ${border} bg-card p-3 text-sm shadow-sm`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="font-semibold">{action.title}</div>
        <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          {status === "confirmed" ? "Confirmed" : status === "edited" ? "Editing" : "Needs your confirmation"}
        </span>
      </div>
      <ul className="my-2 space-y-1 text-xs">
        {action.lines.map((l, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>{l.label}</span>
            {l.amountINR != null && <span className="shrink-0 font-mono">{inr(l.amountINR)}</span>}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line pt-2">
        <span className="text-xs text-muted">Trip total {inr(action.totalINR)}</span>
        <span className="font-semibold">
          {action.payableINR < 0 ? `Refund ${inr(-action.payableINR)}` : action.payableINR === 0 ? "No extra charge" : `Pay ${inr(action.payableINR)}`}
        </span>
      </div>

      {needsGuest && !closed && (
        <fieldset className="mt-3 grid gap-1.5 sm:grid-cols-3">
          <legend className="mb-1 flex w-full items-center justify-between text-xs font-medium">
            Lead guest
            <button type="button" className="text-[11px] text-brand underline" onClick={() => setGuest(DEMO_GUEST)}>
              Use demo details
            </button>
          </legend>
          {(["name", "phone", "email"] as const).map((f) => (
            <input
              key={f}
              value={guest[f]}
              onChange={(e) => setGuest({ ...guest, [f]: e.target.value })}
              placeholder={f === "name" ? "Full name" : f === "phone" ? "Mobile" : "Email"}
              aria-label={`Lead guest ${f}`}
              className="min-w-0 rounded-lg border border-line bg-background px-2 py-1.5 text-xs outline-none focus:border-brand"
            />
          ))}
        </fieldset>
      )}

      {error && <div className="mt-2 rounded-lg bg-rose-500/10 px-2 py-1 text-xs text-rose-600">{error}</div>}

      {!closed && (
        <div className="mt-3 flex gap-2">
          <button
            disabled={!valid || working}
            onClick={async () => {
              setWorking(true);
              try {
                await onConfirm(needsGuest ? guest : null);
              } finally {
                setWorking(false);
              }
            }}
            className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {working ? "Confirming…" : action.type === "cancel" ? "Confirm cancellation ✅" : "Confirm ✅"}
          </button>
          <button disabled={working} onClick={onEdit} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold">
            Edit ✏️
          </button>
        </div>
      )}
    </div>
  );
}
