"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DAY_BONUS, levelFor, sessionHref, type PlanTask, type PlanView, type Slot } from "@/lib/care-plan";
import { completeTask, currentPushSubscription, disablePush, enablePush, fetchCareStats, localToday, pushSupported, type CareStats } from "@/lib/care-client";
import { NightGarden } from "./night-garden";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt } from "@/lib/i18n";
import { handlePaywall } from "@/lib/billing-client";

const SLOTS: { id: Slot; icon: string }[] = [
  { id: "morning", icon: "☀︎" },
  { id: "afternoon", icon: "◐" },
  { id: "evening", icon: "☾" },
  { id: "night", icon: "✦" },
];
const KIND_COLOR: Record<PlanTask["kind"], string> = {
  medication: "var(--sky)",
  habit: "var(--mint)",
  session: "var(--lilac)",
  learn: "var(--lime)",
  reflect: "var(--rose)",
};

type Burst = { id: number; text: string };

export function PlanHome({ plan, onChanged, onDeleted, demoStats }: { plan: PlanView; onChanged: () => void; onDeleted: () => void; demoStats?: CareStats }) {
  const { t } = useI18n();
  const h = t.plan.home;
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
        burst(fmt(h.xpBurst, { xp: res.xp }));
        if (res.day_complete) window.setTimeout(() => burst(fmt(h.dayComplete, { bonus: DAY_BONUS })), 450);
      }
      void refreshStats();
    } catch {
      setTasks((cur) => cur.map((t) => (t.id === task.id ? task : t)));
      setError(h.saveFailed);
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
      setPushError(e instanceof Error ? e.message : h.remindersFailed);
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
      setError(e instanceof Error ? e.message : h.replanFailed);
    } finally {
      setReplanning(false);
    }
  };

  const remove = async () => {
    const res = await fetch("/api/plan", { method: "DELETE" });
    if (res.ok) {
      await disablePush().catch(() => {});
      onDeleted();
    } else setError(h.deleteFailed);
  };

  const xp = stats?.xp ?? 0;
  const lvl = levelFor(xp);
  const levelName = t.plan.levels[lvl.index];
  const done = tasks.filter((t) => t.completed_at).length;
  const weekStart = new Date(`${plan.started_at}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() + (plan.week - 1) * 7);
  const startDay = weekStart.toISOString().slice(0, 10);
  const theme = plan.roadmap.find((r) => r.week === plan.week);
  const categoryLabel = t.plan.categories[plan.category].label;

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
            {theme
              ? fmt(h.headerWithTheme, { category: categoryLabel, week: plan.week, theme: theme.theme })
              : fmt(h.header, { category: categoryLabel, week: plan.week })}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">{plan.title}</h1>
          <p className="mt-3 max-w-xl text-muted">{plan.summary}</p>
        </div>
        <div className="glass w-full rounded-2xl p-5 sm:w-72">
          <div className="flex items-baseline justify-between">
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold">{fmt(h.levelLine, { level: lvl.level, name: levelName })}</span>
            <span className="font-mono text-xs text-lime">{xp} XP</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-mint to-lime" animate={{ width: `${Math.round(lvl.progress * 100)}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-muted">
            <span>{fmt(h.streak, { days: stats?.streak ?? 0 })}</span>
            <span>{fmt(h.toNext, { xp: lvl.toNext })}</span>
          </div>
        </div>
      </header>

      {plan.doctor_flags.length > 0 && (
        <div className="rounded-2xl border border-sky/25 bg-sky/[0.06] p-5">
          <p className="mono-label !text-sky">{h.doctorFlags}</p>
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
          <p className="mono-label">{h.garden}</p>
          <p className="mt-1 text-sm text-muted">{h.gardenHint}</p>
        </div>
        <NightGarden days={stats?.week_days ?? []} today={localToday()} streak={stats?.streak ?? 0} startDay={startDay} />
      </section>

      {plan.can_replan && (
        <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl border-lime/25 p-6">
          <div>
            <p className="mono-label !text-lime">{fmt(h.reviewLabel, { week: plan.week })}</p>
            <p className="mt-1 text-lg">{fmt(h.reviewBody, { percent: Math.round(plan.week_complete_ratio * 100) })}</p>
          </div>
          <button onClick={replan} disabled={replanning} className="rounded-full bg-lime px-6 py-2.5 text-sm font-semibold text-bg disabled:opacity-60">
            {replanning ? <span className="shimmer-text">{h.adapting}</span> : fmt(h.buildWeek, { week: plan.week + 1 })}
          </button>
        </div>
      )}
      {review && <p className="rounded-2xl border border-lime/25 bg-lime/[0.06] p-5 text-ink/90">{review}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">{h.todayHeading}</h2>
            <span className="font-mono text-xs text-muted">{fmt(h.doneCount, { done, total: tasks.length })}</span>
          </div>
          {tasks.length === 0 && <p className="mt-4 text-muted">{h.nothingToday}</p>}
          <div className="mt-4 space-y-6">
            {SLOTS.map((slot) => {
              const list = tasks.filter((t) => t.slot === slot.id);
              if (!list.length) return null;
              return (
                <div key={slot.id}>
                  <p className="mono-label mb-2">
                    {slot.icon} {t.plan.slots[slot.id]}
                  </p>
                  <ul className="space-y-2">
                    {list.map((task) => {
                      const color = KIND_COLOR[task.kind];
                      const isOpen = openTask === task.id;
                      return (
                        <li key={task.id} className={`glass rounded-2xl transition ${task.completed_at ? "opacity-60" : ""}`}>
                          <div className="flex items-center gap-3 p-4">
                            <button
                              onClick={() => toggle(task)}
                              aria-label={fmt(task.completed_at ? h.markNotDone : h.markDone, { task: task.title })}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition"
                              style={{
                                borderColor: color,
                                background: task.completed_at ? color : "transparent",
                                boxShadow: task.completed_at ? `0 0 20px -4px ${color}` : undefined,
                              }}
                            >
                              {task.completed_at && <span className="text-xs font-bold text-bg">✓</span>}
                            </button>
                            <button onClick={() => setOpenTask(isOpen ? null : task.id)} className="min-w-0 flex-1 text-left">
                              <div className={`truncate ${task.completed_at ? "line-through decoration-white/30" : ""}`}>{task.title}</div>
                              <div className="mt-0.5 flex gap-2 font-mono text-[10px] uppercase tracking-wider">
                                <span style={{ color }}>{t.plan.kinds[task.kind]}</span>
                                {task.remind_at && <span className="text-faint">{task.remind_at}</span>}
                              </div>
                            </button>
                            {task.kind === "session" && task.session_ref && !task.completed_at ? (
                              <Link href={sessionHref(task.session_ref, task.id)} className="rounded-full border border-lilac/40 px-3 py-1 text-xs text-lilac hover:bg-lilac/10">
                                {h.start}
                              </Link>
                            ) : (
                              <span className="font-mono text-xs text-lime">+{task.xp}</span>
                            )}
                          </div>
                          <AnimatePresence initial={false}>
                            {isOpen && task.detail && (
                              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pb-4 pl-14 text-sm leading-relaxed text-muted">
                                {task.detail}
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
              <p className="mono-label">{h.remindersHeading}</p>
              {push !== "unsupported" && push !== "unknown" && (
                <button onClick={togglePush} className={`rounded-full px-3 py-1 text-xs font-semibold ${push === "on" ? "bg-mint text-bg" : "border border-white/15 text-ink"}`}>
                  {push === "on" ? h.remindersOn : h.remindersTurnOn}
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted">
              {push === "unsupported" ? h.remindersUnsupported : h.remindersBody}
            </p>
            {pushError && <p className="mt-2 text-xs text-rose">{pushError}</p>}
          </div>

          {plan.medications.length > 0 && (
            <div className="glass rounded-3xl p-6">
              <p className="mono-label">{h.medsHeading}</p>
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
              <p className="mt-4 text-[11px] text-faint">{h.medsNote}</p>
            </div>
          )}

          <div className="glass rounded-3xl p-6">
            <p className="mono-label">{h.learnHeading}</p>
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
                <p className="mono-label">{h.questionsHeading}</p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(plan.doctor_questions.map((q) => `• ${q}`).join("\n"));
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  }}
                  className="font-mono text-[11px] text-muted hover:text-ink"
                >
                  {copied ? h.copied : h.copy}
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
            <p className="mono-label">{h.roadmapHeading}</p>
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
            <p className="mono-label">{h.dataHeading}</p>
            <p className="mt-2 text-muted">{h.dataBody}</p>
            {confirmDelete ? (
              <div className="mt-3 flex gap-2">
                <button onClick={remove} className="rounded-full bg-rose px-4 py-1.5 text-xs font-semibold text-bg">
                  {h.deleteEverything}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="rounded-full border border-white/15 px-4 py-1.5 text-xs">
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="mt-3 font-mono text-xs text-rose/80 hover:text-rose">
                {h.deletePrompt}
              </button>
            )}
          </div>
        </aside>
      </div>
      <p className="mono-label text-center !text-[10px]">{h.footer}</p>
    </div>
  );
}
