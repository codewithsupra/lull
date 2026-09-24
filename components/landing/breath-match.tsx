"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";

/** A small orb that breathes at 5.5 breaths per minute, the same cycle as the page. */
export function BreathMatch() {
  const { t } = useI18n();
  const copy = t.landing.everything;
  const [phase, setPhase] = useState<{ inhaling: boolean; scale: number }>({ inhaling: true, scale: 0.7 });

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const elapsed = ((performance.now() - start) / 1000) % 11;
      const inhale = elapsed < 5.5;
      const k = inhale ? elapsed / 5.5 : 1 - (elapsed - 5.5) / 5.5;
      const eased = 0.5 - Math.cos(k * Math.PI) / 2;
      setPhase({ inhaling: inhale, scale: 0.55 + eased * 0.45 });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-[280px] place-items-center">
      <div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(142,245,212,0.35),rgba(106,166,255,0.12)_45%,transparent_70%)] blur-xl"
        style={{ transform: `scale(${phase.scale * 1.15})` }}
      />
      <div
        className="absolute inset-[12%] rounded-full border border-mint/30 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.35),rgba(142,245,212,0.25)_30%,rgba(106,166,255,0.15)_60%,rgba(20,30,60,0.2))] shadow-[0_0_80px_-10px_rgba(142,245,212,0.6)]"
        style={{ transform: `scale(${phase.scale})` }}
      />
      <span className="relative font-mono text-xs uppercase tracking-[0.25em] text-white/90">{phase.inhaling ? copy.breatheIn : copy.breatheOut}</span>
    </div>
  );
}
