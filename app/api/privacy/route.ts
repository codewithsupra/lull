import { NextResponse } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { summary } from "@/lib/privacy-server";
import { getMessages } from "@/lib/i18n/server";
import { logError } from "@/lib/log";

/** What Lull holds about you: counts per category, consent, and whether deletion is possible now. */
export async function GET() {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await summary(auth.insforge, auth.userId));
  } catch (err) {
    logError("privacy.summary.failed", err);
    return NextResponse.json({ error: t.privacy.errors.load }, { status: 500 });
  }
}
