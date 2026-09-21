"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CATEGORIES, CRISIS_TERMS, GOALS, type Category, type MedicationInput } from "@/lib/care-plan";
import { localTimezone, localToday } from "@/lib/care-client";
import { CrisisCard } from "./crisis-card";
import { handlePaywall } from "@/lib/billing-client";

type Med = MedicationInput & { key: string; confirmed: boolean; fromScan: boolean };

const STEPS = ["Consent", "Condition", "Rhythm", "Context", "Medicines", "Build"] as const;
const BUILD_STAGES = ["Reading your answers…", "Scheduling your medicines exactly as prescribed…", "Choosing evidence-based habits…", "Weaving in breathing & sound…", "Writing your learn cards…", "Planting your garden…"];

const newMed = (m: Partial<Med> = {}): Med => ({
  key: crypto.randomUUID(),
  name: "",
  dose: "",
  instructions: "",
  times: [],
  as_needed: false,
  confirmed: false,
  fromScan: false,
  ...m,
});

export function IntakeWizard({ onCreated }: { onCreated: (care: string | null) => void }) {
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [duration, setDuration] = useState<"new" | "months" | "years">("new");
  const [severity, setSeverity] = useState(3);
  const [wake, setWake] = useState("07:00");
  const [sleep, setSleep] = useState("23:00");
  const [goals, setGoals] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [meds, setMeds] = useState<Med[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [stage, setStage] = useState(0);
  const [crisisOpen, setCrisisOpen] = useState(false);
  const [crisisSeen, setCrisisSeen] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!building) return;
    const id = window.setInterval(() => setStage((s) => Math.min(s + 1, BUILD_STAGES.length - 1)), 2200);
    return () => window.clearInterval(id);
  }, [building]);

  const canNext = [agreed, !!category, true, true, meds.every((m) => m.confirmed && m.name.trim() && (m.as_needed || m.times.length > 0)), false][step];

  const next = () => {
    setError(null);
    if (step === 3 && !crisisSeen && CRISIS_TERMS.test(text)) {
      setCrisisOpen(true);
      return;
    }
    if (step === 4) void build();
    else setStep((s) => s + 1);
  };

  const scan = async (file: File | undefined) => {
    if (!file) return;
    setScanning(true);
    setScanNote(null);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/intake/extract", { method: "POST", body });
      const json = await res.json();
      if (handlePaywall(res.status, json)) return;
      if (!res.ok) throw new Error(json.error);
      if (!json.readable || !json.medications.length) {
        setScanNote("We couldn't find medicines in that image. Try a sharper photo, or add them by hand on the next step.");
      } else {
        setMeds((cur) => [
          ...cur,
          ...json.medications.map((m: MedicationInput & { frequency?: string }) =>
            newMed({ name: m.name, dose: m.dose, instructions: [m.frequency, m.instructions].filter(Boolean).join(" · ").slice(0, 200), times: m.times, as_needed: m.as_needed, fromScan: true }),
          ),
        ]);
        if (!category && json.diagnosis_hint) {
          const hint = String(json.diagnosis_hint).toLowerCase();
          const match = CATEGORIES.find((c) => hint.includes(c.id.replace("_", " ")) || hint.includes(c.label.toLowerCase().split(" ")[0]));
          if (match) setCategory(match.id);
        }
        setScanNote(`Found ${json.medications.length} medicine${json.medications.length > 1 ? "s" : ""}. You'll check each one next. The image is already gone.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const build = async () => {
    setStep(5);
    setBuilding(true);
    setStage(0);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          duration,
          severity,
          wake,
          sleep,
          goals,
          text,
          medications: meds.map(({ name, dose, instructions, times, as_needed }) => ({ name: name.trim(), dose: dose.trim(), instructions: instructions.trim(), times, as_needed })),
          timezone: localTimezone(),
          today: localToday(),
          consent: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onCreated(json.care ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStep(4);
    } finally {
      setBuilding(false);
    }
  };

  const needsTime = (m: Med) => !m.as_needed && m.times.length === 0;
  const updateMed = (key: string, patch: Partial<Med>) => setMeds((cur) => cur.map((m) => (m.key === key ? { ...m, ...patch, confirmed: patch.confirmed ?? false } : m)));

  return (
    <div className="mx-auto max-w-2xl">
      {crisisOpen && (
        <CrisisCard
          onContinue={() => {
            setCrisisOpen(false);
            setCrisisSeen(true);
            setStep((s) => s + 1);
          }}
        />
      )}

      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full transition-colors duration-500 ${i <= step ? "bg-mint" : "bg-white/10"}`} />
            <div className={`mono-label mt-2 hidden !text-[9px] sm:block ${i === step ? "!text-ink" : ""}`}>{s}</div>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 0 && (
            <section>
              <p className="mono-label !text-mint">care plan · private beta</p>
              <h1 className="mt-2 font-[family-name:var(--font-unbounded)] text-3xl font-semibold tracking-tight sm:text-5xl">
                Your prescription, turned into a plan you&apos;ll follow.
              </h1>
              <p className="mt-4 text-muted">
                Answer a few questions and scan your prescription if you have one. Lull builds a 4-week plan around it with
                your medicine schedule, small habits that are backed by evidence, breathing and sound sessions, and things
                to ask your doctor. Each step you complete earns XP and grows your night garden.
              </p>
              <div className="glass mt-8 space-y-4 rounded-3xl p-6 text-sm">
                <Pledge icon="🔒" title="No personal details, ever">
                  We never store your name, your doctor, dates, IDs or contact details. We remove them before anything is saved.
                </Pledge>
                <Pledge icon="🧾" title="Prescription photos are never kept">
                  We read the photo in memory, through an AI provider that doesn&apos;t keep or train on data, and then discard it.
                </Pledge>
                <Pledge icon="🛡️" title="Encrypted health data">
                  Medicines and plan details are encrypted with AES-256 before they reach our database. You can delete all of it in one tap.
                </Pledge>
                <Pledge icon="⚕️" title="A companion, not a doctor">
                  Lull schedules your medicines exactly as prescribed and never changes them. Anything worth checking goes on a list for your doctor.
                </Pledge>
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-muted">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--mint)]" />
                <span>
                  I understand Lull is not medical advice and doesn&apos;t replace my doctor. I agree to my health answers being processed as described
                  above. In an emergency I&apos;ll contact local emergency services.
                </span>
              </label>
            </section>
          )}

          {step === 1 && (
            <section>
              <h2 className="font-[family-name:var(--font-unbounded)] text-2xl font-semibold sm:text-3xl">What are you working on?</h2>
              <p className="mt-2 text-muted">Pick the closest one. It can be a diagnosis or just how things feel.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`rounded-2xl border p-4 text-left transition ${category === c.id ? "border-mint/50 bg-mint/[0.07] shadow-[0_0_30px_-12px_var(--mint)]" : "border-white/10 hover:border-white/25"}`}
                  >
                    <div className="font-semibold">{c.label}</div>
                    <div className="mt-1 text-xs text-muted">{c.hint}</div>
                  </button>
                ))}
              </div>
              <p className="mono-label mt-8">How long has this been going on?</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([["new", "Just started"], ["months", "A few months"], ["years", "Over a year"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setDuration(v)} className={`rounded-xl border py-2.5 text-sm transition ${duration === v ? "border-mint/50 bg-mint/[0.07]" : "border-white/10"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-between text-sm">
                <span className="mono-label">How much is it affecting your days?</span>
                <span className="font-mono text-xs text-muted">{["barely", "a little", "noticeably", "a lot", "constantly"][severity - 1]}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value))}
                className="slider mt-4 w-full"
                style={{ ["--val" as string]: `${((severity - 1) / 4) * 100}%` }}
                aria-label="Severity"
              />
            </section>
          )}

          {step === 2 && (
            <section>
              <h2 className="font-[family-name:var(--font-unbounded)] text-2xl font-semibold sm:text-3xl">Your daily rhythm</h2>
              <p className="mt-2 text-muted">We time your plan and reminders around these.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <TimeField label="Usually wake up" value={wake} onChange={setWake} />
                <TimeField label="Usually go to bed" value={sleep} onChange={setSleep} />
              </div>
              <p className="mono-label mt-8">What would feel like a win? (up to 4)</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {GOALS.map((g) => {
                  const on = goals.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => setGoals((cur) => (on ? cur.filter((x) => x !== g) : cur.length < 4 ? [...cur, g] : cur))}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-mint/50 bg-mint/10 text-mint" : "border-white/10 text-muted hover:text-ink"}`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h2 className="font-[family-name:var(--font-unbounded)] text-2xl font-semibold sm:text-3xl">Add your prescription</h2>
              <p className="mt-2 text-muted">Optional, but it makes the plan much better. Printed and handwritten prescriptions both work.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  disabled={scanning}
                  onClick={() => cameraRef.current?.click()}
                  className="glass group rounded-2xl p-5 text-left transition hover:border-mint/40 disabled:opacity-50"
                >
                  <div className="text-2xl">📷</div>
                  <div className="mt-2 font-semibold">Take a photo</div>
                  <div className="text-xs text-muted">Flat surface, good light, whole page in frame</div>
                </button>
                <button
                  disabled={scanning}
                  onClick={() => fileRef.current?.click()}
                  className="glass group rounded-2xl p-5 text-left transition hover:border-mint/40 disabled:opacity-50"
                >
                  <div className="text-2xl">📄</div>
                  <div className="mt-2 font-semibold">Upload image or PDF</div>
                  <div className="text-xs text-muted">JPG, PNG, HEIC or PDF up to 8 MB</div>
                </button>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => scan(e.target.files?.[0])} />
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => scan(e.target.files?.[0])} />
              {scanning && <p className="shimmer-text mt-4 font-mono text-xs uppercase tracking-[0.2em]">Reading your prescription privately…</p>}
              {scanNote && <p className="mt-4 rounded-xl border border-mint/20 bg-mint/[0.06] px-4 py-3 text-sm text-mint">{scanNote}</p>}

              <p className="mono-label mt-8">In your own words (optional)</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 1200))}
                rows={4}
                placeholder="e.g. Diagnosed with GAD last month. I lie awake replaying conversations, and mornings feel heavy…"
                className="glass mt-3 w-full resize-none rounded-2xl p-4 text-sm outline-none placeholder:text-faint focus:border-mint/40"
              />
              <p className="mt-2 text-xs text-faint">Please leave out names and other personal details. We strip them anyway.</p>
            </section>
          )}

          {step === 4 && (
            <section>
              <h2 className="font-[family-name:var(--font-unbounded)] text-2xl font-semibold sm:text-3xl">Check your medicines</h2>
              <p className="mt-2 text-muted">
                Your plan will schedule exactly what you confirm here, and nothing else. Tick each one after checking it against your prescription.
              </p>
              <div className="mt-6 space-y-3">
                {meds.length === 0 && <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-muted">No medicines added. That&apos;s fine, and your plan will focus on habits and sessions.</p>}
                {meds.map((m) => (
                  <div key={m.key} className={`glass rounded-2xl p-4 transition ${m.confirmed ? "border-mint/30" : ""}`}>
                    <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr]">
                      <input value={m.name} onChange={(e) => updateMed(m.key, { name: e.target.value.slice(0, 80) })} placeholder="Medicine name" className="field" aria-label="Medicine name" />
                      <input value={m.dose} onChange={(e) => updateMed(m.key, { dose: e.target.value.slice(0, 60) })} placeholder="Dose (e.g. 50 mg)" className="field" aria-label="Dose" />
                    </div>
                    <input value={m.instructions} onChange={(e) => updateMed(m.key, { instructions: e.target.value.slice(0, 200) })} placeholder="Instructions (e.g. after breakfast)" className="field mt-2 w-full" aria-label="Instructions" />
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {m.as_needed ? (
                        <span className="text-xs text-muted">Only when needed. It won&apos;t be scheduled.</span>
                      ) : (
                        <>
                          {m.times.map((t, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <input
                                type="time"
                                value={t}
                                onChange={(e) => updateMed(m.key, { times: m.times.map((x, j) => (j === i ? e.target.value : x)) })}
                                className="field !py-1.5 font-mono text-xs"
                                aria-label="Dose time"
                              />
                              <button onClick={() => updateMed(m.key, { times: m.times.filter((_, j) => j !== i) })} className="px-1 text-faint hover:text-rose" aria-label="Remove time">
                                ×
                              </button>
                            </span>
                          ))}
                          {m.times.length < 6 && (
                            <button onClick={() => updateMed(m.key, { times: [...m.times, "08:00"] })} className="rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-xs text-muted hover:text-ink">
                              + time
                            </button>
                          )}
                        </>
                      )}
                      <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                        <input type="checkbox" checked={m.as_needed} onChange={(e) => updateMed(m.key, { as_needed: e.target.checked })} className="accent-[var(--mint)]" />
                        as needed
                      </label>
                    </div>
                    {needsTime(m) && <p className="mt-2 text-xs text-rose">Add when you take it, or mark it &quot;as needed&quot;.</p>}
                    <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={m.confirmed} onChange={(e) => updateMed(m.key, { confirmed: e.target.checked })} className="h-4 w-4 accent-[var(--mint)]" />
                        <span className={m.confirmed ? "text-mint" : "text-ink"}>{m.confirmed ? "Confirmed" : "This matches my prescription"}</span>
                      </label>
                      <div className="flex items-center gap-3">
                        {m.fromScan && <span className="mono-label !text-[9px]">from scan</span>}
                        <button onClick={() => setMeds((cur) => cur.filter((x) => x.key !== m.key))} className="font-mono text-xs text-faint hover:text-rose">
                          remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setMeds((cur) => [...cur, newMed({ times: ["08:00"] })])} className="w-full rounded-2xl border border-dashed border-white/15 py-3 text-sm text-muted transition hover:border-white/30 hover:text-ink">
                  + Add a medicine
                </button>
              </div>
            </section>
          )}

          {step === 5 && (
            <section className="py-16 text-center">
              <div className="relative mx-auto h-40 w-40">
                <div className="absolute inset-0 animate-ping rounded-full bg-mint/10 [animation-duration:2.4s]" />
                <div className="absolute inset-6 animate-pulse rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff8,var(--mint)_35%,var(--sky)_75%)] shadow-[0_0_80px_-10px_var(--mint)]" />
              </div>
              <p className="shimmer-text mt-10 font-[family-name:var(--font-unbounded)] text-xl font-semibold">{BUILD_STAGES[stage]}</p>
              <p className="mono-label mt-3">private · encrypted · about 20 seconds</p>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p role="alert" className="mt-6 rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">{error}</p>}

      {step < 5 && (
        <div className="mt-10 flex items-center justify-between">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} className={`text-sm text-muted hover:text-ink ${step === 0 ? "invisible" : ""}`}>
            ← Back
          </button>
          <button
            onClick={next}
            disabled={!canNext || scanning}
            className="rounded-full bg-ink px-7 py-3 text-sm font-semibold text-bg shadow-[0_0_40px_-8px_rgba(142,245,212,0.8)] transition disabled:opacity-40"
          >
            {step === 4 ? "✦ Build my plan" : step === 3 && !meds.length && !text ? "Skip for now →" : "Continue →"}
          </button>
        </div>
      )}
      {step === 4 && !canNext && meds.length > 0 && <p className="mt-3 text-right text-xs text-faint">Confirm each medicine and set its time to continue.</p>}
    </div>
  );
}

function Pledge({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="text-xl leading-none">{icon}</span>
      <div>
        <div className="font-semibold text-ink">{title}</div>
        <p className="mt-1 text-muted">{children}</p>
      </div>
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="glass block rounded-2xl p-4">
      <span className="mono-label !text-[10px]">{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 block w-full bg-transparent font-[family-name:var(--font-unbounded)] text-2xl outline-none" />
    </label>
  );
}
