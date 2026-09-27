import "server-only";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { createAdminInsForge } from "@/lib/insforge/admin";
import { openrouter, CHAT_MODEL, parseJsonReply } from "@/lib/ai/openrouter";
import { PRIVATE_ROUTING } from "@/lib/care-plan-server";
import { decrypt } from "@/lib/crypto";
import { logError } from "@/lib/log";
import {
  LIMITS,
  MOD_PROMPT,
  ModReply,
  isAllowedSlug,
  normalizeSlug,
  recommendedSlugs,
  ruleCheck,
  sortPosts,
  type CommentView,
  type Flair,
  type ModReason,
  type PostSummary,
  type Sort,
  type Feed,
} from "@/lib/community";
import type { Category } from "@/lib/care-plan";
import type { ServerClient } from "@/lib/care-plan-server";

/**
 * Community server side. Every read and write of forum_* happens here, with the admin client,
 * after the caller is authenticated — no client role can reach those tables (see *_community.sql).
 */

const db = () => createAdminInsForge().database;

export { authorKey, aliasSeed } from "@/lib/community-keys";
import { aliasSeed } from "@/lib/community-keys";

// ---------- moderation ----------



/**
 * Rule floor first (never overridden), then the AI moderator. If the model is unavailable the
 * post is judged on the rule floor alone rather than blocking the whole community.
 */
export async function moderate(text: string): Promise<ModReason | null> {
  const floor = ruleCheck(text);
  if (floor) return floor;
  try {
    const completion = await openrouter.chat.completions.create(
      {
        model: CHAT_MODEL,
        temperature: 0,
        max_completion_tokens: 60,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: MOD_PROMPT },
          { role: "user", content: text.slice(0, 6000) },
        ],
        ...PRIVATE_ROUTING,
      } as unknown as ChatCompletionCreateParamsNonStreaming,
      { timeout: 10_000 },
    );
    const reply = ModReply.parse(parseJsonReply(completion.choices[0]?.message?.content ?? ""));
    return reply.allow ? null : (reply.reason ?? "harassment");
  } catch (err) {
    logError("community.moderate.unavailable", err);
    return null;
  }
}

// ---------- limits ----------

export async function withinCommunityLimit(kind: keyof typeof LIMITS, key: string): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const q = (table: string, col: string) => db().from(table).select("*", { count: "exact", head: true }).eq(col, key).gte("created_at", since);
  const res =
    kind === "posts" ? await q("forum_posts", "author_key")
    : kind === "comments" ? await q("forum_comments", "author_key")
    : kind === "communities" ? await q("forum_communities", "created_by_key")
    : kind === "votes" ? await q("forum_votes", "voter_key")
    : await q("forum_reports", "reporter_key");
  return (res.count ?? 0) < LIMITS[kind];
}

// ---------- reads ----------

type PostRow = { id: string; community: string; author_key: string; title: string; body: string; flair: Flair; score: number; comment_count: number; created_at: string };
const POST_COLS = "id, community, author_key, title, body, flair, score, comment_count, created_at";

async function votedSet(type: "post" | "comment", ids: string[], key: string): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data } = await db().from("forum_votes").select("target_id").eq("target_type", type).eq("voter_key", key).in("target_id", ids);
  return new Set(((data ?? []) as { target_id: string }[]).map((r) => r.target_id));
}

async function toSummaries(rows: PostRow[], key: string, preview = true): Promise<PostSummary[]> {
  const voted = await votedSet("post", rows.map((r) => r.id), key);
  return rows.map((r) => ({
    id: r.id,
    community: r.community,
    title: r.title,
    body: preview && r.body.length > 320 ? `${r.body.slice(0, 320).trimEnd()}…` : r.body,
    flair: r.flair,
    score: r.score,
    comment_count: r.comment_count,
    created_at: r.created_at,
    alias: aliasSeed(r.author_key, r.id),
    mine: r.author_key === key,
    voted: voted.has(r.id),
  }));
}

export async function communityExists(slug: string): Promise<boolean> {
  const { data } = await db().from("forum_communities").select("slug").eq("slug", slug).limit(1);
  return !!(data as unknown[] | null)?.length;
}

export async function listCommunity(slug: string, sort: Sort, key: string): Promise<PostSummary[]> {
  let q = db().from("forum_posts").select(POST_COLS).eq("community", slug).eq("hidden", false);
  // "top" is the week's best; hot and new look at a recent window and rank in memory.
  if (sort === "top") q = q.gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
  const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return sortPosts(await toSummaries((data ?? []) as PostRow[], key), sort, Date.now()).slice(0, 60);
}

export async function getThread(id: string, key: string): Promise<{ post: PostSummary; comments: CommentView[] } | null> {
  const { data } = await db().from("forum_posts").select(POST_COLS).eq("id", id).eq("hidden", false).limit(1);
  const row = (data as PostRow[] | null)?.[0];
  if (!row) return null;
  const [post] = await toSummaries([row], key, false);
  const { data: cdata, error } = await db()
    .from("forum_comments")
    .select("id, parent_id, author_key, body, score, created_at")
    .eq("post_id", id)
    .eq("hidden", false)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  const rows = (cdata ?? []) as { id: string; parent_id: string | null; author_key: string; body: string; score: number; created_at: string }[];
  const voted = await votedSet("comment", rows.map((r) => r.id), key);
  return {
    post,
    comments: rows.map((c) => ({
      id: c.id,
      parent_id: c.parent_id,
      body: c.body,
      score: c.score,
      created_at: c.created_at,
      // Seeded by the thread (the post id), so a person keeps one alias throughout the thread.
      alias: aliasSeed(c.author_key, id),
      op: c.author_key === row.author_key,
      mine: c.author_key === key,
      voted: voted.has(c.id),
    })),
  };
}


/**
 * The For You page. Recommendations use the user's own plan (medicine names are decrypted
 * server-side, used for matching, and discarded) plus where they've engaged. Nothing is stored.
 */
export async function getFeed(insforge: ServerClient, key: string): Promise<Feed> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [communities, trending, top, engagedPosts, engagedVotes, plan] = await Promise.all([
    db().from("forum_communities").select("slug").order("slug").limit(1000),
    db().rpc("forum_trending", { p_since: weekAgo, p_limit: 12 }),
    db().from("forum_posts").select(POST_COLS).eq("hidden", false).gte("created_at", weekAgo).order("score", { ascending: false }).order("created_at", { ascending: false }).limit(20),
    db().from("forum_posts").select("community").eq("author_key", key).order("created_at", { ascending: false }).limit(30),
    db().from("forum_votes").select("community").eq("voter_key", key).order("created_at", { ascending: false }).limit(60),
    insforge.database.from("care_plans").select("id, condition_category").eq("status", "active").limit(1),
  ]);

  const planRow = (plan.data as { id: string; condition_category: Category }[] | null)?.[0];
  let medications: string[] = [];
  if (planRow) {
    const { data } = await insforge.database.from("plan_medications").select("name_enc").eq("plan_id", planRow.id);
    medications = ((data ?? []) as { name_enc: string }[]).flatMap((m) => {
      try {
        return [decrypt(m.name_enc)];
      } catch {
        return [];
      }
    });
  }

  const all = ((communities.data ?? []) as { slug: string }[]).map((c) => c.slug);
  const engaged = [...((engagedPosts.data ?? []) as { community: string }[]), ...((engagedVotes.data ?? []) as { community: string }[])].map((r) => r.community);
  const rec = recommendedSlugs({ medications, category: planRow?.condition_category ?? null, engaged }, new Set(all));
  const stats = rec.length ? await db().rpc("forum_community_stats", { p_slugs: rec }) : { data: [] };
  const counts = new Map(((stats.data ?? []) as { slug: string; posts: number }[]).map((s) => [s.slug, Number(s.posts)]));

  return {
    recommended: rec.map((slug) => ({ slug, posts: counts.get(slug) ?? 0 })),
    trending: ((trending.data ?? []) as { slug: string; votes: number; posts: number }[]).map((t) => ({ slug: t.slug, votes: Number(t.votes), posts: Number(t.posts) })),
    top: await toSummaries((top.data ?? []) as PostRow[], key),
    communities: all,
  };
}

// ---------- writes ----------

/** Creates the community on first post if the name is allowed and the person is under their limit. */
export async function ensureCommunity(rawSlug: string, key: string): Promise<{ slug: string } | { error: "invalid" | "limit" }> {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return { error: "invalid" };
  if (await communityExists(slug)) return { slug };
  if (!isAllowedSlug(slug)) return { error: "invalid" };
  if (!(await withinCommunityLimit("communities", key))) return { error: "limit" };
  const { error } = await db().from("forum_communities").insert([{ slug, created_by_key: key }]);
  if (error && !(await communityExists(slug))) throw error;
  return { slug };
}

export async function ownerOf(type: "post" | "comment", id: string): Promise<string | null> {
  const { data } = await db().from(type === "post" ? "forum_posts" : "forum_comments").select("author_key").eq("id", id).limit(1);
  return (data as { author_key: string }[] | null)?.[0]?.author_key ?? null;
}

export { db as communityDb };
