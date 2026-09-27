import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ActionInput,
  CommentInput,
  HIDE_AT_REPORTS,
  MOD_REASONS,
  PostInput,
  REPORT_REASONS,
  ago,
  aliasFor,
  hotScore,
  isAllowedSlug,
  normalizeSlug,
  recommendedSlugs,
  ruleCheck,
  scrub,
  sortPosts,
  threadComments,
  type CommentView,
} from "@/lib/community";
import { aliasSeed, authorKey } from "@/lib/community-keys";
import { DICTIONARIES, LOCALES } from "@/lib/i18n";

describe("community slugs", () => {
  it.each([
    ["Concerta", "concerta"],
    ["/concerta", "concerta"],
    ["Concerta XL", "concerta-xl"],
    ["  side effects  ", "side-effects"],
    ["sertraline_50", "sertraline-50"],
    ["--adhd--", "adhd"],
    ["a".repeat(45), "a".repeat(30)],
    // Formatting only: whether a name is ALLOWED is isAllowedSlug's job (tested below), not this one's.
    ["Buy Concerta!", "buy-concerta"],
  ])("normalises %j → %j", (input, out) => expect(normalizeSlug(input)).toBe(out));

  it.each([null, "", "a", "/", "💊", "कंसर्टा", "   "])("rejects %j", (input) => expect(normalizeSlug(input as string)).toBeNull());

  it.each(["concerta", "adhd", "side-effects", "sertraline-50"])("allows %s", (s) => expect(isAllowedSlug(s)).toBe(true));
  it.each(["admin", "lull", "mods", "for-you", "preview", "buy-concerta", "cheap-xanax", "adderall-no-rx", "without-prescription", "online-pharmacy", "concerta-for-sale"])(
    "refuses reserved or shop-like %s",
    (s) => expect(isAllowedSlug(s)).toBe(false),
  );
});

describe("ruleCheck — the safety floor the AI can never loosen", () => {
  // The whole point of the feature: these must always get through.
  it.each([
    "Concerta is working like magic for me",
    "Sertraline made me nauseous for the first week, then it settled",
    "I take 36mg of Concerta in the morning and the afternoon crash is real",
    "My doctor told me to buy the generic, it's much cheaper",
    "Has anyone else had vivid dreams on mirtazapine?",
    "Escitalopram ne meri anxiety kaafi kam kar di",
    "सर्ट्रालीन से मेरी नींद बेहतर हुई है",
    "I got my prescription renewed without any trouble",
  ])("allows personal experience: %s", (text) => expect(ruleCheck(text)).toBeNull());

  it.each([
    "I want to kill myself",
    "honestly thinking of ending it all",
    "मैं मर जाना चाहता हूँ",
    "mujhe marna hai",
  ])("holds crisis language in any language: %s", (text) => expect(ruleCheck(text)).toBe("crisis"));

  it.each([
    "where can I buy concerta without a prescription",
    "selling alprazolam, no prescription needed",
    "anyone can ship clonazepam w/o rx?",
    "DM me for adderall",
    "whatsapp me, I have extra pills",
    "concerta 36mg for sale",
    "बिना पर्चे के दवा कहाँ से खरीदें",
    "bina parche ke kharid sakte hai kya",
  ])("holds sourcing: %s", (text) => expect(ruleCheck(text)).toBe("sourcing"));
});

describe("scrub", () => {
  it("removes phone numbers and emails before storage", () => {
    const out = scrub("call me on +91 98765 43210 or mail a.b@example.com");
    expect(out).not.toMatch(/98765|example\.com/);
  });
  it("keeps normal text intact, including Hindi", () => {
    expect(scrub("Concerta works for me")).toBe("Concerta works for me");
    expect(scrub("मुझे फ़र्क महसूस हुआ")).toBe("मुझे फ़र्क महसूस हुआ");
  });
});

describe("ranking", () => {
  const now = Date.parse("2026-09-27T12:00:00Z");
  const post = (id: string, score: number, hoursAgo: number) => ({ id, score, created_at: new Date(now - hoursAgo * 3_600_000).toISOString() });

  it("hot favours a fresh post over an old one with the same score", () => {
    expect(hotScore(10, post("a", 10, 1).created_at, now)).toBeGreaterThan(hotScore(10, post("b", 10, 48).created_at, now));
  });
  it("hot never goes negative or NaN, even for future timestamps", () => {
    const h = hotScore(-5, new Date(now + 3_600_000).toISOString(), now);
    expect(h).toBeGreaterThan(0);
    expect(Number.isFinite(h)).toBe(true);
  });
  it("sorts new / top / hot", () => {
    const posts = [post("old-popular", 50, 72), post("fresh", 2, 1), post("mid", 10, 10)];
    expect(sortPosts(posts, "new", now).map((p) => p.id)).toEqual(["fresh", "mid", "old-popular"]);
    expect(sortPosts(posts, "top", now).map((p) => p.id)).toEqual(["old-popular", "mid", "fresh"]);
    expect(sortPosts(posts, "hot", now)[0].id).not.toBe("old-popular");
  });
  it("does not mutate its input", () => {
    const posts = [post("a", 1, 5), post("b", 9, 1)];
    sortPosts(posts, "top", now);
    expect(posts.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("recommendedSlugs", () => {
  const existing = new Set(["concerta", "sertraline", "adhd", "anxiety", "depression", "insomnia", "side-effects", "melatonin"]);

  it("puts the user's own medicines first, then their focus, then engagement", () => {
    expect(recommendedSlugs({ medications: ["Concerta 36mg", "Melatonin (3 mg)"], category: "adhd", engaged: ["insomnia"] }, existing)).toEqual([
      "concerta",
      "melatonin",
      "adhd",
      "insomnia",
    ]);
  });
  it("maps low mood to /depression", () => {
    expect(recommendedSlugs({ medications: [], category: "low_mood", engaged: [] }, existing)[0]).toBe("depression");
  });
  it("only returns communities that exist, without duplicates", () => {
    const r = recommendedSlugs({ medications: ["Obscurazine 5mg", "Sertraline", "sertraline 100mg"], category: "anxiety", engaged: ["anxiety", "nope"] }, existing);
    expect(r).toContain("sertraline");
    expect(r).not.toContain("obscurazine");
    expect(r).not.toContain("nope");
    expect(new Set(r).size).toBe(r.length);
  });
  it("gives a new user sensible defaults", () => {
    expect(recommendedSlugs({ medications: [], category: null, engaged: [] }, existing).length).toBeGreaterThanOrEqual(3);
  });
  it("respects the maximum", () => {
    expect(recommendedSlugs({ medications: [...existing], category: null, engaged: [] }, existing, 3)).toHaveLength(3);
  });
});

describe("anonymity", () => {
  it("derives a 64-hex author key that is stable per user and different between users", () => {
    const a = authorKey("5daac581-15be-40a4-934a-3be0c02b62d6");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(authorKey("5daac581-15be-40a4-934a-3be0c02b62d6")).toBe(a);
    expect(authorKey("4984be91-2989-4a6f-bd8b-e0098aa72984")).not.toBe(a);
  });
  it("never contains the user id", () => {
    const id = "5daac581-15be-40a4-934a-3be0c02b62d6";
    expect(authorKey(id)).not.toContain(id.replace(/-/g, "").slice(0, 12));
  });
  it("gives a person a stable alias within a thread but not across threads", () => {
    const key = authorKey("user-1");
    expect(aliasSeed(key, "thread-a")).toEqual(aliasSeed(key, "thread-a"));
    const acrossThreads = new Set(Array.from({ length: 30 }, (_, i) => aliasSeed(key, `thread-${i}`).join(",")));
    expect(acrossThreads.size).toBeGreaterThan(25);
  });
  it("renders aliases from the dictionary in every locale", () => {
    for (const locale of LOCALES) {
      const words = DICTIONARIES[locale].community.alias;
      expect(aliasFor([0, 0], words)).toBe(`${words.adjectives[0]} ${words.animals[0]}`);
      expect(aliasFor([65535, 65535], words).split(" ")).toHaveLength(2);
    }
  });
  it("has equally sized alias lists in every locale, so a seed means the same alias in any language", () => {
    for (const locale of LOCALES) {
      expect(DICTIONARIES[locale].community.alias.adjectives).toHaveLength(DICTIONARIES.en.community.alias.adjectives.length);
      expect(DICTIONARIES[locale].community.alias.animals).toHaveLength(DICTIONARIES.en.community.alias.animals.length);
    }
  });
});

describe("threadComments", () => {
  const cm = (id: string, parent_id: string | null): CommentView => ({ id, parent_id, body: id, score: 0, created_at: "2026-09-27T00:00:00Z", alias: [0, 0], op: false, mine: false, voted: false });
  it("nests replies under their top-level comment, flattening deeper chains", () => {
    const out = threadComments([cm("a", null), cm("b", "a"), cm("c", "b"), cm("d", null)]);
    expect(out.map((c) => c.id)).toEqual(["a", "d"]);
    expect(out[0].replies.map((r) => r.id)).toEqual(["b", "c"]);
  });
  it("promotes a reply whose parent is gone (deleted or hidden) to top level", () => {
    expect(threadComments([cm("x", "missing")]).map((c) => c.id)).toEqual(["x"]);
  });
});

describe("ago", () => {
  const t = DICTIONARIES.en.community.ago;
  const now = Date.parse("2026-09-27T12:00:00Z");
  it.each([
    [0, "just now"],
    [5, "5m"],
    [59, "59m"],
    [60, "1h"],
    [60 * 23, "23h"],
    [60 * 24 * 3, "3d"],
  ])("%i minutes → %s", (mins, out) => expect(ago(new Date(now - mins * 60_000).toISOString(), now, t)).toBe(out));
});

describe("input validation", () => {
  it("accepts a valid post and trims it", () => {
    expect(PostInput.parse({ community: "concerta", title: "  Works like magic  ", flair: "experience" })).toMatchObject({ title: "Works like magic", body: "" });
  });
  it.each([
    [{ community: "concerta", title: "hi", flair: "experience" }],
    [{ community: "concerta", title: "x".repeat(161), flair: "experience" }],
    [{ community: "concerta", title: "Valid title", flair: "advice" }],
    [{ community: "concerta", title: "Valid title", body: "x".repeat(5001), flair: "tip" }],
  ])("rejects a bad post %#", (body) => expect(PostInput.safeParse(body).success).toBe(false));
  it("rejects an empty comment and a non-uuid parent", () => {
    expect(CommentInput.safeParse({ body: "   " }).success).toBe(false);
    expect(CommentInput.safeParse({ body: "ok", parent_id: "1; drop table" }).success).toBe(false);
  });
  it("validates actions", () => {
    const id = "5daac581-15be-40a4-934a-3be0c02b62d6";
    expect(ActionInput.safeParse({ action: "vote", type: "post", id }).success).toBe(true);
    expect(ActionInput.safeParse({ action: "report", type: "comment", id, reason: "selling" }).success).toBe(true);
    expect(ActionInput.safeParse({ action: "report", type: "post", id, reason: "i-dont-like-it" }).success).toBe(false);
    expect(ActionInput.safeParse({ action: "downvote", type: "post", id }).success).toBe(false);
    expect(ActionInput.safeParse({ action: "vote", type: "user", id }).success).toBe(false);
  });
});

describe("SQL agrees with the app", () => {
  const sql = readdirSync("migrations")
    .filter((f) => f.includes("_community"))
    .map((f) => readFileSync(`migrations/${f}`, "utf8"))
    .join("\n");
  it(`hides after ${HIDE_AT_REPORTS} reports`, () => expect(sql).toContain(`report_count + 1 >= ${HIDE_AT_REPORTS}`));
  it("has the same report reasons", () => {
    for (const r of REPORT_REASONS) expect(sql).toContain(`'${r}'`);
  });
  it("stores no user id in any forum table", () => {
    const tables = sql.match(/CREATE TABLE public\.forum_\w+ \([\s\S]*?\n\);/g) ?? [];
    expect(tables.length).toBe(5);
    for (const t of tables) expect(t).not.toMatch(/user_id|auth\.users|auth\.uid/);
  });
  it("gives no client role any grant", () => {
    expect(sql).not.toMatch(/GRANT [\w, ()]+ ON (TABLE )?public\.forum_/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.forum_/);
  });
});

describe("dictionaries", () => {
  it.each(LOCALES)("explain every moderation reason and report reason in %s", (locale) => {
    const c = DICTIONARIES[locale].community;
    for (const r of MOD_REASONS) expect(c.mod[r], `${locale}.mod.${r}`).toBeTruthy();
    for (const r of REPORT_REASONS) expect(c.reportReasons[r], `${locale}.report.${r}`).toBeTruthy();
  });
});

describe("every AI call uses zero-retention routing", () => {
  // Regression guard: /api/insight and /api/compose once shipped without PRIVATE_ROUTING.
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts)$/.test(name)) files.push(p);
    }
  };
  walk("app");
  walk("lib");
  const callers = files.filter((f) => readFileSync(f, "utf8").includes("chat.completions.create"));
  it("finds the model callers", () => expect(callers.length).toBeGreaterThanOrEqual(5));
  it.each(callers)("%s spreads PRIVATE_ROUTING", (f) => {
    const src = readFileSync(f, "utf8");
    // Count real calls (".create(") — a `typeof ...create` type annotation is not a call.
    const calls = (src.match(/chat\.completions\.create\(/g) ?? []).length;
    expect(src.split("...PRIVATE_ROUTING").length - 1, f).toBeGreaterThanOrEqual(calls);
  });
});
