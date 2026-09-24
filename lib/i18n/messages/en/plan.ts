const plan = {
  categories: {
    anxiety: { label: "Anxiety", hint: "Worry, panic, racing thoughts" },
    insomnia: { label: "Sleep trouble", hint: "Insomnia, waking at night" },
    stress: { label: "Stress & burnout", hint: "Overwhelm, exhaustion" },
    low_mood: { label: "Low mood", hint: "Mild depression, flatness" },
    adhd: { label: "Focus / ADHD", hint: "Attention, restlessness" },
    other: { label: "Something else", hint: "We'll build a general wellbeing plan" },
  },

  goals: {
    sleep_faster: "Fall asleep faster",
    stay_asleep: "Stay asleep",
    fewer_panic: "Fewer panic moments",
    calmer_mornings: "Calmer mornings",
    more_energy: "More energy",
    meds_on_time: "Take meds on time",
    better_focus: "Better focus",
    less_overthinking: "Less overthinking",
    understand_diagnosis: "Understand my diagnosis",
  },

  levels: ["Seedling", "Sprout", "Sapling", "Bloom", "Grove", "Canopy", "Old Growth", "Ancient Forest"],

  slots: { morning: "Morning", afternoon: "Afternoon", evening: "Evening", night: "Night" },
  kinds: { medication: "Medicine", habit: "Habit", session: "Session", learn: "Learn", reflect: "Reflect" },

  wizard: {
    steps: ["Consent", "Condition", "Rhythm", "Context", "Medicines", "Build"],
    buildStages: [
      "Reading your answers…",
      "Scheduling your medicines exactly as prescribed…",
      "Choosing evidence-based habits…",
      "Weaving in breathing & sound…",
      "Writing your learn cards…",
      "Planting your garden…",
    ],

    label: "care plan · private beta",
    heading: "Your prescription, turned into a plan you'll follow.",
    intro:
      "Answer a few questions and scan your prescription if you have one. Lull builds a 4-week plan around it with your medicine schedule, small habits that are backed by evidence, breathing and sound sessions, and things to ask your doctor. Each step you complete earns XP and grows your night garden.",
    pledges: {
      noPii: {
        title: "No personal details, ever",
        body: "We never store your name, your doctor, dates, IDs or contact details. We remove them before anything is saved.",
      },
      noPhotos: {
        title: "Prescription photos are never kept",
        body: "We read the photo in memory, through an AI provider that doesn't keep or train on data, and then discard it.",
      },
      encrypted: {
        title: "Encrypted health data",
        body: "Medicines and plan details are encrypted with AES-256 before they reach our database. You can delete all of it in one tap.",
      },
      notADoctor: {
        title: "A companion, not a doctor",
        body: "Lull schedules your medicines exactly as prescribed and never changes them. Anything worth checking goes on a list for your doctor.",
      },
    },
    consent:
      "I understand Lull is not medical advice and doesn't replace my doctor. I agree to my health answers being processed as described above. In an emergency I'll contact local emergency services.",

    conditionHeading: "What are you working on?",
    conditionHelp: "Pick the closest one. It can be a diagnosis or just how things feel.",
    durationHeading: "How long has this been going on?",
    durations: { new: "Just started", months: "A few months", years: "Over a year" },
    severityHeading: "How much is it affecting your days?",
    severityLabel: "Severity",
    severities: ["barely", "a little", "noticeably", "a lot", "constantly"],

    rhythmHeading: "Your daily rhythm",
    rhythmHelp: "We time your plan and reminders around these.",
    wakeLabel: "Usually wake up",
    sleepLabel: "Usually go to bed",
    goalsHeading: "What would feel like a win? (up to 4)",

    scanHeading: "Add your prescription",
    scanHelp: "Optional, but it makes the plan much better. Printed and handwritten prescriptions both work.",
    takePhoto: "Take a photo",
    takePhotoHint: "Flat surface, good light, whole page in frame",
    uploadFile: "Upload image or PDF",
    uploadFileHint: "JPG, PNG, HEIC or PDF up to 8 MB",
    scanning: "Reading your prescription privately…",
    scanNothing: "We couldn't find medicines in that image. Try a sharper photo, or add them by hand on the next step.",
    scanFoundOne: "Found 1 medicine. You'll check it next. The image is already gone.",
    scanFoundMany: "Found {count} medicines. You'll check each one next. The image is already gone.",
    scanFailed: "Scan failed.",
    ownWords: "In your own words (optional)",
    ownWordsPlaceholder: "e.g. Diagnosed with GAD last month. I lie awake replaying conversations, and mornings feel heavy…",
    ownWordsNote: "Please leave out names and other personal details. We strip them anyway.",

    medsHeading: "Check your medicines",
    medsHelp: "Your plan will schedule exactly what you confirm here, and nothing else. Tick each one after checking it against your prescription.",
    medsEmpty: "No medicines added. That's fine, and your plan will focus on habits and sessions.",
    medName: "Medicine name",
    medDose: "Dose (e.g. 50 mg)",
    medDoseLabel: "Dose",
    medInstructions: "Instructions (e.g. after breakfast)",
    medInstructionsLabel: "Instructions",
    asNeededNote: "Only when needed. It won't be scheduled.",
    asNeeded: "as needed",
    doseTime: "Dose time",
    removeTime: "Remove time",
    addTime: "+ time",
    needsTime: 'Add when you take it, or mark it "as needed".',
    confirmed: "Confirmed",
    confirmPrompt: "This matches my prescription",
    fromScan: "from scan",
    remove: "remove",
    addMedicine: "+ Add a medicine",
    confirmAll: "Confirm each medicine and set its time to continue.",

    buildingNote: "private · encrypted · about 20 seconds",
    buildCta: "✦ Build my plan",
    skip: "Skip for now →",
    continue: "Continue →",
    asPrescribed: "Exactly as prescribed.",
  },

  home: {
    header: "{category} · week {week} of 4",
    headerWithTheme: "{category} · week {week} of 4 · {theme}",
    levelLine: "Lv {level} · {name}",
    streak: "🔥 {days} day streak",
    toNext: "{xp} XP to next",
    xpBurst: "+{xp} XP",
    dayComplete: "Day complete · +{bonus} XP",

    doctorFlags: "worth asking your doctor",

    garden: "your night garden",
    gardenHint: "Each task grows a leaf. Finish a day and it blooms.",

    reviewLabel: "week {week} review",
    reviewBody: "You completed {percent}% of this week. Lull will adapt next week to how it actually went.",
    adapting: "Adapting…",
    buildWeek: "Build week {week} →",

    todayHeading: "Today",
    doneCount: "{done}/{total} done",
    nothingToday: "Nothing scheduled today. Rest counts too.",
    markDone: "Mark {task} done",
    markNotDone: "Mark {task} not done",
    start: "Start",

    remindersHeading: "Reminders",
    remindersOn: "On",
    remindersTurnOn: "Turn on",
    remindersUnsupported: "This browser can't show reminders. On iPhone, tap Share → Add to Home Screen, then open Lull from there.",
    remindersBody: "A gentle nudge at each part of your day. Notifications never mention medicine or conditions.",
    remindersFailed: "Couldn't change reminders.",

    medsHeading: "Your medicines · as prescribed",
    medsNote: "Lull never changes your medicines. Ask your doctor before changing anything.",

    learnHeading: "Learn this week",

    questionsHeading: "For your next appointment",
    copy: "copy",
    copied: "copied ✓",

    roadmapHeading: "The road ahead",

    dataHeading: "Your data",
    dataBody: "Encrypted health data and no personal details. You can delete all of it at any time.",
    deleteEverything: "Delete everything",
    deletePrompt: "delete my health data →",
    deleteFailed: "Couldn't delete. Please try again.",

    saveFailed: "Couldn't save that. Check your connection.",
    replanFailed: "Couldn't plan next week.",
    footer: "lull is a wellbeing companion, not medical advice · in an emergency call your local emergency number",
  },

  notifications: {
    morning: { title: "Good morning 🌱", body: "Your morning plan is ready. A few small steps." },
    afternoon: { title: "A midday check-in", body: "Something small from your plan is waiting." },
    evening: { title: "Evening plan 🌙", body: "Time for your evening steps." },
    night: { title: "Winding down", body: "Your night routine is ready when you are." },
  },

  crisisCard: {
    label: "before we go on",
    heading: "That sounds really heavy.",
    body: "Some of what you wrote suggests you may be going through something serious. A plan is not the right first step for that — a person is. Free, confidential help is available right now.",
    continue: "I'm safe, continue →",
  },

  taskReturn: {
    heading: "Done. {xp} XP earned.",
    body: "Back to your plan?",
    cta: "Back to my plan →",
  },
} as const;

export default plan;
