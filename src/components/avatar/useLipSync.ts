"use client";
import { useState } from "react";

export type Viseme = "rest" | "A" | "E" | "O" | "M" | "C";
export interface MouthFrame {
  open: number; // 0..1
  shape: Viseme;
}

const A = /[aāàáâाआअাআঅాఆఅாஆஅ]/i;
const E = /[eiyéèिीेैइईएিীেইঈএిీెేఇఎிீெேஇஎ]/i;
const O = /[ouwóोौुूओउোুূওউొోుూఒఉொோுூஒஉ]/i;
const M = /[mbpfमबपभমবপమబపமப]/i;
const LETTER = /\p{L}|\p{M}/u;

function visemeFor(ch: string | undefined): MouthFrame {
  if (!ch || !LETTER.test(ch)) return { open: 0.04, shape: "rest" };
  if (A.test(ch)) return { open: 0.95, shape: "A" };
  if (O.test(ch)) return { open: 0.6, shape: "O" };
  if (E.test(ch)) return { open: 0.5, shape: "E" };
  if (M.test(ch)) return { open: 0, shape: "M" };
  return { open: 0.3, shape: "C" };
}

/**
 * Drives mouth visemes for the avatar. Three sources:
 *  - text timing: a cursor walks the utterance at an estimated speaking rate,
 *  - `boundary` events from speechSynthesis re-sync that cursor per word,
 *  - an AnalyserNode (server TTS audio) maps amplitude to mouth opening.
 * The avatar polls `frame()` from its requestAnimationFrame loop.
 */
export class LipSync {
  private mode: "idle" | "text" | "audio" = "idle";
  private text = "";
  private cursorBase = 0;
  private t0 = 0;
  private cps = 13;
  private analyser: AnalyserNode | null = null;
  private buf: Uint8Array<ArrayBuffer> | null = null;

  startText(text: string) {
    this.mode = "text";
    this.text = text;
    this.cursorBase = 0;
    this.t0 = performance.now();
    // Indic scripts pack more sound per code point (matras, conjuncts) → slower cursor.
    this.cps = /[ऀ-෿]/.test(text) ? 10 : 14;
  }

  syncTo(charIndex: number) {
    if (this.mode !== "text") return;
    this.cursorBase = charIndex;
    this.t0 = performance.now();
  }

  startAnalyser(analyser: AnalyserNode) {
    this.mode = "audio";
    this.analyser = analyser;
    this.buf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  }

  stop() {
    this.mode = "idle";
    this.analyser = null;
  }

  get active() {
    return this.mode !== "idle";
  }

  frame(now: number): MouthFrame {
    if (this.mode === "text") {
      const idx = Math.floor(this.cursorBase + ((now - this.t0) / 1000) * this.cps);
      if (idx >= this.text.length + 4) return { open: 0.04, shape: "rest" };
      const v = visemeFor(this.text[idx]);
      // Small per-char wobble so long vowels don't look frozen.
      return { ...v, open: v.open * (0.85 + 0.15 * Math.sin(now / 45)) };
    }
    if (this.mode === "audio" && this.analyser && this.buf) {
      this.analyser.getByteTimeDomainData(this.buf);
      let sum = 0;
      for (const b of this.buf) sum += ((b - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / this.buf.length);
      const open = Math.min(1, Math.max(0, (rms - 0.02) * 6));
      return { open, shape: open > 0.6 ? "A" : open > 0.3 ? "E" : open > 0.08 ? "C" : "rest" };
    }
    return { open: 0.04, shape: "rest" };
  }
}

export function useLipSync(): LipSync {
  const [lip] = useState(() => new LipSync());
  return lip;
}
