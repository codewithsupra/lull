import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import type { Report } from "@/lib/report";

/**
 * Share-link crypto for doctor reports (FR10). The link *is* the key:
 *
 * - the token is 32 random bytes (base64url, 43 chars) and is shown to the user exactly once;
 * - the database stores only SHA-256(token), which is what the lookup function matches on;
 * - the snapshot is sealed with AES-256-GCM under a key derived from the token with HKDF.
 *
 * So a full database dump plus HEALTH_DATA_KEY still can't read a shared report — and nor can
 * we, once the link is gone. Ciphertext is `r1:<iv>:<tag>:<data>` (base64url parts), a separate
 * prefix from the `v1:` health-field format so the two can never be confused.
 */

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function keyFor(token: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(token, "utf8"), "lull-report-share", "r1", 32));
}

export function sealReport(report: Report, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(token), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(report), "utf8"), cipher.final()]);
  return ["r1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

/** Throws if the token is wrong or the ciphertext was tampered with (GCM authentication). */
export function openReport(sealed: string, token: string): Report {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "r1" || !iv || !tag || data === undefined) throw new Error("Malformed report ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", keyFor(token), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8")) as Report;
}
