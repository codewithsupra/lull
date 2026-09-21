import { describe, expect, it } from "vitest";
import { decrypt, decryptJson, decryptOpt, encrypt, encryptJson, encryptOpt } from "@/lib/crypto";

describe("field encryption", () => {
  it("round-trips unicode text", () => {
    const s = "Sertraline · 50 mg — सुबह नाश्ते के बाद 🌙";
    expect(decrypt(encrypt(s))).toBe(s);
  });

  it("uses the versioned v1 format and a fresh IV each time", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a.startsWith("v1:")).toBe(true);
    expect(a.split(":")).toHaveLength(4);
    expect(a).not.toBe(b);
  });

  it("detects tampering (GCM auth tag)", () => {
    const c = encrypt("dose 50mg");
    const parts = c.split(":");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });

  it("rejects malformed payloads and unknown key versions", () => {
    expect(() => decrypt("garbage")).toThrow();
    expect(() => decrypt("v9:a:b:c")).toThrow();
  });

  it("handles optional and JSON helpers", () => {
    expect(encryptOpt("")).toBeNull();
    expect(decryptOpt(null)).toBeNull();
    expect(decryptJson(encryptJson({ a: [1, "x"] }))).toEqual({ a: [1, "x"] });
  });
});
