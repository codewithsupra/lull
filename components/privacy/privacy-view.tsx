"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { useI18n } from "@/components/i18n/locale-provider";
import { clearSafetyCache } from "@/lib/safety-client";
import { CATEGORIES, CONFIRM_WORD, type PrivacySummary } from "@/lib/privacy";
import { fmt, plural } from "@/lib/i18n";

/** DPDP rights centre: see, download, correct and erase. `mock` is only passed by the dev-only preview harness; it skips the network entirely. */
export function PrivacyView({ mock }: { mock?: PrivacySummary } = {}) {
  const user = useUser() ?? (mock ? { id: "preview", email: mock.account.email, name: mock.account.name } : null);
  const { t, tag } = useI18n();
  const p = t.privacy;
  const [data, setData] = useState<PrivacySummary | null>(mock ?? null);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const load = useCallback(() => {
    if (mock) return;
    fetch("/api/privacy")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? p.errors.load);
        setData(json);
      })
      .catch((e: Error) => setError(e.message));
  }, [p.errors.load, mock]);
  const signedIn = !!user;
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  const date = (iso: string) => new Date(iso).toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric" });

  if (deleted) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">{p.deletedHeading}</h1>
        <p className="mt-4 text-muted">{p.deletedBody}</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload on purpose: it drops every bit of in-memory signed-in state */}
        <a href="/" className="mt-8 inline-block rounded-full border border-line px-6 py-3 text-sm">lull</a>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="mono-label">{p.label}</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">{p.heading}</h1>
        <p className="mt-4 text-muted">{p.intro}</p>
        <Link href="/login" className="mt-8 inline-block rounded-full bg-mint px-6 py-3 text-sm font-semibold text-bg">{t.common.logIn}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <header>
        <p className="mono-label">{p.label}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">{p.heading}</h1>
        <p className="mt-3 text-muted">{p.intro}</p>
      </header>

      {error && <p className="text-rose">{error}</p>}
      {!data && !error && <p className="text-muted">{p.loading}</p>}

      {data && (
        <>
          <section className="glass rounded-3xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{p.seeHeading}</h2>
            <p className="mt-1 text-xs text-faint">{p.seeHint}</p>
            <ul className="mt-4 divide-y divide-white/5">
              {CATEGORIES.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {p.categories[c.id].title}
                      <span className="ml-2 text-xs font-normal text-muted">{fmt(plural(data.counts[c.id], p.items), { n: data.counts[c.id] })}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{p.categories[c.id].desc}</p>
                  </div>
                  {c.manage && data.counts[c.id] > 0 && (
                    <Link href={c.manage} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-ink">
                      {p.manage}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <NameSection initial={data.account.name} email={data.account.email} since={data.account.created_at ? date(data.account.created_at) : null} />

          <section className="glass rounded-3xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{p.consentHeading}</h2>
            <p className="mt-2 text-sm text-muted">{data.consent ? fmt(p.consentGiven, { version: data.consent.version, date: date(data.consent.at) }) : p.consentNone}</p>
            <p className="mt-1 text-sm text-muted">{p.consentWithdraw}</p>
          </section>

          <section className="glass rounded-3xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{p.downloadHeading}</h2>
            <p className="mt-2 text-sm text-muted">{p.downloadBody}</p>
            {/* A plain link: the browser streams the attachment, with the session cookie, no JS needed. */}
            <a href="/api/privacy/export" download className="mt-4 inline-block rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-bg">
              ⤓ {p.downloadButton}
            </a>
          </section>

          <EraseCommunity onDone={load} />
          <DeleteAccount blocked={data.deletion_blocked} onDeleted={() => setDeleted(true)} />

          <section className="glass rounded-3xl p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{p.grievanceHeading}</h2>
            <p className="mt-2 text-sm text-muted">{p.grievanceBody}</p>
            {data.grievance ? (
              <p className="mt-3 text-sm">
                {data.grievance.name} ·{" "}
                <a href={`mailto:${data.grievance.email}`} className="text-mint underline">
                  {data.grievance.email}
                </a>
              </p>
            ) : (
              <p className="mt-3 text-sm text-faint">{p.grievancePending}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function NameSection({ initial, email, since }: { initial: string | null; email: string; since: string | null }) {
  const p = useI18n().t.privacy;
  const [name, setName] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setState("saving");
    setError(null);
    const res = await fetch("/api/privacy/name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setError(json.error ?? p.errors.name);
      return setState("idle");
    }
    setState("saved");
  };
  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{p.accountHeading}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">{p.nameLabel}</span>
          <div className="mt-1.5 flex gap-2">
            <input
              value={name}
              maxLength={60}
              onChange={(e) => {
                setName(e.target.value);
                setState("idle");
              }}
              className="min-w-0 flex-1 rounded-xl border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-mint/60"
            />
            <button onClick={save} disabled={state === "saving" || !name.trim()} className="rounded-xl border border-line px-3 text-sm disabled:opacity-50">
              {state === "saving" ? p.saving : state === "saved" ? p.saved : p.save}
            </button>
          </div>
        </label>
        <div>
          <span className="text-sm font-medium">{p.emailLabel}</span>
          <p className="mt-1.5 truncate rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-muted">{email}</p>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-rose">{error}</p>}
      {since && <p className="mt-3 text-xs text-faint">{fmt(p.since, { date: since })}</p>}
      <p className="mt-2 text-xs text-muted">{p.correctHint}</p>
    </section>
  );
}

function useErase(scope: "community" | "account") {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (confirm: string) => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/privacy/erase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, confirm }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(json.error ?? "");
      return null;
    }
    return json as { posts?: number; comments?: number };
  };
  return { busy, error, run };
}

function ConfirmInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = useI18n().t.privacy;
  return (
    <label className="mt-4 block">
      <span className="block text-xs text-muted">{fmt(p.confirmLabel, { word: CONFIRM_WORD })}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="mt-1 block w-full max-w-xs rounded-xl border border-line bg-white/5 px-3 py-2 font-mono text-sm outline-none focus:border-rose/60"
      />
    </label>
  );
}

function EraseCommunity({ onDone }: { onDone: () => void }) {
  const p = useI18n().t.privacy;
  const { busy, error, run } = useErase("community");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState<string | null>(null);
  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{p.communityHeading}</h2>
      <p className="mt-2 text-sm text-muted">{p.communityBody}</p>
      <ConfirmInput value={confirm} onChange={setConfirm} />
      <button
        onClick={async () => {
          const r = await run(confirm);
          if (r) {
            setDone(fmt(p.communityDone, { posts: r.posts ?? 0, comments: r.comments ?? 0 }));
            setConfirm("");
            onDone();
          }
        }}
        disabled={busy || confirm !== CONFIRM_WORD}
        className="mt-3 rounded-full border border-rose/50 px-5 py-2 text-sm text-rose disabled:opacity-40"
      >
        {busy ? p.deleting : p.communityButton}
      </button>
      {done && <p className="mt-2 text-sm text-mint">{done}</p>}
      {error !== null && <p className="mt-2 text-sm text-rose">{error || p.errors.erase}</p>}
    </section>
  );
}

function DeleteAccount({ blocked, onDeleted }: { blocked: boolean; onDeleted: () => void }) {
  const p = useI18n().t.privacy;
  const { busy, error, run } = useErase("account");
  const [confirm, setConfirm] = useState("");
  return (
    <section className="rounded-3xl border border-rose/30 bg-rose/[0.04] p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-rose">{p.deleteHeading}</h2>
      <p className="mt-2 text-sm text-ink/85">{p.deleteBody}</p>
      <p className="mt-2 text-xs text-muted">{p.retained}</p>
      {blocked ? (
        <div className="mt-4 rounded-2xl border border-line bg-white/[0.03] p-4 text-sm">
          <p>{p.subscriptionBlocked}</p>
          <Link href="/app/pro" className="mt-2 inline-block text-mint underline">{p.manageSubscription}</Link>
        </div>
      ) : (
        <>
          <ConfirmInput value={confirm} onChange={setConfirm} />
          <button
            onClick={async () => {
              if (await run(confirm)) {
                // The offline copy of the safety plan lives in this browser; it goes too.
                clearSafetyCache();
                onDeleted();
              }
            }}
            disabled={busy || confirm !== CONFIRM_WORD}
            className="mt-3 rounded-full bg-rose px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
          >
            {busy ? p.deleting : p.deleteButton}
          </button>
          {error !== null && <p className="mt-2 text-sm text-rose">{error || p.errors.erase}</p>}
        </>
      )}
    </section>
  );
}
