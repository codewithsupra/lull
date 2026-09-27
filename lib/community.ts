import { z } from "zod";
import { isHarmText } from "@/lib/crisis-terms";
import { redact } from "@/lib/redact";
import type { Category } from "@/lib/care-plan";

/**
 * Community: anonymous, moderated talk about medicines and related topics under /slug.
 * Pure and client-safe. The deterministic safety floor lives here (and is unit-tested); the AI
 * moderator in lib/community-server.ts adds judgement on top but can never loosen these rules.
 */

// ---------- communities ----------

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;

/** Reserved words and anything that reads like a shop. */
const RESERVED = new Set(["admin", "mod", "mods", "moderator", "lull", "official", "support", "staff", "help", "api", "new", "top", "hot", "all", "popular", "foryou", "for-you", "settings", "report", "c", "preview"]);
const SHOP_WORDS = /(buy|sell|sale|cheap|pharma(cy)?|order|shop|deal(er)?|vendor|plug|delivery|no-?rx|without-?(rx|prescription)|no-?prescription)/;

/** "Concerta XL" → "concerta-xl". Returns null if nothing usable is left. */
export function normalizeSlug(input: string | null | undefined): string | null {
  if (!input) return null;
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/, "");
  return SLUG_RE.test(slug) ? slug : null;
}

export function isAllowedSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED.has(slug) && !SHOP_WORDS.test(slug);
}

// ---------- inputs ----------

export const FLAIRS = ["experience", "question", "side_effects", "tip"] as const;
export type Flair = (typeof FLAIRS)[number];

export const PostInput = z.object({
  community: z.string().min(1).max(40),
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().max(5000).default(""),
  flair: z.enum(FLAIRS),
});
export type PostInput = z.infer<typeof PostInput>;

export const CommentInput = z.object({
  body: z.string().trim().min(1).max(2500),
  parent_id: z.uuid().nullable().optional(),
});

export const REPORT_REASONS = ["harmful_advice", "selling", "harassment", "spam", "personal_info", "crisis", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const ActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("vote"), type: z.enum(["post", "comment"]), id: z.uuid() }),
  z.object({ action: z.literal("report"), type: z.enum(["post", "comment"]), id: z.uuid(), reason: z.enum(REPORT_REASONS) }),
  z.object({ action: z.literal("delete"), type: z.enum(["post", "comment"]), id: z.uuid() }),
]);

/** Per-person rolling 24h limits, counted by the anonymous key. */
export const LIMITS = { posts: 5, comments: 40, communities: 3, votes: 300, reports: 20 } as const;

/** Reports that hide a post or comment. Mirrors the trigger in *_community.sql. */
export const HIDE_AT_REPORTS = 3;

// ---------- the deterministic safety floor ----------

export const MOD_REASONS = ["crisis", "sourcing", "dosing_advice", "stop_advice", "promotion", "harassment"] as const;
export type ModReason = (typeof MOD_REASONS)[number];

/** The AI moderator's instructions. Shared with scripts/redteam-community.mts so the eval tests the real prompt. */
export const MOD_PROMPT = `You moderate an anonymous peer-support community inside a mental-health app. Members share personal experiences with psychiatric and sleep medicines, therapy and related topics. Text may be English, Hindi or Hinglish.

ALLOW (this is the point of the community): personal experiences, including one's own medicine, dose and side effects ("Concerta 36mg works like magic for me", "sertraline made me nauseous the first week"); questions; encouragement; suggestions to talk to a doctor; general coping ideas; mild venting.

BLOCK only if the text clearly does one of:
- "dosing_advice": tells OTHER people what dose to take, how to increase/decrease, split, combine or time a medicine
- "stop_advice": tells others to stop, skip, switch or replace a prescribed medicine without their doctor
- "sourcing": offers, requests or explains how to get prescription medicines without a prescription, or trades/sells them
- "promotion": advertising, affiliate links, pharma or clinic marketing, repeated brand shilling
- "harassment": insults, slurs, threats, or mocking someone's condition
- "crisis": the writer expresses intent or plans to harm themselves or others

Reply with JSON only: {"allow": true} or {"allow": false, "reason": "<one of the reasons above>"}. When unsure, allow.`;

export const ModReply = z.object({ allow: z.boolean(), reason: z.enum(MOD_REASONS).optional() });

const NO_RX = /\b(without|no|w\/o)\s+(a\s+)?(prescription|rx|script|doctor)\b|बिना\s*(पर्चे|प्रिस्क्रिप्शन|डॉक्टर)|bina\s+(parche|prescription|doctor)/i;
const TRADE = /\b(buy|buying|sell|selling|sold|order|ordering|ship|shipping|deliver|delivery|source|vendor|dealer|plug|for\s+sale|in\s+stock|price\s+per)\b|बेच|ख\u093C?रीद|kharid|bech/i;
const CONTACT_ME = /\b(dm|pm|message|msg|text|call|whatsapp|telegram|wickr|signal|snap)\s+(me|us)\b|\bhit\s+me\s+up\b|मुझे\s*(मैसेज|कॉल)/i;

/**
 * Rules that hold a post regardless of what the AI moderator says:
 * - crisis language (English, Devanagari and romanised Hinglish) — the writer gets the crisis sheet;
 * - trading prescription medicines: buying/selling combined with "no prescription", or "DM me".
 * Returns null when the text passes the floor.
 */
export function ruleCheck(text: string): ModReason | null {
  if (isHarmText(text)) return "crisis";
  if ((TRADE.test(text) && NO_RX.test(text)) || CONTACT_ME.test(text) || /\bfor\s+sale\b/i.test(text)) return "sourcing";
  return null;
}

/** Strips phone numbers, emails, ids, dates and names-with-labels before anything is stored. */
export function scrub(text: string): string {
  return redact(text);
}

// ---------- ranking ----------

/** Reddit-style hot rank: upvotes decay with age so fresh posts get a chance. */
export function hotScore(score: number, createdAt: string, now: number): number {
  const hours = Math.max(0, (now - Date.parse(createdAt)) / 3_600_000);
  return (Math.max(score, 0) + 1) / Math.pow(hours + 2, 1.5);
}

export const SORTS = ["hot", "new", "top"] as const;
export type Sort = (typeof SORTS)[number];

export function sortPosts<T extends { score: number; created_at: string }>(posts: T[], sort: Sort, now: number): T[] {
  const copy = [...posts];
  if (sort === "new") return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (sort === "top") return copy.sort((a, b) => b.score - a.score || b.created_at.localeCompare(a.created_at));
  return copy.sort((a, b) => hotScore(b.score, b.created_at, now) - hotScore(a.score, a.created_at, now));
}

// ---------- recommendations ----------

const CATEGORY_SLUG: Record<Category, string | null> = {
  anxiety: "anxiety",
  insomnia: "insomnia",
  stress: "stress",
  low_mood: "depression",
  adhd: "adhd",
  other: null,
};

/**
 * Recommended communities, most personal first: the user's own medicines (by first word of the
 * name, e.g. "Sertraline 50mg" → sertraline), their plan's focus, then places they've engaged.
 * Only communities that exist are returned. Computed per request; never stored.
 */
export function recommendedSlugs(input: { medications: string[]; category: Category | null; engaged: string[] }, existing: ReadonlySet<string>, max = 8): string[] {
  const out: string[] = [];
  const add = (s: string | null) => {
    if (s && existing.has(s) && !out.includes(s)) out.push(s);
  };
  for (const m of input.medications) add(normalizeSlug(m.split(/[\s(,/]/)[0]));
  add(input.category ? CATEGORY_SLUG[input.category] : null);
  for (const e of input.engaged) add(e);
  if (out.length < 3) for (const s of ["side-effects", "anxiety", "depression", "insomnia"]) add(s);
  return out.slice(0, max);
}

// ---------- anonymous aliases ----------

/** Picks an alias from two word lists. The seed comes from the server (HMAC of author + thread). */
export function aliasFor(seed: readonly [number, number], words: { adjectives: readonly string[]; animals: readonly string[] }): string {
  return `${words.adjectives[seed[0] % words.adjectives.length]} ${words.animals[seed[1] % words.animals.length]}`;
}

// ---------- API shapes ----------

export type PostSummary = {
  id: string;
  community: string;
  title: string;
  body: string;
  flair: Flair;
  score: number;
  comment_count: number;
  created_at: string;
  alias: [number, number];
  mine: boolean;
  voted: boolean;
};

export type CommentView = {
  id: string;
  parent_id: string | null;
  body: string;
  score: number;
  created_at: string;
  alias: [number, number];
  op: boolean;
  mine: boolean;
  voted: boolean;
};

/** Nests replies under their parents (one level deep: replies to a reply attach to the top comment). */
export function threadComments(comments: CommentView[]): (CommentView & { replies: CommentView[] })[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const top = comments.filter((c) => !c.parent_id || !byId.has(c.parent_id)).map((c) => ({ ...c, replies: [] as CommentView[] }));
  const index = new Map(top.map((c) => [c.id, c]));
  for (const c of comments) {
    if (!c.parent_id || !byId.has(c.parent_id)) continue;
    let root = byId.get(c.parent_id)!;
    while (root.parent_id && byId.has(root.parent_id)) root = byId.get(root.parent_id)!;
    index.get(root.id)?.replies.push(c);
  }
  return top;
}

/** Compact relative time ("5m", "3h", "2d"), from a dictionary so Hindi reads naturally. */
export function ago(iso: string, now: number, t: { now: string; m: string; h: string; d: string }): string {
  const mins = Math.floor((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return t.now;
  if (mins < 60) return t.m.replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t.h.replace("{n}", String(hours));
  return t.d.replace("{n}", String(Math.floor(hours / 24)));
}

export type Feed = {
  recommended: { slug: string; posts: number }[];
  trending: { slug: string; votes: number; posts: number }[];
  top: PostSummary[];
  communities: string[];
};
