"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useUser } from "@/components/app/user-context";
import { MAX_MESSAGE, STARTERS, type CompanionMessage } from "@/lib/companion";
import { forgetConversation, loadHistory, sendMessage } from "@/lib/companion-client";
import { openCrisis } from "@/lib/safety-client";

export default function TalkPage() {
  const user = useUser();
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    loadHistory()
      .then(setMessages)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const message = text.trim().slice(0, MAX_MESSAGE);
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    const now = new Date().toISOString();
    setMessages((m) => [...m, { id: `local-${now}`, role: "user", content: message, risk: false, created_at: now }]);
    let acc = "";
    setStreaming("");
    await sendMessage(message, {
      onDelta: (d) => {
        acc += d;
        setStreaming(acc);
      },
      onDone: () => {
        if (acc) setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: acc, risk: false, created_at: new Date().toISOString() }]);
        setStreaming(null);
        setBusy(false);
      },
      onCrisis: (reply) => {
        setMessages((m) => [...m, { id: `c-${Date.now()}`, role: "assistant", content: reply, risk: true, created_at: new Date().toISOString() }]);
        setStreaming(null);
        setBusy(false);
      },
      onError: (msg) => {
        setStreaming(null);
        setBusy(false);
        if (msg) setError(msg);
      },
    });
  };

  const forget = async () => {
    try {
      await forgetConversation();
      setMessages([]);
      setConfirmForget(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear.");
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="mono-label !text-mint">talk to lull</p>
        <h1 className="mt-3 font-[family-name:var(--font-unbounded)] text-3xl font-semibold">Someone to think out loud with, at 3am.</h1>
        <p className="mt-4 text-muted">
          A companion grounded in CBT skills: thought records, reframing, grounding, worry time. It knows your plan and your check-ins, never gives
          medical advice, and hands you to real human help the moment things feel unsafe.
        </p>
        <Link href="/login?mode=signup" className="mt-8 inline-block rounded-full bg-mint px-7 py-3 text-sm font-semibold text-bg">
          Create a free account
        </Link>
        <p className="mono-label mt-4 !text-[10px]">15 messages a day free · encrypted · you can wipe it any time</p>
      </div>
    );
  }

  const empty = messages.length === 0 && streaming === null;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="mono-label !text-mint">talk to lull</p>
          <h1 className="mt-1 font-[family-name:var(--font-unbounded)] text-2xl font-semibold">How are you doing?</h1>
        </div>
        {messages.length > 0 &&
          (confirmForget ? (
            <span className="flex gap-2">
              <button onClick={forget} className="rounded-full bg-rose px-3 py-1.5 text-xs font-semibold text-bg">
                Forget everything
              </button>
              <button onClick={() => setConfirmForget(false)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs">
                Keep
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirmForget(true)} className="font-mono text-[11px] text-faint hover:text-rose">
              clear memory
            </button>
          ))}
      </header>

      {empty && (
        <div className="mt-8">
          <p className="text-muted">
            I&apos;m here to listen, and to help you use a skill that fits. I&apos;m not a therapist or a doctor, and I can&apos;t advise on medicines.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-white/12 px-4 py-2 text-sm text-ink/85 transition hover:border-mint/50 hover:text-mint"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex-1 space-y-4">
        {messages.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-3 text-sm"
                  : `max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed ${m.risk ? "border border-rose/30 bg-rose/[0.07]" : "glass"}`
              }
            >
              {m.content}
              {m.risk && m.role === "assistant" && (
                <button onClick={openCrisis} className="mt-3 block rounded-full bg-rose px-4 py-2 text-xs font-semibold text-bg">
                  Open help now →
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {streaming !== null && (
          <div className="glass max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed">
            {streaming || <span className="shimmer-text font-mono text-xs uppercase tracking-[0.2em]">thinking…</span>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
          {error}
        </p>
      )}

      <div className="sticky bottom-20 mt-6 md:bottom-4">
        <div className="glass flex items-end gap-2 rounded-3xl p-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_MESSAGE))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={2}
            disabled={busy}
            placeholder="Whatever's on your mind…"
            className="max-h-40 flex-1 resize-none bg-transparent p-3 text-[15px] outline-none placeholder:text-faint disabled:opacity-60"
            aria-label="Message"
          />
          <button
            onClick={() => void send(draft)}
            disabled={busy || !draft.trim()}
            className="mb-1 mr-1 shrink-0 rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-bg transition disabled:opacity-40"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
        <p className="mono-label mt-2 !text-[10px]">
          not a therapist or doctor · no medical advice · encrypted ·{" "}
          <button onClick={openCrisis} className="underline decoration-rose/40 hover:text-rose">
            urgent help
          </button>
        </p>
      </div>
    </div>
  );
}
