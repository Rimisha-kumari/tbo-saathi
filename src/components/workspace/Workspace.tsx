"use client";
import type { WorkspaceTab } from "@/lib/client/useChat";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "compare", label: "⚖️ Compare" },
  { id: "itinerary", label: "📅 Itinerary" },
  { id: "bookings", label: "🎫 My Bookings" },
  { id: "client", label: "📄 Client Itinerary" },
];

export function Workspace({
  tab,
  setTab,
  b2b,
  counts,
  children,
}: {
  tab: WorkspaceTab;
  setTab: (t: WorkspaceTab) => void;
  b2b: boolean;
  counts: Partial<Record<WorkspaceTab, number>>;
  children: React.ReactNode;
}) {
  const tabs = TABS.filter((t) => t.id !== "client" || b2b);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Trip workspace" className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-t-lg border-b-2 px-3 py-1.5 text-sm transition ${
              tab === t.id ? "border-brand font-semibold text-brand" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            {counts[t.id] ? <span className="ml-1 rounded-full bg-brand/15 px-1.5 text-[10px] font-bold">{counts[t.id]}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-3">
        {children}
      </div>
    </div>
  );
}
