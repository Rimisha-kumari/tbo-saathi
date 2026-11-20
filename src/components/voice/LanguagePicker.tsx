"use client";
import { LANGS } from "@/lib/client/i18n";
import type { LangId } from "@/lib/lang";

export function LanguagePicker({ value, onChange }: { value: LangId; onChange: (l: LangId) => void }) {
  return (
    <div role="radiogroup" aria-label="Language" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
      {LANGS.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={value === l.code}
          lang={l.code === "hinglish" ? "en" : l.code}
          onClick={() => onChange(l.code)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs transition sm:text-sm ${
            value === l.code ? "bg-brand font-semibold text-white dark:text-stone-900" : "border border-line bg-card hover:border-brand"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
