import { z } from "zod";
import { DICTIONARIES } from "@/lib/i18n";

/**
 * Community moderation (human review). Pure and client-safe. Moderators act on content and on
 * anonymous author KEYS — the tools never reveal, and never need, who anyone is.
 */

export const BAN_DURATIONS = { "7d": 7, "30d": 30, permanent: null } as const;
export type BanDuration = keyof typeof BAN_DURATIONS;
export const BAN_REASONS = ["harmful_advice", "selling", "harassment", "spam", "personal_info", "other"] as const;
export type BanReason = (typeof BAN_REASONS)[number];

const Target = { type: z.enum(["post", "comment"]), id: z.uuid() };

export const ModAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("restore"), ...Target }),
  z.object({ action: z.literal("remove"), ...Target }),
  z.object({ action: z.literal("dismiss"), ...Target }),
  z.object({ action: z.literal("ban"), ...Target, duration: z.enum(["7d", "30d", "permanent"]), reason: z.enum(BAN_REASONS) }),
  z.object({ action: z.literal("unban"), key: z.string().regex(/^[0-9a-f]{64}$/) }),
  z.object({ action: z.literal("resources"), post_id: z.uuid() }),
]);
export type ModAction = z.infer<typeof ModAction>;

/** The moderation team's own author key. HMAC output is never 64 zeros, so it can't collide with a member. */
export const TEAM_KEY = "0".repeat(64);

/** When a ban ends, or null for a permanent one. */
export function banUntil(duration: BanDuration, now: Date): string | null {
  const days = BAN_DURATIONS[duration];
  return days === null ? null : new Date(now.getTime() + days * 86_400_000).toISOString();
}

export function banActive(ban: { until: string | null } | null | undefined, now: Date): boolean {
  if (!ban) return false;
  return ban.until === null || Date.parse(ban.until) > now.getTime();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admins are listed by USER ID in a server-only env var. Not by email: email verification is
 * off, so an address proves nothing. Malformed entries are ignored rather than trusted.
 */
export function isAdmin(userId: string | null | undefined, envValue: string | undefined): boolean {
  if (!userId || !envValue) return false;
  const ids = envValue
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => UUID.test(s));
  return ids.includes(userId.toLowerCase());
}

/** A short, opaque handle for an author key, so a moderator can tell repeat offenders apart. */
export const handleOf = (key: string) => `#${key.slice(0, 8)}`;

/**
 * The text of a "Lull team" resources reply. It's stored once and read by people in either
 * language, so it carries both — and it points to the in-app Help sheet, which already knows the
 * reader's country, instead of hardcoding a number that could be wrong for them.
 */
export function teamResourcesText(): string {
  return `${DICTIONARIES.en.community.teamResources}\n\n${DICTIONARIES.hi.community.teamResources}`;
}

// ---------- dashboard shapes ----------

export type ModItem = {
  type: "post" | "comment";
  id: string;
  /** The post itself, or the post a comment belongs to. */
  post_id: string;
  community: string;
  title: string | null;
  body: string;
  hidden: boolean;
  score: number;
  created_at: string;
  author: string;
  author_banned: boolean;
  /** Present for queue items. */
  reports?: { count: number; crisis: boolean; reasons: string[]; first: string };
};

export type ModDashboard = {
  stats: { open_reports: number; hidden: number; active_bans: number; posts_24h: number; comments_24h: number };
  queue: ModItem[];
  recent: ModItem[];
  bans: { key: string; handle: string; until: string | null; reason: BanReason; created_at: string }[];
  log: { action: string; target_type: string | null; target_id: string | null; note: string | null; created_at: string }[];
};
