# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev                  # Next.js dev server (Turbopack) on :3000
npm run verify               # gate before any commit/deploy: typecheck + lint + tests
npm test                     # vitest run (all)
npx vitest run tests/crisis.test.ts        # one file
npx vitest run -t "routes to a care tier"  # one test by name
npm run build                # runs prebuild → gen:offline first
```

Backend (InsForge) — always via `npx -y @insforge/cli`, never a global binary:

```bash
npx -y @insforge/cli db migrations new <kebab-name>   # then edit migrations/<ts>_<name>.sql
npx -y @insforge/cli db migrations up --all
npx -y @insforge/cli db query "select 1"              # no BEGIN/COMMIT: transaction control is rejected
npx -y @insforge/cli advisor scan                     # then: diagnose advisor --json
npx -y @insforge/cli secrets get ANON_KEY
```

Deployment: pushing to `main` deploys to production on Vercel (`lull-ai.vercel.app`). Env vars live in Vercel; `.env.example` documents every key.

## Architecture

Next.js 16 App Router + React 19 + Tailwind v4, backed by InsForge (Postgres, auth, payments, AI gateway). Two surfaces: the marketing landing page (`app/page.tsx`) and the product under `app/app/*`.

**Auth (`lib/insforge/`)** uses `@insforge/sdk/ssr`. Auth mutations run server-side only (`app/actions/auth.ts` via `createAuthActions`); `proxy.ts` refreshes session cookies before Server Components render; `lib/insforge/client.ts` creates the browser client **lazily** so signed-out pages never fire a session refresh. Most `app/app/*` pages are client components that read the user from `components/app/user-context.tsx` and fetch through API routes.

**Health data pipeline** — the core invariant chain, worth understanding before touching any care/screener/safety code:

1. `lib/redact.ts` strips PII (names, phones, dates, ids) from anything a model returns, before it is stored or shown.
2. `lib/crypto.ts` AES-256-GCM encrypts every health field. Ciphertext is `v1:<iv>:<tag>:<data>`; columns are named `*_enc` with `CHECK (… LIKE 'v1:%')`. Decryption happens **only** in server routes, so clients go through `/api/*` instead of querying those tables directly.
3. AI calls spread `PRIVATE_ROUTING` (`lib/care-plan-server.ts`) so OpenRouter only uses zero-retention providers.
4. `lib/log.ts` is the only logger: event name, codes and ids — never bodies or model output.

**Care Plan** — `app/api/plan/route.ts` generates a 4-week plan. The LLM designs habits, sessions and learn cards, but **medication tasks are materialized deterministically by `lib/care-plan-tasks.ts` from user-confirmed input, never by the model**, and untimed meds are not scheduled at all. Anything clinically odd becomes a "doctor flag", never an instruction. `app/api/plan/replan/route.ts` adapts the following week from completion plus mood.

**Screeners** — `lib/screeners.ts` holds PHQ-9 and GAD-7 (public domain) plus a non-clinical sleep snapshot (the ISI is licensed and deliberately absent). Scoring and tier routing happen server-side in `evaluate()`; a positive PHQ-9 item 9 always raises the crisis path.

**Crisis** — `lib/crisis.ts` is a hardcoded, dependency-free helpline directory so it works offline. `components/crisis/crisis-sheet.tsx` is mounted once in the app shell and opened from anywhere through the `lull:crisis` window event (`lib/safety-client.ts`). The safety plan is mirrored to `localStorage` for instant offline access and cleared on sign-out. `scripts/gen-offline-safety.mts` generates `public/offline-safety.html` at build time (gitignored), which `public/sw.js` precaches and serves when a navigation fails.

**Billing** — Stripe through InsForge Payments. Entitlements are **only** written by the `payments.webhook_events` trigger in `migrations/*_billing*.sql` (idempotent, order-safe via `last_event_at`, skips unknown users); success URLs grant nothing. `public.my_plan()` is the single source of truth for "is this user Pro". `lib/billing-server.ts#requireFeature` enforces the paywall server-side and returns **402 with `{upgrade:true}`**, which clients turn into the upgrade sheet via `handlePaywall` (`lib/billing-client.ts`). Prices are chosen server-side from `lib/billing.ts`; the client only picks an interval.

**Audio and visuals** — `lib/audio/engine.ts` is a singleton Web Audio graph (noise buffers, filters, LFOs, inharmonic partials); no audio files ship. `components/landing/particle-field.tsx` and `components/plan/night-garden.tsx` are raw three.js `ShaderMaterial` point clouds.

**Localization (FR8)** — `lib/i18n/` holds the locale registry (`config.ts`), the dictionary type (`Dict<T>` in `dict.ts` widens the English source's literal strings to `string`, so a missing or mistyped Hindi key is a compile error, not a silent blank), and one file per feature under `messages/{en,hi}/`. `lib/crisis-terms.ts` detects self-harm and harm-by-others language in English, Devanagari and romanised Hinglish **simultaneously** — a user's typed language is never assumed from the UI locale. Clinical instruments (`lib/screeners.ts`) and care-plan constants (`lib/care-plan.ts`) carry structure and stable keys only; all wording is looked up from the dictionary, so a translation can never change a score or a routing decision. AI-generated content (care plans, re-plans, composed sessions, insights, the companion's system prompt) takes the request's locale and is generated directly in that language. Voice (`lib/voice.ts`, `lib/voice-input.ts`) matches installed TTS voices and sets `SpeechRecognition.lang` per locale — extend `VOICE_LANG_PREFIX`/`RECOGNITION_LANG`/`PREFERRED_VOICE_NAMES` there when adding a language. The offline crisis page is generated once per locale (`scripts/gen-offline-safety.mts` → `lib/offline.ts#offlinePagePath`) and the service worker's precache list must stay in sync with it (`tests/offline.test.ts` guards this).

## Conventions and gotchas

- **Migrations** (`migrations/`) follow the established pattern: RLS enabled, `anon` revoked, owner-only policies using `(SELECT auth.uid())` rather than bare `auth.uid()` (the advisor flags per-row re-evaluation), column-level `GRANT UPDATE (…)` instead of table-wide updates, and `SECURITY INVOKER` functions unless there's a reason otherwise. Keep the advisor at 0 critical and 0 warning.
- **The `verify-unit` skill applies here**: after each unit of work run the tests, and if anything fails, locate it, find the root cause, fix it and re-run until green. Never weaken a test to make it pass.
- Tests (`tests/`) cover pure logic only, aliasing `server-only` to `tests/stubs/` and injecting a throwaway `HEALTH_DATA_KEY` through `vitest.config.mts`. Signed-in end-to-end flows are verified manually in the browser.
- The React compiler lint rules reject `setState` called synchronously in an effect body and impure calls during render — use a promise chain, a state initializer or a ref instead.
- Service workers do not register in the in-app browser pane against `http://localhost`, even though the script serves correctly; verify anything SW-related (offline crisis page, push) on the deployed HTTPS URL.
- `app/app/plan/preview/` is a dev-only visual harness with mock data (`notFound()` in production); use it to check the plan, check-in and garden UI without an account.
- Requirements, milestones and acceptance criteria live in `docs/requirements.md`. `README.md` carries the product positioning and privacy model.

## Secrets

`HEALTH_DATA_KEY` must be backed up: losing it makes all stored health data unreadable. `INSFORGE_API_KEY` is a full-access admin key used only by `app/api/push/dispatch/route.ts`. Never expose it or `OPENROUTER_API_KEY` under a `NEXT_PUBLIC_` name.
