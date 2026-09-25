"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { useUser } from "@/components/app/user-context";
import { MAX_MESSAGE, starters, type CompanionMessage } from "@/lib/companion";
import { forgetConversation, loadHistory, sendMessage } from "@/lib/companion-client";
import { openCrisis } from "@/lib/safety-client";
import { useI18n } from "@/components/i18n/locale-provider";
import { speak } from "@/lib/audio/engine";
import { isRecognitionSupported, startRecognizer, type Recognizer } from "@/lib/voice-input";

export default function TalkPage() {
  const user = useUser();
  const { locale, t } = useI18n();
  const c = t.companion;
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);
  // Voice replies default off: a person who did not expect this app to talk out loud (in a
  // quiet room, at work, next to someone asleep) should never be surprised by sound.
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef<Recognizer | null>(null);
  const baseDraftRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);
  // isRecognitionSupported() branches on `typeof window`, so it must never run during the
  // server render or the initial client render — the mic button would exist in the client's
  // first paint but not in the server-rendered HTML, which is a hydration mismatch (React #418).
  // useSyncExternalStore's server snapshot forces `false` for both the SSR pass and the first
  // client render; only the post-hydration re-render sees the real client-only value.
  const micSupported = useSyncExternalStore(
    () => () => {},
    () => isRecognitionSupported(),
    () => false,
  );

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

  useEffect(() => {
    // Some browsers load TTS voices lazily; this nudges the list to populate before it's needed.
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => () => recognizerRef.current?.stop(), []);
  // Changing language mid-listen would leave the recognizer talking to the wrong model; simplest
  // and safest is to just stop, so the user restarts it explicitly if they still want it.
  useEffect(() => {
    recognizerRef.current?.stop();
  }, [locale]);

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
        if (acc) {
          setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: acc, risk: false, created_at: new Date().toISOString() }]);
          if (voiceReplies) speak(acc, { locale });
        }
        setStreaming(null);
        setBusy(false);
      },
      onCrisis: (reply) => {
        setMessages((m) => [...m, { id: `c-${Date.now()}`, role: "assistant", content: reply, risk: true, created_at: new Date().toISOString() }]);
        // Crisis replies are always spoken, voice toggle or not — someone who reached for voice
        // input in this moment may be past the point of wanting to read.
        speak(reply, { locale });
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
      setError(e instanceof Error ? e.message : c.clearFailed);
    }
  };

  const toggleMic = () => {
    if (listening) {
      recognizerRef.current?.stop();
      return;
    }
    baseDraftRef.current = draft ? `${draft} ` : "";
    const recognizer = startRecognizer(locale, {
      onResult: (text) => setDraft(`${baseDraftRef.current}${text}`.slice(0, MAX_MESSAGE)),
      onEnd: () => {
        setListening(false);
        recognizerRef.current = null;
      },
      onError: () => {
        setListening(false);
        recognizerRef.current = null;
        setError(c.voiceUnsupported);
      },
    });
    if (!recognizer) {
      setError(c.voiceUnsupported);
      return;
    }
    recognizerRef.current = recognizer;
    setListening(true);
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <p className="mono-label !text-mint">{c.label}</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold">{c.guestHeading}</h1>
        <p className="mt-4 text-muted">{c.guestBody}</p>
        <Link href="/login?mode=signup" className="mt-8 inline-block rounded-full bg-mint px-7 py-3 text-sm font-semibold text-bg">
          {c.guestCta}
        </Link>
        <p className="mono-label mt-4 !text-[10px]">{c.guestNote}</p>
      </div>
    );
  }

  const empty = messages.length === 0 && streaming === null;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-2xl flex-col">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="mono-label !text-mint">{c.label}</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">{c.heading}</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-faint hover:text-ink">
            <input
              type="checkbox"
              checked={voiceReplies}
              onChange={(e) => setVoiceReplies(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--mint)]"
            />
            {c.voiceReplies}
          </label>
          {messages.length > 0 &&
            (confirmForget ? (
              <span className="flex gap-2">
                <button onClick={forget} className="rounded-full bg-rose px-3 py-1.5 text-xs font-semibold text-bg">
                  {c.forgetEverything}
                </button>
                <button onClick={() => setConfirmForget(false)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs">
                  {c.keep}
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmForget(true)} className="font-mono text-[11px] text-faint hover:text-rose">
                {c.clearMemory}
              </button>
            ))}
        </div>
      </header>

      {empty && (
        <div className="mt-8">
          <p className="text-muted">{c.intro}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {starters(locale).map((s) => (
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
                  ? "group max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-3 text-sm"
                  : `group max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed ${m.risk ? "border border-rose/30 bg-rose/[0.07]" : "glass"}`
              }
            >
              {m.content}
              {m.risk && m.role === "assistant" && (
                <button onClick={openCrisis} className="mt-3 block rounded-full bg-rose px-4 py-2 text-xs font-semibold text-bg">
                  {c.openHelp}
                </button>
              )}
              {m.role === "assistant" && !m.risk && (
                <button
                  onClick={() => speak(m.content, { locale })}
                  aria-label={c.speakReplyLabel}
                  className="mt-2 block font-mono text-[10px] text-faint opacity-0 transition hover:text-mint group-hover:opacity-100"
                >
                  ▶ {c.speakReplyLabel}
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {streaming !== null && (
          <div className="glass max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed">
            {streaming || <span className="shimmer-text font-mono text-xs uppercase tracking-[0.2em]">{c.thinking}</span>}
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
          {micSupported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={busy}
              aria-label={listening ? c.stopListening : c.micLabel}
              aria-pressed={listening}
              className={`mb-1 ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border text-base transition disabled:opacity-40 ${
                listening ? "animate-pulse border-rose/50 bg-rose/10 text-rose" : "border-white/15 text-muted hover:border-white/30 hover:text-ink"
              }`}
            >
              {listening ? "◼" : "🎙"}
            </button>
          )}
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
            placeholder={listening ? c.listening : c.placeholder}
            className="max-h-40 flex-1 resize-none bg-transparent p-3 text-[15px] outline-none placeholder:text-faint disabled:opacity-60"
            aria-label={c.messageLabel}
          />
          <button
            onClick={() => void send(draft)}
            disabled={busy || !draft.trim()}
            className="mb-1 mr-1 shrink-0 rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-bg transition disabled:opacity-40"
          >
            {busy ? c.sending : c.send}
          </button>
        </div>
        <p className="mono-label mt-2 !text-[10px]">
          {c.disclaimerPre}
          <button onClick={openCrisis} className="underline decoration-rose/40 hover:text-rose">
            {c.urgentHelp}
          </button>
        </p>
      </div>
    </div>
  );
}
