"use client";

import { EMPTY_PLAN, SafetyPlan } from "@/lib/safety";

const KEY = "lull.safety.v1";
const EVENT = "lull:crisis";

export type CachedSafety = { plan: SafetyPlan | null; country: string | null; updated_at: string | null };

/**
 * The safety plan is mirrored to this device so it opens instantly and works offline.
 * It is cleared on sign-out and when the user deletes their data.
 */
export function readCachedSafety(): CachedSafety {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { plan: null, country: null, updated_at: null };
    const parsed = JSON.parse(raw) as CachedSafety;
    return { plan: parsed.plan ? SafetyPlan.parse(parsed.plan) : null, country: parsed.country ?? null, updated_at: parsed.updated_at ?? null };
  } catch {
    return { plan: null, country: null, updated_at: null };
  }
}

export function cacheSafety(value: CachedSafety) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}

export function clearSafetyCache() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export async function fetchSafety(): Promise<CachedSafety> {
  const res = await fetch("/api/safety", { cache: "no-store" });
  if (res.status === 401) {
    clearSafetyCache();
    throw new Error("Sign in first.");
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Couldn't load your safety plan.");
  const value: CachedSafety = { plan: json.plan ? SafetyPlan.parse(json.plan) : null, country: json.plan?.country ?? json.country ?? null, updated_at: json.updated_at ?? null };
  cacheSafety(value);
  return value;
}

export async function saveSafety(plan: SafetyPlan): Promise<CachedSafety> {
  const res = await fetch("/api/safety", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Couldn't save your safety plan.");
  const value: CachedSafety = { plan: SafetyPlan.parse(json.plan), country: json.plan?.country ?? null, updated_at: json.updated_at };
  cacheSafety(value);
  return value;
}

export const emptyPlan = () => ({ ...EMPTY_PLAN });

// Global open/close so any screen can raise the crisis sheet in one tap.
export function openCrisis() {
  window.dispatchEvent(new CustomEvent(EVENT));
}
export function onCrisis(fn: () => void) {
  const h = () => fn();
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
