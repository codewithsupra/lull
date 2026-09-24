import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { createAdminClient } from "@insforge/sdk";
import { logError, logEvent } from "@/lib/log";
import { DEFAULT_LOCALE, asLocale, messagesFor, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Slot = keyof ReturnType<typeof messagesFor>["plan"]["notifications"];

/**
 * Reminder copy, in the language the user chose (FR8).
 * Generic by design: lock screens are public, so this never names medications or conditions.
 */
function copyFor(slot: string, locale: Locale) {
  const all = messagesFor(locale).plan.notifications;
  return all[(slot as Slot) in all ? (slot as Slot) : "evening"];
}

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-cron-secret") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

type Target = { user_id: string; slot: string; endpoint: string; p256dh: string; auth: string };

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const admin = createAdminClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!, apiKey: process.env.INSFORGE_API_KEY! });

  const { data, error } = await admin.database.rpc("claim_due_reminders", { p_window_minutes: 5 });
  if (error) {
    logError("push.dispatch.claim_failed", error);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }

  const targets = (data ?? []) as Target[];

  // One lookup for everyone in this batch: the cookie is not available to a cron run, so the
  // language comes from the care profile.
  const locales = new Map<string, Locale>();
  if (targets.length) {
    const { data: profiles } = await admin.database
      .from("care_profiles")
      .select("user_id, locale")
      .in("user_id", [...new Set(targets.map((t) => t.user_id))]);
    for (const row of (profiles ?? []) as { user_id: string; locale: string }[]) locales.set(row.user_id, asLocale(row.locale));
  }

  let sent = 0;
  let pruned = 0;
  await Promise.all(
    targets.map(async (t) => {
      const copy = copyFor(t.slot, locales.get(t.user_id) ?? DEFAULT_LOCALE);
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify({ ...copy, url: "/app/plan", tag: `plan-${t.slot}` }),
          { TTL: 60 * 30, urgency: "normal" },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin.database.from("push_subscriptions").delete().eq("endpoint", t.endpoint);
          pruned++;
        } else {
          logError("push.dispatch.send_failed", err, { status: status ?? null });
        }
      }
    }),
  );

  logEvent("push.dispatch", { targets: targets.length, sent, pruned });
  return NextResponse.json({ targets: targets.length, sent, pruned });
}
