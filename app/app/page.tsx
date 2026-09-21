"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useUser } from "@/components/app/user-context";
import { CheckinCard } from "@/components/app/checkin-card";
import { MoodChart } from "@/components/app/mood-chart";
import { GuestNote } from "@/components/app/guest-note";
import { fetchCareStats, type CareStats } from "@/lib/care-client";
import { levelFor } from "@/lib/care-plan";
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

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Winding down";
}

function suggestion(): { title: string; body: string; href: string } {
  const h = new Date().getHours();
  if (h >= 21 || h < 5) return { title: "Sleep, composed", body: "A 4-7-8 session with warm rain that fades out on its own.", href: "/app/compose?q=I%20want%20to%20fall%20asleep%20and%20let%20go%20of%20today" };
  if (h < 11) return { title: "Set the tone", body: "Three minutes of coherent breathing before the inbox.", href: "/app/breathe" };
  if (h < 17) return { title: "Midday reset", body: "Try a physiological sigh when stress spikes. It takes about 60 seconds.", href: "/app/breathe" };
  return { title: "Leave the day at the door", body: "Tell Lull about your day and let it compose the wind-down.", href: "/app/compose" };
}

export default function TodayPage() {
  const user = useUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<PracticeSession[]>([]);
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [care, setCare] = useState<CareStats | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const greet = mounted ? greeting() : "Hello";
  const tip = mounted ? suggestion() : null;

  useEffect(() => {
    if (!user) return;
    void Promise.all([fetchStats(), fetchRecentPractice(), fetchCheckins(14), fetchCareStats()]).then(([s, r, c, cs]) => {
      setStats(s);
      setRecent(r);
      setCheckins(c);
      setCare(cs);
    });
  }, [user]);

  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0];

  const tiles = [
    { label: "day streak", value: stats?.streak ?? 0, accent: "text-lime" },
    { label: "minutes calm", value: stats?.total_minutes ?? 0, accent: "text-mint" },
    { label: "sessions", value: stats?.session_count ?? 0, accent: "text-sky" },
    { label: "check-ins", value: stats?.checkin_count ?? 0, accent: "text-lilac" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="mono-label">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-2 font-[family-name:var(--font-unbounded)] text-4xl font-semibold tracking-tight sm:text-5xl">
          {greet}
          {firstName ? `, ${firstName}` : ""}.
        </h1>
      </div>

      {!user && <GuestNote>You&apos;re exploring as a guest. Breathe and Sounds work fully. Sign up to save your streak, check-ins and composed sessions.</GuestNote>}

      <Link href="/app/plan" className="group glass relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl p-6">
        <div className="absolute -left-10 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(200,255,110,0.22),transparent_70%)] blur-2xl transition-transform duration-700 group-hover:scale-125" />
        {care?.plan ? (
          <>
            <div className="relative">
              <p className="mono-label !text-lime">your plan · week {care.plan.week} of 4</p>
              <p className="mt-1 font-[family-name:var(--font-unbounded)] text-2xl font-semibold">
                {care.today.done}/{care.today.total} done today
              </p>
            </div>
            <div className="relative text-right font-mono text-xs text-muted">
              <div className="text-lime">Lv {levelFor(care.xp).level} · {care.xp} XP</div>
              <div>🔥 {care.streak} day streak</div>
            </div>
          </>
        ) : (
          <div className="relative">
            <p className="mono-label !text-lime">new · care plan</p>
            <p className="mt-1 font-[family-name:var(--font-unbounded)] text-xl font-semibold sm:text-2xl">Turn your prescription into a daily plan →</p>
            <p className="mt-1 text-sm text-muted">Scan it or describe your diagnosis. Private and encrypted, with XP for every step.</p>
          </div>
        )}
      </Link>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="glass rounded-2xl p-5">
            <div className={`font-[family-name:var(--font-unbounded)] text-3xl font-semibold ${t.accent}`}>{t.value}</div>
            <div className="mono-label mt-1 !text-[10px]">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          {tip && (
            <Link href={tip.href} className="group glass relative block overflow-hidden rounded-3xl p-7">
              <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(142,245,212,0.35),transparent_70%)] blur-2xl transition-transform duration-700 group-hover:scale-125" />
              <p className="mono-label !text-mint">suggested now</p>
              <h2 className="mt-2 font-[family-name:var(--font-unbounded)] text-2xl font-semibold">{tip.title}</h2>
              <p className="mt-2 max-w-md text-muted">{tip.body}</p>
              <span className="mt-5 inline-block text-sm text-ink transition group-hover:translate-x-1">Begin →</span>
            </Link>
          )}
          <div className="grid grid-cols-3 gap-3">
            {[
              { href: "/app/compose", icon: "✦", label: "Compose" },
              { href: "/app/breathe", icon: "◎", label: "Breathe" },
              { href: "/app/sounds", icon: "∿", label: "Sounds" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="glass group rounded-2xl p-5 text-center transition hover:border-white/20">
                <div className="text-2xl transition group-hover:scale-110">{a.icon}</div>
                <div className="mt-2 text-sm text-muted group-hover:text-ink">{a.label}</div>
              </Link>
            ))}
          </div>
          <div className="glass rounded-3xl p-6">
            <div className="flex items-baseline justify-between">
              <p className="mono-label">Mood · last 14 check-ins</p>
              <Link href="/app/journal" className="font-mono text-xs text-muted hover:text-ink">journal →</Link>
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
            <p className="mono-label">Recent practice</p>
            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{user ? "Your sessions will show up here." : "Sign in to keep a history."}</p>
            ) : (
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white/5">{KIND_ICON[r.kind]}</span>
                    <span className="flex-1 truncate">{r.title}</span>
                    <span className="font-mono text-xs text-muted">{formatDuration(r.duration_sec)}</span>
                    <span className="w-16 text-right font-mono text-[10px] text-faint">{timeAgo(r.created_at)}</span>
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
