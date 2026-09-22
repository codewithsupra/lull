import { describe, expect, it } from "vitest";
import { COUNTRY_OPTIONS, GLOBAL_LINE, REGIONS, crisisLinesFor, lineHref, regionFor } from "@/lib/crisis";

describe("crisis directory data", () => {
  it("has no duplicate countries", () => {
    const codes = REGIONS.map((r) => r.country);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("gives every region an emergency number and at least one line", () => {
    for (const r of REGIONS) {
      expect(r.emergency).toMatch(/\d/);
      expect(r.lines.length).toBeGreaterThan(0);
      expect(r.label.length).toBeGreaterThan(1);
    }
  });

  it("gives every line something dialable or clickable", () => {
    for (const r of REGIONS) {
      for (const l of r.lines) {
        expect(l.name.length).toBeGreaterThan(2);
        expect(l.number ?? l.url).toBeTruthy();
        if (l.number) expect(l.number.replace(/\D/g, "").length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("covers the launch markets with the right national numbers", () => {
    expect(regionFor("IN").lines[0].number).toBe("14416");
    expect(regionFor("US").lines[0].number).toBe("988");
    expect(regionFor("GB").lines[0].number).toBe("116 123");
    expect(regionFor("IN").emergency).toBe("112");
  });
});

describe("regionFor", () => {
  it("is case and whitespace tolerant", () => {
    expect(regionFor("in").country).toBe("IN");
    expect(regionFor(" us ").country).toBe("US");
  });

  it("falls back safely for unknown, empty or missing input", () => {
    for (const input of ["ZZ", "", null, undefined]) {
      const r = regionFor(input);
      expect(r.country).toBe("XX");
      expect(r.emergency).toMatch(/emergency/);
    }
  });
});

describe("crisisLinesFor", () => {
  it("always ends with the global fallback, even for unknown countries", () => {
    for (const input of ["IN", "ZZ", null]) {
      const { lines } = crisisLinesFor(input);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.at(-1)).toEqual(GLOBAL_LINE);
    }
  });

  it("puts national lines before the fallback", () => {
    const { lines } = crisisLinesFor("US");
    expect(lines[0].number).toBe("988");
    expect(lines).toHaveLength(regionFor("US").lines.length + 1);
  });
});

describe("lineHref", () => {
  it("dials digits only, whatever the display format", () => {
    expect(lineHref({ name: "x", number: "1800 599 0019" })).toBe("tel:18005990019");
    expect(lineHref({ name: "x", number: "13 11 14" })).toBe("tel:131114");
  });

  it("builds tel:, sms: and https: links", () => {
    expect(lineHref({ name: "x", number: "14416" })).toBe("tel:14416");
    expect(lineHref({ name: "x", number: "1800 599 0019" })).toBe("tel:18005990019");
    expect(lineHref({ name: "x", number: "741741", text: true })).toBe("sms:741741");
    expect(lineHref(GLOBAL_LINE)).toBe("https://findahelpline.com");
  });

  it("never returns an empty or javascript: href", () => {
    const href = lineHref({ name: "broken" });
    expect(href).toBe("https://findahelpline.com");
    for (const r of REGIONS) for (const l of r.lines) expect(lineHref(l)).toMatch(/^(tel:|sms:|https:)/);
  });
});

describe("country picker", () => {
  it("lists every region alphabetically", () => {
    expect(COUNTRY_OPTIONS).toHaveLength(REGIONS.length);
    expect(COUNTRY_OPTIONS.map((c) => c.label)).toEqual([...COUNTRY_OPTIONS.map((c) => c.label)].sort());
  });
});
