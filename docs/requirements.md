# Lull — Product Requirements (v1, 2026-09-21)

## Context
M1 (Care Plan: prescription → 4-week adaptive plan with XP) is live at lull-ai.vercel.app. Before M2 we're setting the full product direction. The goal is a YC-backed company with real MRR, a product that's clearly better than Calm, and a credible answer to the global mental-health treatment gap.

**Positioning decision:** Lull won't claim to treat every condition, because apps that do get shut down or discredited. Instead Lull is **the stepped-care front door**. Everyone gets screened and supported with self-help. People who need more are routed to peer circles, then to therapists, and to crisis lines when there's risk. Every step is measured with validated scales. This model is what has been proven to scale, and it's what insurers, governments and YC can fund.

**Locked decisions (from Q&A):** stepped-care front door · human layer = peer circles + curated therapist marketplace · **India first, then global** · revenue = consumer Pro now, clinics and insurers/governments later · AI companion is core · PHQ-9 / GAD-7 / ISI measurement · Hindi at launch · wearables feed the plan · doctors engage via a **patient-held report** (no clinician portal yet) · safety plan + warm handoff crisis protocol · growth = shareable garden, buddy invites, public "Lull Index" · Pro ₹199/mo · ₹1,499/yr ($7.99 global) · compliance: DPDP Act 2023 + RCI verification required, HIPAA/GDPR-ready architecture, clinical pilot later.

## Market analysis (why we win)
- **The gap:** about 1 in 8 people worldwide lives with a mental disorder, and in India **~83% get no treatment**. There are roughly 0.75 psychiatrists per 100k people. Stigma, cost, language and access are the barriers, not a lack of meditation content.
- **Calm and Headspace** are English-first content libraries with no screening, no routing, no humans at the free tier, and US pricing.
- **Wysa, Amaha and Headspace Care** have pieces of stepped care but are clinical, text-heavy and English-first, with weak delight and growth loops.
- **Lull's edge** is the combination nobody has built: delight (WebGL, generative sound, XP garden) + personalization (prescription → plan, AI companion) + stepped-care routing with measured outcomes + **Hindi-first voice** + privacy by design + ₹199 pricing.

## The 10 functional requirements

**FR1 — Screening & stepped-care routing** · *P0*
- At onboarding and every 14 days, run PHQ-9 (depression), GAD-7 (anxiety) and ISI (insomnia), plus the PHQ-9 item-9 risk flag and a brief C-SSRS screener when it's positive.
- The routing engine assigns a care tier:
  - **T1** self-guided (minimal/mild)
  - **T2** guided + peer circles (moderate)
  - **T3** therapist recommended (moderately severe or severe, or not improving after 6 weeks)
  - **T0** urgent: triggers FR3
- Tier drives the Care Plan, what the home screen shows and which nudges the user gets.
- Scores are stored encrypted, with trend charts and a plain-language explanation. The app never shows a "diagnosis".
- *Accept:* scoring matches published instruments. Tier changes are logged and explained to the user. Item-9 ≥1 always triggers FR3.

**FR2 — "Talk to Lull" AI companion (text + voice)** · *P0*
- 24/7 chat grounded in CBT/ACT/BA skills: thought records, reframing, worry time, grounding, behavioural activation.
- It knows the user's plan, tier, mood and recent screeners (context is assembled server-side from encrypted data). It can hand out plan tasks ("let's add this to tomorrow"), which earn XP.
- A safety classifier runs on every turn. On risk it stops counselling, starts FR3 and suggests a peer circle or therapist when the tier warrants it.
- Memory is user-controlled (view or delete). Model calls use zero-data-retention routing only. Streaming responses, voice in/out.
- *Accept:* never gives medication, diagnosis or dosing advice (red-team suite of 100+ prompts passes). Crisis-detection recall ≥95% on the eval set. p50 first-token latency < 1.5s.

**FR3 — Crisis safety system** · *P0*
- A Stanley-Brown **safety plan** is co-created in onboarding for T0–T2 users and is always one tap away: warning signs, coping steps, reasons to live, people and places, professional contacts.
- Risk signals come from screeners, the companion, journal/intake text and circle posts.
- On risk, show a full-screen card with **one-tap locale-aware lines** (Tele-MANAS 14416 in India, 988 in the US, Samaritans in the UK, findahelpline.com elsewhere). An optional consented alert goes to a chosen trusted contact. There's an automatic gentle check-in the next day.
- It works offline (cached safety plan and numbers).
- *Accept:* every risk path reaches the resource card in ≤1 tap, is tested across all entry points and is audited. The AI never handles a crisis alone.

**FR4 — Adaptive Care Plan 2.0** · *P0 (extends M1)*
- M1's plan now also adapts to the **care tier, screener trends and wearable signals** (e.g. "you slept 5h, so today is a lighter plan").
- The plan re-measures every 2 weeks and shows an outcome story ("GAD-7 14 → 8").
- It supports conditions beyond mind & sleep through generic habit templates, and always keeps medication scheduling exactly as confirmed.
- *Accept:* the re-plan uses tier + screeners + completion + sleep. Medication tasks are never altered by the AI (regression test).

**FR5 — Wearables & sleep signals** · *P1*
- Connect Fitbit and Oura (web OAuth APIs), plus Apple Health and Android Health Connect via a thin native wrapper (Capacitor). HealthKit and Health Connect have no web API, so this needs the wrapper.
- Ingest daily summaries only (sleep duration and efficiency, resting HR/HRV, steps), not raw streams. They feed FR4 and insights.
- Data is minimised, encrypted, revocable, and the user sees exactly what's read.
- *Accept:* daily sync, disconnect deletes the data, and the plan visibly adapts to the signals.

**FR6 — Peer circles** · *P1*
- Anonymous handles and small circles (8–12 people) by topic and language (e.g. "Anxiety · Hindi", "New to meds", "Exam stress").
- Async chat plus a scheduled weekly live session (audio room or guided prompt).
- Every message goes through **AI pre-moderation** (self-harm → FR3, abuse, PII, medication advice, spam), plus trained volunteer moderators, reporting, blocking and a strikes policy.
- Circle entry is suggested by the FR1 tier. Join via invite link (feeds growth). Uses InsForge Realtime.
- *Accept:* 100% of messages are moderated before others see them, and no PII leaks (redaction). Moderator tools for mute, remove and escalate.

**FR7 — Curated therapist marketplace** · *P1*
- Therapists apply and are **verified (RCI/NMC registration check, ID, qualifications, interview)** before listing.
- Profiles show languages, specialties, price, availability and modality.
- Users book and pay in-app (Razorpay/Stripe) with a video link, cancellation rules and reminders. Lull takes 15–20%.
- The FR1 routing recommends therapists for T3 users. The user can **share their Lull report (FR10) with their therapist** with consent and time-limited access. Ratings, and therapist payouts.
- *Accept:* no unverified therapist is visible, payment and payout reconcile, and sharing is consent-gated and revocable.

**FR8 — Hindi-first, multilingual experience** · *P0*
- Full i18n across the UI, Care Plan, learn cards, companion, voice guidance (Hindi TTS/STT), notifications and crisis resources. Screeners use **validated Hindi versions** of PHQ-9, GAD-7 and ISI.
- The language is chosen at onboarding and switchable at any time. The architecture supports adding Bengali, Tamil, Telugu, Marathi and Hinglish later without code changes.
- *Accept:* 100% string coverage in Hindi, Hindi companion quality reviewed by native-speaking clinicians, and no mixed-language screens.

**FR9 — Pro subscription & entitlements** · *P0 (M2)*
- Free forever: breathing, sounds, screeners, crisis tools, 1 Care Plan, circles (read + weekly session).
- **Pro ₹199/mo · ₹1,499/yr · $7.99/mo global:** unlimited companion, prescription scan, adaptive re-plans, the full garden, wearables, the doctor report, Hindi voice and multiple plans.
- Razorpay (INR, UPI autopay) and Stripe (USD) via InsForge Payments, with geo pricing, a 7-day trial, an entitlements table checked server-side, grace periods, cancel/restore, and GST-compliant invoices.
- *Accept:* webhooks drive entitlements idempotently, the paywall is enforced server-side, and trial → paid conversion is tracked.

**FR10 — Progress report, sharing & growth loops** · *P1*
- **Patient-held doctor report:** a PDF and an expiring share link with screener trends, adherence, sleep, doctor questions and flags. This is how doctors discover Lull.
- **Share cards** (garden, streaks, level-ups) that are private by default and contain no health details.
- **Buddy invites:** do a plan together and both get 14 Pro days.
- A monthly public **"Lull Index":** anonymous, k-anonymised (k≥50) city-level stress and sleep trends, as a press asset.
- *Accept:* reports contain no PII beyond what the user chooses, share links expire and can be revoked, and the Index can't be re-identified.

## Non-functional requirements (apply to all FRs)
- **Privacy & compliance:**
  - DPDP Act 2023: purpose-specific consent, a data-principal rights centre (access, export, correct, erase), a named grievance officer, and a 72h breach process.
  - HIPAA/GDPR-ready: field encryption (existing `lib/crypto.ts`), ZDR AI routing, data-residency option, DPAs with vendors.
  - No PII in logs (existing `lib/log.ts`) and no PII stored beyond what's required (existing `lib/redact.ts`).
- **Security:** RLS on everything, InsForge advisor at 0 findings on every milestone, strict CSP, rate limits, a red-team suite for the AI.
- **Accessibility and reach:** WCAG 2.2 AA, works on ₹8k Android phones on 3G, core calm tools work offline (PWA cache).
- **Clinical governance:** a clinical advisor reviews all content, prompts and screeners, with versioned prompts and a safety eval in CI.
- **Reliability:** 99.9% uptime for crisis paths. Crisis resources are cached client-side.

## Proposed milestone sequence (one per week; big FRs split)
- **M2:** FR9 Pro & payments, plus FR1 screeners & routing (money plus outcome data from day one)
- **M3:** FR3 crisis system and FR2 companion v1 (text)
- **M4:** FR8 Hindi (UI + screeners + plan), then companion voice and Hindi voice
- **M5:** FR10 doctor report, share cards and buddy invites
- **M6:** FR6 peer circles
- **M7–M8:** FR7 therapist marketplace (verification → booking → payouts)
- **M9:** FR5 wearables (Fitbit/Oura web, then the Capacitor wrapper)
- **M10:** FR4 Care Plan 2.0 fusion, the DPDP rights centre, the first Lull Index and a pilot study setup

## Key risks
- **AI safety incident:** mitigated by the FR2 red-team eval, the FR3 always-on crisis path and a clinical advisor.
- **Therapist supply quality:** mitigated by strict verification and a small curated launch cohort (~20 therapists).
- **AI cost at ₹199:** mitigated by cheap models for routine turns, caching and per-user caps on the free tier.
- **Wearables need a native wrapper:** plan Capacitor for M9.

## Verification (how we'll judge each milestone)
Each FR's *Accept* criteria become the milestone's definition of done. `tsc`, `eslint` and `build` must be clean, the InsForge advisor must report 0 findings, and there must be an E2E run of the new flow on production. Safety-critical FRs (1, 2, 3, 6) also need their eval suites passing before deploy.
