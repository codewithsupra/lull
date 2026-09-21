import { NextResponse } from "next/server";
import { z } from "zod";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { openrouter, CHAT_MODEL, parseJsonReply } from "@/lib/ai/openrouter";
import { requireFeature } from "@/lib/billing-server";
import { withinLimit } from "@/lib/care-plan-server";

const Insight = z.object({
  headline: z.string().max(140),
  observations: z.array(z.string().max(240)).max(4),
  suggestion: z.object({
    text: z.string().max(200),
    action: z.enum(["breathe", "sounds", "compose"]).catch("breathe"),
  }),
});

export async function POST() {
  const insforge = await createInsForgeServerClient();
  const { data: auth } = await insforge.auth.getCurrentUser();
  if (!auth?.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const gate = await requireFeature(insforge, "insight");
  if ("error" in gate) return gate.error;
  if (!(await withinLimit(insforge, "insight", gate.limit))) return NextResponse.json({ error: "That's plenty of insight for today. Come back tomorrow." }, { status: 429 });

  const [checkins, practice] = await Promise.all([
    insforge.database.from("mood_checkins").select("mood, energy, tags, note, created_at").order("created_at", { ascending: false }).limit(30),
    insforge.database.from("practice_sessions").select("kind, title, duration_sec, created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  const rows = checkins.data ?? [];
  if (rows.length < 3) {
    return NextResponse.json({ error: "Log at least 3 check-ins to unlock insights." }, { status: 400 });
  }

  try {
    const completion = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.5,
      max_completion_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You are a gentle wellbeing companion. Mood and energy are on a 1-5 scale. Look for real patterns in the data: time of day, tags, energy compared with mood, and whether practice lines up with better days. Be specific and kind, and never clinical. Reply as JSON: {"headline": string, "observations": [2-3 short strings], "suggestion": {"text": string, "action": "breathe"|"sounds"|"compose"}}.',
        },
        { role: "user", content: JSON.stringify({ now: new Date().toISOString(), checkins: rows, practice: practice.data ?? [] }) },
      ],
    });
    return NextResponse.json(Insight.parse(parseJsonReply(completion.choices[0]?.message?.content ?? "")));
  } catch (err) {
    console.error("insight failed", err);
    return NextResponse.json({ error: "Couldn't read your patterns right now. Try again shortly." }, { status: 502 });
  }
}
