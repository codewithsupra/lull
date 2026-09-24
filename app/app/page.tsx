"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useUser } from "@/components/app/user-context";
import { CheckinCard } from "@/components/app/checkin-card";
import { MoodChart } from "@/components/app/mood-chart";
import { GuestNote } from "@/components/app/guest-note";
import { fetchCareStats, type CareStats } from "@/lib/care-client";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt, type Messages } from "@/lib/i18n";
import { levelFor } from "@/lib/care-plan";
import { type Tier } from "@/lib/screeners";
import {
  fetchCheckins,
  fetchRecentPractice,
  fetchStats,
  formatDuration,
  timeAgo,
  type MoodCheckin,
  type PracticeSession,
  type Stats,
} from "@/lib/data";

const KIND_ICON = { breathe: "◎", soundscape: "∿", composed: "✦", sleep: "☾" } as const;

function greeting(t: Messages) {
  const h = new Date().getHours();
  const g = t.today.greeting;
  if (h < 5) return g.stillUp;
  if (h < 12) return g.morning;
  if (h < 17) return g.afternoon;
  if (h < 22) return g.evening;
  return g.windingDown;
}

function suggestion(t: Messages): { title: string; body: string; href: string } {
  const h = new Date().getHours();
  const s = t.today.suggestions;
  if (h >= 21 || h < 5) return { ...s.sleep, href: `/app/compose?q=${encodeURIComponent(s.sleepQuery)}` };
  if (h < 11) return { ...s.morning, href: "/app/breathe" };
  if (h < 17) return { ...s.midday, href: "/app/breathe" };
  return { ...s.evening, href: "/app/compose" };
}

export default function TodayPage() {
  const user = useUser();
  const { t, tag } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<PracticeSession[]>([]);
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [care, setCare] = useState<CareStats | null>(null);
  const [check, setCheck] = useState<{ due: boolean; tierName: string | null } | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const greet = mounted ? greeting(t) : t.today.greeting.hello;
  const tip = mounted ? suggestion(t) : null;

  useEffect(() => {
    if (!user) return;
    void Promise.all([fetchStats(), fetchRecentPractice(), fetchCheckins(14), fetchCareStats()]).then(([s, r, c, cs]) => {
      setStats(s);
      setRecent(r);
      setCheckins(c);
      setCare(cs);
    });
    fetch("/api/screeners", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { latest: { tier: Tier } | null; next_due: string | null } | null) => {
        if (!j) return;
        setCheck({ due: !j.next_due || Date.parse(j.next_due) <= Date.now(), tierName: j.latest ? t.screeners.tiers[j.latest.tier].name : null });
      })
      .catch(() => {});
  }, [user, t]);

  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0];

  const tiles = [
    { label: t.today.tiles.streak, value: stats?.streak ?? 0, accent: "text-lime" },
    { label: t.today.tiles.minutes, value: stats?.total_minutes ?? 0, accent: "text-mint" },
    { label: t.today.tiles.sessions, value: stats?.session_count ?? 0, accent: "text-sky" },
    { label: t.today.tiles.checkins, value: stats?.checkin_count ?? 0, accent: "text-lilac" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="mono-label">{new Date().toLocaleDateString(tag, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
          {firstName ? fmt(t.today.greeting.withName, { greeting: greet, name: firstName }) : fmt(t.today.greeting.plain, { greeting: greet })}
        </h1>
      </div>

      {!user && <GuestNote>{t.today.guestNote}</GuestNote>}

      <Link href="/app/plan" className="group glass relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl p-6">
        <div className="absolute -left-10 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(200,255,110,0.22),transparent_70%)] blur-2xl transition-transform duration-700 group-hover:scale-125" />
        {care?.plan ? (
          <>
            <div className="relative">
              <p className="mono-label !text-lime">{fmt(t.today.plan.label, { week: care.plan.week })}</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                {fmt(t.today.plan.doneToday, { done: care.today.done, total: care.today.total })}
              </p>
            </div>
            <div className="relative text-right font-mono text-xs text-muted">
              <div className="text-lime">
                {t.common.level} {levelFor(care.xp).level} · {care.xp} {t.common.xp}
              </div>
              <div>{fmt(t.today.plan.streak, { days: care.streak })}</div>
            </div>
          </>
        ) : (
          <div className="relative">
            <p className="mono-label !text-lime">{t.today.plan.newLabel}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold sm:text-2xl">{t.today.plan.newTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.today.plan.newBody}</p>
          </div>
        )}
      </Link>

      {check?.due && (
        <Link href="/app/check" className="glass group flex flex-wrap items-center justify-between gap-3 rounded-3xl border-sky/25 p-5">
          <div>
            <p className="mono-label !text-sky">{check.tierName ? t.today.check.dueLabel : t.today.check.firstLabel}</p>
            <p className="mt-1 text-lg">{check.tierName ? t.today.check.dueBody : t.today.check.firstBody}</p>
          </div>
          <span className="rounded-full bg-sky px-4 py-2 text-sm font-semibold text-bg transition group-hover:translate-x-0.5">{t.common.begin}</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="glass rounded-2xl p-5">
            <div className={`font-[family-name:var(--font-display)] text-3xl font-semibold ${t.accent}`}>{t.value}</div>
            <div className="mono-label mt-1 !text-[10px]">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          {tip && (
            <Link href={tip.href} className="group glass relative block overflow-hidden rounded-3xl p-7">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(142,245,212,0.35),transparent_70%)] blur-2xl transition-transform duration-700 group-hover:scale-125" />
              <p className="mono-label !text-mint">{t.today.suggested}</p>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">{tip.title}</h2>
              <p className="mt-2 max-w-md text-muted">{tip.body}</p>
              <span className="mt-5 inline-block text-sm text-ink transition group-hover:translate-x-1">{t.common.begin}</span>
            </Link>
          )}
          <div className="grid grid-cols-3 gap-3">
            {[
              { href: "/app/compose", icon: "✦", label: t.nav.compose },
              { href: "/app/breathe", icon: "◎", label: t.nav.breathe },
              { href: "/app/sounds", icon: "∿", label: t.nav.sounds },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="glass group rounded-2xl p-5 text-center transition hover:border-white/20">
                <div className="text-2xl transition group-hover:scale-110">{a.icon}</div>
                <div className="mt-2 text-sm text-muted group-hover:text-ink">{a.label}</div>
              </Link>
            ))}
          </div>
          <div className="glass rounded-3xl p-6">
            <div className="flex items-baseline justify-between">
              <p className="mono-label">{t.today.moodHeading}</p>
              <Link href="/app/journal" className="font-mono text-xs text-muted hover:text-ink">{t.today.journalLink}</Link>
            </div>
            <div className="mt-4">
              <MoodChart checkins={checkins} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <CheckinCard
            disabled={!user}
            onSaved={(c) => {
              setCheckins((cur) => [c, ...cur].slice(0, 14));
              setStats((s) => (s ? { ...s, checkin_count: s.checkin_count + 1 } : s));
            }}
          />
          <div className="glass rounded-3xl p-6">
            <p className="mono-label">{t.today.recentHeading}</p>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{user ? t.today.recentEmpty : t.today.recentGuest}</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5">{KIND_ICON[r.kind]}</span>
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className="font-mono text-xs text-muted">{formatDuration(r.duration_sec, t)}</span>
                    <span className="w-16 text-right font-mono text-[10px] text-faint">{timeAgo(r.created_at, t, tag)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
