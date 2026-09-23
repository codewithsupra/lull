"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/insforge/server";
import { PaywallHost } from "@/components/billing/paywall-host";
import { fetchBilling } from "@/lib/billing-client";
import { CrisisSheet } from "@/components/crisis/crisis-sheet";
import { clearSafetyCache, openCrisis } from "@/lib/safety-client";

const NAV = [
  { href: "/app", label: "Today", key: "T", icon: "◐" },
  { href: "/app/plan", label: "Plan", key: "P", icon: "❀" },
  { href: "/app/talk", label: "Talk", key: "K", icon: "◍" },
  { href: "/app/compose", label: "Compose", key: "C", icon: "✦" },
  { href: "/app/breathe", label: "Breathe", key: "B", icon: "◎" },
  { href: "/app/sounds", label: "Sounds", key: "S", icon: "∿" },
  { href: "/app/journal", label: "Journal", key: "J", icon: "▤" },
];

export function AppShell({ user, children }: { user: SessionUser | null; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      const hit = NAV.find((n) => n.key.toLowerCase() === e.key.toLowerCase());
      if (hit) router.push(hit.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const [pro, setPro] = useState<boolean | null>(null);
  useEffect(() => {
    // Registered for everyone so the offline crisis page is always available.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (!user) clearSafetyCache();
  }, [user]);
  useEffect(() => {
    if (!user) return;
    fetchBilling()
      .then((b) => setPro(!!b.plan?.pro))
      .catch(() => {});
  }, [user, pathname]);

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <div className="relative min-h-dvh">
      {/* ambient aurora */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute -left-[20%] -top-[30%] h-[70vmax] w-[70vmax] animate-[spin_80s_linear_infinite] rounded-full bg-[conic-gradient(from_90deg,rgba(142,245,212,0.14),rgba(106,166,255,0.1),rgba(183,157,255,0.14),transparent,rgba(142,245,212,0.14))] blur-[100px]" />
        <div className="absolute -bottom-[40%] -right-[20%] h-[60vmax] w-[60vmax] animate-[spin_120s_linear_infinite_reverse] rounded-full bg-[conic-gradient(from_0deg,rgba(183,157,255,0.12),transparent,rgba(106,166,255,0.12),transparent)] blur-[110px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-bg/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="wordmark text-2xl">lull</Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`group flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition ${
                  isActive(n.href) ? "bg-white/10 text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {n.label}
                <span className="font-mono text-[10px] text-faint group-hover:text-lime">{n.key}</span>
              </Link>
            ))}
          </nav>
          <button
            onClick={openCrisis}
            className="rounded-full border border-rose/50 px-3 py-1 text-xs font-semibold text-rose transition hover:bg-rose/10"
            aria-label="Get help now"
          >
            Help now
          </button>
          {user ? (
            <form action={signOut} className="flex items-center gap-3">
              {pro === false && (
                <Link href="/app/pro" className="rounded-full bg-lime px-3 py-1 text-xs font-semibold text-bg shadow-[0_0_24px_-6px_var(--lime)]">
                  Go Pro
                </Link>
              )}
              {pro && <span className="rounded-full border border-lime/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-lime">pro</span>}
              <span className="hidden max-w-[160px] truncate text-xs text-muted sm:inline">{user.name ?? user.email}</span>
              <button className="kbd">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="kbd">[L] Log in</Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6 md:pb-16">{children}</main>
      <PaywallHost />
      <CrisisSheet />

      {/* mobile tab bar */}
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-7 rounded-2xl border border-white/10 bg-bg/80 p-1.5 backdrop-blur-xl md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[9px] transition ${
              isActive(n.href) ? "bg-white/10 text-ink" : "text-muted"
            }`}
          >
            <span className="text-base leading-none">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
