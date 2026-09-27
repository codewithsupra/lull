"use client";

import { useState } from "react";
import { Composer } from "@/components/community/composer";
import { PostCard } from "@/components/community/post-card";
import { Disclaimer } from "@/components/community/bits";
import type { PostSummary } from "@/lib/community";

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const POSTS: PostSummary[] = [
  { id: "00000000-0000-4000-8000-000000000001", community: "concerta", title: "Concerta is working like magic for me", body: "Three weeks in. Focus at work is finally back and I'm not doom-scrolling at 2am. The 4pm dip is real though, anyone else?", flair: "experience", score: 42, comment_count: 12, created_at: ago(5), alias: [3, 7], mine: false, voted: true },
  { id: "00000000-0000-4000-8000-000000000002", community: "sertraline", title: "Nausea in week one: does it pass?", body: "", flair: "question", score: 17, comment_count: 9, created_at: ago(20), alias: [11, 2], mine: true, voted: false },
  { id: "00000000-0000-4000-8000-000000000003", community: "escitalopram", title: "Escitalopram ne meri anxiety kaafi kam kar di", body: "Pehle hafte thoda chakkar aaya tha, doctor ne kaha normal hai. Ab bahut better hoon.", flair: "side_effects", score: 8, comment_count: 3, created_at: ago(49), alias: [20, 15], mine: false, voted: false },
];

export function CommunityPreview() {
  const [composing, setComposing] = useState(true);
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <Disclaimer />
      {composing && <Composer community="concerta" onClose={() => setComposing(false)} />}
      {POSTS.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
