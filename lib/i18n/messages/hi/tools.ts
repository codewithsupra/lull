import type { Dict } from "@/lib/i18n/dict";
import type en from "../en/tools";

const tools: Dict<typeof en> = {
  breath: {
    phases: {
      in: "साँस लें",
      hold: "रोकें",
      out: "साँस छोड़ें",
      rest: "ठहरें",
      holdEmpty: "खाली रोकें",
      inhale: "साँस भरें",
      sipIn: "थोड़ी और भरें",
      longExhale: "लंबी साँस छोड़ें",
    },
    patterns: {
      coherent: {
        name: "संतुलित",
        tagline: "5.5 अंदर · 5.5 बाहर",
        science: "मिनट में लगभग 5.5 साँसें लेने से साँस और दिल की धड़कन की लय मिल जाती है, जिससे हार्ट-रेट वेरिएबिलिटी बढ़ती है।",
      },
      box: {
        name: "बॉक्स",
        tagline: "4 · 4 · 4 · 4",
        science: "नेवी सील्स का इस्तेमाल किया हुआ अभ्यास। बराबर गिनती आपके ध्यान को एक ठहरी हुई चीज़ देती है।",
      },
      "478": {
        name: "4 · 7 · 8",
        tagline: "नींद आने के लिए",
        science: "लंबी साँस छोड़ना पैरासिम्पैथेटिक तंत्र को सक्रिय करता है, जो सोने से पहले दिल की धड़कन धीमी कर देता है।",
      },
      sigh: {
        name: "गहरी दोहरी साँस",
        tagline: "सबसे तेज़ राहत",
        science:
          "दो बार साँस भरना फेफड़ों की हवा की थैलियों को फिर से फुला देता है, और एक लंबी साँस छोड़ना CO₂ बाहर निकालती है। स्टैनफ़ोर्ड के शोधकर्ताओं ने पाया कि इसने बाक़ी परखे गए तरीक़ों से जल्दी तनाव घटाया।",
      },
    },
  },

  layers: {
    rain: { label: "बारिश", hint: "काँच पर हल्की बारिश" },
    ocean: { label: "समुद्र", hint: "धीमी लहरों का उठाव" },
    wind: { label: "हवा", hint: "ऊँचे पहाड़ों की हवा" },
    fire: { label: "अलाव", hint: "चटकते अंगारे" },
    brown: { label: "गहरा", hint: "ध्यान के लिए ब्राउन नॉइज़" },
    drone: { label: "गूँज", hint: "गर्म हार्मोनिक परत" },
    bowls: { label: "कटोरे", hint: "दूर बजते सिंगिंग बोल" },
  },

  breathe: {
    ready: "तैयार",
    wellDone: "बहुत अच्छा।",
    minOfCalm: "{minutes} मिनट की शांति",
    timeLeft: "{phase} से · {clock} बाक़ी",
    paused: "रुका हुआ · जारी रखने के लिए स्पेस दबाएँ",
    pressStart: "शुरू करें या स्पेस दबाएँ",
    start: "शुरू करें",
    resume: "जारी रखें",
    again: "फिर से",
    pause: "रोकें",
    finish: "समाप्त",
    technique: "तरीक़ा",
    length: "अवधि",
    minutesShort: "{n} मि",
    breaths: "≈ {n} साँसें",
    tones: "मार्गदर्शक ध्वनि",
    guest: "इसे अपनी स्ट्रीक में जोड़ने के लिए साइन इन करें।",
    practiceTitle: "{pattern} साँस-अभ्यास",
  },

  sounds: {
    presets: {
      "night-rain": "रात की बारिश",
      "low-tide": "उतरता ज्वार",
      "cabin-fire": "अलाव की गर्माहट",
      "deep-focus": "गहरा ध्यान",
      temple: "मंदिर",
    },
    listening: "सुन रहे हैं",
    silence: "ख़ामोशी",
    fadesIn: "{clock} में धीमा होकर बंद",
    liveSynthesis: "सजीव ध्वनि",
    pickPreset: "कोई प्रीसेट चुनें या कोई परत बढ़ाएँ",
    startFromPlan: "▶ अपनी योजना से {preset} शुरू करें",
    stop: "■ रोकें",
    layers: "परतें",
    volumeLabel: "{layer} की आवाज़",
    sleepTimer: "नींद का टाइमर",
    minutesShort: "{n} मि",
    off: "बंद",
    guest: "सुनने का समय दर्ज करने के लिए साइन इन करें।",
    taskHint: "कम से कम एक मिनट सुनें, फिर रोककर अपने XP लें।",
    practiceTitle: "ध्वनि-दृश्य",
  },

  session: {
    label: "आपके लिए रचा गया",
    complete: "सेशन पूरा।",
    youMatter: "आप महत्वपूर्ण हैं। ",
    silence: "ख़ामोशी",
    minutes: "◷ ~{n} मिनट",
    playAgain: "↻ फिर से चलाएँ",
    begin: "▶ सेशन शुरू करें",
    end: "■ समाप्त",
    voiceGuide: "आवाज़ का मार्गदर्शन",
  },

  checkin: {
    heading: "चेक-इन",
    saved: "✓ सेव हुआ",
    prompt: "अभी आप कैसे पहुँच रहे हैं?",
    moods: { 1: "भारी", 2: "उदास", 3: "ठीक", 4: "अच्छा", 5: "खिला हुआ" },
    energy: "ऊर्जा",
    energyLevels: ["निचुड़ा", "कम", "ठहरी", "चुस्त", "भरपूर"],
    tags: {
      anxious: "घबराहट",
      stressed: "तनाव",
      tired: "थकान",
      restless: "बेचैनी",
      sad: "उदासी",
      calm: "शांत",
      focused: "ध्यान में",
      grateful: "कृतज्ञ",
      hopeful: "उम्मीद",
      lonely: "अकेलापन",
    },
    notePlaceholder: "मन में कुछ है? (ज़रूरी नहीं)",
    log: "“{mood}” दर्ज करें",
    saveFailed: "सेव नहीं हो सका।",
  },

  time: {
    justNow: "अभी",
    minutesAgo: "{n} मिनट पहले",
    hoursAgo: "{n} घंटे पहले",
    daysAgo: "{n} दिन पहले",
    minutesShort: "{n} मि",
    secondsShort: "{n} से",
    minutesSeconds: "{m} मि {s} से",
  },

  guestNote: { cta: "मुफ़्त खाता बनाएँ" },
};

export default tools;
