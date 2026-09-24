import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { openrouter, CHAT_MODEL, parseJsonReply } from "@/lib/ai/openrouter";
import { WeekPlan, type MedicationInput, type Outline } from "@/lib/care-plan";
import { PLAN_RULES, planLanguage } from "@/lib/care-plan-prompts";
import { getLocale, apiErrors } from "@/lib/i18n/server";
import { PRIVATE_ROUTING, addDays, buildWeekTasks, decryptTask, requireUser, withinLimit } from "@/lib/care-plan-server";
import { decrypt, decryptJson, decryptOpt, encryptJson } from "@/lib/crypto";
import { redactDeep } from "@/lib/redact";
import { logError, logEvent } from "@/lib/log";
import { requireFeature } from "@/lib/billing-server";

export const maxDuration = 60;

const Body = z.object({ today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const Reply = z.object({
  review: z.string().max(400),
  doctor_flags: z.array(z.string().max(240)).max(6).catch([]),
  week: WeekPlan,
});

export async function POST(request: NextRequest) {
  const e = await apiErrors();
  const locale = await getLocale();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;
  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { data: plans } = await insforge.database
    .from("care_plans")
    .select("id, week_index, started_at, outline_enc, flags_enc")
    .eq("status", "active")
    .limit(1);
  const plan = plans?.[0] as { id: string; week_index: number; started_at: string; outline_enc: string; flags_enc: string | null } | undefined;
  if (!plan) return NextResponse.json({ error: e.plan.none }, { status: 404 });
  if (plan.week_index >= 4) return NextResponse.json({ error: e.plan.allWeeksDone }, { status: 409 });
  if (body.data.today < addDays(plan.started_at, plan.week_index * 7 - 1)) {
    return NextResponse.json({ error: e.plan.lockedUntilWeekEnd }, { status: 409 });
  }
  const gate = await requireFeature(insforge, "replan");
  if ("error" in gate) return gate.error;
  if (!(await withinLimit(insforge, "replan", gate.limit))) return NextResponse.json({ error: e.plan.tryTomorrow }, { status: 429 });

  const [tasksRes, medsRes, moodRes] = await Promise.all([
    insforge.database
      .from("plan_tasks")
      .select("id, day, slot, remind_at, kind, title_enc, detail_enc, session_ref, xp, completed_at")
      .eq("plan_id", plan.id)
      .eq("week", plan.week_index),
    insforge.database.from("plan_medications").select("name_enc, dose_enc, instructions_enc, times").eq("plan_id", plan.id),
    insforge.database
      .from("mood_checkins")
      .select("mood, energy, created_at")
      .gte("created_at", `${plan.started_at}T00:00:00Z`)
      .order("created_at", { ascending: true })
      .limit(40),
  ]);

  const outline = decryptJson<Outline>(plan.outline_enc);
  const tasks = (tasksRes.data ?? []).map((t) => decryptTask(t as Parameters<typeof decryptTask>[0]));
  const byTitle = new Map<string, { kind: string; done: number; total: number }>();
  for (const t of tasks) {
    if (t.kind === "learn") continue;
    const k = byTitle.get(t.title) ?? { kind: t.kind, done: 0, total: 0 };
    k.total++;
    if (t.completed_at) k.done++;
    byTitle.set(t.title, k);
  }
  const meds: MedicationInput[] = ((medsRes.data ?? []) as { name_enc: string; dose_enc: string | null; instructions_enc: string | null; times: string[] }[]).map((m) => {
    const instructions = decryptOpt(m.instructions_enc) ?? "";
    return {
      name: decrypt(m.name_enc),
      dose: decryptOpt(m.dose_enc) ?? "",
      instructions,
      times: m.times,
      as_needed: instructions.startsWith("Only when needed"),
    };
  });
  const nextWeek = plan.week_index + 1;

  let reply: z.infer<typeof Reply>;
  try {
    const completion = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.6,
      max_completion_tokens: 5000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${PLAN_RULES}

${planLanguage(locale)}

You are now adapting the plan for week ${nextWeek} of 4 from how last week actually went.
- Keep habits with >=60% completion and make them slightly harder or add one new habit that builds on them.
- Replace or shrink habits under 40% completion (make them easier, move them to a better time, or swap for an alternative).
- Follow the roadmap theme for week ${nextWeek} unless the data says otherwise.
Reply with strict JSON: {"review": "2 warm sentences about their week (celebrate wins, no guilt)", "doctor_flags": [...], "week": {same shape as before: theme, focus, habits, sessions, learn (5-7 new cards), reflect}}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            context: outline.context,
            category: outline.category,
            goals: outline.goals,
            wake_time: outline.wake,
            bed_time: outline.sleep,
            roadmap: outline.roadmap,
            medications_on_schedule: meds.map((m) => ({ name: m.name, dose: m.dose })),
            last_week_completion: [...byTitle.entries()].map(([title, v]) => ({ title, kind: v.kind, done: v.done, of: v.total })),
            mood_1_to_5: (moodRes.data ?? []).map((m) => (m as { mood: number }).mood),
          }),
        },
      ],
      ...PRIVATE_ROUTING,
    } as unknown as ChatCompletionCreateParamsNonStreaming);
    reply = redactDeep(Reply.parse(parseJsonReply(completion.choices[0]?.message?.content ?? "")));
  } catch (err) {
    logError("plan.replan.failed", err, { user: userId });
    return NextResponse.json({ error: e.plan.replanFailed }, { status: 502 });
  }

  outline.weeks[nextWeek] = { theme: reply.week.theme, focus: reply.week.focus, learn: reply.week.learn };
  const rows = buildWeekTasks({
    planId: plan.id,
    week: nextWeek,
    startedAt: plan.started_at,
    wake: outline.wake,
    sleep: outline.sleep,
    medications: meds,
    plan: reply.week,
  });

  const { error: insertError } = await insforge.database.from("plan_tasks").insert(rows);
  if (insertError) {
    logError("plan.replan.insert", insertError, { user: userId });
    return NextResponse.json({ error: e.plan.replanSaveFailed }, { status: 500 });
  }
  await insforge.database
    .from("care_plans")
    .update({
      week_index: nextWeek,
      outline_enc: encryptJson(outline),
      flags_enc: reply.doctor_flags.length ? encryptJson(reply.doctor_flags) : plan.flags_enc,
    })
    .eq("id", plan.id);

  logEvent("plan.replanned", { user: userId, week: nextWeek, tasks: rows.length });
  return NextResponse.json({ week: nextWeek, review: reply.review });
}
