# verifyModule.md — the testing standard for this codebase

**Purpose:** every function, module, component and API route we write gets verified before it's
considered done — with real test cases, not a single happy-path check — so the codebase stays at
**zero known bugs, zero compile-time errors, zero runtime errors, and every shipped feature
actually working**, continuously, not just on the day it was written.

This file is the policy. It's paired with the `verify-unit` skill (`~/.claude/skills/verify-unit/`),
which is the *procedure* — the loop every unit of work goes through. This file defines what
"rigorously tested" means in this specific codebase, maps every module to its actual test
coverage as of **2026-09-25**, and is honest about the two things automated tests in this
project deliberately do not (and structurally cannot) catch, so those get a different, explicit
verification method instead of being silently skipped.

---

## 1. The loop (verify-unit, restated for this project)

For every unit of work — a function, a component, an API route, a migration, an RLS policy, a
prompt:

1. **Build it.**
2. **Test it** — `npm run verify` (typecheck + lint + unit tests). For a new feature, write the
   tests *as part of* building it, not after — see §3 for what "enough cases" means.
3. **If anything fails:** locate the exact failure, find the root cause (not the symptom), fix
   the root cause, re-run. Never weaken, skip, or delete a failing test to make it pass — a
   red test is telling you something true.
4. **Repeat until green.**
5. **For anything touching the database:** run the InsForge advisor
   (`npx -y @insforge/cli advisor scan`) and hold it at 0 critical / 0 warning before moving on.
6. **For anything that only manifests in a real browser** (hydration, SSR/CSR divergence,
   streaming, audio/speech APIs, service workers): verify live against the deployed app — see §4.
   This is not optional just because it isn't a `.test.ts` file.
7. **Before considering a fix "done":** revert it and re-run the new test to confirm the test
   actually fails without the fix. A regression test that would have passed against the buggy
   code isn't testing anything — it's decoration. (This project has done this twice for real
   bugs; see §5.)

---

## 2. What "rigorous, various cases" means here

A test suite that only checks the happy path is not rigorous. For every function or module,
the following case *categories* are the minimum bar — not every function needs every category,
but every function needs its category's cases covered:

| Category | What it means | Example from this codebase |
|---|---|---|
| **Happy path** | The obvious correct input | `route()` with mild scores → tier 1 |
| **Boundary** | Values exactly at a cutoff | PHQ-9 = 9 (mild) vs. 10 (moderate); `risk_item` = 1 vs. 2 |
| **Empty/absent** | Nothing there yet | No check-in history when computing a trend; an empty voice list |
| **Malformed/hostile input** | Input that shouldn't be trusted | A GCM ciphertext with a flipped byte (tamper detection); a screener submission with an out-of-range answer |
| **Concurrent/ordering** | Two things happening close together, or out of order | A webhook for an already-deleted user; a stream chunk split across two reads |
| **Cross-language** | The same logic, in every locale we ship | Crisis detection in English, Devanagari, and romanized Hinglish for the *same* underlying phrase |
| **Negative-space** | Things that must correctly **not** trigger | "this deadline is killing me" must not read as crisis language; a refusal that quotes the user's own words must not read as a policy violation |
| **Regression** | The exact failure a real bug produced, kept as a permanent test | See §5 — every bug fixed in this codebase gets a test that reproduces it first |

A PR that adds a feature with only a happy-path test is not done by this project's standard.

---

## 3. Coverage map — every module against its actual tests

This is the ground truth as of this file's date: 261 tests, 14 files, `npm run verify` and
`npm run build` both clean, InsForge advisor at 0 critical / 0 warning (1 info, by design —
`billing_entitlements` is intentionally read-only to users).

| Module | Test file | What's covered |
|---|---|---|
| `lib/crypto.ts` (AES-256-GCM field encryption) | `crypto.test.ts` | Round-trip correctness, GCM tamper detection on a flipped ciphertext byte, version-prefix rejection, optional/JSON variants |
| `lib/redact.ts` (PII scrubbing) | `redact.test.ts` | Emails, phone numbers, dates, IDs, labelled fields, doctor names; a regression case for `\s` eating newlines it shouldn't |
| `lib/crisis-terms.ts` (self-harm & harm detection) | `crisis-terms.test.ts` | English, Devanagari Hindi, and romanized Hinglish phrasings of self-harm and harm-by-others; explicit negative cases (ordinary stress/distress phrases that must not trigger) in all three |
| `lib/screeners.ts` (PHQ-9/GAD-7 scoring & routing) | `screeners.test.ts` | All four care tiers including the 6-week-non-improvement T3 path; out-of-range answer rejection; wrong-answer-count rejection; every locale has a fully worded instrument, every routing reason key is translated in every locale |
| `lib/care-plan.ts`, `lib/care-plan-tasks.ts` (deterministic medication scheduling) | `care-plan.test.ts`, `care-plan-tasks.test.ts` | As-needed medications are never auto-scheduled; untimed medications are never guessed a time; XP/level math including negative and extreme inputs; the crisis-hint regex |
| `lib/companion.ts` (safety classifier + system prompt) | `companion.test.ts` | Crisis vs. medical-boundary vs. ok classification in English and Hindi/Hinglish; every locale has a crisis reply, a medical boundary, and starter prompts, all in the correct script |
| `lib/companion-client.ts` (SSE stream parsing) | `companion-client.test.ts` | **Added this session after finding a real bug** (see §5): exactly-once delivery, multi-frame-per-chunk parsing, a frame split across two stream chunks, the error path never also firing completion, a dropped-connection fallback, the non-streamed crisis/paywall/rate-limit JSON paths, a null-body guard |
| `lib/billing.ts` (pricing, entitlements, feature limits) | `billing.test.ts` | Currency selection by country, known-price validation, per-feature free/Pro limits |
| `lib/safety.ts` (Stanley-Brown safety plan schema) | `safety.test.ts` | `isUsable()` boundary (needs coping + at least one contact type); every locale has title/help/example text for all seven sections |
| `lib/crisis.ts` (helpline directory) | `crisis.test.ts` | Region resolution and fallback; every region's helpline notes and country name exist in every locale; the country picker sorts correctly per-locale |
| `lib/i18n/` (dictionary system) | `i18n.test.ts` | **Compile-time-enforced** key parity is backed by a **runtime** test too: every locale has exactly the source locale's keys, no blank strings, every `{placeholder}` preserved, no romanized Hindi where Devanagari is expected, `Accept-Language` q-weight parsing |
| `lib/voice.ts` (TTS voice matching, STT language tags) | `voice.test.ts` | Preferred-name matching, language-prefix matching (not exact-tag), vendor-suffixed names, cross-language isolation (an English voice list must yield nothing for Hindi), case-insensitivity, empty list |
| `lib/offline.ts` + `public/sw.js` (offline crisis pages) | `offline.test.ts` | The service worker's precache list can never silently drift out of sync with the generated per-locale pages — this is the one page that has to still work when everything else has failed |

**Deliberately not unit-tested, and why:** signed-in, multi-step user flows (an intake wizard
through to a generated plan; a full companion conversation; a Stripe checkout) are not covered by
`tests/*.test.ts`. This project has no integration or E2E test framework. That is a real, named
gap in automated coverage — not an oversight, but it means these flows only get caught by manual
verification, which is why §4 exists and why this session did a full manual pass (§6).

---

## 4. The two bug classes unit tests cannot catch here — and what actually catches them

### 4.1 SSR/hydration mismatches

**Why unit tests can't catch this:** Vitest here runs in a `node` environment with no DOM and no
React renderer (see `vitest.config.mts`). A hydration mismatch is specifically a *disagreement*
between what Next.js renders on the server and what React renders on the client's first paint —
there is nothing to disagree with in a Node-only test run.

**The rule that actually prevents it:** any value read at component *render time* that could
differ between server and client — `typeof window`, `Date.now()`, `Math.random()`, the visitor's
timezone/locale via `toLocaleString`, browser feature detection — must never directly decide what
JSX gets returned. Either defer it into a `useEffect` (so it only ever affects a *post-hydration*
re-render), or use `useSyncExternalStore`'s three-argument form with a server-snapshot function
that returns the same fallback value for both the SSR pass and the client's first render.

**Verification method:** open the page in a **completely fresh browser tab** (no prior
navigation, no cached client-side router state) and check the console **before any interaction**.
`read_console_messages` accumulates across an entire tab's history, so checking console in a tab
that's already navigated through five other pages tells you nothing about which page the error
came from — isolate first, then check.

**Found this way, this session:** the Talk page's mic button (`micSupported =
isRecognitionSupported()` called directly in the render body) — fixed by moving it behind
`useSyncExternalStore`. See CLAUDE.md's Localization section for the exact pattern, already used
elsewhere in this codebase for the Today page's time-of-day greeting.

### 4.2 Streaming / async completion-signal duplication

**Why unit tests can't catch this by default:** a hand-rolled SSE parser reading a
`ReadableStream` has two ways to learn "the reply is done" — an explicit event in the stream, and
the stream's own physical close — and it's easy to write code that treats both as separate
completions without ever hitting an assertion that would catch it, *unless a test specifically
asserts the completion callback fires exactly once*.

**The rule:** when a stream can signal completion two ways (an explicit terminal event, and the
underlying transport closing), track whether the explicit signal already arrived, and only treat
the transport closing as a *fallback* for the case where it didn't.

**Verification method:** a real unit test *can* catch this — once you know to write
`expect(onDone).toHaveBeenCalledTimes(1)` instead of just `expect(onDone).toHaveBeenCalled()`.
The gap here wasn't "untestable," it was "under-specified": the original test coverage (there was
none for this file) never asserted call *count*, only that things eventually resolved.

**Found this way, this session:** every companion reply rendered as two identical message
bubbles in the live app; tracing it back led to `lib/companion-client.ts` calling `onDone()`
twice per reply. Now covered by `companion-client.test.ts`, which is the template to follow for
any future streaming client code: assert exact call counts, not just "was called."

---

## 5. Every bug this project has found, and whether it has a permanent regression test

Per the loop in §1: a bug fix without a regression test is not actually fixed, it's postponed.

| Bug | Found by | Regression test | Confirmed test fails pre-fix? |
|---|---|---|---|
| Companion reply rendered twice; an errored reply also leaked a phantom completed message | Live manual test in production | `companion-client.test.ts` (10 cases) | **Yes** — reverted the fix, 4/10 failed |
| Talk page mic button caused a hydration mismatch on every load | Live manual test, fresh tab, console before interaction | Not unit-testable (§4.1); the verification method **is** the regression test — re-run on every future `typeof window`-adjacent change | N/A — verified by class-of-bug audit (grepped every `typeof window` usage in the codebase for the same pattern) instead |
| English crisis detection missed "ending it all" (only matched "end it all") | Writing Hindi test cases surfaced the English gap | `crisis-terms.test.ts` | Yes, by construction — the fixed regex is what the test asserts against |
| Red-team eval falsely flagged correct Hindi safety refusals as violations (Hindi negates before the clause it negates) | Manually re-running the flagged prompt 6× against the real model | `scripts/redteam-companion.mts`'s `SAFE_CONTEXT` pattern | Confirmed by manual replay, not an automated before/after (this is an eval script, not a unit test file) |
| Two Hindi/Hinglish medical-boundary gaps (bare dose questions, "write me a prescription") | Red-team run against the real model | `npm run redteam -- hi` now scores 21/21 | Yes — was 18/21 before the fix |
| `complete_task` was `SECURITY DEFINER` instead of `INVOKER` | Manual security audit | InsForge advisor rescan (0 findings) | N/A — infra/policy fix, not unit-testable code |
| `payments.*` tables had RLS disabled | Manual security audit | InsForge advisor rescan (0 findings) | N/A — same as above |
| Untimed medications defaulted to a guessed morning slot | Manual review of the task builder | `care-plan-tasks.test.ts` | Yes, by construction |
| `vitest` install failure from a `@types/node` / Node-runtime version mismatch | `npm install` failing outright | N/A — dependency pin, not app logic | N/A |

---

## 6. This session's full manual verification pass (2026-09-25)

Every feature below was exercised live against **production** (`lull-ai.vercel.app`), signed in
as a real test account, not just read from source. Full narrative results are in `audit.md`;
this is the summary against the standard this file sets.

| Feature | Method | Result |
|---|---|---|
| Safety plan | Filled all 7 sections, saved, hard-reloaded, confirmed round-trip through encryption, confirmed it populates the crisis sheet correctly | ✅ Pass |
| Wellbeing check — T1 (self-guided) routing | Full 21-question flow, verified scoring and routing math | ✅ Pass |
| Wellbeing check — crisis follow-up | Endorsed item 9, verified the crisis card fires, verified it fires *again* after confirming active risk in the follow-up | ✅ Pass |
| Wellbeing check — T0 (urgent) routing | Full retake past the 10-minute anti-spam cooldown, verified the results page, region-correct crisis resources, and trend comparison | ✅ Pass |
| Talk to Lull companion | Sent real messages, verified CBT-appropriate streamed replies | ✅ Pass after 2 bug fixes (§5) |
| Care Plan intake → generation | Full wizard: consent → condition → rhythm → context (skipped scan) → a manually confirmed medication → AI plan generation | ✅ Pass, including the deterministic-scheduling invariant verified exactly (a medicine confirmed for 08:00 was scheduled at 08:00, untouched by the model) |
| Task completion, XP, streak, garden | Marked a medication task done | ✅ Pass — exact XP awarded, streak incremented, garden visibly grew |
| Breathing exercise | Started a session, verified the pacer and orb animate | ✅ Pass |
| Soundscapes | Applied a preset, verified the mixer and live-synthesis visualizer | ✅ Pass |
| AI composer + session player | Generated and played a real composed session | ✅ Pass |
| Journal + AI insight | Logged 3 check-ins, verified the mood chart, then verified insight is correctly paywalled and — after a genuine no-card trial activation — generates a real, data-accurate reflection | ✅ Pass |
| Billing — paywall, trial | Triggered the paywall organically via a gated feature, started the no-card trial, confirmed Pro status persisted after reload | ✅ Pass |
| Hindi localization | Checked `?lang=hi` both signed out and signed in with real user data | ✅ Pass |
| Voice UI | Confirmed mic button and TTS controls render (full mic/TTS interaction needs a physical microphone and real speaker output, not available to this browser automation) | ✅ Rendering confirmed; **interaction not live-tested this session** |

**Explicitly not live-tested this session** (verified only via code + existing unit tests):
PWA/offline behavior, push notification delivery, peer circles / therapist marketplace / doctor
report (not yet built — see `docs/requirements.md` roadmap), Razorpay checkout (no test keys
configured yet), an actual paid Stripe checkout (requires entering a real or test card number,
which is outside what this assistant will do on someone's behalf — see `audit.md` for the exact
boundary).

---

## 7. Running verification yourself

```bash
npm run verify        # typecheck + lint + unit tests — run before every commit
npm run build          # production build — run before every deploy
npm run redteam         # all languages, against the real model
npm run redteam -- hi   # one language only
npx -y @insforge/cli advisor scan       # after any schema/RLS change
npx -y @insforge/cli diagnose advisor   # read the scan results
```

For anything the automated commands above can't reach (§4), the check is: **open it in a fresh
tab, on production, signed in, and actually use it** — exactly as documented in §6.
