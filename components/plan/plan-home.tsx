"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORIES, DAY_BONUS, levelFor, sessionHref, type PlanTask, type PlanView, type Slot } from "@/lib/care-plan";
import { completeTask, currentPushSubscription, disablePush, enablePush, fetchCareStats, localToday, pushSupported, type CareStats } from "@/lib/care-client";
import { NightGarden } from "./night-garden";
import { handlePaywall } from "@/lib/billing-client";

const SLOTS: { id: Slot; label: string; icon: string }[] = [
  { id: "morning", label: "Morning", icon: "☀︎" },
  { id: "afternoon", label: "Afternoon", icon: "◐" },
  { id: "evening", label: "Evening", icon: "☾" },
  { id: "night", label: "Night", icon: "✦" },
];
const KIND_STYLE: Record<PlanTask["kind"], { label: string; color: string }> = {
  medication: { label: "medicine", color: "var(--sky)" },
  habit: { label: "habit", color: "var(--mint)" },
  session: { label: "session", color: "var(--lilac)" },
  learn: { label: "learn", color: "var(--lime)" },
  reflect: { label: "reflect", color: "var(--rose)" },
};

type Burst = { id: number; text: string };

export function PlanHome({ plan, onChanged, onDeleted, demoStats }: { plan: PlanView; onChanged: () => void; onDeleted: () => void; demoStats?: CareStats }) {
  const [tasks, setTasks] = useState(plan.tasks);
  const [stats, setStats] = useState<CareStats | null>(demoStats ?? null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [openLearn, setOpenLearn] = useState<number | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [push, setPush] = useState<"unknown" | "on" | "off" | "unsupported">("unknown");
  const burstId = useRef(0);
  const [pushError, setPushError] = useState<string | null>(null);
  const [replanning, setReplanning] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(() => (demoStats ? Promise.resolve() : fetchCareStats().then(setStats)), [demoStats]);

  useEffect(() => {
    void refreshStats();
    const checkPush = async () => {
      if (!pushSupported()) return setPush("unsupported");
      const sub = await currentPushSubscription();
      setPush(sub ? "on" : "off");
    };
    void checkPush();
  }, [refreshStats]);

  const burst = (text: string) => {
    const id = ++burstId.current;
    setBursts((b) => [...b, { id, text }]);
    window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1600);
  };

  const toggle = async (task: PlanTask) => {
    const done = !task.completed_at;
    setTasks((cur) => cur.map((t) => (t.id === task.id ? { ...t, completed_at: done ? new Date().toISOString() : null } : t)));
    try {
      const res = await completeTask(task.id, done);
      if (done) {
        burst(`+${res.xp} XP`);
        if (res.day_complete) window.setTimeout(() => burst(`Day complete · +${DAY_BONUS} XP`), 450);
      }
      void refreshStats();
    } catch {
      setTasks((cur) => cur.map((t) => (t.id === task.id ? task : t)));
      setError("Couldn't save that. Check your connection.");
    }
  };

  const togglePush = async () => {
    setPushError(null);
    try {
      if (push === "on") {
        await disablePush();
        setPush("off");
      } else {
        await enablePush();
        setPush("on");
      }
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Couldn't change reminders.");
    }
  };

  const replan = async () => {
    setReplanning(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/replan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ today: localToday() }) });
      const json = await res.json();
      if (handlePaywall(res.status, json)) return;
      if (!res.ok) throw new Error(json.error);
      setReview(json.review);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't plan next week.");
    } finally {
      setReplanning(false);
    }
  };

  const remove = async () => {
    const res = await fetch("/api/plan", { method: "DELETE" });
    if (res.ok) {
      await disablePush().catch(() => {});
      onDeleted();
    } else setError("Couldn't delete. Please try again.");
  };

  const xp = stats?.xp ?? 0;
  const lvl = levelFor(xp);
  const done = tasks.filter((t) => t.completed_at).length;
  const weekStart = new Date(`${plan.started_at}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() + (plan.week - 1) * 7);
  const startDay = weekStart.toISOString().slice(0, 10);
  const theme = plan.roadmap.find((r) => r.week === plan.week);
  const category = CATEGORIES.find((c) => c.id === plan.category);

  return (
    <div className="space-y-8">
      {/* XP bursts */}
      <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex flex-col items-center gap-2">
        <AnimatePresence>
          {bursts.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30 }}
              className="rounded-full border border-lime/40 bg-bg/80 px-4 py-1.5 font-[family-name:var(--font-display)] text-sm font-semibold text-lime shadow-[0_0_40px_-6px_var(--lime)] backdrop-blur"
            >
              {b.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mono-label !text-mint">
            {category?.label} · week {plan.week} of 4{theme ? ` · ${theme.theme}` : ""}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">{plan.title}</h1>
          <p className="mt-3 max-w-xl text-muted">{plan.summary}</p>
        </div>
        <div className="glass w-full rounded-2xl p-5 sm:w-72">
          <div className="flex items-baseline justify-between">
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Lv {lvl.level} · {lvl.name}
            </span>
            <span className="font-mono text-xs text-lime">{xp} XP</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-mint to-lime" animate={{ width: `${Math.round(lvl.progress * 100)}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-muted">
            <span>🔥 {stats?.streak ?? 0} day streak</span>
            <span>{lvl.toNext} XP to next</span>
          </div>
        </div>
      </header>

      {plan.doctor_flags.length > 0 && (
        <div className="rounded-2xl border border-sky/25 bg-sky/[0.06] p-5">
          <p className="mono-label !text-sky">worth asking your doctor</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/85">
            {plan.doctor_flags.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-sky">⚕</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="glass relative overflow-hidden rounded-3xl">
        <div className="absolute left-5 top-5 z-10">
          <p className="mono-label">your night garden</p>
          <p className="mt-1 text-sm text-muted">Each task grows a leaf. Finish a day and it blooms.</p>
        </div>
        <NightGarden days={stats?.week_days ?? []} today={localToday()} streak={stats?.streak ?? 0} startDay={startDay} />
      </section>

      {plan.can_replan && (
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl border-lime/25 p-6">
          <div>
            <p className="mono-label !text-lime">week {plan.week} review</p>
            <p className="mt-1 text-lg">
              You completed <span className="text-lime">{Math.round(plan.week_complete_ratio * 100)}%</span> of this week. Lull will adapt next week to how it actually went.
            </p>
          </div>
          <button onClick={replan} disabled={replanning} className="rounded-full bg-lime px-6 py-2.5 text-sm font-semibold text-bg disabled:opacity-60">
            {replanning ? <span className="shimmer-text">Adapting…</span> : `Build week ${plan.week + 1} →`}
          </button>
        </div>
      )}
      {review && <p className="rounded-2xl border border-lime/25 bg-lime/[0.06] p-5 text-ink/90">{review}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">Today</h2>
            <span className="font-mono text-xs text-muted">
              {done}/{tasks.length} done
            </span>
          </div>
          {tasks.length === 0 && <p className="mt-4 text-muted">Nothing scheduled today. Rest counts too.</p>}
          <div className="mt-4 space-y-6">
            {SLOTS.map((slot) => {
              const list = tasks.filter((t) => t.slot === slot.id);
              if (!list.length) return null;
              return (
                <div key={slot.id}>
                  <p className="mono-label mb-2">
                    {slot.icon} {slot.label}
                  </p>
                  <ul className="space-y-2">
                    {list.map((t) => {
                      const style = KIND_STYLE[t.kind];
                      const isOpen = openTask === t.id;
                      return (
                        <li key={t.id} className={`glass rounded-2xl transition ${t.completed_at ? "opacity-60" : ""}`}>
                          <div className="flex items-center gap-3 p-4">
                            <button
                              onClick={() => toggle(t)}
                              aria-label={t.completed_at ? `Mark ${t.title} not done` : `Mark ${t.title} done`}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition"
                              style={{ borderColor: style.color, background: t.completed_at ? style.color : "transparent", boxShadow: t.completed_at ? `0 0 20px -4px ${style.color}` : undefined }}
                            >
                              {t.completed_at && <span className="text-xs font-bold text-bg">✓</span>}
                            </button>
                            <button onClick={() => setOpenTask(isOpen ? null : t.id)} className="min-w-0 flex-1 text-left">
                              <div className={`truncate ${t.completed_at ? "line-through decoration-white/30" : ""}`}>{t.title}</div>
                              <div className="mt-0.5 flex gap-2 font-mono text-[10px] uppercase tracking-wider">
                                <span style={{ color: style.color }}>{style.label}</span>
                                {t.remind_at && <span className="text-faint">{t.remind_at}</span>}
                              </div>
                            </button>
                            {t.kind === "session" && t.session_ref && !t.completed_at ? (
                              <Link href={sessionHref(t.session_ref, t.id)} className="rounded-full border border-lilac/40 px-3 py-1 text-xs text-lilac hover:bg-lilac/10">
                                Start
                              </Link>
                            ) : (
                              <span className="font-mono text-xs text-lime">+{t.xp}</span>
                            )}
                          </div>
                          <AnimatePresence initial={false}>
                            {isOpen && t.detail && (
                              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pb-4 pl-14 text-sm leading-relaxed text-muted">
                                {t.detail}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <p className="mono-label">Reminders</p>
              {push !== "unsupported" && push !== "unknown" && (
                <button onClick={togglePush} className={`rounded-full px-3 py-1 text-xs font-semibold ${push === "on" ? "bg-mint text-bg" : "border border-white/15 text-ink"}`}>
                  {push === "on" ? "On" : "Turn on"}
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted">
              {push === "unsupported"
                ? "This browser can't show reminders. On iPhone, tap Share → Add to Home Screen, then open Lull from there."
                : "A gentle nudge at each part of your day. Notifications never mention medicine or conditions."}
            </p>
            {pushError && <p className="mt-2 text-xs text-rose">{pushError}</p>}
          </div>

          {plan.medications.length > 0 && (
            <div className="glass rounded-3xl p-6">
              <p className="mono-label">Your medicines · as prescribed</p>
              <ul className="mt-3 space-y-3">
                {plan.medications.map((m) => (
                  <li key={m.id} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-muted">{m.dose}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-faint">{[m.times.join(" · "), m.instructions].filter(Boolean).join(" — ")}</div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-faint">Lull never changes your medicines. Ask your doctor before changing anything.</p>
            </div>
          )}

          <div className="glass rounded-3xl p-6">
            <p className="mono-label">Learn this week</p>
            <ul className="mt-3 space-y-2">
              {plan.learn.map((c, i) => (
                <li key={c.title}>
                  <button onClick={() => setOpenLearn(openLearn === i ? null : i)} className="w-full text-left text-sm">
                    <span className="text-lime">{openLearn === i ? "−" : "+"}</span> {c.title}
                  </button>
                  {openLearn === i && <p className="mt-2 pl-4 text-sm leading-relaxed text-muted">{c.body}</p>}
                </li>
              ))}
            </ul>
          </div>

          {plan.doctor_questions.length > 0 && (
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <p className="mono-label">For your next appointment</p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(plan.doctor_questions.map((q) => `• ${q}`).join("\n"));
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  }}
                  className="font-mono text-[11px] text-muted hover:text-ink"
                >
                  {copied ? "copied ✓" : "copy"}
                </button>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-ink/85">
                {plan.doctor_questions.map((q) => (
                  <li key={q} className="flex gap-2">
                    <span className="text-faint">?</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="glass rounded-3xl p-6">
            <p className="mono-label">The road ahead</p>
            <ol className="mt-3 space-y-3">
              {plan.roadmap.map((r) => (
                <li key={r.week} className={`flex gap-3 text-sm ${r.week < plan.week ? "opacity-50" : ""}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[11px] ${r.week === plan.week ? "bg-mint text-bg" : "border border-white/15 text-muted"}`}>{r.week}</span>
                  <div>
                    <div className="font-semibold">{r.theme}</div>
                    <div className="text-xs text-muted">{r.focus}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-3xl border border-white/10 p-6 text-sm">
            <p className="mono-label">Your data</p>
            <p className="mt-2 text-muted">Encrypted health data and no personal details. You can delete all of it at any time.</p>
            {confirmDelete ? (
              <div className="mt-3 flex gap-2">
                <button onClick={remove} className="rounded-full bg-rose px-4 py-1.5 text-xs font-semibold text-bg">
                  Delete everything
                </button>
                <button onClick={() => setConfirmDelete(false)} className="rounded-full border border-white/15 px-4 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="mt-3 font-mono text-xs text-rose/80 hover:text-rose">
                delete my health data →
              </button>
            )}
          </div>
        </aside>
      </div>
      <p className="mono-label text-center !text-[10px]">lull is a wellbeing companion, not medical advice · in an emergency call your local emergency number</p>
    </div>
  );
}
