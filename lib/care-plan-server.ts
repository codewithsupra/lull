import "server-only";
import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { decrypt, decryptJson, decryptOpt } from "@/lib/crypto";
import type { Outline, PlanTask, PlanView, Slot, TaskKind } from "@/lib/care-plan";
import { addDays } from "@/lib/care-plan-tasks";

export { addDays, buildWeekTasks } from "@/lib/care-plan-tasks";

export type ServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

/** OpenRouter routing for health data: only providers that neither log nor train on prompts. */
export const PRIVATE_ROUTING = { provider: { data_collection: "deny", zdr: true } } as const;

export async function requireUser() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.auth.getCurrentUser();
  if (!data?.user) return { error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) } as const;
  return { insforge, userId: data.user.id } as const;
}

/** Per-user rolling 24h limit, counted from the content-free ai_usage ledger. */
export async function withinLimit(insforge: ServerClient, kind: "extract" | "plan" | "replan" | "insight" | "screener", limit: number) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await insforge.database
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) return false;
  await insforge.database.from("ai_usage").insert([{ kind }]);
  return true;
}

// ---------- reading ----------

type TaskRecord = {
  id: string;
  day: string;
  slot: Slot;
  remind_at: string | null;
  kind: TaskKind;
  title_enc: string;
  detail_enc: string | null;
  session_ref: string | null;
  xp: number;
  completed_at: string | null;
};

export function decryptTask(r: TaskRecord): PlanTask {
  return {
    id: r.id,
    day: r.day,
    slot: r.slot,
    remind_at: r.remind_at ? r.remind_at.slice(0, 5) : null,
    kind: r.kind,
    title: decrypt(r.title_enc),
    detail: decryptOpt(r.detail_enc),
    session_ref: r.session_ref,
    xp: r.xp,
    completed_at: r.completed_at,
  };
}

export async function loadActivePlan(insforge: ServerClient, today: string): Promise<PlanView | null> {
  const { data: plans } = await insforge.database
    .from("care_plans")
    .select("id, condition_category, week_index, started_at, outline_enc, flags_enc")
    .eq("status", "active")
    .limit(1);
  const plan = plans?.[0] as
    | { id: string; condition_category: PlanView["category"]; week_index: number; started_at: string; outline_enc: string; flags_enc: string | null }
    | undefined;
  if (!plan) return null;

  const [meds, tasks, weekTasks] = await Promise.all([
    insforge.database.from("plan_medications").select("id, name_enc, dose_enc, instructions_enc, times").eq("plan_id", plan.id),
    insforge.database
      .from("plan_tasks")
      .select("id, day, slot, remind_at, kind, title_enc, detail_enc, session_ref, xp, completed_at")
      .eq("plan_id", plan.id)
      .eq("day", today)
      .order("sort"),
    insforge.database.from("plan_tasks").select("completed_at, day").eq("plan_id", plan.id).eq("week", plan.week_index),
  ]);

  const outline = decryptJson<Outline>(plan.outline_enc);
  const weekRows = (weekTasks.data ?? []) as { completed_at: string | null; day: string }[];
  const weekEnd = addDays(plan.started_at, plan.week_index * 7 - 1);

  return {
    id: plan.id,
    category: plan.condition_category,
    week: plan.week_index,
    started_at: plan.started_at,
    title: outline.title,
    summary: outline.summary,
    roadmap: outline.roadmap,
    learn: outline.weeks[plan.week_index]?.learn ?? [],
    doctor_questions: outline.doctor_questions,
    doctor_flags: plan.flags_enc ? decryptJson<string[]>(plan.flags_enc) : [],
    medications: ((meds.data ?? []) as { id: string; name_enc: string; dose_enc: string | null; instructions_enc: string | null; times: string[] }[]).map((m) => ({
      id: m.id,
      name: decrypt(m.name_enc),
      dose: decryptOpt(m.dose_enc),
      instructions: decryptOpt(m.instructions_enc),
      times: m.times,
    })),
    tasks: ((tasks.data ?? []) as TaskRecord[]).map(decryptTask),
    week_complete_ratio: weekRows.length ? weekRows.filter((r) => r.completed_at).length / weekRows.length : 0,
    // Allow the adaptive re-plan on the last day of the week or later, until week 4.
    can_replan: plan.week_index < 4 && today >= weekEnd,
  };
}
