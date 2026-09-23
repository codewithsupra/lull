import { describe, expect, it } from "vitest";
import { EMPTY_PLAN, SECTIONS, SafetyPlan, completedSections, isUsable } from "@/lib/safety";
import { DICTIONARIES, LOCALES } from "@/lib/i18n";

describe("safety plan schema", () => {
  it("defaults to an empty but valid plan", () => {
    expect(SafetyPlan.parse({})).toEqual(EMPTY_PLAN);
    expect(EMPTY_PLAN.country).toBeNull();
  });

  it("trims entries and uppercases the country", () => {
    const p = SafetyPlan.parse({ coping: ["  breathe  "], country: "in" });
    expect(p.coping).toEqual(["breathe"]);
    expect(p.country).toBe("IN");
  });

  it("rejects empty strings, oversized lists and long entries", () => {
    expect(SafetyPlan.safeParse({ coping: [""] }).success).toBe(false);
    expect(SafetyPlan.safeParse({ coping: Array(9).fill("x") }).success).toBe(false);
    expect(SafetyPlan.safeParse({ coping: ["x".repeat(161)] }).success).toBe(false);
    expect(SafetyPlan.safeParse({ country: "IND" }).success).toBe(false);
  });

  it("accepts real phone formats and rejects junk", () => {
    expect(SafetyPlan.safeParse({ people: [{ label: "Ravi", phone: "+91 98765 43210" }] }).success).toBe(true);
    expect(SafetyPlan.safeParse({ people: [{ label: "Ravi", phone: "(020) 7946-0018" }] }).success).toBe(true);
    expect(SafetyPlan.safeParse({ people: [{ label: "Ravi", phone: "javascript:alert(1)" }] }).success).toBe(false);
    expect(SafetyPlan.safeParse({ people: [{ label: "", phone: "988" }] }).success).toBe(false);
  });

  it("defaults a contact's phone to empty rather than failing", () => {
    const p = SafetyPlan.parse({ people: [{ label: "Mum" }] });
    expect(p.people[0]).toEqual({ label: "Mum", phone: "" });
  });
});

describe("usability signals", () => {
  it("needs a coping step plus one human to be usable", () => {
    expect(isUsable(EMPTY_PLAN)).toBe(false);
    expect(isUsable(SafetyPlan.parse({ coping: ["walk"] }))).toBe(false);
    expect(isUsable(SafetyPlan.parse({ people: [{ label: "Mum" }] }))).toBe(false);
    expect(isUsable(SafetyPlan.parse({ coping: ["walk"], people: [{ label: "Mum" }] }))).toBe(true);
    expect(isUsable(SafetyPlan.parse({ coping: ["walk"], professionals: [{ label: "Dr M" }] }))).toBe(true);
  });

  it("counts completed sections", () => {
    expect(completedSections(EMPTY_PLAN)).toBe(0);
    expect(completedSections(SafetyPlan.parse({ coping: ["a"], reasons: ["b"] }))).toBe(2);
  });
});

describe("sections", () => {
  it("covers all seven Stanley-Brown steps", () => {
    expect(SECTIONS).toHaveLength(7);
    expect(SECTIONS.filter((s) => s.contacts).map((s) => s.id)).toEqual(["people", "professionals"]);
  });

  // The clinical structure is language-free, so guidance must exist in every language we ship.
  it.each(LOCALES)("has title, help and an example for every section in %s", (locale) => {
    const copy = DICTIONARIES[locale].safety.sections;
    for (const section of SECTIONS) {
      expect(copy[section.id].title.length, `${locale}.${section.id}.title`).toBeGreaterThan(3);
      expect(copy[section.id].help.length, `${locale}.${section.id}.help`).toBeGreaterThan(10);
      expect(copy[section.id].placeholder.length, `${locale}.${section.id}.placeholder`).toBeGreaterThan(3);
    }
  });
});
