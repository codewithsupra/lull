"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BAN_DURATIONS, BAN_REASONS, type BanDuration, type BanReason, type ModAction, type ModDashboard, type ModItem } from "@/lib/moderation";

const TABS = ["queue", "recent", "bans", "log"] as const;
type Tab = (typeof TABS)[number];

const REASON_LABEL: Record<string, string> = {
  harmful_advice: "Harmful advice",
  selling: "Selling / sourcing",
  harassment: "Harassment",
  spam: "Spam",
  personal_info: "Personal info",
  crisis: "Crisis",
  other: "Other",
};

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** `mock` is only passed by the dev-only preview harness; it skips the network entirely. */
export function ModerationClient({ mock }: { mock?: ModDashboard } = {}) {
  const [data, setData] = useState<ModDashboard | null>(mock ?? null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("queue");
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    if (mock) return;
    fetch("/api/admin/moderation")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Couldn't load.");
        setData(json);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [mock]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (a: ModAction, label: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    const k = JSON.stringify(a);
    setBusy(k);
    const res = await fetch("/api/admin/moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    setToast(res?.ok ? `✓ ${label}` : `✗ ${json.error ?? "Failed"}`);
    load();
  };

  const counts: Record<Tab, number | null> = {
    queue: data?.queue.length ?? null,
    recent: data?.recent.length ?? null,
    bans: data?.bans.length ?? null,
    log: data?.log.length ?? null,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <header>
        <p className="mono-label">admin · community</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Moderation</h1>
        <p className="mt-2 text-sm text-muted">
          You act on content and on anonymous author handles. These tools never show who anyone is. Crisis reports are always at the top.
        </p>
      </header>

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Open reports", data.stats.open_reports],
            ["Hidden", data.stats.hidden],
            ["Active bans", data.stats.active_bans],
            ["Posts · 24h", data.stats.posts_24h],
            ["Comments · 24h", data.stats.comments_24h],
          ].map(([label, n]) => (
            <div key={label} className="glass rounded-2xl p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{n}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm capitalize ${t === tab ? "border-mint/60 bg-mint/15 text-ink" : "border-line text-muted hover:text-ink"}`}
          >
            {t}
            {counts[t] !== null && <span className="ml-1.5 text-xs text-faint">{counts[t]}</span>}
          </button>
        ))}
        <button onClick={load} className="ml-auto rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:text-ink">
          Refresh
        </button>
      </div>

      {toast && (
        <p role="status" className="rounded-xl border border-line bg-white/5 px-4 py-2 text-sm">
          {toast}
        </p>
      )}
      {error && <p className="text-rose">{error}</p>}
      {!data && !error && <p className="text-muted">Loading…</p>}

      {data && tab === "queue" && (
        <section className="space-y-3">
          {data.queue.length === 0 ? <Empty>Nothing waiting for review.</Empty> : data.queue.map((it) => <ModCard key={`${it.type}:${it.id}`} item={it} run={run} busy={busy} />)}
        </section>
      )}
      {data && tab === "recent" && (
        <section className="space-y-3">
          {data.recent.length === 0 ? <Empty>No posts or comments yet.</Empty> : data.recent.map((it) => <ModCard key={`${it.type}:${it.id}`} item={it} run={run} busy={busy} />)}
        </section>
      )}
      {data && tab === "bans" && (
        <section className="glass rounded-2xl p-2">
          {data.bans.length === 0 ? (
            <Empty>No active bans.</Empty>
          ) : (
            <ul className="divide-y divide-white/5">
              {data.bans.map((b) => (
                <li key={b.key} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span>
                    <span className="font-mono">{b.handle}</span>
                    <span className="text-muted"> · {REASON_LABEL[b.reason] ?? b.reason} · {b.until ? `until ${when(b.until)}` : "permanent"}</span>
                  </span>
                  <button
                    onClick={() => run({ action: "unban", key: b.key }, `Unbanned ${b.handle}`, `Lift the ban on ${b.handle}?`)}
                    className="rounded-full border border-line px-3 py-1 text-xs hover:bg-white/5"
                  >
                    Unban
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {data && tab === "log" && (
        <section className="glass rounded-2xl p-2">
          {data.log.length === 0 ? (
            <Empty>No moderation actions yet.</Empty>
          ) : (
            <ul className="divide-y divide-white/5 font-mono text-xs">
              {data.log.map((l, i) => (
                <li key={i} className="flex flex-wrap gap-x-3 gap-y-1 p-3">
                  <span className="text-faint">{when(l.created_at)}</span>
                  <span className="text-mint">{l.action}</span>
                  <span className="text-muted">
                    {l.target_type} {l.target_id}
                  </span>
                  {l.note && <span className="text-muted">· {l.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-sm text-muted">{children}</p>;
}

function ModCard({ item, run, busy }: { item: ModItem; run: (a: ModAction, label: string, confirmText?: string) => void; busy: string | null }) {
  const [banning, setBanning] = useState(false);
  const [duration, setDuration] = useState<BanDuration>("7d");
  const [reason, setReason] = useState<BanReason>("harmful_advice");
  const target = { type: item.type, id: item.id };
  const crisis = item.reports?.crisis;
  const btn = "rounded-full border px-3 py-1 text-xs transition disabled:opacity-40";

  return (
    <article className={`glass rounded-2xl p-4 ${crisis ? "ring-1 ring-rose/60 shadow-[0_0_40px_-12px_var(--rose)]" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {crisis && <span className="rounded-full bg-rose/20 px-2 py-0.5 font-semibold text-rose">⚠ CRISIS</span>}
        <span className="rounded-full bg-white/5 px-2 py-0.5">{item.type}</span>
        <span className="font-mono">/{item.community}</span>
        <span className="font-mono">{item.author}</span>
        {item.author_banned && <span className="rounded-full bg-rose/15 px-2 py-0.5 text-rose">banned</span>}
        {item.hidden && <span className="rounded-full bg-lime/15 px-2 py-0.5 text-lime">hidden</span>}
        <span>▲ {item.score}</span>
        <span>{when(item.created_at)}</span>
      </div>
      {item.reports && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold">{item.reports.count} report{item.reports.count === 1 ? "" : "s"}:</span>
          {item.reports.reasons.map((r) => (
            <span key={r} className={`rounded-full px-2 py-0.5 ${r === "crisis" ? "bg-rose/20 text-rose" : "bg-white/5"}`}>
              {REASON_LABEL[r] ?? r}
            </span>
          ))}
        </div>
      )}
      {item.title && <h3 className="mt-3 font-semibold">{item.title}</h3>}
      {item.body && <p className="mt-1.5 max-h-48 overflow-auto whitespace-pre-line text-sm text-ink/85">{item.body}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!item.hidden && (
          <Link href={`/app/c/${item.community}/${item.post_id}`} target="_blank" className={`${btn} border-line text-muted hover:text-ink`}>
            Open thread ↗
          </Link>
        )}
        {item.hidden && (
          <button onClick={() => run({ action: "restore", ...target }, "Restored")} disabled={!!busy} className={`${btn} border-mint/50 text-mint hover:bg-mint/10`}>
            Restore
          </button>
        )}
        {item.reports && !item.hidden && (
          <button onClick={() => run({ action: "dismiss", ...target }, "Reports dismissed")} disabled={!!busy} className={`${btn} border-line hover:bg-white/5`}>
            Dismiss reports
          </button>
        )}
        <button
          onClick={() => run({ action: "remove", ...target }, "Removed", "Remove this permanently? Replies and votes go with it.")}
          disabled={!!busy}
          className={`${btn} border-rose/50 text-rose hover:bg-rose/10`}
        >
          Remove
        </button>
        {!item.author_banned && item.author !== "Lull team" && (
          <button onClick={() => setBanning((v) => !v)} disabled={!!busy} className={`${btn} border-rose/30 text-rose/80 hover:bg-rose/10`}>
            Ban author…
          </button>
        )}
        <button
          onClick={() => run({ action: "resources", post_id: item.post_id }, "Resources reply posted")}
          disabled={!!busy}
          className={`${btn} ${crisis ? "border-mint bg-mint/15 text-mint" : "border-line text-muted hover:text-ink"}`}
        >
          💙 Reply with help resources
        </button>
      </div>

      {banning && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] p-3 text-xs">
          <span className="text-muted">Ban {item.author} for</span>
          <select value={duration} onChange={(e) => setDuration(e.target.value as BanDuration)} className="rounded-lg border border-line bg-bg px-2 py-1">
            {(Object.keys(BAN_DURATIONS) as BanDuration[]).map((d) => (
              <option key={d} value={d}>
                {d === "permanent" ? "permanently" : d.replace("d", " days")}
              </option>
            ))}
          </select>
          <span className="text-muted">for</span>
          <select value={reason} onChange={(e) => setReason(e.target.value as BanReason)} className="rounded-lg border border-line bg-bg px-2 py-1">
            {BAN_REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setBanning(false);
              run({ action: "ban", ...target, duration, reason }, `Banned ${item.author}`);
            }}
            className={`${btn} border-rose/60 bg-rose/15 text-rose`}
          >
            Confirm ban
          </button>
        </div>
      )}
    </article>
  );
}
