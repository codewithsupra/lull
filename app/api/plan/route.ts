import { NextResponse, type NextRequest } from "next/server";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { openrouter, CHAT_MODEL, parseJsonReply } from "@/lib/ai/openrouter";
import { CATEGORIES, CONSENT_VERSION, CRISIS_TERMS, IntakeInput, PlanOutput, type Outline } from "@/lib/care-plan";
import { PRIVATE_ROUTING, buildWeekTasks, loadActivePlan, requireUser, withinLimit } from "@/lib/care-plan-server";
import { encrypt, encryptJson, encryptOpt } from "@/lib/crypto";
import { redact, redactDeep } from "@/lib/redact";
import { logError, logEvent } from "@/lib/log";
import { PLAN_RULES } from "@/lib/care-plan-prompts";

export const maxDuration = 60;


const SHAPE = `Reply with strict JSON only:
{
  "title": "2-5 word plan name",
  "summary": "2 sentences: what the next 4 weeks will do for them",
  "context": "a neutral <=300 char summary of their situation for future re-planning, no personal details",
  "care": null,
  "doctor_flags": ["Ask your doctor about …"],
  "doctor_questions": ["questions worth asking at the next appointment"],
  "roadmap": [{"week":1,"theme":"…","focus":"…"},{"week":2,…},{"week":3,…},{"week":4,…}],
  "week": {
    "theme": "…", "focus": "…",
    "habits": [{"title":"…","detail":"why + how, 1-2 sentences","slot":"morning|afternoon|evening|night","time":"HH:MM"|null,"days":"daily"}],
    "sessions": [{"title":"…","detail":"…","slot":"…","time":"HH:MM"|null,"days":"daily","ref":"breathe:478:5"}],
    "learn": [{"title":"…","body":"3-5 sentences"}],
    "reflect": "one short nightly reflection prompt"
  }
}
Week 1: 3-4 habits, 1-2 sessions, 5-7 learn cards. Keep each day to about 5-7 tasks including medications.`;

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const today = request.nextUrl.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return NextResponse.json({ error: "Bad date" }, { status: 400 });
  try {
    return NextResponse.json({ plan: await loadActivePlan(auth.insforge, today) });
  } catch (err) {
    logError("plan.load.failed", err, { user: auth.userId });
    return NextResponse.json({ error: "Couldn't load your plan." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;

  const parsed = IntakeInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Some answers are missing. Check the form and try again." }, { status: 400 });
  const input = parsed.data;

  if (!(await withinLimit(insforge, "plan", 5))) {
    return NextResponse.json({ error: "You've generated several plans today. Try again tomorrow." }, { status: 429 });
  }

  const crisisHint = CRISIS_TERMS.test(input.text);
  const category = CATEGORIES.find((c) => c.id === input.category)!;
  const brief = {
    condition: category.label,
    how_long: { new: "just diagnosed / new", months: "a few months", years: "more than a year" }[input.duration],
    severity_1_to_5: input.severity,
    wake_time: input.wake,
    bed_time: input.sleep,
    goals: input.goals,
    in_their_words: redact(input.text),
    confirmed_medications: input.medications.map((m) => ({
      name: m.name,
      dose: m.dose,
      times: m.times,
      as_needed: m.as_needed,
      instructions: m.instructions,
    })),
  };

  let out: PlanOutput;
  try {
    const completion = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.6,
      max_completion_tokens: 6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${PLAN_RULES}\n\n${SHAPE}` },
        { role: "user", content: JSON.stringify(brief) },
      ],
      ...PRIVATE_ROUTING,
    } as unknown as ChatCompletionCreateParamsNonStreaming);
    out = redactDeep(PlanOutput.parse(parseJsonReply(completion.choices[0]?.message?.content ?? "")));
  } catch (err) {
    logError("plan.generate.failed", err, { user: userId });
    return NextResponse.json({ error: "The planner stumbled. Give it another try in a moment." }, { status: 502 });
  }

  const care =
    out.care ??
    (crisisHint
      ? "It sounds like things are really heavy right now. Please reach out to someone today — call emergency services, or a crisis line (US 988, India Tele-MANAS 14416, others at findahelpline.com)."
      : null);

  const outline: Outline = {
    title: out.title,
    summary: out.summary,
    context: out.context,
    category: input.category,
    severity: input.severity,
    wake: input.wake,
    sleep: input.sleep,
    goals: input.goals,
    roadmap: out.roadmap,
    doctor_questions: out.doctor_questions,
    weeks: { 1: { theme: out.week.theme, focus: out.week.focus, learn: out.week.learn } },
  };

  // Profile (consent + timezone) then archive any previous plan, then write the new one.
  await insforge.database
    .from("care_profiles")
    .upsert([{ consent_version: CONSENT_VERSION, consent_at: new Date().toISOString(), timezone: input.timezone }], { onConflict: "user_id" });
  await insforge.database.from("care_plans").update({ status: "archived" }).eq("status", "active");

  const { data: planRows, error: planError } = await insforge.database
    .from("care_plans")
    .insert([
      {
        condition_category: input.category,
        started_at: input.today,
        outline_enc: encryptJson(outline),
        flags_enc: out.doctor_flags.length ? encryptJson(out.doctor_flags) : null,
      },
    ])
    .select("id");
  const planId = (planRows as { id: string }[] | null)?.[0]?.id;
  if (planError || !planId) {
    logError("plan.insert.failed", planError, { user: userId });
    return NextResponse.json({ error: "Couldn't save your plan." }, { status: 500 });
  }

  const medRows = input.medications.map((m) => ({
    plan_id: planId,
    name_enc: encrypt(m.name),
    dose_enc: encryptOpt(m.dose),
    instructions_enc: encryptOpt([m.as_needed ? "Only when needed, as prescribed" : "", m.instructions].filter(Boolean).join(". ")),
    times: m.times,
  }));
  const taskRows = buildWeekTasks({
    planId,
    week: 1,
    startedAt: input.today,
    wake: input.wake,
    sleep: input.sleep,
    medications: input.medications,
    plan: out.week,
  });

  const [medRes, taskRes] = await Promise.all([
    medRows.length ? insforge.database.from("plan_medications").insert(medRows) : Promise.resolve({ error: null }),
    insforge.database.from("plan_tasks").insert(taskRows),
  ]);
  if (medRes.error || taskRes.error) {
    await insforge.database.from("care_plans").delete().eq("id", planId);
    logError("plan.tasks.failed", medRes.error ?? taskRes.error, { user: userId });
    return NextResponse.json({ error: "Couldn't save your plan." }, { status: 500 });
  }

  logEvent("plan.created", { user: userId, category: input.category, meds: medRows.length, tasks: taskRows.length });
  return NextResponse.json({ id: planId, care });
}

/** Deletes every piece of health data we hold for this user. */
export async function DELETE() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;
  const results = await Promise.all([
    insforge.database.from("care_plans").delete().not("id", "is", null), // cascades to meds + tasks
    insforge.database.from("push_subscriptions").delete().not("id", "is", null),
    insforge.database.from("care_profiles").delete().not("user_id", "is", null),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) {
    logError("plan.delete.failed", failed.error, { user: userId });
    return NextResponse.json({ error: "Couldn't delete everything. Please try again." }, { status: 500 });
  }
  logEvent("plan.deleted", { user: userId });
  return NextResponse.json({ ok: true });
}
