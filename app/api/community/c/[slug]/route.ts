import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { SORTS, isAllowedSlug, normalizeSlug, type Sort } from "@/lib/community";
import { authorKey, communityExists, listCommunity } from "@/lib/community-server";
import { getMessages } from "@/lib/i18n/server";
import { logError } from "@/lib/log";

/** Posts in /slug. A community that doesn't exist yet reports whether it could be started. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const slug = normalizeSlug((await params).slug);
  if (!slug) return NextResponse.json({ error: t.community.errors.badCommunity }, { status: 404 });
  const s = request.nextUrl.searchParams.get("sort");
  const sort: Sort = (SORTS as readonly string[]).includes(s ?? "") ? (s as Sort) : "hot";
  try {
    if (!(await communityExists(slug))) return NextResponse.json({ slug, exists: false, can_create: isAllowedSlug(slug), posts: [] });
    return NextResponse.json({ slug, exists: true, can_create: false, posts: await listCommunity(slug, sort, authorKey(auth.userId)) });
  } catch (err) {
    logError("community.list.failed", err);
    return NextResponse.json({ error: t.community.errors.load }, { status: 500 });
  }
}
