"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, LOCALE_META } from "@/lib/i18n";
import { setLocale, useI18n } from "@/components/i18n/locale-provider";

/**
 * Language picker. Each option is written in its own language — someone looking for Hindi should
 * not have to read English to find it.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full border border-white/12 px-3 py-1 text-xs text-muted transition hover:border-white/25 hover:text-ink"
        aria-label={t.common.languageLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {LOCALE_META[locale].native}
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t.common.languageLabel}
          className="absolute right-0 z-50 mt-2 min-w-[140px] overflow-hidden rounded-2xl border border-white/10 bg-bg/95 p-1 backdrop-blur-xl"
        >
          {LOCALES.map((code) => (
            <li key={code} role="option" aria-selected={code === locale}>
              <button
                onClick={() => (code === locale ? setOpen(false) : setLocale(code))}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  code === locale ? "bg-white/10 text-ink" : "text-muted hover:bg-white/5 hover:text-ink"
                }`}
                lang={LOCALE_META[code].tag}
              >
                {LOCALE_META[code].native}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
