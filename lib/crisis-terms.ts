/**
 * Crisis language detection, across every language Lull speaks (FR3 + FR8).
 *
 * Two rules govern this file:
 *
 * 1. **Language is never assumed from the UI locale.** An Indian user with the app in Hindi
 *    may type in English, and a user with the app in English may type Hindi or Hinglish —
 *    often in exactly the moment they are least able to code-switch. Every pattern is
 *    therefore always active, for everyone.
 * 2. **A false positive is a gentle, well-signposted offer of help; a false negative can be
 *    fatal.** Where the two trade off, this file prefers to over-detect.
 *
 * Note on word boundaries: JavaScript's `\b` is defined against `[A-Za-z0-9_]`, so it does
 * *not* behave sensibly next to Devanagari. The Devanagari patterns deliberately use no `\b`
 * and match on phrases instead, which also absorbs Hindi's verb-ending variation
 * (चाहता / चाहती / चाहते).
 */

/** English self-harm and suicidality. */
export const CRISIS_TERMS_EN =
  /\b(suicid\w*|kill(?:ing)? (?:my ?self|myself)|end(?:ing)? (?:it all|it|my life|things)|take my own life|self[- ]?harm|hurt(?:ing)? myself|cut(?:ting)? myself|don'?t want to (?:live|be alive|wake up)|better off dead|overdos\w*|all (?:my|the) pills)\b/i;

/**
 * Hindi in Devanagari. Verb stems are matched without their endings so all genders and
 * politeness levels are caught (मरना चाहता हूँ / चाहती हूँ / चाहते हैं).
 */
export const CRISIS_TERMS_HI_DEV =
  /(आत्महत्या|आतमहत्या|ख़ुदकुशी|खुदकुशी|खुदखुशी|मरना चाह|मर जाऊ|मर जाउ|मरने का मन|मुझे मरना|जान दे|जान देन|जीना नहीं चाह|जीना नही चाह|जीने का मन नहीं|जीने की इच्छा नहीं|अब जीना नहीं|खुद को नुकसान|ख़ुद को नुकसान|खुद को मार|नस काट|नसें काट|हाथ काट|फांसी लगा|फाँसी लगा|ज़हर खा|जहर खा|सब खत्म कर|सब ख़त्म कर|ज़िंदगी खत्म|जिंदगी खत्म|मर जाना चाह|नहीं जीना|सारी गोलियां|सारी गोलियाँ|ओवरडोज)/;

/**
 * Romanized Hindi (Hinglish), which is how most Indian users actually type on a phone.
 * Spellings vary wildly, so each stem allows its common variants rather than one "correct" form.
 */
export const CRISIS_TERMS_HI_LATIN =
  /\b(khudkushi|khudkhushi|khudkushee|khud-?khushi|aatmahatya|atmahatya|atmhatya|marna chah\w*|marna hai|mar jau\w*|mar jana chah\w*|marne ka mann?|jeena nahi\w* chah\w*|jina nahi\w* chah\w*|jeene ka mann? nahi|jeene ki ichha nahi|nahi jeena|jaan de d\w+|jaan dene|khud ko nuksan|khud ko maar\w*|nas kaat\w*|hath kaat\w*|phansi laga\w*|fansi laga\w*|zeher kha\w*|zahar kha\w*|sab khatam kar|zindagi khatam|jindagi khatam|saari goliyan|sari goliyan)\b/i;

/** Someone is being harmed, by themselves or by another person — English. */
export const HARM_OTHERS_EN =
  /\b(kill|hurt|harm|stab|shoot)\s+(him|her|them|someone|somebody|my|people)\b|\b(being|getting)\s+(abused|beaten|raped|assaulted)\b|\b(?:he|she|they|someone|my\s+\w+)\s+(?:hits?|beats?|punches|abuses?|hurts)\s+me\b/i;

/** Being harmed by someone else — Hindi and Hinglish. Domestic violence disclosures matter here. */
export const HARM_OTHERS_HI =
  /(मुझे मारता|मुझे मारती|मुझे पीटता|मुझे पीटती|मारपीट|मुझे मारते|पिटाई करता|जबरदस्ती करता|छेड़छाड़|बलात्कार|मुझे धमका)|\b(mujhe marta|mujhe marti|mujhe peet\w*|mujhe pitta|marpeet|maarpeet|pitai karta|jabardasti karta|chhedchhad|balatkar|mujhe dhamka\w*)\b/i;

const SELF_HARM = [CRISIS_TERMS_EN, CRISIS_TERMS_HI_DEV, CRISIS_TERMS_HI_LATIN];
const HARM_BY_OTHERS = [HARM_OTHERS_EN, HARM_OTHERS_HI];

/** True when free text discloses suicidality or self-harm, in any supported language. */
export const isSelfHarmText = (text: string): boolean => SELF_HARM.some((re) => re.test(text));

/** True when free text discloses violence or abuse, by or toward the user. */
export const isHarmText = (text: string): boolean => isSelfHarmText(text) || HARM_BY_OTHERS.some((re) => re.test(text));

/**
 * Back-compatible shape for the places that used a single English regex.
 * `test` is the only method those call sites use.
 */
export const CRISIS_TERMS = { test: isSelfHarmText } as const;
