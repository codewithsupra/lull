const landing = {
  nav: { breathe: "Breathe", sounds: "Sounds", compose: "Compose", github: "GitHub", logIn: "Log in", openApp: "Open app" },

  scrollHint: "scroll or press a key ↘",

  hero: {
    tagline: "Calm, composed for you.",
    body:
      "Tell Lull how you feel. It writes a guided meditation for that moment, picks a breath pattern and plays a soundscape that is synthesized live and never repeats.",
    compose: "Compose my session",
    breathe: "Just breathe for a minute",
    note: "no downloads · no audio files · runs in your browser",
    scroll: "↓ scroll",
  },

  everything: {
    heading: "Everything you need to come back to yourself.",
    body: "Calm gives you a library to browse. Lull makes a session for how you feel right now, using breath, sound and voice.",
    breathNote: "this page breathes at 5.5/min · match it",
    breatheIn: "Breathe in",
    breatheOut: "Breathe out",
    features: [
      {
        title: "AI-composed sessions",
        body: "Describe your moment in a sentence. Lull writes a guided meditation for it, picks a breath pattern, sets a soundscape and reads it to you.",
      },
      {
        title: "Generative soundscapes",
        body: "Rain, tide, wind, embers, drones and singing bowls are synthesized live in your browser. Nothing is a recording, so the same few minutes never repeat.",
      },
      {
        title: "Guided breathwork",
        body: "Coherent breathing, box breathing, 4-7-8 and the physiological sigh. A glowing pacer and soft tones guide each breath, so you can close your eyes.",
      },
      {
        title: "Mood check-ins & insight",
        body: "Log a mood in two taps. Over time Lull shows you patterns in how you feel and suggests what to try next.",
      },
    ],
  },

  words: ["breathe", "soundscape", "compose", "sleep"],

  sound: {
    label: "try it · right here",
    heading: "Sound, synthesized as you listen.",
    body:
      "Seven layers are built from filtered noise, slow oscillators and sampled randomness. Mix them any way you like, then set a sleep timer that fades everything out.",
    live: "synthesizing live · web audio",
    tapPreset: "tap a preset · headphones recommended",
    presets: { storm: "Night rain", tide: "Low tide", cabin: "Cabin fire" },
  },

  compose: {
    label: "the headline feature",
    heading: "One sentence in. A whole session out.",
    body:
      "Lull reads what you wrote and plans a session around it: an intention, a breath pattern, a sound mix and a script paced to your breathing. Then it reads the script to you. Every session is saved to your account.",
    cta: "[C] Compose yours →",
  },

  compare: {
    heading: "A calmer take on calm.",
    usual: "the usual app",
    rows: [
      { usual: "Pre-recorded library", lull: "Composed for this exact moment" },
      { usual: "Same audio files on loop", lull: "Soundscapes synthesized in real time" },
      { usual: "Browse to find a session", lull: "One sentence → a full session" },
      { usual: "$69.99 / year", lull: "Free & open source" },
    ],
  },

  cta: {
    heading: "Unwind in under a minute.",
    body: "Breathing and soundscapes work without an account. Sign up free to compose sessions and track your streak.",
    open: "Open Lull",
    signUp: "Create free account",
    source: "★ View source",
  },

  footer: { left: "© 2026 lull · not medical advice", right: "next.js 16 · insforge · webgl · web audio" },

  demo: {
    promptHeading: "how are you, really?",
    composedIn: "composed in 2.1s",
    duration: "◷ 6 min",
    promptLabel: "you wrote",
    breathLabel: "breath",
    soundLabel: "sound",
    scriptLabel: "script",
    cases: [
      {
        prompt: "Big interview tomorrow. It's 1am and my mind won't stop replaying everything.",
        title: "Quiet the Replay",
        breath: "4 · 7 · 8",
        sound: "Night rain + deep drone",
        lines: [
          "Let the day set itself down. You don't have to solve tomorrow tonight.",
          "Notice the weight of your body in the bed. Heavy, held, safe.",
          "Each thought that loops back is just a wave. Let it arrive… and pass.",
        ],
      },
      {
        prompt: "Afternoon slump, 3 tabs of deadlines, feeling scattered and wired.",
        title: "Clear Channel",
        breath: "Box 4 · 4 · 4 · 4",
        sound: "Deep brown noise + wind",
        lines: [
          "Pick one sound in the room and rest your attention there.",
          "Four counts in. Hold the square. Four counts out.",
          "When you return to the screen, return to just one tab.",
        ],
      },
      {
        prompt: "Just got some hard news. I feel heavy and a bit numb.",
        title: "Held",
        breath: "Coherent 5.5",
        sound: "Low tide + singing bowls",
        lines: [
          "There's nothing to fix right now. Only this breath.",
          "Place a hand on your chest. Feel it rise to meet you.",
          "Whatever you feel is allowed to be here, too.",
        ],
      },
    ],
  },
} as const;

export default landing;
