import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { openrouter, CHAT_MODEL, parseJsonReply } from "@/lib/ai/openrouter";
import { PlanSchema } from "@/lib/plan";
import { requireFeature } from "@/lib/billing-server";
import { FEATURES } from "@/lib/billing";
import { getLocale } from "@/lib/i18n/server";
import { LOCALES } from "@/lib/i18n";

const Body = z.object({
  prompt: z.string().trim().min(3).max(600),
  minutes: z.coerce.number().int().min(3).max(15).catch(5),
  locale: z.enum(LOCALES).optional(),
});

/** Session scripts are spoken aloud, so the language has to match the listener's. */
const LANGUAGE: Record<string, string> = {
  en: "Write every string in English.",
  hi: "Write every string in Hindi, in Devanagari script, in warm everyday spoken Hindi — the language a calm friend would use, not formal Hindi. Keep the \"breath\" and \"mix\" values exactly as specified; they are identifiers, not text.",
};

const SYSTEM = `You are Lull, a warm, grounded meditation guide who writes short personalised guided sessions.
Given how the listener feels, compose ONE session as strict JSON (no markdown) with this exact shape:
{
  "title": "2-4 evocative words",
  "intention": "one sentence naming what this session offers them",
  "breath": "coherent" | "box" | "478" | "sigh",
  "mix": { "rain": 0-1, "ocean": 0-1, "wind": 0-1, "fire": 0-1, "brown": 0-1, "drone": 0-1, "bowls": 0-1 },
  "steps": [ { "text": "what the guide says aloud", "pause": seconds of silence after it } ],
  "closing": "one gentle closing line",
  "care": null
}
Guidance:
- Choose the breath pattern for their state: "478" for sleep or racing night thoughts, "box" for focus or overwhelm, "sigh" for acute stress or panic, "coherent" for sadness, grief or general balance.
- Mix 2-4 sound layers (others 0). Warm, low layers for sleep; brown noise for focus; bowls and drone for grief or reflection.
- Write steps in second person, present tense, calm and concrete. Use short sentences that sound good read aloud. Reflect their situation specifically without repeating their words back verbatim.
- Include body awareness, a breath section that names the chosen pattern, and a reframe tied to what they shared.
- Steps plus pauses should fill roughly the requested minutes. Use 6-10 steps with pauses of 6-40 seconds.
- Never diagnose or give medical advice.
- If they mention self-harm, suicide or being in danger, set "care" to a brief, kind message urging them to reach out now to local emergency services or a crisis line (in the US, call or text 988). Keep the session gentle and grounding. Otherwise "care" is null.`;

export async function POST(request: NextRequest) {
  const insforge = await createInsForgeServerClient();
  const { data: auth } = await insforge.auth.getCurrentUser();
  if (!auth?.user) return NextResponse.json({ error: "Sign in to compose sessions." }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  // The body may carry the locale (the composer sends it); otherwise fall back to the cookie.
  const locale = parsed.success && parsed.data.locale ? parsed.data.locale : await getLocale();
  if (!parsed.success) return NextResponse.json({ error: "Tell Lull a little more about how you feel." }, { status: 400 });
  const { prompt, minutes } = parsed.data;

  const gate = await requireFeature(insforge, "compose");
  if ("error" in gate) return gate.error;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await insforge.database
    .from("composed_sessions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if ((count ?? 0) >= gate.limit) {
    return gate.plan.pro
      ? NextResponse.json({ error: "You've composed a lot today. Replay one from your history, or come back tomorrow." }, { status: 429 })
      : NextResponse.json({ error: `Free includes ${gate.limit} composed sessions a day. Go Pro for ${FEATURES.compose.pro}.`, upgrade: true, feature: "compose" }, { status: 402 });
  }

  let plan;
  try {
    const completion = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.85,
      max_completion_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${SYSTEM}\n\nLanguage:\n${LANGUAGE[locale]}` },
        { role: "user", content: `Session length: about ${minutes} minutes.\nHow I feel right now: ${prompt}` },
      ],
    });
    plan = PlanSchema.parse(parseJsonReply(completion.choices[0]?.message?.content ?? ""));
  } catch (err) {
    console.error("compose failed", err);
    return NextResponse.json({ error: "The composer lost its train of thought. Try again in a moment." }, { status: 502 });
  }

  const { data, error } = await insforge.database
    .from("composed_sessions")
    .insert([{ prompt, title: plan.title.slice(0, 120), plan }])
    .select("id, created_at");
  if (error) console.error("save composed session failed", error.message);

  return NextResponse.json({ id: (data as { id: string }[] | null)?.[0]?.id ?? null, plan });
}
