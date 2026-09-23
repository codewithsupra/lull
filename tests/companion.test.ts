import { describe, expect, it } from "vitest";
import { CompanionInput, EMPTY_CONTEXT, MAX_MESSAGE, classify, contextBriefing, crisisReply, medicalBoundary, starters, systemPrompt } from "@/lib/companion";
import { LOCALES } from "@/lib/i18n";

// Phrases a person in crisis actually types. FR2 requires >= 95% recall on this set.
const CRISIS = [
  "I want to kill myself",
  "I don't want to be alive anymore",
  "thinking about suicide again tonight",
  "I've been cutting myself",
  "I keep hurting myself when it gets bad",
  "some nights I don't want to wake up",
  "I'd be better off dead",
  "I took a bunch of pills, I think I overdosed",
  "I want to end it all",
  "self-harm is the only thing that helps",
  "I don't want to live like this anymore",
  "my boyfriend hits me",
  "I'm being abused at home",
  "I want to hurt someone",
];

const SAFE = [
  "this deadline is killing me",
  "my back hurts after sitting all day",
  "I'm dead tired today",
  "work is killing my motivation",
  "I can't sleep and I'm exhausted",
  "I had a panic moment in the metro",
  "I feel flat and I don't know why",
  "my manager keeps cutting me off in meetings",
];

const MEDICAL = [
  "my friend takes 2mg of clonazepam, should I try that amount",
  "can you recommend a supplement for sleep",
  "prescribe me something for anxiety",
  "should I stop taking my sertraline?",
  "can I double my dose tonight?",
  "what dose of melatonin should I take",
  "is it okay to skip my medicine today",
  "do I have depression?",
  "can I mix my sleeping pill with alcohol",
  "should I take my antidepressant in the morning or at night",
];

describe("crisis detection", () => {
  it("catches at least 95% of crisis phrasings", () => {
    const caught = CRISIS.filter((t) => classify(t).kind === "crisis");
    expect(caught.length / CRISIS.length).toBeGreaterThanOrEqual(0.95);
  });

  it("does not fire on everyday figures of speech", () => {
    for (const t of SAFE) expect(classify(t).kind, t).not.toBe("crisis");
  });

  it("is case and punctuation insensitive", () => {
    expect(classify("I WANT TO KILL MYSELF.").kind).toBe("crisis");
    expect(classify("thinking about SUICIDE").kind).toBe("crisis");
  });
});

describe("medication and diagnosis boundary", () => {
  it("flags prescribing and diagnosis questions", () => {
    for (const t of MEDICAL) expect(classify(t).kind, t).toBe("medical");
  });

  it("leaves ordinary messages alone", () => {
    for (const t of SAFE) expect(classify(t).kind, t).toBe("ok");
  });

  it("treats crisis as higher priority than a medication question", () => {
    expect(classify("should I take all my pills and end it").kind).toBe("crisis");
  });
});

describe("input validation", () => {
  it("trims, requires content and caps length", () => {
    expect(CompanionInput.parse({ message: "  hi  " }).message).toBe("hi");
    expect(CompanionInput.safeParse({ message: "   " }).success).toBe(false);
    expect(CompanionInput.safeParse({ message: "x".repeat(MAX_MESSAGE + 1) }).success).toBe(false);
  });
});

describe("context briefing", () => {
  it("works with no context at all", () => {
    const b = contextBriefing(EMPTY_CONTEXT);
    expect(b).toContain("do not have a safety plan");
    expect(b).not.toContain("undefined");
    expect(b).not.toContain("null");
  });

  it("summarises plan, progress, scores and mood", () => {
    const b = contextBriefing({
      ...EMPTY_CONTEXT,
      firstName: "Supratim",
      tier: 2,
      phq9: 11,
      gad7: 9,
      planTitle: "Quiet Nights",
      planWeek: 2,
      todayDone: 3,
      todayTotal: 7,
      recentMood: [2, 3, 4],
      hasSafetyPlan: true,
      localTime: "11:40 pm",
    });
    expect(b).toContain("Supratim");
    expect(b).toContain("Quiet Nights");
    expect(b).toContain("week 2 of 4");
    expect(b).toContain("3 of 7");
    expect(b).toContain("PHQ-9 11");
    expect(b).toContain("moderate range");
    expect(b).toContain("average 3.0");
    expect(b).toContain("already have a safety plan");
  });

  it("tells the model not to quote scores unprompted", () => {
    expect(contextBriefing({ ...EMPTY_CONTEXT, phq9: 20, gad7: 18 })).toContain("do not quote these numbers");
  });

  it("escalates tone guidance for urgent tier", () => {
    expect(contextBriefing({ ...EMPTY_CONTEXT, tier: 0 })).toContain("urgent risk");
  });
});

describe("system prompt guardrails", () => {
  it("forbids medication, diagnosis and impersonation", () => {
    for (const rule of ["Never give advice about medication", "Never diagnose", "Never claim to be human"]) expect(systemPrompt()).toContain(rule);
  });
  it("names the CBT skills it should use", () => {
    for (const skill of ["Thought records", "Worry time", "Grounding", "Behavioural activation", "Self-compassion"]) expect(systemPrompt()).toContain(skill);
  });
  it("tells it to hand off on risk", () => {
    expect(systemPrompt()).toMatch(/suicide, self-harm, or being in danger/);
  });
});

describe("localised companion", () => {
  it.each(LOCALES)("keeps the safety rules in the %s prompt", (locale) => {
    const prompt = systemPrompt(locale);
    for (const rule of ["Never give advice about medication", "Never diagnose", "Never claim to be human"]) expect(prompt).toContain(rule);
    expect(prompt).toContain("Language:");
  });

  it("tells the model which language to reply in", () => {
    expect(systemPrompt("hi")).toMatch(/Devanagari/);
    expect(systemPrompt("en")).toMatch(/Write in English/);
  });

  it.each(LOCALES)("has a crisis reply, a medical boundary and starters in %s", (locale) => {
    // These are shown verbatim, so a missing translation would strand a user mid-crisis.
    expect(crisisReply(locale).length).toBeGreaterThan(80);
    expect(medicalBoundary(locale).length).toBeGreaterThan(80);
    expect(starters(locale).length).toBeGreaterThanOrEqual(4);
  });

  it("writes the Hindi crisis reply in Devanagari", () => {
    expect(crisisReply("hi")).toMatch(/[\u0900-\u097F]/);
    expect(medicalBoundary("hi")).toMatch(/[\u0900-\u097F]/);
  });
});
