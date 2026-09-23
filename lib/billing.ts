/**
 * Pro plan catalog + feature gating (FR9). Client-safe: no secrets here.
 * Price IDs are public identifiers; override per environment with env vars when going live.
 */

export type Currency = "inr" | "usd";
export type Interval = "month" | "year";

export const PAYMENTS_ENV: "test" | "live" = process.env.NEXT_PUBLIC_PAYMENTS_ENV === "live" ? "live" : "test";

export const PRICES: Record<Currency, Record<Interval, { id: string; amount: number; label: string; perMonth: string }>> = {
  inr: {
    month: { id: process.env.NEXT_PUBLIC_PRICE_INR_MONTH ?? "price_1UIAShD7IzIkDFj8R1wYRvXK", amount: 199, label: "₹199", perMonth: "₹199/mo" },
    year: { id: process.env.NEXT_PUBLIC_PRICE_INR_YEAR ?? "price_1UIASkD7IzIkDFj8aXxCf1p2", amount: 1499, label: "₹1,499", perMonth: "₹125/mo" },
  },
  usd: {
    month: { id: process.env.NEXT_PUBLIC_PRICE_USD_MONTH ?? "price_1UIASbD7IzIkDFj8fk1Fl1Kw", amount: 7.99, label: "$7.99", perMonth: "$7.99/mo" },
    year: { id: process.env.NEXT_PUBLIC_PRICE_USD_YEAR ?? "price_1UIASeD7IzIkDFj8EZvnC7cH", amount: 59.99, label: "$59.99", perMonth: "$5/mo" },
  },
};

export function currencyForCountry(country: string | null | undefined): Currency {
  return (country ?? "").toUpperCase() === "IN" ? "inr" : "usd";
}

export function priceFor(currency: Currency, interval: Interval) {
  return PRICES[currency][interval];
}

export function isKnownPrice(id: string) {
  return Object.values(PRICES).some((c) => Object.values(c).some((p) => p.id === id));
}

export type Plan = {
  pro: boolean;
  source: "subscription" | "trial" | "free";
  status: string | null;
  interval: Interval | null;
  current_period_end: string | null;
  cancel_at: string | null;
  trial_ends_at: string | null;
  trial_available: boolean;
};

export const FREE_PLAN: Plan = {
  pro: false,
  source: "free",
  status: null,
  interval: null,
  current_period_end: null,
  cancel_at: null,
  trial_ends_at: null,
  trial_available: true,
};

export type Feature = "scan" | "replan" | "insight" | "compose" | "companion";

/** Free tier keeps everything that matters for safety and a real first win. */
export const FEATURES: Record<Feature, { free: false | number; pro: number; label: string }> = {
  scan: { free: false, pro: 20, label: "Prescription scan" },
  replan: { free: false, pro: 5, label: "Adaptive weekly re-plans" },
  insight: { free: false, pro: 20, label: "AI pattern insights" },
  compose: { free: 3, pro: 15, label: "AI-composed sessions" },
  companion: { free: 15, pro: 200, label: "Talk to Lull" },
};

/** Daily allowance for a feature on this plan; 0 means locked. */
export function allowance(plan: Pick<Plan, "pro">, feature: Feature): number {
  const f = FEATURES[feature];
  return plan.pro ? f.pro : f.free === false ? 0 : f.free;
}

export const PRO_PERKS = [
  "Talk to Lull whenever you need to",
  "Scan your prescription into a plan",
  "Adaptive re-plans every week",
  "15 AI-composed sessions a day",
  "AI insights on your mood patterns",
  "Doctor report & full night garden (soon)",
];

export const FREE_PERKS = ["Breathing, soundscapes & sleep timer", "Wellbeing check & care path", "Crisis tools, always", "Your Care Plan with XP & garden", "3 AI-composed sessions a day", "15 companion messages a day"];
