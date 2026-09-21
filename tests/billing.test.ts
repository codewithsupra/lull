import { describe, expect, it } from "vitest";
import { FEATURES, FREE_PLAN, PRICES, allowance, currencyForCountry, isKnownPrice, priceFor } from "@/lib/billing";

describe("pricing", () => {
  it("shows INR in India and USD elsewhere (case-insensitive, missing header safe)", () => {
    expect(currencyForCountry("IN")).toBe("inr");
    expect(currencyForCountry("in")).toBe("inr");
    expect(currencyForCountry("US")).toBe("usd");
    expect(currencyForCountry(null)).toBe("usd");
    expect(currencyForCountry(undefined)).toBe("usd");
  });

  it("matches the approved price points", () => {
    expect(priceFor("inr", "month").amount).toBe(199);
    expect(priceFor("inr", "year").amount).toBe(1499);
    expect(priceFor("usd", "month").amount).toBe(7.99);
  });

  it("annual is a real discount", () => {
    for (const c of ["inr", "usd"] as const) expect(PRICES[c].year.amount).toBeLessThan(PRICES[c].month.amount * 12);
  });

  it("only accepts catalog price ids", () => {
    expect(isKnownPrice(priceFor("usd", "year").id)).toBe(true);
    expect(isKnownPrice("price_attacker_0cents")).toBe(false);
  });

  it("uses four distinct Stripe price ids", () => {
    const ids = Object.values(PRICES).flatMap((c) => Object.values(c).map((p) => p.id));
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => id.startsWith("price_"))).toBe(true);
  });
});

describe("feature gating", () => {
  it("locks Pro-only features on free", () => {
    expect(allowance(FREE_PLAN, "scan")).toBe(0);
    expect(allowance(FREE_PLAN, "replan")).toBe(0);
    expect(allowance(FREE_PLAN, "insight")).toBe(0);
  });
  it("gives free users a small compose allowance", () => {
    expect(allowance(FREE_PLAN, "compose")).toBe(3);
  });
  it("unlocks everything on Pro", () => {
    for (const f of Object.keys(FEATURES) as (keyof typeof FEATURES)[]) expect(allowance({ pro: true }, f)).toBeGreaterThan(0);
    expect(allowance({ pro: true }, "compose")).toBe(15);
  });
});
