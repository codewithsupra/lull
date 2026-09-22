"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { COUNTRY_OPTIONS, crisisLinesFor, lineHref } from "@/lib/crisis";
import { fetchSafety, onCrisis, readCachedSafety, type CachedSafety } from "@/lib/safety-client";

/**
 * Always-available crisis sheet. Opens instantly from the device cache (works offline),
 * then refreshes from the server. Never gated by plan or paywall.
 */
export function CrisisSheet() {
  const [open, setOpen] = useState(false);
  // Read the device cache during initialisation so the sheet has content instantly, even offline.
  const [safety, setSafety] = useState<CachedSafety>(() => (typeof window === "undefined" ? { plan: null, country: null, updated_at: null } : readCachedSafety()));
  const [country, setCountry] = useState<string | null>(() => (typeof window === "undefined" ? null : readCachedSafety().country));
  const [picking, setPicking] = useState(false);

  useEffect(() => onCrisis(() => setOpen(true)), []);

  useEffect(() => {
    if (!open) return;
    fetchSafety()
      .then((s) => {
        setSafety(s);
        setCountry((c) => c ?? s.country);
      })
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const { region, lines } = crisisLinesFor(country);
  const plan = safety.plan;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] overflow-y-auto bg-bg/95 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Get help now"
        >
          <div className="mx-auto max-w-2xl px-5 pb-20 pt-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mono-label !text-rose">you don&apos;t have to handle this alone</p>
                <h2 className="mt-2 font-[family-name:var(--font-unbounded)] text-3xl font-semibold leading-tight">Help, right now.</h2>
              </div>
              <button onClick={() => setOpen(false)} className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm text-muted hover:text-ink">
                Close
              </button>
            </div>

            {region.country !== "XX" ? (
              <a href={`tel:${region.emergency.replace(/\D/g, "")}`} className="mt-6 block rounded-2xl border border-rose/40 bg-rose/10 px-5 py-4">
                <span className="text-sm text-muted">In immediate danger · {region.label}</span>
                <span className="mt-1 block font-[family-name:var(--font-unbounded)] text-2xl font-semibold text-rose">Call {region.emergency}</span>
              </a>
            ) : (
              <p className="mt-6 rounded-2xl border border-rose/30 bg-rose/10 px-5 py-4 text-sm">In immediate danger, call your local emergency number.</p>
            )}

            <p className="mono-label mt-8">Talk to someone free, 24/7</p>
            <ul className="mt-3 space-y-2">
              {lines.map((l) => (
                <li key={l.name}>
                  <a
                    href={lineHref(l)}
                    target={l.url ? "_blank" : undefined}
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-5 py-4 transition hover:border-mint/40 hover:bg-mint/[0.04]"
                  >
                    <span>
                      <span className="block font-semibold">{l.number ?? "findahelpline.com"}</span>
                      <span className="block text-sm text-muted">{l.name}</span>
                      {l.note && <span className="block text-xs text-faint">{l.note}</span>}
                    </span>
                    <span className="shrink-0 text-mint">{l.text ? "text →" : l.url ? "open →" : "call →"}</span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-3 text-center">
              {picking ? (
                <select
                  autoFocus
                  value={country ?? ""}
                  onChange={(e) => {
                    setCountry(e.target.value || null);
                    setPicking(false);
                  }}
                  className="field"
                  aria-label="Choose your country"
                >
                  <option value="">Somewhere else</option>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : (
                <button onClick={() => setPicking(true)} className="font-mono text-[11px] text-muted underline decoration-white/20 hover:text-ink">
                  {region.country === "XX" ? "choose your country" : `not in ${region.label}? change country`}
                </button>
              )}
            </div>

            {plan ? (
              <div className="mt-10 space-y-5">
                <p className="mono-label">Your safety plan</p>
                {plan.coping.length > 0 && <PlanBlock title="Things that have helped before" items={plan.coping} />}
                {plan.people.length > 0 && (
                  <div>
                    <p className="text-sm text-muted">People I can reach out to</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {plan.people.map((p) =>
                        p.phone ? (
                          <a key={p.label} href={`tel:${p.phone.replace(/[^+0-9]/g, "")}`} className="rounded-full border border-mint/40 px-4 py-2 text-sm text-mint">
                            Call {p.label} →
                          </a>
                        ) : (
                          <span key={p.label} className="rounded-full border border-white/10 px-4 py-2 text-sm">
                            {p.label}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
                {plan.professionals.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {plan.professionals.map((p) =>
                      p.phone ? (
                        <a key={p.label} href={`tel:${p.phone.replace(/[^+0-9]/g, "")}`} className="rounded-full border border-sky/40 px-4 py-2 text-sm text-sky">
                          Call {p.label} →
                        </a>
                      ) : (
                        <span key={p.label} className="rounded-full border border-white/10 px-4 py-2 text-sm">
                          {p.label}
                        </span>
                      ),
                    )}
                  </div>
                )}
                {plan.reasons.length > 0 && <PlanBlock title="My reasons to keep going" items={plan.reasons} accent />}
                {plan.distractions.length > 0 && <PlanBlock title="Places and people that shift my mind" items={plan.distractions} />}
                {plan.safer.length > 0 && <PlanBlock title="Making my space safer" items={plan.safer} />}
                <Link href="/app/safety" onClick={() => setOpen(false)} className="inline-block font-mono text-[11px] text-muted underline decoration-white/20 hover:text-ink">
                  edit my safety plan
                </Link>
              </div>
            ) : (
              <div className="glass mt-10 rounded-3xl p-6">
                <p className="mono-label">Make the next hard moment easier</p>
                <p className="mt-2 text-sm text-muted">
                  A safety plan is a short list you write while you&apos;re calm: what helps, who to call, and why you keep going. It takes 5 minutes and it&apos;s here whenever you need it, even offline.
                </p>
                <Link href="/app/safety" onClick={() => setOpen(false)} className="mt-4 inline-block rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-bg">
                  Create my safety plan
                </Link>
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/app/breathe?pattern=sigh&minutes=1" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-5 py-2.5 text-sm">
                Breathe with me for 60 seconds
              </Link>
              <Link href="/app/sounds?preset=low-tide" onClick={() => setOpen(false)} className="rounded-full border border-white/15 px-5 py-2.5 text-sm">
                Put on something calming
              </Link>
            </div>
            <p className="mt-8 text-xs text-faint">Lull is a wellbeing companion, not a medical or emergency service.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PlanBlock({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  return (
    <div>
      <p className="text-sm text-muted">{title}</p>
      <ul className={`mt-2 space-y-1.5 ${accent ? "text-lime" : "text-ink/90"}`}>
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span className="text-faint">·</span>
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
