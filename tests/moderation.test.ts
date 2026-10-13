import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAN_DURATIONS, BAN_REASONS, ModAction, TEAM_KEY, banActive, banUntil, handleOf, isAdmin, teamResourcesText } from "@/lib/moderation";
import { REPORT_REASONS } from "@/lib/community";
import { authorKey } from "@/lib/community-keys";
import { DICTIONARIES, LOCALES } from "@/lib/i18n";

const ADMIN = "5daac581-15be-40a4-934a-3be0c02b62d6";
const OTHER = "4984be91-2989-4a6f-bd8b-e0098aa72984";
const NOW = new Date("2026-10-13T12:00:00Z");

describe("isAdmin", () => {
  it("accepts a listed user id, case-insensitively, with spaces around commas", () => {
    expect(isAdmin(ADMIN, ADMIN)).toBe(true);
    expect(isAdmin(ADMIN.toUpperCase(), ` ${OTHER} , ${ADMIN} `)).toBe(true);
  });
  it.each([
    ["no env value", ADMIN, undefined],
    ["empty env value", ADMIN, ""],
    ["a different user", OTHER, ADMIN],
    ["no user", null, ADMIN],
    ["an email instead of an id", "me@example.com", "me@example.com"],
    ["a wildcard", ADMIN, "*"],
    ["a partial id prefix", ADMIN, ADMIN.slice(0, 8)],
    ["an empty user id", "", ADMIN],
  ])("refuses %s", (_, user, env) => expect(isAdmin(user as string, env as string)).toBe(false));
});

describe("bans", () => {
  it.each(Object.entries(BAN_DURATIONS))("%s ends at the right time", (d, days) => {
    const until = banUntil(d as keyof typeof BAN_DURATIONS, NOW);
    if (days === null) expect(until).toBeNull();
    else expect(Date.parse(until!) - NOW.getTime()).toBe(days * 86_400_000);
  });
  it("treats a permanent ban as active forever", () => expect(banActive({ until: null }, new Date("2099-01-01"))).toBe(true));
  it("is active before its end and inactive at and after it", () => {
    expect(banActive({ until: "2026-10-13T12:00:01Z" }, NOW)).toBe(true);
    expect(banActive({ until: NOW.toISOString() }, NOW)).toBe(false);
    expect(banActive({ until: "2026-10-01T00:00:00Z" }, NOW)).toBe(false);
  });
  it("is inactive when there is no ban", () => {
    expect(banActive(null, NOW)).toBe(false);
    expect(banActive(undefined, NOW)).toBe(false);
  });
  it("shows only an opaque 8-hex handle", () => {
    const key = authorKey(ADMIN);
    expect(handleOf(key)).toBe(`#${key.slice(0, 8)}`);
    expect(handleOf(key)).not.toContain(ADMIN.slice(0, 8));
  });
});

describe("TEAM_KEY", () => {
  it("is a valid author key shape (so the schema accepts it) but can't be any member's key", () => {
    expect(TEAM_KEY).toMatch(/^[0-9a-f]{64}$/);
    for (let i = 0; i < 200; i++) expect(authorKey(`user-${i}`)).not.toBe(TEAM_KEY);
  });
});

describe("ModAction", () => {
  const id = "5daac581-15be-40a4-934a-3be0c02b62d6";
  it.each([
    { action: "restore", type: "post", id },
    { action: "remove", type: "comment", id },
    { action: "dismiss", type: "post", id },
    { action: "ban", type: "post", id, duration: "7d", reason: "selling" },
    { action: "ban", type: "comment", id, duration: "permanent", reason: "harassment" },
    { action: "unban", key: "a".repeat(64) },
    { action: "resources", post_id: id },
  ])("accepts %j", (a) => expect(ModAction.safeParse(a).success).toBe(true));
  it.each([
    { action: "delete_user", id },
    { action: "restore", type: "user", id },
    { action: "remove", type: "post", id: "1 or 1=1" },
    { action: "ban", type: "post", id, duration: "forever", reason: "spam" },
    { action: "ban", type: "post", id, duration: "7d", reason: "crisis" },
    { action: "unban", key: "not-a-key" },
    { action: "unban", key: "A".repeat(64) },
  ])("rejects %j", (a) => expect(ModAction.safeParse(a).success).toBe(false));
  it("never lets a moderator ban someone for being in crisis", () => {
    expect(BAN_REASONS).not.toContain("crisis");
  });
});

describe("team resources reply", () => {
  const text = teamResourcesText();
  it("carries English and Hindi", () => {
    expect(text).toContain(DICTIONARIES.en.community.teamResources);
    expect(text).toContain(DICTIONARIES.hi.community.teamResources);
  });
  it.each(LOCALES)("points to the Help button by the exact label members see in %s", (locale) => {
    const t = DICTIONARIES[locale];
    expect(t.community.teamResources).toContain(t.common.helpNow);
  });
  it("fits the comment length limit", () => expect(text.length).toBeLessThanOrEqual(2500));
  it("hardcodes no phone number (the Help sheet picks the right country)", () => expect(text).not.toMatch(/\d{3,}/));
});

describe("SQL agrees with the app", () => {
  const sql = readdirSync("migrations")
    .filter((f) => f.endsWith("_community-moderation.sql"))
    .map((f) => readFileSync(`migrations/${f}`, "utf8"))
    .join("\n");
  it("has the same ban reasons", () => {
    for (const r of BAN_REASONS) expect(sql).toContain(`'${r}'`);
  });
  it("ban reasons are a subset of report reasons", () => {
    for (const r of BAN_REASONS) expect(REPORT_REASONS as readonly string[]).toContain(r);
  });
  it("stores no user id and grants clients nothing", () => {
    expect(sql).not.toMatch(/user_id|auth\.users|auth\.uid/);
    expect(sql).not.toMatch(/GRANT /);
    expect(sql).toMatch(/forum_bans_server_only[\s\S]*USING \(false\)/);
    expect(sql).toMatch(/forum_mod_log_server_only[\s\S]*USING \(false\)/);
  });
});
