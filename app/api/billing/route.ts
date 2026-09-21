import { NextResponse } from "next/server";
import { PRICES } from "@/lib/billing";
import { getPlan, requestCurrency } from "@/lib/billing-server";
import { requireUser } from "@/lib/care-plan-server";

/** Current plan + prices in the visitor's currency. */
export async function GET() {
  const currency = await requestCurrency();
  const auth = await requireUser();
  const plan = "error" in auth ? null : await getPlan(auth.insforge);
  return NextResponse.json({ plan, currency, prices: PRICES[currency] });
}
