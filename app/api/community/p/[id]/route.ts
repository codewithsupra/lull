import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/care-plan-server";
import { CommentInput, scrub } from "@/lib/community";
import { authorKey, communityDb, getThread, moderate, withinCommunityLimit } from "@/lib/community-server";
import { getMessages } from "@/lib/i18n/server";
import { logError, logEvent } from "@/lib/log";

const Id = z.uuid();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: t.community.errors.notFound }, { status: 404 });
  try {
    const thread = await getThread(id.data, authorKey(auth.userId));
    if (!thread) return NextResponse.json({ error: t.community.errors.notFound }, { status: 404 });
    return NextResponse.json(thread);
  } catch (err) {
    logError("community.thread.failed", err);
    return NextResponse.json({ error: t.community.errors.load }, { status: 500 });
  }
}

/** Add a comment (or a reply). Same pipeline as posts: limits → scrub → moderate → store. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { t } = await getMessages();
  const e = t.community.errors;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const id = Id.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: e.notFound }, { status: 404 });
  const key = authorKey(auth.userId);

  const parsed = CommentInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: e.invalidComment }, { status: 400 });
  if (!(await withinCommunityLimit("comments", key))) return NextResponse.json({ error: e.tooManyComments }, { status: 429 });

  const body = scrub(parsed.data.body);
  const verdict = await moderate(body);
  if (verdict) {
    logEvent("community.comment.held", { reason: verdict });
    return NextResponse.json({ error: t.community.mod[verdict], reason: verdict, crisis: verdict === "crisis" }, { status: 422 });
  }

  try {
    const { data: post } = await communityDb().from("forum_posts").select("id").eq("id", id.data).eq("hidden", false).limit(1);
    if (!(post as unknown[] | null)?.length) return NextResponse.json({ error: e.notFound }, { status: 404 });
    if (parsed.data.parent_id) {
      const { data: parent } = await communityDb().from("forum_comments").select("id").eq("id", parsed.data.parent_id).eq("post_id", id.data).limit(1);
      if (!(parent as unknown[] | null)?.length) return NextResponse.json({ error: e.notFound }, { status: 404 });
    }
    const { error } = await communityDb()
      .from("forum_comments")
      .insert([{ post_id: id.data, parent_id: parsed.data.parent_id ?? null, author_key: key, body }]);
    if (error) throw error;
    logEvent("community.comment.created");
    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("community.comment.failed", err);
    return NextResponse.json({ error: e.saveFailed }, { status: 500 });
  }
}
