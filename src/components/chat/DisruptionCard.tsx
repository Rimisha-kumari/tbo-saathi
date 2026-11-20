"use client";
import { inr } from "@/lib/client/i18n";
import type { DisruptionResult } from "@/lib/types";

export function DisruptionCard({ d, onChoose, disabled }: { d: DisruptionResult; onChoose: (index: number) => void; disabled: boolean }) {
  return (
    <div className="rounded-2xl border-2 border-rose-500/50 bg-rose-500/5 p-3 text-sm">
      <div className="mb-1 font-semibold text-rose-600">🚨 Disruption rescue</div>
      <div className="mb-2">{d.impact}</div>
      {d.options.length === 0 && <div className="text-xs text-muted">No action needed.</div>}
      <ol className="space-y-2">
        {d.options.map((o, i) => (
          <li key={o.label} className="rounded-xl border border-line bg-card p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold">
                {i === 0 && <span className="mr-1 rounded bg-emerald-500/15 px-1 text-[10px] text-emerald-700 dark:text-emerald-300">Best</span>}
                {i + 1}. {o.label}
              </div>
              <span className="shrink-0 text-[11px] text-muted">
                {o.priceDeltaINR === 0 ? "No extra cost" : o.priceDeltaINR > 0 ? `+${inr(o.priceDeltaINR)}` : `Refund ${inr(-o.priceDeltaINR)}`}
              </span>
            </div>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted">
              {o.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <button
              disabled={disabled}
              onClick={() => onChoose(i)}
              className="mt-1.5 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40 dark:text-stone-900"
            >
              Choose this
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
