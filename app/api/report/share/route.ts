import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/care-plan-server";
import { requireFeature } from "@/lib/billing-server";
import { SHARES_PER_DAY, ShareRequest, buildReport, expiresAt, pickSections } from "@/lib/report";
import { newShareToken, hashToken, sealReport } from "@/lib/report-crypto";
import { loadReportInput } from "@/lib/report-server";
import { getMessages } from "@/lib/i18n/server";
import { logError, logEvent } from "@/lib/log";
import { SITE } from "@/lib/site";

const Body = ShareRequest.extend({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * Creates an expiring share link (Pro). The snapshot is built and narrowed to the chosen sections
 * here, on the server — the client's preview is never trusted as the payload. The token is
 * returned exactly once and never stored.
 */
export async function POST(request: NextRequest) {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;

  const gate = await requireFeature(insforge, "report");
  if ("error" in gate) return gate.error;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: t.report.pickOne }, { status: 400 });
  const body = parsed.data;

  const { count } = await insforge.database
    .from("report_shares")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((count ?? 0) >= Math.min(gate.limit, SHARES_PER_DAY)) return NextResponse.json({ error: t.report.tooMany }, { status: 429 });

  try {
    const now = new Date();
    const full = buildReport(await loadReportInput(insforge, body.today), { alias: body.alias, questions: body.questions, now });
    const report = pickSections(full, body.sections);
    const token = newShareToken();
    const { data, error } = await insforge.database
      .from("report_shares")
      .insert([
        {
          token_hash: hashToken(token),
          report_enc: sealReport(report, token),
          sections: report.sections,
          locale: body.locale,
          expires_at: expiresAt(body.expires, now),
        },
      ])
      .select("id, expires_at");
    if (error) throw error;
    const row = (data as { id: string; expires_at: string }[])[0];
    logEvent("report.share.created", { user: userId, sections: report.sections.length, expires: body.expires, locale: body.locale });
    return NextResponse.json({ id: row.id, url: `${SITE.url}/r/${token}`, expires_at: row.expires_at });
  } catch (err) {
    logError("report.share.create_failed", err, { user: userId });
    return NextResponse.json({ error: t.report.shareFailed }, { status: 500 });
  }
}

const Revoke = z.object({ id: z.uuid() });

/** Turns a link off for good. Free, always: revoking must never sit behind a paywall. */
export async function PATCH(request: NextRequest) {
  const { t } = await getMessages();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = Revoke.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: t.report.revokeFailed }, { status: 400 });

  // The trigger stamps server time and refuses to touch an already-revoked row.
  const { data, error } = await auth.insforge.database
    .from("report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .is("revoked_at", null)
    .select("id, revoked_at");
  if (error) {
    logError("report.share.revoke_failed", error, { user: auth.userId });
    return NextResponse.json({ error: t.report.revokeFailed }, { status: 500 });
  }
  const row = (data as { id: string; revoked_at: string }[])[0];
  if (!row) return NextResponse.json({ error: t.report.revokeFailed }, { status: 404 });
  logEvent("report.share.revoked", { user: auth.userId });
  return NextResponse.json(row);
}
