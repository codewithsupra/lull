import { z } from "zod";
import type { Plan } from "@/lib/billing";

/**
 * DPDP Act 2023 data-principal rights centre (FR, NFR "Privacy & compliance"): see, download,
 * correct and erase. Pure and client-safe.
 *
 * The category list below is the single inventory of what Lull holds about a person. A test
 * checks it against every table the migrations create, so a new table can't quietly ship
 * without being covered by export and erasure.
 */

export const CATEGORIES = [
  { id: "account", tables: ["auth.users"], manage: null },
  { id: "plan", tables: ["care_profiles", "care_plans", "plan_medications", "plan_tasks"], manage: "/app/plan" },
  { id: "screeners", tables: ["screener_results"], manage: "/app/check" },
  { id: "safety", tables: ["safety_plans"], manage: "/app/safety" },
  { id: "companion", tables: ["companion_messages"], manage: "/app/talk" },
  { id: "journal", tables: ["mood_checkins"], manage: "/app/journal" },
  { id: "practice", tables: ["practice_sessions", "composed_sessions"], manage: "/app/compose" },
  { id: "reports", tables: ["report_shares"], manage: "/app/report" },
  { id: "buddy", tables: ["buddy_codes", "buddy_links", "pro_grants"], manage: "/app/invite" },
  { id: "community", tables: ["forum_posts", "forum_comments", "forum_votes", "forum_reports"], manage: "/app/c" },
  { id: "billing", tables: ["billing_entitlements", "pro_trials"], manage: "/app/pro" },
  { id: "devices", tables: ["push_subscriptions"], manage: "/app/plan" },
  { id: "usage", tables: ["ai_usage"], manage: null },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];

/**
 * Tables that hold no personal data, or hold it in a way export/erasure handles separately:
 * forum_communities (names of topics), forum_bans and forum_mod_log (keyed by anonymous handle;
 * bans are erased with community content), and payments.* (InsForge's billing ledger: financial
 * records kept for as long as tax law requires — disclosed on the page).
 */
export const NOT_PERSONAL = ["forum_communities", "forum_bans", "forum_mod_log"] as const;

/** Typed, not clicked: erasing an account must be a deliberate act. Same word in every language. */
export const CONFIRM_WORD = "DELETE";

export const EraseInput = z.object({
  scope: z.enum(["community", "account"]),
  confirm: z.literal(CONFIRM_WORD),
});

export const NameInput = z.object({ name: z.string().trim().min(1).max(60) });

/**
 * A paid subscription that will renew blocks account deletion: deleting the account would leave
 * the person being charged with no way to log in and cancel. Cancelled-at-period-end is fine.
 */
export function deletionBlocked(plan: Pick<Plan, "source" | "status" | "cancel_at"> | null): boolean {
  if (!plan || plan.source !== "subscription") return false;
  return !plan.cancel_at && ["active", "trialing", "past_due"].includes(plan.status ?? "");
}

export type PrivacySummary = {
  account: { email: string; name: string | null; created_at: string | null };
  consent: { version: string; at: string } | null;
  counts: Record<CategoryId, number>;
  deletion_blocked: boolean;
  grievance: { name: string; email: string } | null;
};

/** Strips keys that could point at another person, recursively. Used on every export section. */
const FOREIGN_KEYS = new Set(["user_id", "inviter_id", "invitee_id", "author_key", "voter_key", "reporter_key", "token_hash", "report_enc", "endpoint", "p256dh", "auth"]);
export function stripForeign<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripForeign) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !FOREIGN_KEYS.has(k)).map(([k, v]) => [k, stripForeign(v)])) as T;
  }
  return value;
}

export const EXPORT_VERSION = 1;
export const exportFilename = (now: Date) => `lull-my-data-${now.toISOString().slice(0, 10)}.json`;
