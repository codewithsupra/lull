import type { Locale } from "@/lib/i18n";

/**
 * Voice matching for speech synthesis (TTS) and recognition (STT) — FR8's "voice guidance
 * (Hindi TTS/STT)". Kept pure and DOM-free so the matching logic can be unit-tested; the actual
 * `SpeechSynthesis`/`SpeechRecognition` calls live in lib/audio/engine.ts and lib/voice-input.ts.
 *
 * Two different needs, two different tags:
 * - TTS picks from whatever voices the device happens to have installed, so matching is loose
 *   (a language *prefix*, e.g. any "hi-*" voice) and falls back through a preferred-name list
 *   because voice quality varies wildly across OSes.
 * - STT (`SpeechRecognition.lang`) is passed straight to the OS/browser's recognizer, which
 *   wants a specific, valid BCP-47 tag — a prefix is not accepted everywhere, so this is exact.
 */

/** Prefix used to match installed TTS voices by language, e.g. "en" matches "en-GB", "en-IN". */
export const VOICE_LANG_PREFIX: Record<Locale, string> = { en: "en", hi: "hi" };

/** Exact BCP-47 tag passed to SpeechRecognition.lang. */
export const RECOGNITION_LANG: Record<Locale, string> = { en: "en-US", hi: "hi-IN" };

/**
 * Names of voices worth preferring, best first, because most platforms ship more than one and
 * many synthetic voices are harsh or robotic — a bad voice undoes the calm the app is going for.
 * Checked with `includes()` since browsers append vendor suffixes ("Microsoft Swara Online
 * (Natural) - Hindi (India)").
 */
export const PREFERRED_VOICE_NAMES: Record<Locale, string[]> = {
  en: ["Samantha", "Ava", "Serena", "Google UK English Female", "Karen", "Moira", "Daniel", "Microsoft Aria"],
  hi: ["Google हिन्दी", "Lekha", "Swara", "Kalpana", "Microsoft Hemant", "Veena"],
};

/** The minimal shape of `SpeechSynthesisVoice` this module needs, so it can be unit-tested without the DOM. */
export type VoiceLike = { name: string; lang: string };

/**
 * Picks the best available voice for a locale: an exact preferred-name match first, then any
 * voice for that language, in the order the platform reports them.
 */
export function pickVoiceForLocale<T extends VoiceLike>(voices: readonly T[], locale: Locale): T | null {
  const prefix = VOICE_LANG_PREFIX[locale].toLowerCase();
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  for (const name of PREFERRED_VOICE_NAMES[locale]) {
    const hit = candidates.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  return candidates[0] ?? null;
}

/** Whether the browser has `SpeechRecognition` at all — Firefox and most non-Chromium engines don't. */
export function isRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}
