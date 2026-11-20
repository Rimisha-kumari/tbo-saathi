"use client";
import { useEffect, useRef } from "react";
import type { Expression } from "@/lib/types";
import { POSES, type Pose } from "./expressions";
import type { LipSync, Viseme } from "./useLipSync";

const MOUTH_Y = 153;

function mouthPaths(open: number, shape: Viseme, smile: number) {
  const w = 15 * (shape === "E" ? 1.25 : shape === "O" ? 0.72 : shape === "M" ? 1.05 : 1);
  const h = open * (shape === "O" ? 17 : 15);
  const cy = MOUTH_Y;
  const corner = cy - smile * 0.6;
  const L = 120 - w;
  const R = 120 + w;
  const outer = `M${L} ${corner} Q120 ${cy - 3 - h * 0.25} ${R} ${corner} Q120 ${cy + 3 + h * 2 + smile * 0.35} ${L} ${corner}Z`;
  const inner =
    h > 1.2
      ? `M${120 - w * 0.8} ${corner} Q120 ${cy - h * 0.15} ${120 + w * 0.8} ${corner} Q120 ${cy + h * 1.75} ${120 - w * 0.8} ${corner}Z`
      : "";
  return { outer, inner, teethRy: h > 5 ? Math.min(3.2, h * 0.22) : 0, teethRx: w * 0.55, teethY: cy - h * 0.05 + 1.5 };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function Avatar({ expression, lip, className }: { expression: Expression; lip: LipSync; className?: string }) {
  const exprRef = useRef(expression);
  useEffect(() => {
    exprRef.current = expression;
  }, [expression]);

  const head = useRef<SVGGElement>(null);
  const browL = useRef<SVGPathElement>(null);
  const browR = useRef<SVGPathElement>(null);
  const eyeL = useRef<SVGGElement>(null);
  const eyeR = useRef<SVGGElement>(null);
  const irisL = useRef<SVGGElement>(null);
  const irisR = useRef<SVGGElement>(null);
  const mouthOuter = useRef<SVGPathElement>(null);
  const mouthInner = useRef<SVGPathElement>(null);
  const teeth = useRef<SVGEllipseElement>(null);

  useEffect(() => {
    const cur: Pose = { ...POSES.idle };
    let mouthOpen = 0;
    let nextBlink = performance.now() + 1800;
    let blinkStart = -1;
    let raf = 0;

    const tick = (now: number) => {
      const target = POSES[exprRef.current];
      for (const k of ["browY", "browTilt", "smile", "headTilt", "eyeOpen", "gazeX", "gazeY"] as const) {
        cur[k] = lerp(cur[k], target[k], 0.1);
      }

      // Blink every 2.5–5.5s; 150ms close/open.
      if (now > nextBlink) {
        blinkStart = now;
        nextBlink = now + 2500 + Math.random() * 3000;
      }
      const bp = blinkStart < 0 ? 1 : (now - blinkStart) / 150;
      const blink = bp >= 1 ? 1 : 1 - Math.sin(Math.PI * bp) * 0.95;

      const m = lip.frame(now);
      mouthOpen = lerp(mouthOpen, m.open, 0.45);
      const breath = Math.sin(now / 1100) * 1.2;
      const idleSway = exprRef.current === "idle" ? Math.sin(now / 2300) * 1.2 : 0;
      const speakNod = lip.active ? Math.sin(now / 180) * 0.8 : 0;

      head.current?.setAttribute("transform", `translate(0 ${breath + speakNod}) rotate(${cur.headTilt + idleSway} 120 200)`);
      browL.current?.setAttribute("transform", `translate(0 ${cur.browY}) rotate(${-cur.browTilt} 99 94)`);
      browR.current?.setAttribute("transform", `translate(0 ${cur.browY}) rotate(${cur.browTilt} 141 94)`);
      const sy = Math.max(0.05, cur.eyeOpen * blink);
      eyeL.current?.setAttribute("transform", `translate(99 110) scale(1 ${sy}) translate(-99 -110)`);
      eyeR.current?.setAttribute("transform", `translate(141 110) scale(1 ${sy}) translate(-141 -110)`);
      irisL.current?.setAttribute("transform", `translate(${cur.gazeX} ${cur.gazeY})`);
      irisR.current?.setAttribute("transform", `translate(${cur.gazeX} ${cur.gazeY})`);

      const p = mouthPaths(mouthOpen, m.shape, cur.smile);
      mouthOuter.current?.setAttribute("d", p.outer);
      mouthInner.current?.setAttribute("d", p.inner);
      teeth.current?.setAttribute("ry", String(p.teethRy));
      teeth.current?.setAttribute("rx", String(p.teethRx));
      teeth.current?.setAttribute("cy", String(p.teethY));

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lip]);

  const pose = POSES[expression];

  return (
    <svg
      viewBox="0 0 240 260"
      role="img"
      aria-label={`Saathi avatar, ${expression}`}
      className={`h-auto w-full select-none ${className ?? ""}`}
    >
      <defs>
        <radialGradient id="halo" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d9a074" />
          <stop offset="100%" stopColor="#c48858" />
        </linearGradient>
        <linearGradient id="kurta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#115e59" />
        </linearGradient>
      </defs>

      {/* Halo — colour follows the expression */}
      <circle
        cx="120"
        cy="122"
        r="118"
        fill="url(#halo)"
        style={{ color: pose.halo, transition: "color 400ms ease" }}
        className={expression === "speaking" || expression === "listening" ? "saathi-pulse" : ""}
      />

      {/* Shoulders & kurta with dupatta */}
      <path d="M38 260 Q42 206 92 192 L148 192 Q198 206 202 260 Z" fill="url(#kurta)" />
      <path d="M92 192 Q120 214 148 192 L142 190 Q120 205 98 190 Z" fill="#0b4f4a" />
      <path d="M150 193 Q186 206 196 260 L170 260 Q164 222 140 197 Z" fill="#f59e0b" opacity="0.95" />
      <path d="M156 200 Q182 214 188 260" stroke="#b45309" strokeWidth="1.5" fill="none" opacity="0.6" />
      <rect x="62" y="222" width="34" height="13" rx="3" fill="#fff" opacity="0.92" />
      <text x="79" y="231.5" fontSize="8" textAnchor="middle" fontWeight="700" fill="#0f766e" fontFamily="sans-serif">
        TBO
      </text>

      <g ref={head}>
        {/* Back hair + bun */}
        <ellipse cx="120" cy="104" rx="64" ry="70" fill="#22150f" />
        <circle cx="120" cy="38" r="20" fill="#22150f" />
        <circle cx="104" cy="40" r="3" fill="#f59e0b" />
        {/* Neck */}
        <path d="M104 160 L104 192 Q120 200 136 192 L136 160 Z" fill="#bd8152" />
        {/* Ears + jhumkas */}
        <ellipse cx="66" cy="114" rx="7" ry="11" fill="#c48858" />
        <ellipse cx="174" cy="114" rx="7" ry="11" fill="#c48858" />
        <g className="saathi-earring" style={{ transformOrigin: "66px 124px" }}>
          <circle cx="66" cy="128" r="3.2" fill="#eab308" />
          <path d="M61 131 Q66 140 71 131 Z" fill="#eab308" />
        </g>
        <g className="saathi-earring" style={{ transformOrigin: "174px 124px" }}>
          <circle cx="174" cy="128" r="3.2" fill="#eab308" />
          <path d="M169 131 Q174 140 179 131 Z" fill="#eab308" />
        </g>
        {/* Face */}
        <ellipse cx="120" cy="114" rx="52" ry="58" fill="url(#skin)" />
        {/* Front hair with centre parting */}
        <path d="M68 104 Q66 56 120 52 Q174 56 172 104 Q160 74 122 66 L120 60 L118 66 Q80 74 68 104 Z" fill="#2a1a12" />
        {/* Brows */}
        <path ref={browL} d="M86 95 Q99 88 112 94" stroke="#2a1a12" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path ref={browR} d="M128 94 Q141 88 154 95" stroke="#2a1a12" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        {/* Eyes */}
        <g ref={eyeL}>
          <ellipse cx="99" cy="110" rx="10" ry="7" fill="#fff" />
          <g ref={irisL}>
            <circle cx="99" cy="110" r="5" fill="#4a2c1a" />
            <circle cx="99" cy="110" r="2.4" fill="#120a06" />
            <circle cx="100.6" cy="108.4" r="1.2" fill="#fff" />
          </g>
          <path d="M88 108 Q99 100 110 108" stroke="#120a06" strokeWidth="1.6" fill="none" />
        </g>
        <g ref={eyeR}>
          <ellipse cx="141" cy="110" rx="10" ry="7" fill="#fff" />
          <g ref={irisR}>
            <circle cx="141" cy="110" r="5" fill="#4a2c1a" />
            <circle cx="141" cy="110" r="2.4" fill="#120a06" />
            <circle cx="142.6" cy="108.4" r="1.2" fill="#fff" />
          </g>
          <path d="M130 108 Q141 100 152 108" stroke="#120a06" strokeWidth="1.6" fill="none" />
        </g>
        {/* Bindi, nose, cheeks */}
        <circle cx="120" cy="88" r="2.6" fill="#be123c" />
        <path d="M120 116 Q116 132 112 134 Q120 138 128 134" stroke="#9a6440" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="129" cy="133" r="1.1" fill="#eab308" />
        <ellipse cx="88" cy="134" rx="9" ry="5" fill="#e07a7a" opacity="0.22" />
        <ellipse cx="152" cy="134" rx="9" ry="5" fill="#e07a7a" opacity="0.22" />
        {/* Mouth */}
        <path ref={mouthOuter} d={mouthPaths(0, "rest", 4).outer} fill="#a3404a" />
        <path ref={mouthInner} d="" fill="#3b0d14" />
        <ellipse ref={teeth} cx="120" cy={MOUTH_Y} rx="8" ry="0" fill="#fbfbf7" />
      </g>

      {/* Expression props */}
      {expression === "thinking" && (
        <g fill="#6366f1">
          <circle className="saathi-dot" cx="188" cy="54" r="4" style={{ animationDelay: "0ms" }} />
          <circle className="saathi-dot" cx="201" cy="42" r="5" style={{ animationDelay: "150ms" }} />
          <circle className="saathi-dot" cx="216" cy="28" r="6" style={{ animationDelay: "300ms" }} />
        </g>
      )}
      {expression === "listening" && (
        <g stroke="#10b981" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path className="saathi-wave" d="M188 104 Q196 114 188 124" />
          <path className="saathi-wave" d="M196 96 Q208 114 196 132" style={{ animationDelay: "200ms" }} />
          <path className="saathi-wave" d="M204 88 Q220 114 204 140" style={{ animationDelay: "400ms" }} />
        </g>
      )}
      {expression === "concerned" && (
        <path d="M176 64 q4 8 0 12 q-4 -4 0 -12z" fill="#7dd3fc" opacity="0.85" className="saathi-drop" />
      )}
    </svg>
  );
}
