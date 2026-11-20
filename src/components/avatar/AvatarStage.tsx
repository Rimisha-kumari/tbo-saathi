"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Expression } from "@/lib/types";
import { Avatar } from "./Avatar";
import { EXPRESSION_LABEL, POSES } from "./expressions";
import type { LipSync } from "./useLipSync";

/*
 * The 2D SVG avatar is the default: it renders on the first paint with no
 * assets and no WebGL. 3D is opt-in. When chosen, it is mounted invisibly
 * on top of the 2D avatar (Three.js is client-only via next/dynamic ssr:false,
 * with no loading UI) and only revealed after its first rendered frame. If it
 * errors or isn't ready within READY_TIMEOUT_MS, the stage stays on 2D.
 */
const Avatar3D = dynamic(() => import("./Avatar3D"), { ssr: false, loading: () => null });
const READY_TIMEOUT_MS = 5000;

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

const KEY = "saathi.avatarMode.v2";
const readPref = (): "3d" | "2d" => {
  try {
    return localStorage.getItem(KEY) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
};
const noop = () => () => {};

export function AvatarStage({ expression, lip, voiceLabel }: { expression: Expression; lip: LipSync; voiceLabel: string }) {
  const stored = useSyncExternalStore(noop, readPref, () => "2d" as const);
  const [choice, setChoice] = useState<"3d" | "2d" | null>(null);
  const [failed3d, setFailed3d] = useState<string | null>(null);
  const [ready3d, setReady3d] = useState(false);
  const want3d = (choice ?? stored) === "3d" && !failed3d;
  const show3d = want3d && ready3d;

  // Never hang: if the 3D scene hasn't drawn a frame in time, stay on 2D.
  useEffect(() => {
    if (!want3d || ready3d) return;
    const t = setTimeout(() => {
      setFailed3d("3D took too long to start — showing 2D");
      setChoice("2d");
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [want3d, ready3d]);

  const set = (m: "3d" | "2d") => {
    if (m === "3d") {
      if (!webglAvailable()) {
        setFailed3d("WebGL isn't available here — showing 2D");
        return;
      }
      setFailed3d(null);
      setReady3d(false);
    }
    setChoice(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* private mode */
    }
  };
  const mode = show3d ? "3d" : "2d";

  return (
    <div className="flex w-full items-center gap-3">
      <div
        className="relative aspect-square h-24 shrink-0 overflow-hidden rounded-2xl sm:h-28 lg:h-[clamp(112px,22vh,210px)]"
        style={{ background: `radial-gradient(circle at 50% 42%, ${POSES[expression].halo}26, transparent 70%)`, transition: "background 400ms" }}
      >
        <div className={`absolute inset-0 transition-opacity duration-300 ${show3d ? "opacity-0" : "opacity-100"}`} aria-hidden={show3d}>
          <Avatar expression={expression} lip={lip} />
        </div>
        {want3d && (
          <div className={`absolute inset-0 transition-opacity duration-300 ${show3d ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!show3d}>
            <WebGLBoundary
              onError={() => {
                setFailed3d("3D couldn't start — showing 2D");
                setChoice("2d");
              }}
            >
              <Avatar3D expression={expression} lip={lip} onReady={() => setReady3d(true)} />
            </WebGLBoundary>
          </div>
        )}
        <div role="group" aria-label="Avatar style" className="absolute top-1 right-1 flex rounded-full border border-line bg-card/90 p-0.5 text-[9px] font-semibold shadow-sm backdrop-blur">
          {(["2d", "3d"] as const).map((m) => (
            <button
              key={m}
              onClick={() => set(m)}
              aria-pressed={mode === m}
              title={m === "3d" ? "Optional 3D avatar (needs WebGL)" : "2D avatar"}
              className={`rounded-full px-1.5 py-0.5 uppercase transition ${mode === m ? "bg-brand text-white dark:text-stone-900" : "text-muted"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1" aria-live="polite">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: POSES[expression].halo }} />
          {EXPRESSION_LABEL[expression]}
        </div>
        <div className="mt-0.5 line-clamp-2 text-[11px] text-muted">{voiceLabel}</div>
        {failed3d && <div className="mt-0.5 text-[11px] text-amber-600">{failed3d}</div>}
      </div>
    </div>
  );
}
