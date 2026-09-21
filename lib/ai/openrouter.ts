import "server-only";
import OpenAI from "openai";

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { "X-Title": "Lull" },
});

export const CHAT_MODEL = process.env.OPENROUTER_CHAT_MODEL ?? "google/gemini-2.5-flash";

/** Pulls the first JSON object out of a model reply, tolerating code fences. */
export function parseJsonReply(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}
