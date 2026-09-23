"use client";

import { useEffect, useRef, useState } from "react";
import type { BreathPattern, Phase } from "@/lib/breath";
import { getEngine } from "@/lib/audio/engine";

const MIN = 0.52;

function scaleFor(phase: Phase, k: number, prevScale: number) {
  const ease = 0.5 - Math.cos(k * Math.PI) / 2;
  if (phase.kind === "in") return prevScale + (1 - prevScale) * ease;
  if (phase.kind === "out") return prevScale + (MIN - prevScale) * ease;
  return prevScale;
}

/** Drives a breathing pattern in real time. Returns the live phase and orb scale. */
export function usePacer(pattern: BreathPattern, running: boolean, { tones = true } = {}) {
  const [state, setState] = useState({ index: 0, progress: 0, scale: MIN, elapsed: 0, cycles: 0 });
  const ref = useRef({ index: 0, phaseStart: 0, startScale: MIN, scale: MIN, elapsed: 0, cycles: 0, last: 0 });

  const reset = () => {
    ref.current = { index: 0, phaseStart: 0, startScale: MIN, scale: MIN, elapsed: 0, cycles: 0, last: performance.now() };
    setState({ index: 0, progress: 0, scale: MIN, elapsed: 0, cycles: 0 });
  };

  useEffect(() => {
    if (!running) return;
    const r = ref.current;
    r.last = performance.now();
    let cueFor = -1;
    let raf = 0;
    const tick = (now: number) => {
      r.elapsed += (now - r.last) / 1000;
      r.last = now;
      let phase = pattern.phases[r.index];
      let t = r.elapsed - r.phaseStart;
      if (t >= phase.seconds) {
        r.startScale = scaleFor(phase, 1, r.startScale);
        r.phaseStart += phase.seconds;
        r.index = (r.index + 1) % pattern.phases.length;
        if (r.index === 0) r.cycles++;
        phase = pattern.phases[r.index];
        t = r.elapsed - r.phaseStart;
      }
      const cueKey = r.cycles * 100 + r.index;
      if (tones && cueFor !== cueKey) {
        cueFor = cueKey;
        getEngine().breathCue(phase.kind === "in" ? "in" : phase.kind === "out" ? "out" : "hold", phase.seconds);
      }
      const k = Math.min(1, t / phase.seconds);
      r.scale = scaleFor(phase, k, r.startScale);
      setState({ index: r.index, progress: k, scale: r.scale, elapsed: r.elapsed, cycles: r.cycles });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, pattern, tones]);

  return { ...state, phase: pattern.phases[state.index], reset };
}

export function Orb({ scale, label, sub, progress, hue = "mint" }: { scale: number; label: string; sub?: string; progress: number; hue?: "mint" | "lilac" }) {
  const c = hue === "mint" ? ["142,245,212", "106,166,255"] : ["183,157,255", "106,166,255"];
  const R = 47;
  const circ = 2 * Math.PI * R;
  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[420px] place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.6" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={`rgba(${c[0]},0.8)`}
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
        />
      </svg>
      <div
        className="absolute inset-[6%] rounded-full blur-2xl"
        style={{ transform: `scale(${scale * 1.1})`, background: `radial-gradient(circle, rgba(${c[0]},0.45), rgba(${c[1]},0.15) 50%, transparent 72%)` }}
      />
      <div
        className="absolute inset-[14%] rounded-full border"
        style={{
          transform: `scale(${scale})`,
          borderColor: `rgba(${c[0]},0.35)`,
          background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.45), rgba(${c[0]},0.3) 26%, rgba(${c[1]},0.18) 58%, rgba(15,22,45,0.35))`,
          boxShadow: `0 0 120px -10px rgba(${c[0]},0.55), inset 0 0 60px rgba(255,255,255,0.08)`,
        }}
      />
      <div className="relative text-center">
        <div className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">{label}</div>
        {sub && <div className="mono-label mt-2">{sub}</div>}
      </div>
    </div>
  );
}
