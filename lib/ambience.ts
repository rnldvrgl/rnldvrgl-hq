"use client";

import { sceneNow, sceneWeather } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { crowing, ROOSTER_COUNT } from "@/lib/rooster";
import { create } from "zustand";
import { useSettings, MUSIC_STYLES, type MixKey, type MusicStyle } from "@/lib/settings";
import { spotifyBeat, useSpotify } from "@/lib/spotify";

/**
 * The office's background sound, from real recordings (public/sounds, all CC0, see CREDITS.md there):
 *   room tone, the aircon during office hours, keyboard clatter from each working desk
 *   (positional: loud when you're zoomed in on that desk, quiet or silent when it's far off or out of view),
 *   birds by day, roosters at dawn, crickets at night, traffic passing now and then, rain when it rains,
 *   heavy rain and thunder in storms. It reads the scene clock and weather, so previews sound right too.
 *   The files load in the background once the sound is first turned on; any that fail to load stay silent.
 *
 * Plus the office sound system (Settings → Sound → Office music): a loop generated live with Web Audio in one
 * of six styles (lo-fi, café jazz, bossa nova, calm piano, synthwave, 8-bit), played during office hours
 * (8 AM – 7 PM). The 3D subwoofer's cone pumps on each kick or bass note (wooferLevel below).
 *
 * And the car and scooters outside: the boss's car starting, idling, stopping and locking, the lunch rider's
 * scooter, and now and then a jeepney's horn.
 *
 * And fireworks over the town on New Year's Eve and fiesta nights: a whistle as each rocket climbs, a boom
 * when it bursts (panned to where it is on screen, softer the farther off), crackle for the glittery ones.
 *
 * Every sound goes through one of the mixer's channels (Settings → Sound → Volume): music, office hum,
 * keyboards, rain & thunder, street & nature, fireworks, alerts, and the overall volume after them.
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

/** White noise for the music's drums (hats, snares, brushes, shakers). */
function whiteNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/* ------------------------------------------------------------------ the recorded sound effects */

/** Every sound effect file in public/sounds (see CREDITS.md there for where each one comes from). */
const SFX = [
  // the beds first, so the room fills in soonest
  "room-loop", "aircon-loop", "rain-loop", "crickets-loop", "storm-loop", "car-idle-loop",
  "rooster-1", "rooster-2", "rooster-3", "rooster-4", "rooster-5", "rooster-6",
  "bird-1", "bird-2", "bird-3", "bird-4",
  "thunder-1", "thunder-2", "keys", "car-pass", "horn-jeepney", "horn-bulb",
  "car-start", "car-stop", "car-lock-beep", "car-lock-clunk", "switch-click", "scooter-in", "scooter-out",
  "fw-boom-1", "fw-boom-2", "fw-boom-3", "fw-boom-4", "fw-whistle-1", "fw-whistle-2", "fw-crackle-1", "fw-crackle-2",
  "chime",
] as const;
type Sfx = (typeof SFX)[number];
type Loop = Extract<Sfx, `${string}-loop`>;

/**
 * The loops' period, seconds. Each file is that long plus a copy of its first 0.3 s, so looping any
 * period-long window that starts in the first 0.3 s is seamless, whatever the MP3 decoder adds at the start.
 */
const LOOP_S: Record<Loop, number> = {
  "crickets-loop": 8, "rain-loop": 8, "storm-loop": 9, "aircon-loop": 8, "room-loop": 7, "car-idle-loop": 6,
};
const LOOP_FROM = 0.15;
/** keys.mp3: single key presses, one every KEY_SLOT seconds. */
const KEY_SLOT = 0.25, KEY_COUNT = 16;
/** The two crows each rooster has (rooster k crows ROOSTER_CROWS[k][0] or [1]), its pitch and where it is. */
const ROOSTER_CROWS: readonly (readonly [Sfx, Sfx])[] = [["rooster-1", "rooster-4"], ["rooster-2", "rooster-5"], ["rooster-3", "rooster-6"]];
const ROOSTER_PAN = [-0.55, 0.15, 0.65];
const BIRDS: readonly Sfx[] = ["bird-1", "bird-2", "bird-3", "bird-4"];
const THUNDER: readonly Sfx[] = ["thunder-1", "thunder-2"];
const WHISTLES: readonly Sfx[] = ["fw-whistle-1", "fw-whistle-2"];
const BOOMS: readonly Sfx[] = ["fw-boom-1", "fw-boom-2", "fw-boom-3", "fw-boom-4"];
const CRACKLES: readonly Sfx[] = ["fw-crackle-1", "fw-crackle-2"];
/** The boss's car is out front, right of the office. */
const CAR_PAN = 0.45;
/** Its idle level. car-start.mp3 and car-stop.mp3 come from the same recording as the idle loop; the start was
 * turned down to 0.266 of the loop's level when it was cut (to fit), so it plays that much louder to match. */
const IDLE = 0.15, START = IDLE / 0.266;

const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const vary = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

export class Ambience {
  private ctx: AudioContext;
  private master: GainNode;
  /** The mixer: one channel per kind of sound, then the overall volume (see applyMix). */
  private bus: Record<MixKey, GainNode>;
  private mixed = "";
  /** Decoded sound effects, as they arrive (see loadSounds). */
  private sounds = new Map<Sfx, AudioBuffer>();
  private loading = false;
  /** Loops waiting for their file: started as soon as it has loaded. */
  private waiting = new Map<Sfx, ((buf: AudioBuffer) => void)[]>();
  private room: GainNode;
  private ac: GainNode;
  private rain: GainNode;
  private storm: GainNode;
  private crickets: GainNode;
  /** The boss's car idling, faded in while the engine runs (see engineStart). */
  private idle: GainNode;
  private white: AudioBuffer;
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
    this.bus = { all, music: channel(), room: channel(), typing: channel(), weather: channel(), street: channel(), fireworks: channel(), alerts: channel() };
    this.applyMix();
    // follow the sliders the moment they move (not just on the next update tick)
    useSettings.subscribe((st, prev) => { if (st.volumes !== prev.volumes) this.applyMix(); });
    this.white = whiteNoise(ctx, 2);

    // the beds: each a recorded loop behind its own fader (set in update), starting once its file is in.
    // Room tone: a soft fan, rounded off so it reads as the room's hush rather than a machine.
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = "lowpass"; roomLp.frequency.value = 900;
    roomLp.connect(this.bus.room);
    this.room = this.bed("room-loop", roomLp, 0.05);
    this.ac = this.bed("aircon-loop", this.bus.room);
    this.rain = this.bed("rain-loop", this.bus.weather);
    this.storm = this.bed("storm-loop", this.bus.weather);
    this.crickets = this.bed("crickets-loop", this.bus.street);
    const carPan = ctx.createStereoPanner();
    carPan.pan.value = CAR_PAN;
    carPan.connect(this.bus.street);
    this.idle = this.bed("car-idle-loop", carPan);

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
    this.loadSounds();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.9, t, 0.6);
    // the car was started while the sound was off: it's idling when you turn the sound on
    this.carOn = carRunning;
    this.idle.gain.cancelScheduledValues(t);
    this.idle.gain.setTargetAtTime(carRunning ? IDLE : 0, t, 0.3);
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
    for (const k of Object.keys(this.bus) as MixKey[]) {
      this.bus[k].gain.cancelScheduledValues(t);
      this.bus[k].gain.setTargetAtTime(this.level(k), t, 0.03);
    }
  }

  private set(g: GainNode, v: number) {
    g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.8);
  }

  /** A short filtered noise burst, for the music's drums. */
  private burst(opts: { dur: number; gain: number; type: BiquadFilterType; freq: number; q?: number; attack?: number; out: AudioNode; at: number }) {
    const ctx = this.ctx, t = opts.at;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = ctx.createBiquadFilter();
    f.type = opts.type; f.frequency.value = opts.freq; f.Q.value = opts.q ?? 0.7;
    const g = ctx.createGain();
    const a = opts.attack ?? 0.002;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(opts.gain, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f).connect(g).connect(opts.out);
    src.start(t, Math.random());
    src.stop(t + opts.dur + 0.05);
  }

  /* -------------------------------------------------------------- playing the recordings */

  /** Fetch and decode every effect in the background, a few at a time (once). A file that fails stays silent. */
  private loadSounds() {
    if (this.loading) return;
    this.loading = true;
    const todo = [...SFX];
    const next = async (): Promise<void> => {
      const name = todo.shift();
      if (!name) return;
      try {
        const res = await fetch(`/sounds/${name}.mp3`);
        if (!res.ok) throw new Error(`${res.status}`);
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.sounds.set(name, buf);
        const waiting = this.waiting.get(name);
        this.waiting.delete(name);
        waiting?.forEach((go) => go(buf));
      } catch { /* missing or undecodable: that effect just stays silent */ }
      return next();
    };
    for (let i = 0; i < 4; i++) void next();
  }

  /**
   * Play a recording once (nothing if its file hasn't loaded, or failed to). `at` is the audio time, `rate` the
   * speed (and pitch), `pan` −1…1 or [from, to] to sweep across while it plays, `offset`/`dur` a slice of the file.
   */
  private play(name: Sfx, o: { out: AudioNode; gain: number; at?: number; rate?: number; pan?: number | readonly [number, number]; offset?: number; dur?: number }): { src: AudioBufferSourceNode; gain: GainNode } | null {
    const buf = this.sounds.get(name);
    if (!buf) return null;
    const ctx = this.ctx, t = Math.max(o.at ?? 0, ctx.currentTime), rate = o.rate ?? 1, offset = o.offset ?? 0;
    const src = ctx.createBufferSource(), gain = ctx.createGain(), p = ctx.createStereoPanner();
    src.buffer = buf;
    src.playbackRate.value = rate;
    gain.gain.value = o.gain;
    if (typeof o.pan === "number" || o.pan === undefined) p.pan.value = Math.max(-1, Math.min(1, o.pan ?? 0));
    else {
      p.pan.setValueAtTime(o.pan[0], t);
      p.pan.linearRampToValueAtTime(o.pan[1], t + (o.dur ?? buf.duration - offset) / rate);
    }
    src.connect(gain).connect(p).connect(o.out);
    if (o.dur === undefined) src.start(t, offset);
    else src.start(t, offset, o.dur);
    return { src, gain };
  }

  /** A looping recording behind its own fader, silent until `level` is set; the loop joins in once its file is in. */
  private bed(name: Loop, out: AudioNode, level = 0): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = level;
    g.connect(out);
    const go = (buf: AudioBuffer) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = LOOP_FROM;
      src.loopEnd = LOOP_FROM + LOOP_S[name];
      src.connect(g);
      src.start(0, LOOP_FROM + Math.random() * LOOP_S[name]);
    };
    const buf = this.sounds.get(name);
    if (buf) go(buf);
    else this.waiting.set(name, [...(this.waiting.get(name) ?? []), go]);
    return g;
  }

  /** Two honks of the rubber bulb horn, then "Pandesal! Mainit pa!" (the browser's voice, in Filipino if it has one). */
  private vendorCall() {
    const t0 = this.ctx.currentTime + 0.02, rate = vary(0.05);
    for (const at of [0, 0.42]) this.play("horn-bulb", { out: this.bus.street, gain: 0.08, at: t0 + at, pan: 0.5, rate });
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance("Pandesal! Mainit pa!");
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fil") || v.lang.startsWith("tl"));
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? "fil-PH";
      u.rate = 0.95; u.pitch = 1.15; u.volume = Math.min(1, 0.35 * this.level("street"));
      setTimeout(() => window.speechSynthesis.speak(u), 900);
    } catch { /* no voice: the horn is enough */ }
  }

  /**
   * A three-note motif on a music-box note (semitones above A4, one every 0.16 s), on the Alerts channel so music
   * settings don't mute it. The recording is a C, so each note is that C sped up or slowed down.
   */
  chime(notes: readonly number[]) {
    const t0 = this.ctx.currentTime + 0.02;
    notes.forEach((n, i) => this.play("chime", { out: this.bus.alerts, gain: 0.2, at: t0 + i * 0.16, rate: 2 ** ((n - 3) / 12) }));
  }

  /* -------------------------------------------------------------- the car and scooters outside */

  /** Whether the boss's car is running, as far as this engine has heard (so "lock" on a parked car is silent). */
  private carOn = false;

  /** Key turned: the starter cranks, the engine catches and settles, and the idle loop takes over. */
  engineStart() {
    const t0 = this.ctx.currentTime + 0.05;
    this.carOn = true;
    this.play("car-start", { out: this.bus.street, gain: START, at: t0, pan: CAR_PAN });
    // car-start.mp3 has settled to idle by ~3 s and fades out over its last 0.8 s, under the loop fading in
    this.idle.gain.cancelScheduledValues(t0);
    this.idle.gain.setValueAtTime(0, t0);
    this.idle.gain.setTargetAtTime(IDLE, t0 + 3.0, 0.25);
  }

  /** Engine off: the idle hands over to the recording of that same engine being switched off. */
  engineStop() {
    if (!this.carOn) return;
    this.carOn = false;
    const t = this.ctx.currentTime;
    this.idle.gain.cancelScheduledValues(t);
    this.idle.gain.setTargetAtTime(0, t + 0.02, 0.05);
    this.play("car-stop", { out: this.bus.street, gain: IDLE, at: t, pan: CAR_PAN });
  }

  /** Remote lock: the doors' clunk and the beep. */
  carLock() {
    const t0 = this.ctx.currentTime + 0.02;
    this.play("car-lock-clunk", { out: this.bus.street, gain: 0.12, at: t0, pan: CAR_PAN });
    this.play("car-lock-beep", { out: this.bus.street, gain: 0.1, at: t0 + 0.12, pan: CAR_PAN });
  }

  /** A switch click (headlights). */
  click() {
    this.play("switch-click", { out: this.bus.street, gain: 0.1, pan: CAR_PAN });
  }

  /** Fireworks voices still sounding (audio-clock end times), so a barrage never piles up past a few at once. */
  private fwVoices: number[] = [];
  private fwVoice(len: number, max: number): boolean {
    const now = this.ctx.currentTime;
    this.fwVoices = this.fwVoices.filter((t) => t > now);
    if (this.fwVoices.length >= max) return false;
    this.fwVoices.push(now + len);
    return true;
  }

  /**
   * One firework. "launch": a rocket's whistle, fitted to the climb (`len` seconds) and cut at the burst.
   * "burst": a boom (a beat after the flash when it's far off; bigger shells deeper) and, when `crackle`, the
   * crackle of the falling stars. `pan` −1…1 is where it is on screen and `gain` 0…1 how near it is.
   */
  firework(kind: "launch" | "burst", o: { pan: number; gain: number; len?: number; crackle?: boolean; big?: boolean }) {
    const ctx = this.ctx, v = Math.max(0, Math.min(1, o.gain));
    if (v < 0.02) return;
    const pan = Math.max(-0.95, Math.min(0.95, o.pan));
    const out = this.bus.fireworks;
    if (kind === "launch") {
      const len = o.len ?? 0.9;
      if (!this.fwVoice(len, 6)) return;
      const name = pick(WHISTLES);
      const full = this.sounds.get(name)?.duration ?? 1.25;
      const t0 = ctx.currentTime + 0.01;
      const s = this.play(name, { out, gain: 0.06 * v, at: t0, pan, rate: Math.min(1.3, Math.max(0.8, full / len)) * vary(0.04) });
      if (s) { s.gain.gain.setTargetAtTime(0, t0 + len - 0.06, 0.03); s.src.stop(t0 + len + 0.2); }
      return;
    }
    // the boom, a little behind the flash when it's far off (sound trails light)
    if (!this.fwVoice(o.crackle ? 1.8 : 1.4, o.big ? 10 : 8)) return;
    const t0 = ctx.currentTime + 0.02 + (1 - v) * 0.25;
    this.play(pick(BOOMS), { out, gain: (o.big ? 0.45 : 0.32) * v, at: t0, pan, rate: (o.big ? 0.85 : 0.97) * vary(0.06) });
    if (o.crackle) {
      this.play(pick(CRACKLES), { out, gain: 0.22 * v, at: t0 + 0.3 + Math.random() * 0.25, pan: pan + (Math.random() - 0.5) * 0.3, rate: vary(0.08) });
    }
  }

  /** A scooter: "in" rides up and stops at the kerb, "out" pulls away and fades down the street. */
  scooter(dir: "in" | "out") {
    if (dir === "in") this.play("scooter-in", { out: this.bus.street, gain: 0.1, pan: [-0.9, 0.35] });
    else this.play("scooter-out", { out: this.bus.street, gain: 0.1, pan: [0.35, 0.95] });
  }

  /** "Beep-beep!": a jeepney asking for passengers, somewhere down the street. */
  private jeepneyHorn() {
    this.play("horn-jeepney", { out: this.bus.street, gain: 0.06 * vary(0.15), rate: vary(0.06), pan: Math.random() < 0.5 ? -0.6 : 0.6 });
  }

  /** A rooster's crow (the tilaok). `k` picks the bird: its own two recorded crows, its loudness and where it is. */
  crow(k: number) {
    const crows = ROOSTER_CROWS[k % ROOSTER_CROWS.length];
    this.play(crows[Math.random() < 0.6 ? 0 : 1], { out: this.bus.street, gain: 0.22 * [1, 0.85, 0.75][k % 3] * vary(0.1), pan: ROOSTER_PAN[k % 3], rate: vary(0.025) });
  }

  private crowed: boolean[] = [];

  private update() {
    this.applyMix();
    const now = performance.now() / 1000;
    const min = manilaMinutes(sceneNow());
    const night = min < 360 || min >= 1110;
    const weather = sceneWeather();
    const raining = weather === "rain" || weather === "storm";

    this.set(this.ac, min >= 480 && min < 1140 ? 0.05 : 0);
    this.set(this.rain, raining ? 0.08 : 0);
    this.set(this.storm, weather === "storm" ? 0.1 : 0);
    this.set(this.crickets, night && !raining ? 0.03 : 0);
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
      const key = Math.floor(Math.random() * KEY_COUNT);
      this.play("keys", { out: this.bus.typing, gain: (0.05 + Math.random() * 0.05) * src.gain, pan: src.pan, rate: vary(0.06), offset: key * KEY_SLOT, dur: KEY_SLOT });
      const pause = Math.random() < 0.08 ? 0.6 + Math.random() * 1.2 : 0.07 + Math.random() * 0.15;
      this.nextKey.set(id, now + pause);
    }
    // birds by day (not in the rain)
    if (!night && !raining && now >= this.nextBird) {
      if (this.nextBird) this.play(pick(BIRDS), { out: this.bus.street, gain: 0.07 * vary(0.3), pan: Math.random() * 1.6 - 0.8, rate: vary(0.06) });
      this.nextBird = now + 5 + Math.random() * 12;
    }
    // the roosters in the yards behind the office, in step with the birds in the scene
    for (let k = 0; k < ROOSTER_COUNT; k++) {
      const c = crowing(sceneNow(), k);
      if (c !== null && c < 0.4 && !this.crowed[k] && !raining) this.crow(k);
      this.crowed[k] = c !== null;
    }
    // a car or jeepney going by, one way or the other
    if (now >= this.nextCar) {
      if (this.nextCar) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        this.play("car-pass", { out: this.bus.street, gain: 0.12 * vary(0.2), rate: vary(0.08), pan: [-0.8 * dir, 0.8 * dir] });
        if (!night && useSettings.getState().show.traffic && Math.random() < 0.25) setTimeout(() => this.jeepneyHorn(), 3000);
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
      if (this.nextThunder) this.play(pick(THUNDER), { out: this.bus.weather, gain: 0.35 * vary(0.25), rate: vary(0.1), pan: Math.random() * 0.8 - 0.4 });
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

/** A firework over the town (Holidays.tsx): only heard with the office sound on. See Ambience.firework. */
export function fireworkSound(kind: "launch" | "burst", o: { pan: number; gain: number; len?: number; crackle?: boolean; big?: boolean }): void {
  if (engine && playing) engine.firework(kind, o);
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
