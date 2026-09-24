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
import { getMessages } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";


export default async function Home() {
  const user = await getSessionUser();
  const { t } = await getMessages();
  const l = t.landing;

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
            {l.hero.tagline}
          </p>
        </Reveal>
        <Reveal delay={0.3}>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">{l.hero.body}</p>
        </Reveal>
        <Reveal delay={0.45} className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app/compose"
            className="group relative rounded-full bg-ink px-6 py-3 text-sm font-medium text-bg shadow-[0_0_40px_-8px_rgba(142,245,212,0.8)] transition hover:shadow-[0_0_60px_-4px_rgba(142,245,212,0.9)]"
          >
            {l.hero.compose} <span className="inline-block transition group-hover:translate-x-0.5">→</span>
          </Link>
          <Link href="/app/breathe" className="rounded-full border border-white/15 px-6 py-3 text-sm text-ink/90 transition hover:border-white/40">
            {l.hero.breathe}
          </Link>
        </Reveal>
        <Reveal delay={0.6}>
          <code className="mt-8 inline-block rounded-md border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs text-muted">
            <span className="text-lime">$</span> {l.hero.note}
          </code>
        </Reveal>
        <div className="mono-label absolute bottom-8 animate-bounce">{l.hero.scroll}</div>
      </section>

      {/* EVERYTHING */}
      <section data-shape="1" className="relative px-4 py-32">
        <Reveal className="glass mx-auto max-w-5xl rounded-3xl p-7 sm:p-12">
          <div className="grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-center">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                {l.everything.heading}
              </h2>
              <p className="mt-5 max-w-lg text-muted">{l.everything.body}</p>
            </div>
            <div className="text-center">
              <BreathMatch />
              <p className="mono-label mt-4">{l.everything.breathNote}</p>
            </div>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-8 border-t border-white/10 pt-10 sm:grid-cols-2">
            {l.everything.features.map((f) => (
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
            <p className="mono-label !text-lime">{l.sound.label}</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight sm:text-4xl">
              {l.sound.heading}
            </h2>
            <p className="mt-4 max-w-xl text-muted">{l.sound.body}</p>
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
            <p className="mono-label !text-mint">{l.compose.label}</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              {l.compose.heading}
            </h2>
            <p className="mt-6 max-w-md text-muted">{l.compose.body}</p>
            <Link href="/app/compose" className="kbd mt-8 inline-block !text-sm !normal-case">
              {l.compose.cta}
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
            {l.compare.heading}
          </h2>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-2 bg-white/[0.03] px-5 py-3">
              <span className="mono-label">{l.compare.usual}</span>
              <span className="mono-label !text-lime">lull</span>
            </div>
            {l.compare.rows.map((row) => (
              <div key={row.usual} className="grid grid-cols-2 gap-4 border-t border-white/10 px-5 py-4 text-sm">
                <span className="text-muted line-through decoration-white/20">{row.usual}</span>
                <span className="text-ink">{row.lull}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section data-shape="5" className="relative flex min-h-[110dvh] flex-col items-center justify-end px-4 pb-10 text-center">
        <Reveal>
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-6xl">
            {l.cta.heading}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">{l.cta.body}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={user ? "/app" : "/login?mode=signup"}
              className="rounded-full bg-lime px-7 py-3 text-sm font-semibold text-bg shadow-[0_0_50px_-6px_var(--lime)] transition hover:brightness-110"
            >
              {user ? l.cta.open : l.cta.signUp}
            </Link>
            <a href={SITE.github} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-7 py-3 text-sm transition hover:border-white/40">
              {l.cta.source}
            </a>
          </div>
        </Reveal>
        <footer className="mono-label mt-24 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 !text-[10px]">
          <span>{l.footer.left}</span>
          <LanguageSwitcher />
          <span>{l.footer.right}</span>
        </footer>
      </section>
    </main>
  );
}
