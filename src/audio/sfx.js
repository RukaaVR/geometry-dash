// Procedurally generated sound effects, pre-rendered once into small buffers so
// playback is a single cheap BufferSource with no runtime synthesis cost.

const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return b;
}

function tone(ctx, out, { t = 0, type = 'sine', f0, f1 = f0, dur, vol = 0.3, attack = 0.003, curve = 'exp' }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) {
    if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    else o.frequency.linearRampToValueAtTime(f1, t + dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(ctx, out, { t = 0, dur, vol = 0.3, type = 'lowpass', f0 = 2000, f1 = f0, q = 1 }) {
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, dur + 0.05);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f);
  f.connect(g);
  g.connect(out);
  n.start(t);
}

const RECIPES = {
  death: (c, o) => {
    noise(c, o, { dur: 0.45, vol: 0.55, f0: 5000, f1: 200 });
    tone(c, o, { type: 'square', f0: 220, f1: 40, dur: 0.35, vol: 0.25 });
    tone(c, o, { type: 'sine', f0: 90, f1: 30, dur: 0.4, vol: 0.5 });
  },
  orb: (c, o) => {
    tone(c, o, { type: 'sine', f0: midiToHz(84), dur: 0.25, vol: 0.18 });
    tone(c, o, { type: 'triangle', f0: midiToHz(91), dur: 0.18, vol: 0.08, t: 0.01 });
  },
  pad: (c, o) => {
    tone(c, o, { type: 'triangle', f0: 180, f1: 720, dur: 0.18, vol: 0.22, curve: 'lin' });
    noise(c, o, { dur: 0.1, vol: 0.08, type: 'highpass', f0: 3000 });
  },
  portal: (c, o) => {
    noise(c, o, { dur: 0.35, vol: 0.18, type: 'bandpass', f0: 600, f1: 4000, q: 3 });
    tone(c, o, { type: 'sine', f0: 300, f1: 900, dur: 0.3, vol: 0.08 });
  },
  gravity: (c, o) => {
    tone(c, o, { type: 'sine', f0: 900, f1: 300, dur: 0.25, vol: 0.12 });
    noise(c, o, { dur: 0.25, vol: 0.1, type: 'bandpass', f0: 3000, f1: 500, q: 3 });
  },
  speed: (c, o) => {
    noise(c, o, { dur: 0.4, vol: 0.2, type: 'bandpass', f0: 400, f1: 6000, q: 2 });
  },
  coin: (c, o) => {
    tone(c, o, { type: 'square', f0: midiToHz(88), dur: 0.12, vol: 0.08 });
    tone(c, o, { type: 'square', f0: midiToHz(95), dur: 0.35, vol: 0.08, t: 0.08 });
    tone(c, o, { type: 'sine', f0: midiToHz(100), dur: 0.5, vol: 0.12, t: 0.08 });
  },
  checkpoint: (c, o) => {
    tone(c, o, { type: 'triangle', f0: midiToHz(76), dur: 0.12, vol: 0.18 });
    tone(c, o, { type: 'triangle', f0: midiToHz(83), dur: 0.2, vol: 0.18, t: 0.07 });
  },
  uncheckpoint: (c, o) => {
    tone(c, o, { type: 'triangle', f0: midiToHz(80), dur: 0.12, vol: 0.15 });
    tone(c, o, { type: 'triangle', f0: midiToHz(73), dur: 0.2, vol: 0.15, t: 0.07 });
  },
  click: (c, o) => {
    tone(c, o, { type: 'square', f0: 1400, f1: 700, dur: 0.05, vol: 0.08 });
    tone(c, o, { type: 'sine', f0: 300, f1: 120, dur: 0.08, vol: 0.2 });
  },
  hover: (c, o) => {
    tone(c, o, { type: 'sine', f0: 2200, f1: 1800, dur: 0.03, vol: 0.035 });
  },
  back: (c, o) => {
    tone(c, o, { type: 'triangle', f0: 600, f1: 300, dur: 0.1, vol: 0.14 });
  },
  select: (c, o) => {
    tone(c, o, { type: 'triangle', f0: midiToHz(79), dur: 0.08, vol: 0.12 });
    tone(c, o, { type: 'triangle', f0: midiToHz(86), dur: 0.14, vol: 0.12, t: 0.05 });
  },
  complete: (c, o) => {
    [72, 76, 79, 84, 88].forEach((m, i) => tone(c, o, { type: 'square', f0: midiToHz(m), dur: 0.5, vol: 0.06, t: i * 0.08 }));
    [72, 79, 84].forEach((m) => tone(c, o, { type: 'sine', f0: midiToHz(m), dur: 1.4, vol: 0.12, t: 0.4 }));
    noise(c, o, { dur: 1.2, vol: 0.12, type: 'highpass', f0: 6000, t: 0.4 });
  },
  achievement: (c, o) => {
    [79, 83, 86, 91].forEach((m, i) => tone(c, o, { type: 'triangle', f0: midiToHz(m), dur: 0.4, vol: 0.1, t: i * 0.06 }));
  },
  unlock: (c, o) => {
    [67, 74, 79, 86].forEach((m, i) => tone(c, o, { type: 'sine', f0: midiToHz(m), dur: 0.5, vol: 0.12, t: i * 0.05 }));
  },
  teleport: (c, o) => {
    tone(c, o, { type: 'sine', f0: 1600, f1: 200, dur: 0.15, vol: 0.12 });
  },
  crumble: (c, o) => {
    noise(c, o, { dur: 0.2, vol: 0.2, f0: 1500, f1: 200 });
  },
  place: (c, o) => {
    tone(c, o, { type: 'sine', f0: 500, f1: 350, dur: 0.05, vol: 0.12 });
  },
  erase: (c, o) => {
    noise(c, o, { dur: 0.08, vol: 0.1, f0: 3000, f1: 800 });
  },
  newbest: (c, o) => {
    [76, 81, 88].forEach((m, i) => tone(c, o, { type: 'triangle', f0: midiToHz(m), dur: 0.3, vol: 0.1, t: i * 0.07 }));
  },
};

export class Sfx {
  constructor(engine) {
    this.engine = engine;
    this.buffers = new Map();
    this.lastPlayed = new Map();
  }

  async init() {
    const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    if (!this.engine.available || !Offline) return;
    const sr = this.engine.sampleRate;
    await Promise.all(
      Object.entries(RECIPES).map(async ([name, fn]) => {
        try {
          const len = name === 'complete' ? 2.2 : 0.8;
          const ctx = new Offline(1, Math.ceil(sr * len), sr);
          fn(ctx, ctx.destination);
          this.buffers.set(name, await ctx.startRendering());
        } catch (e) {
          console.warn('sfx render failed', name, e);
        }
      }),
    );
  }

  play(name, { volume = 1, pitch = 1, minGap = 0.03 } = {}) {
    const ctx = this.engine.ctx;
    const buf = this.buffers.get(name);
    if (!ctx || !buf || !this.engine.running) return;
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name) || -1;
    if (now - last < minGap) return; // avoid stacking identical sounds in one frame
    this.lastPlayed.set(name, now);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = pitch;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(this.engine.sfxBus);
    src.start();
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }
}
