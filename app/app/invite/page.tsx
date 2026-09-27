"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/app/user-context";
import { useI18n } from "@/components/i18n/locale-provider";
import { CardsPanel } from "@/components/share/cards-panel";
import { BuddyPanel } from "@/components/share/buddy-panel";
import { localToday } from "@/lib/care-client";
import { BUDDY_ACTIVE_DAYS, BUDDY_DAYS, normalizeCode, type BuddyView, type JoinResult } from "@/lib/buddy";
import type { CardStats } from "@/lib/share-card";
import { fmt } from "@/lib/i18n";

export default function InvitePage() {
  return (
    <Suspense>
      <Invite />
    </Suspense>
  );
}

function Invite() {
  const user = useUser();
  const { t, tag } = useI18n();
  const v = t.invite;
  const router = useRouter();
  const params = useSearchParams();
  const joinCode = normalizeCode(params.get("join"));

  const [data, setData] = useState<{ buddy: BuddyView; card: CardStats } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null);

  const load = useCallback(() => {
    fetch(`/api/buddy?today=${localToday()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setData(await res.json());
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const join = async () => {
    if (!joinCode) return;
    setJoining(true);
    const res = await fetch("/api/buddy/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: joinCode }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setJoinResult((json.result as JoinResult) ?? "invalid");
    setJoining(false);
    router.replace("/app/invite");
    load();
  };

  const joinBody = fmt(v.join.body, { active: BUDDY_ACTIVE_DAYS, days: BUDDY_DAYS });

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="mono-label">{v.label}</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">{joinCode ? v.join.heading : v.heading}</h1>
        <p className="mt-4 text-muted">{joinCode ? joinBody : v.intro}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login?mode=signup" className="rounded-full bg-mint px-6 py-3 text-sm font-semibold text-bg">
            {v.join.signUp}
          </Link>
          <Link href="/login" className="rounded-full border border-line px-6 py-3 text-sm">
            {v.join.haveAccount}
          </Link>
        </div>
      </div>
    );
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(tag, { month: "short", day: "numeric" });

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4">
      <header className="max-w-2xl">
        <p className="mono-label">{v.label}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">{v.heading}</h1>
        <p className="mt-3 text-muted">{v.intro}</p>
      </header>

      {joinCode && !joinResult && (
        <section className="glass rounded-3xl border border-mint/30 p-6">
          <h2 className="text-xl font-semibold">{v.join.heading}</h2>
          <p className="mt-2 text-muted">{joinBody}</p>
          <button onClick={join} disabled={joining} className="mt-4 rounded-full bg-mint px-6 py-2.5 text-sm font-semibold text-bg disabled:opacity-60">
            {joining ? v.join.joining : v.join.button}
          </button>
        </section>
      )}
      {joinResult && (
        <section role="status" className={`glass rounded-3xl p-5 ${joinResult === "joined" ? "border border-mint/40" : ""}`}>
          <p className={joinResult === "joined" ? "font-semibold text-mint" : "text-ink"}>{v.join.results[joinResult]}</p>
          {joinResult === "joined" && (
            <Link href="/app/plan" className="mt-3 inline-block rounded-full bg-mint px-5 py-2 text-sm font-semibold text-bg">
              {v.join.toPlan}
            </Link>
          )}
        </section>
      )}

      {loadError && <p className="text-rose">{v.loadFailed}</p>}
      {!data && !loadError && <p className="text-muted">{v.loading}</p>}

      {data && (
        <div className="grid gap-8 lg:grid-cols-2">
          <CardsPanel stats={data.card} inviteUrl={data.buddy.url} />
          <BuddyPanel buddy={data.buddy} fmtDate={fmtDate} />
        </div>
      )}
    </div>
  );
}
