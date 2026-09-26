"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { useI18n } from "@/components/i18n/locale-provider";
import { ReportView } from "@/components/report/report-view";
import { handlePaywall } from "@/lib/billing-client";
import { localToday } from "@/lib/care-client";
import { LOCALES, LOCALE_META, fmt, messagesFor, plural, type Locale } from "@/lib/i18n";
import { redact } from "@/lib/redact";
import {
  EXPIRY_DAYS,
  REPORT_SECTIONS,
  cleanQuestions,
  hasContent,
  pickSections,
  shareStatus,
  type Expiry,
  type Report,
  type ReportSection,
  type ShareRow,
} from "@/lib/report";

/** Sections that are on by default. Medicines are opt-in: the most sensitive thing on the page. */
const DEFAULT_ON: ReportSection[] = ["screeners", "adherence", "mood", "questions", "flags"];

export default function ReportPage() {
  const user = useUser();
  const { t, locale, tag } = useI18n();
  const r = t.report;

  const [report, setReport] = useState<Report | null>(null);
  const [shares, setShares] = useState<ShareRow[]>([]);
  // Stamped when the list loads, so link status (active/expired) isn't an impure call during render.
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [sections, setSections] = useState<ReportSection[]>(DEFAULT_ON);
  const [alias, setAlias] = useState("");
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<string[]>([]);
  const [reportLocale, setReportLocale] = useState<Locale>(locale);
  const [expires, setExpires] = useState<Expiry>("7d");
  const [creating, setCreating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ url: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/report?today=${localToday()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { report: Report; shares: ShareRow[] };
        setReport(json.report);
        setShares(json.shares);
        setLoadedAt(new Date());
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Mirrors what the server will do with the same inputs, so the preview is the payload.
  const preview = useMemo(() => {
    if (!report) return null;
    const withInputs: Report = {
      ...report,
      alias: alias.trim() ? redact(alias.trim()).slice(0, 40) || null : null,
      questions: cleanQuestions([...(report.questions ?? []), ...extra]),
    };
    return pickSections(withInputs, sections);
  }, [report, alias, extra, sections]);

  const toggle = (s: ReportSection) => {
    setCreated(null);
    setSections((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const addQuestion = () => {
    const q = draft.trim();
    if (!q || extra.length >= 5) return;
    setExtra((cur) => [...cur, q.slice(0, 300)]);
    setDraft("");
    setCreated(null);
  };

  const createLink = async () => {
    if (!sections.length) return setShareError(r.pickOne);
    setCreating(true);
    setShareError(null);
    setCreated(null);
    setCopied(false);
    try {
      const res = await fetch("/api/report/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, expires, locale: reportLocale, alias: alias.trim(), questions: extra, today: localToday() }),
      });
      const json = await res.json().catch(() => ({}));
      if (handlePaywall(res.status, json)) return;
      if (!res.ok) throw new Error(json.error ?? r.shareFailed);
      setCreated({ url: json.url, expires_at: json.expires_at });
      load();
    } catch (e) {
      setShareError(e instanceof Error ? e.message : r.shareFailed);
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      const res = await fetch("/api/report/share", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error();
      load();
    } catch {
      setShareError(r.revokeFailed);
    } finally {
      setRevoking(null);
    }
  };

  const day = useMemo(() => new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }), [tag]);

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="mono-label">{r.label}</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">{r.heading}</h1>
        <p className="mt-4 text-muted">{r.intro}</p>
        <Link href="/login?mode=signup" className="mt-8 inline-block rounded-full bg-mint px-6 py-3 text-sm font-semibold text-bg">
          {t.common.signUp}
        </Link>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-mint/60 bg-mint/15 text-ink" : "border-line text-muted hover:text-ink"}`;
  return (
    <div className="mx-auto max-w-6xl py-4">
      <header data-print-hide className="max-w-2xl">
        <p className="mono-label">{r.label}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">{r.heading}</h1>
        <p className="mt-3 text-muted">{r.intro}</p>
      </header>

      {loadError && <p className="mt-8 text-rose">{r.loadFailed}</p>}
      {!report && !loadError && <p className="mt-8 text-muted">{r.loading}</p>}

      {report && preview && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside data-print-hide className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section className="glass rounded-2xl p-5">
              <h2 className="font-semibold">{r.chooseHeading}</h2>
              <p className="mt-1 text-xs text-muted">{r.chooseHint}</p>
              <ul className="mt-4 space-y-1">
                {REPORT_SECTIONS.map((s) => {
                  const on = sections.includes(s);
                  const empty = !hasContent(report, s) && !(s === "questions" && extra.length);
                  return (
                    <li key={s}>
                      <label className="flex cursor-pointer gap-3 rounded-xl p-2 hover:bg-white/5">
                        <input type="checkbox" checked={on} onChange={() => toggle(s)} className="mt-1 h-4 w-4 accent-[var(--mint)]" />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                            {r.sections[s].title}
                            {empty && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-normal text-faint">{r.empty}</span>}
                          </span>
                          <span className="block text-xs text-muted">{r.sections[s].hint}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="glass space-y-4 rounded-2xl p-5">
              <label className="block">
                <span className="text-sm font-medium">{r.aliasLabel}</span>
                <input
                  value={alias}
                  maxLength={40}
                  onChange={(e) => {
                    setAlias(e.target.value);
                    setCreated(null);
                  }}
                  placeholder={r.aliasPlaceholder}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-mint/60"
                />
                <span className="mt-1 block text-xs text-muted">{r.aliasHint}</span>
              </label>

              <div>
                <span className="text-sm font-medium">{r.addQuestionLabel}</span>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={draft}
                    maxLength={300}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                    placeholder={r.addQuestionPlaceholder}
                    disabled={extra.length >= 5}
                    className="min-w-0 flex-1 rounded-xl border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-mint/60"
                  />
                  <button onClick={addQuestion} disabled={!draft.trim() || extra.length >= 5} className="rounded-xl border border-line px-3 text-sm disabled:opacity-40">
                    {r.add}
                  </button>
                </div>
                {extra.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {extra.map((q, i) => (
                      <li key={i} className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-sm">
                        <span className="min-w-0 break-words">{q}</span>
                        <button onClick={() => setExtra((cur) => cur.filter((_, j) => j !== i))} className="shrink-0 text-xs text-muted hover:text-rose" aria-label={r.remove}>
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <span className="text-sm font-medium">{r.languageLabel}</span>
                <div className="mt-1.5 flex gap-2">
                  {LOCALES.map((l) => (
                    <button key={l} onClick={() => setReportLocale(l)} className={chip(reportLocale === l)}>
                      {LOCALE_META[l].native}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => window.print()} className="w-full rounded-full border border-line py-2.5 text-sm font-medium hover:bg-white/5">
                {r.printButton}
              </button>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="font-semibold">{r.shareHeading}</h2>
              <p className="mt-1 text-xs text-muted">{r.shareHint}</p>
              <p className="mt-4 text-sm font-medium">{r.expiresLabel}</p>
              <div className="mt-1.5 flex gap-2">
                {(Object.keys(EXPIRY_DAYS) as Expiry[]).map((e) => (
                  <button key={e} onClick={() => setExpires(e)} className={chip(expires === e)}>
                    {r.expiry[e]}
                  </button>
                ))}
              </div>
              <button
                onClick={createLink}
                disabled={creating || !sections.length}
                className="mt-4 w-full rounded-full bg-mint py-2.5 text-sm font-semibold text-bg disabled:opacity-50"
              >
                {creating ? r.creating : r.createLink}
              </button>
              <p className="mt-2 text-xs text-faint">{r.proOnly}</p>
              {shareError && <p className="mt-2 text-sm text-rose">{shareError}</p>}

              {created && (
                <div className="mt-4 rounded-xl border border-mint/40 bg-mint/10 p-3">
                  <p className="text-sm font-semibold">{r.linkReady}</p>
                  <p className="mt-2 break-all rounded-lg bg-black/30 px-2 py-1.5 font-mono text-xs">{created.url}</p>
                  <button onClick={copy} className="mt-2 rounded-full bg-mint px-4 py-1.5 text-xs font-semibold text-bg">
                    {copied ? r.copied : r.copy}
                  </button>
                  <p className="mt-2 text-xs text-muted">{r.linkOnce}</p>
                </div>
              )}
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="font-semibold">{r.linksHeading}</h2>
              {shares.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{r.noLinks}</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/5">
                  {shares.map((s) => {
                    const status = shareStatus(s, loadedAt ?? new Date(0));
                    return (
                      <li key={s.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p>
                            <span className={status === "active" ? "text-mint" : "text-faint"}>{r.status[status]}</span>
                            <span className="text-muted"> · {s.sections.length}/{REPORT_SECTIONS.length} · {LOCALE_META[s.locale as Locale]?.native ?? s.locale}</span>
                          </p>
                          <p className="text-xs text-muted">
                            {fmt(r.created, { date: day.format(new Date(s.created_at)) })}
                            {status === "active" && <> · {fmt(r.expires, { date: day.format(new Date(s.expires_at)) })}</>}
                          </p>
                          <p className="text-xs text-faint">{s.view_count ? fmt(plural(s.view_count, r.views), { n: s.view_count }) : r.notOpened}</p>
                        </div>
                        {status === "active" && (
                          <button
                            onClick={() => revoke(s.id)}
                            disabled={revoking === s.id}
                            className="shrink-0 rounded-full border border-rose/40 px-3 py-1 text-xs text-rose disabled:opacity-50"
                          >
                            {revoking === s.id ? r.revoking : r.revoke}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>

          <div className="min-w-0">
            <ReportView report={preview} t={messagesFor(reportLocale)} locale={reportLocale} />
          </div>
        </div>
      )}
    </div>
  );
}
