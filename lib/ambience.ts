"use client";

import { sceneNow, sceneWeather } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { useSettings } from "@/lib/settings";

/**
 * The office's background sound, generated live with Web Audio (no audio files):
 *   room tone (soft brown noise), the AC hum during office hours, keyboard clatter from each working desk
 *   (positional: loud when you're zoomed in on that desk, quiet or silent when it's far off or out of view),
 *   birds by day, crickets at night, traffic passing now and then, rain when it rains and thunder in storms.
 *   It reads the scene clock and weather, so previews sound right too.
 *
 * Plus the office sound system (Settings → Sound → Office music): a soft lo-fi loop with a warm sub-bass
 * kick through the woofer, played during office hours (8 AM – 7 PM). The 3D subwoofer's cone pumps on each
 * kick (wooferLevel below).
 */

/** Lo-fi loop: 78 BPM, sixteenth-note steps, a four-chord progression (Am7, Fmaj7, Cmaj7, G6), one bar each. */
const BPM = 78;
const STEP = 60 / BPM / 4;
const CHORDS: readonly (readonly number[])[] = [
  [57, 60, 64, 67], // A C E G
  [53, 57, 60, 64], // F A C E
  [48, 52, 55, 59], // C E G B
  [55, 59, 62, 64], // G B D E
];
const ROOTS = [33, 29, 36, 31];
const KICKS = new Set([0, 7, 10]);
const midiHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

/**
 * Typing sources, written by the 3D scene (see SoundListener in Scene3D): per desk, how loud it should be
 * from where you're looking (0 = inaudible) and where it sits left/right on screen (-1…1).
 */
export const typingSources = new Map<string, { gain: number; pan: number }>();

function noiseBuffer(ctx: AudioContext, seconds: number, color: "white" | "pink" | "brown"): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "white") d[i] = w;
    else if (color === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
  }
  return buf;
}

function loop(ctx: AudioContext, buf: AudioBuffer, out: AudioNode): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(out);
  src.start();
  return src;
}

export class Ambience {
  private ctx: AudioContext;
  private master: GainNode;
  private room: GainNode;
  private ac: GainNode;
  private rain: GainNode;
  private crickets: GainNode;
  private white: AudioBuffer;
  private brown: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextKey = new Map<string, number>();
  private nextBird = 0;
  private nextCar = 0;
  private nextThunder = 0;
  private music: GainNode;
  private musicLp: BiquadFilterNode;
  private nextStep = 0;
  private step = 0;
  /** Audio-clock times of the recent kicks, for the woofer animation. */
  kicks: number[] = [];

  constructor() {
    this.ctx = new AudioContext();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.white = noiseBuffer(ctx, 2, "white");
    this.brown = noiseBuffer(ctx, 4, "brown");

    // room tone
    this.room = ctx.createGain();
    this.room.gain.value = 0.05;
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = "lowpass"; roomLp.frequency.value = 420;
    roomLp.connect(this.room).connect(this.master);
    loop(ctx, this.brown, roomLp);

    // AC hum: two low sines
    this.ac = ctx.createGain();
    this.ac.gain.value = 0;
    this.ac.connect(this.master);
    for (const f of [58, 117]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = f < 100 ? 0.5 : 0.18;
      o.connect(g).connect(this.ac);
      o.start();
    }

    // rain: pink noise through a band
    this.rain = ctx.createGain();
    this.rain.gain.value = 0;
    const rainBp = ctx.createBiquadFilter();
    rainBp.type = "bandpass"; rainBp.frequency.value = 1800; rainBp.Q.value = 0.4;
    rainBp.connect(this.rain).connect(this.master);
    loop(ctx, noiseBuffer(ctx, 3, "pink"), rainBp);

    // crickets: a high tone pulsed by a low oscillator
    this.crickets = ctx.createGain();
    this.crickets.gain.value = 0;
    const tone = ctx.createOscillator();
    tone.frequency.value = 4700;
    const pulse = ctx.createGain();
    pulse.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 22;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(pulse.gain);
    tone.connect(pulse).connect(this.crickets).connect(this.master);
    tone.start(); lfo.start();

    // the sound system: everything musical goes through a warm low-pass (the lo-fi "dusty" top end)
    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.musicLp = ctx.createBiquadFilter();
    this.musicLp.type = "lowpass"; this.musicLp.frequency.value = 2200; this.musicLp.Q.value = 0.5;
    this.musicLp.connect(this.music).connect(this.master);
  }

  get now(): number { return this.ctx.currentTime; }

  /** Schedule the next ~0.4 s of the loop (called every 120 ms; audio-clock timing, so it never drifts). */
  private playMusic() {
    const ctx = this.ctx;
    if (this.nextStep < ctx.currentTime) this.nextStep = ctx.currentTime + 0.05;
    while (this.nextStep < ctx.currentTime + 0.4) {
      const t = this.nextStep, s = this.step % 16, bar = Math.floor(this.step / 16) % CHORDS.length;
      // swing: every other sixteenth a little late
      const at = t + (s % 2 ? STEP * 0.12 : 0);
      if (KICKS.has(s)) this.kick(at);
      if (s === 4 || s === 12) this.burst({ dur: 0.16, gain: 0.05, type: "bandpass", freq: 1600, q: 0.8, out: this.musicLp, at });
      if (s % 2 === 0) this.burst({ dur: 0.04, gain: s % 4 === 2 ? 0.018 : 0.01, type: "highpass", freq: 7000, out: this.musicLp, at });
      if (s === 0 || s === 10) this.tone(midiHz(ROOTS[bar]), at, STEP * 5, 0.14, "sine");
      if (s === 0) for (const n of CHORDS[bar]) this.tone(midiHz(n), at, STEP * 15, 0.022, "triangle");
      if (s === 6 && bar % 2 === 1) this.tone(midiHz(CHORDS[bar][3] + 12), at, STEP * 3, 0.018, "sine");
      this.nextStep += STEP;
      this.step++;
    }
  }

  /** A soft kick: a sine dropping from 110 Hz to 42 Hz. */
  private kick(t: number) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(this.musicLp);
    o.start(t); o.stop(t + 0.45);
    this.kicks.push(t);
    if (this.kicks.length > 6) this.kicks.shift();
  }

  private tone(freq: number, t: number, dur: number, gain: number, type: OscillatorType) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicLp);
    o.start(t); o.stop(t + dur + 0.05);
  }

  async start(): Promise<void> {
    await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.9, t, 0.6);
    if (!this.timer) this.timer = setInterval(() => this.update(), 120);
  }

  async stop(): Promise<void> {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.25);
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    await new Promise((r) => setTimeout(r, 900));
    await this.ctx.suspend();
  }

  private set(g: GainNode, v: number) {
    g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.8);
  }

  /** A short filtered noise burst: a key press, a raindrop on glass, a car passing… */
  private burst(opts: { dur: number; gain: number; type: BiquadFilterType; freq: number; q?: number; attack?: number; pan?: number; buf?: AudioBuffer; out?: AudioNode; at?: number }) {
    const ctx = this.ctx, t = opts.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = opts.buf ?? this.white;
    const f = ctx.createBiquadFilter();
    f.type = opts.type; f.frequency.value = opts.freq; f.Q.value = opts.q ?? 0.7;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.002;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    const p = ctx.createStereoPanner();
    p.pan.value = opts.pan ?? 0;
    src.connect(f).connect(g).connect(p).connect(opts.out ?? this.master);
    src.start(t, Math.random());
    src.stop(t + opts.dur + 0.05);
  }

  private chirp(base: number, gain: number) {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const s = t + i * 0.11;
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * 1.45, s + 0.07);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(gain, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g).connect(p).connect(this.master);
      o.start(s); o.stop(s + 0.1);
    }
  }

  private update() {
    const now = performance.now() / 1000;
    const min = manilaMinutes(sceneNow());
    const night = min < 360 || min >= 1110;
    const weather = sceneWeather();
    const raining = weather === "rain" || weather === "storm";

    this.set(this.ac, min >= 480 && min < 1140 ? 0.012 : 0);
    this.set(this.rain, raining ? (weather === "storm" ? 0.16 : 0.1) : 0);
    this.set(this.crickets, night && !raining ? 0.0045 : 0);
    this.set(this.room, night ? 0.03 : 0.05);

    // the sound system plays during office hours
    const musicOn = useSettings.getState().music && min >= 480 && min < 1140;
    this.set(this.music, musicOn ? 0.55 : 0);
    if (musicOn) this.playMusic();
    else this.kicks.length = 0;

    // keyboards: each audible desk types in its own bursts, at its own loudness and stereo position
    for (const [id, src] of typingSources) {
      if (src.gain < 0.03) continue;
      const due = this.nextKey.get(id) ?? 0;
      if (now < due) continue;
      this.burst({ dur: 0.03, gain: (0.02 + Math.random() * 0.03) * src.gain, type: "highpass", freq: 2400 + Math.random() * 1500, pan: src.pan });
      const pause = Math.random() < 0.08 ? 0.6 + Math.random() * 1.2 : 0.07 + Math.random() * 0.15;
      this.nextKey.set(id, now + pause);
    }
    // birds by day (not in the rain)
    if (!night && !raining && now >= this.nextBird) {
      if (this.nextBird) this.chirp(2600 + Math.random() * 1800, 0.012);
      this.nextBird = now + 5 + Math.random() * 12;
    }
    // a car or jeepney going by
    if (now >= this.nextCar) {
      if (this.nextCar) this.burst({ dur: 3.2, gain: 0.05, type: "lowpass", freq: 380, attack: 1.4, pan: Math.random() < 0.5 ? -0.7 : 0.7, buf: this.brown });
      this.nextCar = now + 14 + Math.random() * 26;
    }
    // thunder in storms
    if (weather === "storm" && now >= this.nextThunder) {
      if (this.nextThunder) this.burst({ dur: 3.5, gain: 0.35, type: "lowpass", freq: 140, attack: 0.08, buf: this.brown });
      this.nextThunder = now + 9 + Math.random() * 10;
    }
  }
}

/* ------------------------------------------------------------------ one engine, switched in order */

let engine: Ambience | null = null;
let playing = false;
let queue: Promise<void> = Promise.resolve();

/** 0–1: how far the subwoofer's cone is pushed out right now (a quick decay after each kick). 0 when silent. */
export function wooferLevel(): number {
  if (!engine || !playing) return 0;
  const now = engine.now;
  let v = 0;
  for (const t of engine.kicks) {
    const dt = now - t;
    if (dt >= 0 && dt < 0.5) v = Math.max(v, Math.exp(-dt * 11));
  }
  return v;
}

/**
 * Turn the ambience on or off. There's only ever one engine, and requests run one after another,
 * so a quick on→off (or a tap that starts it while also pressing mute) always ends in the last state asked for.
 */
export function setSound(on: boolean): Promise<void> {
  queue = queue.then(async () => {
    if (!engine) {
      if (!on) return;
      engine = new Ambience();
    }
    playing = on;
    if (on) await engine.start();
    else await engine.stop();
  }).catch((e: unknown) => { console.warn("sound:", e instanceof Error ? e.message : e); });
  return queue;
}
