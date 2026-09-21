import { describe, expect, it } from "vitest";
import { CRISIS_TERMS, IntakeInput, PlanOutput, SESSION_REF, levelFor, sessionHref, slotForTime } from "@/lib/care-plan";

describe("levelFor", () => {
  it("starts at level 1 Seedling", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, name: "Seedling", progress: 0, toNext: 60 });
  });
  it("uses quadratic thresholds (60·n²)", () => {
    expect(levelFor(60).level).toBe(2);
    expect(levelFor(239).level).toBe(2);
    expect(levelFor(240).level).toBe(3);
  });
  it("clamps negative xp and caps the level name", () => {
    expect(levelFor(-50).level).toBe(1);
    expect(levelFor(10_000_000).name).toBe("Ancient Forest");
  });
});

describe("slotForTime", () => {
  it.each([
    ["05:00", "morning"],
    ["11:59", "morning"],
    ["12:00", "afternoon"],
    ["17:00", "evening"],
    ["21:00", "night"],
    ["02:30", "night"],
  ])("%s → %s", (t, slot) => expect(slotForTime(t)).toBe(slot));
});

describe("session refs", () => {
  it("accepts only known Lull features", () => {
    for (const ok of ["breathe:478:5", "breathe:coherent:10", "sounds:night-rain", "compose"]) expect(SESSION_REF.test(ok)).toBe(true);
    for (const bad of ["breathe:478:7", "breathe:foo:5", "sounds:disco", "javascript:alert(1)", "compose:hi"]) expect(SESSION_REF.test(bad)).toBe(false);
  });
  it("builds deep links carrying the task id", () => {
    expect(sessionHref("breathe:478:5", "t1")).toBe("/app/breathe?pattern=478&minutes=5&task=t1");
    expect(sessionHref("sounds:low-tide", "t2")).toBe("/app/sounds?preset=low-tide&task=t2");
    expect(sessionHref("compose", "t3")).toBe("/app/compose?task=t3");
  });
});

describe("crisis detection", () => {
  it.each(["I want to kill myself", "thinking about suicide", "some nights I don't want to wake up", "I keep hurting myself", "self-harm again"])("flags: %s", (s) =>
    expect(CRISIS_TERMS.test(s)).toBe(true),
  );
  it.each(["this deadline is killing me", "I can't sleep", "stressed about exams"])("does not flag: %s", (s) => expect(CRISIS_TERMS.test(s)).toBe(false));
});

describe("IntakeInput", () => {
  const base = { category: "insomnia", duration: "new", severity: 3, wake: "07:00", sleep: "23:00", today: "2026-09-21", consent: true };
  it("requires explicit consent", () => {
    expect(IntakeInput.safeParse({ ...base, consent: false }).success).toBe(false);
  });
  it("rejects malformed times and too many medicines", () => {
    expect(IntakeInput.safeParse({ ...base, wake: "7am" }).success).toBe(false);
    const meds = Array.from({ length: 13 }, () => ({ name: "x", times: ["08:00"] }));
    expect(IntakeInput.safeParse({ ...base, medications: meds }).success).toBe(false);
  });
  it("applies defaults", () => {
    const r = IntakeInput.parse(base);
    expect(r).toMatchObject({ goals: [], text: "", medications: [], timezone: "UTC" });
  });
});

describe("PlanOutput guards model output", () => {
  const week = {
    theme: "t",
    focus: "f",
    habits: [{ title: "a", slot: "morning", days: "daily" }, { title: "b", slot: "night", days: [1, 2] }],
    sessions: [{ title: "s", slot: "night", days: "daily", ref: "rm -rf" }],
    learn: [{ title: "1", body: "x" }, { title: "2", body: "x" }, { title: "3", body: "x" }],
  };
  const roadmap = [1, 2, 3, 4].map((w) => ({ week: w, theme: "t", focus: "f" }));
  it("replaces an invalid session ref with a safe default", () => {
    const p = PlanOutput.parse({ title: "T", summary: "S", roadmap, week });
    expect(p.week.sessions[0].ref).toBe("breathe:coherent:5");
  });
  it("requires exactly 4 roadmap weeks", () => {
    expect(PlanOutput.safeParse({ title: "T", summary: "S", roadmap: roadmap.slice(0, 3), week }).success).toBe(false);
  });
});
