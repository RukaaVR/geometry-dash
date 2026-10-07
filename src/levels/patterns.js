// Shared authoring helpers for the built-in levels: beat-grid placement, decoration
// passes and section colour changes. These only generate ordinary level objects.

import { SPEEDS } from '../game/constants.js';

/** Beat grid for a constant-speed stretch starting at x0 (beat 0). */
export function beatGrid(bpm, speedIndex, x0 = 0) {
  const blocksPerBeat = (60 / bpm) * SPEEDS[speedIndex];
  const fn = (beat) => x0 + beat * blocksPerBeat;
  fn.blocksPerBeat = blocksPerBeat;
  /** Nearest whole cell to a beat (objects are cell-aligned). */
  fn.cell = (beat) => Math.round(x0 + beat * blocksPerBeat);
  return fn;
}

/** Apply a palette change at x for background/ground (and optional line/object colours). */
export function section(b, x, pal, duration = 0.6) {
  if (pal.bg) b.color(x, 'bg', pal.bg, duration);
  if (pal.ground) b.color(x, 'ground', pal.ground, duration);
  if (pal.line) b.color(x, 'line', pal.line, duration);
  if (pal.obj) b.color(x, 'obj', pal.obj, duration);
  if (pal.c1) b.color(x, 'c1', pal.c1, duration);
}

/** Pulse the object channel on every beat between two x positions. */
export function pulseBeats(b, beat, fromBeat, toBeat, color = '#ffffff', step = 1) {
  for (let k = fromBeat; k < toBeat; k += step) {
    b.trigger('trig_pulse', beat(k), { mode: 'channel', channel: 'obj', color, fadeIn: 0, hold: 0.03, fadeOut: 0.3 }, { y: 13 });
  }
}

/** Scatter background decoration across a range (deterministic). */
export function decorate(b, x0, x1, opts = {}) {
  const kinds = opts.kinds || ['deco_diamond', 'deco_ring', 'deco_square', 'deco_star'];
  const step = opts.step || 7;
  let i = 0;
  for (let x = x0; x < x1; x += step, i++) {
    const kind = kinds[i % kinds.length];
    const y = (opts.y ?? 6) + ((i * 37) % 5) * 0.8;
    b.deco(kind, x + ((i * 13) % 5), y, { z: -1, a: opts.alpha ?? 0.45, s: opts.scale ?? 1 + ((i * 7) % 3) * 0.4, p: { spin: (i % 2 ? 1 : -1) * (opts.spin ?? 30), pulse: !!opts.pulse } });
  }
}

/** Glowing beat lights along a row. */
export function lightRow(b, x0, x1, y, step = 4) {
  for (let x = x0; x <= x1; x += step) b.deco('deco_glow', x, y, { z: -1, p: { pulse: true } });
}
