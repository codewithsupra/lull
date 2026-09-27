"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { useT } from "@/components/i18n/locale-provider";
import { Composer } from "@/components/community/composer";
import { PostCard } from "@/components/community/post-card";
import { CommunityGuest, Disclaimer } from "@/components/community/bits";
import { SORTS, type PostSummary, type Sort } from "@/lib/community";
import { fmt } from "@/lib/i18n";

type Listing = { slug: string; exists: boolean; can_create: boolean; posts: PostSummary[] };

export default function CommunityPage() {
  const user = useUser();
  const c = useT().community;
  const { slug } = useParams<{ slug: string }>();
  const [sort, setSort] = useState<Sort>("hot");
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/community/c/${encodeURIComponent(slug)}?sort=${sort}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? c.errors.load);
        setData(json);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [slug, sort, c.errors.load]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return <CommunityGuest />;
  const name = data?.slug ?? slug;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-4">
      <Link href="/app/c" className="text-sm text-muted hover:text-ink">← {c.forYou}</Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">/{name}</h1>
        {(data?.exists || data?.can_create) && (
          <button onClick={() => setComposing(true)} className="rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-bg">
            + {c.newPost}
          </button>
        )}
      </header>
      <Disclaimer />
      {composing && <Composer community={name} onClose={() => setComposing(false)} />}

      {error && <p className="text-rose">{error}</p>}
      {!data && !error && <p className="text-muted">{c.loading}</p>}
      {data && !data.exists && <p className="glass rounded-2xl p-5 text-muted">{data.can_create ? fmt(c.notExists, { slug: name }) : c.cantCreate}</p>}

      {data?.exists && (
        <>
          <div className="flex gap-2">
            {SORTS.map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded-full border px-3 py-1.5 text-sm ${s === sort ? "border-mint/60 bg-mint/15 text-ink" : "border-line text-muted hover:text-ink"}`}
              >
                {c.sorts[s]}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {data.posts.length === 0 ? <p className="text-sm text-muted">{c.empty}</p> : data.posts.map((p) => <PostCard key={p.id} post={p} showCommunity={false} />)}
          </div>
        </>
      )}
    </div>
  );
}
