/**
 * Locale registry (FR8). Adding a language means adding a code here and a dictionary in
 * `messages/`; nothing else in the app hardcodes a language. Devanagari-script locales are
 * flagged so the root layout can load the right font subset.
 */

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie is readable by the client so the provider can hydrate without a round trip. */
export const LOCALE_COOKIE = "lull_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type LocaleMeta = {
  /** Name in its own language, for the picker. */
  native: string;
  /** Name in English, for logs and admin surfaces. */
  english: string;
  /** BCP-47 tag for `<html lang>`, Intl and speech synthesis. */
  tag: string;
  devanagari: boolean;
  /** Screener translations reviewed by a native-speaking clinician. See lib/screeners-i18n.ts. */
  clinicallyReviewed: boolean;
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { native: "English", english: "English", tag: "en-IN", devanagari: false, clinicallyReviewed: true },
  hi: { native: "हिन्दी", english: "Hindi", tag: "hi-IN", devanagari: true, clinicallyReviewed: false },
};

export const isLocale = (value: unknown): value is Locale => typeof value === "string" && (LOCALES as readonly string[]).includes(value);

export const asLocale = (value: unknown): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

/**
 * Picks a locale from an `Accept-Language` header, honouring q-weights.
 * Matches on the base language so `hi-IN`, `hi_IN` and `hi` all resolve to Hindi.
 */
export function detectLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { base: tag.trim().toLowerCase().replace(/_/g, "-").split("-")[0], weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((r) => r.base && r.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { base } of ranked) if (isLocale(base)) return base;
  return DEFAULT_LOCALE;
}
