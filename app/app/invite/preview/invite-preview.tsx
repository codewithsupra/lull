"use client";

import { CardsPanel } from "@/components/share/cards-panel";
import { BuddyPanel } from "@/components/share/buddy-panel";
import type { BuddyView } from "@/lib/buddy";

const BUDDY: BuddyView = {
  code: "K7MQ2XRA",
  url: "https://lull-ai.vercel.app/join/K7MQ2XRA",
  invited: [
    { joined_at: "2026-09-20T10:00:00Z", rewarded: true },
    { joined_at: "2026-09-25T10:00:00Z", rewarded: false },
  ],
  joined: { joined_at: "2026-09-24T10:00:00Z", rewarded: false, active_days: 2 },
  rewards_received: 1,
};

export function InvitePreview() {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 py-4 lg:grid-cols-2">
      <CardsPanel stats={{ streak: 9, xp: 1240, days_tended: 23 }} inviteUrl={BUDDY.url} />
      <BuddyPanel buddy={BUDDY} fmtDate={(iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })} />
    </div>
  );
}
