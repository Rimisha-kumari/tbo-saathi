"use client";

export function MicButton({
  listening,
  supported,
  disabled,
  onToggle,
}: {
  listening: boolean;
  supported: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || !supported}
      title={supported ? (listening ? "Stop listening" : "Speak") : "Voice input needs Chrome, Edge or Safari"}
      aria-label={listening ? "Stop listening" : "Start voice input"}
      aria-pressed={listening}
      className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-40 ${
        listening ? "bg-emerald-500" : "bg-brand dark:text-stone-900"
      }`}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/50" />}
      <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11h-2Z" />
      </svg>
    </button>
  );
}
