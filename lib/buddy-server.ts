import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminInsForge } from "@/lib/insforge/admin";
import { BUDDY_ACTIVE_DAYS, asJoinResult, codeFromBytes, type BuddyView, type JoinResult } from "@/lib/buddy";
import type { CardStats } from "@/lib/share-card";
import type { ServerClient } from "@/lib/care-plan-server";
import { logError, logEvent } from "@/lib/log";
import { SITE } from "@/lib/site";

/** The user's invite code, created on first use. Retries on the (1 in 10^12) chance of a collision. */
export async function ensureCode(insforge: ServerClient): Promise<string> {
  const { data } = await insforge.database.from("buddy_codes").select("code").limit(1);
  const existing = (data as { code: string }[] | null)?.[0]?.code;
  if (existing) return existing;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = codeFromBytes(randomBytes(8));
    const { error } = await insforge.database.from("buddy_codes").insert([{ code }]);
    if (!error) return code;
    // A concurrent request may have created this user's code first: read it back.
    const again = await insforge.database.from("buddy_codes").select("code").limit(1);
    const raced = (again.data as { code: string }[] | null)?.[0]?.code;
    if (raced) return raced;
  }
  throw new Error("Could not create a buddy code");
}

export async function joinBuddy(userId: string, code: string): Promise<JoinResult> {
  const { data, error } = await createAdminInsForge().database.rpc("join_buddy", { p_invitee: userId, p_code: code });
  if (error) {
    logError("buddy.join.failed", error, { user: userId });
    return "invalid";
  }
  const result = asJoinResult(data);
  logEvent("buddy.join", { user: userId, result });
  return result;
}

/** Pays out any earned link involving this user. Never throws: it runs on ordinary page loads. */
export async function settleBuddy(userId: string): Promise<number> {
  try {
    const { data, error } = await createAdminInsForge().database.rpc("settle_buddy_rewards", { p_user: userId });
    if (error) throw error;
    const granted = Number(data) || 0;
    if (granted > 0) logEvent("buddy.rewarded", { user: userId, granted });
    return granted;
  } catch (err) {
    logError("buddy.settle.failed", err, { user: userId });
    return 0;
  }
}

type LinkRow = { invitee_id: string; inviter_id: string; created_at: string; rewarded_at: string | null };

export async function loadBuddyView(insforge: ServerClient, userId: string): Promise<BuddyView> {
  const [code, links, grants] = await Promise.all([
    ensureCode(insforge),
    insforge.database.from("buddy_links").select("invitee_id, inviter_id, created_at, rewarded_at").order("created_at", { ascending: false }),
    insforge.database.from("pro_grants").select("id", { count: "exact", head: true }).eq("source", "buddy"),
  ]);
  if (links.error) throw links.error;
  const rows = (links.data ?? []) as LinkRow[];
  const mine = rows.find((r) => r.invitee_id === userId) ?? null;

  let activeDays = 0;
  if (mine && !mine.rewarded_at) {
    // The user's OWN progress, counted exactly as the database counts it (server-stamped dates).
    const { data } = await insforge.database.from("plan_tasks").select("completed_at").not("completed_at", "is", null).gte("completed_at", mine.created_at);
    activeDays = new Set(((data ?? []) as { completed_at: string }[]).map((r) => r.completed_at.slice(0, 10))).size;
  }

  return {
    code,
    url: `${SITE.url}/join/${code}`,
    invited: rows.filter((r) => r.inviter_id === userId).map((r) => ({ joined_at: r.created_at, rewarded: !!r.rewarded_at })),
    joined: mine ? { joined_at: mine.created_at, rewarded: !!mine.rewarded_at, active_days: Math.min(activeDays, BUDDY_ACTIVE_DAYS) } : null,
    rewards_received: grants.count ?? 0,
  };
}

/** Engagement-only numbers for share cards. Nothing clinical is read here. */
export async function loadCardStats(insforge: ServerClient, today: string): Promise<CardStats> {
  const [stats, days] = await Promise.all([
    insforge.database.rpc("care_stats", { p_today: today }),
    insforge.database.from("plan_tasks").select("day").not("completed_at", "is", null).limit(2000),
  ]);
  const s = (stats.data ?? {}) as { xp?: number; streak?: number };
  return {
    streak: Number(s.streak) || 0,
    xp: Number(s.xp) || 0,
    days_tended: new Set(((days.data ?? []) as { day: string }[]).map((r) => r.day)).size,
  };
}
