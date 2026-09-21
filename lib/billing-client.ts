"use client";

import type { Feature, Interval, Plan } from "@/lib/billing";

const EVENT = "lull:upgrade";

export function openPaywall(feature?: Feature) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { feature } }));
}

export function onPaywall(fn: (feature?: Feature) => void) {
  const handler = (e: Event) => fn((e as CustomEvent<{ feature?: Feature }>).detail?.feature);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Call with any API JSON response: opens the upgrade sheet on a 402 and reports whether it did. */
export function handlePaywall(status: number, json: { upgrade?: boolean; feature?: Feature }) {
  if (status === 402 && json?.upgrade) {
    openPaywall(json.feature);
    return true;
  }
  return false;
}

export async function fetchBilling(): Promise<{ plan: Plan | null; currency: "inr" | "usd"; prices: Record<Interval, { id: string; label: string; perMonth: string; amount: number }> }> {
  const res = await fetch("/api/billing", { cache: "no-store" });
  return res.json();
}

export async function startCheckout(interval: Interval) {
  const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interval }) });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json.error ?? "Checkout failed"), { manage: json.manage });
  window.location.assign(json.url);
}

export async function startTrial(): Promise<Plan> {
  const res = await fetch("/api/billing/trial", { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Couldn't start trial");
  return json.plan;
}

export async function openPortal() {
  const res = await fetch("/api/billing/portal", { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Couldn't open billing");
  window.location.assign(json.url);
}
