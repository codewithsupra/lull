<div align="center">

# lull

**Calm, composed for you.**

An AI-composed meditation studio. Tell Lull how you feel in one sentence, and it writes a guided session for that moment, picks a breath pattern, mixes a soundscape that is synthesized live in your browser, and reads the session to you.

**[lull-ai.vercel.app](https://lull-ai.vercel.app)** &nbsp;·&nbsp; Next.js 16 · TypeScript · InsForge · WebGL · Web Audio

</div>

---

## Why this exists

Apps like Calm and Headspace are libraries: you browse hundreds of pre-recorded tracks and hope one fits. Lull goes the other way and builds the session around how you feel right now.

| The usual app | Lull |
| --- | --- |
| Pre-recorded library | Composed for this exact moment |
| Same audio files on loop | Soundscapes synthesized in real time, so they never repeat |
| Browse to find a session | One sentence → a full session |
| Subscription | Free & open source |

## ❀ Care Plan: prescription → a daily plan with XP

**The flagship feature.** People newly diagnosed with anxiety, insomnia, stress, low mood or ADHD often leave the doctor with a prescription and no routine. Care Plan turns that into a **4-week adaptive plan**:

1. **Intake.** Consent, a short quiz (condition, severity, wake/bed times, goals), then optionally a **prescription scan** (photo or PDF, printed or handwritten) and a free-text description.
2. **Confirm.** A vision model extracts the regimen, and the user checks each medicine before anything is saved. Medication tasks are **built by code straight from the confirmed prescription**, never by the LLM, so a dose can't drift.
3. **Plan.** An LLM designs evidence-based habits (CBT-I, stimulus control, light exposure, worry time, behavioural activation, and so on), Lull sessions that deep-link into breathwork, soundscapes and compose, learn cards, and doctor-prep questions. Anything worth checking (unusual doses, driving on sedatives, caffeine) becomes an **"Ask your doctor about…" flag**. It is never turned into an instruction.
4. **Play.** Each task earns XP (medicine 20, habit 15, session 30, learn 10, reflect 10, plus 50 for a complete day). XP drives levels and streaks, and a **WebGL night garden** grows as you go: a leaf per task, a bloom per complete day, and fireflies for your streak.
5. **Adapt.** At the end of each week the plan reviews completion and mood, keeps what worked, eases what didn't, and generates the next week.
6. **Remind.** Web push (PWA) at each part of the day. The payload is always generic and never names medicines or conditions.

### Privacy & security model

| Concern | What Lull does |
| --- | --- |
| Prescription images | Read in request memory only: never written to disk, storage or logs |
| AI providers | OpenRouter routing restricted to zero-data-retention providers (`data_collection: deny`, `zdr: true`) |
| PII | The model is instructed never to return names, dates, IDs or contact details, and a server-side redactor (`lib/redact.ts`) scrubs any that slip through |
| Health data at rest | AES-256-GCM field encryption (`lib/crypto.ts`) with versioned ciphertext (`v1:`) for key rotation, decrypted only in server routes |
| Access control | RLS on every table with `(select auth.uid())` policies and anon revoked. Updates are column-level only, and task completion is server-stamped by a trigger to stop XP back-dating. The InsForge advisor reports 0 findings |
| Logging | `lib/log.ts` logs event names, codes and ids only, never bodies or model output |
| Transport & browser | Strict CSP, HSTS preload, frame-ancestors none, `no-store` on all API responses |
| Right to delete | One tap deletes plan, medicines, tasks, reminders and profile |
| Safety | Crisis-language detection shows resources (988, Tele-MANAS 14416, Samaritans, findahelpline.com) before continuing |

## Features

- **◍ Talk to Lull.** A 24/7 companion grounded in CBT/ACT skills (thought records, reframing, worry time, grounding, behavioural activation) that streams its replies. Context is assembled server-side from encrypted rows — care plan, care tier, screener scores, recent mood, today's progress — so it knows where you are without the client ever holding that data. A safety classifier screens every turn **before** the model and before any quota check: crisis language never reaches the model and instead triggers a fixed handoff plus the crisis sheet, and prescribing or diagnosis questions get a hard boundary. History is encrypted and the user can wipe it in one tap. A red-team suite (`npm run redteam`) runs adversarial prompts against the real model on every change.

- **✦ Compose.** Describe your state ("big interview tomorrow, mind racing at 1am"). The server asks an LLM, through InsForge's OpenRouter model gateway, for a structured plan: title, intention, breath technique, a 7-layer sound mix, a paced script and a closing line. Zod validates the plan and the database saves it, and the player reads it aloud with the Speech Synthesis API over the generated soundscape. If someone mentions self-harm, the plan carries a care message pointing them to crisis resources.
- **∿ Generative soundscapes.** Rain, ocean, wind, hearth, brown noise, a harmonic drone and singing bowls are all synthesized with the Web Audio API from noise buffers, biquad filters, LFOs and inharmonic partials. The app ships no audio files. Includes a radial audio-reactive visualizer and a sleep timer that fades out over 30 seconds.
- **◎ Breathwork.** Coherent (5.5/min), box, 4-7-8 and the physiological sigh, with a rAF-driven orb pacer and soft guiding tones that glide up on the inhale and down on the exhale.
- **◐ Today dashboard.** Streak, minutes and session counts come from one Postgres RPC. There's also a two-tap mood check-in, a time-aware suggestion and recent practice.
- **▤ Journal & AI insight.** A mood curve, your most common tags, and an LLM reflection on patterns across your check-ins and practice history.
- **Landing page.** Inspired by remix.run: a 15k-particle WebGL field that morphs between a galaxy, a breathing sphere, an ocean, a DNA helix, a crescent moon and the wordmark as you scroll. The whole field breathes at 5.5 breaths per minute. Keyboard shortcuts work everywhere (`B` `S` `C` `J` `T` `L`).

## Architecture

```
app/
  page.tsx                 landing (server component + client WebGL/audio islands)
  login/                   email/password + Google/GitHub OAuth (server actions)
  app/                     the product: today, compose, breathe, sounds, journal
  api/compose/route.ts     auth → daily rate limit → LLM → zod → insert (RLS)
  api/insight/route.ts     auth → recent rows → LLM pattern summary
  api/auth/{refresh,callback}
  api/intake/extract       prescription photo/PDF → redacted regimen (in-memory, ZDR model)
  api/plan                 generate (POST) · load today (GET) · delete everything (DELETE)
  api/plan/replan          adaptive next-week plan from completion + mood
  api/push/{subscribe,dispatch}   web push; dispatch runs every 5 min via InsForge schedule
proxy.ts                   Next 16 proxy: refreshes InsForge session cookies
lib/audio/engine.ts        generative Web Audio synth engine (singleton)
lib/crypto.ts              AES-256-GCM field encryption for health data
lib/redact.ts              PII scrubber (defence in depth)
lib/care-plan*.ts          schemas, prompts, deterministic task builder, server loaders
components/plan/           intake wizard, plan home, night garden (WebGL), crisis card
lib/breath.ts              breathing patterns
components/landing/        particle field, stacked scroll type, live demos
migrations/                SQL schema, RLS policies, my_stats() RPC
```

**Auth.** Uses `@insforge/sdk/ssr`. Sign-in, sign-up and OAuth run as server actions, and the refresh token sits in an httpOnly cookie. The browser client only reads the short-lived access token, and `proxy.ts` keeps Server Components in sync.

**Data.** Mood and practice data live in three append-only tables: `mood_checkins`, `practice_sessions` and `composed_sessions`. Row-level security limits each user to their own rows (select, insert and delete only, with `UPDATE` revoked), and `anon` has no access. Size limits are enforced as `CHECK` constraints. `my_stats()` computes the streak with a gaps-and-islands query as `SECURITY INVOKER`, so RLS still applies inside it.

**AI.** The OpenRouter key is server-only. Each user gets 15 compositions per 24 hours, counted from their own rows. Replies use JSON mode and are validated with Zod, which falls back to safe defaults when a field is malformed.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in InsForge URL + anon key + OpenRouter key
npx @insforge/cli link       # link your InsForge project
npx @insforge/cli db migrations up --all
npm run dev
```

## Stack

Next.js 16 (App Router, Turbopack, Server Actions) · React 19 · TypeScript · Tailwind CSS v4 · InsForge (Postgres, Auth, RLS, AI gateway) · OpenRouter (Gemini 2.5 Flash) · three.js (custom GLSL shaders) · Web Audio API · Speech Synthesis API · motion · Zod · Vercel

---

<sub>Lull is a wellbeing tool, not medical advice. If you're in crisis, contact local emergency services (in the US, call or text 988).</sub>
