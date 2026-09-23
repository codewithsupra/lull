import Link from "next/link";
import { ParticleField } from "@/components/landing/particle-field";
import { TopNav } from "@/components/landing/top-nav";
import { Reveal } from "@/components/landing/reveal";
import { StackedWords } from "@/components/landing/stacked-words";
import { BreathMatch } from "@/components/landing/breath-match";
import { TrySound } from "@/components/landing/try-sound";
import { ComposeDemo } from "@/components/landing/compose-demo";
import { getSessionUser } from "@/lib/insforge/server";
import { SITE } from "@/lib/site";

const FEATURES = [
  {
    title: "AI-composed sessions",
    body: "Describe your moment in a sentence. Lull writes a guided meditation for it, picks a breath pattern, sets a soundscape and reads it to you.",
  },
  {
    title: "Generative soundscapes",
    body: "Rain, tide, wind, embers, drones and singing bowls are synthesized live in your browser. Nothing is a recording, so the same few minutes never repeat.",
  },
  {
    title: "Guided breathwork",
    body: "Coherent breathing, box breathing, 4-7-8 and the physiological sigh. A glowing pacer and soft tones guide each breath, so you can close your eyes.",
  },
  {
    title: "Mood check-ins & insight",
    body: "Log a mood in two taps. Over time Lull shows you patterns in how you feel and suggests what to try next.",
  },
];

const COMPARE = [
  ["Pre-recorded library", "Composed for this exact moment"],
  ["Same audio files on loop", "Soundscapes synthesized in real time"],
  ["Browse to find a session", "One sentence → a full session"],
  ["$69.99 / year", "Free & open source"],
];

export default async function Home() {
  const user = await getSessionUser();

  return (
    <main className="relative overflow-x-clip">
      <ParticleField />
      <TopNav signedIn={!!user} />

      {/* HERO */}
      <section data-shape="0" className="relative flex min-h-dvh flex-col items-center justify-center px-4 pt-24 text-center">
        <Reveal>
          <h1 className="wordmark select-none px-[0.14em] text-[clamp(7rem,30vw,24rem)]">lull</h1>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            Calm, composed for you.
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            Tell Lull how you feel. It writes a guided meditation for that moment, picks a breath pattern and plays a
            soundscape that is synthesized live and never repeats.
          </p>
        </Reveal>
        <Reveal delay={0.45} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app/compose"
            className="group relative rounded-full bg-ink px-6 py-3 text-sm font-medium text-bg shadow-[0_0_40px_-8px_rgba(142,245,212,0.8)] transition hover:shadow-[0_0_60px_-4px_rgba(142,245,212,0.9)]"
          >
            Compose my session <span className="inline-block transition group-hover:translate-x-0.5">→</span>
          </Link>
          <Link href="/app/breathe" className="rounded-full border border-white/15 px-6 py-3 text-sm text-ink/90 transition hover:border-white/40">
            Just breathe for a minute
          </Link>
        </Reveal>
        <Reveal delay={0.6}>
          <code className="mt-8 inline-block rounded-md border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-muted">
            <span className="text-lime">$</span> no downloads · no audio files · runs in your browser
          </code>
        </Reveal>
        <div className="mono-label absolute bottom-8 animate-bounce">↓ scroll</div>
      </section>

      {/* EVERYTHING */}
      <section data-shape="1" className="relative px-4 py-32">
        <Reveal className="glass mx-auto max-w-5xl rounded-3xl p-7 sm:p-12">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Everything you need to come back to yourself.
              </h2>
              <p className="mt-5 max-w-lg text-muted">
                Calm gives you a library to browse. Lull makes a session for how you feel right now, using breath, sound
                and voice.
              </p>
            </div>
            <div className="text-center">
              <BreathMatch />
              <p className="mono-label mt-4">this page breathes at 5.5/min · match it</p>
            </div>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-8 border-t border-white/10 pt-10 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* STACKED WORDS + SOUND */}
      <section data-shape="2" className="relative">
        <StackedWords />
        <div className="px-4 pb-32">
          <Reveal className="glass mx-auto max-w-3xl rounded-3xl p-7 sm:p-10">
            <p className="mono-label !text-lime">try it · right here</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-4xl">
              Sound, synthesized as you listen.
            </h2>
            <p className="mt-4 max-w-xl text-muted">
              Seven layers are built from filtered noise, slow oscillators and sampled randomness. Mix them any way you
              like, then set a sleep timer that fades everything out.
            </p>
            <div className="mt-8">
              <TrySound />
            </div>
          </Reveal>
        </div>
      </section>

      {/* COMPOSE */}
      <section data-shape="3" className="relative px-4 py-32">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">
          <Reveal>
            <p className="mono-label !text-mint">the headline feature</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              One sentence in. A whole session out.
            </h2>
            <p className="mt-6 max-w-md text-muted">
              Lull reads what you wrote and plans a session around it: an intention, a breath pattern, a sound mix and a
              script paced to your breathing. Then it reads the script to you. Every session is saved to your account.
            </p>
            <Link href="/app/compose" className="kbd mt-8 inline-block !text-sm !normal-case">
              [C] Compose yours →
            </Link>
          </Reveal>
          <Reveal delay={0.15} className="glass rounded-3xl p-5 sm:p-7">
            <ComposeDemo />
          </Reveal>
        </div>
      </section>

      {/* COMPARE */}
      <section data-shape="4" className="relative px-4 py-32">
        <Reveal className="glass mx-auto max-w-4xl rounded-3xl p-7 sm:p-12">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-5xl">
            A calmer take on calm.
          </h2>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-2 bg-white/[0.03] px-5 py-3">
              <span className="mono-label">the usual app</span>
              <span className="mono-label !text-lime">lull</span>
            </div>
            {COMPARE.map(([a, b]) => (
              <div key={a} className="grid grid-cols-2 gap-4 border-t border-white/10 px-5 py-4 text-sm">
                <span className="text-muted line-through decoration-white/20">{a}</span>
                <span className="text-ink">{b}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section data-shape="5" className="relative flex min-h-[110dvh] flex-col items-center justify-end px-4 pb-10 text-center">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-6xl">
            Unwind in under a minute.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            Breathing and soundscapes work without an account. Sign up free to compose sessions and track your streak.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={user ? "/app" : "/login?mode=signup"}
              className="rounded-full bg-lime px-7 py-3 text-sm font-semibold text-bg shadow-[0_0_50px_-6px_var(--lime)] transition hover:brightness-110"
            >
              {user ? "Open Lull" : "Create free account"}
            </Link>
            <a href={SITE.github} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-7 py-3 text-sm transition hover:border-white/40">
              ★ View source
            </a>
          </div>
        </Reveal>
        <footer className="mono-label mt-24 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 !text-[10px]">
          <span>© 2026 lull · not medical advice</span>
          <span>next.js 16 · insforge · webgl · web audio</span>
        </footer>
      </section>
    </main>
  );
}
