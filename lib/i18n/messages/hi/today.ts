import type { Dict } from "@/lib/i18n/dict";
import type en from "../en/today";

const today: Dict<typeof en> = {
  greeting: {
    hello: "नमस्ते",
    stillUp: "अभी तक जगे हैं",
    morning: "सुप्रभात",
    afternoon: "नमस्कार",
    evening: "शुभ संध्या",
    windingDown: "दिन ढल रहा है",
  },
  guestNote: "आप मेहमान के रूप में देख रहे हैं। साँस और ध्वनि पूरी तरह चलते हैं। स्ट्रीक, चेक-इन और रची गई सेशन सेव करने के लिए खाता बनाएँ।",

  plan: {
    label: "आपका प्लान · हफ़्ता {week} / 4",
    doneToday: "आज {done}/{total} पूरे",
    streak: "🔥 {days} दिन की स्ट्रीक",
    newLabel: "नया · केयर प्लान",
    newTitle: "अपने पर्चे को रोज़ के प्लान में बदलें →",
    newBody: "पर्चा स्कैन करें या अपनी स्थिति बताएँ। निजी और एन्क्रिप्टेड, हर कदम पर XP।",
  },

  check: {
    dueLabel: "आपकी 2-हफ़्ते की जाँच बाक़ी है",
    firstLabel: "यहाँ से शुरू करें · 3 मिनट",
    dueBody: "देखें कि पिछली बार से अब तक कितना बदला है।",
    firstBody: "अपने लिए सही मदद ढूँढने के लिए वेलबीइंग जाँच करें।",
  },

  tiles: {
    streak: "दिन की स्ट्रीक",
    minutes: "शांत मिनट",
    sessions: "सेशन",
    checkins: "चेक-इन",
  },

  suggested: "अभी के लिए सुझाव",
  suggestions: {
    sleep: { title: "नींद, आपके लिए रची गई", body: "4-7-8 साँस के साथ हल्की बारिश, जो अपने आप धीमी होकर बंद हो जाती है।" },
    sleepQuery: "मुझे सोना है और आज का दिन छोड़ देना है",
    morning: { title: "दिन की शुरुआत", body: "इनबॉक्स खोलने से पहले तीन मिनट की संतुलित साँस।" },
    midday: { title: "दोपहर का ठहराव", body: "तनाव बढ़े तो एक गहरी दोहरी साँस लें। बस 60 सेकंड लगते हैं।" },
    evening: { title: "दिन को दरवाज़े पर छोड़ दें", body: "Lull को अपना दिन बताएँ और उसे आराम की सेशन रचने दें।" },
  },

  moodHeading: "मन · पिछले 14 चेक-इन",
  journalLink: "डायरी →",
  recentHeading: "हाल का अभ्यास",
  recentEmpty: "आपकी सेशन यहाँ दिखेंगी।",
  recentGuest: "इतिहास रखने के लिए साइन इन करें।",
};

export default today;
