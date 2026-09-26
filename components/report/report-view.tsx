import { fmt, plural, tagFor, type Locale, type Messages } from "@/lib/i18n";
import type { Report, ScreenerPoint } from "@/lib/report";
import { SITE } from "@/lib/site";

/**
 * The doctor-facing report sheet (FR10). Purely presentational and hook-free, so the exact same
 * markup renders the user's live preview and the anonymous /r/[token] page — what the patient
 * reviews is what the doctor sees. Styled as a white paper page on screen and in print.
 */

type Props = { report: Report; t: Messages; locale: Locale };

function dateFmt(locale: Locale) {
  const f = new Intl.DateTimeFormat(tagFor(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return (iso: string) => f.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="report-section mt-9">
      <h2 className="flex items-baseline gap-3 border-b border-[#e3e5ea] pb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#4a5060]">
        <span className="tabular-nums text-[#9aa0ad]">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#7a8090]">{children}</p>;
}

function ScoreChart({ points, d }: { points: ScreenerPoint[]; d: (iso: string) => string }) {
  if (points.length < 2) return null;
  // Dates sit in HTML below the SVG, not inside it: SVG text scales with the chart and would
  // shrink to ~5px on a phone. Exact values are in the table underneath either way.
  const W = 640, H = 150, L = 30, R = 12, T = 10, B = 8, MAX = 27;
  const x = (i: number) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v: number) => T + (1 - v / MAX) * (H - T - B);
  const line = (k: "phq9" | "gad7") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="PHQ-9 and GAD-7 over time">
        {[0, 5, 10, 15, 20, 27].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 10 ? "#c9ccd4" : "#eef0f3"} strokeDasharray={v === 10 ? "4 4" : undefined} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#9aa0ad">{v}</text>
          </g>
        ))}
        <path d={line("phq9")} fill="none" stroke="#2b3a67" strokeWidth="2.2" strokeLinejoin="round" />
        <path d={line("gad7")} fill="none" stroke="#1f8a7a" strokeWidth="2.2" strokeDasharray="6 4" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.at}>
            <circle cx={x(i)} cy={y(p.phq9)} r="3" fill="#2b3a67" />
            <circle cx={x(i)} cy={y(p.gad7)} r="3" fill="#fff" stroke="#1f8a7a" strokeWidth="1.8" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-[#9aa0ad]" style={{ paddingLeft: `${(L / W) * 100}%`, paddingRight: `${(R / W) * 100}%` }}>
        <span>{d(points[0].at)}</span>
        <span>{d(points[points.length - 1].at)}</span>
      </div>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-[#eef0f3]">
      <span className="absolute inset-y-0 left-0 rounded-full bg-[#2b3a67]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export function ReportView({ report, t, locale }: Props) {
  const r = t.report;
  const d = dateFmt(locale);
  let n = 0;
  const th = "py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider text-[#7a8090]";
  const td = "py-2 pr-4 align-top tabular-nums";

  return (
    <article lang={tagFor(locale)} className="report-sheet mx-auto w-full max-w-[820px] rounded-2xl bg-white px-6 py-8 text-[#16181d] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:px-12 sm:py-12">
      <header className="flex flex-col gap-6 border-b-2 border-[#16181d] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[15px] font-semibold lowercase tracking-tight text-[#2b3a67]">lull</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">{r.sheetTitle}</h1>
          <p className="mt-1 text-sm text-[#5b6170]">{r.sheetSubtitle}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[#7a8090]">{r.preparedFor}</dt>
          <dd className="font-medium">{report.alias ?? <span className="font-normal italic text-[#9aa0ad]">{r.noName}</span>}</dd>
          <dt className="text-[#7a8090]">{r.periodLabel}</dt>
          <dd>{fmt(r.period, { from: d(report.period.from), to: d(report.period.to) })}</dd>
          <dt className="text-[#7a8090]">{r.generatedLabel}</dt>
          <dd>{d(report.generated_at)}</dd>
          {report.category && (
            <>
              <dt className="text-[#7a8090]">{r.focusLabel}</dt>
              <dd>{t.plan.categories[report.category].label}</dd>
            </>
          )}
        </dl>
      </header>

      {report.screeners && (
        <Section n={++n} title={r.sections.screeners.title}>
          {report.screeners.points.length === 0 ? (
            <Empty>{r.noScreeners}</Empty>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {(["phq9", "gad7", "sleep"] as const).map((k) => {
                  const last = report.screeners!.points[report.screeners!.points.length - 1];
                  const max = k === "phq9" ? 27 : k === "gad7" ? 21 : 9;
                  return (
                    <div key={k} className="rounded-xl border border-[#e3e5ea] p-3 sm:p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7a8090]">{r.scoreCols[k]}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
                        {last[k]}
                        <span className="text-sm font-normal text-[#9aa0ad]">/{max}</span>
                      </p>
                      {report.screeners!.latest && <p className="text-xs text-[#4a5060] sm:text-sm">{t.screeners.severity[report.screeners!.latest[k]]}</p>}
                      {report.screeners!.change && (
                        <p className="mt-1 text-[11px] text-[#7a8090] sm:text-xs">
                          <span className="font-semibold tabular-nums text-[#16181d]">{signed(report.screeners!.change[k])}</span>{" "}
                          {fmt(r.scoresSince, { date: d(report.screeners!.points[0].at) })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <ScoreChart points={report.screeners.points} d={d} />
              <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#5b6170]">
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-[#2b3a67]" />PHQ-9</span>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-[#1f8a7a]" />GAD-7</span>
                <span>{r.scoreRanges}</span>
              </p>
              <p
                className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                  report.screeners.risk_endorsed > 0 ? "border border-[#e8b04a] bg-[#fff6e3] font-medium text-[#6b4700]" : "bg-[#f4f5f7] text-[#4a5060]"
                }`}
              >
                {report.screeners.risk_endorsed > 0
                  ? fmt(plural(report.screeners.risk_endorsed, r.riskSome), { n: report.screeners.risk_endorsed })
                  : r.riskNone}
              </p>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e3e5ea]">
                    <th className={th}>{r.scoreCols.date}</th>
                    <th className={th}>{r.scoreCols.phq9}</th>
                    <th className={th}>{r.scoreCols.gad7}</th>
                    <th className={th}>{r.scoreCols.sleep}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...report.screeners.points].reverse().map((p) => (
                    <tr key={p.at} className="border-b border-[#f0f1f4] last:border-0">
                      <td className={td}>{d(p.at)}</td>
                      <td className={td}>{p.phq9}</td>
                      <td className={td}>{p.gad7}</td>
                      <td className={td}>{p.sleep}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Section>
      )}

      {report.adherence && (
        <Section n={++n} title={r.sections.adherence.title}>
          {report.adherence.weeks.length === 0 ? (
            <Empty>{r.noAdherence}</Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  [r.medRate, report.adherence.med_rate],
                  [r.allRate, report.adherence.all_rate],
                ].map(([label, v]) => (
                  <div key={String(label)} className="rounded-xl border border-[#e3e5ea] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7a8090]">{label}</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums">{v === null ? "—" : `${v}%`}</p>
                  </div>
                ))}
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                {report.adherence.weeks.map((w) => (
                  <li key={w.week} className="grid grid-cols-[88px_1fr] items-center gap-x-4 gap-y-1 sm:grid-cols-[110px_1fr_auto]">
                    <span className="font-medium">
                      {fmt(r.weekN, { n: w.week })}
                      <span className="block text-xs font-normal text-[#9aa0ad]">{d(w.from)}</span>
                    </span>
                    <Bar value={w.all_due ? (w.all_done / w.all_due) * 100 : 0} />
                    <span className="col-start-2 text-xs tabular-nums text-[#5b6170] sm:col-start-auto">
                      {w.med_due > 0 && <>{fmt(r.doses, { done: w.med_done, due: w.med_due })} · </>}
                      {fmt(r.steps, { done: w.all_done, due: w.all_due })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs italic text-[#7a8090]">{r.selfReported}</p>
            </>
          )}
        </Section>
      )}

      {report.mood && (
        <Section n={++n} title={r.sections.mood.title}>
          {report.mood.weeks.length === 0 ? (
            <Empty>{r.noMood}</Empty>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e3e5ea]">
                    <th className={th}>{r.moodCols.week}</th>
                    <th className={th}>{r.moodCols.mood}</th>
                    <th className={th}>{r.moodCols.energy}</th>
                    <th className={th}>{r.moodCols.n}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.mood.weeks.map((w) => (
                    <tr key={w.from} className="border-b border-[#f0f1f4] last:border-0">
                      <td className={td}>{d(w.from)}</td>
                      <td className={td}>{w.mood.toFixed(1)}</td>
                      <td className={td}>{w.energy.toFixed(1)}</td>
                      <td className={td}>{w.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[#7a8090]">{r.moodScale}</p>
            </>
          )}
        </Section>
      )}

      {report.medications && (
        <Section n={++n} title={r.sections.medications.title}>
          {report.medications.length === 0 ? (
            <Empty>{r.noMeds}</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e3e5ea]">
                  <th className={th}>{r.medCols.name}</th>
                  <th className={th}>{r.medCols.dose}</th>
                  <th className={th}>{r.medCols.times}</th>
                </tr>
              </thead>
              <tbody>
                {report.medications.map((m, i) => (
                  <tr key={i} className="border-b border-[#f0f1f4] last:border-0">
                    <td className={`${td} font-medium`}>{m.name}</td>
                    <td className={td}>{m.dose ?? "—"}</td>
                    <td className={td}>{m.times.length ? m.times.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      {report.questions && (
        <Section n={++n} title={r.sections.questions.title}>
          {report.questions.length === 0 ? (
            <Empty>{r.noQuestions}</Empty>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed marker:text-[#9aa0ad]">
              {report.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          )}
        </Section>
      )}

      {report.flags && (
        <Section n={++n} title={r.sections.flags.title}>
          {report.flags.length === 0 ? (
            <Empty>{r.noFlags}</Empty>
          ) : (
            <ul className="space-y-2 text-[15px] leading-relaxed">
              {report.flags.map((f, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e8b04a]" />
                  {f}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <footer className="mt-10 border-t border-[#e3e5ea] pt-4 text-xs leading-relaxed text-[#7a8090]">
        <p>{r.disclaimer}</p>
        <p className="mt-2 font-medium text-[#4a5060]">{SITE.name} · {SITE.url.replace(/^https?:\/\//, "")}</p>
      </footer>
    </article>
  );
}
