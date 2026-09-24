const crisis = {
  dialogLabel: "Get help now",
  label: "you don't have to handle this alone",
  heading: "Help, right now.",
  dangerPrefix: "In immediate danger · {region}",
  call: "Call {number}",
  dangerNoRegion: "In immediate danger, call your local emergency number.",
  linesHeading: "Talk to someone free, 24/7",
  actions: { text: "text →", open: "open →", call: "call →" },
  countryLabel: "Choose your country",
  somewhereElse: "Somewhere else",
  chooseCountry: "choose your country",
  changeCountry: "not in {region}? change country",
  findHelpline: "Find a helpline in your country",

  /** Notes shown under each helpline. Keys, not free text, so every language stays consistent. */
  notes: {
    free247: "Free, 24/7",
    free247Multi: "Free, 24/7, in 20+ languages",
    callOrText247: "Call or text, 24/7",
    callOrText247EnFr: "Call or text, 24/7, EN/FR",
    open247: "24/7",
    suicide247: "24/7 suicide prevention",
    counsellingHours: "Counselling, Mon–Sat 10am–8pm",
    textHome: "Text HOME",
    textShout: "Text SHOUT",
    textHello: "Text HELLO",
    urgentMentalHealth: "Urgent mental health support",
    global: "Free, confidential support in 130+ countries",
  },

  /** Country names, so the picker and the emergency banner are never half-English. */
  countries: {
    IN: "India",
    US: "United States",
    GB: "United Kingdom",
    IE: "Ireland",
    CA: "Canada",
    AU: "Australia",
    NZ: "New Zealand",
    SG: "Singapore",
    AE: "United Arab Emirates",
    DE: "Germany",
    NL: "Netherlands",
    ZA: "South Africa",
    XX: "your country",
  },
  localEmergency: "your local emergency number",

  offline: {
    title: "Crisis help — Lull",
    heading: "You're offline, and help still works.",
    lead: "These numbers are saved on your device. Calling does not need internet.",
    anywhere: "Anywhere",
    emergency: "Emergency:",
    note: "If you are in immediate danger, call your local emergency number. Lull is a wellbeing companion, not a medical service.",
  },

  plan: {
    heading: "Your safety plan",
    coping: "Things that have helped before",
    people: "People I can reach out to",
    callPerson: "Call {name} →",
    reasons: "My reasons to keep going",
    distractions: "Places and people that shift my mind",
    safer: "Making my space safer",
    edit: "edit my safety plan",
  },

  empty: {
    label: "Make the next hard moment easier",
    body: "A safety plan is a short list you write while you're calm: what helps, who to call, and why you keep going. It takes 5 minutes and it's here whenever you need it, even offline.",
    cta: "Create my safety plan",
  },

  breathe: "Breathe with me for 60 seconds",
  calming: "Put on something calming",
  disclaimer: "Lull is a wellbeing companion, not a medical or emergency service.",
} as const;

export default crisis;
