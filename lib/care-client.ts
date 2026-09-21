"use client";

import { getInsforge } from "@/lib/insforge/client";
import type { PlanView } from "@/lib/care-plan";

export function localToday(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export type CareStats = {
  xp: number;
  streak: number;
  today: { done: number; total: number };
  plan: { id: string; week: number; started_at: string } | null;
  week_days: { day: string; done: number; total: number }[];
};

export async function fetchPlan(): Promise<PlanView | null> {
  const res = await fetch(`/api/plan?today=${localToday()}`, { cache: "no-store" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't load your plan.");
  return (await res.json()).plan;
}

export async function fetchCareStats(): Promise<CareStats | null> {
  const { data, error } = await getInsforge().database.rpc("care_stats", { p_today: localToday() });
  return error ? null : (data as CareStats);
}

export async function completeTask(id: string, done = true) {
  const { data, error } = await getInsforge().database.rpc("complete_task", { p_task: id, p_done: done });
  if (error) throw new Error(error.message);
  return data as { id: string; done: boolean; xp: number; day_complete: boolean };
}

// ---------- push ----------

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("This browser can't do reminders. On iPhone, add Lull to your Home Screen first.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked for this site.");
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    }));
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  if (!res.ok) throw new Error("Couldn't turn on reminders.");
}

export async function disablePush() {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}
