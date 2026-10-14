import "server-only";
import { cookies } from "next/headers";
import { createAuthActions } from "@insforge/sdk/ssr";
import { readable } from "@/lib/privacy-read";
import { createAdminInsForge } from "@/lib/insforge/admin";
import { getPlan } from "@/lib/billing-server";
import { authorKey } from "@/lib/community-keys";
import { logError, logEvent } from "@/lib/log";
import { CATEGORIES, EXPORT_VERSION, deletionBlocked, type CategoryId, type PrivacySummary } from "@/lib/privacy";
import type { ServerClient } from "@/lib/care-plan-server";

const admin = () => createAdminInsForge().database;

/** Every public table a person's rows live in (RLS scopes these to the caller). */
const OWN_TABLES = CATEGORIES.flatMap((c) => c.tables).filter((t) => !t.startsWith("auth.") && !t.startsWith("forum_"));

// ---------- summary ----------

export async function summary(insforge: ServerClient, userId: string): Promise<PrivacySummary> {
  const key = authorKey(userId);
  const [user, profile, plan, ...tableCounts] = await Promise.all([
    insforge.auth.getCurrentUser(),
    insforge.database.from("care_profiles").select("consent_version, consent_at").limit(1),
    getPlan(insforge),
    ...OWN_TABLES.map((t) => insforge.database.from(t).select("*", { count: "exact", head: true }).then((r) => [t, r.count ?? 0] as const)),
  ]);
  const forum = await Promise.all([
    admin().from("forum_posts").select("*", { count: "exact", head: true }).eq("author_key", key),
    admin().from("forum_comments").select("*", { count: "exact", head: true }).eq("author_key", key),
    admin().from("forum_votes").select("*", { count: "exact", head: true }).eq("voter_key", key),
    admin().from("forum_reports").select("*", { count: "exact", head: true }).eq("reporter_key", key),
  ]);

  const byTable = new Map<string, number>(tableCounts as (readonly [string, number])[]);
  byTable.set("forum_posts", forum[0].count ?? 0);
  byTable.set("forum_comments", forum[1].count ?? 0);
  byTable.set("forum_votes", forum[2].count ?? 0);
  byTable.set("forum_reports", forum[3].count ?? 0);
  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, c.id === "account" ? 1 : c.tables.reduce((n, t) => n + (byTable.get(t) ?? 0), 0)]),
  ) as Record<CategoryId, number>;

  const u = user.data?.user as { email: string; created_at?: string; profile?: { name?: string } } | undefined;
  const p = (profile.data as { consent_version: string; consent_at: string }[] | null)?.[0];
  const gName = process.env.NEXT_PUBLIC_GRIEVANCE_NAME;
  const gEmail = process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL;
  return {
    account: { email: u?.email ?? "", name: u?.profile?.name ?? null, created_at: u?.created_at ?? null },
    consent: p ? { version: p.consent_version, at: p.consent_at } : null,
    counts,
    deletion_blocked: deletionBlocked(plan),
    grievance: gName && gEmail ? { name: gName, email: gEmail } : null,
  };
}

// ---------- export ----------

export async function buildExport(insforge: ServerClient, userId: string) {
  const key = authorKey(userId);
  const rows = async (table: string) => {
    const { data, error } = await insforge.database.from(table).select("*").limit(5000);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(readable);
  };
  const forum = async (table: string, col: string) =>
    (((await admin().from(table).select("*").eq(col, key).limit(5000)).data ?? []) as Record<string, unknown>[]).map(readable);

  const [user, plan] = await Promise.all([insforge.auth.getCurrentUser(), getPlan(insforge)]);
  const u = user.data?.user as { email: string; created_at?: string; profile?: { name?: string } } | undefined;

  const [careProfiles, carePlans, meds, tasks, screeners, safety, companion, checkins, practice, composed, reports, codes, links, grants, trials, entitlements, devices, usage, posts, comments, votes, reportsFiled] =
    await Promise.all([
      rows("care_profiles"), rows("care_plans"), rows("plan_medications"), rows("plan_tasks"), rows("screener_results"), rows("safety_plans"),
      rows("companion_messages"), rows("mood_checkins"), rows("practice_sessions"), rows("composed_sessions"), rows("report_shares"),
      rows("buddy_codes"), insforge.database.from("buddy_links").select("invitee_id, created_at, rewarded_at"), rows("pro_grants"), rows("pro_trials"),
      rows("billing_entitlements"), rows("push_subscriptions"), rows("ai_usage"),
      forum("forum_posts", "author_key"), forum("forum_comments", "author_key"), forum("forum_votes", "voter_key"), forum("forum_reports", "reporter_key"),
    ]);

  // Buddy links name another person by id; export only which side you were on and the outcome.
  const buddyLinks = (((links as { data: unknown }).data ?? []) as { invitee_id: string; created_at: string; rewarded_at: string | null }[]).map((l) => ({
    role: l.invitee_id === userId ? "you joined a buddy" : "a friend joined you",
    joined_at: l.created_at,
    rewarded: !!l.rewarded_at,
  }));

  return {
    lull_export_version: EXPORT_VERSION,
    generated_at: new Date().toISOString(),
    note: "Everything Lull holds about you, decrypted. Community content is included even though it is stored without your account id. Payment records kept by our payments provider for tax law are listed under billing.",
    account: { email: u?.email ?? null, name: u?.profile?.name ?? null, created_at: u?.created_at ?? null },
    plan: { profile: careProfiles, plans: carePlans, medications: meds, tasks },
    screeners,
    safety_plan: safety,
    companion_messages: companion,
    journal: checkins,
    practice: { sessions: practice, composed },
    doctor_report_links: reports,
    buddy: { codes, links: buddyLinks, pro_grants: grants },
    community: { posts, comments, upvotes: votes, reports_you_filed: reportsFiled },
    billing: { current_plan: plan, trials, entitlements },
    devices: { push_subscriptions: devices.length, registered_at: devices.map((d) => d.created_at) },
    usage: usage.map((u2) => ({ kind: u2.kind, at: u2.created_at })),
  };
}

// ---------- erasure ----------

/** Erases everything a person did in Community, found by their anonymous key. Returns counts. */
export async function eraseCommunity(userId: string) {
  const key = authorKey(userId);
  const ids = async (table: string) => (((await admin().from(table).select("id").eq("author_key", key)).data ?? []) as { id: string }[]).map((r) => r.id);
  const postIds = await ids("forum_posts");
  const commentIds = await ids("forum_comments");
  // Comments by others under your posts disappear with the thread; collect them for vote cleanup.
  const threadCommentIds = postIds.length
    ? (((await admin().from("forum_comments").select("id").in("post_id", postIds)).data ?? []) as { id: string }[]).map((r) => r.id)
    : [];
  const allComments = [...new Set([...commentIds, ...threadCommentIds])];

  const del = (q: PromiseLike<{ error: unknown }>) => q.then((r) => { if (r.error) throw r.error; });
  if (postIds.length) {
    await del(admin().from("forum_votes").delete().eq("target_type", "post").in("target_id", postIds));
    await del(admin().from("forum_reports").delete().eq("target_type", "post").in("target_id", postIds));
  }
  if (allComments.length) {
    await del(admin().from("forum_votes").delete().eq("target_type", "comment").in("target_id", allComments));
    await del(admin().from("forum_reports").delete().eq("target_type", "comment").in("target_id", allComments));
  }
  await del(admin().from("forum_votes").delete().eq("voter_key", key));
  await del(admin().from("forum_reports").delete().eq("reporter_key", key));
  await del(admin().from("forum_comments").delete().eq("author_key", key));
  await del(admin().from("forum_posts").delete().eq("author_key", key));
  await del(admin().from("forum_bans").delete().eq("author_key", key));
  logEvent("privacy.community.erased", { posts: postIds.length, comments: commentIds.length });
  return { posts: postIds.length, comments: commentIds.length };
}

export type DeleteResult = { ok: true } | { ok: false; reason: "subscription" | "failed" };

/** Full erasure: community content by key, then the account row (everything else cascades). */
export async function deleteAccount(insforge: ServerClient, userId: string): Promise<DeleteResult> {
  if (deletionBlocked(await getPlan(insforge))) return { ok: false, reason: "subscription" };
  try {
    await eraseCommunity(userId);
    const { data, error } = await admin().rpc("delete_user_account", { p_user: userId });
    if (error) throw error;
    if (data !== true) throw new Error("account not deleted");
  } catch (err) {
    logError("privacy.account.delete_failed", err);
    return { ok: false, reason: "failed" };
  }
  // The account is gone; clear this browser's session cookies too.
  await createAuthActions({ cookies: await cookies() }).signOut().catch(() => undefined);
  logEvent("privacy.account.deleted");
  return { ok: true };
}
