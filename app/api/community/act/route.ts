import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { ActionInput } from "@/lib/community";
import { authorKey, communityDb, ownerOf, withinCommunityLimit } from "@/lib/community-server";
import { getMessages } from "@/lib/i18n/server";
import { logError, logEvent } from "@/lib/log";

/** Upvote (toggle), report, or delete your own post/comment. */
export async function POST(request: NextRequest) {
  const { t } = await getMessages();
  const e = t.community.errors;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const key = authorKey(auth.userId);
  const parsed = ActionInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: e.actionFailed }, { status: 400 });
  const a = parsed.data;

  try {
    if (a.action === "vote") {
      if (!(await withinCommunityLimit("votes", key))) return NextResponse.json({ error: e.tooManyVotes }, { status: 429 });
      const { data, error } = await communityDb().rpc("forum_toggle_vote", { p_type: a.type, p_id: a.id, p_voter: key });
      if (error) throw error;
      // null = hidden, missing, or your own post: nothing to vote on.
      if (!data) return NextResponse.json({ error: e.cantVote }, { status: 409 });
      return NextResponse.json(data);
    }

    if (a.action === "report") {
      const owner = await ownerOf(a.type, a.id);
      if (!owner) return NextResponse.json({ error: e.notFound }, { status: 404 });
      if (owner === key) return NextResponse.json({ error: e.actionFailed }, { status: 409 });
      if (!(await withinCommunityLimit("reports", key))) return NextResponse.json({ error: e.tooManyReports }, { status: 429 });
      const { error } = await communityDb().from("forum_reports").insert([{ target_type: a.type, target_id: a.id, reporter_key: key, reason: a.reason }]);
      // A repeat report from the same person is a no-op (primary key), not an error.
      if (error && (error as { code?: string }).code !== "23505") throw error;
      logEvent("community.reported", { type: a.type, reason: a.reason });
      return NextResponse.json({ ok: true });
    }

    // delete: only your own
    if ((await ownerOf(a.type, a.id)) !== key) return NextResponse.json({ error: e.notFound }, { status: 404 });
    // Votes point at targets polymorphically (no FK), so collect what the cascade will remove.
    const childIds =
      a.type === "post"
        ? (((await communityDb().from("forum_comments").select("id").eq("post_id", a.id)).data ?? []) as { id: string }[]).map((c) => c.id)
        : (((await communityDb().from("forum_comments").select("id").eq("parent_id", a.id)).data ?? []) as { id: string }[]).map((c) => c.id);
    const { error } = await communityDb().from(a.type === "post" ? "forum_posts" : "forum_comments").delete().eq("id", a.id).eq("author_key", key);
    if (error) throw error;
    await communityDb().from("forum_votes").delete().eq("target_type", a.type).eq("target_id", a.id);
    if (childIds.length) await communityDb().from("forum_votes").delete().eq("target_type", "comment").in("target_id", childIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("community.action.failed", err, { action: a.action });
    return NextResponse.json({ error: e.actionFailed }, { status: 500 });
  }
}
