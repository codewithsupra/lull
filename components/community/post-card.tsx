"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { VoteButton } from "./vote-button";
import { ago, aliasFor, type PostSummary } from "@/lib/community";
import { fmt, plural } from "@/lib/i18n";

export function PostCard({ post, showCommunity = true }: { post: PostSummary; showCommunity?: boolean }) {
  const { t } = useI18n();
  const c = t.community;
  // Stamped once at mount: relative times don't need to tick, and render stays pure.
  const [now] = useState(() => Date.now());
  const href = `/app/c/${post.community}/${post.id}`;
  return (
    <article className="glass rounded-2xl p-4 transition hover:bg-white/[0.05] sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {showCommunity && (
          <Link href={`/app/c/${post.community}`} className="font-mono text-ink/80 hover:text-mint">
            /{post.community}
          </Link>
        )}
        <span className="rounded-full bg-white/5 px-2 py-0.5">{c.flairs[post.flair]}</span>
        <span>
          {aliasFor(post.alias, c.alias)}
          {post.mine && <span className="text-mint"> ({c.you})</span>} · {ago(post.created_at, now, c.ago)}
        </span>
      </div>
      <Link href={href} className="mt-2 block">
        <h3 className="text-[17px] font-semibold leading-snug">{post.title}</h3>
        {post.body && <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm text-muted">{post.body}</p>}
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <VoteButton type="post" id={post.id} score={post.score} voted={post.voted} disabled={post.mine} />
        <Link href={href} className="text-xs text-muted hover:text-ink">
          💬 {fmt(plural(post.comment_count, c.comments), { n: post.comment_count })}
        </Link>
      </div>
    </article>
  );
}
