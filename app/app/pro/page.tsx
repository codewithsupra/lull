"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { Pricing } from "@/components/billing/pricing";
import { fetchBilling, openPortal } from "@/lib/billing-client";
import type { Plan } from "@/lib/billing";

export default function ProPage() {
  const user = useUser();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchBilling().then((b) => setPlan(b.plan)).catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="py-6">
        <Pricing />
        <p className="mt-8 text-center text-sm text-muted">
          <Link href="/login?mode=signup" className="text-ink underline decoration-white/30">Create a free account</Link> to start your trial.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-6">
      {plan?.source === "subscription" && (
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl border-lime/25 p-6">
          <div>
            <p className="mono-label !text-lime">your plan · pro {plan.interval === "year" ? "yearly" : "monthly"}</p>
            <p className="mt-1 text-lg">
              {plan.status === "past_due"
                ? "Your last payment didn't go through. Update your card to keep Pro."
                : plan.cancel_at
                  ? `Pro ends on ${new Date(plan.cancel_at).toLocaleDateString()}. You can resume anytime before then.`
                  : plan.current_period_end
                    ? `Renews on ${new Date(plan.current_period_end).toLocaleDateString()}.`
                    : "Active."}
            </p>
          </div>
          <button
            onClick={() => openPortal().catch((e) => setError(e.message))}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm transition hover:border-white/35"
          >
            Manage billing & invoices →
          </button>
        </div>
      )}
      {error && <p className="text-sm text-rose">{error}</p>}
      <Pricing onPlan={setPlan} />
    </div>
  );
}
