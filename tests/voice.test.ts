import { describe, expect, it } from "vitest";
import { PREFERRED_VOICE_NAMES, RECOGNITION_LANG, VOICE_LANG_PREFIX, pickVoiceForLocale, type VoiceLike } from "@/lib/voice";
import { LOCALES } from "@/lib/i18n";

const v = (name: string, lang: string): VoiceLike => ({ name, lang });

describe("pickVoiceForLocale", () => {
  it("prefers an exact preferred-name match over voice order", () => {
    const voices = [v("Some Random Hindi Voice", "hi-IN"), v("Google हिन्दी", "hi-IN"), v("Lekha", "hi-IN")];
    expect(pickVoiceForLocale(voices, "hi")?.name).toBe("Google हिन्दी");
  });

  it("matches by language prefix, not exact tag", () => {
    const voices = [v("Karen", "en-AU"), v("Daniel", "en-GB")];
    // Karen ranks before Daniel in the English preferred list.
    expect(pickVoiceForLocale(voices, "en")?.name).toBe("Karen");
  });

  it("matches vendor-suffixed names with includes(), not equality", () => {
    const voices = [v("Microsoft Swara Online (Natural) - Hindi (India)", "hi-IN")];
    expect(pickVoiceForLocale(voices, "hi")?.name).toContain("Swara");
  });

  it("falls back to the first same-language voice when no preferred name matches", () => {
    const voices = [v("Completely Unknown Voice", "hi-IN")];
    expect(pickVoiceForLocale(voices, "hi")?.name).toBe("Completely Unknown Voice");
  });

  it("never crosses languages: an English-only voice list yields nothing for Hindi", () => {
    const voices = [v("Samantha", "en-US"), v("Daniel", "en-GB")];
    expect(pickVoiceForLocale(voices, "hi")).toBeNull();
  });

  it("returns null on an empty voice list", () => {
    expect(pickVoiceForLocale([], "en")).toBeNull();
  });

  it("matches language prefix case-insensitively", () => {
    const voices = [v("Odd Casing", "HI-in")];
    expect(pickVoiceForLocale(voices, "hi")?.name).toBe("Odd Casing");
  });

  it.each(LOCALES)("has at least one preferred name for %s", (locale) => {
    expect(PREFERRED_VOICE_NAMES[locale].length).toBeGreaterThan(0);
  });
});

describe("locale → speech tags", () => {
  it.each(LOCALES)("gives %s a language prefix for TTS matching", (locale) => {
    expect(VOICE_LANG_PREFIX[locale]).toMatch(/^[a-z]{2}$/);
  });

  it.each(LOCALES)("gives %s a full BCP-47 tag for SpeechRecognition", (locale) => {
    expect(RECOGNITION_LANG[locale]).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
  });

  it("keeps the recognition tag's language matching the TTS prefix", () => {
    for (const locale of LOCALES) {
      expect(RECOGNITION_LANG[locale].toLowerCase().startsWith(VOICE_LANG_PREFIX[locale])).toBe(true);
    }
  });
});
