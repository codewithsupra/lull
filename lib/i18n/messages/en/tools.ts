/** Breathing, soundscapes, check-ins, journal and the composer. */
const tools = {
  breath: {
    phases: { in: "Breathe in", hold: "Hold", out: "Breathe out", rest: "Rest", holdEmpty: "Hold empty", inhale: "Inhale", sipIn: "Sip in more", longExhale: "Long exhale" },
    patterns: {
      coherent: {
        name: "Coherent",
        tagline: "5.5 in · 5.5 out",
        science: "About 5.5 breaths a minute lines up breathing with heart-rate rhythms, which raises heart-rate variability.",
      },
      box: {
        name: "Box",
        tagline: "4 · 4 · 4 · 4",
        science: "A breathing drill used by Navy SEALs. The even count gives your attention one steady thing to follow.",
      },
      "478": {
        name: "4 · 7 · 8",
        tagline: "For falling asleep",
        science: "The long exhale engages the parasympathetic system, which slows the heart rate before sleep.",
      },
      sigh: {
        name: "Physiological sigh",
        tagline: "Fastest reset",
        science:
          "Two inhales re-inflate the air sacs in the lungs, and one long exhale clears CO₂. Stanford researchers found it lowered stress faster than other techniques they tested.",
      },
    },
  },

  layers: {
    rain: { label: "Rain", hint: "Soft rain on glass" },
    ocean: { label: "Ocean", hint: "Slow tidal swell" },
    wind: { label: "Wind", hint: "High mountain air" },
    fire: { label: "Hearth", hint: "Crackling embers" },
    brown: { label: "Deep", hint: "Brown noise for focus" },
    drone: { label: "Drone", hint: "Warm harmonic pad" },
    bowls: { label: "Bowls", hint: "Distant singing bowls" },
  },

  breathe: {
    ready: "Ready",
    wellDone: "Well done.",
    minOfCalm: "{minutes} min of calm",
    timeLeft: "{phase}s · {clock} left",
    paused: "paused · space to resume",
    pressStart: "press start or space",
    start: "Start",
    resume: "Resume",
    again: "Again",
    pause: "Pause",
    finish: "Finish",
    technique: "Technique",
    length: "Length",
    minutesShort: "{n}m",
    breaths: "≈ {n} breaths",
    tones: "Guiding tones",
    guest: "Sign in to count this toward your streak.",
    practiceTitle: "{pattern} breathing",
  },

  sounds: {
    presets: {
      "night-rain": "Night rain",
      "low-tide": "Low tide",
      "cabin-fire": "Cabin fire",
      "deep-focus": "Deep focus",
      temple: "Temple",
    },
    listening: "Listening",
    silence: "Silence",
    fadesIn: "fades out in {clock}",
    liveSynthesis: "live synthesis",
    pickPreset: "pick a preset or raise a layer",
    startFromPlan: "▶ Start {preset} from your plan",
    stop: "■ Stop",
    layers: "Layers",
    volumeLabel: "{layer} volume",
    sleepTimer: "Sleep timer",
    minutesShort: "{n}m",
    off: "Off",
    guest: "Sign in to log listening time.",
    taskHint: "Listen for at least a minute, then stop to collect your XP.",
    practiceTitle: "Soundscape",
  },

  session: {
    label: "composed for you",
    complete: "Session complete.",
    youMatter: "You matter. ",
    silence: "Silence",
    minutes: "◷ ~{n} min",
    playAgain: "↻ Play again",
    begin: "▶ Begin session",
    end: "■ End",
    voiceGuide: "Voice guide",
  },

  checkin: {
    heading: "Check in",
    saved: "✓ saved",
    prompt: "How are you arriving right now?",
    moods: { 1: "Heavy", 2: "Low", 3: "Okay", 4: "Good", 5: "Bright" },
    energy: "Energy",
    energyLevels: ["drained", "low", "steady", "lively", "buzzing"],
    tags: {
      anxious: "anxious",
      stressed: "stressed",
      tired: "tired",
      restless: "restless",
      sad: "sad",
      calm: "calm",
      focused: "focused",
      grateful: "grateful",
      hopeful: "hopeful",
      lonely: "lonely",
    },
    notePlaceholder: "Anything on your mind? (optional)",
    log: "Log “{mood}”",
    saveFailed: "Could not save.",
  },

  time: {
    justNow: "just now",
    minutesAgo: "{n}m ago",
    hoursAgo: "{n}h ago",
    daysAgo: "{n}d ago",
    minutesShort: "{n}m",
    secondsShort: "{n}s",
    minutesSeconds: "{m}m {s}s",
  },

  guestNote: { cta: "Create free account" },
} as const;

export default tools;
