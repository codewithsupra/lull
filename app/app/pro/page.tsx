"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { Pricing } from "@/components/billing/pricing";
import { fetchBilling, openPortal } from "@/lib/billing-client";
import type { Plan } from "@/lib/billing";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt, splitAround } from "@/lib/i18n";

export default function ProPage() {
  const user = useUser();
  const { t, tag } = useI18n();
  const p = t.app.billing.pro;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchBilling().then((b) => setPlan(b.plan)).catch(() => {});
  }, [user]);

  const [before, after] = splitAround(p.guestTrial);

  if (!user) {
    return (
      <div className="py-6">
        <Pricing />
        <p className="mt-8 text-center text-sm text-muted">
          {before}
          <Link href="/login?mode=signup" className="text-ink underline decoration-white/30">
            {p.guestLink}
          </Link>
          {after}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-6">
      {plan?.source === "subscription" && (
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl border-lime/25 p-6">
          <div>
            <p className="mono-label !text-lime">{fmt(p.planLabel, { interval: plan.interval === "year" ? p.yearly : p.monthly })}</p>
            <p className="mt-1 text-lg">
              {plan.status === "past_due"
                ? p.pastDue
                : plan.cancel_at
                  ? fmt(p.cancelling, { date: new Date(plan.cancel_at).toLocaleDateString(tag) })
                  : plan.current_period_end
                    ? fmt(p.renews, { date: new Date(plan.current_period_end).toLocaleDateString(tag) })
                    : p.active}
            </p>
          </div>
          <button
            onClick={() => openPortal().catch((e) => setError(e.message))}
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm transition hover:border-white/35"
          >
            {p.managePortal}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-rose">{error}</p>}
      <Pricing onPlan={setPlan} />
    </div>
  );
}
