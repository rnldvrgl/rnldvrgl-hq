"use client";

import { sceneNow, sceneWeather } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { create } from "zustand";
import { useSettings, MUSIC_STYLES, type MixKey, type MusicStyle } from "@/lib/settings";
import { spotifyBeat, useSpotify } from "@/lib/spotify";

/**
 * The office's background sound, generated live with Web Audio (no audio files):
 *   room tone (soft brown noise), the AC hum during office hours, keyboard clatter from each working desk
 *   (positional: loud when you're zoomed in on that desk, quiet or silent when it's far off or out of view),
 *   birds by day, crickets at night, traffic passing now and then, rain when it rains and thunder in storms.
 *   It reads the scene clock and weather, so previews sound right too.
 *
 * Plus the office sound system (Settings → Sound → Office music): a generated loop in one of six styles
 * (lo-fi, café jazz, bossa nova, calm piano, synthwave, 8-bit), played during office hours (8 AM – 7 PM).
 * The 3D subwoofer's cone pumps on each kick or bass note (wooferLevel below).
 *
 * And the car and scooters outside: the boss's car starting, idling, stopping and locking, the lunch rider's
 * scooter, and now and then a jeepney's horn.
 *
 * Every sound goes through one of the mixer's channels (Settings → Sound → Volume): music, office hum,
 * keyboards, rain & thunder, street & nature, alerts, and the overall volume after them.
 */

type Song = {
  bpm: number;
  /** How late the off-beat lands, as a share of a sixteenth (lo-fi swings sixteenths, jazz swings eighths). */
  swing: number;
  /** Swing every other sixteenth ("16") or every other eighth ("8"). */
  swingOn: 8 | 16;
  /** The warm low-pass every musical note goes through. */
  lp: number;
  /** One chord per bar: voicing (MIDI notes) and bass root. */
  bars: readonly { chord: readonly number[]; root: number }[];
};

/** Each style's tempo, feel and four-bar progression. What plays on each step is in Ambience.playStep. */
const SONGS: Record<MusicStyle, Song> = {
  // Am7 · Fmaj7 · Cmaj7 · G6
  lofi: { bpm: 78, swing: 0.12, swingOn: 16, lp: 2200, bars: [
    { chord: [57, 60, 64, 67], root: 33 }, { chord: [53, 57, 60, 64], root: 29 },
    { chord: [48, 52, 55, 59], root: 36 }, { chord: [55, 59, 62, 64], root: 31 },
  ] },
  // ii–V–I–VI in C: Dm7 · G7 · Cmaj7 · A7
  jazz: { bpm: 108, swing: 0.34, swingOn: 8, lp: 3200, bars: [
    { chord: [62, 65, 69, 72], root: 38 }, { chord: [59, 62, 65, 69], root: 43 },
    { chord: [60, 64, 67, 71], root: 36 }, { chord: [61, 64, 67, 70], root: 45 },
  ] },
  // Fmaj7 · Em7 · Dm7 · G7
  bossa: { bpm: 70, swing: 0.04, swingOn: 16, lp: 3000, bars: [
    { chord: [53, 57, 60, 64], root: 41 }, { chord: [52, 55, 59, 62], root: 40 },
    { chord: [50, 53, 57, 60], root: 38 }, { chord: [53, 55, 59, 62], root: 43 },
  ] },
  // Cadd9 · Am7 · Fmaj7 · Gsus
  piano: { bpm: 60, swing: 0, swingOn: 16, lp: 2600, bars: [
    { chord: [55, 60, 62, 64, 67, 72], root: 36 }, { chord: [52, 57, 60, 64, 67, 69], root: 33 },
    { chord: [53, 57, 60, 64, 65, 69], root: 29 }, { chord: [55, 59, 60, 62, 67, 71], root: 31 },
  ] },
  // Am · F · C · G
  synthwave: { bpm: 100, swing: 0, swingOn: 16, lp: 1900, bars: [
    { chord: [57, 60, 64], root: 33 }, { chord: [53, 57, 60], root: 29 },
    { chord: [55, 60, 64], root: 36 }, { chord: [55, 59, 62], root: 31 },
  ] },
  // C · Am · F · G
  chiptune: { bpm: 140, swing: 0, swingOn: 16, lp: 6000, bars: [
    { chord: [60, 64, 67], root: 36 }, { chord: [57, 60, 64], root: 33 },
    { chord: [53, 57, 60], root: 29 }, { chord: [55, 59, 62], root: 31 },
  ] },
};
/** Jazz walking bass: the chord's third above each root (minor for Dm7, major for the rest). */
const JAZZ_THIRD = [3, 4, 4, 4];
const midiHz = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** What the office sound system is playing right now (for the floating now-playing card). */
export const useRadio = create<{ on: boolean; style: MusicStyle }>(() => ({ on: false, style: "lofi" }));
export const musicStyleLabel = (id: MusicStyle): string => MUSIC_STYLES.find((m) => m.id === id)?.label ?? id;

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
  /** The mixer: one channel per kind of sound, then the overall volume (see applyMix). */
  private bus: Record<MixKey, GainNode>;
  private mixed = "";
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
  private nextCall = 0;
  private music: GainNode;
  private musicLp: BiquadFilterNode;
  private nextStep = 0;
  private step = 0;
  private style: MusicStyle | null = null;
  /** Audio-clock times of the recent kicks, for the woofer animation. */
  kicks: number[] = [];

  constructor() {
    this.ctx = new AudioContext();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // a gentle limiter at the very end, so turning several channels up never clips
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 8;
    limiter.attack.value = 0.005; limiter.release.value = 0.2;
    this.master.connect(limiter).connect(ctx.destination);
    const all = ctx.createGain();
    all.connect(this.master);
    const channel = () => { const g = ctx.createGain(); g.connect(all); return g; };
    this.bus = { all, music: channel(), room: channel(), typing: channel(), weather: channel(), street: channel(), alerts: channel() };
    this.applyMix();
    this.white = noiseBuffer(ctx, 2, "white");
    this.brown = noiseBuffer(ctx, 4, "brown");

    // room tone
    this.room = ctx.createGain();
    this.room.gain.value = 0.05;
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = "lowpass"; roomLp.frequency.value = 420;
    roomLp.connect(this.room).connect(this.bus.room);
    loop(ctx, this.brown, roomLp);

    // AC hum: two low sines
    this.ac = ctx.createGain();
    this.ac.gain.value = 0;
    this.ac.connect(this.bus.room);
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
    rainBp.connect(this.rain).connect(this.bus.weather);
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
    tone.connect(pulse).connect(this.crickets).connect(this.bus.street);
    tone.start(); lfo.start();

    // the sound system: everything musical goes through a warm low-pass (the lo-fi "dusty" top end)
    this.music = ctx.createGain();
    this.music.gain.value = 0;
    this.musicLp = ctx.createBiquadFilter();
    this.musicLp.type = "lowpass"; this.musicLp.frequency.value = 2200; this.musicLp.Q.value = 0.5;
    this.musicLp.connect(this.music).connect(this.bus.music);
  }

  get now(): number { return this.ctx.currentTime; }

  /** Schedule the next ~0.4 s of the loop (called every 120 ms; audio-clock timing, so it never drifts). */
  private playMusic(style: MusicStyle) {
    const ctx = this.ctx, song = SONGS[style];
    if (style !== this.style) {
      // a new style starts from its first bar, through its own tone colour
      this.style = style;
      this.step = 0;
      this.musicLp.frequency.setTargetAtTime(song.lp, ctx.currentTime, 0.3);
    }
    const STEP = 60 / song.bpm / 4;
    if (this.nextStep < ctx.currentTime) this.nextStep = ctx.currentTime + 0.05;
    while (this.nextStep < ctx.currentTime + 0.4) {
      const s = this.step % 16, b = Math.floor(this.step / 16) % song.bars.length;
      const late = song.swingOn === 16 ? s % 2 === 1 : s % 4 === 2;
      const at = this.nextStep + (late ? STEP * song.swing : 0);
      this.playStep(style, s, b, at, STEP);
      this.nextStep += STEP;
      this.step++;
    }
  }

  /** One sixteenth of the chosen style: s = step in the bar (0–15), b = bar, at = audio time. */
  private playStep(style: MusicStyle, s: number, b: number, at: number, STEP: number) {
    const song = SONGS[style];
    const { chord, root } = song.bars[b];
    const nextRoot = song.bars[(b + 1) % song.bars.length].root;
    const out = this.musicLp;
    switch (style) {
      case "lofi":
        if (s === 0 || s === 7 || s === 10) this.kick(at);
        if (s === 4 || s === 12) this.burst({ dur: 0.16, gain: 0.05, type: "bandpass", freq: 1600, q: 0.8, out, at });
        if (s % 2 === 0) this.burst({ dur: 0.04, gain: s % 4 === 2 ? 0.018 : 0.01, type: "highpass", freq: 7000, out, at });
        if (s === 0 || s === 10) this.tone(midiHz(root), at, STEP * 5, 0.14, "sine");
        if (s === 0) for (const n of chord) this.tone(midiHz(n), at, STEP * 15, 0.022, "triangle");
        if (s === 6 && b % 2 === 1) this.tone(midiHz(chord[3] + 12), at, STEP * 3, 0.018, "sine");
        break;

      case "jazz": {
        // walking bass on every beat: root, third, fifth, then a half step under the next chord's root
        if (s % 4 === 0) {
          const beat = s / 4;
          const n = beat === 0 ? root : beat === 1 ? root + JAZZ_THIRD[b] : beat === 2 ? root + 7 : nextRoot - 1 + (nextRoot < root ? 12 : 0);
          this.tone(midiHz(n), at, STEP * 3.6, 0.15, "triangle");
          this.pulse(at);
        }
        // ride cymbal: ding, ding-a, ding, ding-a
        if (s % 4 === 0) this.burst({ dur: 0.3, gain: 0.012, type: "highpass", freq: 6500, out, at });
        if (s === 6 || s === 14) this.burst({ dur: 0.18, gain: 0.008, type: "highpass", freq: 7000, out, at });
        // brushes on 2 and 4
        if (s === 4 || s === 12) this.burst({ dur: 0.24, gain: 0.03, type: "bandpass", freq: 2400, q: 0.6, attack: 0.03, out, at });
        // piano comping: short chords on the off-beats, a different spot every other bar
        if ((b % 2 === 0 && (s === 6 || s === 14)) || (b % 2 === 1 && (s === 2 || s === 10))) {
          for (const n of chord) this.pluck(midiHz(n), at, STEP * 2.6, 0.02, "triangle");
        }
        if (s === 0 && b === 3) this.pluck(midiHz(chord[3] + 12), at + STEP * 2, STEP * 4, 0.018, "sine");
        break;
      }

      case "bossa":
        // bass: root and fifth in the bossa rhythm
        if (s === 0 || s === 8) { this.tone(midiHz(root), at, STEP * 2.6, 0.15, "sine"); this.pulse(at); }
        if (s === 6 || s === 14) this.tone(midiHz(root + 7), at, STEP * 1.8, 0.11, "sine");
        // nylon guitar: syncopated chord plucks
        if (s === 0 || s === 3 || s === 6 || s === 10 || s === 12) {
          chord.forEach((n, i) => this.pluck(midiHz(n), at + i * 0.012, STEP * 1.8, 0.016, "triangle"));
        }
        // rim clicks (the bossa clave) and a soft shaker on every sixteenth
        if ((b % 2 === 0 && (s === 0 || s === 6 || s === 12)) || (b % 2 === 1 && (s === 4 || s === 8))) {
          this.burst({ dur: 0.04, gain: 0.05, type: "bandpass", freq: 2600, q: 6, out, at });
        }
        this.burst({ dur: 0.05, gain: s % 2 ? 0.006 : 0.01, type: "highpass", freq: 8000, attack: 0.01, out, at });
        break;

      case "piano": {
        // a low root held under each bar, and slow eighth-note arpeggios up and down the chord
        if (s === 0) { this.tone(midiHz(root), at, STEP * 15, 0.11, "sine"); this.pulse(at); }
        if (s % 2 === 0) {
          const up = [0, 1, 2, 3, 4, 5, 4, 2][(s / 2) % 8];
          const f = midiHz(chord[up]);
          this.pluck(f, at, STEP * 7, 0.028, "sine");
          this.pluck(f * 2, at, STEP * 3, 0.006, "triangle");
        }
        break;
      }

      case "synthwave":
        if (s % 4 === 0) this.kick(at);
        if (s === 4 || s === 12) {
          this.burst({ dur: 0.28, gain: 0.07, type: "bandpass", freq: 1500, q: 0.7, out, at });
          this.burst({ dur: 0.12, gain: 0.02, type: "highpass", freq: 5000, out, at });
        }
        if (s % 2 === 1) this.burst({ dur: 0.04, gain: 0.01, type: "highpass", freq: 8000, out, at });
        // driving eighth-note bass, octave jumps
        if (s % 2 === 0) this.pluck(midiHz(root + (s % 4 === 2 ? 12 : 0)), at, STEP * 1.6, 0.05, "sawtooth");
        // a wide pad, and a quiet arpeggio on top
        if (s === 0) for (const n of chord) this.tone(midiHz(n), at, STEP * 16, 0.008, "sawtooth");
        this.pluck(midiHz(chord[s % chord.length] + 12), at, STEP * 0.9, 0.006, "square");
        break;

      case "chiptune":
        // square-wave arpeggio on every sixteenth, triangle bass, a noise hat
        this.pluck(midiHz(chord[[0, 1, 2, 1][s % 4]] + 12), at, STEP * 0.8, 0.012, "square");
        if (s % 4 === 0) { this.pluck(midiHz(root + 12), at, STEP * 1.5, 0.1, "triangle"); if (s % 8 === 0) this.pulse(at); }
        if (s % 4 === 2) this.pluck(midiHz(root + 24), at, STEP * 1.2, 0.06, "triangle");
        if (s % 4 === 2) this.burst({ dur: 0.03, gain: 0.02, type: "highpass", freq: 5000, out, at });
        if (s === 0 || s === 8) this.kick(at);
        // a little lead tune every other bar
        if (b % 2 === 1 && (s === 0 || s === 3 || s === 6)) this.pluck(midiHz(chord[2] + 12 + (s === 3 ? 2 : s === 6 ? 4 : 0)), at, STEP * 2.5, 0.01, "square");
        break;
    }
  }

  /** Let the woofer pump on a bass note (no sound of its own). */
  private pulse(t: number) {
    this.kicks.push(t);
    if (this.kicks.length > 6) this.kicks.shift();
  }

  /** A plucked note: a fast attack and a natural decay (guitar, piano, chip). */
  private pluck(freq: number, t: number, dur: number, gain: number, type: OscillatorType) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicLp);
    o.start(t); o.stop(t + dur + 0.05);
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
    // the car was started while the sound was off: it's idling when you turn the sound on
    const idle = carRunning ? this.ensureIdle() : this.idle;
    if (idle) idle.gain.gain.setTargetAtTime(carRunning ? 0.06 : 0, t, 0.3);
    if (!this.timer) this.timer = setInterval(() => this.update(), 120);
  }

  async stop(): Promise<void> {
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.25);
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    useRadio.setState({ on: false });
    await new Promise((r) => setTimeout(r, 900));
    await this.ctx.suspend();
  }

  /** A channel's level as a gain: the slider is 0–150 %, squared so it feels even (100 % = as designed). */
  private level(k: MixKey): number {
    const v = (useSettings.getState().volumes[k] ?? 100) / 100;
    return v * v;
  }

  /** Follow the volume sliders (checked on every update; only touches the audio graph when they moved). */
  private applyMix() {
    const vols = useSettings.getState().volumes;
    const key = JSON.stringify(vols);
    if (key === this.mixed) return;
    this.mixed = key;
    const t = this.ctx.currentTime;
    for (const k of Object.keys(this.bus) as MixKey[]) this.bus[k].gain.setTargetAtTime(this.level(k), t, 0.05);
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
    src.connect(f).connect(g).connect(p).connect(opts.out ?? this.bus.street);
    src.start(t, Math.random());
    src.stop(t + opts.dur + 0.05);
  }

  /** "Pot-pot!" on the rubber bulb horn, then "Pandesal! Mainit pa!" (the browser's voice, in Filipino if it has one). */
  private vendorCall() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02;
    for (const at of [0, 0.22]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "square";
      o.frequency.setValueAtTime(520, t0 + at);
      o.frequency.exponentialRampToValueAtTime(430, t0 + at + 0.14);
      f.type = "lowpass"; f.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.035, t0 + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.16);
      const p = ctx.createStereoPanner();
      p.pan.value = 0.5;
      o.connect(f).connect(g).connect(p).connect(this.bus.street);
      o.start(t0 + at); o.stop(t0 + at + 0.2);
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance("Pandesal! Mainit pa!");
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fil") || v.lang.startsWith("tl"));
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "fil-PH";
      u.rate = 0.95; u.pitch = 1.15; u.volume = Math.min(1, 0.35 * this.level("street"));
      setTimeout(() => window.speechSynthesis.speak(u), 700);
    } catch { /* no voice: the horn is enough */ }
  }

  /** A soft bell motif (semitones above A4, one note every 0.16 s), on the Alerts channel so music settings don't mute it. */
  chime(notes: readonly number[]) {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02;
    notes.forEach((n, i) => {
      const t = t0 + i * 0.16, f = 440 * 2 ** (n / 12);
      for (const [mul, gain] of [[1, 0.07], [2, 0.02], [3.01, 0.008]] as const) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f * mul, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 / mul);
        o.connect(g).connect(this.bus.alerts);
        o.start(t); o.stop(t + 1);
      }
    });
  }

  /* -------------------------------------------------------------- the car and scooters outside */

  /** The boss's car's idle: a low, lumpy exhaust note, faded in while the engine runs (see setCarEngine). */
  private idle: { gain: GainNode; osc: OscillatorNode[] } | null = null;

  private ensureIdle() {
    if (this.idle) return this.idle;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 240; lp.Q.value = 1.2;
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0.45; // the car is out front, right of the office
    lp.connect(gain).connect(pan).connect(this.bus.street);
    // two detuned saws an octave apart, their level wobbling at the firing rate: a 4-cylinder burble
    const osc = [ctx.createOscillator(), ctx.createOscillator()];
    osc[0].type = "sawtooth"; osc[0].frequency.value = 44;
    osc[1].type = "square"; osc[1].frequency.value = 22.3;
    const wob = ctx.createGain();
    wob.gain.value = 0.7;
    const lfo = ctx.createOscillator(), lfoDepth = ctx.createGain();
    lfo.frequency.value = 11; lfoDepth.gain.value = 0.3;
    lfo.connect(lfoDepth).connect(wob.gain);
    for (const o of osc) { o.connect(wob); o.start(); }
    wob.connect(lp);
    lfo.start();
    this.idle = { gain, osc: [...osc, lfo] };
    return this.idle;
  }

  /** Key turned: the starter cranks three times, the engine catches with a rev, then settles to idle. */
  engineStart() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    // starter motor: a whirring saw, pulsing with each compression
    const st = ctx.createOscillator(), sg = ctx.createGain(), sf = ctx.createBiquadFilter(), sp = ctx.createStereoPanner();
    st.type = "sawtooth";
    st.frequency.setValueAtTime(62, t0);
    st.frequency.linearRampToValueAtTime(78, t0 + 0.8);
    sf.type = "bandpass"; sf.frequency.value = 520; sf.Q.value = 0.9;
    sp.pan.value = 0.45;
    sg.gain.setValueAtTime(0.0001, t0);
    for (let i = 0; i < 4; i++) {
      const c = t0 + i * 0.21;
      sg.gain.exponentialRampToValueAtTime(0.09, c + 0.05);
      sg.gain.exponentialRampToValueAtTime(0.025, c + 0.18);
    }
    sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);
    st.connect(sf).connect(sg).connect(sp).connect(this.bus.street);
    st.start(t0); st.stop(t0 + 1);
    // it catches: a rev up and back down
    const tc = t0 + 0.85;
    const rev = ctx.createOscillator(), rg = ctx.createGain(), rf = ctx.createBiquadFilter(), rp = ctx.createStereoPanner();
    rev.type = "sawtooth";
    rev.frequency.setValueAtTime(40, tc);
    rev.frequency.exponentialRampToValueAtTime(120, tc + 0.35);
    rev.frequency.exponentialRampToValueAtTime(46, tc + 1.3);
    rf.type = "lowpass"; rf.frequency.setValueAtTime(400, tc); rf.frequency.linearRampToValueAtTime(900, tc + 0.35); rf.frequency.linearRampToValueAtTime(260, tc + 1.3);
    rp.pan.value = 0.45;
    rg.gain.setValueAtTime(0.0001, tc);
    rg.gain.exponentialRampToValueAtTime(0.16, tc + 0.08);
    rg.gain.exponentialRampToValueAtTime(0.05, tc + 1.3);
    rg.gain.exponentialRampToValueAtTime(0.0001, tc + 1.6);
    rev.connect(rf).connect(rg).connect(rp).connect(this.bus.street);
    rev.start(tc); rev.stop(tc + 1.7);
    this.burst({ dur: 0.5, gain: 0.08, type: "lowpass", freq: 260, attack: 0.02, pan: 0.45, buf: this.brown, at: tc });
    // then the idle takes over
    const idle = this.ensureIdle();
    idle.gain.gain.cancelScheduledValues(tc);
    idle.gain.gain.setValueAtTime(0, tc);
    idle.gain.gain.setTargetAtTime(0.06, tc + 0.9, 0.3);
  }

  /** Engine off: the idle drops in pitch and dies, with a last shudder. */
  engineStop() {
    const ctx = this.ctx, t = ctx.currentTime;
    const idle = this.idle;
    if (!idle) return;
    idle.gain.gain.cancelScheduledValues(t);
    idle.gain.gain.setTargetAtTime(0, t, 0.18);
    for (const o of idle.osc.slice(0, 2)) {
      const f = o.frequency.value;
      o.frequency.cancelScheduledValues(t);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.6);
      o.frequency.setValueAtTime(f, t + 1.2);
    }
    this.burst({ dur: 0.4, gain: 0.05, type: "lowpass", freq: 180, attack: 0.01, pan: 0.45, buf: this.brown, at: t + 0.15 });
  }

  /** Remote lock: two chirps and the doors' clunk. */
  carLock() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02;
    this.burst({ dur: 0.12, gain: 0.06, type: "lowpass", freq: 600, pan: 0.45, at: t0 });
    for (const at of [0.12, 0.34]) {
      const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
      o.type = "square";
      o.frequency.setValueAtTime(2350, t0 + at);
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.018, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.09);
      p.pan.value = 0.45;
      o.connect(g).connect(p).connect(this.bus.street);
      o.start(t0 + at); o.stop(t0 + at + 0.1);
    }
  }

  /** A switch click (headlights). */
  click() {
    this.burst({ dur: 0.025, gain: 0.05, type: "highpass", freq: 3000, pan: 0.45 });
  }

  /** A scooter: "in" rides up and stops at the kerb, "out" pulls away and fades down the street. */
  scooter(dir: "in" | "out") {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02, len = dir === "in" ? 6 : 7;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner();
    o.type = "sawtooth";
    f.type = "bandpass"; f.Q.value = 1.4;
    if (dir === "in") {
      o.frequency.setValueAtTime(105, t0);
      o.frequency.linearRampToValueAtTime(95, t0 + len * 0.7);
      o.frequency.exponentialRampToValueAtTime(48, t0 + len);
      f.frequency.setValueAtTime(700, t0); f.frequency.linearRampToValueAtTime(380, t0 + len);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + len * 0.75);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      p.pan.setValueAtTime(-0.9, t0); p.pan.linearRampToValueAtTime(0.35, t0 + len * 0.8);
    } else {
      o.frequency.setValueAtTime(50, t0);
      o.frequency.exponentialRampToValueAtTime(115, t0 + 1.4);
      o.frequency.linearRampToValueAtTime(100, t0 + len);
      f.frequency.setValueAtTime(380, t0); f.frequency.linearRampToValueAtTime(800, t0 + 1.4);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.055, t0 + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      p.pan.setValueAtTime(0.35, t0); p.pan.linearRampToValueAtTime(0.95, t0 + len);
    }
    o.connect(f).connect(g).connect(p).connect(this.bus.street);
    o.start(t0); o.stop(t0 + len + 0.1);
  }

  /** "Beep-beep!": a jeepney asking for passengers, somewhere down the street. */
  private jeepneyHorn() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02, pan = Math.random() < 0.5 ? -0.6 : 0.6;
    for (const at of [0, 0.3]) {
      for (const freq of [392, 494]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner();
        o.type = "square";
        o.frequency.value = freq;
        f.type = "lowpass"; f.frequency.value = 1500;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(0.012, t0 + at + 0.015);
        g.gain.setValueAtTime(0.012, t0 + at + 0.17);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.22);
        p.pan.value = pan;
        o.connect(f).connect(g).connect(p).connect(this.bus.street);
        o.start(t0 + at); o.stop(t0 + at + 0.25);
      }
    }
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
      o.connect(g).connect(p).connect(this.bus.street);
      o.start(s); o.stop(s + 0.1);
    }
  }

  private update() {
    this.applyMix();
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
    // (off while Spotify is playing: the boss's own music wins)
    const settings = useSettings.getState();
    const musicOn = settings.music && min >= 480 && min < 1140 && !useSpotify.getState().track?.playing;
    this.set(this.music, musicOn ? 0.55 : 0);
    if (musicOn) this.playMusic(settings.musicStyle);
    else this.kicks.length = 0;
    const radio = useRadio.getState();
    if (radio.on !== musicOn || radio.style !== settings.musicStyle) useRadio.setState({ on: musicOn, style: settings.musicStyle });

    // keyboards: each audible desk types in its own bursts, at its own loudness and stereo position
    for (const [id, src] of typingSources) {
      if (src.gain < 0.03) continue;
      const due = this.nextKey.get(id) ?? 0;
      if (now < due) continue;
      this.burst({ dur: 0.03, gain: (0.02 + Math.random() * 0.03) * src.gain, type: "highpass", freq: 2400 + Math.random() * 1500, pan: src.pan, out: this.bus.typing });
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
      if (this.nextCar) {
        this.burst({ dur: 3.2, gain: 0.05, type: "lowpass", freq: 380, attack: 1.4, pan: Math.random() < 0.5 ? -0.7 : 0.7, buf: this.brown });
        if (!night && useSettings.getState().show.traffic && Math.random() < 0.25) setTimeout(() => this.jeepneyHorn(), 1200);
      }
      this.nextCar = now + 14 + Math.random() * 26;
    }
    // the pandesal vendor going by in the early morning: two honks of the bicycle horn, and the call
    if (min >= 300 && min < 540 && useSettings.getState().show.vendors && now >= this.nextCall) {
      if (this.nextCall) this.vendorCall();
      this.nextCall = now + 150 + Math.random() * 120;
    }
    // thunder in storms
    if (weather === "storm" && now >= this.nextThunder) {
      if (this.nextThunder) this.burst({ dur: 3.5, gain: 0.35, type: "lowpass", freq: 140, attack: 0.08, buf: this.brown, out: this.bus.weather });
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
  // Spotify plays through its own player, not this engine, so its beat counts even when the ambience is muted
  const beat = spotifyBeat();
  if (!engine || !playing) return beat;
  const now = engine.now;
  let v = 0;
  for (const t of engine.kicks) {
    const dt = now - t;
    if (dt >= 0 && dt < 0.5) v = Math.max(v, Math.exp(-dt * 11));
  }
  return Math.max(v, beat);
}

/** Each desk's own three-note tune (major pentatonic), so you can tell by ear who needs you. Index = desk order. */
const CHIMES: readonly (readonly number[])[] = [
  [0, 4, 7], [7, 4, 0], [2, 7, 9], [9, 7, 2], [4, 9, 12], [12, 9, 4], [0, 7, 12], [12, 4, 7],
];

/** The boss's car, out front (only heard with the office sound on). The idle keeps running until "stop". */
let carRunning = false;
export function carSound(kind: "start" | "stop" | "lock" | "lights"): void {
  if (kind === "start") carRunning = true;
  if (kind === "stop" || kind === "lock") carRunning = false;
  if (!engine || !playing) return;
  if (kind === "start") engine.engineStart();
  else if (kind === "stop") engine.engineStop();
  else if (kind === "lock") { engine.engineStop(); engine.carLock(); }
  else engine.click();
}

/** The lunch rider's scooter pulling up ("in") or riding off ("out"). */
export function scooterSound(dir: "in" | "out"): void {
  if (engine && playing) engine.scooter(dir);
}

/** Play desk `index`'s chime, if the office sound is on. */
export function playChime(index: number): void {
  if (!engine || !playing) return;
  engine.chime(CHIMES[index % CHIMES.length]);
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
