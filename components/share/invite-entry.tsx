"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/locale-provider";

/** The way into share cards and buddy invites (FR10), shown where progress is visible. */
export function InviteEntry() {
  const v = useT().invite;
  return (
    <Link href="/app/invite" className="glass group flex items-center justify-between gap-4 rounded-3xl p-5 transition hover:bg-white/[0.06]">
      <span className="min-w-0">
        <span className="block font-semibold">{v.entry}</span>
        <span className="mt-0.5 block text-sm text-muted">{v.entryHint}</span>
      </span>
      <span aria-hidden className="shrink-0 text-lg text-muted transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
    </Link>
  );
}
