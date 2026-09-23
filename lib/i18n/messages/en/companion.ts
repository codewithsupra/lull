/**
 * "Talk to Lull" (FR2) — including the two safety-critical fixed replies.
 *
 * `crisisReply` and `medicalBoundary` are never written by the model: they are shown verbatim
 * when the classifier fires. Translating them badly is a clinical-safety defect, not a copy
 * nit, so any new language must have these reviewed by a native speaker before it ships.
 */
const companion = {
  label: "talk to lull",
  heading: "How are you doing?",
  guestHeading: "Someone to think out loud with, at 3am.",
  guestBody:
    "A companion grounded in CBT skills: thought records, reframing, grounding, worry time. It knows your plan and your check-ins, never gives medical advice, and hands you to real human help the moment things feel unsafe.",
  guestCta: "Create a free account",
  guestNote: "15 messages a day free · encrypted · you can wipe it any time",
  intro: "I'm here to listen, and to help you use a skill that fits. I'm not a therapist or a doctor, and I can't advise on medicines.",
  placeholder: "Whatever's on your mind…",
  send: "Send",
  sending: "…",
  thinking: "thinking…",
  messageLabel: "Message",
  clearMemory: "clear memory",
  forgetEverything: "Forget everything",
  keep: "Keep",
  openHelp: "Open help now →",
  disclaimerPre: "not a therapist or doctor · no medical advice · encrypted · ",
  urgentHelp: "urgent help",
  clearFailed: "Couldn't clear.",

  starters: [
    "I can't switch my brain off",
    "I keep putting everything off",
    "I'm anxious about tomorrow",
    "I feel flat and I don't know why",
    "Help me get out of bed",
    "I had a panic moment today",
  ],

  crisisReply: `I'm really glad you told me. What you're carrying sounds heavy, and I don't want you to sit with it alone right now.

I'm not the right kind of help for this moment — a person is. I've opened your crisis options: a free 24/7 helpline, your safety plan, and the people you listed. Please reach out to one of them now, or call your local emergency number if you're in danger.

I'll still be here afterwards. If it helps while you reach out, we can breathe together for 60 seconds.`,

  medicalBoundary: `I can't give advice about medicines, doses or diagnoses — only your doctor or psychiatrist can do that safely, and I'd be guessing.

What I can do: help you write down exactly what you want to ask them, and support you with how you're feeling in the meantime.`,

  errors: {
    tooShort: "Type a little more and I'll listen.",
    lost: "I lost my train of thought. Try again?",
    cutOff: "My reply got cut off. Try again?",
    loadFailed: "Couldn't load your conversation.",
    clearFailed: "Couldn't clear your conversation.",
    dailyProLimit: "We've talked a lot today. I'll be here tomorrow.",
    dailyFreeLimit: "Free includes {limit} messages a day. Go Pro to keep talking.",
    signIn: "Sign in first.",
  },

  fallbackReply: "I'm here. Tell me a bit more about what's going on.",
} as const;

export default companion;
