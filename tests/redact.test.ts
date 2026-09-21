import { describe, expect, it } from "vitest";
import { redact, redactDeep } from "@/lib/redact";

const RX = `Patient: Jane Doe  Age/Sex: 34/F  DOB: 12/03/1990
Dr. Anil Kumar Sharma, MBBS  Reg. No: 4455667  Ph: +91 98765 43210  jane@example.com
UHID 123456789012
1) Tab Sertraline 50 mg 1-0-0 after breakfast x 30 days
2) Tab Melatonin 3mg 0-0-1 30 min before bed
3) Clonazepam 0.25 mg SOS`;

describe("redact", () => {
  const out = redact(RX);

  it.each(["Jane", "Doe", "1990", "98765", "jane@", "Anil", "Sharma", "4455667", "123456789012", "34/F"])("removes PII: %s", (pii) => {
    expect(out).not.toContain(pii);
  });

  it.each(["Sertraline 50 mg", "1-0-0", "Melatonin 3mg", "0-0-1", "Clonazepam 0.25 mg", "x 30 days", "SOS"])("keeps clinical content: %s", (keep) => {
    expect(out).toContain(keep);
  });

  it("does not merge lines when redacting ids", () => {
    expect(out).toMatch(/\n1\) Tab Sertraline/);
  });

  it("leaves harmless text untouched", () => {
    for (const s of ["after breakfast x 30 days", "for 2 weeks", "Take 1 tablet daily", "10/325 mg"]) expect(redact(s)).toBe(s);
  });

  it("redacts nested strings and preserves structure", () => {
    const v = redactDeep({ a: ["call 9876543210"], b: { c: "mail x@y.com", n: 3 }, d: null });
    expect(v).toEqual({ a: ["call [phone]"], b: { c: "mail [email]", n: 3 }, d: null });
  });
});
