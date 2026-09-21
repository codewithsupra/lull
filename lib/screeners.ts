/**
 * Validated screening instruments + stepped-care routing (FR1).
 * PHQ-9 and GAD-7 were developed by Drs. Spitzer, Williams, Kroenke et al. with an educational
 * grant from Pfizer Inc. No permission is required to reproduce, translate, display or distribute.
 * The sleep snapshot is Lull's own non-clinical check (the ISI is licensed and not used here).
 */

import { z } from "zod";

export type InstrumentId = "phq9" | "gad7" | "sleep";

export type Instrument = {
  id: InstrumentId;
  name: string;
  stem: string;
  items: string[];
  options: { label: string; value: number }[];
  clinical: boolean;
};

const FREQ = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

export const PHQ9: Instrument = {
  id: "phq9",
  name: "PHQ-9",
  stem: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  items: [
    "Little interest or pleasure in doing things",
    "Feeling down, depressed, or hopeless",
    "Trouble falling or staying asleep, or sleeping too much",
    "Feeling tired or having little energy",
    "Poor appetite or overeating",
    "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    "Trouble concentrating on things, such as reading the newspaper or watching television",
    "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
    "Thoughts that you would be better off dead or of hurting yourself in some way",
  ],
  options: FREQ,
  clinical: true,
};

export const GAD7: Instrument = {
  id: "gad7",
  name: "GAD-7",
  stem: "Over the last 2 weeks, how often have you been bothered by the following problems?",
  items: [
    "Feeling nervous, anxious or on edge",
    "Not being able to stop or control worrying",
    "Worrying too much about different things",
    "Trouble relaxing",
    "Being so restless that it is hard to sit still",
    "Becoming easily annoyed or irritable",
    "Feeling afraid as if something awful might happen",
  ],
  options: FREQ,
  clinical: true,
};

export const SLEEP: Instrument = {
  id: "sleep",
  name: "Sleep snapshot",
  stem: "Thinking about the last 2 weeks…",
  items: ["How often did it take you a long time to fall asleep?", "How often did you wake in the night and struggle to get back to sleep?", "How often did poor sleep affect your next day?"],
  options: FREQ,
  clinical: false,
};

export const INSTRUMENTS: Instrument[] = [PHQ9, GAD7, SLEEP];

/** PHQ-9 item 9 (thoughts of death/self-harm), zero-based. */
export const PHQ9_RISK_ITEM = 8;

export const DIFFICULTY_OPTIONS = ["Not difficult at all", "Somewhat difficult", "Very difficult", "Extremely difficult"] as const;

export type Severity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";

export function score(instrument: Instrument, answers: number[]): number {
  if (answers.length !== instrument.items.length) throw new Error(`${instrument.name} needs ${instrument.items.length} answers`);
  const max = Math.max(...instrument.options.map((o) => o.value));
  return answers.reduce((sum, a) => {
    if (!Number.isInteger(a) || a < 0 || a > max) throw new Error(`${instrument.name} answer out of range`);
    return sum + a;
  }, 0);
}

/** Published cut-offs: PHQ-9 (Kroenke 2001), GAD-7 (Spitzer 2006). Sleep snapshot: Lull's own bands. */
export function severity(id: InstrumentId, total: number): Severity {
  if (id === "phq9") {
    if (total >= 20) return "severe";
    if (total >= 15) return "moderately_severe";
    if (total >= 10) return "moderate";
    if (total >= 5) return "mild";
    return "minimal";
  }
  if (id === "gad7") {
    if (total >= 15) return "severe";
    if (total >= 10) return "moderate";
    if (total >= 5) return "mild";
    return "minimal";
  }
  if (total >= 7) return "moderate";
  if (total >= 4) return "mild";
  return "minimal";
}

export const SEVERITY_COPY: Record<Severity, string> = {
  minimal: "Minimal",
  mild: "Mild",
  moderate: "Moderate",
  moderately_severe: "Moderately severe",
  severe: "Severe",
};

// ---------- stepped-care routing ----------

/** T0 urgent · T1 self-guided · T2 guided + peers · T3 therapist recommended */
export type Tier = 0 | 1 | 2 | 3;

export type RiskFollowUp = { thoughts_now: boolean; plan_or_intent: boolean };

export type Snapshot = { phq9: number; gad7: number; risk_item: number; at: string };

export const TIERS: Record<Tier, { name: string; headline: string; next: string }> = {
  0: {
    name: "Urgent support",
    headline: "Right now, talking to someone matters most.",
    next: "Please contact a crisis line or emergency services now. Your safety plan and helplines are one tap away.",
  },
  1: {
    name: "Self-guided",
    headline: "You're doing okay. Let's build on it.",
    next: "Your Care Plan, breathing and sleep tools are a great fit. We'll check in again in two weeks.",
  },
  2: {
    name: "Guided support",
    headline: "Things are weighing on you. You don't have to do this alone.",
    next: "A structured Care Plan plus a peer circle is recommended. If it doesn't ease in a few weeks, we'll suggest a therapist.",
  },
  3: {
    name: "Therapist recommended",
    headline: "It would really help to talk to a professional.",
    next: "Your answers suggest support from a qualified therapist or doctor would help. Lull will keep supporting you alongside them.",
  },
};

/**
 * Routes a user to a care tier.
 * - Any positive PHQ-9 item 9 is a risk flag (always surfaces crisis resources).
 * - T0 when risk is current: item 9 ≥ 2, or the follow-up reports thoughts now or a plan/intent.
 * - T3 for PHQ-9 ≥ 15, GAD-7 ≥ 15, any risk flag, or no meaningful improvement after ≥ 6 weeks
 *   while still in the moderate range (< 5-point PHQ-9 drop — the minimal clinically important difference).
 * - T2 for PHQ-9 or GAD-7 in the moderate range (10–14).
 * - T1 otherwise.
 */
export function route(current: Snapshot, history: Snapshot[] = [], followUp?: RiskFollowUp): { tier: Tier; risk: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const risk = current.risk_item >= 1;

  if (risk && (current.risk_item >= 2 || followUp?.thoughts_now || followUp?.plan_or_intent)) {
    return { tier: 0, risk, reasons: ["Current thoughts of self-harm reported"] };
  }

  if (current.phq9 >= 15) reasons.push("PHQ-9 in the moderately severe or severe range");
  if (current.gad7 >= 15) reasons.push("GAD-7 in the severe range");
  if (risk) reasons.push("Thoughts of death or self-harm reported in the last two weeks");

  const baseline = [...history].sort((a, b) => a.at.localeCompare(b.at))[0];
  if (baseline) {
    const days = (Date.parse(current.at) - Date.parse(baseline.at)) / 86_400_000;
    const stillModerate = current.phq9 >= 10 || current.gad7 >= 10;
    const improvedPhq = baseline.phq9 - current.phq9 >= 5;
    const improvedGad = baseline.gad7 - current.gad7 >= 4;
    if (days >= 42 && stillModerate && !improvedPhq && !improvedGad) reasons.push("Not improving after 6 weeks of self-help");
  }
  if (reasons.length) return { tier: 3, risk, reasons };

  if (current.phq9 >= 10) reasons.push("PHQ-9 in the moderate range");
  if (current.gad7 >= 10) reasons.push("GAD-7 in the moderate range");
  if (reasons.length) return { tier: 2, risk, reasons };

  return { tier: 1, risk, reasons: ["Scores in the minimal-to-mild range"] };
}

export const RESCREEN_DAYS = 14;

export function nextDue(lastAt: string | null): string | null {
  if (!lastAt) return null;
  return new Date(Date.parse(lastAt) + RESCREEN_DAYS * 86_400_000).toISOString();
}

// ---------- submission → evaluated record ----------


const answers = (n: number) => z.array(z.number().int().min(0).max(3)).length(n);

export const ScreenerSubmission = z.object({
  phq9: answers(9),
  gad7: answers(7),
  sleep: answers(3),
  difficulty: z.number().int().min(0).max(3).nullable().default(null),
  followup: z.object({ thoughts_now: z.boolean(), plan_or_intent: z.boolean() }).optional(),
});
export type ScreenerSubmission = z.infer<typeof ScreenerSubmission>;

export type ScreenerRecord = {
  phq9: { answers: number[]; score: number; severity: Severity };
  gad7: { answers: number[]; score: number; severity: Severity };
  sleep: { answers: number[]; score: number; severity: Severity };
  difficulty: number | null;
  followup: RiskFollowUp | null;
  tier: Tier;
  risk: boolean;
  reasons: string[];
  at: string;
};

/** Scores a submission server-side (never trusts client totals) and routes it against history. */
export function evaluate(sub: ScreenerSubmission, history: ScreenerRecord[], at: string): ScreenerRecord {
  const phq9 = score(PHQ9, sub.phq9);
  const gad7 = score(GAD7, sub.gad7);
  const sleep = score(SLEEP, sub.sleep);
  const current: Snapshot = { phq9, gad7, risk_item: sub.phq9[PHQ9_RISK_ITEM], at };
  const { tier, risk, reasons } = route(
    current,
    history.map((h) => ({ phq9: h.phq9.score, gad7: h.gad7.score, risk_item: h.phq9.answers[PHQ9_RISK_ITEM], at: h.at })),
    risk_followup(sub),
  );
  return {
    phq9: { answers: sub.phq9, score: phq9, severity: severity("phq9", phq9) },
    gad7: { answers: sub.gad7, score: gad7, severity: severity("gad7", gad7) },
    sleep: { answers: sub.sleep, score: sleep, severity: severity("sleep", sleep) },
    difficulty: sub.difficulty,
    followup: risk_followup(sub) ?? null,
    tier,
    risk,
    reasons,
    at,
  };
}

function risk_followup(sub: ScreenerSubmission): RiskFollowUp | undefined {
  // Follow-up answers only count when item 9 was actually endorsed.
  return sub.phq9[PHQ9_RISK_ITEM] >= 1 ? sub.followup : undefined;
}
