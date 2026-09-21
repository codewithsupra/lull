import { NextResponse } from "next/server";
import { getPlan } from "@/lib/billing-server";
import { requireUser } from "@/lib/care-plan-server";
import { logError, logEvent } from "@/lib/log";

/** One 7-day Pro trial per account, no card required. Duration is set by the database, not the client. */
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;
  const plan = await getPlan(insforge);
  if (!plan.trial_available) return NextResponse.json({ error: "Your free trial has already been used." }, { status: 409 });

  const { error } = await insforge.database.from("pro_trials").insert([{ user_id: userId }]);
  if (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "Your free trial has already been used." }, { status: 409 });
    logError("billing.trial.failed", error, { user: userId });
    return NextResponse.json({ error: "Couldn't start your trial." }, { status: 500 });
  }
  logEvent("billing.trial.started", { user: userId });
  return NextResponse.json({ plan: await getPlan(insforge) });
}
