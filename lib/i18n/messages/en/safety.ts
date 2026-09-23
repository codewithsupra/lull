const safety = {
  label: "safety plan",
  labelPrivate: "safety plan · private & encrypted",
  guestHeading: "A plan for your hardest moments, written while you're calm.",
  guestBody: "Free forever, encrypted, and available offline once you save it.",
  needHelpNow: "I need help now",

  heading: "Your plan for the hard moments.",
  introBefore: "Write this while things feel steady, and it's ready when they don't. Fill in what you can, skip the rest, and change it any time. Tap",
  introAfter: "at the top of any screen to open it.",
  sectionCount: "{done}/{total} sections",
  usable: "✓ This plan already has enough to help you in a crisis.",
  opening: "Opening your plan…",

  sections: {
    warning_signs: {
      title: "My early warning signs",
      help: "Thoughts, feelings or situations that tell you a hard patch is starting. Spotting them early is the whole point.",
      placeholder: "e.g. I stop replying to messages",
    },
    coping: {
      title: "Things I can do on my own",
      help: "Small actions that have helped before, without needing anyone else.",
      placeholder: "e.g. 4-7-8 breathing for 5 minutes",
    },
    distractions: {
      title: "People and places that take my mind off it",
      help: "Company or surroundings that shift your state, even a little.",
      placeholder: "e.g. walk to the park near home",
    },
    people: {
      title: "People I can ask for help",
      help: "Who you'd actually call at 2am. Add a number so it's one tap when you need it.",
      placeholder: "e.g. Ravi (brother)",
    },
    professionals: {
      title: "Professionals and services",
      help: "Your doctor, therapist or a helpline you trust.",
      placeholder: "e.g. Dr. Mehta, psychiatrist",
    },
    safer: {
      title: "Making my space safer",
      help: "Steps that put distance between you and anything you could use to hurt yourself.",
      placeholder: "e.g. leave my medicines with my flatmate",
    },
    reasons: {
      title: "My reasons to keep going",
      help: "People, plans, places, anything. This is the section people say helps most.",
      placeholder: "e.g. my sister's wedding next year",
    },
  },

  where: {
    title: "Where you are",
    help: "So Lull shows the right emergency number and helplines. Currently: {region}.",
    notSet: "not set",
    countryLabel: "Country",
  },

  add: "Add",
  remove: "remove",
  removeLabel: "Remove {item}",
  nameLabel: "Name",
  phoneLabel: "Phone",
  phonePlaceholder: "Phone (optional)",
  saveCta: "Save my safety plan",
  saveFailed: "Couldn't save.",
  savedAt: "saved {when} · available offline",
  footer: "Only you can read this. It's encrypted before it's stored, kept on this device so it works offline, and deleted the moment you delete your data.",
} as const;

export default safety;
