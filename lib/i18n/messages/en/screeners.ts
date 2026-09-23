/**
 * Screening instrument wording and the stepped-care explanations (FR1).
 *
 * PHQ-9 and GAD-7 are reproduced and translated freely by design: their authors placed no
 * restriction on reproduction, translation or display. That freedom does not make a translation
 * *valid* — a mistranslated item silently changes what is being measured. Any new language must
 * be checked by a clinician who speaks it before it is presented as a validated instrument;
 * until then LOCALE_META[locale].clinicallyReviewed stays false and the UI says so.
 */
const screeners = {
  reviewPending: "This Hindi translation is awaiting clinical review. Your scores still route you correctly, but treat the wording as a guide.",

  instruments: {
    phq9: {
      name: "PHQ-9",
      label: "Mood (PHQ-9)",
      stem: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
      items: [
        "Little interest or pleasure in doing things",
        "Feeling down, depressed, or hopeless",
        "Trouble falling or staying asleep, or sleeping too much",
        "Feeling tired or having little energy",
        "Poor appetite or overeating",
        "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
        "Trouble concentrating on things, such as reading the newspaper or watching television",
        "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
        "Thoughts that you would be better off dead or of hurting yourself in some way",
      ],
    },
    gad7: {
      name: "GAD-7",
      label: "Anxiety (GAD-7)",
      stem: "Over the last 2 weeks, how often have you been bothered by the following problems?",
      items: [
        "Feeling nervous, anxious or on edge",
        "Not being able to stop or control worrying",
        "Worrying too much about different things",
        "Trouble relaxing",
        "Being so restless that it is hard to sit still",
        "Becoming easily annoyed or irritable",
        "Feeling afraid as if something awful might happen",
      ],
    },
    sleep: {
      name: "Sleep snapshot",
      label: "Sleep snapshot",
      stem: "Thinking about the last 2 weeks…",
      items: [
        "How often did it take you a long time to fall asleep?",
        "How often did you wake in the night and struggle to get back to sleep?",
        "How often did poor sleep affect your next day?",
      ],
    },
  },

  frequency: ["Not at all", "Several days", "More than half the days", "Nearly every day"],

  difficulty: {
    stem: "If you noticed any of these problems…",
    question: "How difficult have they made it to do your work, take care of things at home, or get along with other people?",
    options: ["Not difficult at all", "Somewhat difficult", "Very difficult", "Extremely difficult"],
  },

  followup: {
    label: "a little more, so we can support you",
    heading: "Thank you for being honest.",
    thoughtsNow: "Are you having thoughts of ending your life right now, today?",
    planOrIntent: "Have you thought about how you might do it, or do you intend to act on these thoughts?",
    yes: "Yes",
    no: "No",
    continue: "Continue",
    checkingIn: "Checking in",
  },

  crisisCard: "Thank you for telling us. If you're having thoughts of hurting yourself, please reach out to someone now — you deserve support right away.",

  lastQuestion: "Last question",
  submitting: "Understanding your answers privately…",
  keyHint: "press 1–4 to answer",

  severity: {
    minimal: "Minimal",
    mild: "Mild",
    moderate: "Moderate",
    moderately_severe: "Moderately severe",
    severe: "Severe",
  },
  nonClinical: " (non-clinical)",

  tiers: {
    0: {
      name: "Urgent support",
      headline: "Right now, talking to someone matters most.",
      next: "Please contact a crisis line or emergency services now. Your safety plan and helplines are one tap away.",
    },
    1: {
      name: "Self-guided",
      headline: "You're doing okay. Let's build on it.",
      next: "Your Care Plan, breathing and sleep tools are a great fit. We'll check in again in two weeks.",
    },
    2: {
      name: "Guided support",
      headline: "Things are weighing on you. You don't have to do this alone.",
      next: "A structured Care Plan plus a peer circle is recommended. If it doesn't ease in a few weeks, we'll suggest a therapist.",
    },
    3: {
      name: "Therapist recommended",
      headline: "It would really help to talk to a professional.",
      next: "Your answers suggest support from a qualified therapist or doctor would help. Lull will keep supporting you alongside them.",
    },
  },

  reasons: {
    risk_current: "Current thoughts of self-harm reported",
    phq9_high: "PHQ-9 in the moderately severe or severe range",
    gad7_high: "GAD-7 in the severe range",
    risk_recent: "Thoughts of death or self-harm reported in the last two weeks",
    not_improving: "Not improving after 6 weeks of self-help",
    phq9_moderate: "PHQ-9 in the moderate range",
    gad7_moderate: "GAD-7 in the moderate range",
    minimal: "Scores in the minimal-to-mild range",
  },

  results: {
    carePath: "your care path · {tier}",
    callUrgent: "Call Tele-MANAS 14416 now",
    callCounsellor: "Talk to a counsellor (free, 14416)",
    openPlan: "Open my Care Plan →",
    buildPlan: "Build my Care Plan →",
    circlesSoon: "peer circles are coming soon",
    talkHeading: "Talk to someone",
    openHelpNow: "Open help now",
    writeSafetyPlan: "Write my safety plan →",
    supportNote:
      "A safety plan takes 5 minutes now and is one tap away later, even offline. Our therapist network is launching soon, and you can also show these results to your doctor.",
    thisCheck: "This check",
    sinceLast: "Since last time: mood {mood}, anxiety {anxiety}.",
    unchanged: "unchanged",
    better: "↓ {points} points (better)",
    worse: "↑ {points} points",
    trendHeading: "Your trend",
    trendEmpty: "Your trend appears after your next check in two weeks.",
    trendLabel: "PHQ-9 and GAD-7 over time",
    legendMood: "PHQ-9 (mood)",
    legendAnxiety: "GAD-7 (anxiety)",
    lowerIsBetter: "lower is better",
    disclaimer: "This is a screening, not a diagnosis. Only a qualified professional can diagnose. Your answers are encrypted.",
    nextCheck: "Next check: {date}",
    retake: "retake",
    supportLines: {
      teleManas: "Tele-MANAS (India, free, 24/7)",
      icall: "iCall · TISS counselling (India)",
      global: "Find a helpline anywhere",
    },
  },
} as const;

export default screeners;
