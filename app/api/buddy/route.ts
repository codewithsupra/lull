import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { loadBuddyView, loadCardStats, settleBuddy } from "@/lib/buddy-server";
import { getMessages } from "@/lib/i18n/server";
import { logError } from "@/lib/log";

/** Invite code + buddy status + share-card numbers. Settles any earned reward first. */
export async function GET(request: NextRequest) {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const today = request.nextUrl.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return NextResponse.json({ error: "Bad date" }, { status: 400 });
  try {
    await settleBuddy(auth.userId);
    const [buddy, card] = await Promise.all([loadBuddyView(auth.insforge, auth.userId), loadCardStats(auth.insforge, today)]);
    return NextResponse.json({ buddy, card });
  } catch (err) {
    logError("buddy.load.failed", err, { user: auth.userId });
    return NextResponse.json({ error: t.invite.loadFailed }, { status: 500 });
  }
}
