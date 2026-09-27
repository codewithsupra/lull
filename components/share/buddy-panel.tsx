"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/locale-provider";
import { BUDDY_ACTIVE_DAYS, BUDDY_DAYS, BUDDY_MAX_REWARDS, formatCode, type BuddyView } from "@/lib/buddy";
import { fmt } from "@/lib/i18n";

/** Buddy invites (FR10). Shows reward status only — never a friend's activity. */
export function BuddyPanel({ buddy, fmtDate }: { buddy: BuddyView; fmtDate: (iso: string) => string }) {
  const { t } = useI18n();
  const b = t.invite.buddy;
  const [copied, setCopied] = useState(false);
  const vars = { active: BUDDY_ACTIVE_DAYS, days: BUDDY_DAYS };

  const copy = async () => {
    await navigator.clipboard.writeText(buddy.url).then(() => setCopied(true)).catch(() => undefined);
  };
  const shareInvite = async () => {
    const text = fmt(b.shareText, { ...vars, url: buddy.url });
    if (navigator.share) await navigator.share({ text }).catch(() => undefined);
    else await copy();
  };

  return (
    <section className="glass space-y-5 rounded-3xl p-6">
      <div>
        <h2 className="text-lg font-semibold">{b.heading}</h2>
        <p className="mt-1 text-sm text-muted">{fmt(b.how, vars)}</p>
        <p className="mt-2 text-xs text-faint">{b.privacy}</p>
      </div>

      <div>
        <p className="text-sm font-medium">{b.yourLink}</p>
        <p className="mt-1.5 break-all rounded-xl bg-black/30 px-3 py-2 font-mono text-sm">{buddy.url}</p>
        <p className="mt-1 font-mono text-xs text-faint">{formatCode(buddy.code)}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={shareInvite} className="flex-1 rounded-full bg-mint py-2.5 text-sm font-semibold text-bg">
            {b.shareInvite}
          </button>
          <button onClick={copy} className="flex-1 rounded-full border border-line py-2.5 text-sm">
            {copied ? b.copied : b.copy}
          </button>
        </div>
      </div>

      {buddy.joined && (
        <div className="rounded-2xl border border-line p-4">
          <p className="text-sm font-medium">{b.joinedHeading}</p>
          <p className={`mt-1 text-sm ${buddy.joined.rewarded ? "text-mint" : "text-muted"}`}>
            {buddy.joined.rewarded ? fmt(b.joinedRewarded, vars) : fmt(b.joinedProgress, { ...vars, done: buddy.joined.active_days })}
          </p>
          {!buddy.joined.rewarded && (
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: BUDDY_ACTIVE_DAYS }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < buddy.joined!.active_days ? "bg-mint" : "bg-white/10"}`} />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-medium">{b.invitedHeading}</p>
        {buddy.invited.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{b.noneInvited}</p>
        ) : (
          <ul className="mt-2 divide-y divide-white/5 text-sm">
            {buddy.invited.map((i) => (
              <li key={i.joined_at} className="flex items-center justify-between gap-3 py-2">
                <span className="text-muted">{fmt(b.joinedOn, { date: fmtDate(i.joined_at) })}</span>
                <span className={i.rewarded ? "text-mint" : "text-faint"}>{i.rewarded ? fmt(b.rewarded, vars) : fmt(b.pending, vars)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-faint">{fmt(b.rewardsUsed, { n: Math.min(buddy.rewards_received, BUDDY_MAX_REWARDS), max: BUDDY_MAX_REWARDS })}</p>
      </div>
    </section>
  );
}
