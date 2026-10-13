import { notFound } from "next/navigation";
import { ModerationClient } from "../moderation-client";
import type { ModDashboard } from "@/lib/moderation";

// Dev-only visual harness with mock data. Never available in production.
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const MOCK: ModDashboard = {
  stats: { open_reports: 6, hidden: 1, active_bans: 1, posts_24h: 14, comments_24h: 52 },
  queue: [
    { type: "post", id: "00000000-0000-4000-8000-000000000002", post_id: "00000000-0000-4000-8000-000000000002", community: "depression", title: "I don't see the point anymore", body: "Every day feels the same. I've stopped taking my meds.", hidden: false, score: 3, created_at: ago(2), author: "#3fa91c02", author_banned: false, reports: { count: 1, crisis: true, reasons: ["crisis"], first: ago(1) } },
    { type: "post", id: "00000000-0000-4000-8000-000000000001", post_id: "00000000-0000-4000-8000-000000000001", community: "alprazolam", title: "Extra pills, cheap", body: "Got a whole strip left over, message me.", hidden: true, score: 0, created_at: ago(6), author: "#b2e0d7aa", author_banned: false, reports: { count: 4, crisis: false, reasons: ["selling", "spam"], first: ago(5) } },
    { type: "comment", id: "00000000-0000-4000-8000-000000000003", post_id: "00000000-0000-4000-8000-000000000004", community: "concerta", title: null, body: "Just double it, 36 is nothing.", hidden: false, score: 1, created_at: ago(9), author: "#77c1e0f3", author_banned: true, reports: { count: 1, crisis: false, reasons: ["harmful_advice"], first: ago(8) } },
  ],
  recent: [],
  bans: [{ key: "7".repeat(64), handle: "#77c1e0f3", until: ago(-24 * 6), reason: "harmful_advice", created_at: ago(24) }],
  log: [
    { action: "ban", target_type: "author", target_id: "#77c1e0f3", note: "7d · harmful_advice", created_at: ago(24) },
    { action: "resources", target_type: "post", target_id: "00000000-0000-4000-8000-000000000009", note: null, created_at: ago(30) },
  ],
};

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ModerationClient mock={MOCK} />;
}
