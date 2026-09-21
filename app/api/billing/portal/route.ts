import { NextResponse, type NextRequest } from "next/server";
import { PAYMENTS_ENV } from "@/lib/billing";
import { requireUser } from "@/lib/care-plan-server";
import { logError } from "@/lib/log";

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.insforge.payments.stripe.createCustomerPortalSession(PAYMENTS_ENV, {
    subject: { type: "user", id: auth.userId },
    returnUrl: `${request.nextUrl.origin}/app/pro`,
  });
  const url = data?.customerPortalSession?.url;
  if (error || !url) {
    const status = (error as { statusCode?: number } | null)?.statusCode;
    if (status === 404) return NextResponse.json({ error: "No subscription to manage yet." }, { status: 404 });
    logError("billing.portal.failed", error, { user: auth.userId });
    return NextResponse.json({ error: "Couldn't open billing. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ url });
}
