"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LAYERS, getEngine, type LayerId, type Mix } from "@/lib/audio/engine";
import { logPractice } from "@/lib/data";
import { useUser } from "@/components/app/user-context";
import { GuestNote } from "@/components/app/guest-note";

const PRESETS: { name: string; mix: Mix }[] = [
  { name: "Night rain", mix: { rain: 0.8, brown: 0.35, drone: 0.4 } },
  { name: "Low tide", mix: { ocean: 0.85, wind: 0.25, bowls: 0.4 } },
  { name: "Cabin fire", mix: { fire: 0.8, wind: 0.45, drone: 0.25 } },
  { name: "Deep focus", mix: { brown: 0.85, rain: 0.2 } },
  { name: "Temple", mix: { bowls: 0.7, drone: 0.6, wind: 0.2 } },
];

const TIMERS = [0, 15, 30, 60];

const emptyMix: Mix = {};
const now = () => Date.now();

export default function SoundsPage() {
  const user = useUser();
  const engine = typeof window === "undefined" ? null : getEngine();
  const mix = useSyncExternalStore(
    (cb) => engine?.subscribe(cb) ?? (() => {}),
    () => engine?.mix ?? emptyMix,
    () => emptyMix,
  );
  const playing = Object.values(mix).some((v) => (v ?? 0) > 0.001);
  const [timer, setTimer] = useState(0);
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shownLeft = playing && timer ? (timerLeft ?? timer * 60) : null;

  const stop = useCallback(
    (fade = 2) => {
      getEngine().fadeOut(fade);
      if (startedAt.current && user) {
        const secs = (Date.now() - startedAt.current) / 1000;
        const top = Object.entries(getEngine().mix)
          .filter(([, v]) => (v ?? 0) > 0)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .map(([k]) => LAYERS.find((l) => l.id === k)?.label)
          .slice(0, 2)
          .join(" + ");
        void logPractice(timer ? "sleep" : "soundscape", top || "Soundscape", secs);
      }
      startedAt.current = null;
      setTimerLeft(null);
    },
    [user, timer],
  );

  const set = async (id: LayerId, v: number) => {
    await getEngine().resume();
    getEngine().setLevel(id, v);
    if (!startedAt.current && v > 0) startedAt.current = now();
  };

  const applyPreset = async (m: Mix) => {
    await getEngine().applyMix(m);
    if (!startedAt.current) startedAt.current = now();
  };

  // Sleep timer countdown with a 30s fade at the end.
  useEffect(() => {
    if (!playing || !timer) return;
    const end = now() + timer * 60_000;
    const id = window.setInterval(() => {
      const left = Math.round((end - now()) / 1000);
      setTimerLeft(left);
      if (left <= 0) {
        window.clearInterval(id);
        stop(30);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, playing]);

  // Radial visualizer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const analyser = getEngine().analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let t = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.004;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      analyser.getByteFrequencyData(data);
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) * 0.26;
      const n = 120;
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2 + t * (ring + 1) * 0.6;
          const bin = data[Math.floor(((i % n) / n) * data.length * 0.6)] / 255;
          const r = base + ring * 18 + bin * (60 - ring * 14) + Math.sin(a * 3 + t * 8) * 3;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.strokeStyle = ["rgba(142,245,212,0.75)", "rgba(106,166,255,0.5)", "rgba(183,157,255,0.35)"][ring];
        ctx.lineWidth = 2 - ring * 0.4;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 18;
        ctx.stroke();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
      <div className="flex flex-col items-center">
        <div className="relative w-full max-w-[520px]">
          <canvas ref={canvasRef} width={1040} height={1040} className="aspect-square w-full" />
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-[family-name:var(--font-unbounded)] text-2xl font-semibold">{playing ? "Listening" : "Silence"}</div>
              <div className="mono-label mt-2">
                {shownLeft !== null
                  ? `fades out in ${Math.floor(Math.max(0, shownLeft) / 60)}:${String(Math.max(0, shownLeft) % 60).padStart(2, "0")}`
                  : playing
                    ? "live synthesis"
                    : "pick a preset or raise a layer"}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => applyPreset(p.mix)} className="rounded-full border border-white/12 px-4 py-2 text-sm text-ink/85 transition hover:border-mint/50 hover:text-mint">
              {p.name}
            </button>
          ))}
          {playing && (
            <button onClick={() => stop(2)} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-bg">
              ■ Stop
            </button>
          )}
        </div>
      </div>

      <aside className="space-y-6">
        <div className="glass space-y-5 rounded-3xl p-6">
          <p className="mono-label">Layers</p>
          {LAYERS.map((l) => {
            const v = mix[l.id] ?? 0;
            return (
              <div key={l.id}>
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className={v > 0 ? "text-ink" : "text-muted"}>{l.label}</span>
                  <span className="font-mono text-[11px] text-faint">{l.hint}</span>
                </div>
                <input
                  aria-label={`${l.label} volume`}
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(v * 100)}
                  onChange={(e) => set(l.id, Number(e.target.value) / 100)}
                  className="slider w-full"
                  style={{ ["--val" as string]: `${v * 100}%` }}
                />
              </div>
            );
          })}
        </div>
        <div>
          <p className="mono-label">Sleep timer</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {TIMERS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setTimer(m);
                  setTimerLeft(null);
                }}
                className={`rounded-xl border py-2 text-sm transition ${m === timer ? "border-lilac/50 bg-lilac/10" : "border-white/10"}`}
              >
                {m ? `${m}m` : "Off"}
              </button>
            ))}
          </div>
        </div>
        {!user && <GuestNote>Sign in to log listening time.</GuestNote>}
      </aside>
    </div>
  );
}
