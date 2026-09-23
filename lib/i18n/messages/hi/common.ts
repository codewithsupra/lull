import type { Dict } from "@/lib/i18n/dict";
import type en from "../en/common";

const common: Dict<typeof en> = {
  begin: "शुरू करें →",
  next: "आगे",
  back: "पीछे",
  save: "सेव करें",
  saving: "सेव हो रहा है…",
  saved: "सेव हो गया",
  cancel: "रद्द करें",
  done: "पूरा",
  close: "बंद करें",
  retry: "फिर से कोशिश करें",
  loading: "लोड हो रहा है…",
  signIn: "साइन इन करें",
  signUp: "मुफ़्त खाता बनाएँ",
  signOut: "साइन आउट",
  logIn: "[L] लॉग इन",
  goPro: "Pro लें",
  pro: "pro",
  helpNow: "मदद चाहिए",
  helpNowLabel: "अभी मदद पाएँ",
  languageLabel: "भाषा",
  minutes: "मिनट",
  xp: "XP",
  level: "स्तर",
  of: "में से",
  errors: {
    generic: "कुछ गड़बड़ हो गई। फिर से कोशिश करें?",
    offline: "आप ऑफ़लाइन हैं। मदद के नंबर अभी भी काम करते हैं।",
    signIn: "पहले साइन इन करें।",
  },
};

export default common;
