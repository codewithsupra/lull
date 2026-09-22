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

export const SECTIONS: { id: SectionId; title: string; help: string; placeholder: string; contacts?: boolean }[] = [
  {
    id: "warning_signs",
    title: "My early warning signs",
    help: "Thoughts, feelings or situations that tell you a hard patch is starting. Spotting them early is the whole point.",
    placeholder: "e.g. I stop replying to messages",
  },
  {
    id: "coping",
    title: "Things I can do on my own",
    help: "Small actions that have helped before, without needing anyone else.",
    placeholder: "e.g. 4-7-8 breathing for 5 minutes",
  },
  {
    id: "distractions",
    title: "People and places that take my mind off it",
    help: "Company or surroundings that shift your state, even a little.",
    placeholder: "e.g. walk to the park near home",
  },
  {
    id: "people",
    title: "People I can ask for help",
    help: "Who you'd actually call at 2am. Add a number so it's one tap when you need it.",
    placeholder: "e.g. Ravi (brother)",
    contacts: true,
  },
  {
    id: "professionals",
    title: "Professionals and services",
    help: "Your doctor, therapist or a helpline you trust.",
    placeholder: "e.g. Dr. Mehta, psychiatrist",
    contacts: true,
  },
  {
    id: "safer",
    title: "Making my space safer",
    help: "Steps that put distance between you and anything you could use to hurt yourself.",
    placeholder: "e.g. leave my medicines with my flatmate",
  },
  {
    id: "reasons",
    title: "My reasons to keep going",
    help: "People, plans, places, anything. This is the section people say helps most.",
    placeholder: "e.g. my sister's wedding next year",
  },
];

/** A plan is useful once it has a coping step and either a person or a professional. */
export function isUsable(plan: SafetyPlan) {
  return plan.coping.length > 0 && plan.people.length + plan.professionals.length > 0;
}

export function completedSections(plan: SafetyPlan) {
  return SECTIONS.filter((s) => (plan[s.id] as unknown[]).length > 0).length;
}
