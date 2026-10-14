import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES, CONFIRM_WORD, EraseInput, NOT_PERSONAL, NameInput, deletionBlocked, exportFilename, stripForeign } from "@/lib/privacy";
import { readable } from "@/lib/privacy-read";
import { encrypt, encryptJson } from "@/lib/crypto";
import { DICTIONARIES, LOCALES } from "@/lib/i18n";

const sql = readdirSync("migrations")
  .sort()
  .map((f) => readFileSync(`migrations/${f}`, "utf8"))
  .join("\n");
const createdTables = [...sql.matchAll(/CREATE TABLE public\.(\w+)/g)].map((m) => m[1]);
const covered = new Set<string>([...CATEGORIES.flatMap((c) => c.tables), ...NOT_PERSONAL]);

describe("the data inventory is complete", () => {
  // The guard that matters most: a new table can't ship without export and erasure covering it.
  it.each(createdTables)("public.%s is covered by a privacy category (or explicitly not personal)", (t) => {
    expect(covered.has(t), `add ${t} to CATEGORIES or NOT_PERSONAL in lib/privacy.ts`).toBe(true);
  });
  it("lists no table that doesn't exist", () => {
    for (const t of CATEGORIES.flatMap((c) => c.tables)) {
      if (!t.startsWith("auth.")) expect(createdTables, t).toContain(t);
    }
  });

  // Erasure relies on the cascade: every personal, non-forum table must hang off auth.users.
  const personal = CATEGORIES.flatMap((c) => c.tables).filter((t) => !t.startsWith("auth.") && !t.startsWith("forum_"));
  it.each(personal)("public.%s cascades from the account, so deleting the account erases it", (t) => {
    const block = sql.match(new RegExp(`CREATE TABLE public\\.${t} \\([\\s\\S]*?\\n\\);`))?.[0] ?? "";
    expect(block, t).toMatch(/REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
  });

  it("keeps forum tables free of user ids (erased by anonymous key instead)", () => {
    for (const t of createdTables.filter((x) => x.startsWith("forum_"))) {
      const block = sql.match(new RegExp(`CREATE TABLE public\\.${t} \\([\\s\\S]*?\\n\\);`))?.[0] ?? "";
      expect(block, t).not.toMatch(/user_id|auth\.users/);
    }
  });

  it("never lets a client call the account-deletion function", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.delete_user_account\(uuid\) FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.delete_user_account/);
  });

  it.each(LOCALES)("names and explains every category in %s", (locale) => {
    for (const c of CATEGORIES) {
      expect(DICTIONARIES[locale].privacy.categories[c.id].title, `${locale}.${c.id}`).toBeTruthy();
      expect(DICTIONARIES[locale].privacy.categories[c.id].desc, `${locale}.${c.id}`).toBeTruthy();
    }
  });
});

describe("stripForeign", () => {
  it("removes ids and secrets that point at other people, at any depth", () => {
    const out = stripForeign({
      id: "keep",
      user_id: "u",
      inviter_id: "x",
      nested: { author_key: "k", text: "keep", list: [{ voter_key: "v", ok: 1 }] },
      token_hash: "h",
      report_enc: "r1:secret",
    });
    expect(out).toEqual({ id: "keep", nested: { text: "keep", list: [{ ok: 1 }] } });
  });
  it("leaves primitives and arrays of primitives alone", () => {
    expect(stripForeign([1, "a", null])).toEqual([1, "a", null]);
    expect(stripForeign("x")).toBe("x");
  });
});

describe("readable", () => {
  it("decrypts *_enc columns into readable fields, parsing JSON where it is JSON", () => {
    const row = readable({ id: "1", user_id: "u", name_enc: encrypt("Sertraline"), results_enc: encryptJson({ phq9: 7 }), created_at: "t" });
    expect(row).toEqual({ id: "1", name: "Sertraline", results: { phq9: 7 }, created_at: "t" });
  });
  it("keeps Hindi text intact", () => {
    expect(readable({ note_enc: encrypt("मुझे नींद आती है") })).toEqual({ note: "मुझे नींद आती है" });
  });
  it("marks unreadable ciphertext instead of throwing (one bad row can't block a whole export)", () => {
    expect(readable({ x_enc: "v1:not:valid:cipher" })).toEqual({ x: "[unreadable]" });
  });
  it("never decrypts or leaks a report share's sealed blob", () => {
    expect(readable({ report_enc: "r1:a:b:c", locale: "en" })).toEqual({ locale: "en" });
  });
  it("leaves null optional ciphertext as-is", () => {
    expect(readable({ dose_enc: null })).toEqual({ dose_enc: null });
  });
});

describe("deletionBlocked", () => {
  const sub = (status: string | null, cancel_at: string | null = null) => ({ source: "subscription" as const, status, cancel_at });
  it.each(["active", "trialing", "past_due"])("blocks a renewing %s subscription", (s) => expect(deletionBlocked(sub(s))).toBe(true));
  it("allows a subscription already set to cancel", () => expect(deletionBlocked(sub("active", "2026-11-01T00:00:00Z"))).toBe(false));
  it.each(["canceled", "incomplete_expired", null])("allows a %s subscription", (s) => expect(deletionBlocked(sub(s))).toBe(false));
  it("allows free, trial and buddy plans, and no plan at all", () => {
    expect(deletionBlocked({ source: "free", status: null, cancel_at: null })).toBe(false);
    expect(deletionBlocked({ source: "trial", status: null, cancel_at: null })).toBe(false);
    expect(deletionBlocked({ source: "buddy", status: null, cancel_at: null })).toBe(false);
    expect(deletionBlocked(null)).toBe(false);
  });
});

describe("inputs", () => {
  it(`requires typing exactly ${CONFIRM_WORD}`, () => {
    expect(EraseInput.safeParse({ scope: "account", confirm: "DELETE" }).success).toBe(true);
    for (const c of ["delete", " DELETE", "DELETE ", "DEL", "", "मिटाएँ"]) expect(EraseInput.safeParse({ scope: "account", confirm: c }).success, c).toBe(false);
    expect(EraseInput.safeParse({ scope: "everything", confirm: "DELETE" }).success).toBe(false);
  });
  it("validates names", () => {
    expect(NameInput.parse({ name: "  Riya  " }).name).toBe("Riya");
    expect(NameInput.safeParse({ name: "   " }).success).toBe(false);
    expect(NameInput.safeParse({ name: "x".repeat(61) }).success).toBe(false);
    expect(NameInput.parse({ name: "प्रिया" }).name).toBe("प्रिया");
  });
  it("names the export file by date", () => {
    expect(exportFilename(new Date("2026-10-14T09:00:00Z"))).toBe("lull-my-data-2026-10-14.json");
  });
  it.each(LOCALES)("tells %s readers the exact confirm word", (locale) => {
    expect(DICTIONARIES[locale].privacy.errors.confirm).toContain(CONFIRM_WORD);
  });
});
