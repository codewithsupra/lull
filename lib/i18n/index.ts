import en from "./messages/en";
import hi from "./messages/hi";
import { DEFAULT_LOCALE, LOCALE_META, type Locale } from "./config";
import type { Dict } from "./dict";

export type Messages = Dict<typeof en>;

export const DICTIONARIES: Record<Locale, Messages> = { en, hi };

export const messagesFor = (locale: Locale): Messages => DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];

export const tagFor = (locale: Locale): string => LOCALE_META[locale].tag;

export * from "./config";
export { fmt, placeholders, plural, splitAround, type Dict } from "./dict";
