"use client";

import { openCrisis } from "@/lib/safety-client";
import type { ReportReason } from "@/lib/community";

type Json = Record<string, unknown> & { error?: string };

/** POST helper: returns the JSON, and opens the crisis sheet when moderation flagged a crisis. */
export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; json: Json }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) return { ok: false, status: 0, json: {} };
  const json = (await res.json().catch(() => ({}))) as Json;
  if (json.crisis === true) openCrisis();
  return { ok: res.ok, status: res.status, json };
}

export const vote = (type: "post" | "comment", id: string) => postJson("/api/community/act", { action: "vote", type, id });
export const report = (type: "post" | "comment", id: string, reason: ReportReason) => postJson("/api/community/act", { action: "report", type, id, reason });
export const remove = (type: "post" | "comment", id: string) => postJson("/api/community/act", { action: "delete", type, id });
