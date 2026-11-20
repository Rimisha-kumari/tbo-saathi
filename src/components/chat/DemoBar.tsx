"use client";

export interface DemoChip {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  tone?: "alert";
}

/** One-click hackathon demo triggers above the chat input. */
export function DemoBar({ chips }: { chips: DemoChip[] }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none]" aria-label="Demo shortcuts">
      {chips.map((c) => (
        <button
          key={c.label}
          onClick={c.onClick}
          disabled={c.disabled}
          title={c.hint}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-40 ${
            c.tone === "alert" ? "border-rose-400/70 text-rose-600 hover:bg-rose-500/10" : "border-line bg-card hover:border-brand"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
