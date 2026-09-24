"use client";

import { RECOGNITION_LANG, isRecognitionSupported } from "@/lib/voice";
import type { Locale } from "@/lib/i18n";

/**
 * Voice input (FR8: Hindi STT) via the browser's `SpeechRecognition`. This is a thin adapter
 * over a genuinely inconsistent API — Chrome/Edge expose it unprefixed, Safari and older Chrome
 * as `webkitSpeechRecognition`, and Firefox not at all — so callers only need `isRecognitionSupported()`
 * and this one function; they never touch the browser API directly.
 *
 * Design choice: results only ever fill the draft text box, never auto-send. A misheard word in
 * a mental-health conversation ("I want to die" mis-heard from "I want to try") is exactly the
 * kind of mistake a person should get to see and correct before it goes anywhere.
 */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
};

export type Recognizer = {
  stop: () => void;
};

/**
 * Starts listening in the given locale. `onResult` fires repeatedly with the best-guess
 * transcript so far (interim results included) and whether that piece is final; the caller
 * decides how to merge that into a draft. Returns null if the browser has no support at all.
 */
export function startRecognizer(
  locale: Locale,
  handlers: { onResult: (text: string, isFinal: boolean) => void; onEnd: () => void; onError?: (reason: string) => void },
): Recognizer | null {
  if (!isRecognitionSupported()) return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = RECOGNITION_LANG[locale];
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (raw) => {
    const event = raw as RecognitionResultEvent;
    let text = "";
    let isFinal = false;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      text += result[0]?.transcript ?? "";
      if (result.isFinal) isFinal = true;
    }
    if (text) handlers.onResult(text, isFinal);
  };
  recognition.onerror = (raw) => {
    const err = raw as { error?: string };
    // "no-speech" and "aborted" are routine (silence, or the user stopped it themselves) —
    // surfacing those as an error would just be noise.
    if (err?.error && err.error !== "no-speech" && err.error !== "aborted") handlers.onError?.(err.error);
  };
  recognition.onend = () => handlers.onEnd();

  try {
    recognition.start();
  } catch {
    return null;
  }

  return { stop: () => recognition.stop() };
}

export { isRecognitionSupported };
