import "server-only";
import { createAdminClient } from "@insforge/sdk";
import { decrypt, decryptJson, decryptOpt } from "@/lib/crypto";
import { addDays, REPORT_WINDOW_DAYS, type Report, type ReportInput } from "@/lib/report";
import { TOKEN_RE, hashToken, openReport } from "@/lib/report-crypto";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { logError } from "@/lib/log";
import type { Category, Outline, TaskKind } from "@/lib/care-plan";
import type { ScreenerRecord } from "@/lib/screeners";
import type { ServerClient } from "@/lib/care-plan-server";

/** Everything the report can draw on, decrypted server-side, for the signed-in user (RLS applies). */
export async function loadReportInput(insforge: ServerClient, today: string): Promise<ReportInput> {
  // One day of slack before the window so a screening late on the first day in any timezone counts.
  const since = `${addDays(today, -REPORT_WINDOW_DAYS)}T00:00:00Z`;

  const [screeners, plans, checkins] = await Promise.all([
    insforge.database.from("screener_results").select("results_enc").gte("taken_at", since).order("taken_at", { ascending: true }),
    insforge.database.from("care_plans").select("id, condition_category, started_at, outline_enc, flags_enc").eq("status", "active").limit(1),
    insforge.database.from("mood_checkins").select("mood, energy, created_at").gte("created_at", since),
  ]);
  for (const r of [screeners, plans, checkins]) if (r.error) throw r.error;

  const plan = (plans.data as { id: string; condition_category: Category; started_at: string; outline_enc: string; flags_enc: string | null }[])[0];
  let planInput: ReportInput["plan"] = null;
  let tasks: ReportInput["tasks"] = [];
  if (plan) {
    const [meds, taskRows] = await Promise.all([
      insforge.database.from("plan_medications").select("name_enc, dose_enc, times").eq("plan_id", plan.id),
      insforge.database.from("plan_tasks").select("day, kind, completed_at").eq("plan_id", plan.id).lte("day", today),
    ]);
    if (meds.error) throw meds.error;
    if (taskRows.error) throw taskRows.error;
    const outline = decryptJson<Outline>(plan.outline_enc);
    planInput = {
      category: plan.condition_category,
      started_at: plan.started_at,
      doctor_questions: outline.doctor_questions ?? [],
      doctor_flags: plan.flags_enc ? decryptJson<string[]>(plan.flags_enc) : [],
      medications: (meds.data as { name_enc: string; dose_enc: string | null; times: string[] }[]).map((m) => ({
        name: decrypt(m.name_enc),
        dose: decryptOpt(m.dose_enc),
        times: m.times,
      })),
    };
    tasks = taskRows.data as { day: string; kind: TaskKind; completed_at: string | null }[];
  }

  return {
    today,
    screeners: (screeners.data as { results_enc: string }[]).map((r) => decryptJson<ScreenerRecord>(r.results_enc)),
    plan: planInput,
    tasks,
    checkins: checkins.data as ReportInput["checkins"],
  };
}

/**
 * Opens a shared report for an anonymous visitor. Returns null for anything that isn't a live
 * link — malformed, unknown, expired, revoked or undecryptable — so the page can't be used to
 * tell those cases apart. The admin key is needed because `anon` has no access to report_shares
 * at all; the only input that reaches the database is SHA-256 of a shape-checked token.
 */
export async function openShare(token: string): Promise<{ report: Report; locale: Locale } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const admin = createAdminClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!, apiKey: process.env.INSFORGE_API_KEY! });
  const { data, error } = await admin.database.rpc("open_report_share", { p_token_hash: hashToken(token) });
  if (error) {
    logError("report.share.open_failed", error);
    return null;
  }
  const row = data as { report_enc: string; locale: string } | null;
  if (!row?.report_enc) return null;
  try {
    return { report: openReport(row.report_enc, token), locale: asLocale(row.locale) };
  } catch (err) {
    logError("report.share.decrypt_failed", err);
    return null;
  }
}
