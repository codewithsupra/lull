"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { useT } from "@/components/i18n/locale-provider";
import { Composer } from "@/components/community/composer";
import { PostCard } from "@/components/community/post-card";
import { CommunityGuest, Disclaimer } from "@/components/community/bits";
import { normalizeSlug, type Feed } from "@/lib/community";
import { fmt, plural } from "@/lib/i18n";

export default function ForYouPage() {
  const user = useUser();
  const c = useT().community;
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState(false);
  const [composing, setComposing] = useState(false);
  const [find, setFind] = useState("");

  const load = useCallback(() => {
    fetch("/api/community")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setFeed(await r.json());
      })
      .catch(() => setError(true));
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return <CommunityGuest />;

  const go = () => {
    const slug = normalizeSlug(find);
    if (slug) router.push(`/app/c/${slug}`);
  };
  const chip = "rounded-full border border-line bg-white/[0.03] px-3 py-1.5 text-sm transition hover:border-mint/50 hover:text-ink";

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="mono-label">{c.label}</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">{c.forYou}</h1>
          <p className="mt-3 text-muted">{c.intro}</p>
        </div>
        <button onClick={() => setComposing(true)} className="rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-bg">
          + {c.newPost}
        </button>
      </header>
      <Disclaimer />
      {composing && <Composer onClose={() => setComposing(false)} />}

      {error && <p className="text-rose">{c.errors.load}</p>}
      {!feed && !error && <p className="text-muted">{c.loading}</p>}

      {feed && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 space-y-3">
            <h2 className="text-lg font-semibold">{c.topWeek}</h2>
            {feed.top.length === 0 ? <p className="text-sm text-muted">{c.noTop}</p> : feed.top.map((p) => <PostCard key={p.id} post={p} />)}
          </section>

          <aside className="space-y-5 lg:order-last">
            <section className="glass rounded-2xl p-5">
              <h2 className="font-semibold">{c.recommended}</h2>
              <p className="mt-1 text-xs text-faint">{c.recommendedHint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {feed.recommended.map((r) => (
                  <Link key={r.slug} href={`/app/c/${r.slug}`} className={chip}>
                    <span className="font-mono">/{r.slug}</span>
                    <span className="ml-1.5 text-xs text-faint">{fmt(plural(r.posts, c.posts), { n: r.posts })}</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="font-semibold">{c.trending}</h2>
              {feed.trending.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{c.noTrending}</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {feed.trending.map((tr, i) => (
                    <li key={tr.slug}>
                      <Link href={`/app/c/${tr.slug}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
                        <span className="flex items-center gap-3">
                          <span className="w-4 text-right font-mono text-xs text-faint">{i + 1}</span>
                          <span className="font-mono text-sm">/{tr.slug}</span>
                        </span>
                        <span className="text-xs text-mint">▲ {fmt(plural(tr.votes, c.votes), { n: tr.votes })}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="glass rounded-2xl p-5">
              <h2 className="font-semibold">{c.find}</h2>
              <div className="mt-3 flex gap-2">
                <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-white/5 focus-within:border-mint/60">
                  <span className="pl-3 font-mono text-sm text-muted">/</span>
                  <input
                    value={find}
                    onChange={(e) => setFind(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && go()}
                    placeholder={c.findPlaceholder}
                    className="w-full min-w-0 bg-transparent px-1 py-2 font-mono text-sm outline-none"
                  />
                </div>
                <button onClick={go} className="rounded-xl border border-line px-3 text-sm">
                  {c.go}
                </button>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted">{c.allCommunities} ({feed.communities.length})</summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {feed.communities.map((s) => (
                    <Link key={s} href={`/app/c/${s}`} className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-xs text-muted hover:text-ink">
                      /{s}
                    </Link>
                  ))}
                </div>
              </details>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
