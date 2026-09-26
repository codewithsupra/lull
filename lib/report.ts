import { z } from "zod";
import { LOCALES } from "@/lib/i18n/config";
import { redact } from "@/lib/redact";
import { PHQ9_RISK_ITEM, severity, type ScreenerRecord, type Severity } from "@/lib/screeners";
import type { Category, TaskKind } from "@/lib/care-plan";

/**
 * FR10 patient-held doctor report. Pure and client-safe: it turns the user's own data into a
 * snapshot and decides what a shared link may contain. Everything a doctor can ever see passes
 * through `buildReport` and `pickSections`, so the privacy rules live here and are unit-tested:
 *
 * - no account identifiers (id, email, name) exist anywhere in the `Report` type;
 * - a section the user did not tick is absent from the snapshot, not hidden by the renderer;
 * - free text (questions, an optional alias) is PII-scrubbed on the way in;
 * - mood check-in notes are never included, only numeric averages.
 */

export const REPORT_SECTIONS = ["screeners", "adherence", "mood", "medications", "questions", "flags"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/** How far back a report looks. Long enough for a 12-week follow-up, short enough to stay relevant. */
export const REPORT_WINDOW_DAYS = 90;
/** At most this many screening points on the trend chart (roughly biweekly over the window). */
export const MAX_SCREENER_POINTS = 13;
export const MAX_QUESTIONS = 10;

export const EXPIRY_DAYS = { "1d": 1, "7d": 7, "30d": 30 } as const;
export type Expiry = keyof typeof EXPIRY_DAYS;

/** Pro accounts can create this many share links per rolling 24h. */
export const SHARES_PER_DAY = 10;

export const ShareRequest = z.object({
  sections: z
    .array(z.enum(REPORT_SECTIONS))
    .min(1)
    .max(REPORT_SECTIONS.length)
    .transform((s) => REPORT_SECTIONS.filter((id) => s.includes(id))),
  expires: z.enum(["1d", "7d", "30d"]),
  locale: z.enum(LOCALES),
  alias: z.string().trim().max(40).optional().default(""),
  questions: z.array(z.string().trim().min(1).max(300)).max(5).default([]),
});
export type ShareRequest = z.infer<typeof ShareRequest>;

export type ScreenerPoint = { at: string; phq9: number; gad7: number; sleep: number };

export type Report = {
  v: 1;
  generated_at: string;
  period: { from: string; to: string };
  /** Optional name or initials the user typed for their doctor. Never taken from the account. */
  alias: string | null;
  category: Category | null;
  sections: ReportSection[];
  screeners?: {
    points: ScreenerPoint[];
    latest: { phq9: Severity; gad7: Severity; sleep: Severity } | null;
    /** Latest minus first score in the window; null with fewer than two points. */
    change: { phq9: number; gad7: number; sleep: number } | null;
    /** How many screenings in the window had PHQ-9 item 9 (thoughts of self-harm) above zero. */
    risk_endorsed: number;
  };
  adherence?: {
    weeks: { week: number; from: string; med_due: number; med_done: number; all_due: number; all_done: number }[];
    /** Whole-number percentages, null when nothing was due. */
    med_rate: number | null;
    all_rate: number | null;
  };
  mood?: {
    /** Weekly averages on the 1–5 scale, weeks starting Monday. */
    weeks: { from: string; mood: number; energy: number; n: number }[];
    checkins: number;
  };
  medications?: { name: string; dose: string | null; times: string[] }[];
  questions?: string[];
  flags?: string[];
};

export type ReportInput = {
  /** The user's local calendar date, YYYY-MM-DD. */
  today: string;
  screeners: ScreenerRecord[];
  plan: {
    category: Category;
    started_at: string;
    doctor_questions: string[];
    doctor_flags: string[];
    medications: { name: string; dose: string | null; times: string[] }[];
  } | null;
  tasks: { day: string; kind: TaskKind; completed_at: string | null }[];
  checkins: { mood: number; energy: number; created_at: string }[];
};

const DAY_MS = 86_400_000;

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Monday of the (UTC) week containing `date`. */
export function weekStart(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

const pct = (done: number, due: number) => (due > 0 ? Math.round((done / due) * 100) : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function expiresAt(expiry: Expiry, now: Date): string {
  return new Date(now.getTime() + EXPIRY_DAYS[expiry] * DAY_MS).toISOString();
}

/** PII-scrubs, trims and de-duplicates (case-insensitively) a list of free-text questions. */
export function cleanQuestions(questions: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of questions) {
    const clean = redact(q).slice(0, 300);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

function screenerSection(records: ScreenerRecord[], from: string): NonNullable<Report["screeners"]> {
  const inWindow = records
    .filter((r) => r.at.slice(0, 10) >= from)
    .sort((a, b) => a.at.localeCompare(b.at));
  const points = inWindow.slice(-MAX_SCREENER_POINTS).map((r) => ({ at: r.at, phq9: r.phq9.score, gad7: r.gad7.score, sleep: r.sleep.score }));
  const first = points[0];
  const last = points[points.length - 1];
  return {
    points,
    latest: last ? { phq9: severity("phq9", last.phq9), gad7: severity("gad7", last.gad7), sleep: severity("sleep", last.sleep) } : null,
    change: points.length >= 2 ? { phq9: last.phq9 - first.phq9, gad7: last.gad7 - first.gad7, sleep: last.sleep - first.sleep } : null,
    // Counted over every screening in the window, not just the charted ones: never under-report risk.
    risk_endorsed: inWindow.filter((r) => (r.phq9.answers[PHQ9_RISK_ITEM] ?? 0) > 0).length,
  };
}

function adherenceSection(input: ReportInput): NonNullable<Report["adherence"]> {
  const byWeek = new Map<number, { week: number; from: string; med_due: number; med_done: number; all_due: number; all_done: number }>();
  const plan = input.plan;
  if (plan) {
    // Only days that have actually arrived count as "due": future tasks aren't missed yet.
    for (const t of input.tasks) {
      if (t.day > input.today || t.day < plan.started_at) continue;
      const week = Math.floor(daysBetween(plan.started_at, t.day) / 7) + 1;
      const w = byWeek.get(week) ?? { week, from: addDays(plan.started_at, (week - 1) * 7), med_due: 0, med_done: 0, all_due: 0, all_done: 0 };
      w.all_due++;
      if (t.completed_at) w.all_done++;
      if (t.kind === "medication") {
        w.med_due++;
        if (t.completed_at) w.med_done++;
      }
      byWeek.set(week, w);
    }
  }
  const weeks = [...byWeek.values()].sort((a, b) => a.week - b.week);
  const sum = (k: "med_due" | "med_done" | "all_due" | "all_done") => weeks.reduce((n, w) => n + w[k], 0);
  return { weeks, med_rate: pct(sum("med_done"), sum("med_due")), all_rate: pct(sum("all_done"), sum("all_due")) };
}

function moodSection(checkins: ReportInput["checkins"], from: string, to: string): NonNullable<Report["mood"]> {
  const byWeek = new Map<string, { mood: number; energy: number; n: number }>();
  let count = 0;
  for (const c of checkins) {
    const day = c.created_at.slice(0, 10);
    if (day < from || day > to) continue;
    count++;
    const key = weekStart(day);
    const w = byWeek.get(key) ?? { mood: 0, energy: 0, n: 0 };
    w.mood += c.mood;
    w.energy += c.energy;
    w.n++;
    byWeek.set(key, w);
  }
  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekFrom, w]) => ({ from: weekFrom, mood: round1(w.mood / w.n), energy: round1(w.energy / w.n), n: w.n }));
  return { weeks, checkins: count };
}

/**
 * Builds the full snapshot (every section). Callers that share it must pass the result through
 * `pickSections` so unticked sections are removed before anything is stored or sent.
 */
export function buildReport(input: ReportInput, opts: { alias?: string; questions?: string[]; now: Date }): Report {
  const to = input.today;
  const from = addDays(to, -(REPORT_WINDOW_DAYS - 1));
  const alias = opts.alias ? redact(opts.alias).slice(0, 40) || null : null;
  return {
    v: 1,
    generated_at: opts.now.toISOString(),
    period: { from, to },
    alias,
    category: input.plan?.category ?? null,
    sections: [...REPORT_SECTIONS],
    screeners: screenerSection(input.screeners, from),
    adherence: adherenceSection(input),
    mood: moodSection(input.checkins, from, to),
    medications: (input.plan?.medications ?? []).map(({ name, dose, times }) => ({ name, dose, times: [...times].sort() })),
    questions: cleanQuestions([...(input.plan?.doctor_questions ?? []), ...(opts.questions ?? [])]),
    flags: input.plan?.doctor_flags ?? [],
  };
}

/** Returns a copy holding only the chosen sections. Unchosen sections are deleted, not emptied. */
export function pickSections(report: Report, sections: readonly ReportSection[]): Report {
  const keep = REPORT_SECTIONS.filter((s) => sections.includes(s));
  const out: Report = { v: report.v, generated_at: report.generated_at, period: report.period, alias: report.alias, category: report.category, sections: keep };
  for (const s of keep) {
    if (report[s] !== undefined) (out as Record<ReportSection, unknown>)[s] = report[s];
  }
  return out;
}

/** True when a section has something worth showing (the UI greys out empty ones). */
export function hasContent(report: Report, section: ReportSection): boolean {
  switch (section) {
    case "screeners":
      return (report.screeners?.points.length ?? 0) > 0;
    case "adherence":
      return (report.adherence?.weeks.length ?? 0) > 0;
    case "mood":
      return (report.mood?.checkins ?? 0) > 0;
    case "medications":
      return (report.medications?.length ?? 0) > 0;
    case "questions":
      return (report.questions?.length ?? 0) > 0;
    case "flags":
      return (report.flags?.length ?? 0) > 0;
  }
}

/** A share link as its owner sees it in the list. Never includes the token or the sealed report. */
export type ShareRow = {
  id: string;
  sections: string[];
  locale: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
};

export type ShareStatus = "active" | "expired" | "revoked";

export function shareStatus(share: { expires_at: string; revoked_at: string | null }, now: Date): ShareStatus {
  if (share.revoked_at) return "revoked";
  return Date.parse(share.expires_at) <= now.getTime() ? "expired" : "active";
}
