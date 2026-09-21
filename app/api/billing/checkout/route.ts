import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PAYMENTS_ENV, priceFor } from "@/lib/billing";
import { getPlan, requestCurrency } from "@/lib/billing-server";
import { requireUser } from "@/lib/care-plan-server";
import { logError, logEvent } from "@/lib/log";

const Body = z.object({ interval: z.enum(["month", "year"]) });

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { insforge, userId } = auth;

  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: "Pick monthly or yearly." }, { status: 400 });

  const plan = await getPlan(insforge);
  if (plan.source === "subscription") return NextResponse.json({ error: "You're already on Pro.", manage: true }, { status: 409 });

  const { data: me } = await insforge.auth.getCurrentUser();
  // Price is chosen server-side from the catalog; the client only picks the interval.
  const price = priceFor(await requestCurrency(), body.data.interval);
  const origin = request.nextUrl.origin;
  const bucket = Math.floor(Date.now() / (10 * 60_000)); // reuse the same session for 10 minutes

  const { data, error } = await insforge.payments.stripe.createCheckoutSession(PAYMENTS_ENV, {
    mode: "subscription",
    lineItems: [{ priceId: price.id, quantity: 1 }],
    successUrl: `${origin}/app/pro/success`,
    cancelUrl: `${origin}/app/pro?canceled=1`,
    subject: { type: "user", id: userId },
    customerEmail: me?.user?.email ?? null,
    metadata: { app: "lull", interval: body.data.interval },
    idempotencyKey: `lull:${userId}:${price.id}:${bucket}`,
  });
  const url = data?.checkoutSession?.url;
  if (error || !url) {
    logError("billing.checkout.failed", error, { user: userId });
    return NextResponse.json({ error: "Couldn't start checkout. Please try again." }, { status: 502 });
  }
  logEvent("billing.checkout.created", { user: userId, interval: body.data.interval, price: price.id });
  return NextResponse.json({ url });
}
