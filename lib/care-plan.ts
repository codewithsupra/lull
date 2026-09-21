import { z } from "zod";

// ---------- shared constants (client + server) ----------

export const CONSENT_VERSION = "2026-09-v1";

export const CATEGORIES = [
  { id: "anxiety", label: "Anxiety", hint: "Worry, panic, racing thoughts" },
  { id: "insomnia", label: "Sleep trouble", hint: "Insomnia, waking at night" },
  { id: "stress", label: "Stress & burnout", hint: "Overwhelm, exhaustion" },
  { id: "low_mood", label: "Low mood", hint: "Mild depression, flatness" },
  { id: "adhd", label: "Focus / ADHD", hint: "Attention, restlessness" },
  { id: "other", label: "Something else", hint: "We'll build a general wellbeing plan" },
] as const;
export type Category = (typeof CATEGORIES)[number]["id"];

export const GOALS = [
  "Fall asleep faster",
  "Stay asleep",
  "Fewer panic moments",
  "Calmer mornings",
  "More energy",
  "Take meds on time",
  "Better focus",
  "Less overthinking",
  "Understand my diagnosis",
] as const;

export const XP = { medication: 20, habit: 15, session: 30, learn: 10, reflect: 10 } as const;
export const DAY_BONUS = 50;
export type TaskKind = keyof typeof XP;
export type Slot = "morning" | "afternoon" | "evening" | "night";

export const LEVELS = ["Seedling", "Sprout", "Sapling", "Bloom", "Grove", "Canopy", "Old Growth", "Ancient Forest"];
export function levelFor(xp: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 60)) + 1;
  const floor = 60 * (level - 1) ** 2;
  const next = 60 * level ** 2;
  return { level, name: LEVELS[Math.min(level - 1, LEVELS.length - 1)], progress: (xp - floor) / (next - floor), toNext: next - xp };
}

export const SESSION_REF = /^(breathe:(coherent|box|478|sigh):(1|3|5|10)|sounds:(night-rain|low-tide|cabin-fire|deep-focus|temple)|compose)$/;

export const CRISIS_TERMS =
  /\b(suicid\w*|kill (?:my ?self|myself)|end (?:my|it all)|self[- ]?harm|hurt(?:ing)? myself|cut(?:ting)? myself|don'?t want to (?:live|be alive|wake up)|better off dead|overdos\w*)\b/i;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const MedicationInput = z.object({
  name: z.string().trim().min(1).max(80),
  dose: z.string().trim().max(60).default(""),
  instructions: z.string().trim().max(200).default(""),
  times: z.array(hhmm).max(6).default([]),
  as_needed: z.boolean().default(false),
});
export type MedicationInput = z.infer<typeof MedicationInput>;

export const IntakeInput = z.object({
  category: z.enum(["anxiety", "insomnia", "stress", "low_mood", "adhd", "other"]),
  duration: z.enum(["new", "months", "years"]),
  severity: z.number().int().min(1).max(5),
  wake: hhmm,
  sleep: hhmm,
  goals: z.array(z.string().max(60)).max(6).default([]),
  text: z.string().trim().max(1200).default(""),
  medications: z.array(MedicationInput).max(12).default([]),
  timezone: z.string().max(64).default("UTC"),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consent: z.literal(true),
});
export type IntakeInput = z.infer<typeof IntakeInput>;

// What the extraction model must return (then redacted).
export const Extraction = z.object({
  readable: z.boolean().catch(true),
  medications: z
    .array(
      z.object({
        name: z.string().max(80),
        dose: z.string().max(60).catch(""),
        frequency: z.string().max(80).catch(""),
        times: z.array(z.string()).max(6).catch([]),
        instructions: z.string().max(200).catch(""),
        as_needed: z.boolean().catch(false),
      }),
    )
    .max(12)
    .catch([]),
  diagnosis_hint: z.string().max(80).nullable().catch(null),
});
export type Extraction = z.infer<typeof Extraction>;

// ---------- LLM plan output ----------

const slot = z.enum(["morning", "afternoon", "evening", "night"]).catch("evening");
const days = z.union([z.literal("daily"), z.literal("weekdays"), z.literal("weekends"), z.array(z.number().int().min(0).max(6)).max(7)]).catch("daily");

export const PlanItem = z.object({
  title: z.string().min(1).max(90),
  detail: z.string().max(400).catch(""),
  slot,
  time: hhmm.nullable().optional().catch(null),
  days,
});

export const WeekPlan = z.object({
  theme: z.string().max(60),
  focus: z.string().max(240),
  habits: z.array(PlanItem).min(2).max(6),
  sessions: z.array(PlanItem.extend({ ref: z.string().regex(SESSION_REF).catch("breathe:coherent:5") })).min(1).max(3),
  learn: z.array(z.object({ title: z.string().max(90), body: z.string().max(700) })).min(3).max(7),
  reflect: z.string().max(200).catch("What felt a little lighter today?"),
});
export type WeekPlan = z.infer<typeof WeekPlan>;

export const PlanOutput = z.object({
  title: z.string().min(1).max(60),
  summary: z.string().max(400),
  context: z.string().max(400).catch(""),
  care: z.string().max(400).nullable().optional().catch(null),
  doctor_flags: z.array(z.string().max(240)).max(6).catch([]),
  doctor_questions: z.array(z.string().max(200)).max(8).catch([]),
  roadmap: z.array(z.object({ week: z.number().int().min(1).max(4), theme: z.string().max(60), focus: z.string().max(240) })).length(4),
  week: WeekPlan,
});
export type PlanOutput = z.infer<typeof PlanOutput>;

/** Encrypted blob stored on care_plans.outline_enc. */
export type Outline = {
  title: string;
  summary: string;
  context: string;
  category: Category;
  severity: number;
  wake: string;
  sleep: string;
  goals: string[];
  roadmap: PlanOutput["roadmap"];
  doctor_questions: string[];
  weeks: Record<number, { theme: string; focus: string; learn: WeekPlan["learn"] }>;
};

// ---------- API shapes returned to the client (decrypted) ----------

export type PlanTask = {
  id: string;
  day: string;
  slot: Slot;
  remind_at: string | null;
  kind: TaskKind;
  title: string;
  detail: string | null;
  session_ref: string | null;
  xp: number;
  completed_at: string | null;
};

export type PlanView = {
  id: string;
  category: Category;
  week: number;
  started_at: string;
  title: string;
  summary: string;
  roadmap: Outline["roadmap"];
  learn: WeekPlan["learn"];
  doctor_questions: string[];
  doctor_flags: string[];
  medications: { id: string; name: string; dose: string | null; instructions: string | null; times: string[] }[];
  tasks: PlanTask[];
  week_complete_ratio: number;
  can_replan: boolean;
};

export function slotForTime(t: string): Slot {
  const h = Number(t.slice(0, 2));
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export function sessionHref(ref: string, taskId: string) {
  const [kind, a, b] = ref.split(":");
  if (kind === "breathe") return `/app/breathe?pattern=${a}&minutes=${b}&task=${taskId}`;
  if (kind === "sounds") return `/app/sounds?preset=${a}&task=${taskId}`;
  return `/app/compose?task=${taskId}`;
}
