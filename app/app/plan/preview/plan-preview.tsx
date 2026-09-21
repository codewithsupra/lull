"use client";

import { useSyncExternalStore } from "react";
import { IntakeWizard } from "@/components/plan/intake-wizard";
import { PlanHome } from "@/components/plan/plan-home";
import { localToday } from "@/lib/care-client";
import type { PlanView } from "@/lib/care-plan";

function day(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localToday(d);
}

const MOCK: PlanView = {
  id: "demo",
  category: "insomnia",
  week: 1,
  started_at: day(-3),
  title: "Quiet Nights, Brighter Days",
  summary: "Over four weeks we'll anchor your wake time, shrink the 3am worry loop and make bed a place for sleep again, alongside your medicines exactly as prescribed.",
  roadmap: [
    { week: 1, theme: "Anchor the rhythm", focus: "Consistent wake time, morning light, caffeine cut-off." },
    { week: 2, theme: "Wind-down ritual", focus: "A 30-minute buffer before bed and scheduled worry time." },
    { week: 3, theme: "Bed = sleep", focus: "Stimulus control: leave bed if awake >20 min." },
    { week: 4, theme: "Make it yours", focus: "Keep what works, lighten what doesn't." },
  ],
  learn: [
    { title: "Why wake time matters more than bedtime", body: "Your body clock is set most strongly by when you wake and see light. A fixed wake time, even after a bad night, builds sleep pressure for the next one." },
    { title: "Caffeine's long tail", body: "Caffeine has a half-life of about 5–6 hours. A 3pm coffee is still half-active at 9pm." },
    { title: "What sleep medicines generally do", body: "Sleep medicines help you fall asleep but don't teach your body a rhythm. Habits do that. Never change a dose without your doctor." },
  ],
  doctor_questions: ["Is my current dose right for the long term?", "How long should I stay on this medicine?", "Could my morning grogginess be related to the timing?"],
  doctor_flags: ["Ask your doctor about driving the morning after your bedtime medicine, if you feel groggy."],
  medications: [
    { id: "m1", name: "Sertraline", dose: "50 mg", instructions: "After breakfast", times: ["08:00"] },
    { id: "m2", name: "Melatonin", dose: "3 mg", instructions: "30 min before bed", times: ["22:30"] },
  ],
  tasks: [
    { id: "t0", day: day(0), slot: "morning", remind_at: "07:00", kind: "habit", title: "Up at 7:00 — same time every day", detail: "Even after a rough night. This is the single strongest lever for your body clock.", session_ref: null, xp: 15, completed_at: new Date().toISOString() },
    { id: "t1", day: day(0), slot: "morning", remind_at: "07:15", kind: "habit", title: "10 minutes of daylight", detail: "Step outside or sit by a bright window. Morning light sets tonight's melatonin timer.", session_ref: null, xp: 15, completed_at: new Date().toISOString() },
    { id: "t2", day: day(0), slot: "morning", remind_at: "08:00", kind: "medication", title: "Sertraline · 50 mg", detail: "After breakfast", session_ref: null, xp: 20, completed_at: null },
    { id: "t3", day: day(0), slot: "morning", remind_at: null, kind: "learn", title: "Why wake time matters more than bedtime", detail: "Your body clock is set most strongly by when you wake.", session_ref: null, xp: 10, completed_at: null },
    { id: "t4", day: day(0), slot: "afternoon", remind_at: "14:00", kind: "habit", title: "Last coffee before 2pm", detail: "Caffeine has a 5–6 hour half-life.", session_ref: null, xp: 15, completed_at: null },
    { id: "t5", day: day(0), slot: "night", remind_at: "22:15", kind: "session", title: "4-7-8 wind-down breath", detail: "Five minutes of 4-7-8 to slow your heart rate before bed.", session_ref: "breathe:478:5", xp: 30, completed_at: null },
    { id: "t6", day: day(0), slot: "night", remind_at: "22:30", kind: "medication", title: "Melatonin · 3 mg", detail: "30 min before bed", session_ref: null, xp: 20, completed_at: null },
    { id: "t7", day: day(0), slot: "night", remind_at: "22:30", kind: "reflect", title: "What felt a little lighter today?", detail: null, session_ref: null, xp: 10, completed_at: null },
  ],
  week_complete_ratio: 0.62,
  can_replan: false,
};

export function PlanPreview({ view }: { view: "home" | "wizard" }) {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!mounted) return null;
  if (view === "wizard") return <IntakeWizard onCreated={() => {}} />;
  return (
    <PlanHome
      plan={MOCK}
      onChanged={() => {}}
      onDeleted={() => {}}
      demoStats={{
        xp: 745,
        streak: 4,
        today: { done: 2, total: 8 },
        plan: { id: "demo", week: 1, started_at: day(-3) },
        week_days: [
          { day: day(-3), done: 8, total: 8 },
          { day: day(-2), done: 5, total: 8 },
          { day: day(-1), done: 8, total: 8 },
          { day: day(0), done: 2, total: 8 },
        ],
      }}
    />
  );
}
