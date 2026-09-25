"use client";

import { handlePaywall } from "@/lib/billing-client";
import { openCrisis } from "@/lib/safety-client";
import type { CompanionMessage } from "@/lib/companion";

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onDone: () => void;
  onCrisis: (reply: string) => void;
  onError: (message: string) => void;
};

/**
 * Sends a turn and streams the reply. A crisis turn comes back as plain JSON (no model call)
 * and immediately raises the crisis sheet.
 */
export async function sendMessage(message: string, h: StreamHandlers) {
  let res: Response;
  try {
    res = await fetch("/api/companion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
  } catch {
    h.onError("You look offline. Your message wasn't sent.");
    return;
  }

  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("text/event-stream")) {
    const json = await res.json().catch(() => ({}));
    if (json.crisis) {
      h.onCrisis(json.reply);
      openCrisis();
      return;
    }
    if (handlePaywall(res.status, json)) {
      h.onError(json.error ?? "");
      return;
    }
    h.onError(json.error ?? "Something went wrong.");
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) return h.onError("Something went wrong.");
  const decoder = new TextDecoder();
  let buffer = "";
  // The server always sends an explicit `done` or `error` SSE event, then closes the stream.
  // `reader.read()` reports `done: true` right after that close, which is a *second*, separate
  // signal that the stream ended — not a second completion. Track whether we already got the
  // explicit event so a normal reply doesn't get delivered to the caller twice (it was: every
  // reply rendered as two identical message bubbles, and every voice reply was spoken twice).
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = /^event: (.*)$/m.exec(frame)?.[1];
      const raw = /^data: (.*)$/m.exec(frame)?.[1];
      if (!event || !raw) continue;
      const data = JSON.parse(raw);
      if (event === "delta") h.onDelta(data as string);
      else if (event === "done") {
        finished = true;
        h.onDone();
      } else if (event === "error") {
        finished = true;
        h.onError(data.error ?? "My reply got cut off.");
      }
    }
  }
  // Fallback only: the connection dropped before the server's explicit done/error event arrived.
  if (!finished) h.onDone();
}

export async function loadHistory(): Promise<CompanionMessage[]> {
  const res = await fetch("/api/companion", { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()).messages ?? [];
}

export async function forgetConversation() {
  const res = await fetch("/api/companion", { method: "DELETE" });
  if (!res.ok) throw new Error("Couldn't clear your conversation.");
}
