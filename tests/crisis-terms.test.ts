import { describe, expect, it } from "vitest";
import { isHarmText, isSelfHarmText } from "@/lib/crisis-terms";

/**
 * Crisis detection has to work for an Indian user who types the way Indian users actually type:
 * Devanagari, romanised Hinglish, or English — often switching mid-sentence. A miss here is the
 * worst failure this product can have, so every language is tested against the same bar.
 */
describe("self-harm detection", () => {
  it.each([
    "I want to kill myself",
    "i think about suicide a lot",
    "I'd be better off dead",
    "thinking about ending it all",
    "I've been cutting myself again",
    "I don't want to live anymore",
    "I might take all my pills tonight",
    "I want to self-harm",
  ])("English: %s", (s) => expect(isSelfHarmText(s)).toBe(true));

  it.each([
    "मुझे मरना है",
    "मैं मरना चाहता हूँ",
    "मैं मरना चाहती हूँ",
    "अब जीना नहीं चाहता",
    "मेरा जीने का मन नहीं है",
    "मैं आत्महत्या के बारे में सोचता हूँ",
    "खुदकुशी करने का मन करता है",
    "मैं खुद को नुकसान पहुँचाता हूँ",
    "मैंने नस काट ली",
    "सारी गोलियां खा लूँ",
    "जान दे दूँगा",
  ])("Hindi (Devanagari): %s", (s) => expect(isSelfHarmText(s)).toBe(true));

  it.each([
    "mujhe marna hai",
    "main marna chahta hoon",
    "marna chahti hu",
    "ab jeena nahi chahta",
    "jeene ka mann nahi hai",
    "khudkushi karne ka mann karta hai",
    "aatmahatya ke bare me sochta hu",
    "khud ko nuksan pahunchata hu",
    "nas kaat li",
    "jaan de dunga",
    "sab khatam kar dunga",
  ])("Hinglish: %s", (s) => expect(isSelfHarmText(s)).toBe(true));

  it.each([
    "this deadline is killing me",
    "I can't sleep",
    "stressed about exams",
    "मुझे नींद नहीं आती",
    "बहुत तनाव है",
    "काम का बहुत दबाव है",
    "mujhe neend nahi aati",
    "office me bahut pressure hai",
  ])("does not flag ordinary distress: %s", (s) => expect(isSelfHarmText(s)).toBe(false));
});

describe("harm by others", () => {
  it.each([
    "my boyfriend hits me",
    "my husband beats me",
    "I am being abused at home",
    "मेरा पति मुझे मारता है",
    "घर में मारपीट होती है",
    "mera pati mujhe marta hai",
    "ghar me marpeet hoti hai",
    "mujhe dhamkata hai",
  ])("flags: %s", (s) => expect(isHarmText(s)).toBe(true));

  it("treats self-harm as harm too", () => {
    expect(isHarmText("I want to kill myself")).toBe(true);
    expect(isHarmText("मुझे मरना है")).toBe(true);
  });

  it.each(["my manager criticises me", "मेरे बॉस ने डाँटा"])("does not flag ordinary conflict: %s", (s) => expect(isHarmText(s)).toBe(false));
});
