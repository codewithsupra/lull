import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/care-plan-server";
import { logError } from "@/lib/log";

const Sub = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const sub = Sub.safeParse(await request.json().catch(() => ({})));
  if (!sub.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  const { insforge, userId } = auth;
  await insforge.database.from("push_subscriptions").delete().eq("endpoint", sub.data.endpoint);
  const { error } = await insforge.database
    .from("push_subscriptions")
    .insert([{ endpoint: sub.data.endpoint, p256dh: sub.data.keys.p256dh, auth: sub.data.keys.auth }]);
  if (error) {
    logError("push.subscribe.failed", error, { user: userId });
    return NextResponse.json({ error: "Couldn't turn on reminders." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await auth.insforge.database.from("push_subscriptions").delete().eq("endpoint", body.data.endpoint);
  return NextResponse.json({ ok: true });
}
