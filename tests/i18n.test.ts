import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, DICTIONARIES, LOCALES, LOCALE_META, asLocale, detectLocale, fmt, isLocale, placeholders, plural } from "@/lib/i18n";

type Leaf = { path: string; value: string };

/** Flattens a dictionary to `path → string` so locales can be compared key by key. */
function leaves(node: unknown, path = ""): Leaf[] {
  if (typeof node === "string") return [{ path, value: node }];
  if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [];
}

const DEVANAGARI = /[ऀ-ॿ]/;

/** `{placeholder}` names are code identifiers, not visible text, so they never count as English. */
const visible = (value: string) => value.replace(/\{\w+\}/g, " ");

/**
 * Latin text that is allowed to stay Latin in a non-Latin locale: brand names, clinical
 * instrument names, keywords a user must literally text, and units.
 */
const ALLOWED_LATIN =
  /\b(lull|pro|xp|cbt|act|phq|gad|isi|ai|home|shout|hello|findahelpline|com|tele|manas|kiran|icall|tiss|aasra|samaritans|shout|trevor|lgbtq|nhs|sos|estijaba|telefonseelsorge|zelfmoordpreventie|sadag|lifeline|beyond|blue|crisis|text|line|project|health|helpline|mental|suicide|need|talk|govt|india|dept|option|min|mg|en|fr|upi|gst|whatsapp|google|github|stripe|razorpay)\b/gi;

describe("locale registry", () => {
  it("has a dictionary and metadata for every declared locale", () => {
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale], `dictionary for ${locale}`).toBeTruthy();
      expect(LOCALE_META[locale].tag).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(LOCALE_META[locale].native.length).toBeGreaterThan(0);
    }
  });

  it("recognises supported codes and rejects the rest", () => {
    expect(isLocale("hi")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("xx")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(asLocale("bn")).toBe(DEFAULT_LOCALE);
    expect(asLocale("hi")).toBe("hi");
  });

  it.each([
    ["hi", "hi"],
    ["hi-IN", "hi"],
    ["hi_IN", "hi"],
    ["en-GB,en;q=0.9", "en"],
    ["hi-IN,hi;q=0.9,en;q=0.8", "hi"],
    // English is preferred here despite Hindi appearing first, because of the q-weights.
    ["hi;q=0.2,en;q=0.9", "en"],
    ["bn-IN,bn;q=0.9,hi;q=0.7", "hi"],
    ["fr-FR", DEFAULT_LOCALE],
    ["", DEFAULT_LOCALE],
    [null, DEFAULT_LOCALE],
    ["en;q=0", DEFAULT_LOCALE],
  ])("detects %s as %s", (header, expected) => {
    expect(detectLocale(header)).toBe(expected);
  });
});

describe("dictionary parity", () => {
  const base = leaves(DICTIONARIES[DEFAULT_LOCALE]);
  const basePaths = base.map((l) => l.path);

  it.each(LOCALES)("%s has exactly the same keys as the source locale", (locale) => {
    const paths = leaves(DICTIONARIES[locale]).map((l) => l.path);
    expect(paths.filter((p) => !basePaths.includes(p))).toEqual([]);
    expect(basePaths.filter((p) => !paths.includes(p))).toEqual([]);
  });

  it.each(LOCALES)("%s has no blank strings", (locale) => {
    const blank = leaves(DICTIONARIES[locale]).filter((l) => l.value.trim().length === 0);
    expect(blank.map((l) => l.path)).toEqual([]);
  });

  it.each(LOCALES)("%s keeps every {placeholder} the source locale uses", (locale) => {
    const dict = new Map(leaves(DICTIONARIES[locale]).map((l) => [l.path, l.value]));
    const mismatched = base
      .filter((l) => placeholders(l.value).length > 0)
      .filter((l) => JSON.stringify(placeholders(dict.get(l.path) ?? "")) !== JSON.stringify(placeholders(l.value)))
      .map((l) => l.path);
    expect(mismatched).toEqual([]);
  });

  it("has no untranslated English left in Hindi", () => {
    const untranslated = leaves(DICTIONARIES.hi)
      .filter((l) => {
        const stripped = visible(l.value).replace(ALLOWED_LATIN, "").replace(/[^A-Za-zऀ-ॿ]/g, "");
        // A Latin run of 4+ letters that survived the allowlist means a string was missed.
        return /[A-Za-z]{4,}/.test(stripped) && !DEVANAGARI.test(l.value);
      })
      .map((l) => `${l.path}: ${l.value}`);
    expect(untranslated).toEqual([]);
  });

  it("writes Hindi in Devanagari, not romanised Hinglish", () => {
    const romanised = leaves(DICTIONARIES.hi)
      // Strings of real prose (not codes, numbers or single tokens) should carry Devanagari.
      .filter((l) => {
        const text = visible(l.value).replace(ALLOWED_LATIN, "").trim();
        return text.split(/\s+/).filter((w) => /[A-Za-z\u0900-\u097F]/.test(w)).length >= 3 && !DEVANAGARI.test(text);
      })
      .map((l) => `${l.path}: ${l.value}`);
    expect(romanised).toEqual([]);
  });
});

describe("interpolation", () => {
  it("substitutes named params", () => {
    expect(fmt("{done}/{total} done today", { done: 2, total: 5 })).toBe("2/5 done today");
  });

  it("leaves unknown placeholders in place so tests can catch them", () => {
    expect(fmt("hello {name}", {})).toBe("hello {name}");
  });

  it("replaces every occurrence", () => {
    expect(fmt("{a} and {a}", { a: "x" })).toBe("x and x");
  });

  it("lists placeholders in a stable order", () => {
    expect(placeholders("{total} of {done} in {total}")).toEqual(["done", "total", "total"]);
  });

  it("picks plural forms", () => {
    expect(plural(1, { one: "day", other: "days" })).toBe("day");
    expect(plural(0, { one: "day", other: "days" })).toBe("days");
    expect(plural(7, { one: "day", other: "days" })).toBe("days");
  });
});
