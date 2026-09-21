"use client";

import { useEffect, useRef, useState } from "react";
import { getEngine, type LayerId } from "@/lib/audio/engine";

const PRESETS: { id: string; label: string; mix: Partial<Record<LayerId, number>> }[] = [
  { id: "storm", label: "Night rain", mix: { rain: 0.8, brown: 0.35, drone: 0.4 } },
  { id: "tide", label: "Low tide", mix: { ocean: 0.85, wind: 0.25, bowls: 0.4 } },
  { id: "cabin", label: "Cabin fire", mix: { fire: 0.8, wind: 0.45, drone: 0.25 } },
];

export function TrySound() {
  const [active, setActive] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const engine = getEngine();
    const analyser = engine.analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { width, height } = canvas;
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, width, height);
      const bars = 48;
      const bw = width / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i / bars) * data.length * 0.7)] / 255;
        const h = Math.max(2, v * height);
        const g = ctx.createLinearGradient(0, height - h, 0, height);
        g.addColorStop(0, "rgba(200,255,110,0.95)");
        g.addColorStop(1, "rgba(106,166,255,0.2)");
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + 1, height - h, bw - 2, h);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useEffect(() => () => getEngine().fadeOut(0.8), []);

  const toggle = async (id: string) => {
    const engine = getEngine();
    if (active === id) {
      engine.fadeOut(1.2);
      setActive(null);
      return;
    }
    const preset = PRESETS.find((p) => p.id === id)!;
    await engine.applyMix(preset.mix);
    setActive(id);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`rounded-full border px-4 py-2 text-sm transition-all ${
              active === p.id
                ? "border-lime/60 bg-lime/10 text-lime shadow-[0_0_30px_-8px_var(--lime)]"
                : "border-white/15 text-ink/80 hover:border-white/30 hover:text-ink"
            }`}
          >
            {active === p.id ? "■ " : "▶ "}
            {p.label}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} width={480} height={90} className="mt-5 h-[90px] w-full opacity-90" />
      <p className="mono-label mt-2">{active ? "synthesizing live · web audio" : "tap a preset · headphones recommended"}</p>
    </div>
  );
}
