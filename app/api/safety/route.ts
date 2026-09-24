import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/care-plan-server";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { SafetyPlan } from "@/lib/safety";
import { headers } from "next/headers";
import { logError, logEvent } from "@/lib/log";
import { apiErrors } from "@/lib/i18n/server";

/** The safety plan is free for everyone, forever: it is never behind the paywall. */
export async function GET() {
  const e = await apiErrors();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const country = (await headers()).get("x-vercel-ip-country") ?? null;
  try {
    const { data } = await auth.insforge.database.from("safety_plans").select("plan_enc, updated_at").limit(1);
    const row = (data as { plan_enc: string; updated_at: string }[] | null)?.[0];
    return NextResponse.json({
      plan: row ? decryptJson<SafetyPlan>(row.plan_enc) : null,
      updated_at: row?.updated_at ?? null,
      country,
    });
  } catch (err) {
    logError("safety.load.failed", err, { user: auth.userId });
    return NextResponse.json({ error: e.safety.loadFailed }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const e = await apiErrors();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = SafetyPlan.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: e.safety.invalid }, { status: 400 });

  const row = { plan_enc: encryptJson(parsed.data), updated_at: new Date().toISOString() };
  const { error } = await auth.insforge.database.from("safety_plans").upsert([row], { onConflict: "user_id" });
  if (error) {
    logError("safety.save.failed", error, { user: auth.userId });
    return NextResponse.json({ error: e.safety.saveFailed }, { status: 500 });
  }
  logEvent("safety.saved", { user: auth.userId });
  return NextResponse.json({ plan: parsed.data, updated_at: row.updated_at });
}

export async function DELETE() {
  const e = await apiErrors();
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.insforge.database.from("safety_plans").delete().not("user_id", "is", null);
  if (error) return NextResponse.json({ error: e.safety.deleteFailed }, { status: 500 });
  return NextResponse.json({ ok: true });
}
