"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, signInWithProvider, type AuthState } from "@/app/actions/auth";
import { useI18n } from "@/components/i18n/locale-provider";

const initial: AuthState = { error: null };

export function AuthForm({ initialMode, urlError }: { initialMode: "signin" | "signup"; urlError: string | null }) {
  const { t } = useI18n();
  const a = t.app.auth;
  const [mode, setMode] = useState(initialMode);
  const [inState, inAction, inPending] = useActionState(signIn, initial);
  const [upState, upAction, upPending] = useActionState(signUp, initial);
  const pending = inPending || upPending;
  const error = (mode === "signin" ? inState.error : upState.error) ?? urlError;

  return (
    <div>
      <div className="grid grid-cols-2 rounded-full border border-white/10 p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full py-2 transition ${mode === m ? "bg-white/10 text-ink" : "text-muted hover:text-ink"}`}
          >
            {m === "signin" ? a.signIn : a.createAccount}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        {(["google", "github"] as const).map((p) => (
          <form key={p} action={signInWithProvider.bind(null, p)}>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm transition hover:border-white/25 hover:bg-white/[0.06]">
              {p === "google" ? <GoogleIcon /> : <GithubIcon />}
              {p === "google" ? a.google : a.github}
            </button>
          </form>
        ))}
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="mono-label !text-[10px]">{a.orWithEmail}</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <form action={mode === "signin" ? inAction : upAction} className="space-y-3">
        {mode === "signup" && <Field name="name" type="text" label={a.name} autoComplete="name" required={false} />}
        <Field name="email" type="email" label={a.email} autoComplete="email" />
        <Field name="password" type="password" label={a.password} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} />
        {error && (
          <p role="alert" className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
            {error}
          </p>
        )}
        <button
          disabled={pending}
          className="mt-2 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-bg shadow-[0_0_40px_-10px_rgba(142,245,212,0.8)] transition hover:brightness-95 disabled:opacity-60"
        >
          {pending ? a.working : mode === "signin" ? a.signIn : a.createAccount}
        </button>
      </form>
    </div>
  );
}

function Field(props: { name: string; type: string; label: string; autoComplete: string; required?: boolean; minLength?: number }) {
  const { label, required = true, ...rest } = props;
  return (
    <label className="block">
      <span className="mono-label !text-[10px]">{label}</span>
      <input
        {...rest}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-faint focus:border-mint/50 focus:shadow-[0_0_0_3px_rgba(142,245,212,0.12)]"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z" />
    </svg>
  );
}
