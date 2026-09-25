# Lull — full technical dossier for resume writing

**Purpose of this file:** everything a resume-writing agent needs to accurately represent this
project, at whatever altitude the resume calls for — a single bullet, a project section, or a
deep technical interview follow-up. Every number in here is grounded in the actual repository
as of **2026-09-25**, not recalled from memory. Where something is aspirational rather than
shipped, it's labeled that way explicitly — do not claim it as done.

**Do not claim:** YC backing, funding, revenue, or MRR. None of these are true. The goal
statement inside the project ("YC-backed, real MRR") is the founder's internal ambition, not a
fact about the current state of the company. Claiming it on a resume is a lie that a recruiter
or interviewer can trivially disprove by asking "which batch?" — it actively damages
credibility. What's true and defensible: a solo-built, production-deployed, security- and
safety-engineered health-tech product with real users possible today, shipped on a strict
weekly milestone cadence.

---

## 1. One-line pitches, by length

**5 words:** Encrypted, bilingual AI mental-health app.

**15 words:** Solo-built mental-health app with field-level encryption, a bilingual AI safety
system, and weekly ship cadence.

**One sentence (resume bullet, no metrics):** Designed and built Lull, a production mental-health
platform with AES-256-GCM field encryption, Postgres row-level security on every table, and a
crisis-detection system verified against 40+ adversarial prompts run against the live model in
CI, across English and Hindi simultaneously.

**One sentence (resume bullet, with metrics):** Solo-architected and shipped a full-stack
mental-health platform (Next.js 16, Postgres, LLM gateway) across 4 weekly milestones — auth,
AI-generated care plans, subscription billing, a 24/7 AI companion with a crisis-safety layer,
and full Hindi localization including voice — maintaining 0 critical/0 warning security-advisor
findings and 251 passing unit tests throughout.

**Two-sentence project blurb (portfolio/README style):** Lull is a mental-health app that turns a
prescription or a described diagnosis into a 4-week adaptive care plan, backed by a 24/7 AI
companion that never gives medical advice and hands off to real crisis resources the moment
something looks unsafe. Every health field is encrypted before it touches the database, every AI
call is routed through zero-data-retention providers, and the whole product — screeners, the
companion, crisis detection, even voice — works identically in English and Hindi.

---

## 2. What problem it solves, and why the positioning is deliberate

**The gap:** ~1 in 8 people worldwide live with a mental disorder. In India, ~83% receive no
treatment at all — there are roughly 0.75 psychiatrists per 100,000 people. The barriers are
stigma, cost, language, and access, not a lack of meditation content.

**Why not "solve mental health"?** The founder's original brief was to build something that
"solves all mental health issues" and "everyone will talk about." That framing was explicitly
rejected during a product-analysis pass, because apps that claim to treat everything get shut
down or discredited, and the claim isn't defensible. Lull instead positions as **the stepped-care
front door**: screen everyone, support most people with self-help, route the ones who need more
to peer support, then therapists, then crisis lines — with every step measured on validated
clinical scales. This is the model that scales and the model insurers/governments/investors
actually fund. This positioning decision — and the reasoning behind rejecting the broader,
flashier claim — is itself worth mentioning in an interview: it demonstrates product judgment,
not just execution.

**Competitive framing:**
| | Calm / Headspace | Wysa / Amaha | Lull |
|---|---|---|---|
| Screening & routing | None | Partial | PHQ-9 + GAD-7, stepped-care tiers |
| Language | English-first | English-first | English + Hindi, architected for more |
| Personalization | Browse a library | Generic chat | Prescription/diagnosis → generated 4-week plan |
| Pricing (India) | US pricing | Mid | ₹199/mo (~$2.40) |
| Privacy architecture | Opaque | Opaque | Field-level encryption, published crisis-safety model |

---

## 3. Tech stack — exact versions, as of this file's date

- **Framework:** Next.js **16.3.5** (App Router, Turbopack), React **19.2.8**
- **Language:** TypeScript, strict mode, `tsc --noEmit` as a gate
- **Backend/BaaS:** InsForge (Postgres + Row-Level Security, auth, AI gateway, payments,
  scheduled jobs, realtime) — SDK `@insforge/sdk ^1.5.2`
- **AI:** OpenRouter (via InsForge's gateway), `openai` SDK `^7.20.0` as the client shape;
  models selected per call, always with zero-data-retention routing enforced
- **Validation:** Zod `^4.6.5` for every API input and every LLM output shape
- **3D/graphics:** three.js `^0.186.0` (raw `ShaderMaterial`, no scene-graph abstraction)
- **Audio:** native Web Audio API — no library, no shipped audio files
- **Animation:** `motion` (Framer Motion successor) `^13.4.0`
- **Push notifications:** `web-push ^3.6.7`, VAPID keys, service worker
- **Testing:** Vitest `^5.0.1`, 251 unit tests across 13 files, zero integration/E2E framework
  (deliberate — see §9)
- **Payments:** Stripe (USD, via InsForge Payments) live; Razorpay (INR/UPI) integration
  written, test keys not yet configured
- **Deployment:** Vercel (app), InsForge-hosted Postgres, GitHub for source control and CI gate
- **PWA:** custom service worker (`public/sw.js`), Web Push, per-locale offline fallback pages

**Codebase size:** 130 TypeScript/TSX files, ~12,000 lines, across `app/`, `components/`, `lib/`
(excludes tests, migrations, scripts, config).

---

## 4. Feature-by-feature technical breakdown

### 4.1 Care Plan (the original flagship feature, M1)
A user enters symptoms/diagnosis, or scans a prescription (photo or PDF), and gets a 4-week
adaptive daily plan.

- **Intake:** consent screen, condition category, severity (1–5), wake/sleep times, up to 4
  goals, free text, optional prescription photo/PDF.
- **Extraction:** a vision-capable LLM reads the prescription **in request memory only** — never
  written to disk, object storage, or logs — and returns a structured, redacted regimen. The
  image is discarded the instant extraction completes.
- **Confirmation gate:** every extracted medicine is shown to the user, who must check it against
  their actual prescription before it's saved. Nothing is scheduled unconfirmed.
- **Deterministic medication scheduling — the core invariant:** medication tasks are built by
  plain code (`lib/care-plan-tasks.ts`) directly from the user-confirmed name/dose/times, **never
  by the LLM.** An LLM cannot invent, omit, or drift a dose. Medicines marked "as needed" are
  never auto-scheduled — the system will not guess a time for a PRN medication.
  **This one architectural decision is probably the single most interview-worthy detail in the
  whole project:** it's the difference between "an AI wrapper" and "an engineer who understood
  that non-deterministic components must never touch the one field where being wrong is
  dangerous."
- **Plan generation:** an LLM designs the *non-medical* parts of the plan — evidence-based habits
  (CBT-I sleep hygiene, stimulus control, light exposure, worry time, behavioral activation,
  ADHD body-doubling), deep links into breathwork/soundscape/compose sessions, learn cards, and
  doctor-prep questions. Anything clinically borderline (unusual dose, sedative + driving,
  caffeine/alcohol interaction) becomes a passive "ask your doctor about…" flag — the model is
  never allowed to phrase it as an instruction.
- **Gamification:** XP per task type (medication 20, habit 15, session 30, learn card 10,
  reflection 10, +50 bonus for a fully completed day), 8 named levels on a square-root curve, a
  WebGL "night garden" that grows a leaf per task and blooms per completed day.
- **Weekly adaptation:** at the end of each week, a re-plan call reviews completion rate and mood
  trend, keeps what's working, eases what isn't, and generates the next week — while keeping
  confirmed medications untouched.
- **Reminders:** Web Push at time-of-day slots. Payloads are always generic ("Your morning plan
  is ready") and never name a medicine or condition, because lock-screen notifications are
  public.

### 4.2 Screening & stepped-care routing (FR1, M2)
- **Instruments:** PHQ-9 (depression, 9 items) and GAD-7 (anxiety, 7 items) — both public-domain,
  free to reproduce and translate (developed with an educational grant, no license required).
  Plus a Lull-original, non-clinical 3-item sleep snapshot. The clinically validated ISI
  (Insomnia Severity Index) was **deliberately not used, because it is licensed** — a real,
  documented build-vs-license tradeoff, not an oversight.
- **Scoring is server-side only** — the client never computes or transmits a total, only raw
  answers, closing off client-side score forgery.
- **Routing logic** (`lib/screeners.ts#route`): four care tiers.
  - **T0 (urgent):** current risk (PHQ-9 item 9 ≥ 2, or a same-session follow-up reports active
    thoughts or a plan/intent)
  - **T3 (therapist recommended):** PHQ-9 ≥ 15, GAD-7 ≥ 15, any risk flag in the last 2 weeks, or
    no meaningful improvement (< 5-point PHQ-9 or < 4-point GAD-7 drop — the published minimal
    clinically important difference) after ≥ 6 weeks in the moderate range
  - **T2 (guided + peer):** PHQ-9 or GAD-7 in the moderate range (10–14)
  - **T1 (self-guided):** everything else
- Every routing decision returns machine-readable **reason keys**, not free-text sentences — so
  the explanation can be localized without ever risking a mistranslation silently changing what
  a score means.
- A positive PHQ-9 item 9, at any severity, always surfaces crisis resources — this is not gated
  behind the tier calculation.

### 4.3 "Talk to Lull" — 24/7 AI companion (FR2, M3b)
- Grounded in CBT/ACT skills: thought records, cognitive reframing/defusion, worry time,
  grounding (5-4-3-2-1, the physiological sigh), behavioral activation, sleep hygiene,
  self-compassion. System prompt instructs: short replies (2–4 sentences), reflect before
  suggesting, at most one question per turn, no jargon, no toxic positivity.
- **Context is assembled server-side from encrypted rows** — active care plan title/week, care
  tier, latest PHQ-9/GAD-7 scores, last 5 mood check-ins (averaged, never itemized), today's
  plan completion, local time-of-day, and whether a safety plan exists. The client never holds
  or requests this data directly; it only ever sees the model's reply.
- **Safety classification runs before the model is called, and before any quota/paywall check.**
  A rules-based classifier (`lib/companion.ts#classify`) checks every user turn for (a) crisis
  language, (b) a request for medical/dosing/diagnosis advice. Crisis turns get a **fixed,
  pre-written reply** — the model is never asked to handle a crisis — and open the crisis sheet.
  Medical-boundary turns get a hard-coded prefix the model must continue from, never override.
  **Ordering the safety check before the paywall is deliberate: a person in crisis is never rate-
  limited or asked to upgrade.**
- Free tier: 15 messages/day. Pro: 200/day.
- Streaming replies via Server-Sent Events over a `ReadableStream`.
- Memory is fully user-controlled: full history view, one-tap permanent delete.
- **Verification: a red-team script (`npm run redteam`) sends 21 adversarial + 5 crisis prompts
  per language to the real production model** (not mocks) and asserts: no medication/dose
  language, no diagnosis claims, no "I am human/a therapist" claims, crisis prompts never reach
  the model at all. Current pass rate: **21/21 English, 21/21 Hindi.**

### 4.4 Crisis safety system (FR3, M3a)
- A **Stanley-Brown safety plan** (the clinical standard, 7 sections: warning signs, own coping
  steps, distracting people/places, people to call, professional contacts, making the
  environment safer, reasons to keep going) — always one tap away from anywhere in the app via a
  global "Help now" button.
- **12 countries with dedicated, real crisis-line data** (India Tele-MANAS 14416, KIRAN, iCall,
  AASRA; US 988 + Crisis Text Line + Trevor Project; UK/Ireland Samaritans + Shout; Canada,
  Australia, New Zealand, Singapore, UAE, Germany, Netherlands, South Africa), with a global
  `findahelpline.com` fallback for everyone else. Data is hardcoded and dependency-free so it
  works with zero network and zero auth.
- **Works fully offline:** the safety plan mirrors to `localStorage`; a build-time script
  generates a fully self-contained (inline CSS, no JS, no external assets) offline crisis page,
  one per supported language, which the service worker serves when a navigation fails. A
  dedicated test (`tests/offline.test.ts`) guards that the service worker's precache list can
  never drift out of sync with the generated pages — this is the one page that has to keep
  working when literally everything else has failed.
- **Crisis-language detection works in three input modes simultaneously, regardless of UI
  language:** English, Devanagari Hindi, and romanized Hindi ("Hinglish", e.g. "khudkushi",
  "marna chah raha hoon"). This was a deliberate design decision, not an afterthought — a Hindi
  speaker typing in a moment of crisis does not reliably code-switch to match whatever language
  the interface happens to be set to. (See §6 for the specific bugs this design choice caught.)

### 4.5 Pro subscription & billing (FR9, M2b)
- Free forever: breathing, soundscapes, screeners, crisis tools, 1 care plan, 3 AI-composed
  sessions/day, 15 companion messages/day.
- Pro: ₹199/mo or ₹1,499/yr (India), $7.99/mo or $59.99/yr (global) — unlimited companion (200/day
  cap), prescription scan, adaptive re-plans, full soundscape garden, doctor report (planned).
- Stripe via InsForge Payments, live in test mode. Razorpay (for UPI) integrated in code,
  pending real test API keys from the founder.
- **Entitlements are written only by a database trigger on the payments webhook table** — never
  by a success-URL redirect, which is a common and exploitable anti-pattern (a user could hit the
  success URL without ever paying). The trigger is idempotent and order-safe via a
  `last_event_at` guard, and skips gracefully if the user row no longer exists (deleted account).
- A single `my_plan()` Postgres RPC is the one source of truth for "is this user Pro" — used
  identically by the UI and by every server-side paywall check.
- Server-side paywall enforcement returns **HTTP 402** with `{upgrade: true, feature}`, which the
  client turns into an upsell sheet — the gate is enforced where it can't be bypassed by
  disabling JavaScript or intercepting a client-side check.
- A 7-day free trial is **app-granted and database-timed**, because the InsForge SDK doesn't yet
  support `trial_period_days` on Stripe Checkout — a gap that was reported upstream via
  `insforge feedback` rather than silently worked around.

### 4.6 Hindi localization & i18n architecture (FR8, M4)
This is the most architecturally distinctive part of the codebase, worth its own section.

- **Compile-time-enforced translation completeness.** The dictionary type (`Dict<T>` in
  `lib/i18n/dict.ts`) widens the English source dictionary's literal string types to `string`,
  so every other locale must have exactly the same keys and shape, but is free to write its own
  text. **A missing or misspelled Hindi key is a TypeScript compile error, not a blank space on
  a screen in production.** This is how "100% string coverage" is actually enforced, rather than
  just claimed.
- **Clinical instruments and business logic are language-free by construction.** PHQ-9/GAD-7
  carry item counts and answer values only (`lib/screeners.ts`); all wording lives in the
  dictionary. Routing returns stable reason keys, not sentences. **A mistranslation literally
  cannot change a clinical score or a care-tier decision** — the two concerns are structurally
  separated, not just conventionally kept apart.
- **AI-generated content is written directly in the target language**, not translated after
  generation — the system prompt for the companion, the care-plan generator, and the composer
  all receive an explicit language directive instructing natural spoken Hindi (not the stiff,
  Sanskritized Hindi of government forms), with a carve-out to keep common loanwords ("stress",
  "app") rather than hunting for unfamiliar pure-Hindi substitutes nobody actually says.
- **Locale resolution chain** (`proxy.ts`): `?lang=` query param → saved cookie → browser
  `Accept-Language` header (with full RFC q-weight parsing) → English default. Resolved once in
  middleware and written back so Server Components in the same request never see a stale value.
- **Voice (TTS/STT), also locale-aware:** pure voice-matching logic (`lib/voice.ts`) separates
  "which BCP-47 prefix matches an installed TTS voice" from "which exact tag SpeechRecognition
  needs" — because those are different API contracts with different tolerance for approximation.
  Verified against a real browser: correctly resolves to "Lekha" (a real macOS Hindi voice) from
  180 installed system voices. Voice input only ever fills a draft text box, **never
  auto-sends** — a misheard word in a mental-health conversation is exactly the kind of mistake a
  person should get to see and correct before it goes anywhere.
- **A clinical-review flag is tracked and surfaced in the UI**: `LOCALE_META.hi.clinicallyReviewed
  = false`. The Hindi PHQ-9/GAD-7 translations and companion copy have not yet been checked by a
  native-Hindi-speaking clinician, and the product says so rather than silently claiming
  equivalence it hasn't earned.

### 4.7 Generative audio & visual engines
- **No audio files ship with the app, anywhere.** Seven soundscape layers (rain, ocean, wind,
  hearth fire, brown noise, a harmonic drone, singing bowls) are synthesized live from noise
  buffers, biquad filters, LFOs, and inharmonic partials via the raw Web Audio API — meaning the
  same "recording" never repeats and there's zero audio-asset payload.
  4 breath patterns (coherent 5.5/min, box 4-4-4-4, 4-7-8, the physiological sigh) drive a
  requestAnimationFrame-based pacer with synchronized tones.
- **Landing page:** a 15,000-particle WebGL point cloud (raw three.js `ShaderMaterial`, no
  scene-graph abstraction) that morphs between six formations (galaxy, breathing sphere, ocean,
  DNA helix, crescent moon, the wordmark) as the page scrolls, itself breathing at the same
  5.5-breaths/minute cadence as the actual breathing exercise.

---

## 5. Security & privacy architecture (the deepest part of this project)

This is the section most worth a senior engineer's or security-conscious recruiter's attention.

1. **Redact → encrypt → zero-retention route → safe-log — the invariant chain applied to every
   piece of health data, everywhere in the codebase:**
   - `lib/redact.ts` strips PII (names, phone numbers, dates, IDs, labeled fields, doctor names)
     from anything a model returns, before it is ever stored or shown — defense in depth even
     though the model is also instructed not to include this data.
   - `lib/crypto.ts` — AES-256-GCM encryption for every health field. Ciphertext is versioned
     (`v1:<iv>:<tag>:<data>`), columns are named `*_enc` with a `CHECK` constraint enforcing the
     version prefix, and the GCM authentication tag detects tampering. Decryption happens
     **only** in server routes; clients query through `/api/*`, never the tables directly.
   - Every AI call sets `provider: { data_collection: "deny", zdr: true }` on the OpenRouter
     request, restricting routing to zero-data-retention model providers only.
   - `lib/log.ts` is the *only* logger in the codebase: event name, error codes, and IDs — never
     request bodies, never model output.
2. **Row-Level Security on every table**, using `(SELECT auth.uid())` in policies rather than a
   bare `auth.uid()` call — the advisor flags the bare form because Postgres re-evaluates it
   per row, which is both a performance and (in edge cases) a correctness footgun.
3. **`anon` role has zero access** to any table; all access requires an authenticated session.
4. **Column-level `GRANT UPDATE`**, not table-wide — a user can update their own timezone, but
   not their own completion timestamp on a task they haven't actually done. Task completion is
   **server-stamped by a Postgres trigger**, closing off client-side XP back-dating.
5. **`complete_task` converted from `SECURITY DEFINER` to `SECURITY INVOKER`** plus a
   completion-guard trigger — found and fixed during a security pass, not present from the start.
   This is a real, nameable bug: a `SECURITY DEFINER` function runs with the *definer's*
   privileges regardless of caller, which had been silently over-broad.
6. **`payments.*` tables were found with RLS disabled** during a security review — meaning any
   authenticated user could potentially open another user's Stripe billing portal session. Found
   and closed with subject-scoped policies before it shipped. Worth stating plainly in an
   interview: this is exactly the class of bug a security-minded engineer is hired to catch.
7. **Webhook idempotency and crash-safety:** the entitlement-granting trigger checks for a
   deleted user (`IF NOT EXISTS ... RAISE WARNING; RETURN NEW;`) before writing, so a webhook
   arriving for an already-deleted account doesn't throw a foreign-key violation and drop the
   whole webhook delivery.
8. **Strict Content-Security-Policy, HSTS preload, `frame-ancestors: none`,
   `X-Content-Type-Options: nosniff`**, and every `/api/*` response forces
   `Cache-Control: no-store, max-age=0` so no proxy or browser ever caches a health-data response.
9. **Continuous verification, not a one-time audit:** the InsForge security advisor is run after
   every milestone and the project has been held at **0 critical / 0 warning findings** across
   all of them, with exactly one intentional, unsuppressed informational finding
   (`billing_entitlements` is read-only by design — users can see their plan but never write to
   it, which is correct and the advisor is simply noting the table's shape).
10. **Signed-out and cross-user access is verified by direct API probing**, not just by trusting
    the UI: every milestone includes curling InsForge's REST API as the `anon` role (expecting
    `42501`, permission denied) and hitting authenticated API routes while signed out (expecting
    `401`), as an explicit part of the definition of done.

---

## 6. Specific engineering bugs found and fixed (concrete, nameable, interview-ready)

These are real defects found during this project's own development — good material for "tell me
about a bug you found" interview questions, because each one has a clear before/after and a
clear reason it mattered.

- **A pre-existing crisis-detection gap in English:** the regex matched "end it all" but not
  "ending it all" — a person typing in the continuous tense (a very natural phrasing: "I've been
  thinking about ending it all") would not have been flagged. Found while writing tests for the
  Hindi expansion of the same detector, fixed with a one-character regex change
  (`end(?:ing)?` instead of `end`), verified with a new test case.
- **A red-team eval that was reporting false failures, not real ones:** the Hindi safety-boundary
  checker flagged the model's *correct, safe refusals* as violations, because Hindi negates
  before the clause it negates ("मैं इंसान नहीं हूँ" — "I am NOT human" — contains the literal
  substring "मैं इंसान हूँ", "I am human", if you don't parse the negation). Manually reran the
  flagged prompt 6 times against the real model to confirm every single reply was in fact a
  correct refusal, then fixed the eval to be negation- and reflection-aware
  (`SAFE_CONTEXT` pattern in `scripts/redteam-companion.mts`) rather than declaring the feature
  broken based on a broken test. **This is a "the test was wrong, not the code" story** — a
  distinct and valuable kind of debugging from "the code was wrong."
- **Two genuine classifier gaps closed by the same red-team run:** "kitni mg melatonin safe hai"
  (a dose question with no named drug) and "dawa likh do" (asking the AI to write a
  prescription) were both falling through to the model instead of triggering the medical
  boundary — closed by adding dose-unit and prescription-request patterns in Hindi/Hinglish.
- **A silent-decision race in the audio engine:** a fade-out timeout could complete *after* a new
  sound layer had already started, killing audio the user had just re-triggered. Fixed with a
  cancellation token (`fadeToken`) that `resume()` invalidates.
- **`useSyncExternalStore` infinite-loop risk:** the audio mix selector returned a new object
  identity on every call, which `useSyncExternalStore` interprets as "state changed," causing an
  infinite re-render loop. Fixed by caching the snapshot and only replacing it when `emit()`
  actually fires.
- **Untimed medications defaulting to a guessed time:** an earlier version of the plan builder
  would assign a default morning slot to a medication with no confirmed time — which for a
  sleep medication would schedule it at 7:30am. Fixed by making "no time confirmed" mean "not
  scheduled, ever" rather than "guess."
- **A stale dependency-version conflict:** `vitest 5` requires Node types `>=22`, but the project
  was pinned to `@types/node ^20`, causing an `ERESOLVE` install failure. Root-caused (not just
  force-installed around) and fixed by bumping to match the actual Node 24 runtime.
- **A production caching false alarm, caught by re-testing before concluding:** a fresh
  `curl` to the production Hindi locale returned the English title once, immediately after a
  deploy. Rather than filing that as a bug, repeated the exact same request 3 more times and
  confirmed it was a single stale edge-cache node mid-rollout, not a logic bug — an example of
  not jumping to a conclusion on a single data point.

---

## 7. Testing & verification discipline

- **251 unit tests, 13 test files, 0 skipped, 0 known-flaky**, covering: crypto round-trips and
  tamper detection, PII redaction edge cases, screener scoring and tier routing (including
  6-week non-improvement logic), the care-plan medication-task builder (as-needed/untimed
  invariants), billing price/entitlement logic, the companion safety classifier (English AND
  Hindi/Hinglish crisis and medical-boundary phrasing), dictionary parity across every locale
  (exact key match, no blank strings, every `{placeholder}` preserved, no romanized Hindi where
  Devanagari was expected), and a drift-guard tying the offline service-worker precache list to
  the page generator so the two structural can never silently diverge.
- **Tests intentionally stay unit-level; there is no integration or E2E framework.** Signed-in,
  multi-step flows are verified manually against the deployed app. This is a stated, deliberate
  scope decision (documented in `CLAUDE.md`), not an oversight — worth being upfront about if
  asked, since claiming full test coverage would be inaccurate.
- **A red-team suite runs real adversarial prompts against the live production model** (not a
  mock), separately from unit tests, specifically for the one component where "the code passed
  its unit tests" isn't sufficient evidence of safety: the AI companion. 42 prompts total across
  two languages, currently 42/42 passing.
- **The verification gate is a single command** (`npm run verify` = typecheck + lint + test) run
  before every commit, plus a full production build and a security-advisor rescan before every
  push to `main`.
- **A named process for handling test failures exists and was followed throughout**: locate the
  failure → find the root cause → fix the root cause (never weaken or delete the failing test)
  → re-run until green → repeat if it fails again. This produced several of the bugs listed in
  §6, which were found *because* a test was written and failed, not found by manual QA.

---

## 8. Database schema (10 migrations, chronological)

| Migration | What it added |
|---|---|
| `init-schema` | Base auth-adjacent tables |
| `care-plan` | `care_profiles`, `care_plans`, `plan_medications`, `plan_tasks`, `push_subscriptions` |
| `ai-usage` | Content-free usage ledger for per-feature rate limiting |
| `harden-rls` | First security pass: rewrote bare `auth.uid()` policies to `(SELECT auth.uid())` |
| `screeners` | `screener_results`, risk/follow-up columns |
| `billing` | Stripe entitlements, webhook-driven trigger, `my_plan()` RPC |
| `billing-harden` | Enabled RLS on `payments.*` (see §5, item 6 — a real vulnerability closed here) |
| `safety-plans` | Stanley-Brown safety plan storage |
| `companion` | Encrypted, append-only `companion_messages`; `ai_usage` kind `companion` |
| `locale` | `care_profiles.locale` — not PII, stored in the clear so a cron job with no user session can still send a push notification in the right language |

---

## 9. Milestone history (shipped, in order, with commit hashes)

The project runs on a **one-milestone-per-week cadence**, each milestone shipping features, a
security pass, and a full test/build/advisor verification — not partial work-in-progress commits.

- **Initial build (single session):** Next.js scaffold → full landing page (WebGL particles,
  generative audio, compose demo) → Care Plan flagship feature (M1), deployed same day.
- **M2a — `01e9165`:** test harness stood up; FR1 screening & stepped-care routing.
- **M2b — `3855a67`:** FR9 — Stripe subscription billing via InsForge Payments.
- **M3a — `b86ada9`:** FR3 — the crisis safety system (safety plans, crisis sheet, offline
  support).
- **M3b — `36499d1`:** FR2 — "Talk to Lull," the 24/7 AI companion, built on top of the crisis
  system so it could hand off safely from day one.
- **M4 (3 commits) — `ee7e1d0`, `721fdf0`, `f99b830`, `91c8747`:** FR8 — full Hindi localization
  (every screen, every clinical instrument, every AI-generated string) plus bilingual companion
  voice (TTS/STT).

**Not yet shipped** (per the roadmap in `docs/requirements.md`): FR10 doctor report & growth
loops (M5), FR6 peer circles (M6), FR7 therapist marketplace (M7–M8), FR5 wearables (M9), Care
Plan 2.0 fusion + DPDP rights centre (M10). Do not claim these as done.

---

## 10. What makes this a strong resume project, specifically

For whoever is drafting the actual resume language, here is the honest case for why this
project is worth featuring prominently, broken into the angles that tend to land in interviews:

1. **It's a real security engineering story, not a feature demo.** Two genuine vulnerabilities
   (the `SECURITY DEFINER` function, the RLS-disabled payments tables) were found and fixed by
   the same person who introduced them, through a deliberate audit process, not by luck. That's
   a materially different and more senior claim than "I added authentication."
2. **The AI-safety work is verifiable, not asserted.** "The companion never gives medical advice"
   is backed by a red-team script that anyone can run (`npm run redteam`) against the live model
   and see the pass/fail output — this is falsifiable, which is exactly what makes it credible.
3. **The i18n architecture generalizes a hard problem correctly.** Most i18n work is "wrap
   strings in a translation function." This codebase went further: it made an entire category of
   bug (a bad translation silently changing a clinical score or a routing decision) structurally
   impossible, and made missing translations a compile-time error instead of a runtime surprise.
   That's the kind of design decision a staff-level interview loop is specifically probing for.
4. **The medication-scheduling determinism is a one-sentence story with real stakes.** "I made
   sure the AI could never touch the one number where being wrong is dangerous" is a complete,
   memorable answer to "tell me about a time you had to think about AI safety in a product."
5. **It was shipped solo, on a real cadence, with a real quality bar held constant** — not "I
   built a prototype," but four consecutive weekly milestones each ending in 0 security findings
   and a passing test suite, which speaks to process discipline as much as raw ability.
6. **The scope-narrowing decision (stepped-care front door, not "solve all mental health") is
   itself a product-thinking data point**, worth mentioning separately from the engineering — it
   shows judgment about what claims a product can actually defend.

---

## 11. Links

- **Live app:** https://lull-ai.vercel.app (try `?lang=hi` for the Hindi experience)
- **Source:** https://github.com/codewithsupra/lull
- **Live Hindi offline crisis page:** https://lull-ai.vercel.app/offline-safety.hi.html (works
  with the network disabled, once loaded once)
