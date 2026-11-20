"use client";
import { LANGS } from "@/lib/client/i18n";
import type { Lang } from "@/lib/types";

export function LanguagePicker({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="radiogroup" aria-label="Language" className="flex flex-wrap justify-center gap-1">
      {LANGS.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={value === l.code}
          onClick={() => onChange(l.code)}
          className={`rounded-full px-3 py-1 text-sm transition ${
            value === l.code ? "bg-brand font-semibold text-white dark:text-stone-900" : "border border-line bg-card hover:border-brand"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
