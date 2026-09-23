"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { MoodChart } from "@/components/app/mood-chart";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt, splitAround } from "@/lib/i18n";
import { GuestNote } from "@/components/app/guest-note";
import { handlePaywall } from "@/lib/billing-client";
import { MOODS, deleteCheckin, fetchCheckins, type MoodCheckin, type TagId } from "@/lib/data";

type Insight = { headline: string; observations: string[]; suggestion: { text: string; action: "breathe" | "sounds" | "compose" } };

export default function JournalPage() {
  const user = useUser();
  const { t, tag } = useI18n();
  const j = t.app.journal;
  const [emptyBefore, emptyAfter] = splitAround(j.empty);
  const [checkins, setCheckins] = useState<MoodCheckin[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchCheckins(60).then((c) => {
      setCheckins(c);
      setLoaded(true);
    });
  }, [user]);

  const reflect = async () => {
    setThinking(true);
    setError(null);
    try {
      const res = await fetch("/api/insight", { method: "POST" });
      const json = await res.json();
      if (handlePaywall(res.status, json)) return;
      if (!res.ok) throw new Error(json.error);
      setInsight(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.errors.generic);
    } finally {
      setThinking(false);
    }
  };

  const remove = async (id: string) => {
    const prev = checkins;
    setCheckins((c) => c.filter((x) => x.id !== id));
    try {
      await deleteCheckin(id);
    } catch {
      setCheckins(prev);
    }
  };

  const avg = checkins.length ? checkins.reduce((s, c) => s + c.mood, 0) / checkins.length : 0;
  const topTags = Object.entries(
    checkins.flatMap((c) => c.tags).reduce<Record<string, number>>((m, t) => ({ ...m, [t]: (m[t] ?? 0) + 1 }), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const byDay = checkins.reduce<Record<string, MoodCheckin[]>>((acc, c) => {
    const k = new Date(c.created_at).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    (acc[k] ??= []).push(c);
    return acc;
  }, {});

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">{t.nav.journal}</h1>
        <GuestNote>{j.guest}</GuestNote>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label">{j.label}</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">{j.heading}</h1>
        </div>
        <button
          onClick={reflect}
          disabled={thinking}
          className="rounded-full bg-lilac px-5 py-2.5 text-sm font-semibold text-bg shadow-[0_0_40px_-8px_var(--lilac)] transition disabled:opacity-60"
        >
          {thinking ? <span className="shimmer-text">{j.reflecting}</span> : j.reflect}
        </button>
      </div>

      {error && <p className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>}
      {insight && (
        <div className="glass animate-[fadeIn_0.7s_ease] rounded-3xl border-lilac/20 p-7">
          <p className="mono-label !text-lilac">{j.insight}</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">{insight.headline}</h2>
          <ul className="mt-4 space-y-2 text-muted">
            {insight.observations.map((o) => (
              <li key={o} className="flex gap-3"><span className="text-lilac">·</span>{o}</li>
            ))}
          </ul>
          <Link href={`/app/${insight.suggestion.action}`} className="mt-5 inline-block rounded-full border border-lilac/40 px-4 py-2 text-sm text-lilac hover:bg-lilac/10">
            {insight.suggestion.text} →
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="glass rounded-3xl p-6">
          <p className="mono-label">{fmt(j.moodHeading, { n: Math.min(checkins.length, 30) })}</p>
          <div className="mt-4"><MoodChart checkins={checkins.slice(0, 30)} height={180} /></div>
        </div>
        <div className="glass space-y-5 rounded-3xl p-6">
          <div>
            <div className="font-[family-name:var(--font-display)] text-3xl font-semibold text-mint">{avg ? avg.toFixed(1) : "–"}</div>
            <div className="mono-label !text-[10px]">{j.averageMood}</div>
          </div>
          <div>
            <div className="mono-label !text-[10px]">{j.mostFelt}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topTags.length ? (
                topTags.map(([tagId, n]) => (
                  <span key={tagId} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted">
                    {t.tools.checkin.tags[tagId as TagId] ?? tagId} <span className="text-faint">×{n}</span>
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted">{j.noTags}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {loaded && checkins.length === 0 && (
          <p className="text-muted">
            {emptyBefore}
            <Link href="/app" className="text-ink underline decoration-white/20">
              {j.emptyLink}
            </Link>
            {emptyAfter}
          </p>
        )}
        {Object.entries(byDay).map(([day, items]) => (
          <section key={day}>
            <p className="mono-label mb-3">{day}</p>
            <div className="space-y-2">
              {items.map((c) => {
                const m = MOODS[c.mood - 1];
                return (
                  <div key={c.id} className="group glass flex items-start gap-4 rounded-2xl p-4">
                    <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ background: m.color, boxShadow: `0 0 14px ${m.color}` }} />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 text-sm">
                        <span className="font-semibold">{t.tools.checkin.moods[c.mood as 1 | 2 | 3 | 4 | 5]}</span>
                        <span className="font-mono text-[11px] text-faint">
                          {fmt(j.energyLine, {
                            energy: c.energy,
                            time: new Date(c.created_at).toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }),
                          })}
                        </span>
                      </div>
                      {c.tags.length > 0 && (
                        <div className="mt-1 text-xs text-muted">{c.tags.map((tg) => t.tools.checkin.tags[tg as TagId] ?? tg).join(" · ")}</div>
                      )}
                      {c.note && <p className="mt-2 text-sm text-ink/80">{c.note}</p>}
                    </div>
                    <button onClick={() => remove(c.id)} className="font-mono text-[10px] text-faint opacity-0 transition hover:text-rose group-hover:opacity-100" aria-label={j.deleteCheckin}>
                      {j.delete}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
