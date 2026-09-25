import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "@/lib/companion-client";

/**
 * `sendMessage` parses a raw SSE byte stream by hand (no EventSource, so the client can send a
 * POST body). That hand-rolled parser is exactly the kind of code that looks right and isn't:
 * this file exists because it wasn't — see the "delivers the reply exactly once" test, which is
 * a regression test for a real production bug (every companion reply rendered as two identical
 * message bubbles, and every voice reply was spoken twice) caused by the parser treating the
 * stream's physical close as a second completion signal, on top of the explicit `done` event.
 *
 * `window` isn't defined under vitest's `node` environment (see vitest.config.mts); `sendMessage`
 * only ever needs `window.dispatchEvent`/`CustomEvent`, both natively available in this Node
 * runtime, so a minimal shim is cheaper than pulling in jsdom for one file.
 */
beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = globalThis;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const encoder = new TextEncoder();

/** Builds a fetch Response streaming the given SSE frames, one chunk per frame. */
function sseResponse(frames: string[], status = 200): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return new Response(stream, { status, headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
}

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function handlers() {
  return {
    onDelta: vi.fn(),
    onDone: vi.fn(),
    onCrisis: vi.fn(),
    onError: vi.fn(),
  };
}

describe("sendMessage — SSE stream parsing", () => {
  it("delivers the reply exactly once (regression: was firing onDone twice per reply)", async () => {
    const h = handlers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse([frame("delta", "Hello"), frame("delta", " there"), frame("done", { medical: false })])),
    );
    await sendMessage("hi", h);
    expect(h.onDelta).toHaveBeenCalledTimes(2);
    expect(h.onDelta).toHaveBeenNthCalledWith(1, "Hello");
    expect(h.onDelta).toHaveBeenNthCalledWith(2, " there");
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("splits multiple SSE frames delivered in a single chunk", async () => {
    const h = handlers();
    const combined = frame("delta", "a") + frame("delta", "b") + frame("delta", "c") + frame("done", {});
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(combined));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { headers: { "Content-Type": "text/event-stream" } })));
    await sendMessage("hi", h);
    expect(h.onDelta.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it("handles a frame split across two stream chunks", async () => {
    const h = handlers();
    const whole = frame("delta", "reassembled") + frame("done", {});
    const cut = Math.floor(whole.length / 2);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(whole.slice(0, cut)));
        controller.enqueue(encoder.encode(whole.slice(cut)));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { headers: { "Content-Type": "text/event-stream" } })));
    await sendMessage("hi", h);
    expect(h.onDelta).toHaveBeenCalledWith("reassembled");
    expect(h.onDone).toHaveBeenCalledTimes(1);
  });

  it("calls onError once, and never onDone, when the server sends an error event", async () => {
    const h = handlers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([frame("delta", "partial"), frame("error", { error: "My reply got cut off." })])));
    await sendMessage("hi", h);
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onError).toHaveBeenCalledWith("My reply got cut off.");
    expect(h.onDone).not.toHaveBeenCalled();
  });

  it("falls back to onDone once if the connection closes with no explicit done/error event", async () => {
    // A dropped connection: deltas arrive, then the stream just ends with nothing else.
    const h = handlers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse([frame("delta", "cut off mid")])));
    await sendMessage("hi", h);
    expect(h.onDone).toHaveBeenCalledTimes(1);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("routes a non-streamed crisis response to onCrisis and opens the crisis sheet, without touching the stream parser", async () => {
    const h = handlers();
    const dispatched: string[] = [];
    (globalThis.window as Window).dispatchEvent = ((e: Event) => {
      dispatched.push(e.type);
      return true;
    }) as typeof window.dispatchEvent;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ reply: "I'm glad you told me.", crisis: true }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await sendMessage("I want to end it", h);
    expect(h.onCrisis).toHaveBeenCalledWith("I'm glad you told me.");
    expect(h.onDelta).not.toHaveBeenCalled();
    expect(h.onDone).not.toHaveBeenCalled();
    expect(dispatched).toContain("lull:crisis");
  });

  it("reports a 402 paywall response through onError without throwing", async () => {
    const h = handlers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Free includes 15 messages a day.", upgrade: true, feature: "companion" }), {
          status: 402,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await sendMessage("hi", h);
    expect(h.onError).toHaveBeenCalledWith("Free includes 15 messages a day.");
  });

  it("reports a plain error JSON response (e.g. rate limit) through onError", async () => {
    const h = handlers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "We've talked a lot today." }), { status: 429, headers: { "Content-Type": "application/json" } })),
    );
    await sendMessage("hi", h);
    expect(h.onError).toHaveBeenCalledWith("We've talked a lot today.");
  });

  it("reports a network failure (fetch throws) through onError, in plain language", async () => {
    const h = handlers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await sendMessage("hi", h);
    expect(h.onError).toHaveBeenCalledTimes(1);
    expect(h.onDone).not.toHaveBeenCalled();
  });

  it("does not throw when the stream body is missing", async () => {
    const h = handlers();
    const res = new Response(null, { headers: { "Content-Type": "text/event-stream" } });
    // Force a null body reader regardless of runtime Response quirks.
    Object.defineProperty(res, "body", { value: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
    await sendMessage("hi", h);
    expect(h.onError).toHaveBeenCalledTimes(1);
  });
});
