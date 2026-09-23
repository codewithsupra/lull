"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_META, messagesFor, type Locale, type Messages } from "@/lib/i18n";

type I18n = {
  locale: Locale;
  /** The whole dictionary, dot-accessed: `t.nav.today`. Missing keys are compile errors. */
  t: Messages;
  /** BCP-47 tag for `Intl` and speech APIs. */
  tag: string;
};

const LocaleContext = createContext<I18n | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18n>(() => ({ locale, t: messagesFor(locale), tag: LOCALE_META[locale].tag }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n must be used inside <LocaleProvider>");
  return ctx;
}

/** Shorthand for the common case. */
export const useT = (): Messages => useI18n().t;

/**
 * Switches language. The cookie is the single source of truth, so a full reload re-renders
 * Server Components, metadata and `<html lang>` in the new language with no stale strings.
 * Signed-in users also persist it so notifications and AI replies follow.
 */
export function setLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  void fetch("/api/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  })
    .catch(() => {})
    .finally(() => window.location.reload());
}
