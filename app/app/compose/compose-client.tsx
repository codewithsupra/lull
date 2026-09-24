"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getInsforge } from "@/lib/insforge/client";
import { useUser } from "@/components/app/user-context";
import { SessionPlayer } from "@/components/app/session-player";
import { timeAgo } from "@/lib/data";
import type { Plan } from "@/lib/plan";
import { TaskReturn, useTaskCompletion } from "@/components/plan/task-return";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt } from "@/lib/i18n";
import { handlePaywall } from "@/lib/billing-client";


type History = { id: string; title: string; prompt: string; plan: Plan; created_at: string };

export function ComposeClient({ initialPrompt, taskId }: { initialPrompt: string; taskId?: string }) {
  const user = useUser();
  const { locale, t, tag } = useI18n();
  const c = t.app.compose;
  const task = useTaskCompletion(taskId);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [minutes, setMinutes] = useState(5);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planKey, setPlanKey] = useState(0);
  const showPlan = (p: Plan) => {
    setPlan(p);
    setPlanKey((k) => k + 1);
  };
  const [history, setHistory] = useState<History[]>([]);

  useEffect(() => {
    if (!user) return;
    getInsforge().database
      .from("composed_sessions")
      .select("id, title, prompt, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => setHistory((data ?? []) as History[]));
  }, [user]);

  useEffect(() => {
    if (!loading) return;
    const id = window.setInterval(() => setStage((s) => Math.min(s + 1, c.stages.length - 1)), 1400);
    return () => window.clearInterval(id);
  }, [loading, c.stages.length]);

  const compose = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (prompt.trim().length < 3 || loading) return;
    setStage(0);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, minutes, locale }),
      });
      const json = await res.json();
      if (handlePaywall(res.status, json)) return;
      if (!res.ok) throw new Error(json.error ?? t.common.errors.generic);
      showPlan(json.plan);
      if (json.id) {
        setHistory((h) => [{ id: json.id, title: json.plan.title, prompt, plan: json.plan, created_at: new Date().toISOString() }, ...h].slice(0, 8));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      {taskId && <TaskReturn state={task.state} xp={task.xp} hint={c.taskHint} />}
      {plan && <SessionPlayer key={planKey} plan={plan} canLog={!!user} onFinished={() => void task.complete()} />}

      <section className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          {!plan && (
            <>
              <p className="mono-label !text-mint">{c.label}</p>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">{c.heading}</h1>
              <p className="mt-3 max-w-lg text-muted">{c.intro}</p>
            </>
          )}

          <form onSubmit={compose} className={`glass relative rounded-3xl p-2 ${plan ? "" : "mt-8"}`}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 600))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void compose();
              }}
              disabled={!user || loading}
              rows={4}
              placeholder={user ? c.placeholder : c.guestPlaceholder}
              className="w-full resize-none rounded-2xl bg-transparent p-4 text-lg outline-none placeholder:text-faint disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-3 pb-2 pt-3">
              <div className="flex gap-1.5">
                {[3, 5, 10].map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMinutes(m)}
                    className={`rounded-full px-3 py-1 font-mono text-xs transition ${m === minutes ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}
                  >
                    {fmt(c.minutes, { n: m })}
                  </button>
                ))}
              </div>
              {user ? (
                <button
                  disabled={loading || prompt.trim().length < 3}
                  className="rounded-full bg-mint px-5 py-2 text-sm font-semibold text-bg shadow-[0_0_30px_-6px_var(--mint)] transition disabled:opacity-40"
                >
                  {loading ? <span className="shimmer-text !text-bg">{c.stages[stage]}</span> : c.cta}
                </button>
              ) : (
                <Link href="/login?mode=signup" className="rounded-full bg-mint px-5 py-2 text-sm font-semibold text-bg">
                  {c.guestCta}
                </Link>
              )}
            </div>
          </form>
          {loading && <p className="shimmer-text mt-4 text-center font-mono text-xs uppercase tracking-[0.2em]">{c.stages[stage]}</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-2">
            {c.suggestions.map((s) => (
              <button
                key={s}
                disabled={!user || loading}
                onClick={() => setPrompt(s)}
                className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-muted transition hover:border-white/25 hover:text-ink disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mono-label mt-8 !text-[10px]">{c.footer}</p>
        </div>

        <aside>
          <p className="mono-label">{c.sessionsHeading}</p>
          {!user ? (
            <p className="mt-3 text-sm text-muted">{c.sessionsGuest}</p>
          ) : history.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{c.sessionsEmpty}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => {
                      showPlan(h.plan);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full rounded-2xl border border-white/10 p-4 text-left transition hover:border-mint/40 hover:bg-mint/[0.04]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{h.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-faint">{timeAgo(h.created_at, t, tag)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{h.prompt}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </section>
    </div>
  );
}
