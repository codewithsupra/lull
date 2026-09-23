"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { CheckFlow } from "@/components/check/check-flow";
import { CheckResults, type HistoryPoint } from "@/components/check/check-results";
import type { ScreenerRecord } from "@/lib/screeners";

type State = { latest: ScreenerRecord | null; history: HistoryPoint[]; next_due: string | null; followup_pending: boolean };

export default function CheckPage() {
  const user = useUser();
  const [state, setState] = useState<State | null>(null);
  const [mode, setMode] = useState<"intro" | "flow" | "results">("intro");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/screeners", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        return json as State;
      })
      .then((json) => {
        setState(json);
        if (json.latest && json.next_due && Date.parse(json.next_due) > Date.now()) setMode("results");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="mono-label !text-mint">wellbeing check</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">Know where you are. Get the right support.</h1>
        <p className="mt-4 text-muted">A 3-minute, clinically validated check (PHQ-9 and GAD-7) that points you to the right level of support. It&apos;s private and encrypted.</p>
        <Link href="/login?mode=signup" className="mt-8 inline-block rounded-full bg-mint px-7 py-3 text-sm font-semibold text-bg">
          Create a free account
        </Link>
      </div>
    );
  }

  if (mode === "flow") {
    return (
      <CheckFlow
        onDone={(record) => {
          setMode("results");
          setState((s) => ({
            latest: record,
            history: [{ id: record.at, at: record.at, tier: record.tier, risk: record.risk, phq9: record.phq9.score, gad7: record.gad7.score, sleep: record.sleep.score }, ...(s?.history ?? [])],
            next_due: new Date(Date.parse(record.at) + 14 * 86_400_000).toISOString(),
            followup_pending: false,
          }));
        }}
      />
    );
  }

  if (mode === "results" && state?.latest) {
    return <CheckResults record={state.latest} history={state.history} nextDue={state.next_due} onRetake={() => setMode("flow")} />;
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      {state?.followup_pending && (
        <div className="mb-8 rounded-3xl border border-rose/25 bg-rose/[0.06] p-6">
          <p className="mono-label !text-rose">checking in</p>
          <p className="mt-2 text-lg">Yesterday was a hard day. How are you doing now?</p>
          <p className="mt-2 text-sm text-muted">If things feel unsafe, Tele-MANAS is free and always open.</p>
          <a href="tel:14416" className="mt-4 inline-block rounded-full bg-rose px-5 py-2 text-sm font-semibold text-bg">
            Call 14416
          </a>
        </div>
      )}
      <p className="mono-label !text-mint">wellbeing check · 3 minutes</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">How have the last two weeks been?</h1>
      <p className="mt-4 text-muted">
        20 quick questions using the PHQ-9 and GAD-7, the same questionnaires doctors use worldwide. Your answers shape your care path and your plan.
        We ask again every two weeks so you can see real progress.
      </p>
      <ul className="mt-6 space-y-2 text-sm text-muted">
        <li>🔒 Encrypted. Only you can see your answers.</li>
        <li>🧭 A screening, not a diagnosis. We&apos;ll point you to the right kind of support.</li>
        <li>💬 If anything feels heavy, help is one tap away the whole time.</li>
      </ul>
      {error && <p className="mt-6 text-sm text-rose">{error}</p>}
      <div className="mt-10 flex items-center gap-4">
        <button onClick={() => setMode("flow")} className="rounded-full bg-ink px-8 py-3 text-sm font-semibold text-bg shadow-[0_0_40px_-8px_rgba(142,245,212,0.8)]">
          Begin check
        </button>
        {state?.latest && (
          <button onClick={() => setMode("results")} className="text-sm text-muted hover:text-ink">
            See last results
          </button>
        )}
      </div>
    </div>
  );
}
