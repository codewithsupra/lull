"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { useT } from "@/components/i18n/locale-provider";
import { VoteButton } from "@/components/community/vote-button";
import { CommunityGuest, Disclaimer } from "@/components/community/bits";
import { REPORT_REASONS, ago, aliasFor, threadComments, type CommentView, type PostSummary, type ReportReason } from "@/lib/community";
import { postJson, remove, report } from "@/lib/community-client";
import { fmt, plural } from "@/lib/i18n";

type Thread = { post: PostSummary; comments: CommentView[] };

export default function ThreadPage() {
  const user = useUser();
  const c = useT().community;
  const router = useRouter();
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const load = useCallback(() => {
    fetch(`/api/community/p/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? c.errors.load);
        setThread(json);
        setNow(Date.now());
      })
      .catch((e: Error) => setError(e.message));
  }, [id, c.errors.load]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return <CommunityGuest />;

  const deletePost = async () => {
    if (!thread || !window.confirm(c.deleteConfirm)) return;
    const res = await remove("post", thread.post.id);
    if (res.ok) router.push(`/app/c/${slug}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-4">
      <Link href={`/app/c/${slug}`} className="font-mono text-sm text-muted hover:text-ink">← /{slug}</Link>
      {error && <p className="glass rounded-2xl p-5 text-muted">{error}</p>}
      {!thread && !error && <p className="text-muted">{c.loading}</p>}

      {thread && (
        <>
          <article className="glass rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="rounded-full bg-white/5 px-2 py-0.5">{c.flairs[thread.post.flair]}</span>
              <span>
                {aliasFor(thread.post.alias, c.alias)} <span className="rounded bg-sky/15 px-1 text-[10px] font-semibold text-sky">{c.op}</span>
                {thread.post.mine && <span className="text-mint"> ({c.you})</span>} · {ago(thread.post.created_at, now, c.ago)}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-snug">{thread.post.title}</h1>
            {thread.post.body && <p className="mt-3 whitespace-pre-line leading-relaxed text-ink/90">{thread.post.body}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <VoteButton type="post" id={thread.post.id} score={thread.post.score} voted={thread.post.voted} disabled={thread.post.mine} />
              <span className="text-xs text-muted">💬 {fmt(plural(thread.post.comment_count, c.comments), { n: thread.post.comment_count })}</span>
              <span className="ml-auto">
                {thread.post.mine ? (
                  <button onClick={deletePost} className="text-xs text-muted hover:text-rose">{c.delete}</button>
                ) : (
                  <ReportMenu type="post" id={thread.post.id} />
                )}
              </span>
            </div>
          </article>
          <Disclaimer />

          <CommentBox postId={thread.post.id} onPosted={load} />

          <section className="space-y-3">
            {thread.comments.length === 0 && <p className="text-sm text-muted">{c.noComments}</p>}
            {threadComments(thread.comments).map((cm) => (
              <div key={cm.id} className="glass rounded-2xl p-4">
                <Comment comment={cm} now={now} postId={thread.post.id} onChanged={load} />
                {cm.replies.length > 0 && (
                  <div className="mt-3 space-y-3 border-l border-white/10 pl-4">
                    {cm.replies.map((r) => (
                      <Comment key={r.id} comment={r} now={now} postId={thread.post.id} onChanged={load} replyTo={cm.id} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Comment({ comment, now, postId, onChanged, replyTo }: { comment: CommentView; now: number; postId: string; onChanged: () => void; replyTo?: string }) {
  const c = useT().community;
  const [replying, setReplying] = useState(false);
  const del = async () => {
    if (!window.confirm(c.deleteConfirm)) return;
    if ((await remove("comment", comment.id)).ok) onChanged();
  };
  return (
    <div>
      <p className="text-xs text-muted">
        {aliasFor(comment.alias, c.alias)}
        {comment.op && <span className="ml-1 rounded bg-sky/15 px-1 text-[10px] font-semibold text-sky">{c.op}</span>}
        {comment.mine && <span className="text-mint"> ({c.you})</span>} · {ago(comment.created_at, now, c.ago)}
      </p>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed">{comment.body}</p>
      <div className="mt-2 flex items-center gap-3">
        <VoteButton type="comment" id={comment.id} score={comment.score} voted={comment.voted} disabled={comment.mine} />
        <button onClick={() => setReplying((v) => !v)} className="text-xs text-muted hover:text-ink">{c.reply}</button>
        <span className="ml-auto">
          {comment.mine ? <button onClick={del} className="text-xs text-muted hover:text-rose">{c.delete}</button> : <ReportMenu type="comment" id={comment.id} />}
        </span>
      </div>
      {replying && (
        <div className="mt-3">
          <CommentBox
            postId={postId}
            parentId={replyTo ?? comment.id}
            reply
            onPosted={() => {
              setReplying(false);
              onChanged();
            }}
          />
        </div>
      )}
    </div>
  );
}

function CommentBox({ postId, parentId, reply, onPosted }: { postId: string; parentId?: string; reply?: boolean; onPosted: () => void }) {
  const c = useT().community;
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await postJson(`/api/community/p/${postId}`, { body, parent_id: parentId ?? null });
    setBusy(false);
    if (!res.ok) return setError((res.json.error as string) ?? c.errors.saveFailed);
    setBody("");
    onPosted();
  };
  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2500}
        rows={reply ? 2 : 3}
        placeholder={reply ? c.replyPlaceholder : c.commentPlaceholder}
        className="w-full resize-y rounded-xl border border-line bg-white/5 px-3 py-2 text-sm outline-none focus:border-mint/60"
      />
      {error && <p role="alert" className="mt-2 rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-sm">{error}</p>}
      <button onClick={send} disabled={busy || !body.trim()} className="mt-2 rounded-full bg-mint px-4 py-1.5 text-sm font-semibold text-bg disabled:opacity-50">
        {busy ? c.commenting : reply ? c.reply : c.comment}
      </button>
    </div>
  );
}

function ReportMenu({ type, id }: { type: "post" | "comment"; id: string }) {
  const c = useT().community;
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const send = async (reason: ReportReason) => {
    const res = await report(type, id, reason);
    if (res.ok) setDone(true);
    setOpen(false);
  };
  if (done) return <span className="text-xs text-faint">{c.reportThanks}</span>;
  return (
    <span className="relative">
      <button onClick={() => setOpen((v) => !v)} className="text-xs text-muted hover:text-ink">⚑ {c.report}</button>
      {open && (
        <span className="absolute right-0 z-20 mt-2 block w-64 rounded-2xl border border-line bg-bg-2 p-2 shadow-xl">
          <span className="block px-2 py-1 text-xs font-semibold text-muted">{c.reportHeading}</span>
          {REPORT_REASONS.map((r) => (
            <button key={r} onClick={() => send(r)} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
              {c.reportReasons[r]}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
