"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/locale-provider";
import { FLAIRS, normalizeSlug, type Flair } from "@/lib/community";
import { postJson } from "@/lib/community-client";
import { fmt } from "@/lib/i18n";

/**
 * New post. Rules are shown before posting, not after a rejection. A held post comes back with
 * a specific, kind reason; crisis language also opens the crisis sheet (see postJson).
 */
export function Composer({ community, onClose }: { community?: string; onClose: () => void }) {
  const c = useT().community;
  const router = useRouter();
  const [slug, setSlug] = useState(community ?? "");
  const [flair, setFlair] = useState<Flair>("experience");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = normalizeSlug(slug);

  const submit = async () => {
    if (!target) return setError(c.errors.badCommunity);
    if (title.trim().length < 3) return setError(c.errors.invalidPost);
    setBusy(true);
    setError(null);
    const res = await postJson("/api/community", { community: target, title, body, flair });
    setBusy(false);
    if (!res.ok) return setError((res.json.error as string) ?? c.errors.saveFailed);
    router.push(`/app/c/${res.json.community}/${res.json.id}`);
  };

  const input = "w-full rounded-xl border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-mint/60";

  return (
    <section className="glass rounded-3xl border border-mint/25 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{fmt(c.composer.heading, { slug: target ?? "…" })}</h2>
      <p className="mt-1 text-xs text-muted">🔒 {c.anonNote}</p>

      <div className="mt-4 grid gap-4">
        {!community && (
          <label className="block">
            <span className="text-sm font-medium">{c.composer.communityLabel}</span>
            <div className="mt-1.5 flex items-center rounded-xl border border-line bg-white/5 focus-within:border-mint/60">
              <span className="pl-3 font-mono text-sm text-muted">/</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={c.findPlaceholder} maxLength={40} className="w-full bg-transparent px-1 py-2 font-mono text-sm outline-none" />
            </div>
          </label>
        )}
        <div>
          <span className="text-sm font-medium">{c.composer.flairLabel}</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {FLAIRS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFlair(f)}
                className={`rounded-full border px-3 py-1 text-sm ${f === flair ? "border-mint/60 bg-mint/15 text-ink" : "border-line text-muted hover:text-ink"}`}
              >
                {c.flairs[f]}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-sm font-medium">{c.composer.titleLabel}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={c.composer.titlePlaceholder} className={`mt-1.5 ${input}`} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{c.composer.bodyLabel}</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={5} placeholder={c.composer.bodyPlaceholder} className={`mt-1.5 resize-y ${input}`} />
        </label>

        <div className="rounded-2xl bg-white/[0.03] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{c.composer.rulesHeading}</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted">
            {c.composer.rules.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="text-mint">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={submit} disabled={busy} className="flex-1 rounded-full bg-mint py-2.5 text-sm font-semibold text-bg disabled:opacity-60">
            {busy ? c.composer.posting : c.composer.post}
          </button>
          <button onClick={onClose} className="rounded-full border border-line px-5 text-sm">
            {c.composer.cancel}
          </button>
        </div>
      </div>
    </section>
  );
}
