"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/locale-provider";

/** The way into the doctor report (FR10) from the places a user is already thinking about their doctor. */
export function ReportEntry() {
  const r = useT().report;
  return (
    <Link href="/app/report" className="glass group flex items-center justify-between gap-4 rounded-3xl p-5 transition hover:bg-white/[0.06]">
      <span className="min-w-0">
        <span className="block font-semibold">{r.entry}</span>
        <span className="mt-0.5 block text-sm text-muted">{r.entryHint}</span>
      </span>
      <span aria-hidden className="shrink-0 text-lg text-muted transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
    </Link>
  );
}
