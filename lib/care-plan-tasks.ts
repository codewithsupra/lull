import "server-only";
import { encrypt, encryptOpt } from "@/lib/crypto";
import { XP, slotForTime, type MedicationInput, type Slot, type TaskKind, type WeekPlan } from "@/lib/care-plan";

// ---------- dates & times ----------

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function shift(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function defaultTime(slot: Slot, wake: string, sleep: string) {
  if (slot === "morning") return shift(wake, 30);
  if (slot === "afternoon") return "13:30";
  if (slot === "evening") return "19:00";
  return shift(sleep, -45);
}

function runsOn(days: WeekPlan["habits"][number]["days"], weekday: number) {
  if (days === "daily") return true;
  if (days === "weekdays") return weekday >= 1 && weekday <= 5;
  if (days === "weekends") return weekday === 0 || weekday === 6;
  return days.length === 0 || days.includes(weekday);
}

// ---------- task materialization ----------

type TaskRow = {
  plan_id: string;
  week: number;
  day: string;
  slot: Slot;
  remind_at: string | null;
  kind: TaskKind;
  title_enc: string;
  detail_enc: string | null;
  session_ref: string | null;
  xp: number;
  sort: number;
};

/**
 * Builds one week of encrypted task rows. Medication tasks come straight from the user-confirmed
 * prescription (never from the model), so doses and timings can't drift.
 */
export function buildWeekTasks(args: {
  planId: string;
  week: number;
  startedAt: string;
  wake: string;
  sleep: string;
  medications: MedicationInput[];
  plan: WeekPlan;
}): TaskRow[] {
  const { planId, week, startedAt, wake, sleep, medications, plan } = args;
  const rows: TaskRow[] = [];

  for (let d = 0; d < 7; d++) {
    const day = addDays(startedAt, (week - 1) * 7 + d);
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const dayRows: Omit<TaskRow, "sort">[] = [];
    const push = (kind: TaskKind, title: string, detail: string | null, time: string | null, slot: Slot, ref: string | null = null) =>
      dayRows.push({
        plan_id: planId,
        week,
        day,
        slot,
        remind_at: time,
        kind,
        title_enc: encrypt(title),
        detail_enc: encryptOpt(detail),
        session_ref: ref,
        xp: XP[kind],
      });

    for (const med of medications) {
      // Never guess when a medicine is taken: untimed meds are listed, not scheduled.
      if (med.as_needed) continue;
      for (const t of med.times) {
        push("medication", [med.name, med.dose].filter(Boolean).join(" · "), med.instructions || "Exactly as prescribed.", t, slotForTime(t));
      }
    }
    for (const h of plan.habits) {
      if (!runsOn(h.days, weekday)) continue;
      const t = h.time ?? defaultTime(h.slot, wake, sleep);
      push("habit", h.title, h.detail || null, t, h.slot);
    }
    for (const s of plan.sessions) {
      if (!runsOn(s.days, weekday)) continue;
      const t = s.time ?? defaultTime(s.slot, wake, sleep);
      push("session", s.title, s.detail || null, t, s.slot, s.ref);
    }
    const card = plan.learn[d % plan.learn.length];
    push("learn", card.title, card.body, null, "morning");
    push("reflect", plan.reflect, null, shift(sleep, -30), "night");

    dayRows
      .sort((a, b) => (a.remind_at ?? "12:00").localeCompare(b.remind_at ?? "12:00"))
      .forEach((r, i) => rows.push({ ...r, sort: i }));
  }
  return rows;
}
