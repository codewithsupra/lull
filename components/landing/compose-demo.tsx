"use client";

import { useEffect, useState } from "react";

const DEMOS = [
  {
    prompt: "Big interview tomorrow. It's 1am and my mind won't stop replaying everything.",
    title: "Quiet the Replay",
    breath: "4 · 7 · 8",
    sound: "Night rain + deep drone",
    lines: [
      "Let the day set itself down. You don't have to solve tomorrow tonight.",
      "Notice the weight of your body in the bed. Heavy, held, safe.",
      "Each thought that loops back is just a wave. Let it arrive… and pass.",
    ],
  },
  {
    prompt: "Afternoon slump, 3 tabs of deadlines, feeling scattered and wired.",
    title: "Clear Channel",
    breath: "Box 4 · 4 · 4 · 4",
    sound: "Deep brown noise + wind",
    lines: [
      "Pick one sound in the room and rest your attention there.",
      "Four counts in. Hold the square. Four counts out.",
      "When you return to the screen, return to just one tab.",
    ],
  },
  {
    prompt: "Just got some hard news. I feel heavy and a bit numb.",
    title: "Held",
    breath: "Coherent 5.5",
    sound: "Low tide + singing bowls",
    lines: [
      "There's nothing to fix right now. Only this breath.",
      "Place a hand on your chest. Feel it rise to meet you.",
      "Whatever you feel is allowed to be here, too.",
    ],
  },
];

export function ComposeDemo() {
  const [i, setI] = useState(0);
  return <DemoRun key={i} demo={DEMOS[i]} onDone={() => setI((x) => (x + 1) % DEMOS.length)} />;
}

function DemoRun({ demo, onDone }: { demo: (typeof DEMOS)[number]; onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const typed = demo.prompt.slice(0, count);

  useEffect(() => {
    let n = 0;
    let reveal = 0;
    const type = window.setInterval(() => {
      n++;
      setCount(n);
      if (n >= demo.prompt.length) {
        window.clearInterval(type);
        reveal = window.setTimeout(() => setShowPlan(true), 500);
      }
    }, 28);
    const next = window.setTimeout(onDone, demo.prompt.length * 28 + 7000);
    return () => {
      window.clearInterval(type);
      window.clearTimeout(reveal);
      window.clearTimeout(next);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="mono-label mb-2">how are you, really?</p>
        <p className="min-h-[3.2em] text-[15px] text-ink/90">
          {typed}
          <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-mint" />
        </p>
      </div>
      <div
        className={`rounded-xl border border-mint/20 bg-gradient-to-b from-mint/[0.07] to-transparent p-5 transition-all duration-700 ${
          showPlan ? "translate-y-0 opacity-100 blur-0" : "translate-y-3 opacity-0 blur-sm"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-[family-name:var(--font-unbounded)] text-lg font-semibold">{demo.title}</h4>
          <span className="mono-label text-mint">composed in 2.1s</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-muted">◎ {demo.breath}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-muted">∿ {demo.sound}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-muted">◷ 6 min</span>
        </div>
        <ol className="mt-4 space-y-2 text-sm text-ink/80">
          {demo.lines.map((l, k) => (
            <li key={k} className="flex gap-3">
              <span className="font-mono text-xs text-faint">0{k + 1}</span>
              <span>{l}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
