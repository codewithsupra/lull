"use client";

/**
 * Generative soundscape engine. Every layer is synthesized in real time with the
 * Web Audio API (noise buffers, filters, LFOs, oscillators) so nothing loops audibly
 * and no audio files ship with the app.
 */

export const LAYERS = [
  { id: "rain", label: "Rain", hint: "Soft rain on glass" },
  { id: "ocean", label: "Ocean", hint: "Slow tidal swell" },
  { id: "wind", label: "Wind", hint: "High mountain air" },
  { id: "fire", label: "Hearth", hint: "Crackling embers" },
  { id: "brown", label: "Deep", hint: "Brown noise for focus" },
  { id: "drone", label: "Drone", hint: "Warm harmonic pad" },
  { id: "bowls", label: "Bowls", hint: "Distant singing bowls" },
] as const;

export type LayerId = (typeof LAYERS)[number]["id"];
export type Mix = Partial<Record<LayerId, number>>;

type Layer = { gain: GainNode; stop: () => void };

const MAX_GAIN: Record<LayerId, number> = {
  rain: 0.5,
  ocean: 0.9,
  wind: 0.55,
  fire: 0.7,
  brown: 0.8,
  drone: 0.22,
  bowls: 0.5,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private layers = new Map<LayerId, Layer>();
  private levels: Mix = {};
  private noise: { white?: AudioBuffer; pink?: AudioBuffer; brown?: AudioBuffer; crackle?: AudioBuffer } = {};
  private listeners = new Set<() => void>();
  private snapshot: Mix = {};
  private fadeToken = 0;

  get context() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 3;
      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.85;
      this.master.connect(comp).connect(this.analyserNode).connect(this.ctx.destination);
    }
    return this.ctx;
  }

  get analyser() {
    void this.context;
    return this.analyserNode!;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  private emit() {
    this.snapshot = { ...this.levels };
    this.listeners.forEach((fn) => fn());
  }

  /** Stable snapshot (new object only when levels change), safe for useSyncExternalStore. */
  get mix(): Mix {
    return this.snapshot;
  }

  get playing() {
    return Object.values(this.levels).some((v) => (v ?? 0) > 0.001);
  }

  async resume() {
    this.fadeToken++; // cancel any pending teardown from a fadeOut
    if (this.context.state === "suspended") await this.context.resume();
    this.master!.gain.cancelScheduledValues(this.context.currentTime);
    this.master!.gain.setTargetAtTime(0.9, this.context.currentTime, 0.1);
  }

  setLevel(id: LayerId, value: number) {
    const v = Math.max(0, Math.min(1, value));
    this.levels[id] = v;
    const ctx = this.context;
    let layer = this.layers.get(id);
    if (!layer && v > 0) {
      layer = this.build(id);
      this.layers.set(id, layer);
    }
    if (layer) layer.gain.gain.setTargetAtTime(v * MAX_GAIN[id], ctx.currentTime, 0.35);
    this.emit();
  }

  async applyMix(mix: Mix) {
    await this.resume();
    for (const { id } of LAYERS) this.setLevel(id, mix[id] ?? 0);
  }

  /** Fade the whole engine out, then tear down every layer. */
  fadeOut(seconds = 2) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + seconds);
    const token = ++this.fadeToken;
    window.setTimeout(() => {
      if (token !== this.fadeToken) return;
      this.layers.forEach((l) => l.stop());
      this.layers.clear();
      this.levels = {};
      this.emit();
    }, seconds * 1000 + 60);
  }

  /** Breath cue: a soft sine glide up (inhale) or down (exhale). */
  breathCue(kind: "in" | "out" | "hold", seconds: number) {
    const ctx = this.context;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    osc.type = "sine";
    osc2.type = "triangle";
    const [from, to] = kind === "in" ? [196, 293.66] : kind === "out" ? [293.66, 196] : [246.94, 246.94];
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + seconds);
    osc2.frequency.setValueAtTime(from * 1.5, t);
    osc2.frequency.exponentialRampToValueAtTime(to * 1.5, t + seconds);
    const peak = kind === "hold" ? 0.025 : 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(1.2, seconds * 0.4));
    g.gain.setValueAtTime(peak, t + seconds * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + seconds);
    osc.connect(g);
    osc2.connect(g);
    g.connect(lp).connect(this.master!);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + seconds + 0.1);
    osc2.stop(t + seconds + 0.1);
  }

  bell(freq = 432, gain = 0.18) {
    const ctx = this.context;
    if (ctx.state === "suspended") void ctx.resume();
    this.strike(ctx, this.master!, freq, gain, 7);
  }

  // ---------- synthesis ----------

  private buffer(kind: "white" | "pink" | "brown" | "crackle") {
    const cached = this.noise[kind];
    if (cached) return cached;
    const ctx = this.context;
    const seconds = kind === "crackle" ? 12 : 9;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === "white") d[i] = w * 0.5;
        else if (kind === "pink") {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else if (kind === "brown") {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else {
          // Sparse, decaying pops: ember crackle.
          d[i] = 0;
        }
      }
      // Equal-power crossfade the tail into the head so the loop point is inaudible.
      if (kind !== "crackle") {
        const fade = Math.floor(ctx.sampleRate * 0.5);
        for (let i = 0; i < fade; i++) {
          const x = i / fade;
          d[i] = d[i] * Math.sin((x * Math.PI) / 2) + d[len - fade + i] * Math.cos((x * Math.PI) / 2);
        }
      } else {
        let i = 0;
        while (i < len) {
          i += Math.floor(ctx.sampleRate * (0.02 + Math.random() * Math.random() * 0.5));
          const size = Math.floor(ctx.sampleRate * (0.002 + Math.random() * 0.012));
          const amp = Math.pow(Math.random(), 2.2);
          for (let j = 0; j < size && i + j < len; j++) {
            d[i + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / (size * 0.25));
          }
        }
      }
    }
    this.noise[kind] = buf;
    return buf;
  }

  private source(kind: "white" | "pink" | "brown" | "crackle") {
    const ctx = this.context;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(kind);
    src.loop = true;
    src.start(ctx.currentTime, Math.random() * 4);
    return src;
  }

  private lfo(freq: number, depth: number, target: AudioParam) {
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.frequency.value = freq;
    amp.gain.value = depth;
    osc.connect(amp).connect(target);
    osc.start();
    return osc;
  }

  private strike(ctx: AudioContext, dest: AudioNode, freq: number, gain: number, decay: number) {
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.2 - 0.6;
    out.connect(pan).connect(dest);
    // Inharmonic partials give the metallic singing-bowl timbre.
    [1, 2.76, 5.4, 8.93].forEach((ratio, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq * ratio * (1 + (Math.random() - 0.5) * 0.004);
      g.gain.value = [1, 0.4, 0.18, 0.07][i];
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + decay);
    });
  }

  private build(id: LayerId): Layer {
    const ctx = this.context;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master!);
    const stops: Array<() => void> = [];
    const track = <T extends AudioScheduledSourceNode>(n: T) => {
      stops.push(() => {
        try {
          n.stop();
        } catch {}
      });
      return n;
    };

    switch (id) {
      case "rain": {
        const src = track(this.source("white"));
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 500;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 7000;
        const peak = ctx.createBiquadFilter();
        peak.type = "peaking";
        peak.frequency.value = 2500;
        peak.gain.value = 4;
        const drops = track(this.source("crackle"));
        const dropsBp = ctx.createBiquadFilter();
        dropsBp.type = "bandpass";
        dropsBp.frequency.value = 3200;
        dropsBp.Q.value = 0.8;
        const dropsGain = ctx.createGain();
        dropsGain.gain.value = 0.6;
        drops.playbackRate.value = 1.8;
        src.connect(hp).connect(lp).connect(peak).connect(gain);
        drops.connect(dropsBp).connect(dropsGain).connect(gain);
        break;
      }
      case "ocean": {
        const src = track(this.source("brown"));
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 700;
        lp.Q.value = 0.4;
        const swell = ctx.createGain();
        swell.gain.value = 0.6;
        track(this.lfo(0.075, 480, lp.frequency));
        track(this.lfo(0.075, 0.4, swell.gain));
        const hiss = track(this.source("pink"));
        const hissBp = ctx.createBiquadFilter();
        hissBp.type = "bandpass";
        hissBp.frequency.value = 1800;
        const hissGain = ctx.createGain();
        hissGain.gain.value = 0.08;
        track(this.lfo(0.075, 0.07, hissGain.gain));
        src.connect(lp).connect(swell).connect(gain);
        hiss.connect(hissBp).connect(hissGain).connect(gain);
        break;
      }
      case "wind": {
        const src = track(this.source("pink"));
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 600;
        bp.Q.value = 1.4;
        track(this.lfo(0.043, 380, bp.frequency));
        const gust = ctx.createGain();
        gust.gain.value = 0.7;
        track(this.lfo(0.11, 0.3, gust.gain));
        const pan = ctx.createStereoPanner();
        track(this.lfo(0.03, 0.6, pan.pan));
        src.connect(bp).connect(gust).connect(pan).connect(gain);
        break;
      }
      case "fire": {
        const rumble = track(this.source("brown"));
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 240;
        const rg = ctx.createGain();
        rg.gain.value = 0.5;
        const crackle = track(this.source("crackle"));
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 900;
        rumble.connect(lp).connect(rg).connect(gain);
        crackle.connect(hp).connect(gain);
        break;
      }
      case "brown": {
        const src = track(this.source("brown"));
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 520;
        src.connect(lp).connect(gain);
        break;
      }
      case "drone": {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 900;
        lp.Q.value = 0.7;
        track(this.lfo(0.05, 350, lp.frequency));
        const trem = ctx.createGain();
        trem.gain.value = 0.8;
        track(this.lfo(0.13, 0.15, trem.gain));
        // A2 · E3 · B3 · C#4 — an open, unresolved Amaj9-ish voicing.
        [110, 164.81, 246.94, 277.18].forEach((f, i) => {
          [-5, 5].forEach((cents) => {
            const o = track(ctx.createOscillator());
            o.type = i === 0 ? "sine" : "triangle";
            o.frequency.value = f;
            o.detune.value = cents;
            const g = ctx.createGain();
            g.gain.value = i === 0 ? 0.35 : 0.16;
            const p = ctx.createStereoPanner();
            p.pan.value = cents < 0 ? -0.4 : 0.4;
            o.connect(g).connect(p).connect(lp);
            o.start();
          });
        });
        lp.connect(trem).connect(gain);
        break;
      }
      case "bowls": {
        const notes = [220, 261.63, 293.66, 329.63, 392, 440];
        const verb = ctx.createDelay(1.2);
        verb.delayTime.value = 0.37;
        const fb = ctx.createGain();
        fb.gain.value = 0.35;
        const wet = ctx.createBiquadFilter();
        wet.type = "lowpass";
        wet.frequency.value = 1800;
        verb.connect(fb).connect(wet).connect(verb);
        wet.connect(gain);
        const bus = ctx.createGain();
        bus.connect(gain);
        bus.connect(verb);
        let timer = 0;
        const ring = () => {
          this.strike(ctx, bus, notes[Math.floor(Math.random() * notes.length)], 0.25, 9);
          timer = window.setTimeout(ring, 3500 + Math.random() * 7000);
        };
        timer = window.setTimeout(ring, 400);
        stops.push(() => window.clearTimeout(timer));
        break;
      }
    }

    return {
      gain,
      stop: () => {
        stops.forEach((s) => s());
        gain.disconnect();
      },
    };
  }
}

let engine: SoundEngine | null = null;
export function getEngine() {
  if (!engine) engine = new SoundEngine();
  return engine;
}

// ---------- speech ----------

export function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const preferred = ["Samantha", "Ava", "Serena", "Google UK English Female", "Karen", "Moira", "Daniel", "Microsoft Aria"];
  for (const name of preferred) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices[0] ?? null;
}

export function speak(text: string, opts: { onEnd?: () => void } = {}) {
  if (!("speechSynthesis" in window)) {
    opts.onEnd?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.rate = 0.84;
  u.pitch = 0.92;
  u.volume = 0.95;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  window.speechSynthesis.speak(u);
}
