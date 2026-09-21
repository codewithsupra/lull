"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { MoodChart } from "@/components/app/mood-chart";
import { GuestNote } from "@/components/app/guest-note";
import { handlePaywall } from "@/lib/billing-client";
import { MOODS, deleteCheckin, fetchCheckins, type MoodCheckin } from "@/lib/data";

type Insight = { headline: string; observations: string[]; suggestion: { text: string; action: "breathe" | "sounds" | "compose" } };

export default function JournalPage() {
  const user = useUser();
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
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
        <h1 className="font-[family-name:var(--font-unbounded)] text-4xl font-semibold tracking-tight">Journal</h1>
        <GuestNote>Your mood journal and AI insights live in your account.</GuestNote>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono-label">journal</p>
          <h1 className="mt-2 font-[family-name:var(--font-unbounded)] text-4xl font-semibold tracking-tight sm:text-5xl">Your weather.</h1>
        </div>
        <button
          onClick={reflect}
          disabled={thinking}
          className="rounded-full bg-lilac px-5 py-2.5 text-sm font-semibold text-bg shadow-[0_0_40px_-8px_var(--lilac)] transition disabled:opacity-60"
        >
          {thinking ? <span className="shimmer-text">Reading your patterns…</span> : "✦ Reflect on my patterns"}
        </button>
      </div>

      {error && <p className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>}
      {insight && (
        <div className="glass animate-[fadeIn_0.7s_ease] rounded-3xl border-lilac/20 p-7">
          <p className="mono-label !text-lilac">insight</p>
          <h2 className="mt-2 font-[family-name:var(--font-unbounded)] text-2xl font-semibold">{insight.headline}</h2>
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
          <p className="mono-label">Mood · last {Math.min(checkins.length, 30)} check-ins</p>
          <div className="mt-4"><MoodChart checkins={checkins.slice(0, 30)} height={180} /></div>
        </div>
        <div className="glass space-y-5 rounded-3xl p-6">
          <div>
            <div className="font-[family-name:var(--font-unbounded)] text-3xl font-semibold text-mint">{avg ? avg.toFixed(1) : "–"}</div>
            <div className="mono-label !text-[10px]">average mood</div>
          </div>
          <div>
            <div className="mono-label !text-[10px]">most felt</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topTags.length ? topTags.map(([t, n]) => (
                <span key={t} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted">{t} <span className="text-faint">×{n}</span></span>
              )) : <span className="text-sm text-muted">No tags yet</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {loaded && checkins.length === 0 && (
          <p className="text-muted">No check-ins yet. Log one from <Link href="/app" className="text-ink underline decoration-white/20">Today</Link>.</p>
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
                        <span className="font-semibold">{m.label}</span>
                        <span className="font-mono text-[11px] text-faint">
                          energy {c.energy}/5 · {new Date(c.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      {c.tags.length > 0 && <div className="mt-1 text-xs text-muted">{c.tags.join(" · ")}</div>}
                      {c.note && <p className="mt-2 text-sm text-ink/80">{c.note}</p>}
                    </div>
                    <button onClick={() => remove(c.id)} className="font-mono text-[10px] text-faint opacity-0 transition hover:text-rose group-hover:opacity-100" aria-label="Delete check-in">
                      delete
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
