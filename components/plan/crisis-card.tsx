"use client";

import { useI18n } from "@/components/i18n/locale-provider";

const LINES = [
  { key: "us", href: "tel:988" },
  { key: "in", href: "tel:14416" },
  { key: "uk", href: "tel:116123" },
  { key: "other", href: "https://findahelpline.com" },
] as const;

export function CrisisCard({ onContinue, message }: { onContinue: () => void; message?: string | null }) {
  const { t } = useI18n();
  const c = t.app.crisisCard;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="crisis-title" className="fixed inset-0 z-[70] grid place-items-center bg-bg/85 p-4 backdrop-blur-xl">
      <div className="glass w-full max-w-md rounded-3xl p-7">
        <p className="mono-label !text-rose">{c.label}</p>
        <h2 id="crisis-title" className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
          {c.heading}
        </h2>
        <p className="mt-3 text-sm text-muted">
          {message ?? c.body}
        </p>
        <ul className="mt-5 space-y-2">
          {LINES.map((l) => (
            <li key={l.key}>
              <a href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:border-rose/40">
                <span className="text-muted">{c.regions[l.key]}</span>
                <span className="font-semibold text-ink">{c.lines[l.key]}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-faint">{c.danger}</p>
        <button onClick={onContinue} className="mt-6 w-full rounded-xl border border-white/15 py-3 text-sm text-muted transition hover:text-ink">
          {c.continue}
        </button>
      </div>
    </div>
  );
}
