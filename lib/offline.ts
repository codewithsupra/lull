import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * Where each language's offline crisis page lives. Shared by the build-time generator and the
 * service worker's precache list, so the two can never drift apart.
 */
export const offlinePagePath = (locale: Locale): string =>
  locale === DEFAULT_LOCALE ? "offline-safety.html" : `offline-safety.${locale}.html`;
