"use client";

import Link from "next/link";
import { SEVERITY_COPY, TIERS, type ScreenerRecord, type Tier } from "@/lib/screeners";
import { openCrisis } from "@/lib/safety-client";

export type HistoryPoint = { id: string; at: string; tier: Tier; risk: boolean; phq9: number; gad7: number; sleep: number };

const TIER_ACCENT: Record<Tier, string> = { 0: "var(--rose)", 1: "var(--mint)", 2: "var(--sky)", 3: "var(--lilac)" };

const SUPPORT_LINES = [
  { name: "Tele-MANAS (India, free, 24/7)", how: "14416", href: "tel:14416" },
  { name: "iCall · TISS counselling (India)", how: "9152987821", href: "tel:9152987821" },
  { name: "Find a helpline anywhere", how: "findahelpline.com", href: "https://findahelpline.com" },
];

function Bar({ label, score, max, severity, clinical = true }: { label: string; score: number; max: number; severity: keyof typeof SEVERITY_COPY; clinical?: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-mono text-xs text-muted">
          {score}/{max} · {SEVERITY_COPY[severity]}
          {!clinical && " (non-clinical)"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-mint via-sky to-lilac" style={{ width: `${(score / max) * 100}%` }} />
      </div>
    </div>
  );
}

function Trend({ history }: { history: HistoryPoint[] }) {
  const pts = [...history].reverse();
  if (pts.length < 2) return <p className="text-sm text-muted">Your trend appears after your next check in two weeks.</p>;
  const W = 560;
  const H = 150;
  const pad = 16;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number, max: number) => H - pad - (v / max) * (H - pad * 2);
  const line = (key: "phq9" | "gad7", max: number) => pts.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(p[key], max)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="PHQ-9 and GAD-7 over time">
        {[0.33, 0.66].map((f) => (
          <line key={f} x1={pad} x2={W - pad} y1={pad + f * (H - pad * 2)} y2={pad + f * (H - pad * 2)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 5" />
        ))}
        <path d={line("phq9", 27)} fill="none" stroke="var(--lilac)" strokeWidth="2.5" strokeLinecap="round" />
        <path d={line("gad7", 21)} fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.phq9, 27)} r="3.5" fill="var(--lilac)" />
            <circle cx={x(i)} cy={y(p.gad7, 21)} r="3.5" fill="var(--mint)" />
          </g>
        ))}
      </svg>
      <div className="mt-2 flex gap-4 font-mono text-[11px] text-muted">
        <span><span className="text-lilac">●</span> PHQ-9 (mood)</span>
        <span><span className="text-mint">●</span> GAD-7 (anxiety)</span>
        <span className="ml-auto">lower is better</span>
      </div>
    </div>
  );
}

export function CheckResults({ record, history, nextDue, onRetake }: { record: ScreenerRecord; history: HistoryPoint[]; nextDue: string | null; onRetake?: () => void }) {
  const tier = TIERS[record.tier];
  const accent = TIER_ACCENT[record.tier];
  const prev = history.find((h) => h.at < record.at);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="glass relative overflow-hidden rounded-3xl p-7 sm:p-9" style={{ borderColor: `color-mix(in oklab, ${accent} 35%, transparent)` }}>
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, color-mix(in oklab, ${accent} 40%, transparent), transparent 70%)` }} />
        <p className="mono-label relative" style={{ color: accent }}>
          your care path · {tier.name}
        </p>
        <h1 className="relative mt-2 font-[family-name:var(--font-unbounded)] text-2xl font-semibold leading-tight sm:text-4xl">{tier.headline}</h1>
        <p className="relative mt-4 max-w-xl text-muted">{tier.next}</p>
        <ul className="relative mt-4 space-y-1 text-xs text-faint">
          {record.reasons.map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
        <div className="relative mt-6 flex flex-wrap gap-2">
          {record.tier === 0 || record.tier === 3 ? (
            <a href="tel:14416" className="rounded-full px-5 py-2.5 text-sm font-semibold text-bg" style={{ background: accent }}>
              {record.tier === 0 ? "Call Tele-MANAS 14416 now" : "Talk to a counsellor (free, 14416)"}
            </a>
          ) : null}
          <Link href="/app/plan" className="rounded-full border border-white/15 px-5 py-2.5 text-sm transition hover:border-white/35">
            {record.tier <= 1 ? "Open my Care Plan →" : "Build my Care Plan →"}
          </Link>
          {record.tier === 2 && <span className="self-center font-mono text-[11px] text-muted">peer circles are coming soon</span>}
        </div>
      </div>

      {(record.tier === 0 || record.tier === 3 || record.risk) && (
        <div className="glass rounded-3xl p-6">
          <p className="mono-label">Talk to someone</p>
          <ul className="mt-3 space-y-2">
            {SUPPORT_LINES.map((l) => (
              <li key={l.name}>
                <a href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:border-white/25">
                  <span className="text-muted">{l.name}</span>
                  <span className="font-semibold">{l.how}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={openCrisis} className="rounded-full border border-rose/50 px-4 py-2 text-sm text-rose transition hover:bg-rose/10">
              Open help now
            </button>
            <Link href="/app/safety" className="rounded-full border border-white/15 px-4 py-2 text-sm transition hover:border-white/35">
              Write my safety plan →
            </Link>
          </div>
          <p className="mt-3 text-xs text-faint">A safety plan takes 5 minutes now and is one tap away later, even offline. Our therapist network is launching soon, and you can also show these results to your doctor.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass space-y-5 rounded-3xl p-6">
          <p className="mono-label">This check</p>
          <Bar label="Mood (PHQ-9)" score={record.phq9.score} max={27} severity={record.phq9.severity} />
          <Bar label="Anxiety (GAD-7)" score={record.gad7.score} max={21} severity={record.gad7.severity} />
          <Bar label="Sleep snapshot" score={record.sleep.score} max={9} severity={record.sleep.severity} clinical={false} />
          {prev && (
            <p className="text-sm text-muted">
              Since last time: mood {delta(prev.phq9, record.phq9.score)}, anxiety {delta(prev.gad7, record.gad7.score)}.
            </p>
          )}
        </div>
        <div className="glass rounded-3xl p-6">
          <p className="mono-label">Your trend</p>
          <div className="mt-4">
            <Trend history={history} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-faint">
        <span>This is a screening, not a diagnosis. Only a qualified professional can diagnose. Your answers are encrypted.</span>
        <span className="flex items-center gap-3">
          {nextDue && <span>Next check: {new Date(nextDue).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
          {onRetake && (
            <button onClick={onRetake} className="font-mono text-muted underline decoration-white/20 hover:text-ink">
              retake
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

function delta(before: number, after: number) {
  const d = after - before;
  if (d === 0) return "unchanged";
  return d < 0 ? `↓ ${-d} points (better)` : `↑ ${d} points`;
}
