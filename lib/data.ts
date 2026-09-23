"use client";

import { getInsforge } from "@/lib/insforge/client";

export type PracticeKind = "breathe" | "soundscape" | "composed" | "sleep";

export type MoodCheckin = {
  id: string;
  mood: number;
  energy: number;
  tags: string[];
  note: string | null;
  created_at: string;
};

export type PracticeSession = {
  id: string;
  kind: PracticeKind;
  title: string;
  duration_sec: number;
  created_at: string;
};

export type Stats = { total_minutes: number; session_count: number; streak: number; checkin_count: number };

/** Records a finished practice. Sessions under 20 seconds are not worth logging. */
export async function logPractice(kind: PracticeKind, title: string, durationSec: number) {
  const seconds = Math.round(durationSec);
  if (seconds < 20) return;
  const { error } = await getInsforge().database
    .from("practice_sessions")
    .insert([{ kind, title: title.slice(0, 120), duration_sec: Math.min(seconds, 86400) }]);
  if (error) console.warn("Could not log practice", error.message);
}

export async function fetchStats(): Promise<Stats | null> {
  const { data, error } = await getInsforge().database.rpc("my_stats");
  if (error) return null;
  return data as Stats;
}

export async function fetchRecentPractice(limit = 6) {
  const { data } = await getInsforge().database
    .from("practice_sessions")
    .select("id, kind, title, duration_sec, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PracticeSession[];
}

export async function fetchCheckins(limit = 30) {
  const { data } = await getInsforge().database
    .from("mood_checkins")
    .select("id, mood, energy, tags, note, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MoodCheckin[];
}

export async function addCheckin(input: { mood: number; energy: number; tags: string[]; note: string }) {
  const { data, error } = await getInsforge().database
    .from("mood_checkins")
    .insert([{ ...input, note: input.note.trim() || null }])
    .select("id, mood, energy, tags, note, created_at");
  if (error) throw new Error(error.message);
  return (data as MoodCheckin[])[0];
}

export async function deleteCheckin(id: string) {
  const { error } = await getInsforge().database.from("mood_checkins").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Faces and colours only; the mood names live in `t.tools.checkin.moods`. */
export const MOODS = [
  { v: 1, face: "◡̈", color: "#7d8bff" },
  { v: 2, face: "◡", color: "#8aa6ff" },
  { v: 3, face: "—", color: "#8ed7f5" },
  { v: 4, face: "◠", color: "#8ef5d4" },
  { v: 5, face: "✦", color: "#c8ff6e" },
] as const;
export type MoodValue = (typeof MOODS)[number]["v"];

/** Tag ids. Stored as-is (stable across languages) and displayed via `t.tools.checkin.tags`. */
export const TAGS = ["anxious", "stressed", "tired", "restless", "sad", "calm", "focused", "grateful", "hopeful", "lonely"] as const;
export type TagId = (typeof TAGS)[number];

export function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m${s ? ` ${s}s` : ""}` : `${s}s`;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
