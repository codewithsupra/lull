import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, asLocale, detectLocale, isLocale, type Locale } from "./config";
import { messagesFor, type Messages } from ".";

/**
 * The request's locale: the user's saved choice if there is one, otherwise their browser's
 * `Accept-Language`. `proxy.ts` persists the detected value so the choice is stable afterwards.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const saved = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return detectLocale((await headers()).get("accept-language"));
}

export async function getMessages(): Promise<{ locale: Locale; t: Messages }> {
  const locale = await getLocale();
  return { locale, t: messagesFor(locale) };
}

/** Locale for a background job (push, digests) where there is no request. */
export const localeOf = (stored: string | null | undefined): Locale => asLocale(stored);

/** User-facing API error strings for this request's language. */
export async function apiErrors(): Promise<Messages["errors"]> {
  return messagesFor(await getLocale()).errors;
}
