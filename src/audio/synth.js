// Procedural music renderer (pure JavaScript DSP, no Web Audio dependency).
//
// Songs are described as data (tempo, key, chord progressions, section layout). The
// composer turns a song into note events; each distinct note is synthesised once into
// a cached sample and then mixed, so a full track renders in a fraction of a second.
// Runs inside a Web Worker in the browser and directly in Node for tests.
// All music in the game is original and generated at runtime -- no audio files ship.

import { makeRng, hashString } from '../core/math.js';

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

/** Which parts play in each section type and their level (0..1). */
const SECTION_PARTS = {
  intro: { pad: 0.8, arp: 0.5, hat: 0.4, kick: 0, snare: 0, bass: 0, lead: 0, sub: 0.4, energy: 0.25 },
  verse: { pad: 0.5, arp: 0.8, hat: 0.7, kick: 1, snare: 0.8, bass: 0.8, lead: 0, sub: 0, energy: 0.55 },
  build: { pad: 0.6, arp: 1, hat: 0.8, kick: 1, snare: 1, bass: 0.5, lead: 0, riser: 1, sub: 0, energy: 0.7 },
  drop: { pad: 0.6, arp: 0.6, hat: 1, kick: 1, snare: 1, bass: 1, lead: 1, sub: 0, energy: 1 },
  break: { pad: 1, arp: 0.6, hat: 0.3, kick: 0, snare: 0, bass: 0, lead: 0.6, sub: 0.6, energy: 0.35 },
  bridge: { pad: 0.7, arp: 1, hat: 0.8, kick: 1, snare: 0.5, bass: 0.9, lead: 0.5, sub: 0, energy: 0.65 },
  outro: { pad: 0.8, arp: 0.5, hat: 0.6, kick: 1, snare: 0.4, bass: 0.5, lead: 0, sub: 0, energy: 0.4 },
  loop: { pad: 0.8, arp: 0.7, hat: 0.6, kick: 0.7, snare: 0.4, bass: 0.6, lead: 0.4, sub: 0, energy: 0.45 },
};

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function songDuration(song) {
  const bars = song.sections.reduce((n, s) => n + s.bars, 0);
  return (bars * 4 * 60) / song.bpm;
}

/** Section timeline: [{type, start, end, energy}] in seconds. */
export function songSections(song) {
  const spb = 60 / song.bpm;
  let t = 0;
  return song.sections.map((s) => {
    const start = t;
    t += s.bars * 4 * spb;
    return { type: s.type, start, end: t, energy: (SECTION_PARTS[s.type] || SECTION_PARTS.verse).energy };
  });
}

// ------------------------------------------------------------------ DSP primitives

const SINE = new Float32Array(4097);
for (let i = 0; i <= 4096; i++) SINE[i] = Math.sin((i / 4096) * Math.PI * 2);
const sinp = (phase) => {
  // phase in cycles
  const p = (phase - Math.floor(phase)) * 4096;
  const i = p | 0;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * (p - i);
};

function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/** Band-limited oscillator sample for waveform at phase (cycles) with increment dt. */
function osc(wave, phase, dt) {
  const t = phase - Math.floor(phase);
  switch (wave) {
    case 'sine':
      return sinp(t);
    case 'triangle':
      return t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
    case 'square': {
      let v = t < 0.5 ? 1 : -1;
      v += polyBlep(t, dt);
      v -= polyBlep((t + 0.5) % 1, dt);
      return v * 0.7;
    }
    default: // sawtooth
      return 2 * t - 1 - polyBlep(t, dt);
  }
}

/** Chamberlin state-variable low-pass filter. */
class Svf {
  constructor() {
    this.low = 0;
    this.band = 0;
  }
  process(x, f, q) {
    this.low += f * this.band;
    const high = x - this.low - q * this.band;
    this.band += f * high;
    return this.low;
  }
}
const svfF = (fc, sr) => 2 * Math.sin((Math.PI * Math.min(fc, sr * 0.22)) / sr);

function makeNoise(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

// ------------------------------------------------------------------ instruments

/** Instrument sample generators. Each returns a mono Float32Array. */
function makeInstruments(sr) {
  const S = (sec) => Math.max(1, Math.ceil(sec * sr));
  const cache = new Map();
  const memo = (key, fn) => {
    let v = cache.get(key);
    if (!v) {
      v = fn();
      cache.set(key, v);
    }
    return v;
  };

  const kick = () => memo('kick', () => {
    const n = S(0.42);
    const out = new Float32Array(n);
    let ph = 0;
    const noise = makeNoise(3);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = 38 + 122 * Math.exp(-t * 28);
      ph += f / sr;
      const env = t < 0.004 ? t / 0.004 : Math.exp(-(t - 0.004) * 9);
      let v = sinp(ph) * env;
      if (t < 0.012) v += noise() * 0.25 * (1 - t / 0.012);
      out[i] = v;
    }
    return out;
  });

  const snare = () => memo('snare', () => {
    const n = S(0.24);
    const out = new Float32Array(n);
    const noise = makeNoise(5);
    let hp = 0, prev = 0, ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const x = noise();
      hp = 0.82 * (hp + x - prev);
      prev = x;
      ph += (220 - 70 * Math.min(1, t / 0.08)) / sr;
      out[i] = hp * 0.6 * Math.exp(-t * 17) + sinp(ph) * 0.4 * Math.exp(-t * 30);
    }
    return out;
  });

  const clap = () => memo('clap', () => {
    const n = S(0.26);
    const out = new Float32Array(n);
    const noise = makeNoise(7);
    const f = new Svf();
    const ff = svfF(1400, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let env;
      if (t < 0.033) env = 0.55 * Math.exp(-((t % 0.011) / 0.004));
      else env = 0.5 * Math.exp(-(t - 0.033) * 14);
      f.process(noise(), ff, 1.1);
      out[i] = f.band * env * 2.2;
    }
    return out;
  });

  const hat = (open) => memo('hat' + (open ? 'o' : 'c'), () => {
    const len = open ? 0.24 : 0.05;
    const n = S(len);
    const out = new Float32Array(n);
    const noise = makeNoise(open ? 11 : 13);
    let hp = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const x = noise();
      hp = 0.35 * (hp + x - prev);
      prev = x;
      out[i] = hp * 0.5 * Math.exp(-t * (open ? 14 : 70));
    }
    return out;
  });

  const crash = () => memo('crash', () => {
    const n = S(1.9);
    const out = new Float32Array(n);
    const noise = makeNoise(17);
    let hp = 0, prev = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const x = noise();
      hp = 0.6 * (hp + x - prev);
      prev = x;
      out[i] = hp * 0.32 * Math.exp(-t * 2.6);
    }
    return out;
  });

  const riser = (dur) => memo('riser' + dur.toFixed(2), () => {
    const n = S(dur + 0.05);
    const out = new Float32Array(n);
    const noise = makeNoise(19);
    const f = new Svf();
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const k = Math.min(1, t / dur);
      if ((i & 15) === 0) f.ff = svfF(400 * Math.pow(22, k), sr);
      f.process(noise(), f.ff, 0.6);
      const env = t > dur ? Math.max(0, 1 - (t - dur) / 0.05) : k * k;
      out[i] = f.band * 0.3 * env;
    }
    return out;
  });

  const bass = (midi, dur, wave) => memo(`bass${midi}|${dur.toFixed(3)}|${wave}`, () => {
    const n = S(dur + 0.05);
    const out = new Float32Array(n);
    const f = new Svf();
    const hz = midiToHz(midi), dt = hz / sr;
    let ph = 0, ph2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if ((i & 7) === 0) {
        const cut = t < 0.012 ? 180 + (1800 - 180) * (t / 0.012) : 220 + 1580 * Math.exp(-(t - 0.012) * 14);
        f.ff = svfF(cut, sr);
      }
      ph += dt;
      ph2 += dt * 0.5;
      const env = (t < 0.005 ? t / 0.005 : 1) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.05) : 1);
      const v = f.process(osc(wave, ph, dt), f.ff, 0.35) * 0.55 + sinp(ph2) * 0.45;
      out[i] = v * env * 0.75;
    }
    return out;
  });

  const pluck = (midi, dur, bright, wave) => memo(`pl${midi}|${dur.toFixed(3)}|${bright}|${wave}`, () => {
    const len = Math.max(0.14, dur * 1.25);
    const n = S(len);
    const out = new Float32Array(n);
    const f = new Svf();
    const hz = midiToHz(midi), dt = hz / sr;
    let ph = 0;
    const top = 600 + 4200 * (bright / 8);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if ((i & 7) === 0) f.ff = svfF(400 + (top - 400) * Math.exp(-t * 16), sr);
      ph += dt;
      const env = (t < 0.004 ? t / 0.004 : 1) * Math.exp(-t * (4 / len));
      out[i] = f.process(osc(wave, ph, dt), f.ff, 0.5) * env * 0.38;
    }
    return out;
  });

  const lead = (midi, dur, wave) => memo(`ld${midi}|${dur.toFixed(3)}|${wave}`, () => {
    const n = S(dur + 0.16);
    const out = new Float32Array(n);
    const f = new Svf();
    const hz = midiToHz(midi);
    const d1 = (hz * Math.pow(2, -9 / 1200)) / sr, d2 = (hz * Math.pow(2, 9 / 1200)) / sr;
    let p1 = 0, p2 = 0.37;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if ((i & 15) === 0) f.ff = svfF(2400 + 2800 * Math.exp(-t * 3), sr);
      p1 += d1;
      p2 += d2;
      const vib = t > 0.15 ? 1 : 0;
      const a = t < 0.01 ? t / 0.01 : 1;
      const d = 0.75 + 0.25 * Math.exp(-t * 6);
      const r = t > dur ? Math.max(0, 1 - (t - dur) / 0.15) : 1;
      const v = osc(wave, p1 + vib * 0.002 * sinp(t * 5.5), d1) + osc(wave, p2, d2);
      out[i] = f.process(v, f.ff, 0.6) * a * d * r * 0.2;
    }
    return out;
  });

  const pad = (notes, dur) => memo(`pad${notes.join(',')}|${dur.toFixed(2)}`, () => {
    const n = S(dur + 0.7);
    const out = new Float32Array(n);
    const f = new Svf();
    const ff = svfF(1800, sr);
    const voices = [];
    for (const m of notes) for (const det of [-12, 7]) voices.push({ d: (midiToHz(m) * Math.pow(2, det / 1200)) / sr, p: ((m * 7 + det) % 13) / 13 });
    const att = Math.min(0.6, dur * 0.3);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let v = 0;
      for (const vo of voices) {
        vo.p += vo.d;
        v += osc('sawtooth', vo.p, vo.d);
      }
      const env = (t < att ? t / att : 1) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.7) : 1);
      out[i] = f.process(v, ff, 0.9) * env * 0.07;
    }
    return out;
  });

  const sub = (midi, dur) => memo(`sub${midi}|${dur.toFixed(2)}`, () => {
    const n = S(dur + 0.4);
    const out = new Float32Array(n);
    const dt = midiToHz(midi) / sr;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += dt;
      const env = (t < 0.2 ? t / 0.2 : 1) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.4) : 1);
      out[i] = sinp(ph) * env * 0.3;
    }
    return out;
  });

  return { kick, snare, clap, hat, crash, riser, bass, pluck, lead, pad, sub };
}

// ------------------------------------------------------------------ composition

function chordNotes(song, degree) {
  const scale = SCALES[song.scale] || SCALES.minor;
  const n = scale.length;
  const note = (deg) => {
    const o = Math.floor(deg / n);
    const i = ((deg % n) + n) % n;
    return song.root + scale[i] + 12 * o;
  };
  return [note(degree), note(degree + 2), note(degree + 4), note(degree + 6)];
}

function scaleNote(song, degree, octave = 0) {
  const scale = SCALES[song.scale] || SCALES.minor;
  const n = scale.length;
  const o = Math.floor(degree / n);
  const i = ((degree % n) + n) % n;
  return song.root + scale[i] + 12 * (o + octave);
}

function makeMotif(rng, steps = 16, density = 0.55) {
  const motif = [];
  let deg = rng.int(0, 4);
  for (let i = 0; i < steps; i++) {
    const strong = i % 4 === 0;
    const play = strong ? rng() < 0.85 : rng() < density * (i % 2 === 0 ? 0.9 : 0.55);
    if (!play) continue;
    const move = rng.pick([-2, -1, -1, 0, 1, 1, 2, 3, -3]);
    deg = Math.max(-2, Math.min(9, deg + move));
    let len = 1;
    while (len < 4 && i + len < steps && rng() < 0.35) len++;
    motif.push({ step: i, deg: strong ? rng.pick([0, 2, 4, deg]) : deg, len });
  }
  return motif;
}

/**
 * Turn a song description into timed note events.
 * Event: {i: instrument, t: seconds, g: gain, pan, bus: 'drum'|'mel', send: reverb, dly: delay, args}
 */
export function composeSong(song) {
  const rng = makeRng(song.seed ?? hashString(song.id));
  const spb = 60 / song.bpm;
  const s16 = spb / 4;
  const motifA = makeMotif(rng, 16, song.density ?? 0.55);
  const motifB = makeMotif(rng, 16, song.density ?? 0.55);
  const arpPattern = song.arp || rng.pick(['up', 'updown', 'skip', 'random']);
  const arpOrder = {
    up: [0, 1, 2, 3, 0, 1, 2, 3],
    updown: [0, 1, 2, 3, 2, 1, 0, 1],
    skip: [0, 2, 1, 3, 0, 2, 3, 1],
    random: Array.from({ length: 8 }, () => rng.int(0, 3)),
  }[arpPattern];
  const bassPattern = song.bassPattern || 'offbeat';
  const ev = [];
  const kicks = [];
  const add = (e) => ev.push(e);

  let t0 = 0;
  for (const sec of song.sections) {
    const parts = { ...(SECTION_PARTS[sec.type] || SECTION_PARTS.verse), ...(sec.parts || {}) };
    const prog = song.progressions[sec.prog || 'A'];
    if (sec.type === 'drop' || sec.type === 'verse') add({ i: 'crash', t: t0, g: sec.type === 'drop' ? 1 : 0.6, pan: 0, bus: 'drum', send: 0.3 });
    if (parts.riser) add({ i: 'riser', t: t0, g: 1, pan: 0, bus: 'drum', send: 0.3, args: [sec.bars * 4 * spb] });
    for (let b = 0; b < sec.bars; b++) {
      const tb = t0 + b * 4 * spb;
      const degree = prog[b % prog.length];
      const chord = chordNotes(song, degree);
      const lastBars = sec.bars - b;
      for (let st = 0; st < 16; st++) {
        const t = tb + st * s16 + (st % 2 === 1 ? (song.swing || 0) * s16 : 0);
        if (parts.kick) {
          const four = st % 4 === 0;
          const roll = sec.type === 'build' && lastBars <= 1 && st % 2 === 0;
          if (four || roll) {
            add({ i: 'kick', t, g: parts.kick * (roll && !four ? 0.6 : 1), pan: 0, bus: 'drum' });
            if (four) kicks.push(t);
          }
        }
        if (parts.snare) {
          if (sec.type === 'build') {
            const rate = lastBars <= 1 ? 1 : lastBars <= 2 ? 2 : 4;
            if (st % rate === 0) add({ i: 'snare', t, g: 0.35 + 0.65 * (1 - lastBars / sec.bars), pan: 0, bus: 'drum', send: 0.15 });
          } else if (st === 4 || st === 12) add({ i: song.clap === false ? 'snare' : 'clap', t, g: parts.snare, pan: 0, bus: 'drum', send: 0.25 });
        }
        if (parts.hat) {
          const dense = parts.hat >= 0.9;
          if (dense ? st % 2 === 0 || st % 4 === 3 : st % 4 === 2) {
            add({ i: 'hat', t, g: parts.hat * (st % 4 === 2 ? 1 : 0.55), pan: 0.25, bus: 'drum', args: [st === 14 && dense] });
          }
        }
      }
      if (parts.bass) {
        const root = chord[0] - 24;
        for (let st = 0; st < 16; st++) {
          const t = tb + st * s16;
          if (bassPattern === 'rolling' || sec.type === 'drop') {
            if (st % 4 !== 0) add({ i: 'bass', t, g: parts.bass, pan: 0, bus: 'mel', args: [root + (st % 8 === 6 ? 12 : 0), s16 * 0.9, song.bassWave || 'sawtooth'] });
          } else if (st % 4 === 2) add({ i: 'bass', t, g: parts.bass, pan: 0, bus: 'mel', args: [root, s16 * 1.8, song.bassWave || 'sawtooth'] });
        }
      }
      if (parts.sub) add({ i: 'sub', t: tb, g: parts.sub, pan: 0, bus: 'mel', args: [chord[0] - 24, 4 * spb * 0.98] });
      if (parts.pad) add({ i: 'pad', t: tb, g: parts.pad, pan: 0, bus: 'mel', send: 0.5, args: [chord.slice(0, 3).map((n) => n + 12), 4 * spb * 0.98] });
      if (parts.arp) {
        const bright = sec.type === 'build' ? (b + 1) / sec.bars : sec.type === 'intro' ? 0.25 + 0.5 * (b / sec.bars) : 0.6;
        for (let st = 0; st < 16; st++) {
          if (sec.type === 'intro' && st % 2 === 1) continue;
          const n = chord[arpOrder[st % 8]] + 12 + (st >= 8 && song.arpOctave ? 12 : 0);
          add({ i: 'pluck', t: tb + st * s16, g: parts.arp * 0.8, pan: st % 2 ? 0.35 : -0.35, bus: 'mel', send: 0.25, dly: 0.35,
            args: [n, s16 * 0.9, Math.round(bright * 8), song.pluckWave || 'square'] });
        }
      }
      if (parts.lead) {
        const phrase = Math.floor(b / 2) % 4;
        const motif = phrase === 2 ? motifB : motifA;
        for (const n of motif) {
          const dg = degree + n.deg + (phrase === 3 && n.step >= 12 ? 2 : 0);
          add({ i: 'lead', t: tb + n.step * s16, g: parts.lead, pan: -0.1, bus: 'mel', send: 0.3, dly: 0.3,
            args: [scaleNote(song, dg, 1), n.len * s16 * 0.92, song.leadWave || 'sawtooth'] });
        }
      }
    }
    t0 += sec.bars * 4 * spb;
  }
  return { events: ev, kicks, duration: t0 };
}

// ------------------------------------------------------------------ effects

class Reverb {
  constructor(sr, spread) {
    const sc = sr / 44100;
    this.combs = [1116, 1188, 1277, 1356].map((l) => ({ buf: new Float32Array(Math.round((l + spread) * sc)), i: 0, store: 0 }));
    this.aps = [556, 441].map((l) => ({ buf: new Float32Array(Math.round((l + spread) * sc)), i: 0 }));
  }
  process(x) {
    let out = 0;
    for (const c of this.combs) {
      const y = c.buf[c.i];
      c.store = y * 0.75 + c.store * 0.25; // damping
      c.buf[c.i] = x + c.store * 0.82;
      if (++c.i >= c.buf.length) c.i = 0;
      out += y;
    }
    for (const a of this.aps) {
      const b = a.buf[a.i];
      const y = -out + b;
      a.buf[a.i] = out + b * 0.5;
      if (++a.i >= a.buf.length) a.i = 0;
      out = y;
    }
    return out * 0.25;
  }
}

// ------------------------------------------------------------------ render

/**
 * Render a song to stereo PCM.
 * @returns {{left: Float32Array, right: Float32Array, sampleRate: number, duration: number}}
 */
export function renderSongPCM(song, { sampleRate = 44100, loop = false } = {}) {
  const sr = sampleRate;
  const comp = composeSong(song);
  const tail = 2.5;
  const len = Math.ceil((comp.duration + tail) * sr);
  const drumL = new Float32Array(len), drumR = new Float32Array(len);
  const melL = new Float32Array(len), melR = new Float32Array(len);
  const rvSend = new Float32Array(len);
  const dlSend = new Float32Array(len);
  const inst = makeInstruments(sr);

  for (const e of comp.events) {
    let smp;
    switch (e.i) {
      case 'kick': smp = inst.kick(); break;
      case 'snare': smp = inst.snare(); break;
      case 'clap': smp = inst.clap(); break;
      case 'hat': smp = inst.hat(e.args[0]); break;
      case 'crash': smp = inst.crash(); break;
      case 'riser': smp = inst.riser(e.args[0]); break;
      case 'bass': smp = inst.bass(...e.args); break;
      case 'pluck': smp = inst.pluck(...e.args); break;
      case 'lead': smp = inst.lead(...e.args); break;
      case 'pad': smp = inst.pad(...e.args); break;
      case 'sub': smp = inst.sub(...e.args); break;
      default: continue;
    }
    const start = Math.round(e.t * sr);
    const gl = e.g * Math.min(1, 1 - e.pan), gr = e.g * Math.min(1, 1 + e.pan);
    const L = e.bus === 'drum' ? drumL : melL, R = e.bus === 'drum' ? drumR : melR;
    const send = e.send || 0, dly = e.dly || 0;
    const n = Math.min(smp.length, len - start);
    for (let k = 0; k < n; k++) {
      const v = smp[k];
      const j = start + k;
      L[j] += v * gl;
      R[j] += v * gr;
    }
    if (send || dly) {
      for (let k = 0; k < n; k++) {
        const v = smp[k] * e.g;
        if (send) rvSend[start + k] += v * send;
        if (dly) dlSend[start + k] += v * dly;
      }
    }
  }

  // sidechain pump on the melodic bus
  const pump = new Float32Array(len).fill(1);
  const pumpLen = Math.round((60 / song.bpm) * 0.55 * sr);
  for (const kt of comp.kicks) {
    const s0 = Math.round(kt * sr);
    for (let k = 0; k < pumpLen && s0 + k < len; k++) pump[s0 + k] = Math.min(pump[s0 + k], 0.32 + 0.68 * (k / pumpLen));
  }

  // effects + master
  const left = new Float32Array(len), right = new Float32Array(len);
  const rvL = new Reverb(sr, 0), rvR = new Reverb(sr, 23);
  const dTime = Math.round((60 / song.bpm) * 0.75 * sr);
  const dBufL = new Float32Array(dTime), dBufR = new Float32Array(dTime);
  let di = 0;
  const master = song.gain ?? 0.9;
  for (let j = 0; j < len; j++) {
    const p = pump[j];
    const dl = dBufL[di], dr = dBufR[di];
    // ping-pong delay
    dBufL[di] = dlSend[j] + dr * 0.32;
    dBufR[di] = dl * 0.32;
    if (++di >= dTime) di = 0;
    const rs = rvSend[j];
    const wl = rvL.process(rs), wr = rvR.process(rs);
    let l = drumL[j] + (melL[j] + dl * 0.6) * p + wl * 0.9;
    let r = drumR[j] + (melR[j] + dr * 0.6) * p + wr * 0.9;
    l *= master;
    r *= master;
    // soft limiter
    left[j] = l / (1 + Math.abs(l) * 0.6);
    right[j] = r / (1 + Math.abs(r) * 0.6);
  }

  if (!loop) return { left, right, sampleRate: sr, duration: comp.duration };
  const loopLen = Math.floor(comp.duration * sr);
  const L2 = left.slice(0, loopLen), R2 = right.slice(0, loopLen);
  for (let j = loopLen; j < len; j++) {
    L2[j - loopLen] += left[j];
    R2[j - loopLen] += right[j];
  }
  return { left: L2, right: R2, sampleRate: sr, duration: comp.duration };
}
