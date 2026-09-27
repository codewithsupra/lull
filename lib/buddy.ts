/**
 * FR10 buddy invites: pure, client-safe helpers. The rules themselves are enforced in SQL
 * (migrations/*_buddy-invites.sql: join_buddy / settle_buddy_rewards); these constants mirror them
 * for the UI, and tests/buddy.test.ts fails if the two ever drift apart.
 */

/** Pro days each person gets when a buddy link pays out. */
export const BUDDY_DAYS = 14;
/** Distinct calendar days (server-stamped) the invited friend must complete plan tasks on. */
export const BUDDY_ACTIVE_DAYS = 3;
/** Lifetime cap on buddy rewards per person. */
export const BUDDY_MAX_REWARDS = 3;

/** Crockford-style alphabet: no 0/O, 1/I, so a code read aloud or typed from a screenshot survives. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
export const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Maps random bytes onto the alphabet. 256 is a multiple of 32, so there is no modulo bias. */
export function codeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < CODE_LENGTH) throw new Error("Need at least 8 random bytes");
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/**
 * Normalises what a person typed or pasted: case, spaces, dashes, and a whole invite URL.
 * Returns null for anything that can't be a code, so it never reaches the database.
 */
export function normalizeCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const tail = input.trim().split("/").filter(Boolean).pop() ?? "";
  const code = tail.toUpperCase().replace(/[\s-]/g, "");
  return CODE_RE.test(code) ? code : null;
}

/** ABCD-EFGH: easier to read aloud and to check by eye. */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

export type JoinResult = "joined" | "invalid" | "self" | "already" | "mutual";
export const JOIN_RESULTS: readonly JoinResult[] = ["joined", "invalid", "self", "already", "mutual"];

export const asJoinResult = (v: unknown): JoinResult => (JOIN_RESULTS.includes(v as JoinResult) ? (v as JoinResult) : "invalid");

export type BuddyView = {
  code: string;
  url: string;
  /** People this user invited. Deliberately no activity counts: a friend's adherence is theirs. */
  invited: { joined_at: string; rewarded: boolean }[];
  /** This user's own link, if they joined someone — with their OWN progress toward the reward. */
  joined: { joined_at: string; rewarded: boolean; active_days: number } | null;
  rewards_received: number;
};

/** Short-lived cookie that carries an invite code through sign-up. */
export const BUDDY_COOKIE = "lull_buddy";
export const BUDDY_COOKIE_MAX_AGE = 7 * 24 * 3600;

/**
 * Where to land after signing in: back to a pending invite if one came through /join/<code>,
 * otherwise the app. Only a shape-valid code can influence the path, so this is not an open redirect.
 */
export function afterSignInPath(buddyCookie: string | null | undefined): string {
  const code = normalizeCode(buddyCookie);
  return code ? `/app/invite?join=${code}` : "/app";
}
