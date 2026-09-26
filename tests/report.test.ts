import { describe, expect, it } from "vitest";
import {
  EXPIRY_DAYS,
  MAX_QUESTIONS,
  MAX_SCREENER_POINTS,
  REPORT_SECTIONS,
  REPORT_WINDOW_DAYS,
  ShareRequest,
  addDays,
  buildReport,
  cleanQuestions,
  expiresAt,
  hasContent,
  pickSections,
  shareStatus,
  weekStart,
  type ReportInput,
} from "@/lib/report";
import { TOKEN_RE, hashToken, newShareToken, openReport, sealReport } from "@/lib/report-crypto";
import type { ScreenerRecord } from "@/lib/screeners";
import { DICTIONARIES, LOCALES } from "@/lib/i18n";

const NOW = new Date("2026-09-26T10:00:00Z");
const TODAY = "2026-09-26";

function rec(at: string, phq9: number, gad7: number, sleep = 3, riskAnswer = 0): ScreenerRecord {
  // Spread the score over the answers; item 9 (index 8) carries the risk answer.
  const phqAnswers = [0, 0, 0, 0, 0, 0, 0, 0, riskAnswer];
  let left = phq9 - riskAnswer;
  for (let i = 0; i < 8 && left > 0; i++) {
    phqAnswers[i] = Math.min(3, left);
    left -= phqAnswers[i];
  }
  return {
    phq9: { answers: phqAnswers, score: phq9, severity: "mild" },
    gad7: { answers: [0, 0, 0, 0, 0, 0, 0], score: gad7, severity: "mild" },
    sleep: { answers: [1, 1, 1], score: sleep, severity: "mild" },
    difficulty: null,
    followup: null,
    tier: 2,
    risk: riskAnswer > 0,
    reasons: [],
    at,
  };
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    today: TODAY,
    screeners: [rec("2026-08-01T09:00:00Z", 16, 12), rec("2026-08-15T09:00:00Z", 12, 10), rec("2026-09-20T09:00:00Z", 8, 6)],
    plan: {
      category: "anxiety",
      started_at: "2026-09-14",
      doctor_questions: ["Could my sleep medicine be making mornings harder?"],
      doctor_flags: ["Ask your doctor whether the evening dose timing is right for you."],
      medications: [{ name: "Sertraline", dose: "50 mg", times: ["21:00", "08:00"] }],
    },
    tasks: [
      { day: "2026-09-14", kind: "medication", completed_at: "2026-09-14T08:01:00Z" },
      { day: "2026-09-14", kind: "habit", completed_at: null },
      { day: "2026-09-15", kind: "medication", completed_at: "2026-09-15T08:03:00Z" },
      { day: "2026-09-21", kind: "medication", completed_at: null },
      { day: "2026-09-22", kind: "medication", completed_at: "2026-09-22T08:00:00Z" },
      { day: "2026-09-22", kind: "session", completed_at: "2026-09-22T20:00:00Z" },
      // future task: not due yet, must not count as missed
      { day: "2026-09-27", kind: "medication", completed_at: null },
    ],
    checkins: [
      { mood: 2, energy: 2, created_at: "2026-09-15T20:00:00Z" },
      { mood: 4, energy: 3, created_at: "2026-09-16T20:00:00Z" },
      { mood: 4, energy: 4, created_at: "2026-09-22T20:00:00Z" },
    ],
    ...over,
  };
}

describe("date helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
  it("finds the Monday of a week, including when the day is a Sunday or a Monday", () => {
    expect(weekStart("2026-09-26")).toBe("2026-09-21"); // Saturday
    expect(weekStart("2026-09-27")).toBe("2026-09-21"); // Sunday belongs to the week before
    expect(weekStart("2026-09-21")).toBe("2026-09-21"); // Monday is its own start
  });
  it.each(Object.entries(EXPIRY_DAYS))("computes a %s expiry", (key, days) => {
    expect(Date.parse(expiresAt(key as keyof typeof EXPIRY_DAYS, NOW)) - NOW.getTime()).toBe(days * 86_400_000);
  });
});

describe("buildReport — screeners", () => {
  it("charts scores oldest-first with the latest severity and the change over the window", () => {
    const r = buildReport(input({ screeners: [rec("2026-09-20T09:00:00Z", 8, 6), rec("2026-08-01T09:00:00Z", 16, 12)] }), { now: NOW });
    expect(r.screeners!.points.map((p) => p.phq9)).toEqual([16, 8]);
    expect(r.screeners!.change).toEqual({ phq9: -8, gad7: -6, sleep: 0 });
    expect(r.screeners!.latest).toEqual({ phq9: "mild", gad7: "mild", sleep: expect.any(String) });
  });
  it("has no change figure with a single screening, and no latest with none", () => {
    expect(buildReport(input({ screeners: [rec("2026-09-20T09:00:00Z", 8, 6)] }), { now: NOW }).screeners!.change).toBeNull();
    const empty = buildReport(input({ screeners: [] }), { now: NOW }).screeners!;
    expect(empty.latest).toBeNull();
    expect(empty.points).toEqual([]);
    expect(empty.risk_endorsed).toBe(0);
  });
  it("drops screenings older than the report window but keeps one exactly at its start", () => {
    const start = addDays(TODAY, -(REPORT_WINDOW_DAYS - 1));
    const r = buildReport(input({ screeners: [rec(`${addDays(start, -1)}T23:00:00Z`, 20, 20), rec(`${start}T00:00:00Z`, 10, 10)] }), { now: NOW });
    expect(r.screeners!.points.map((p) => p.phq9)).toEqual([10]);
  });
  it(`caps the chart at ${MAX_SCREENER_POINTS} points, keeping the most recent`, () => {
    const many = Array.from({ length: 20 }, (_, i) => rec(`${addDays(TODAY, -80 + i * 4)}T09:00:00Z`, i, i));
    const pts = buildReport(input({ screeners: many }), { now: NOW }).screeners!.points;
    expect(pts).toHaveLength(MAX_SCREENER_POINTS);
    expect(pts.at(-1)!.phq9).toBe(19);
  });
  it("counts every self-harm-item endorsement in the window, even ones not on the chart", () => {
    const many = Array.from({ length: 20 }, (_, i) => rec(`${addDays(TODAY, -80 + i * 4)}T09:00:00Z`, 5, 5, 3, i === 0 ? 2 : 0));
    const s = buildReport(input({ screeners: many }), { now: NOW }).screeners!;
    expect(s.points).toHaveLength(MAX_SCREENER_POINTS); // the endorsed one is off the chart…
    expect(s.risk_endorsed).toBe(1); // …but never off the count
  });
});

describe("buildReport — adherence", () => {
  it("groups by plan week and counts only days that have arrived", () => {
    const a = buildReport(input(), { now: NOW }).adherence!;
    expect(a.weeks).toEqual([
      { week: 1, from: "2026-09-14", med_due: 2, med_done: 2, all_due: 3, all_done: 2 },
      { week: 2, from: "2026-09-21", med_due: 2, med_done: 1, all_due: 3, all_done: 2 },
    ]);
    expect(a.med_rate).toBe(75); // 3 of 4 — the future 2026-09-27 dose is not "missed"
    expect(a.all_rate).toBe(67); // 4 of 6, rounded
  });
  it("reports null rates (not 0%) when nothing was due, e.g. a plan with no medicines", () => {
    const a = buildReport(input({ tasks: [{ day: "2026-09-20", kind: "habit", completed_at: null }] }), { now: NOW }).adherence!;
    expect(a.med_rate).toBeNull();
    expect(a.all_rate).toBe(0);
  });
  it("is empty without a plan", () => {
    const a = buildReport(input({ plan: null }), { now: NOW }).adherence!;
    expect(a).toEqual({ weeks: [], med_rate: null, all_rate: null });
  });
  it("counts today's tasks as due", () => {
    const a = buildReport(input({ tasks: [{ day: TODAY, kind: "medication", completed_at: null }] }), { now: NOW }).adherence!;
    expect(a.med_rate).toBe(0);
  });
});

describe("buildReport — mood", () => {
  it("averages by Monday-start week to one decimal place", () => {
    const m = buildReport(input(), { now: NOW }).mood!;
    expect(m.checkins).toBe(3);
    expect(m.weeks).toEqual([
      { from: "2026-09-14", mood: 3, energy: 2.5, n: 2 },
      { from: "2026-09-21", mood: 4, energy: 4, n: 1 },
    ]);
  });
  it("ignores check-ins outside the window", () => {
    const m = buildReport(input({ checkins: [{ mood: 1, energy: 1, created_at: "2026-01-01T00:00:00Z" }] }), { now: NOW }).mood!;
    expect(m).toEqual({ weeks: [], checkins: 0 });
  });
});

describe("buildReport — privacy", () => {
  it("never carries a check-in note, even if one sneaks onto the input object", () => {
    const leaky = input({ checkins: [{ mood: 3, energy: 3, created_at: "2026-09-20T00:00:00Z", note: "my boss Rahul Sharma 9876543210" } as never] });
    expect(JSON.stringify(buildReport(leaky, { now: NOW }))).not.toMatch(/Rahul|9876543210|note/);
  });
  it("PII-scrubs the alias and user-added questions", () => {
    const r = buildReport(input(), { alias: "call me on 9876543210", questions: ["Email me at a.b@example.com about it"], now: NOW });
    expect(r.alias).not.toMatch(/9876543210/);
    expect(r.questions!.join(" ")).not.toMatch(/a\.b@example\.com/);
  });
  it("has a null alias when none is given, and never derives one", () => {
    expect(buildReport(input(), { now: NOW }).alias).toBeNull();
    expect(buildReport(input(), { alias: "   ", now: NOW }).alias).toBeNull();
  });
  it("has no account-identifying field anywhere", () => {
    const keys = JSON.stringify(buildReport(input(), { alias: "R.S.", now: NOW }));
    expect(keys).not.toMatch(/"(user_id|userId|email|id)"\s*:/);
  });
  it("sorts medication times without mutating the caller's data", () => {
    const inp = input();
    const r = buildReport(inp, { now: NOW });
    expect(r.medications![0].times).toEqual(["08:00", "21:00"]);
    expect(inp.plan!.medications[0].times).toEqual(["21:00", "08:00"]);
  });
});

describe("cleanQuestions", () => {
  it("de-duplicates case-insensitively and drops blanks", () => {
    expect(cleanQuestions(["Is this dose right?", "is this dose right?", "  ", "Another?"])).toEqual(["Is this dose right?", "Another?"]);
  });
  it(`stops at ${MAX_QUESTIONS}`, () => {
    expect(cleanQuestions(Array.from({ length: 30 }, (_, i) => `Question ${i}?`))).toHaveLength(MAX_QUESTIONS);
  });
  it("keeps Hindi questions intact", () => {
    expect(cleanQuestions(["क्या मेरी दवा का समय ठीक है?"])).toEqual(["क्या मेरी दवा का समय ठीक है?"]);
  });
});

describe("pickSections", () => {
  const full = buildReport(input(), { alias: "R.S.", now: NOW });

  it.each(REPORT_SECTIONS)("removes every section except %s — the key is absent, not empty", (only) => {
    const r = pickSections(full, [only]);
    expect(r.sections).toEqual([only]);
    for (const s of REPORT_SECTIONS) {
      if (s === only) expect(r[s]).toBeDefined();
      else expect(s in r, s).toBe(false);
    }
  });
  it("never leaks medicine names when medications is unticked", () => {
    const r = pickSections(full, REPORT_SECTIONS.filter((s) => s !== "medications"));
    expect(JSON.stringify(r)).not.toContain("Sertraline");
  });
  it("keeps canonical section order regardless of input order", () => {
    expect(pickSections(full, ["flags", "screeners"]).sections).toEqual(["screeners", "flags"]);
  });
  it("does not mutate the full report", () => {
    pickSections(full, ["flags"]);
    expect(full.medications).toBeDefined();
  });
});

describe("hasContent", () => {
  it("is false for every section of an empty account", () => {
    const empty = buildReport({ today: TODAY, screeners: [], plan: null, tasks: [], checkins: [] }, { now: NOW });
    for (const s of REPORT_SECTIONS) expect(hasContent(empty, s), s).toBe(false);
  });
  it("is true for every section of a populated account", () => {
    const r = buildReport(input(), { now: NOW });
    for (const s of REPORT_SECTIONS) expect(hasContent(r, s), s).toBe(true);
  });
  it("is false for a section that was picked out", () => {
    expect(hasContent(pickSections(buildReport(input(), { now: NOW }), ["flags"]), "medications")).toBe(false);
  });
});

describe("ShareRequest", () => {
  const ok = { sections: ["screeners"], expires: "7d", locale: "en" };
  it("accepts a minimal request and defaults alias and questions", () => {
    expect(ShareRequest.parse(ok)).toEqual({ sections: ["screeners"], expires: "7d", locale: "en", alias: "", questions: [] });
  });
  it("de-duplicates and orders sections", () => {
    expect(ShareRequest.parse({ ...ok, sections: ["flags", "screeners", "flags"] }).sections).toEqual(["screeners", "flags"]);
  });
  it.each([
    ["no sections", { ...ok, sections: [] }],
    ["an unknown section", { ...ok, sections: ["notes"] }],
    ["an unknown expiry", { ...ok, expires: "forever" }],
    ["an unknown locale", { ...ok, locale: "fr" }],
    ["an over-long alias", { ...ok, alias: "x".repeat(41) }],
    ["too many questions", { ...ok, questions: Array(6).fill("q?") }],
    ["an over-long question", { ...ok, questions: ["x".repeat(301)] }],
    ["an empty question", { ...ok, questions: ["   "] }],
  ])("rejects %s", (_, body) => {
    expect(ShareRequest.safeParse(body).success).toBe(false);
  });
});

describe("shareStatus", () => {
  it("is revoked when revoked, even if not yet expired", () => {
    expect(shareStatus({ expires_at: "2099-01-01T00:00:00Z", revoked_at: "2026-09-25T00:00:00Z" }, NOW)).toBe("revoked");
  });
  it("is expired at exactly the expiry instant", () => {
    expect(shareStatus({ expires_at: NOW.toISOString(), revoked_at: null }, NOW)).toBe("expired");
  });
  it("is active just before expiry", () => {
    expect(shareStatus({ expires_at: new Date(NOW.getTime() + 1).toISOString(), revoked_at: null }, NOW)).toBe("active");
  });
});

describe("report-crypto — the link is the key", () => {
  const report = pickSections(buildReport(input(), { now: NOW }), ["screeners", "medications"]);

  it("generates 256-bit url-safe tokens that are unique", () => {
    const tokens = new Set(Array.from({ length: 200 }, newShareToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(TOKEN_RE);
  });
  it("hashes deterministically to 64 hex chars, and never equals the token", () => {
    const t = newShareToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });
  it("round-trips a report, including Hindi text", () => {
    const t = newShareToken();
    const hi = { ...report, questions: ["क्या मेरी दवा का समय ठीक है?"] };
    expect(openReport(sealReport(hi, t), t)).toEqual(hi);
  });
  it("seals to r1: ciphertext that contains no plaintext", () => {
    const sealed = sealReport(report, newShareToken());
    expect(sealed.startsWith("r1:")).toBe(true);
    expect(sealed).not.toContain("Sertraline");
  });
  it("uses a fresh IV each time", () => {
    const t = newShareToken();
    expect(sealReport(report, t)).not.toBe(sealReport(report, t));
  });
  it("cannot be opened with a different token", () => {
    expect(() => openReport(sealReport(report, newShareToken()), newShareToken())).toThrow();
  });
  it("cannot be opened with the server's health-data key path (a v1: payload is rejected)", () => {
    expect(() => openReport("v1:a:b:c", newShareToken())).toThrow(/Malformed/);
  });
  it("detects tampering with the ciphertext", () => {
    const t = newShareToken();
    const [v, iv, tag, data] = sealReport(report, t).split(":");
    const flipped = data[0] === "A" ? `B${data.slice(1)}` : `A${data.slice(1)}`;
    expect(() => openReport([v, iv, tag, flipped].join(":"), t)).toThrow();
  });
  it.each(["", "r1", "r1:x", "r1:x:y"])("rejects malformed ciphertext %j", (bad) => {
    expect(() => openReport(bad, newShareToken())).toThrow();
  });
});

describe("report dictionary", () => {
  it.each(LOCALES)("names every section in %s", (locale) => {
    const t = DICTIONARIES[locale].report;
    for (const s of REPORT_SECTIONS) {
      expect(t.sections[s].title, `${locale}.${s}`).toBeTruthy();
      expect(t.sections[s].hint, `${locale}.${s}`).toBeTruthy();
    }
    for (const e of Object.keys(EXPIRY_DAYS)) expect(t.expiry[e as keyof typeof EXPIRY_DAYS], `${locale}.${e}`).toBeTruthy();
  });
});
