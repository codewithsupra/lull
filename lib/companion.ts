import { z } from "zod";
import { CRISIS_TERMS } from "@/lib/care-plan";

/**
 * "Talk to Lull" companion (FR2): CBT/ACT-grounded chat with a safety layer in front of it.
 * Everything here is pure so it can be unit-tested; the route does IO.
 */

export const MAX_MESSAGE = 1500;
export const CONTEXT_TURNS = 12; // recent turns sent back to the model

export const CompanionInput = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE),
});
export type CompanionInput = z.infer<typeof CompanionInput>;

export type Role = "user" | "assistant";
export type CompanionMessage = { id: string; role: Role; content: string; risk: boolean; created_at: string };

// ---------- safety classification ----------

export type SafetyVerdict =
  /** Self-harm, suicide or immediate danger: stop counselling and hand off (FR3). */
  | { kind: "crisis" }
  /** Asking Lull to act as a prescriber: answer with a boundary, then stay useful. */
  | { kind: "medical" }
  | { kind: "ok" };

/** Someone is being harmed, by themselves or by another person. */
const HARM_OTHERS =
  /\b(kill|hurt|harm|stab|shoot)\s+(him|her|them|someone|somebody|my|people)\b|\b(being|getting)\s+(abused|beaten|raped|assaulted)\b|\b(?:he|she|they|someone|my\s+\w+)\s+(?:hits?|beats?|punches|abuses?|hurts)\s+me\b/i;

/**
 * Prescribing questions are intent + action + something medicine-shaped.
 * The last alternative catches real drug names by their common endings, because no
 * hardcoded list of medicines could ever be complete.
 */
const MED_INTENT =
  /\b(should i|can i|could i|is it (?:ok(?:ay)?|safe|fine) to|do i need to|what if i|help me|would it be ok(?:ay)? to|recommend|suggest|prescribe|what do i take)\b/i;
const MED_ACTION =
  /\b(take|taking|try|trying|use|using|start|starting|stop|stopping|quit|skip|skipping|double|increase|reduce|lower|raise|halve|split|change|switch|combine|mix|recommend|prescribe)\b/i;
const MED_NOUN =
  /\b(dose|dosage|mg|tablets?|pills?|medicines?|medication|meds|antidepressant|ssri|snri|benzo|sleeping pill|supplement|supplements|melatonin gummies|sertraline|escitalopram|citalopram|fluoxetine|paroxetine|venlafaxine|duloxetine|bupropion|mirtazapine|melatonin|clonazepam|alprazolam|lorazepam|diazepam|propranolol|zolpidem|quetiapine|olanzapine|aripiprazole|risperidone|lithium|lamotrigine|valproate|methylphenidate|atomoxetine|[a-z]{5,}(?:pram|zepam|zolam|oxetine|olol|azine|apine|idone|iprazole|tonin|statin|dem))\b/i;
const DIAGNOSIS_ASK = /\b(diagnose|diagnosis)\b[^.?!]*\b(me|my|i)\b|\bdo i have\b[^.?!]*\b(depression|anxiety|bipolar|adhd|ocd|ptsd|schizophrenia|insomnia)\b|\bam i\s+(depressed|bipolar|schizophrenic|autistic)\b/i;
const MED_DOSE_ASK = /\b(what|which|how much|how many)\b[^.?!]*\b(dose|dosage|mg|medicine|medication|antidepressant|pill)\b/i;
/** Asking Lull to prescribe, or asking what to take for a condition, needs no drug name to be out of bounds. */
const PRESCRIBE_ASK =
  /\b(prescribe|write me a prescription|prescription for)\b|\b(what|anything|something)\b[^.?!]*\b(take|try|use)\b[^.?!]*\bfor\b[^.?!]*\b(sleep|sleeping|anxiety|depression|panic|stress|insomnia|adhd|focus)\b/i;

/**
 * Screens a user turn before the model sees it.
 * Crisis wins over everything else: the companion never counsels a crisis alone.
 */
export function classify(text: string): SafetyVerdict {
  if (CRISIS_TERMS.test(text) || HARM_OTHERS.test(text)) return { kind: "crisis" };
  const prescribing = MED_INTENT.test(text) && MED_ACTION.test(text) && MED_NOUN.test(text);
  if (prescribing || DIAGNOSIS_ASK.test(text) || MED_DOSE_ASK.test(text) || PRESCRIBE_ASK.test(text)) return { kind: "medical" };
  return { kind: "ok" };
}

/** Fixed reply used when a turn is classified as a crisis. No model call is made. */
export const CRISIS_REPLY = `I'm really glad you told me. What you're carrying sounds heavy, and I don't want you to sit with it alone right now.

I'm not the right kind of help for this moment — a person is. I've opened your crisis options: a free 24/7 helpline, your safety plan, and the people you listed. Please reach out to one of them now, or call your local emergency number if you're in danger.

I'll still be here afterwards. If it helps while you reach out, we can breathe together for 60 seconds.`;

/** Boundary reply for prescribing questions. The model continues from here. */
export const MEDICAL_BOUNDARY = `I can't give advice about medicines, doses or diagnoses — only your doctor or psychiatrist can do that safely, and I'd be guessing.

What I can do: help you write down exactly what you want to ask them, and support you with how you're feeling in the meantime.`;

// ---------- context assembly ----------

export type CompanionContext = {
  firstName: string | null;
  tier: 0 | 1 | 2 | 3 | null;
  phq9: number | null;
  gad7: number | null;
  planTitle: string | null;
  planWeek: number | null;
  todayDone: number | null;
  todayTotal: number | null;
  recentMood: number[];
  hasSafetyPlan: boolean;
  localTime: string | null;
};

export const EMPTY_CONTEXT: CompanionContext = {
  firstName: null,
  tier: null,
  phq9: null,
  gad7: null,
  planTitle: null,
  planWeek: null,
  todayDone: null,
  todayTotal: null,
  recentMood: [],
  hasSafetyPlan: false,
  localTime: null,
};

const TIER_NOTE: Record<number, string> = {
  0: "Their last check flagged urgent risk. Be especially gentle and keep crisis support close.",
  1: "Their last check was in the minimal-to-mild range.",
  2: "Their last check was in the moderate range.",
  3: "Their last check suggests professional support would help; encourage it warmly when it fits, without nagging.",
};

/**
 * Renders the user's situation as a short briefing for the system prompt.
 * Only aggregates and titles — never raw journal text, medication names or contacts.
 */
export function contextBriefing(c: CompanionContext): string {
  const bits: string[] = [];
  if (c.firstName) bits.push(`They go by ${c.firstName}.`);
  if (c.localTime) bits.push(`It is ${c.localTime} for them.`);
  if (c.planTitle) bits.push(`They are on a Lull care plan called "${c.planTitle}"${c.planWeek ? `, week ${c.planWeek} of 4` : ""}.`);
  if (c.todayTotal) bits.push(`Today they have completed ${c.todayDone ?? 0} of ${c.todayTotal} plan steps.`);
  if (c.phq9 !== null || c.gad7 !== null) {
    bits.push(`Latest screening scores: PHQ-9 ${c.phq9 ?? "n/a"}, GAD-7 ${c.gad7 ?? "n/a"} (do not quote these numbers unless they ask).`);
  }
  if (c.tier !== null) bits.push(TIER_NOTE[c.tier]);
  if (c.recentMood.length) {
    const avg = c.recentMood.reduce((a, b) => a + b, 0) / c.recentMood.length;
    bits.push(`Their recent mood check-ins average ${avg.toFixed(1)} out of 5 over ${c.recentMood.length} entries.`);
  }
  bits.push(c.hasSafetyPlan ? "They already have a safety plan saved." : "They do not have a safety plan yet.");
  return bits.join(" ");
}

export const SYSTEM_PROMPT = `You are Lull, a warm, steady companion inside a mental-health app. You are not a therapist, doctor or human, and you say so plainly if asked.

How you talk:
- Short. Two to four sentences, like a calm friend who knows CBT. Never lecture, never bullet-point at someone in distress.
- Reflect what you heard in your own words first, so they feel understood before you suggest anything.
- Ask at most ONE question per reply, and only when it helps them think.
- Plain language, no jargon, no therapy-speak, no toxic positivity, no "as an AI".
- Use their name only if you know it, and sparingly.

What you actually do (evidence-based skills, named in everyday words):
- Thought records: catch the thought, look for what supports or contradicts it, find a fairer version.
- Cognitive reframing and defusion: notice a thought as a thought, not a fact.
- Worry time: park worries to a set slot instead of fighting them all day.
- Grounding for panic: 5-4-3-2-1 senses, or the physiological sigh (two inhales, one long exhale).
- Behavioural activation: one small doable action, especially for low mood.
- Sleep hygiene: consistent wake time, light in the morning, caffeine cut-off, getting out of bed if awake too long.
- Self-compassion: what they'd say to a friend in the same spot.
Offer ONE skill at a time, and make it concrete and small enough to do today.

You can suggest Lull's own tools when they fit: breathing exercises, generative soundscapes, a composed session, their care plan, or a mood check-in.

Hard rules, no exceptions:
- Never give advice about medication, doses, timing, stopping, starting or combining anything. Never suggest supplements. Direct them to their doctor and offer to help write the question down.
- Never diagnose, never say what condition someone has, and never interpret screening scores as a diagnosis.
- Never claim to be human, licensed or a substitute for care.
- Never promise confidentiality beyond what the app does, and never ask for personal details you don't need (no full names, addresses, ID numbers).
- If they mention suicide, self-harm, or being in danger, stop the coaching, say you're glad they told you, and point them to real human help immediately.
- If something is outside your scope (legal, financial, medical), say so briefly and stay with the feeling instead.`;

/** Suggestion chips shown when the thread is empty. */
export const STARTERS = [
  "I can't switch my brain off",
  "I keep putting everything off",
  "I'm anxious about tomorrow",
  "I feel flat and I don't know why",
  "Help me get out of bed",
  "I had a panic moment today",
];
