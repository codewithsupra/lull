"use client";

import { useEffect, useRef, useState } from "react";
import { getEngine, speak, LAYERS } from "@/lib/audio/engine";
import { patternById } from "@/lib/breath";
import { Orb, usePacer } from "@/components/app/pacer";
import { logPractice } from "@/lib/data";
import { planSeconds, type Plan } from "@/lib/plan";

type Status = "idle" | "playing" | "done";

export function SessionPlayer({ plan, canLog, onFinished }: { plan: Plan; canLog: boolean; onFinished?: (seconds: number) => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [step, setStep] = useState(-1);
  const [voice, setVoice] = useState(true);
  const runRef = useRef(0);
  const startedRef = useRef(0);
  const pattern = patternById(plan.breath);
  const pacer = usePacer(pattern, status === "playing", { tones: false });
  const total = planSeconds(plan);

  useEffect(() => {
    // Remounted per plan (keyed by the parent); on unmount stop any running sequence.
    const run = runRef;
    return () => {
      run.current++;
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    // Some browsers load voices lazily.
    window.speechSynthesis?.getVoices();
  }, []);

  const wait = (ms: number, run: number) =>
    new Promise<boolean>((resolve) => window.setTimeout(() => resolve(runRef.current === run), ms));

  const say = (text: string, run: number) =>
    new Promise<boolean>((resolve) => {
      if (!voice) {
        window.setTimeout(() => resolve(runRef.current === run), Math.max(3500, text.split(/\s+/).length * 450));
        return;
      }
      speak(text, { onEnd: () => resolve(runRef.current === run) });
    });

  const play = async () => {
    const run = ++runRef.current;
    window.speechSynthesis?.cancel();
    pacer.reset();
    setStatus("playing");
    startedRef.current = Date.now();
    const engine = getEngine();
    await engine.applyMix(plan.mix);
    engine.bell(392, 0.2);
    if (!(await wait(3500, run))) return;
    for (let i = 0; i < plan.steps.length; i++) {
      setStep(i);
      if (!(await say(plan.steps[i].text, run))) return;
      if (!(await wait(plan.steps[i].pause * 1000, run))) return;
    }
    setStep(plan.steps.length);
    if (!(await say(plan.closing, run))) return;
    engine.bell(523.25, 0.16);
    if (!(await wait(5000, run))) return;
    engine.fadeOut(6);
    setStatus("done");
    const secs = (Date.now() - startedRef.current) / 1000;
    if (canLog) void logPractice("composed", plan.title, secs);
    onFinished?.(secs);
  };

  const stop = () => {
    runRef.current++;
    window.speechSynthesis?.cancel();
    getEngine().fadeOut(2);
    if (canLog && startedRef.current) {
      const secs = (Date.now() - startedRef.current) / 1000;
      void logPractice("composed", plan.title, secs);
      if (secs >= 60) onFinished?.(secs);
    }
    startedRef.current = 0;
    setStatus("idle");
    setStep(-1);
  };

  const caption =
    status === "done" ? "Session complete." : step < 0 ? plan.intention : step >= plan.steps.length ? plan.closing : plan.steps[step].text;
  const layers = LAYERS.filter((l) => (plan.mix[l.id] ?? 0) > 0.05).map((l) => l.label);

  return (
    <div className="glass overflow-hidden rounded-3xl">
      {plan.care && (
        <div className="border-b border-rose/20 bg-rose/10 px-6 py-4 text-sm text-rose">
          <strong className="font-semibold">You matter. </strong>
          {plan.care}
        </div>
      )}
      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[1fr_280px] md:items-center">
        <div>
          <p className="mono-label !text-mint">composed for you</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">{plan.title}</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            <span className="rounded-full border border-white/10 px-2.5 py-1">◎ {pattern.name}</span>
            <span className="rounded-full border border-white/10 px-2.5 py-1">∿ {layers.join(" + ") || "Silence"}</span>
            <span className="rounded-full border border-white/10 px-2.5 py-1">◷ ~{Math.round(total / 60)} min</span>
          </div>
          <p key={caption} className="mt-8 min-h-[5.5em] animate-[fadeIn_0.9s_ease] text-lg leading-relaxed text-ink/90 sm:text-xl">
            {caption}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {status !== "playing" ? (
              <button onClick={play} className="rounded-full bg-ink px-7 py-3 text-sm font-semibold text-bg shadow-[0_0_40px_-8px_rgba(142,245,212,0.8)]">
                {status === "done" ? "↻ Play again" : "▶ Begin session"}
              </button>
            ) : (
              <button onClick={stop} className="rounded-full border border-white/20 px-7 py-3 text-sm">■ End</button>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={voice} disabled={status === "playing"} onChange={(e) => setVoice(e.target.checked)} className="accent-[var(--mint)]" />
              Voice guide
            </label>
          </div>
          <div className="mt-6 flex gap-1">
            {plan.steps.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-700 ${i <= step ? "bg-mint" : "bg-white/10"}`} />
            ))}
          </div>
        </div>
        <div className="hidden md:block">
          <Orb scale={pacer.scale} label={status === "playing" ? pacer.phase.label : pattern.name} sub={status === "playing" ? undefined : pattern.tagline} progress={status === "playing" ? pacer.progress : 0} hue="lilac" />
        </div>
      </div>
    </div>
  );
}
