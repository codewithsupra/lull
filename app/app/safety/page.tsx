"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/app/user-context";
import { countryOptions, crisisLinesFor } from "@/lib/crisis";
import { EMPTY_PLAN, SECTIONS, completedSections, isUsable, type Contact, type SafetyPlan } from "@/lib/safety";
import { fetchSafety, openCrisis, saveSafety } from "@/lib/safety-client";
import { useI18n } from "@/components/i18n/locale-provider";
import { fmt } from "@/lib/i18n";

export default function SafetyPage() {
  const user = useUser();
  const { t, tag } = useI18n();
  const s = t.safety;
  const [plan, setPlan] = useState<SafetyPlan>(EMPTY_PLAN);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchSafety()
      .then((s) => {
        if (s.plan) setPlan(s.plan);
        else if (s.country) setPlan((p) => ({ ...p, country: s.country }));
        setSavedAt(s.updated_at);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveSafety(plan);
      setSavedAt(saved.updated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="mono-label !text-rose">{s.label}</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">{s.guestHeading}</h1>
        <p className="mt-4 text-muted">{s.guestBody}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login?mode=signup" className="rounded-full bg-mint px-6 py-3 text-sm font-semibold text-bg">
            {t.common.signUp}
          </Link>
          <button onClick={openCrisis} className="rounded-full border border-rose/50 px-6 py-3 text-sm text-rose">
            {s.needHelpNow}
          </button>
        </div>
      </div>
    );
  }

  const done = completedSections(plan);
  const { region } = crisisLinesFor(plan.country);

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <header>
        <p className="mono-label !text-rose">{s.labelPrivate}</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">{s.heading}</h1>
        <p className="mt-3 text-muted">
          {s.introBefore}
          <button onClick={openCrisis} className="mx-1 rounded-full border border-rose/40 px-2 py-0.5 text-xs text-rose">{t.common.helpNow}</button>
          {s.introAfter}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-rose via-mint to-lime transition-all duration-500" style={{ width: `${(done / SECTIONS.length) * 100}%` }} />
          </div>
          <span className="font-mono text-[11px] text-muted">{fmt(s.sectionCount, { done, total: SECTIONS.length })}</span>
        </div>
        {isUsable(plan) && <p className="mt-2 text-xs text-mint">{s.usable}</p>}
      </header>

      {!loaded && <p className="shimmer-text font-mono text-xs uppercase tracking-[0.2em]">{s.opening}</p>}

      {SECTIONS.map((section) => {
        const copy = s.sections[section.id];
        return (
          <section key={section.id} className="glass rounded-3xl p-6">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">{copy.title}</h2>
            <p className="mt-1 text-sm text-muted">{copy.help}</p>
            {section.contacts ? (
              <ContactList
                items={plan[section.id] as Contact[]}
                placeholder={copy.placeholder}
                labels={s}
                onChange={(items) => setPlan((p) => ({ ...p, [section.id]: items }))}
              />
            ) : (
              <LineList
                items={plan[section.id] as string[]}
                placeholder={copy.placeholder}
                labels={s}
                onChange={(items) => setPlan((p) => ({ ...p, [section.id]: items }))}
              />
            )}
          </section>
        );
      })}

      <section className="glass rounded-3xl p-6">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">{s.where.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {fmt(s.where.help, { region: region.country === "XX" ? s.where.notSet : t.crisis.countries[region.country] })}
        </p>
        <select
          value={plan.country ?? ""}
          onChange={(e) => setPlan((p) => ({ ...p, country: e.target.value || null }))}
          className="field mt-3 w-full"
          aria-label={s.where.countryLabel}
        >
          <option value="">{t.crisis.somewhereElse}</option>
          {countryOptions(t, tag).map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>}

      <div className="sticky bottom-20 z-20 flex flex-wrap items-center gap-4 md:bottom-4">
        <button onClick={save} disabled={saving} className="rounded-full bg-ink px-7 py-3 text-sm font-semibold text-bg shadow-[0_0_40px_-8px_rgba(142,245,212,0.8)] disabled:opacity-60">
          {saving ? t.common.saving : s.saveCta}
        </button>
        {savedAt && <span className="font-mono text-[11px] text-muted">{fmt(s.savedAt, { when: new Date(savedAt).toLocaleString(tag) })}</span>}
      </div>

      <p className="text-xs text-faint">{s.footer}</p>
    </div>
  );
}

type SafetyLabels = { add: string; remove: string; removeLabel: string; nameLabel: string; phoneLabel: string; phonePlaceholder: string };

function LineList({ items, placeholder, labels, onChange }: { items: string[]; placeholder: string; labels: SafetyLabels; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.length >= 8) return;
    onChange([...items, v.slice(0, 160)]);
    setDraft("");
  };
  return (
    <div className="mt-4">
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={`${item}-${i}`} className="group flex items-center gap-3 rounded-xl border border-white/10 px-4 py-2.5 text-sm">
            <span className="flex-1">{item}</span>
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="font-mono text-[10px] text-faint opacity-0 transition group-hover:opacity-100 hover:text-rose"
              aria-label={fmt(labels.removeLabel, { item })}
            >
              {labels.remove}
            </button>
          </li>
        ))}
      </ul>
      {items.length < 8 && (
        <div className="mt-2 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="field flex-1"
            aria-label={placeholder}
          />
          <button onClick={add} disabled={!draft.trim()} className="rounded-xl border border-white/15 px-4 text-sm disabled:opacity-40">
            {labels.add}
          </button>
        </div>
      )}
    </div>
  );
}

function ContactList({ items, placeholder, labels, onChange }: { items: Contact[]; placeholder: string; labels: SafetyLabels; onChange: (v: Contact[]) => void }) {
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const add = () => {
    const l = label.trim();
    if (!l || items.length >= 6) return;
    onChange([...items, { label: l.slice(0, 60), phone: phone.replace(/[^+0-9 ()-]/g, "").slice(0, 24) }]);
    setLabel("");
    setPhone("");
  };
  return (
    <div className="mt-4">
      <ul className="space-y-2">
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="group flex items-center gap-3 rounded-xl border border-white/10 px-4 py-2.5 text-sm">
            <span className="flex-1">
              {c.label}
              {c.phone && <span className="ml-2 font-mono text-xs text-mint">{c.phone}</span>}
            </span>
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="font-mono text-[10px] text-faint opacity-0 transition group-hover:opacity-100 hover:text-rose"
              aria-label={fmt(labels.removeLabel, { item: c.label })}
            >
              {labels.remove}
            </button>
          </li>
        ))}
      </ul>
      {items.length < 6 && (
        <div className="mt-2 grid gap-2 sm:grid-cols-[1.3fr_1fr_auto]">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={placeholder} className="field" aria-label={labels.nameLabel} />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={labels.phonePlaceholder}
            inputMode="tel"
            className="field"
            aria-label={labels.phoneLabel}
          />
          <button onClick={add} disabled={!label.trim()} className="rounded-xl border border-white/15 px-4 text-sm disabled:opacity-40">
            {labels.add}
          </button>
        </div>
      )}
    </div>
  );
}
