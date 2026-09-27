"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/locale-provider";

export function Disclaimer() {
  const c = useT().community;
  return <p className="rounded-2xl border border-lime/20 bg-lime/[0.06] px-4 py-3 text-sm text-ink/85">⚕︎ {c.disclaimer}</p>;
}

export function CommunityGuest() {
  const t = useT();
  const c = t.community;
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <p className="mono-label">{c.label}</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">{c.heading}</h1>
      <p className="mt-4 text-muted">{c.intro}</p>
      <p className="mt-2 text-sm text-faint">🔒 {c.anonNote}</p>
      <Link href="/login?mode=signup" className="mt-8 inline-block rounded-full bg-mint px-6 py-3 text-sm font-semibold text-bg">
        {t.common.signUp}
      </Link>
    </div>
  );
}
