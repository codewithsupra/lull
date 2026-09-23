import { z } from "zod";

/**
 * Safety plan (FR3), modelled on the Stanley-Brown Safety Planning Intervention:
 * warning signs → things I can do alone → people and places that distract me →
 * people I can ask for help → professionals → making my space safer → reasons to live.
 * Stored AES-256-GCM encrypted; contacts are the user's own entries and are never shared.
 */

const line = z.string().trim().min(1).max(160);
const contact = z.object({
  label: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(24).regex(/^[+0-9 ()-]*$/, "Numbers only").default(""),
});

export type Contact = z.infer<typeof contact>;

export const SafetyPlan = z.object({
  warning_signs: z.array(line).max(8).default([]),
  coping: z.array(line).max(8).default([]),
  distractions: z.array(line).max(8).default([]),
  people: z.array(contact).max(6).default([]),
  professionals: z.array(contact).max(4).default([]),
  safer: z.array(line).max(6).default([]),
  reasons: z.array(line).max(6).default([]),
  country: z.string().trim().length(2).toUpperCase().nullable().default(null),
});
export type SafetyPlan = z.infer<typeof SafetyPlan>;

export const EMPTY_PLAN: SafetyPlan = SafetyPlan.parse({});

export type SectionId = keyof Omit<SafetyPlan, "country">;

/**
 * Section order and shape only. The titles, help text and examples live in the dictionary
 * (`t.safety.sections`) so this stays language-free — the clinical structure is the same in
 * every language, the words are not.
 */
export const SECTIONS: { id: SectionId; contacts?: boolean }[] = [
  { id: "warning_signs" },
  { id: "coping" },
  { id: "distractions" },
  { id: "people", contacts: true },
  { id: "professionals", contacts: true },
  { id: "safer" },
  { id: "reasons" },
];

/** A plan is useful once it has a coping step and either a person or a professional. */
export function isUsable(plan: SafetyPlan) {
  return plan.coping.length > 0 && plan.people.length + plan.professionals.length > 0;
}

export function completedSections(plan: SafetyPlan) {
  return SECTIONS.filter((s) => (plan[s.id] as unknown[]).length > 0).length;
}
