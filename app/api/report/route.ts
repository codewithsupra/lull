import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { buildReport, type ShareRow } from "@/lib/report";
import { loadReportInput } from "@/lib/report-server";
import { getMessages } from "@/lib/i18n/server";
import { logError } from "@/lib/log";

/**
 * The full report for the signed-in user (every section), plus their share links. Free: it's the
 * user's own data, and the preview is what they print or save as a PDF. The client narrows
 * sections for display; the server narrows them again before anything is shared.
 */
export async function GET(request: NextRequest) {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const today = request.nextUrl.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return NextResponse.json({ error: "Bad date" }, { status: 400 });
  try {
    const [input, shares] = await Promise.all([
      loadReportInput(auth.insforge, today),
      auth.insforge.database
        .from("report_shares")
        .select("id, sections, locale, created_at, expires_at, revoked_at, view_count, last_viewed_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (shares.error) throw shares.error;
    return NextResponse.json({ report: buildReport(input, { now: new Date() }), shares: shares.data as ShareRow[] });
  } catch (err) {
    logError("report.load.failed", err, { user: auth.userId });
    return NextResponse.json({ error: t.report.loadFailed }, { status: 500 });
  }
}
