"use client";
import { inr } from "@/lib/client/i18n";
import type { Pref, PrefKey } from "@/lib/types";

/** Traveller memory: preferences remembered across turns and applied to every recommendation. */
export function MemoryBar({
  prefs,
  budgetINR,
  onRemove,
  onClearBudget,
}: {
  prefs: Pref[];
  budgetINR: number | null;
  onRemove: (k: PrefKey) => void;
  onClearBudget: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-3 py-1.5 text-xs [scrollbar-width:none]" aria-label="Remembered preferences">
      <span className="shrink-0 font-semibold text-muted">🧠 Remembered:</span>
      {!prefs.length && !budgetINR && <span className="shrink-0 text-muted">say things like “window seat”, “veg”, “4-star”, “budget ₹50k”</span>}
      {budgetINR && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 font-medium">
          💰 Budget {inr(budgetINR)}
          <button aria-label="Forget budget" onClick={onClearBudget} className="text-muted hover:text-foreground">
            ×
          </button>
        </span>
      )}
      {prefs.map((p) => (
        <span key={p.key} className="flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">
          {p.label}
          <button aria-label={`Forget ${p.label}`} onClick={() => onRemove(p.key)} className="opacity-60 hover:opacity-100">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
