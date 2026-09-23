import { NextResponse, type NextRequest } from "next/server";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { openrouter, CHAT_MODEL } from "@/lib/ai/openrouter";
import { PRIVATE_ROUTING, requireUser, withinLimit, type ServerClient } from "@/lib/care-plan-server";
import { requireFeature } from "@/lib/billing-server";
import { decrypt, decryptJson, encrypt } from "@/lib/crypto";
import {
  CONTEXT_TURNS,
  CRISIS_REPLY,
  CompanionInput,
  EMPTY_CONTEXT,
  MEDICAL_BOUNDARY,
  SYSTEM_PROMPT,
  classify,
  contextBriefing,
  type CompanionContext,
  type CompanionMessage,
  type Role,
} from "@/lib/companion";
import type { Outline } from "@/lib/care-plan";
import type { ScreenerRecord } from "@/lib/screeners";
import { logError, logEvent } from "@/lib/log";

export const maxDuration = 60;

type Row = { id: string; role: Role; content_enc: string; risk: boolean; created_at: string };

const decryptRow = (r: Row): CompanionMessage => ({ id: r.id, role: r.role, content: decrypt(r.content_enc), risk: r.risk, created_at: r.created_at });

async function history(insforge: ServerClient, limit: number): Promise<CompanionMessage[]> {
  const { data } = await insforge.database
    .from("companion_messages")
    .select("id, role, content_enc, risk, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map(decryptRow).reverse();
}

const save = (insforge: ServerClient, role: Role, content: string, risk = false) =>
  insforge.database.from("companion_messages").insert([{ role, content_enc: encrypt(content), risk }]);

/** Assembles the user's situation server-side from encrypted rows. Aggregates only. */
async function buildContext(insforge: ServerClient, name: string | null): Promise<CompanionContext> {
  const today = new Date().toISOString().slice(0, 10);
  const [plans, screeners, moods, safety, profile, tasks] = await Promise.all([
    insforge.database.from("care_plans").select("outline_enc, week_index").eq("status", "active").limit(1),
    insforge.database.from("screener_results").select("results_enc").order("taken_at", { ascending: false }).limit(1),
    insforge.database.from("mood_checkins").select("mood").order("created_at", { ascending: false }).limit(5),
    insforge.database.from("safety_plans").select("user_id").limit(1),
    insforge.database.from("care_profiles").select("timezone").limit(1),
    insforge.database.from("plan_tasks").select("completed_at").eq("day", today),
  ]);

  const ctx: CompanionContext = { ...EMPTY_CONTEXT, firstName: name?.split(" ")[0] ?? null };

  const planRow = (plans.data as { outline_enc: string; week_index: number }[] | null)?.[0];
  if (planRow) {
    try {
      ctx.planTitle = decryptJson<Outline>(planRow.outline_enc).title;
      ctx.planWeek = planRow.week_index;
    } catch {}
  }
  const screenerRow = (screeners.data as { results_enc: string }[] | null)?.[0];
  if (screenerRow) {
    try {
      const rec = decryptJson<ScreenerRecord>(screenerRow.results_enc);
      ctx.phq9 = rec.phq9.score;
      ctx.gad7 = rec.gad7.score;
      ctx.tier = rec.tier;
    } catch {}
  }
  ctx.recentMood = ((moods.data ?? []) as { mood: number }[]).map((m) => m.mood);
  ctx.hasSafetyPlan = ((safety.data ?? []) as unknown[]).length > 0;
  const dayTasks = (tasks.data ?? []) as { completed_at: string | null }[];
  if (dayTasks.length) {
    ctx.todayTotal = dayTasks.length;
    ctx.todayDone = dayTasks.filter((t) => t.completed_at).length;
  }
  const tz = (profile.data as { timezone: string }[] | null)?.[0]?.timezone;
  if (tz) {
    try {
      ctx.localTime = new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
    } catch {}
  }
  return ctx;
}

/** Chat history plus today's remaining allowance. */
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const messages = await history(auth.insforge, 60);
    return NextResponse.json({ messages });
  } catch (err) {
    logError("companion.history.failed", err, { user: auth.userId });
    return NextResponse.json({ error: "Couldn't load your conversation." }, { status: 500 });
  }
}

/** Memory control: wipes the whole conversation. */
export async function DELETE() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.insforge.database.from("companion_messages").delete().not("id", "is", null);
  if (error) {
    logError("companion.forget.failed", error, { user: auth.userId });
    return NextResponse.json({ error: "Couldn't clear your conversation." }, { status: 500 });
  }
  logEvent("companion.forgotten", { user: auth.userId });
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;

  const parsed = CompanionInput.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Type a little more and I'll listen." }, { status: 400 });
  const { message } = parsed.data;

  // Safety first, and deliberately before any quota or paywall check: someone in crisis
  // must never be blocked by a limit, and the model is not asked to handle it.
  const verdict = classify(message);
  if (verdict.kind === "crisis") {
    await save(insforge, "user", message, true);
    await save(insforge, "assistant", CRISIS_REPLY, true);
    logEvent("companion.crisis_handoff", { user: userId });
    return NextResponse.json({ reply: CRISIS_REPLY, crisis: true });
  }

  const gate = await requireFeature(insforge, "companion");
  if ("error" in gate) return gate.error;
  if (!(await withinLimit(insforge, "companion", gate.limit))) {
    return gate.plan.pro
      ? NextResponse.json({ error: "We've talked a lot today. I'll be here tomorrow." }, { status: 429 })
      : NextResponse.json({ error: `Free includes ${gate.limit} messages a day. Go Pro to keep talking.`, upgrade: true, feature: "companion" }, { status: 402 });
  }

  let stream: Awaited<ReturnType<typeof openrouter.chat.completions.create>>;
  try {
    const { data: me } = await insforge.auth.getCurrentUser();
    const profile = (me?.user as { profile?: { name?: string } } | undefined)?.profile;
    const [ctx, past] = await Promise.all([buildContext(insforge, profile?.name ?? null), history(insforge, CONTEXT_TURNS)]);

    const system = [
      SYSTEM_PROMPT,
      `\nWhat you know about them: ${contextBriefing(ctx)}`,
      verdict.kind === "medical"
        ? `\nThis turn asks for medication or diagnosis advice. Your reply MUST begin with exactly this text, then continue naturally:\n"""${MEDICAL_BOUNDARY}"""`
        : "",
    ].join("\n");

    stream = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.7,
      max_completion_tokens: 500,
      stream: true,
      messages: [{ role: "system", content: system }, ...past.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: message }],
      ...PRIVATE_ROUTING,
    } as unknown as ChatCompletionCreateParamsStreaming);
  } catch (err) {
    logError("companion.stream.failed", err, { user: userId });
    return NextResponse.json({ error: "I lost my train of thought. Try again?" }, { status: 502 });
  }

  await save(insforge, "user", message);

  // Server-sent events: `delta` chunks while the reply is written, then `done`.
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      let full = "";
      try {
        for await (const chunk of stream as AsyncIterable<{ choices: { delta?: { content?: string } }[] }>) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (!delta) continue;
          full += delta;
          send("delta", delta);
        }
        if (!full.trim()) full = "I'm here. Tell me a bit more about what's going on.";
        await save(insforge, "assistant", full);
        send("done", { medical: verdict.kind === "medical" });
        logEvent("companion.reply", { user: userId, chars: full.length, medical: verdict.kind === "medical" });
      } catch (err) {
        logError("companion.stream.interrupted", err, { user: userId });
        if (full.trim()) {
          try {
            await save(insforge, "assistant", full);
          } catch {}
        }
        send("error", { error: "My reply got cut off. Try again?" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" },
  });
}
