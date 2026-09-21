"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SITE } from "@/lib/site";

const LINKS = [
  { key: "B", label: "Breathe", href: "/app/breathe" },
  { key: "S", label: "Sounds", href: "/app/sounds" },
  { key: "C", label: "Compose", href: "/app/compose" },
  { key: "G", label: "GitHub", href: SITE.github, external: true },
  { key: "L", label: "Log in", href: "/login" },
];

export function TopNav({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const links = LINKS.map((l) => (l.key === "L" && signedIn ? { ...l, label: "Open app", href: "/app" } : l));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]")) return;
      const hit = links.find((l) => l.key.toLowerCase() === e.key.toLowerCase());
      if (!hit) return;
      if (hit.external) window.open(hit.href, "_blank", "noopener");
      else router.push(hit.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [links, router]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-bg/90 via-bg/50 to-transparent">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="wordmark text-2xl">lull</span>
          <span className="mono-label hidden md:inline">scroll or press a key ↘</span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2">
          {links.map((l) =>
            l.external ? (
              <a key={l.key} href={l.href} target="_blank" rel="noreferrer" className="kbd hidden sm:inline-block">
                [{l.key}] {l.label}
              </a>
            ) : (
              <Link key={l.key} href={l.href} className={`kbd ${l.key === "L" ? "" : "hidden sm:inline-block"}`}>
                [{l.key}] {l.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
