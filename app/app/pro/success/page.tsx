"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBilling } from "@/lib/billing-client";

/**
 * Stripe redirects here, but access is granted only by the verified webhook → trigger path,
 * so we poll until the entitlement lands rather than trusting the redirect.
 */
export default function ProSuccess() {
  const [state, setState] = useState<"waiting" | "active" | "slow">("waiting");

  useEffect(() => {
    let tries = 0;
    let timer = 0;
    const poll = () => {
      fetchBilling()
        .then((b) => {
          if (b.plan?.source === "subscription") return setState("active");
          if (++tries >= 30) return setState("slow");
          timer = window.setTimeout(poll, 2000);
        })
        .catch(() => {
          timer = window.setTimeout(poll, 3000);
        });
    };
    poll();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="relative mx-auto h-36 w-36">
        <div className={`absolute inset-0 rounded-full bg-lime/15 ${state === "waiting" ? "animate-ping [animation-duration:2s]" : ""}`} />
        <div className="absolute inset-5 grid place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff9,var(--lime)_40%,var(--mint)_80%)] text-4xl shadow-[0_0_90px_-10px_var(--lime)]">
          {state === "active" ? "✦" : ""}
        </div>
      </div>
      {state === "waiting" && <p className="shimmer-text mt-10 font-[family-name:var(--font-display)] text-xl font-semibold">Confirming your payment securely…</p>}
      {state === "active" && (
        <>
          <h1 className="mt-10 font-[family-name:var(--font-display)] text-3xl font-semibold">Welcome to Lull Pro.</h1>
          <p className="mt-3 text-muted">Everything is unlocked. Your garden just got a lot brighter.</p>
          <Link href="/app/plan" className="mt-8 inline-block rounded-full bg-lime px-7 py-3 text-sm font-semibold text-bg">
            Go to my plan →
          </Link>
        </>
      )}
      {state === "slow" && (
        <>
          <h1 className="mt-10 font-[family-name:var(--font-display)] text-2xl font-semibold">Payment received, still syncing.</h1>
          <p className="mt-3 text-muted">This can take a minute. Pro will switch on automatically, and you can safely leave this page.</p>
          <Link href="/app" className="mt-8 inline-block rounded-full border border-white/15 px-6 py-2.5 text-sm">
            Back to Lull
          </Link>
        </>
      )}
    </div>
  );
}
