import { z } from "zod";

const level = z.coerce.number().min(0).max(1).catch(0);

export const PlanSchema = z.object({
  title: z.string().min(1).max(60).transform((s) => s.trim()),
  intention: z.string().min(1).max(240),
  breath: z.enum(["coherent", "box", "478", "sigh"]).catch("coherent"),
  mix: z
    .object({ rain: level, ocean: level, wind: level, fire: level, brown: level, drone: level, bowls: level })
    .partial()
    .catch({ drone: 0.4, ocean: 0.5 }),
  steps: z
    .array(z.object({ text: z.string().min(1).max(400), pause: z.coerce.number().min(3).max(45).catch(8) }))
    .min(3)
    .max(12),
  closing: z.string().max(300).catch("When you're ready, gently open your eyes."),
  care: z.string().max(400).nullable().optional().catch(null),
});

export type Plan = z.infer<typeof PlanSchema>;

export const planSeconds = (plan: Plan) =>
  plan.steps.reduce((s, step) => s + step.pause + step.text.split(/\s+/).length / 2.2, 0) + 20;
