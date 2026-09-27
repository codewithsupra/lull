import "server-only";
import { createHmac, hkdfSync } from "node:crypto";

/**
 * Community anonymity (see *_community.sql). Kept free of other dependencies so it can be tested
 * directly: these two functions are the whole identity model of the forum.
 */

let secret: Buffer | null = null;
/** Derived from HEALTH_DATA_KEY with HKDF, so there is no extra secret to manage or lose. */
function communitySecret(): Buffer {
  if (secret) return secret;
  const raw = process.env.HEALTH_DATA_KEY;
  if (!raw) throw new Error("Missing HEALTH_DATA_KEY");
  secret = Buffer.from(hkdfSync("sha256", Buffer.from(raw, "base64"), "lull-community", "author-key-v1", 32));
  return secret;
}

/** The only identity the forum knows: HMAC(secret, user id). Not reversible without the secret. */
export function authorKey(userId: string): string {
  return createHmac("sha256", communitySecret()).update(`author:${userId}`).digest("hex");
}

/** Per-thread alias seed: the same person has a stable name within a thread, a different one elsewhere. */
export function aliasSeed(key: string, threadId: string): [number, number] {
  const h = createHmac("sha256", communitySecret()).update(`alias:${key}:${threadId}`).digest();
  return [h.readUInt16BE(0), h.readUInt16BE(2)];
}
