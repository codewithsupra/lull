import { levelFor } from "@/lib/care-plan";
import { fmt, plural, type Messages } from "@/lib/i18n";

/**
 * FR10 share cards: pure and client-safe. A card is drawn on a <canvas> in the user's own browser
 * (so Hindi shapes correctly and nothing is uploaded) from a deliberately tiny input type.
 * `CardStats` is the whole privacy boundary: engagement numbers only. No condition, no medicine,
 * no score, no mood — a card can't leak what it was never given.
 */

export type CardStats = { streak: number; xp: number; days_tended: number };
export const CARD_STAT_KEYS: readonly (keyof CardStats)[] = ["streak", "xp", "days_tended"];

export const CARD_KINDS = ["garden", "streak", "level"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const CARD_W = 1080;
export const CARD_H = 1350;

/** Which cards are worth offering. A "0-day streak" card is not something anyone wants to post. */
export function availableCards(s: CardStats): CardKind[] {
  return CARD_KINDS.filter((k) => (k === "garden" ? s.days_tended >= 1 : k === "streak" ? s.streak >= 2 : s.xp > 0));
}

export type CardText = { big: string; label: string; sub: string };

export function cardText(kind: CardKind, s: CardStats, t: Messages): CardText {
  const c = t.invite.cards;
  if (kind === "garden") {
    return { big: String(s.days_tended), label: plural(s.days_tended, c.gardenLabel), sub: c.gardenSub };
  }
  if (kind === "streak") {
    return { big: String(s.streak), label: plural(s.streak, c.streakLabel), sub: c.streakSub };
  }
  const lv = levelFor(s.xp);
  return { big: t.plan.levels[lv.index], label: fmt(c.levelLabel, { n: lv.level }), sub: fmt(c.levelSub, { xp: s.xp }) };
}

/** Deterministic PRNG (mulberry32) so a user's garden art is stable between renders and shares. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export type Plant = { x: number; height: number; bloom: boolean; hue: number; sway: number };

/**
 * One plant per tended day (capped so a long streak stays legible), laid out along the ground.
 * Every 3rd day blooms, echoing the night garden's "completed day blooms" rule without needing
 * per-day completion data.
 */
export function gardenPlants(s: CardStats, seed: number, max = 40): Plant[] {
  const rand = seededRandom(seed);
  const n = Math.min(Math.max(s.days_tended, 0), max);
  return Array.from({ length: n }, (_, i) => ({
    x: 0.08 + (0.84 * (i + 0.5)) / Math.max(n, 1) + (rand() - 0.5) * 0.02,
    // Capped at 0.24 of the card: with the ground at 0.8 the tallest bloom stays below the text block.
    height: 0.08 + rand() * 0.12 + Math.min(i / 60, 0.04),
    bloom: i % 3 === 2 || i === n - 1,
    hue: 150 + rand() * 120,
    sway: (rand() - 0.5) * 0.06,
  }));
}

/** Seed from the stats themselves: no user id or anything identifying goes into the art. */
export const cardSeed = (s: CardStats, kind: CardKind) => s.days_tended * 7919 + s.streak * 131 + s.xp + CARD_KINDS.indexOf(kind);
