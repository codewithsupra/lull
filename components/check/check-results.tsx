"use client";

import Link from "next/link";
import { type ScreenerRecord, type Severity, type Tier } from "@/lib/screeners";
import { openCrisis } from "@/lib/safety-client";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt, type Messages } from "@/lib/i18n";

export type HistoryPoint = { id: string; at: string; tier: Tier; risk: boolean; phq9: number; gad7: number; sleep: number };

const TIER_ACCENT: Record<Tier, string> = { 0: "var(--rose)", 1: "var(--mint)", 2: "var(--sky)", 3: "var(--lilac)" };

const SUPPORT_LINES = [
  { key: "teleManas", how: "14416", href: "tel:14416" },
  { key: "icall", how: "9152987821", href: "tel:9152987821" },
  { key: "global", how: "findahelpline.com", href: "https://findahelpline.com" },
] as const;

function Bar({
  label,
  score,
  max,
  severity,
  t,
  clinical = true,
}: {
  label: string;
  score: number;
  max: number;
  severity: Severity;
  t: Messages;
  clinical?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-mono text-xs text-muted">
          {score}/{max} · {t.screeners.severity[severity]}
          {!clinical && t.screeners.nonClinical}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-mint via-sky to-lilac" style={{ width: `${(score / max) * 100}%` }} />
      </div>
    </div>
  );
}

function Trend({ history, t }: { history: HistoryPoint[]; t: Messages }) {
  const r = t.screeners.results;
  const pts = [...history].reverse();
  if (pts.length < 2) return <p className="text-sm text-muted">{r.trendEmpty}</p>;
  const W = 560;
  const H = 150;
  const pad = 16;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number, max: number) => H - pad - (v / max) * (H - pad * 2);
  const line = (key: "phq9" | "gad7", max: number) => pts.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(p[key], max)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={r.trendLabel}>
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
        <span>
          <span className="text-lilac">●</span> {r.legendMood}
        </span>
        <span>
          <span className="text-mint">●</span> {r.legendAnxiety}
        </span>
        <span className="ml-auto">{r.lowerIsBetter}</span>
      </div>
    </div>
  );
}

export function CheckResults({ record, history, nextDue, onRetake }: { record: ScreenerRecord; history: HistoryPoint[]; nextDue: string | null; onRetake?: () => void }) {
  const { t, tag } = useI18n();
  const sc = t.screeners;
  const r = sc.results;
  const tier = sc.tiers[record.tier];
  const accent = TIER_ACCENT[record.tier];
  const prev = history.find((h) => h.at < record.at);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="glass relative overflow-hidden rounded-3xl p-7 sm:p-9" style={{ borderColor: `color-mix(in oklab, ${accent} 35%, transparent)` }}>
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: `radial-gradient(circle, color-mix(in oklab, ${accent} 40%, transparent), transparent 70%)` }} />
        <p className="mono-label relative" style={{ color: accent }}>
          {fmt(r.carePath, { tier: tier.name })}
        </p>
        <h1 className="relative mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight sm:text-4xl">{tier.headline}</h1>
        <p className="relative mt-4 max-w-xl text-muted">{tier.next}</p>
        <ul className="relative mt-4 space-y-1 text-xs text-faint">
          {record.reasons.map((reason) => (
            // Records written before reasons became keys hold English prose; show those as-is.
            <li key={reason}>· {reason in sc.reasons ? sc.reasons[reason as keyof typeof sc.reasons] : reason}</li>
          ))}
        </ul>
        <div className="relative mt-6 flex flex-wrap gap-2">
          {record.tier === 0 || record.tier === 3 ? (
            <a href="tel:14416" className="rounded-full px-5 py-2.5 text-sm font-semibold text-bg" style={{ background: accent }}>
              {record.tier === 0 ? r.callUrgent : r.callCounsellor}
            </a>
          ) : null}
          <Link href="/app/plan" className="rounded-full border border-white/15 px-5 py-2.5 text-sm transition hover:border-white/35">
            {record.tier <= 1 ? r.openPlan : r.buildPlan}
          </Link>
          {record.tier === 2 && <span className="self-center font-mono text-[11px] text-muted">{r.circlesSoon}</span>}
        </div>
      </div>

      {(record.tier === 0 || record.tier === 3 || record.risk) && (
        <div className="glass rounded-3xl p-6">
          <p className="mono-label">{r.talkHeading}</p>
          <ul className="mt-3 space-y-2">
            {SUPPORT_LINES.map((l) => (
              <li key={l.key}>
                <a href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:border-white/25">
                  <span className="text-muted">{r.supportLines[l.key]}</span>
                  <span className="font-semibold">{l.how}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={openCrisis} className="rounded-full border border-rose/50 px-4 py-2 text-sm text-rose transition hover:bg-rose/10">
              {r.openHelpNow}
            </button>
            <Link href="/app/safety" className="rounded-full border border-white/15 px-4 py-2 text-sm transition hover:border-white/35">
              {r.writeSafetyPlan}
            </Link>
          </div>
          <p className="mt-3 text-xs text-faint">{r.supportNote}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass space-y-5 rounded-3xl p-6">
          <p className="mono-label">{r.thisCheck}</p>
          <Bar label={sc.instruments.phq9.label} score={record.phq9.score} max={27} severity={record.phq9.severity} t={t} />
          <Bar label={sc.instruments.gad7.label} score={record.gad7.score} max={21} severity={record.gad7.severity} t={t} />
          <Bar label={sc.instruments.sleep.label} score={record.sleep.score} max={9} severity={record.sleep.severity} t={t} clinical={false} />
          {prev && (
            <p className="text-sm text-muted">
              {fmt(r.sinceLast, { mood: delta(prev.phq9, record.phq9.score, t), anxiety: delta(prev.gad7, record.gad7.score, t) })}
            </p>
          )}
        </div>
        <div className="glass rounded-3xl p-6">
          <p className="mono-label">{r.trendHeading}</p>
          <div className="mt-4">
            <Trend history={history} t={t} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-faint">
        <span>{r.disclaimer}</span>
        <span className="flex items-center gap-3">
          {nextDue && <span>{fmt(r.nextCheck, { date: new Date(nextDue).toLocaleDateString(tag, { month: "short", day: "numeric" }) })}</span>}
          {onRetake && (
            <button onClick={onRetake} className="font-mono text-muted underline decoration-white/20 hover:text-ink">
              {r.retake}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

function delta(before: number, after: number, t: Messages) {
  const d = after - before;
  if (d === 0) return t.screeners.results.unchanged;
  return d < 0 ? fmt(t.screeners.results.better, { points: -d }) : fmt(t.screeners.results.worse, { points: d });
}
