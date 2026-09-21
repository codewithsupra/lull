"use client";

import { useEffect, useRef, useState } from "react";
import { PATTERNS, cycleSeconds } from "@/lib/breath";
import { Orb, usePacer } from "@/components/app/pacer";
import { logPractice } from "@/lib/data";
import { useUser } from "@/components/app/user-context";
import { GuestNote } from "@/components/app/guest-note";

const DURATIONS = [1, 3, 5, 10];

export default function BreathePage() {
  const user = useUser();
  const [patternId, setPatternId] = useState(PATTERNS[0].id);
  const [minutes, setMinutes] = useState(3);
  const [running, setRunning] = useState(false);
  const [tones, setTones] = useState(true);
  const [done, setDone] = useState<number | null>(null);
  const pattern = PATTERNS.find((p) => p.id === patternId)!;
  const pacer = usePacer(pattern, running, { tones });
  const loggedRef = useRef(false);

  const remaining = Math.max(0, minutes * 60 - pacer.elapsed);

  const finish = async (elapsed: number) => {
    setRunning(false);
    setDone(elapsed);
    if (user && !loggedRef.current) {
      loggedRef.current = true;
      await logPractice("breathe", `${pattern.name} breathing`, elapsed);
    }
  };

  useEffect(() => {
    if (!running || remaining > 0) return;
    const id = window.setTimeout(() => void finish(pacer.elapsed), 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, running]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement).closest("input,textarea,button")) {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const start = () => {
    loggedRef.current = false;
    pacer.reset();
    setDone(null);
    setRunning(true);
  };

  const label = running || pacer.elapsed > 0 ? pacer.phase.label : "Ready";
  const sub = running
    ? `${Math.ceil(pacer.phase.seconds * (1 - pacer.progress))}s · ${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")} left`
    : pacer.elapsed > 0
      ? "paused · space to resume"
      : "press start or space";

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:items-center">
      <div>
        <Orb scale={pacer.scale} label={done ? "Well done." : label} sub={done ? `${Math.round(done / 60) || 1} min of calm` : sub} progress={running ? pacer.progress : 0} />
        <div className="mt-8 flex justify-center gap-3">
          {!running ? (
            <button onClick={pacer.elapsed > 0 && !done ? () => setRunning(true) : start} className="rounded-full bg-ink px-8 py-3 text-sm font-semibold text-bg shadow-[0_0_40px_-8px_rgba(142,245,212,0.8)]">
              {pacer.elapsed > 0 && !done ? "Resume" : done ? "Again" : "Start"}
            </button>
          ) : (
            <button onClick={() => setRunning(false)} className="rounded-full border border-white/20 px-8 py-3 text-sm">Pause</button>
          )}
          {pacer.elapsed > 20 && !done && (
            <button onClick={() => finish(pacer.elapsed)} className="rounded-full border border-white/10 px-6 py-3 text-sm text-muted hover:text-ink">
              Finish
            </button>
          )}
        </div>
      </div>

      <aside className="space-y-6">
        <div>
          <p className="mono-label">Technique</p>
          <div className="mt-3 space-y-2">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                disabled={running}
                onClick={() => {
                  setPatternId(p.id);
                  pacer.reset();
                  setDone(null);
                }}
                className={`w-full rounded-2xl border p-4 text-left transition disabled:opacity-50 ${
                  p.id === patternId ? "border-mint/40 bg-mint/[0.06]" : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{p.name}</span>
                  <span className="font-mono text-xs text-muted">{p.tagline}</span>
                </div>
                {p.id === patternId && <p className="mt-2 text-xs leading-relaxed text-muted">{p.science}</p>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mono-label">Length</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                disabled={running}
                onClick={() => setMinutes(d)}
                className={`rounded-xl border py-2 text-sm transition disabled:opacity-50 ${d === minutes ? "border-mint/40 bg-mint/[0.06]" : "border-white/10"}`}
              >
                {d}m
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-faint">≈ {Math.round((minutes * 60) / cycleSeconds(pattern))} breaths</p>
        </div>
        <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm">
          <span>Guiding tones</span>
          <input type="checkbox" checked={tones} onChange={(e) => setTones(e.target.checked)} className="h-4 w-4 accent-[var(--mint)]" />
        </label>
        {!user && <GuestNote>Sign in to count this toward your streak.</GuestNote>}
      </aside>
    </div>
  );
}
