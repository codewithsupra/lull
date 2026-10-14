import "server-only";
import { decrypt } from "@/lib/crypto";
import { stripForeign } from "@/lib/privacy";

// ---------- export: turning stored rows into something a person can read ----------

/**
 * Decrypts every `*_enc` column it finds (generic on purpose: a future encrypted column is
 * exported without anyone remembering to add it here), then strips anything pointing at another
 * person or at a secret.
 */
export function readable(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k.endsWith("_enc") && typeof v === "string" && v.startsWith("v1:")) {
      let plain: unknown;
      try {
        const text = decrypt(v);
        try {
          plain = JSON.parse(text);
        } catch {
          plain = text;
        }
      } catch {
        plain = "[unreadable]";
      }
      out[k.slice(0, -4)] = plain;
    } else {
      out[k] = v;
    }
  }
  return stripForeign(out);
}
