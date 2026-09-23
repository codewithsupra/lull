"use client";

const LINES = [
  { region: "United States", how: "Call or text 988", href: "tel:988" },
  { region: "India", how: "Tele-MANAS 14416", href: "tel:14416" },
  { region: "United Kingdom & Ireland", how: "Samaritans 116 123", href: "tel:116123" },
  { region: "Anywhere else", how: "findahelpline.com", href: "https://findahelpline.com" },
];

export function CrisisCard({ onContinue, message }: { onContinue: () => void; message?: string | null }) {
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="crisis-title" className="fixed inset-0 z-[70] grid place-items-center bg-bg/85 p-4 backdrop-blur-xl">
      <div className="glass w-full max-w-md rounded-3xl p-7">
        <p className="mono-label !text-rose">you matter</p>
        <h2 id="crisis-title" className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
          It sounds like things are really heavy.
        </h2>
        <p className="mt-3 text-sm text-muted">
          {message ??
            "If you're thinking about hurting yourself or feel unsafe, please reach out to someone right now. You don't have to carry this alone."}
        </p>
        <ul className="mt-5 space-y-2">
          {LINES.map((l) => (
            <li key={l.region}>
              <a href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm transition hover:border-rose/40">
                <span className="text-muted">{l.region}</span>
                <span className="font-semibold text-ink">{l.how}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-faint">In immediate danger, call your local emergency number.</p>
        <button onClick={onContinue} className="mt-6 w-full rounded-xl border border-white/15 py-3 text-sm text-muted transition hover:text-ink">
          I&apos;m safe right now. Continue
        </button>
      </div>
    </div>
  );
}
