"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/locale-provider";

export function GuestNote({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 text-sm">
      <span className="text-muted">{children}</span>
      <Link href="/login?mode=signup" className="rounded-full bg-mint px-4 py-1.5 text-xs font-semibold text-bg">
        {t.tools.guestNote.cta}
      </Link>
    </div>
  );
}
