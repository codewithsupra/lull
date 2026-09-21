export type PhaseKind = "in" | "hold" | "out" | "rest";
export type Phase = { kind: PhaseKind; seconds: number; label: string };

export type BreathPattern = {
  id: string;
  name: string;
  tagline: string;
  science: string;
  phases: Phase[];
};

const p = (kind: PhaseKind, seconds: number, label?: string): Phase => ({
  kind,
  seconds,
  label: label ?? { in: "Breathe in", hold: "Hold", out: "Breathe out", rest: "Rest" }[kind],
});

export const PATTERNS: BreathPattern[] = [
  {
    id: "coherent",
    name: "Coherent",
    tagline: "5.5 in · 5.5 out",
    science: "About 5.5 breaths a minute lines up breathing with heart-rate rhythms, which raises heart-rate variability.",
    phases: [p("in", 5.5), p("out", 5.5)],
  },
  {
    id: "box",
    name: "Box",
    tagline: "4 · 4 · 4 · 4",
    science: "A breathing drill used by Navy SEALs. The even count gives your attention one steady thing to follow.",
    phases: [p("in", 4), p("hold", 4), p("out", 4), p("rest", 4, "Hold empty")],
  },
  {
    id: "478",
    name: "4 · 7 · 8",
    tagline: "For falling asleep",
    science: "The long exhale engages the parasympathetic system, which slows the heart rate before sleep.",
    phases: [p("in", 4), p("hold", 7), p("out", 8)],
  },
  {
    id: "sigh",
    name: "Physiological sigh",
    tagline: "Fastest reset",
    science: "Two inhales re-inflate the air sacs in the lungs, and one long exhale clears CO₂. Stanford researchers found it lowered stress faster than other techniques they tested.",
    phases: [p("in", 2.5, "Inhale"), p("in", 1.2, "Sip in more"), p("out", 7, "Long exhale")],
  },
];

export const patternById = (id: string) => PATTERNS.find((x) => x.id === id) ?? PATTERNS[0];
export const cycleSeconds = (pat: BreathPattern) => pat.phases.reduce((s, ph) => s + ph.seconds, 0);
