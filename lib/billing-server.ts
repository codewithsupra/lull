import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { FREE_PLAN, allowance, currencyForCountry, type Feature, type Plan } from "@/lib/billing";
import type { ServerClient } from "@/lib/care-plan-server";

export async function getPlan(insforge: ServerClient): Promise<Plan> {
  const { data, error } = await insforge.database.rpc("my_plan");
  if (error || !data) return FREE_PLAN;
  return data as Plan;
}

export async function requestCurrency() {
  const h = await headers();
  return currencyForCountry(h.get("x-vercel-ip-country"));
}

/**
 * Server-side paywall. Returns the plan and today's allowance, or a 402 response the client
 * turns into the upgrade sheet. Never trust the client to enforce this.
 */
export async function requireFeature(insforge: ServerClient, feature: Feature) {
  const plan = await getPlan(insforge);
  const limit = allowance(plan, feature);
  if (limit === 0) {
    return {
      error: NextResponse.json({ error: "This is a Lull Pro feature.", upgrade: true, feature }, { status: 402 }),
    } as const;
  }
  return { plan, limit } as const;
}
