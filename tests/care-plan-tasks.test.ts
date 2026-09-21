import { describe, expect, it } from "vitest";
import { addDays, buildWeekTasks } from "@/lib/care-plan-tasks";
import { decrypt } from "@/lib/crypto";
import { XP, type WeekPlan } from "@/lib/care-plan";

const plan: WeekPlan = {
  theme: "t",
  focus: "f",
  reflect: "What felt lighter?",
  habits: [
    { title: "Walk", detail: "", slot: "afternoon", time: null, days: "weekdays" },
    { title: "Wake 7", detail: "d", slot: "morning", time: "07:00", days: "daily" },
  ],
  sessions: [{ title: "478", detail: "", slot: "night", time: null, days: "daily", ref: "breathe:478:5" }],
  learn: [
    { title: "L1", body: "b" },
    { title: "L2", body: "b" },
    { title: "L3", body: "b" },
  ],
};
const meds = [
  { name: "Escitalopram", dose: "10mg", instructions: "after breakfast", times: ["08:00"], as_needed: false },
  { name: "Propranolol", dose: "10mg", instructions: "", times: [], as_needed: true },
  { name: "Melatonin", dose: "3mg", instructions: "", times: [], as_needed: false },
  { name: "Clonazepam", dose: "0.25mg", instructions: "", times: ["22:00", "08:00"], as_needed: false },
];
// 2026-09-21 is a Monday.
const rows = buildWeekTasks({ planId: "p", week: 2, startedAt: "2026-09-21", wake: "07:00", sleep: "23:30", medications: meds, plan });
const dec = (r: (typeof rows)[number]) => decrypt(r.title_enc);

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("buildWeekTasks", () => {
  it("covers exactly the 7 days of the requested week", () => {
    const days = [...new Set(rows.map((r) => r.day))];
    expect(days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(rows.every((r) => r.week === 2 && r.plan_id === "p")).toBe(true);
  });

  it("schedules medicines exactly as confirmed, one task per dose time", () => {
    const monday = rows.filter((r) => r.day === "2026-09-28" && r.kind === "medication");
    expect(monday.map((r) => `${r.remind_at} ${dec(r)}`).sort()).toEqual(["08:00 Clonazepam · 0.25mg", "08:00 Escitalopram · 10mg", "22:00 Clonazepam · 0.25mg"]);
  });

  it("never schedules as-needed or untimed medicines (no guessing)", () => {
    const titles = rows.filter((r) => r.kind === "medication").map(dec);
    expect(titles.some((t) => t.startsWith("Propranolol"))).toBe(false);
    expect(titles.some((t) => t.startsWith("Melatonin"))).toBe(false);
  });

  it("respects habit day rules (weekdays only)", () => {
    const walks = rows.filter((r) => r.kind === "habit" && dec(r) === "Walk").map((r) => r.day);
    expect(walks).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("derives default times from wake/sleep and keeps explicit ones", () => {
    const mon = rows.filter((r) => r.day === "2026-09-28");
    expect(mon.find((r) => r.kind === "session")!.remind_at).toBe("22:45");
    expect(mon.find((r) => r.kind === "reflect")!.remind_at).toBe("23:00");
    expect(mon.find((r) => dec(r) === "Wake 7")!.remind_at).toBe("07:00");
    expect(mon.find((r) => r.kind === "learn")!.remind_at).toBeNull();
  });

  it("rotates learn cards and awards the right XP per kind", () => {
    const learns = rows.filter((r) => r.kind === "learn").map(dec);
    expect(learns.slice(0, 4)).toEqual(["L1", "L2", "L3", "L1"]);
    for (const r of rows) expect(r.xp).toBe(XP[r.kind]);
  });

  it("orders each day by time with sequential sort keys", () => {
    for (const day of new Set(rows.map((r) => r.day))) {
      const d = rows.filter((r) => r.day === day);
      expect(d.map((r) => r.sort)).toEqual(d.map((_, i) => i));
      const times = d.map((r) => r.remind_at ?? "12:00");
      expect([...times].sort()).toEqual(times);
    }
  });

  it("encrypts every title and detail", () => {
    expect(rows.every((r) => r.title_enc.startsWith("v1:") && (r.detail_enc === null || r.detail_enc.startsWith("v1:")))).toBe(true);
  });
});
