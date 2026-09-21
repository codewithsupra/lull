"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { IntakeWizard } from "@/components/plan/intake-wizard";
import { PlanHome } from "@/components/plan/plan-home";
import { CrisisCard } from "@/components/plan/crisis-card";
import { fetchPlan } from "@/lib/care-client";
import type { PlanView } from "@/lib/care-plan";

export default function PlanPage() {
  const user = useUser();
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [care, setCare] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    fetchPlan()
      .then((p) => {
        setPlan(p);
        setVersion((v) => v + 1);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <p className="mono-label !text-mint">care plan</p>
        <h1 className="mt-3 font-[family-name:var(--font-unbounded)] text-3xl font-semibold tracking-tight sm:text-5xl">Your prescription, turned into a daily plan.</h1>
        <p className="mx-auto mt-4 max-w-lg text-muted">
          Scan your prescription or describe your diagnosis. Lull builds a private 4-week plan with your medicine schedule,
          habits, breathing and sound sessions, and learning, and every step you complete grows your night garden.
        </p>
        <Link href="/login?mode=signup" className="mt-8 inline-block rounded-full bg-mint px-7 py-3 text-sm font-semibold text-bg shadow-[0_0_40px_-8px_var(--mint)]">
          Create a free account to start
        </Link>
        <p className="mono-label mt-4 !text-[10px]">encrypted · no personal details stored · delete anytime</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <p className="shimmer-text font-mono text-xs uppercase tracking-[0.2em]">Opening your plan…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="py-16 text-center text-muted">
        Couldn&apos;t load your plan.{" "}
        <button onClick={load} className="text-ink underline decoration-white/30">
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      {care && <CrisisCard message={care} onContinue={() => setCare(null)} />}
      {plan ? (
        <PlanHome key={version} plan={plan} onChanged={load} onDeleted={() => setPlan(null)} />
      ) : (
        <IntakeWizard
          onCreated={(c) => {
            setCare(c);
            load();
          }}
        />
      )}
    </>
  );
}
