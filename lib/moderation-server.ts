import "server-only";
import { NextResponse } from "next/server";
import { communityDb } from "@/lib/community-server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { logEvent } from "@/lib/log";
import {
  TEAM_KEY,
  banActive,
  banUntil,
  handleOf,
  isAdmin,
  teamResourcesText,
  type BanReason,
  type ModAction,
  type ModDashboard,
  type ModItem,
} from "@/lib/moderation";

const db = communityDb;

/**
 * Admin gate. Non-admins (and signed-out visitors) get a plain 404 — the moderation tools don't
 * advertise that they exist.
 */
export async function requireAdmin() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.auth.getCurrentUser();
  const userId = data?.user?.id;
  if (!userId || !isAdmin(userId, process.env.ADMIN_USER_IDS)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  }
  return { userId } as const;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  return !("error" in (await requireAdmin()));
}

// ---------- bans (also used by the member-facing routes) ----------

export async function banFor(key: string): Promise<{ until: string | null } | null> {
  const { data } = await db().from("forum_bans").select("until").eq("author_key", key).limit(1);
  const ban = (data as { until: string | null }[] | null)?.[0] ?? null;
  return banActive(ban, new Date()) ? ban : null;
}

// ---------- dashboard ----------

type PostRow = { id: string; community: string; author_key: string; title: string; body: string; hidden: boolean; score: number; created_at: string };
type CommentRow = { id: string; post_id: string; author_key: string; body: string; hidden: boolean; score: number; created_at: string };

async function itemsFor(posts: PostRow[], comments: CommentRow[]): Promise<Map<string, ModItem>> {
  // Comments need their post's community; one batched lookup.
  const parentIds = [...new Set(comments.map((c) => c.post_id))];
  const parents = parentIds.length
    ? (((await db().from("forum_posts").select("id, community").in("id", parentIds)).data ?? []) as { id: string; community: string }[])
    : [];
  const communityOf = new Map(parents.map((p) => [p.id, p.community]));
  const keys = [...new Set([...posts, ...comments].map((r) => r.author_key))];
  const bans = keys.length ? (((await db().from("forum_bans").select("author_key, until").in("author_key", keys)).data ?? []) as { author_key: string; until: string | null }[]) : [];
  const now = new Date();
  const banned = new Set(bans.filter((b) => banActive(b, now)).map((b) => b.author_key));

  const out = new Map<string, ModItem>();
  for (const p of posts) {
    out.set(`post:${p.id}`, { type: "post", id: p.id, post_id: p.id, community: p.community, title: p.title, body: p.body, hidden: p.hidden, score: p.score, created_at: p.created_at, author: handleOf(p.author_key), author_banned: banned.has(p.author_key) });
  }
  for (const c of comments) {
    out.set(`comment:${c.id}`, { type: "comment", id: c.id, post_id: c.post_id, community: communityOf.get(c.post_id) ?? "?", title: null, body: c.body, hidden: c.hidden, score: c.score, created_at: c.created_at, author: c.author_key === TEAM_KEY ? "Lull team" : handleOf(c.author_key), author_banned: banned.has(c.author_key) });
  }
  return out;
}

const POST_COLS = "id, community, author_key, title, body, hidden, score, created_at";
const COMMENT_COLS = "id, post_id, author_key, body, hidden, score, created_at";

export async function loadDashboard(): Promise<ModDashboard> {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [queue, recentPosts, recentComments, bans, log, openReports, hiddenPosts, hiddenComments, posts24, comments24] = await Promise.all([
    db().rpc("forum_mod_queue", { p_limit: 50 }),
    db().from("forum_posts").select(POST_COLS).order("created_at", { ascending: false }).limit(25),
    db().from("forum_comments").select(COMMENT_COLS).order("created_at", { ascending: false }).limit(25),
    db().from("forum_bans").select("author_key, until, reason, created_at").order("created_at", { ascending: false }).limit(100),
    db().from("forum_mod_log").select("action, target_type, target_id, note, created_at").order("created_at", { ascending: false }).limit(50),
    db().from("forum_reports").select("*", { count: "exact", head: true }).is("resolved_at", null),
    db().from("forum_posts").select("*", { count: "exact", head: true }).eq("hidden", true),
    db().from("forum_comments").select("*", { count: "exact", head: true }).eq("hidden", true),
    db().from("forum_posts").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
    db().from("forum_comments").select("*", { count: "exact", head: true }).gte("created_at", dayAgo),
  ]);
  if (queue.error) throw queue.error;

  const q = (queue.data ?? []) as { target_type: "post" | "comment"; target_id: string; reports: number; crisis: boolean; reasons: string[]; first_reported: string }[];
  const qPostIds = q.filter((r) => r.target_type === "post").map((r) => r.target_id);
  const qCommentIds = q.filter((r) => r.target_type === "comment").map((r) => r.target_id);
  const [qPosts, qComments] = await Promise.all([
    qPostIds.length ? db().from("forum_posts").select(POST_COLS).in("id", qPostIds) : Promise.resolve({ data: [] }),
    qCommentIds.length ? db().from("forum_comments").select(COMMENT_COLS).in("id", qCommentIds) : Promise.resolve({ data: [] }),
  ]);
  const queueItems = await itemsFor((qPosts.data ?? []) as PostRow[], (qComments.data ?? []) as CommentRow[]);
  const recentItems = await itemsFor((recentPosts.data ?? []) as PostRow[], (recentComments.data ?? []) as CommentRow[]);

  const now = new Date();
  const activeBans = ((bans.data ?? []) as { author_key: string; until: string | null; reason: BanReason; created_at: string }[]).filter((b) => banActive(b, now));

  return {
    stats: {
      open_reports: openReports.count ?? 0,
      hidden: (hiddenPosts.count ?? 0) + (hiddenComments.count ?? 0),
      active_bans: activeBans.length,
      posts_24h: posts24.count ?? 0,
      comments_24h: comments24.count ?? 0,
    },
    // Reported content that has since been deleted simply drops out of the queue.
    queue: q.flatMap((r) => {
      const item = queueItems.get(`${r.target_type}:${r.target_id}`);
      return item ? [{ ...item, reports: { count: Number(r.reports), crisis: r.crisis, reasons: r.reasons, first: r.first_reported } }] : [];
    }),
    recent: [...recentItems.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 40),
    bans: activeBans.map((b) => ({ key: b.author_key, handle: handleOf(b.author_key), until: b.until, reason: b.reason, created_at: b.created_at })),
    log: (log.data ?? []) as ModDashboard["log"],
  };
}

// ---------- actions ----------

const table = (type: "post" | "comment") => (type === "post" ? "forum_posts" : "forum_comments");

async function authorOf(type: "post" | "comment", id: string): Promise<string | null> {
  const { data } = await db().from(table(type)).select("author_key").eq("id", id).limit(1);
  return (data as { author_key: string }[] | null)?.[0]?.author_key ?? null;
}

async function resolveReports(type: "post" | "comment", id: string, resolution: "restored" | "removed" | "dismissed") {
  await db().from("forum_reports").update({ resolved_at: new Date().toISOString(), resolution }).eq("target_type", type).eq("target_id", id).is("resolved_at", null);
}

async function record(action: string, target_type: string | null, target_id: string | null, note: string | null = null) {
  await db().from("forum_mod_log").insert([{ action, target_type, target_id, note }]);
  logEvent("community.mod", { action, target_type });
}

export type ActResult = { ok: true } | { ok: false; status: number; error: string };

export async function act(a: ModAction): Promise<ActResult> {
  switch (a.action) {
    case "restore": {
      // Back to visible with a clean slate: only NEW reports can hide it again.
      const { data, error } = await db().from(table(a.type)).update({ hidden: false, report_count: 0 }).eq("id", a.id).select("id");
      if (error) throw error;
      if (!(data as unknown[] | null)?.length) return { ok: false, status: 404, error: "Not found" };
      await resolveReports(a.type, a.id, "restored");
      await record("restore", a.type, a.id);
      return { ok: true };
    }
    case "dismiss": {
      await resolveReports(a.type, a.id, "dismissed");
      await record("dismiss", a.type, a.id);
      return { ok: true };
    }
    case "remove": {
      const childIds =
        a.type === "post"
          ? (((await db().from("forum_comments").select("id").eq("post_id", a.id)).data ?? []) as { id: string }[]).map((c) => c.id)
          : (((await db().from("forum_comments").select("id").eq("parent_id", a.id)).data ?? []) as { id: string }[]).map((c) => c.id);
      await resolveReports(a.type, a.id, "removed");
      const { data, error } = await db().from(table(a.type)).delete().eq("id", a.id).select("id");
      if (error) throw error;
      if (!(data as unknown[] | null)?.length) return { ok: false, status: 404, error: "Not found" };
      await db().from("forum_votes").delete().eq("target_type", a.type).eq("target_id", a.id);
      if (childIds.length) await db().from("forum_votes").delete().eq("target_type", "comment").in("target_id", childIds);
      await record("remove", a.type, a.id);
      return { ok: true };
    }
    case "ban": {
      const key = await authorOf(a.type, a.id);
      if (!key) return { ok: false, status: 404, error: "Not found" };
      if (key === TEAM_KEY) return { ok: false, status: 409, error: "The team account can't be banned" };
      const until = banUntil(a.duration, new Date());
      const { error } = await db().from("forum_bans").upsert([{ author_key: key, until, reason: a.reason, created_at: new Date().toISOString() }], { onConflict: "author_key" });
      if (error) throw error;
      // The log names the author only by handle; the full key stays in forum_bans.
      await record("ban", "author", handleOf(key), `${a.duration} · ${a.reason}`);
      return { ok: true };
    }
    case "unban": {
      const { error } = await db().from("forum_bans").delete().eq("author_key", a.key);
      if (error) throw error;
      await record("unban", "author", handleOf(a.key));
      return { ok: true };
    }
    case "resources": {
      const { data } = await db().from("forum_posts").select("id").eq("id", a.post_id).limit(1);
      if (!(data as unknown[] | null)?.length) return { ok: false, status: 404, error: "Not found" };
      const { error } = await db().from("forum_comments").insert([{ post_id: a.post_id, author_key: TEAM_KEY, body: teamResourcesText() }]);
      if (error) throw error;
      await record("resources", "post", a.post_id);
      return { ok: true };
    }
  }
}
