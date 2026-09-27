"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { vote } from "@/lib/community-client";

/** Optimistic upvote toggle. Your own posts can't be upvoted (the server refuses too). */
export function VoteButton({ type, id, score, voted, disabled }: { type: "post" | "comment"; id: string; score: number; voted: boolean; disabled?: boolean }) {
  const c = useT().community;
  const [state, setState] = useState({ score, voted });
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy || disabled) return;
    const prev = state;
    setBusy(true);
    setState({ score: prev.score + (prev.voted ? -1 : 1), voted: !prev.voted });
    const res = await vote(type, id);
    if (res.ok && typeof res.json.score === "number") setState({ score: res.json.score as number, voted: !!res.json.voted });
    else setState(prev);
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={state.voted}
      aria-label={c.upvote}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs tabular-nums transition ${
        state.voted ? "border-mint/60 bg-mint/15 text-mint" : "border-line text-muted hover:text-ink"
      } disabled:cursor-default disabled:opacity-60`}
    >
      <span aria-hidden>▲</span>
      {state.score}
    </button>
  );
}
