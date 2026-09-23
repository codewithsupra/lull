import { describe, expect, it } from "vitest";
import { GAD7, PHQ9, PHQ9_RISK_ITEM, SLEEP, ScreenerSubmission, evaluate, nextDue, route, score, severity, type Snapshot } from "@/lib/screeners";
import { DICTIONARIES, LOCALES } from "@/lib/i18n";

const snap = (phq9: number, gad7: number, risk_item = 0, at = "2026-09-21T00:00:00Z"): Snapshot => ({ phq9, gad7, risk_item, at });

describe("instruments", () => {
  it("have the published item counts", () => {
    expect(PHQ9.itemCount).toBe(9);
    expect(GAD7.itemCount).toBe(7);
    expect(SLEEP.itemCount).toBe(3);
  });
  it("mark the sleep snapshot as non-clinical", () => {
    expect(SLEEP.clinical).toBe(false);
  });

  // A locale that is missing even one item would silently shorten a clinical instrument.
  it.each(LOCALES)("has every item and answer option worded in %s", (locale) => {
    const sc = DICTIONARIES[locale].screeners;
    for (const inst of [PHQ9, GAD7, SLEEP]) {
      expect(sc.instruments[inst.id].items, `${locale}.${inst.id}`).toHaveLength(inst.itemCount);
      for (const item of sc.instruments[inst.id].items) expect(item.length).toBeGreaterThan(8);
      expect(sc.instruments[inst.id].stem.length).toBeGreaterThan(8);
    }
    expect(sc.frequency).toHaveLength(PHQ9.values.length);
    expect(sc.difficulty.options).toHaveLength(4);
  });

  it.each(LOCALES)("keeps the self-harm wording in PHQ-9 item 9 in %s", (locale) => {
    // This is the item that drives the crisis path; a euphemistic translation would hide it.
    const item = DICTIONARIES[locale].screeners.instruments.phq9.items[PHQ9_RISK_ITEM];
    expect(item, locale).toMatch(/better off dead|hurting yourself|मर जाना|नुकसान/);
  });

  it.each(LOCALES)("explains every routing reason and care tier in %s", (locale) => {
    const sc = DICTIONARIES[locale].screeners;
    for (const key of ["risk_current", "phq9_high", "gad7_high", "risk_recent", "not_improving", "phq9_moderate", "gad7_moderate", "minimal"] as const) {
      expect(sc.reasons[key], `${locale}.${key}`).toBeTruthy();
    }
    for (const tier of [0, 1, 2, 3] as const) {
      expect(sc.tiers[tier].name, `${locale}.tier${tier}`).toBeTruthy();
      expect(sc.tiers[tier].headline.length).toBeGreaterThan(10);
      expect(sc.tiers[tier].next.length).toBeGreaterThan(20);
    }
  });
});

describe("score", () => {
  it("sums answers", () => {
    expect(score(PHQ9, [3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(27);
    expect(score(GAD7, [0, 1, 2, 3, 0, 1, 2])).toBe(9);
  });
  it("rejects wrong length, out-of-range and non-integer answers", () => {
    expect(() => score(PHQ9, [0, 0, 0])).toThrow(/9 answers/);
    expect(() => score(GAD7, [0, 0, 0, 0, 0, 0, 4])).toThrow(/range/);
    expect(() => score(GAD7, [0, 0, 0, 0, 0, 0, -1])).toThrow(/range/);
    expect(() => score(GAD7, [0, 0, 0, 0, 0, 0, 1.5])).toThrow(/range/);
  });
});

describe("severity cut-offs", () => {
  it.each([
    [0, "minimal"], [4, "minimal"], [5, "mild"], [9, "mild"], [10, "moderate"], [14, "moderate"],
    [15, "moderately_severe"], [19, "moderately_severe"], [20, "severe"], [27, "severe"],
  ] as const)("PHQ-9 %i → %s", (t, s) => expect(severity("phq9", t)).toBe(s));

  it.each([
    [0, "minimal"], [4, "minimal"], [5, "mild"], [9, "mild"], [10, "moderate"], [14, "moderate"], [15, "severe"], [21, "severe"],
  ] as const)("GAD-7 %i → %s", (t, s) => expect(severity("gad7", t)).toBe(s));
});

describe("route", () => {
  it("T1 for minimal/mild scores", () => {
    expect(route(snap(4, 6)).tier).toBe(1);
    expect(route(snap(9, 9)).tier).toBe(1);
  });

  it("T2 for moderate PHQ-9 or GAD-7", () => {
    expect(route(snap(10, 0)).tier).toBe(2);
    expect(route(snap(0, 14)).tier).toBe(2);
  });

  it("T3 for moderately severe/severe scores", () => {
    expect(route(snap(15, 0)).tier).toBe(3);
    expect(route(snap(0, 15)).tier).toBe(3);
  });

  it("any positive item 9 is a risk flag and at least T3", () => {
    const r = route(snap(3, 2, 1));
    expect(r.risk).toBe(true);
    expect(r.tier).toBe(3);
  });

  it("T0 when risk is current (item 9 ≥ 2 or follow-up yes)", () => {
    expect(route(snap(5, 5, 2)).tier).toBe(0);
    expect(route(snap(5, 5, 1), [], { thoughts_now: true, plan_or_intent: false }).tier).toBe(0);
    expect(route(snap(5, 5, 1), [], { thoughts_now: false, plan_or_intent: true }).tier).toBe(0);
    expect(route(snap(5, 5, 1), [], { thoughts_now: false, plan_or_intent: false }).tier).toBe(3);
  });

  it("follow-up answers without an item-9 flag never escalate", () => {
    expect(route(snap(2, 2, 0), [], { thoughts_now: true, plan_or_intent: true }).tier).toBe(1);
  });

  it("steps up to T3 when not improving after 6 weeks", () => {
    const baseline = snap(13, 12, 0, "2026-08-01T00:00:00Z");
    expect(route(snap(12, 11, 0, "2026-09-21T00:00:00Z"), [baseline]).tier).toBe(3);
  });

  it("does not step up when improving, too early, or no longer moderate", () => {
    const baseline = snap(14, 12, 0, "2026-08-01T00:00:00Z");
    expect(route(snap(9, 12, 0, "2026-09-21T00:00:00Z"), [baseline]).tier).toBe(2); // PHQ dropped 5 but GAD still moderate
    expect(route(snap(13, 12, 0, "2026-08-20T00:00:00Z"), [baseline]).tier).toBe(2); // < 42 days
    expect(route(snap(8, 7, 0, "2026-09-21T00:00:00Z"), [baseline]).tier).toBe(1);
  });

  it("uses the earliest history entry as baseline regardless of order", () => {
    const h = [snap(12, 12, 0, "2026-09-07T00:00:00Z"), snap(13, 12, 0, "2026-08-01T00:00:00Z")];
    expect(route(snap(12, 11, 0, "2026-09-21T00:00:00Z"), h).tier).toBe(3);
  });

  it("always explains the tier", () => {
    for (const s of [snap(0, 0), snap(12, 0), snap(20, 0), snap(0, 0, 3)]) expect(route(s).reasons.length).toBeGreaterThan(0);
  });
});

describe("nextDue", () => {
  it("is 14 days after the last check", () => {
    expect(nextDue("2026-09-21T10:00:00.000Z")).toBe("2026-10-05T10:00:00.000Z");
    expect(nextDue(null)).toBeNull();
  });
});


describe("evaluate", () => {
  const zeros = { phq9: Array(9).fill(0), gad7: Array(7).fill(0), sleep: [0, 0, 0] };

  it("scores server-side and routes", () => {
    const r = evaluate(ScreenerSubmission.parse({ ...zeros, phq9: [2, 2, 2, 2, 2, 0, 0, 0, 0], gad7: [1, 1, 1, 1, 1, 1, 1] }), [], "2026-09-21T00:00:00Z");
    expect(r.phq9).toMatchObject({ score: 10, severity: "moderate" });
    expect(r.gad7).toMatchObject({ score: 7, severity: "mild" });
    expect(r.tier).toBe(2);
    expect(r.risk).toBe(false);
  });

  it("ignores follow-up answers unless item 9 was endorsed", () => {
    const r = evaluate(ScreenerSubmission.parse({ ...zeros, followup: { thoughts_now: true, plan_or_intent: true } }), [], "2026-09-21T00:00:00Z");
    expect(r.tier).toBe(1);
    expect(r.followup).toBeNull();
  });

  it("escalates to T0 on item 9 + current thoughts", () => {
    const phq9 = [0, 1, 0, 0, 0, 0, 0, 0, 1];
    const r = evaluate(ScreenerSubmission.parse({ ...zeros, phq9, followup: { thoughts_now: true, plan_or_intent: false } }), [], "2026-09-21T00:00:00Z");
    expect(r).toMatchObject({ tier: 0, risk: true });
  });

  it("uses stored history for the 6-week non-improvement rule", () => {
    const base = evaluate(ScreenerSubmission.parse({ ...zeros, phq9: [2, 2, 2, 2, 2, 1, 1, 0, 0] }), [], "2026-08-01T00:00:00Z");
    const now = evaluate(ScreenerSubmission.parse({ ...zeros, phq9: [2, 2, 2, 2, 2, 1, 0, 0, 0] }), [base], "2026-09-21T00:00:00Z");
    expect(base.tier).toBe(2);
    expect(now.tier).toBe(3);
    expect(now.reasons).toContain("not_improving");
  });

  it("rejects malformed submissions", () => {
    expect(ScreenerSubmission.safeParse({ ...zeros, phq9: Array(8).fill(0) }).success).toBe(false);
    expect(ScreenerSubmission.safeParse({ ...zeros, gad7: [0, 0, 0, 0, 0, 0, 9] }).success).toBe(false);
    expect(ScreenerSubmission.safeParse({ ...zeros, sleep: ["1", 0, 0] }).success).toBe(false);
  });
});
