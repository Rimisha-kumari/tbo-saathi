import type { Expression } from "@/lib/types";

/** Target pose per expression; the avatar eases toward these every frame. */
export interface Pose {
  browY: number; // px, negative = raised
  browTilt: number; // deg, positive = inner ends raised (worried)
  smile: number; // mouth corner curve, negative = frown
  headTilt: number; // deg
  eyeOpen: number; // 0..1.2
  gazeX: number;
  gazeY: number;
  halo: string;
}

export const POSES: Record<Expression, Pose> = {
  idle: { browY: 0, browTilt: 0, smile: 4, headTilt: 0, eyeOpen: 1, gazeX: 0, gazeY: 0, halo: "#f59e0b" },
  listening: { browY: -3, browTilt: 0, smile: 3, headTilt: 5, eyeOpen: 1.1, gazeX: 0, gazeY: 0, halo: "#10b981" },
  thinking: { browY: -2, browTilt: -6, smile: 0, headTilt: -6, eyeOpen: 0.9, gazeX: 3, gazeY: -3, halo: "#6366f1" },
  speaking: { browY: -1, browTilt: 0, smile: 3, headTilt: 0, eyeOpen: 1, gazeX: 0, gazeY: 0, halo: "#f97316" },
  concerned: { browY: -1, browTilt: 10, smile: -4, headTilt: 3, eyeOpen: 0.95, gazeX: 0, gazeY: 1, halo: "#e11d48" },
};

export const EXPRESSION_LABEL: Record<Expression, string> = {
  idle: "Ready to help",
  listening: "Listening…",
  thinking: "Checking options…",
  speaking: "Speaking",
  concerned: "Handling a disruption",
};
