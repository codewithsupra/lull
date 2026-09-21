"use client";

import { useState } from "react";
import { MOODS, TAGS, addCheckin, type MoodCheckin } from "@/lib/data";

export function CheckinCard({ onSaved, disabled }: { onSaved: (c: MoodCheckin) => void; disabled?: boolean }) {
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState(3);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < 8 ? [...cur, t] : cur));

  const save = async () => {
    if (!mood) return;
    setSaving(true);
    setError(null);
    try {
      const row = await addCheckin({ mood, energy, tags, note });
      onSaved(row);
      setSaved(true);
      setMood(null);
      setTags([]);
      setNote("");
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const selected = MOODS.find((m) => m.v === mood);

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-baseline justify-between">
        <p className="mono-label">Check in</p>
        {saved && <span className="font-mono text-xs text-mint">✓ saved</span>}
      </div>
      <p className="mt-2 text-lg">How are you arriving right now?</p>
      <div className="mt-5 grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <button
            key={m.v}
            disabled={disabled}
            onClick={() => setMood(m.v)}
            className={`group flex flex-col items-center gap-2 rounded-2xl border py-3 transition disabled:opacity-40 ${
              mood === m.v ? "border-white/30 bg-white/[0.07]" : "border-white/10 hover:border-white/20"
            }`}
            style={mood === m.v ? { boxShadow: `0 0 30px -8px ${m.color}` } : undefined}
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-full text-sm transition group-hover:scale-110"
              style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${m.color})`, color: "#03050b" }}
            >
              {m.face}
            </span>
            <span className="text-[11px] text-muted">{m.label}</span>
          </button>
        ))}
      </div>

      {mood && (
        <div className="mt-6 animate-[fadeIn_0.5s_ease] space-y-5">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Energy</span>
              <span className="font-mono text-xs text-faint">{["drained", "low", "steady", "lively", "buzzing"][energy - 1]}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="slider mt-3 w-full"
              style={{ ["--val" as string]: `${((energy - 1) / 4) * 100}%` }}
              aria-label="Energy"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`rounded-full border px-3 py-1 text-xs transition ${tags.includes(t) ? "border-mint/50 bg-mint/10 text-mint" : "border-white/10 text-muted hover:text-ink"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="Anything on your mind? (optional)"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none placeholder:text-faint focus:border-mint/40"
          />
          {error && <p className="text-sm text-rose">{error}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="w-full rounded-xl py-3 text-sm font-semibold text-bg transition disabled:opacity-50"
            style={{ background: selected?.color }}
          >
            {saving ? "Saving…" : `Log “${selected?.label}”`}
          </button>
        </div>
      )}
    </div>
  );
}
