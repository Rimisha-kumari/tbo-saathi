"use client";
import dynamic from "next/dynamic";
import { Component, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Expression } from "@/lib/types";
import { Avatar } from "./Avatar";
import { EXPRESSION_LABEL, POSES } from "./expressions";
import type { LipSync } from "./useLipSync";

// Three.js touches window/WebGL at import time: never render it on the server.
const Avatar3D = dynamic(() => import("./Avatar3D"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center text-xs text-muted">Loading 3D…</div>,
});

class WebGLBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

const KEY = "saathi.avatarMode";
const readPref = (): "3d" | "2d" | null => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "2d" || v === "3d" ? v : null;
  } catch {
    return null;
  }
};
const noop = () => () => {};

export function AvatarStage({ expression, lip, voiceLabel }: { expression: Expression; lip: LipSync; voiceLabel: string }) {
  const canWebGL = useSyncExternalStore(noop, webglAvailable, () => false);
  const stored = useSyncExternalStore(noop, readPref, () => null);
  const [choice, setChoice] = useState<"3d" | "2d" | null>(null);
  const [crashed, setCrashed] = useState(false);
  const mode: "3d" | "2d" = crashed || !canWebGL ? "2d" : (choice ?? stored ?? "3d");

  const set = (m: "3d" | "2d") => {
    setChoice(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* private mode */
    }
  };

  return (
    <div className="relative w-full">
      <div
        className="relative mx-auto aspect-square w-40 overflow-hidden rounded-3xl sm:w-52 lg:w-full lg:max-w-[340px]"
        style={{ background: `radial-gradient(circle at 50% 40%, ${POSES[expression].halo}22, transparent 70%)`, transition: "background 400ms" }}
      >
        {mode === "3d" ? (
          <WebGLBoundary onError={() => setCrashed(true)}>
            <Avatar3D expression={expression} lip={lip} />
          </WebGLBoundary>
        ) : (
          <div className="grid h-full w-full place-items-end">
            <Avatar expression={expression} lip={lip} />
          </div>
        )}
      </div>
      <div role="group" aria-label="Avatar style" className="absolute top-1 right-1 flex rounded-full border border-line bg-card/90 p-0.5 text-[10px] font-semibold shadow-sm backdrop-blur">
        {(["3d", "2d"] as const).map((m) => (
          <button
            key={m}
            onClick={() => set(m)}
            disabled={m === "3d" && (!canWebGL || crashed)}
            aria-pressed={mode === m}
            title={m === "3d" && !canWebGL ? "WebGL is not available on this device" : `${m.toUpperCase()} avatar`}
            className={`rounded-full px-2 py-0.5 uppercase transition disabled:opacity-40 ${mode === m ? "bg-brand text-white dark:text-stone-900" : "text-muted"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="mt-1 text-center" aria-live="polite">
        <div className="text-sm font-medium">{EXPRESSION_LABEL[expression]}</div>
        <div className="text-[11px] text-muted">{voiceLabel}</div>
      </div>
    </div>
  );
}
