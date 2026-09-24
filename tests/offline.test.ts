import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n";
import { offlinePagePath } from "@/lib/offline";

/**
 * The offline crisis page is the last thing that still works when everything else is gone, so
 * a language silently missing from the service worker's precache list would be the worst kind
 * of regression: invisible until someone needs it offline, in Hindi.
 */
describe("offline crisis pages", () => {
  const sw = readFileSync("public/sw.js", "utf8");

  it("names the default locale's page without a suffix", () => {
    expect(offlinePagePath(DEFAULT_LOCALE)).toBe("offline-safety.html");
  });

  it.each(LOCALES)("gives %s its own page", (locale) => {
    expect(offlinePagePath(locale)).toMatch(/^offline-safety(\.[a-z]{2})?\.html$/);
  });

  it("gives every locale a distinct page", () => {
    const paths = LOCALES.map(offlinePagePath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it.each(LOCALES)("precaches the %s page in the service worker", (locale) => {
    expect(sw).toContain(`"/${offlinePagePath(locale)}"`);
  });

  it("maps every locale in the service worker's page table", () => {
    for (const locale of LOCALES) expect(sw).toMatch(new RegExp(`${locale}:\\s*"/${offlinePagePath(locale).replace(".", "\\.")}"`));
  });
});
