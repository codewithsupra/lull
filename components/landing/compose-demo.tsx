"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import type { Messages } from "@/lib/i18n";


type Demo = Messages["landing"]["demo"]["cases"][number];

export function ComposeDemo() {
  const { t } = useI18n();
  const demo = t.landing.demo;
  const [i, setI] = useState(0);
  return <DemoRun key={i} demo={demo.cases[i]} copy={demo} onDone={() => setI((x) => (x + 1) % demo.cases.length)} />;
}

function DemoRun({ demo, copy, onDone }: { demo: Demo; copy: Messages["landing"]["demo"]; onDone: () => void }) {
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
        <p className="mono-label mb-2">{copy.promptHeading}</p>
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
          <h4 className="font-[family-name:var(--font-display)] text-lg font-semibold">{demo.title}</h4>
          <span className="mono-label text-mint">{copy.composedIn}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-muted">◎ {demo.breath}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-muted">∿ {demo.sound}</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-muted">{copy.duration}</span>
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
