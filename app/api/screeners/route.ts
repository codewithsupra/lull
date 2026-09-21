import { NextResponse, type NextRequest } from "next/server";
import { requireUser, type ServerClient } from "@/lib/care-plan-server";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { ScreenerSubmission, evaluate, nextDue, type ScreenerRecord } from "@/lib/screeners";
import { logError, logEvent } from "@/lib/log";

type Row = { id: string; results_enc: string; taken_at: string; followup_due: string | null };

async function history(insforge: ServerClient, limit: number) {
  const { data, error } = await insforge.database
    .from("screener_results")
    .select("id, results_enc, taken_at, followup_due")
    .order("taken_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id, followup_due: r.followup_due, ...decryptJson<ScreenerRecord>(r.results_enc) }));
}

/** Screening history (decrypted server-side), current tier and when the next check is due. */
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const rows = await history(auth.insforge, 26);
    const latest = rows[0] ?? null;
    const now = Date.now();
    const followupPending = rows.find((r) => r.followup_due && Date.parse(r.followup_due) <= now && now - Date.parse(r.followup_due) < 72 * 3600_000) ?? null;
    return NextResponse.json({
      latest,
      history: rows.map(({ id, at, tier, risk, phq9, gad7, sleep }) => ({ id, at, tier, risk, phq9: phq9.score, gad7: gad7.score, sleep: sleep.score })),
      next_due: nextDue(latest?.at ?? null),
      followup_pending: !!followupPending,
    });
  } catch (err) {
    logError("screeners.load.failed", err, { user: auth.userId });
    return NextResponse.json({ error: "Couldn't load your check-ins." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;

  const parsed = ScreenerSubmission.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Please answer every question." }, { status: 400 });

  // Guard against accidental double submits: at most one check every 10 minutes.
  const { count } = await insforge.database
    .from("screener_results")
    .select("id", { count: "exact", head: true })
    .gte("taken_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if ((count ?? 0) > 0) return NextResponse.json({ error: "You just completed a check. Take a breath and come back later." }, { status: 429 });

  try {
    const past = await history(insforge, 12);
    const record = evaluate(parsed.data, past, new Date().toISOString());
    const followup_due = record.risk ? new Date(Date.now() + 20 * 3600_000).toISOString() : null;
    const { error } = await insforge.database.from("screener_results").insert([{ results_enc: encryptJson(record), followup_due }]);
    if (error) throw error;
    logEvent("screeners.submitted", { user: userId, tier: record.tier, risk: record.risk });
    return NextResponse.json({ record, next_due: nextDue(record.at) });
  } catch (err) {
    logError("screeners.submit.failed", err, { user: userId });
    return NextResponse.json({ error: "Couldn't save your answers. Please try again." }, { status: 500 });
  }
}
