"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type Feature, type Interval, type Plan } from "@/lib/billing";
import { fetchBilling, startCheckout, startTrial } from "@/lib/billing-client";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt } from "@/lib/i18n";

type Billing = Awaited<ReturnType<typeof fetchBilling>>;

export function Pricing({ feature, compact, onPlan }: { feature?: Feature; compact?: boolean; onPlan?: (p: Plan) => void }) {
  const { t, tag } = useI18n();
  const b = t.app.billing;
  const [billing, setBilling] = useState<Billing | null>(null);
  const [interval, setBillingInterval] = useState<Interval>("year");
  const [busy, setBusy] = useState<"checkout" | "trial" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBilling().then(setBilling).catch(() => setError(b.pricesFailed));
  }, [b.pricesFailed]);

  const price = billing?.prices[interval];
  const monthly = billing?.prices.month;
  const plan = billing?.plan;

  const checkout = async () => {
    setBusy("checkout");
    setError(null);
    try {
      await startCheckout(interval);
    } catch (e) {
      setError(e instanceof Error ? e.message : b.checkoutFailed);
      setBusy(null);
    }
  };
  const trial = async () => {
    setBusy("trial");
    setError(null);
    try {
      const p = await startTrial();
      onPlan?.(p);
      setBilling((b) => (b ? { ...b, plan: p } : b));
    } catch (e) {
      setError(e instanceof Error ? e.message : b.trialFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {feature && (
        <p className="mono-label !text-lime">
          {fmt(b.featureIsPro, { feature: b.features[feature] })}
        </p>
      )}
      <h2 className={`mt-2 font-[family-name:var(--font-display)] font-semibold tracking-tight ${compact ? "text-2xl" : "text-3xl sm:text-5xl"}`}>{b.heading}</h2>
      <p className="mt-3 max-w-lg text-muted">{b.subheading}</p>

      <div className="mt-6 inline-grid grid-cols-2 rounded-full border border-white/10 p-1 text-sm">
        {(["month", "year"] as const).map((i) => (
          <button key={i} onClick={() => setBillingInterval(i)} className={`rounded-full px-5 py-1.5 transition ${interval === i ? "bg-white/10 text-ink" : "text-muted"}`}>
            {i === "month" ? b.monthly : b.yearlySave}
          </button>
        ))}
      </div>

      <div className={`mt-6 grid gap-4 ${compact ? "" : "md:grid-cols-2"}`}>
        {!compact && (
          <div className="rounded-3xl border border-white/10 p-6">
            <p className="mono-label">{b.freeLabel}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">{billing?.currency === "inr" ? "₹0" : "$0"}</p>
            <ul className="mt-5 space-y-2 text-sm text-muted">
              {b.freePerks.map((p) => (
                <li key={p}>✓ {p}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="relative overflow-hidden rounded-3xl border border-lime/30 bg-gradient-to-b from-lime/[0.08] to-transparent p-6 shadow-[0_0_60px_-20px_var(--lime)]">
          <p className="mono-label !text-lime">{b.proLabel}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-3xl font-semibold">{price?.label ?? "…"}</span>
            <span className="text-sm text-muted">{interval === "month" ? b.perMonth : b.perYear}</span>
          </div>
          {interval === "year" && price && monthly && <p className="mt-1 text-xs text-lime">{fmt(b.billedYearly, { perMonth: price.perMonth })}</p>}
          <ul className="mt-5 space-y-2 text-sm">
            {b.proPerks.map((p) => (
              <li key={p}>
                <span className="text-lime">✦</span> {p}
              </li>
            ))}
          </ul>
          <div className="mt-6 space-y-2">
            {billing && !plan ? (
              <Link href="/login?mode=signup" className="block w-full rounded-xl bg-lime py-3 text-center text-sm font-semibold text-bg">
                {b.guestCta}
              </Link>
            ) : plan?.source === "subscription" ? (
              <p className="rounded-xl border border-lime/30 px-4 py-3 text-sm text-lime">{b.onPro}</p>
            ) : (
              <>
                {plan?.trial_available && (
                  <button onClick={trial} disabled={!!busy} className="w-full rounded-xl bg-lime py-3 text-sm font-semibold text-bg transition disabled:opacity-60">
                    {busy === "trial" ? b.starting : b.startTrial}
                  </button>
                )}
                <button
                  onClick={checkout}
                  disabled={!!busy || !billing}
                  className={`w-full rounded-xl py-3 text-sm font-semibold transition disabled:opacity-60 ${plan?.trial_available ? "border border-white/15 text-ink" : "bg-lime text-bg"}`}
                >
                  {busy === "checkout"
                    ? b.opening
                    : fmt(b.subscribe, { price: price?.label ?? "", interval: interval === "month" ? b.perMonthShort : b.perYearShort })}
                </button>
                {plan?.source === "trial" && plan.trial_ends_at && (
                  <p className="text-center text-xs text-muted">
                    {fmt(b.trialEnds, { date: new Date(plan.trial_ends_at).toLocaleDateString(tag, { month: "short", day: "numeric" }) })}
                  </p>
                )}
              </>
            )}
          </div>
          <p className="mt-4 text-center text-[11px] text-faint">{b.footnote}</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-rose">{error}</p>}
    </div>
  );
}
