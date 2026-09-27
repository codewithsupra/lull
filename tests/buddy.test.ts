import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BUDDY_ACTIVE_DAYS,
  BUDDY_DAYS,
  BUDDY_MAX_REWARDS,
  CODE_ALPHABET,
  CODE_RE,
  JOIN_RESULTS,
  afterSignInPath,
  asJoinResult,
  codeFromBytes,
  formatCode,
  normalizeCode,
} from "@/lib/buddy";
import { CARD_KINDS, CARD_STAT_KEYS, availableCards, cardSeed, cardText, gardenPlants, seededRandom, type CardStats } from "@/lib/share-card";
import { DICTIONARIES, LOCALES } from "@/lib/i18n";

describe("invite codes", () => {
  it("uses a 32-symbol alphabet with no look-alike characters", () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CODE_ALPHABET).size).toBe(32);
    expect(CODE_ALPHABET).not.toMatch(/[01IO]/);
  });
  it("maps every byte value to a valid code character (no modulo bias: 256 % 32 = 0)", () => {
    expect(256 % CODE_ALPHABET.length).toBe(0);
    for (let b = 0; b < 256; b += 8) {
      expect(codeFromBytes(Uint8Array.from([b, b + 1, b + 2, b + 3, b + 4, b + 5, b + 6, b + 7]))).toMatch(CODE_RE);
    }
  });
  it("is deterministic for the same bytes and distinct for different bytes", () => {
    const a = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(codeFromBytes(a)).toBe(codeFromBytes(a));
    expect(codeFromBytes(a)).not.toBe(codeFromBytes(Uint8Array.from([8, 7, 6, 5, 4, 3, 2, 1])));
  });
  it("refuses too few bytes rather than making a short code", () => {
    expect(() => codeFromBytes(new Uint8Array(7))).toThrow();
  });
  it.each([
    ["abcd-efgh", "ABCDEFGH"],
    [" ABCD EFGH ", "ABCDEFGH"],
    ["https://lull-ai.vercel.app/join/ABCDEFGH", "ABCDEFGH"],
    ["https://lull-ai.vercel.app/join/abcd-efgh/", "ABCDEFGH"],
    ["23456789", "23456789"],
  ])("normalises %j", (input, out) => {
    expect(normalizeCode(input)).toBe(out);
  });
  it.each([null, undefined, "", "ABCDEFG", "ABCDEFGHJ", "ABCDEF0H", "ABCDEFIH", "ABCD'; drop table--", "../../etc"])("rejects %j", (input) => {
    expect(normalizeCode(input as string)).toBeNull();
  });
  it("formats for reading aloud", () => {
    expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
  });
});

describe("join results", () => {
  it.each(JOIN_RESULTS)("passes %s through", (r) => expect(asJoinResult(r)).toBe(r));
  it.each([null, 42, "JOINED", "error", {}])("maps unexpected RPC output %j to invalid", (v) => expect(asJoinResult(v)).toBe("invalid"));
});

describe("afterSignInPath", () => {
  it("lands on the invite when a valid code is pending", () => {
    expect(afterSignInPath("abcd-efgh")).toBe("/app/invite?join=ABCDEFGH");
  });
  it.each([undefined, null, "", "bad", "//evil.example.com", "https://evil.example.com", "/app/../admin"])("is never an open redirect: %j → /app", (v) => {
    expect(afterSignInPath(v as string)).toBe("/app");
  });
});

describe("SQL and TypeScript agree on the reward rules", () => {
  const file = readdirSync("migrations").find((f) => f.endsWith("_buddy-invites.sql"))!;
  const sql = readFileSync(`migrations/${file}`, "utf8");
  it("grants BUDDY_DAYS", () => expect(sql).toContain(`interval '${BUDDY_DAYS} days'`));
  it("needs BUDDY_ACTIVE_DAYS distinct server-stamped dates", () => {
    expect(sql).toMatch(new RegExp(`count\\(DISTINCT \\(t\\.completed_at AT TIME ZONE 'UTC'\\)::date\\)[\\s\\S]{0,200}>= ${BUDDY_ACTIVE_DAYS}`));
  });
  it("caps rewards at BUDDY_MAX_REWARDS", () => expect(sql).toContain(`AND g.source = 'buddy') >= ${BUDDY_MAX_REWARDS}`));
  it("uses the same code pattern", () => expect(sql).toContain(`'${CODE_RE.source}'`));
  it("never lets clients call the write functions", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.join_buddy\(uuid, text\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.settle_buddy_rewards\(uuid\) FROM PUBLIC, anon, authenticated/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.(join_buddy|settle_buddy_rewards)/);
  });
});

describe("share cards", () => {
  const stats: CardStats = { streak: 5, xp: 420, days_tended: 12 };

  it("take engagement numbers only — the type is the privacy boundary", () => {
    expect([...CARD_STAT_KEYS].sort()).toEqual(["days_tended", "streak", "xp"]);
  });
  it("offer nothing to a brand-new user", () => {
    expect(availableCards({ streak: 0, xp: 0, days_tended: 0 })).toEqual([]);
  });
  it("hide a 1-day streak card but show the garden", () => {
    expect(availableCards({ streak: 1, xp: 15, days_tended: 1 })).toEqual(["garden", "level"]);
  });
  it("offer every card to an active user", () => {
    expect(availableCards(stats)).toEqual([...CARD_KINDS]);
  });

  it.each(LOCALES)("render every card's text in %s with no leftover placeholders", (locale) => {
    const t = DICTIONARIES[locale];
    for (const kind of CARD_KINDS) {
      const text = cardText(kind, stats, t);
      for (const s of Object.values(text)) {
        expect(s.length, `${locale}.${kind}`).toBeGreaterThan(0);
        expect(s, `${locale}.${kind}`).not.toMatch(/\{\w+\}/);
      }
    }
  });
  it("uses singular and plural correctly", () => {
    const t = DICTIONARIES.en;
    expect(cardText("garden", { ...stats, days_tended: 1 }, t).label).toBe("day tended");
    expect(cardText("garden", stats, t).label).toBe("days tended");
  });
  it("names the level from the dictionary", () => {
    expect(cardText("level", { streak: 0, xp: 0, days_tended: 0 }, DICTIONARIES.en).big).toBe("Seedling");
    expect(cardText("level", stats, DICTIONARIES.hi).big).toBe(DICTIONARIES.hi.plan.levels[2]);
  });

  it("seeded random is deterministic and in [0, 1)", () => {
    const a = seededRandom(42), b = seededRandom(42);
    for (let i = 0; i < 500; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it("draws one plant per tended day, capped, all within the card", () => {
    expect(gardenPlants({ ...stats, days_tended: 0 }, 1)).toEqual([]);
    expect(gardenPlants(stats, 1)).toHaveLength(12);
    const many = gardenPlants({ ...stats, days_tended: 500 }, 1);
    expect(many).toHaveLength(40);
    for (const p of many) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1);
      expect(p.height).toBeGreaterThan(0);
      expect(p.height).toBeLessThanOrEqual(0.24); // must stay clear of the text block (ground at 0.8)
    }
  });
  it("always blooms the newest plant", () => {
    expect(gardenPlants({ ...stats, days_tended: 4 }, 3).at(-1)!.bloom).toBe(true);
  });
  it("seeds art from stats alone, so equal stats give equal art and different kinds differ", () => {
    expect(cardSeed(stats, "garden")).toBe(cardSeed({ ...stats }, "garden"));
    expect(cardSeed(stats, "garden")).not.toBe(cardSeed(stats, "streak"));
  });
});

describe("invite dictionary", () => {
  it.each(LOCALES)("has a message for every join result in %s", (locale) => {
    for (const r of JOIN_RESULTS) expect(DICTIONARIES[locale].invite.join.results[r], `${locale}.${r}`).toBeTruthy();
  });
});
