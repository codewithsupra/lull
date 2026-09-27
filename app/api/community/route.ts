import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { PostInput, scrub } from "@/lib/community";
import { authorKey, communityDb, ensureCommunity, getFeed, moderate, withinCommunityLimit } from "@/lib/community-server";
import { getMessages } from "@/lib/i18n/server";
import { logError, logEvent } from "@/lib/log";

/** For You: recommended and trending communities plus the week's top posts. */
export async function GET() {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await getFeed(auth.insforge, authorKey(auth.userId)));
  } catch (err) {
    logError("community.feed.failed", err);
    return NextResponse.json({ error: t.community.errors.load }, { status: 500 });
  }
}

/** Create a post: limits → scrub contact details → moderate (rules, then AI) → store. */
export async function POST(request: NextRequest) {
  const { t } = await getMessages();
  const e = t.community.errors;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const key = authorKey(auth.userId);

  const parsed = PostInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: e.invalidPost }, { status: 400 });
  if (!(await withinCommunityLimit("posts", key))) return NextResponse.json({ error: e.tooManyPosts }, { status: 429 });

  const title = scrub(parsed.data.title);
  const body = scrub(parsed.data.body);
  const verdict = await moderate(`${title}\n\n${body}`);
  if (verdict) {
    // Log the category only — never the text.
    logEvent("community.post.held", { reason: verdict });
    return NextResponse.json({ error: t.community.mod[verdict], reason: verdict, crisis: verdict === "crisis" }, { status: 422 });
  }

  try {
    const community = await ensureCommunity(parsed.data.community, key);
    if ("error" in community) return NextResponse.json({ error: community.error === "limit" ? e.tooManyCommunities : e.badCommunity }, { status: community.error === "limit" ? 429 : 400 });
    const { data, error } = await communityDb()
      .from("forum_posts")
      .insert([{ community: community.slug, author_key: key, title, body, flair: parsed.data.flair }])
      .select("id, community");
    if (error) throw error;
    const row = (data as { id: string; community: string }[])[0];
    logEvent("community.post.created", { flair: parsed.data.flair });
    return NextResponse.json(row);
  } catch (err) {
    logError("community.post.failed", err);
    return NextResponse.json({ error: e.saveFailed }, { status: 500 });
  }
}
