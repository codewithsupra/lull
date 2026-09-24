/**
 * User-facing API errors. Clients render `json.error` directly, so these have to be translated
 * or a Hindi screen ends up with an English error on it — exactly when something has gone wrong
 * and clarity matters most.
 *
 * Internal failures that a user never reads ("Bad request", "Unauthorized") stay in English in
 * the route, since they are for us, not for them.
 */
const errors = {
  signIn: "Sign in first.",

  screeners: {
    loadFailed: "Couldn't load your check-ins.",
    incomplete: "Please answer every question.",
    tooSoon: "You just completed a check. Take a breath and come back later.",
    saveFailed: "Couldn't save your answers. Please try again.",
  },

  plan: {
    loadFailed: "Couldn't load your plan.",
    incomplete: "Some answers are missing. Check the form and try again.",
    tooMany: "You've generated several plans today. Try again tomorrow.",
    generateFailed: "The planner stumbled. Give it another try in a moment.",
    saveFailed: "Couldn't save your plan.",
    deleteFailed: "Couldn't delete everything. Please try again.",
    none: "No active plan.",
    allWeeksDone: "You've completed all four weeks.",
    lockedUntilWeekEnd: "Your next week unlocks on the last day of this one.",
    tryTomorrow: "Try again tomorrow.",
    replanFailed: "The planner stumbled. Try again in a moment.",
    replanSaveFailed: "Couldn't save next week.",
  },

  compose: {
    signIn: "Sign in to compose sessions.",
    tooShort: "Tell Lull a little more about how you feel.",
    tooMany: "You've composed a lot today. Replay one from your history, or come back tomorrow.",
    failed: "The composer lost its train of thought. Try again in a moment.",
  },

  insight: {
    tooMany: "That's plenty of insight for today. Come back tomorrow.",
    needMore: "Log at least 3 check-ins to unlock insights.",
    failed: "Couldn't read your patterns right now. Try again shortly.",
  },

  safety: {
    loadFailed: "Couldn't load your safety plan.",
    invalid: "Some entries are too long or empty.",
    saveFailed: "Couldn't save your safety plan.",
    deleteFailed: "Couldn't delete.",
  },

  scan: {
    missing: "Attach a photo or PDF of your prescription.",
    tooLarge: "That file is over 8 MB. Try a smaller photo.",
    wrongType: "Use a JPG, PNG, WEBP, HEIC photo or a PDF.",
    tooMany: "You've scanned a lot today. Add medicines manually, or try again tomorrow.",
    unreadable: "We couldn't read that one. Try a sharper, well-lit photo, or add medicines manually.",
  },

  locale: { unsupported: "Unsupported language." },
} as const;

export default errors;
