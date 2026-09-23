import type { Messages } from "@/lib/i18n";

export type PhaseKind = "in" | "hold" | "out" | "rest";
/** `labelKey` indexes `t.tools.breath.phases`, so the on-screen cue follows the user's language. */
export type PhaseLabel = keyof Messages["tools"]["breath"]["phases"];
export type Phase = { kind: PhaseKind; seconds: number; labelKey: PhaseLabel };

export type PatternId = keyof Messages["tools"]["breath"]["patterns"];

/** Timing only. Names, taglines and the science note live in `t.tools.breath.patterns`. */
export type BreathPattern = {
  id: PatternId;
  phases: Phase[];
};

const p = (kind: PhaseKind, seconds: number, labelKey?: PhaseLabel): Phase => ({ kind, seconds, labelKey: labelKey ?? kind });

export const PATTERNS: BreathPattern[] = [
  { id: "coherent", phases: [p("in", 5.5), p("out", 5.5)] },
  { id: "box", phases: [p("in", 4), p("hold", 4), p("out", 4), p("rest", 4, "holdEmpty")] },
  { id: "478", phases: [p("in", 4), p("hold", 7), p("out", 8)] },
  { id: "sigh", phases: [p("in", 2.5, "inhale"), p("in", 1.2, "sipIn"), p("out", 7, "longExhale")] },
];

export const patternById = (id: string) => PATTERNS.find((x) => x.id === id) ?? PATTERNS[0];
export const cycleSeconds = (pat: BreathPattern) => pat.phases.reduce((s, ph) => s + ph.seconds, 0);
