const today = {
  greeting: {
    hello: "Hello",
    stillUp: "Still up",
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    windingDown: "Winding down",
  },
  guestNote: "You're exploring as a guest. Breathe and Sounds work fully. Sign up to save your streak, check-ins and composed sessions.",

  plan: {
    label: "your plan · week {week} of 4",
    doneToday: "{done}/{total} done today",
    streak: "🔥 {days} day streak",
    newLabel: "new · care plan",
    newTitle: "Turn your prescription into a daily plan →",
    newBody: "Scan it or describe your diagnosis. Private and encrypted, with XP for every step.",
  },

  check: {
    dueLabel: "your 2-week check is due",
    firstLabel: "start here · 3 minutes",
    dueBody: "See how far you've come since last time.",
    firstBody: "Take the wellbeing check to find the right support for you.",
  },

  tiles: {
    streak: "day streak",
    minutes: "minutes calm",
    sessions: "sessions",
    checkins: "check-ins",
  },

  suggested: "suggested now",
  suggestions: {
    sleep: { title: "Sleep, composed", body: "A 4-7-8 session with warm rain that fades out on its own." },
    sleepQuery: "I want to fall asleep and let go of today",
    morning: { title: "Set the tone", body: "Three minutes of coherent breathing before the inbox." },
    midday: { title: "Midday reset", body: "Try a physiological sigh when stress spikes. It takes about 60 seconds." },
    evening: { title: "Leave the day at the door", body: "Tell Lull about your day and let it compose the wind-down." },
  },

  moodHeading: "Mood · last 14 check-ins",
  journalLink: "journal →",
  recentHeading: "Recent practice",
  recentEmpty: "Your sessions will show up here.",
  recentGuest: "Sign in to keep a history.",
} as const;

export default today;
