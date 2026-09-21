"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DIFFICULTY_OPTIONS, GAD7, PHQ9, PHQ9_RISK_ITEM, SLEEP, type Instrument, type ScreenerRecord } from "@/lib/screeners";
import { CrisisCard } from "@/components/plan/crisis-card";

type Step =
  | { kind: "item"; inst: Instrument; index: number }
  | { kind: "followup" }
  | { kind: "difficulty" };

const BASE_STEPS: Step[] = [
  ...PHQ9.items.map((_, index) => ({ kind: "item" as const, inst: PHQ9, index })),
  ...GAD7.items.map((_, index) => ({ kind: "item" as const, inst: GAD7, index })),
  ...SLEEP.items.map((_, index) => ({ kind: "item" as const, inst: SLEEP, index })),
  { kind: "difficulty" as const },
];

export function CheckFlow({ onDone }: { onDone: (record: ScreenerRecord) => void }) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({ phq9: [], gad7: [], sleep: [] });
  const [followup, setFollowup] = useState<{ thoughts_now: boolean | null; plan_or_intent: boolean | null }>({ thoughts_now: null, plan_or_intent: null });
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);

  const riskEndorsed = (answers.phq9[PHQ9_RISK_ITEM] ?? 0) >= 1;
  // The safety follow-up appears right after PHQ-9 item 9, only when it's endorsed.
  const steps = useMemo(() => {
    if (!riskEndorsed) return BASE_STEPS;
    const at = PHQ9.items.length;
    return [...BASE_STEPS.slice(0, at), { kind: "followup" as const }, ...BASE_STEPS.slice(at)];
  }, [riskEndorsed]);
  const step = steps[pos];
  const total = steps.length;

  const submit = useCallback(
    async (finalDifficulty: number | null) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/screeners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...answers,
            difficulty: finalDifficulty,
            followup: riskEndorsed ? { thoughts_now: !!followup.thoughts_now, plan_or_intent: !!followup.plan_or_intent } : undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        onDone(json.record);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setSubmitting(false);
      }
    },
    [answers, followup, onDone, riskEndorsed],
  );

  const choose = useCallback(
    (value: number) => {
      if (!step || submitting) return;
      if (step.kind === "item") {
        const list = [...answers[step.inst.id]];
        list[step.index] = value;
        setAnswers((a) => ({ ...a, [step.inst.id]: list }));
        if (step.inst.id === "phq9" && step.index === PHQ9_RISK_ITEM && value >= 1) setCrisis(true);
        setPos((p) => p + 1);
      } else if (step.kind === "difficulty") {
        setDifficulty(value);
        void submit(value);
      }
    },
    [answers, step, submit, submitting],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (crisis || !step || step.kind === "followup") return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) choose(n - 1);
      if (e.key === "Backspace" && pos > 0) setPos((p) => p - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, crisis, pos, step]);

  const selected =
    step?.kind === "item" ? answers[step.inst.id][step.index] : step?.kind === "difficulty" ? (difficulty ?? undefined) : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      {crisis && <CrisisCard onContinue={() => setCrisis(false)} message="Thank you for telling us. If you're having thoughts of hurting yourself, please reach out to someone now — you deserve support right away." />}

      <div className="mb-10">
        <div className="flex justify-between font-mono text-[11px] text-muted">
          <span>{step?.kind === "item" ? step.inst.name : step?.kind === "followup" ? "Checking in" : "Last question"}</span>
          <span>
            {Math.min(pos + 1, total)} / {total}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full bg-gradient-to-r from-mint to-sky" animate={{ width: `${(pos / total) * 100}%` }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={pos}
          initial={{ opacity: 0, x: 24, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -24, filter: "blur(4px)" }}
          transition={{ duration: 0.28 }}
        >
          {step?.kind === "item" && (
            <>
              <p className="text-sm text-muted">{step.inst.stem}</p>
              <h2 className="mt-3 min-h-[3.5em] font-[family-name:var(--font-unbounded)] text-2xl font-semibold leading-snug sm:text-3xl">{step.inst.items[step.index]}</h2>
              <Options labels={step.inst.options.map((o) => o.label)} selected={selected} onChoose={choose} />
            </>
          )}

          {step?.kind === "followup" && (
            <section>
              <p className="mono-label !text-rose">a little more, so we can support you</p>
              <h2 className="mt-3 font-[family-name:var(--font-unbounded)] text-2xl font-semibold">Thank you for being honest.</h2>
              <YesNo
                q="Are you having thoughts of ending your life right now, today?"
                value={followup.thoughts_now}
                onChange={(v) => setFollowup((f) => ({ ...f, thoughts_now: v }))}
              />
              <YesNo
                q="Have you thought about how you might do it, or do you intend to act on these thoughts?"
                value={followup.plan_or_intent}
                onChange={(v) => setFollowup((f) => ({ ...f, plan_or_intent: v }))}
              />
              <button
                disabled={followup.thoughts_now === null || followup.plan_or_intent === null}
                onClick={() => {
                  if (followup.thoughts_now || followup.plan_or_intent) setCrisis(true);
                  setPos((p) => p + 1);
                }}
                className="mt-8 rounded-full bg-ink px-7 py-3 text-sm font-semibold text-bg disabled:opacity-40"
              >
                Continue
              </button>
            </section>
          )}

          {step?.kind === "difficulty" && (
            <>
              <p className="text-sm text-muted">If you noticed any of these problems…</p>
              <h2 className="mt-3 min-h-[3.5em] font-[family-name:var(--font-unbounded)] text-2xl font-semibold leading-snug sm:text-3xl">
                How difficult have they made it to do your work, take care of things at home, or get along with other people?
              </h2>
              <Options labels={[...DIFFICULTY_OPTIONS]} selected={selected} onChoose={choose} disabled={submitting} />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {submitting && <p className="shimmer-text mt-6 font-mono text-xs uppercase tracking-[0.2em]">Understanding your answers privately…</p>}
      {error && (
        <p role="alert" className="mt-6 rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
          {error}{" "}
          <button className="underline" onClick={() => submit(difficulty)}>
            Try again
          </button>
        </p>
      )}

      <div className="mt-10 flex items-center justify-between text-sm">
        <button onClick={() => setPos((p) => Math.max(0, p - 1))} className={`text-muted hover:text-ink ${pos === 0 ? "invisible" : ""}`}>
          ← Back
        </button>
        <span className="hidden font-mono text-[11px] text-faint sm:inline">press 1–4 to answer</span>
      </div>
    </div>
  );
}

function Options({ labels, selected, onChoose, disabled }: { labels: string[]; selected?: number; onChoose: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="mt-8 grid gap-2">
      {labels.map((label, i) => (
        <button
          key={label}
          disabled={disabled}
          onClick={() => onChoose(i)}
          className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition disabled:opacity-50 ${
            selected === i ? "border-mint/60 bg-mint/[0.08]" : "border-white/10 hover:border-white/25 hover:bg-white/[0.03]"
          }`}
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/15 font-mono text-xs text-muted">{i + 1}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function YesNo({ q, value, onChange }: { q: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="mt-6">
      <p className="text-ink/90">{q}</p>
      <div className="mt-3 flex gap-2">
        {[
          [true, "Yes"],
          [false, "No"],
        ].map(([v, l]) => (
          <button
            key={String(l)}
            onClick={() => onChange(v as boolean)}
            className={`rounded-xl border px-6 py-2.5 text-sm transition ${value === v ? "border-mint/60 bg-mint/[0.08]" : "border-white/10 hover:border-white/25"}`}
          >
            {l as string}
          </button>
        ))}
      </div>
    </div>
  );
}
