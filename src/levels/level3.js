// Level 3 — "Circuit Breaker" (Hard). Introduces the wave, saws, moving hazards,
// teleporters and speed changes, and tightens the ship.
import { LevelBuilder } from './builder.js';
import { section, decorate, lightRow, pulseBeats, beatGrid } from './patterns.js';

export function buildLevel3() {
  const b = new LevelBuilder({
    id: 'circuit-breaker',
    name: 'Circuit Breaker',
    author: 'Prism Pulse',
    description: 'Voltage is rising. Weave the wave through live circuitry and dodge the saws.',
    difficulty: 'hard',
    song: { id: 'overclock', offset: 0 },
    bpm: 140,
    settings: { background: 'circuit', ground: 'circuit' },
    colors: { bg: '#0b5c4a', ground: '#08463a', line: '#b6fff0', obj: '#ffffff', c1: '#7affd9' },
  });
  const B = beatGrid(140, 1);
  let x = 16;

  // ---------------------------------------------------------------- opener with saws
  b.spikes(x, 2); x += 9;
  b.block(x, 0, 3, 1); b.saw(x + 5.5, 1, 'saw_small'); b.block(x + 7, 0, 3, 2); x += 14;
  b.spikes(x, 3); x += 10;
  b.saw(x + 2, 0.4, 'saw'); b.block(x + 4, 0, 4, 1); x += 12;
  b.pad(x, 0, 'yellow'); b.saw(x + 4, 6, 'saw_small'); b.spikes(x + 1, 5); x += 12;
  b.spikes(x, 2); b.spike(x + 2, 0); x += 8;
  decorate(b, 10, x, { step: 8, kinds: ['deco_cross', 'deco_square'] });

  // ---------------------------------------------------------------- moving spikes
  section(b, x, { bg: '#0b4a5c', ground: '#083a46' });
  const g1 = b.group();
  b.block(x, 0, 14, 1);
  b.spike(x + 4, 1, { g: g1 });
  b.spike(x + 9, 1, { g: g1 });
  b.move(x - 6, g1, 0, 1.2, 0.35);
  b.move(x + 1, g1, 0, -1.2, 0.35);
  x += 18;
  // teleporter up onto a high road
  b.teleport(x, 1.5, 4);
  b.block(x + 2, 4, 12, 1);
  b.spike(x + 7, 5);
  b.block(x + 2, 0, 1, 4);
  b.spikes(x + 3, 10);
  b.coin(x + 9.5, 7.2, 0);
  x += 16;
  b.spikes(x, 2);
  x += 10;

  // ---------------------------------------------------------------- the wave
  const wStart = x;
  section(b, wStart, { bg: '#1a2a8f', ground: '#121f6b', line: '#c0d0ff' }, 0.2);
  b.flash(wStart, '#ffffff', 0.35, 0.35);
  b.beat(wStart, true, 0.5, 0.6);
  b.funnel(wStart - 1);
  b.portal('wave', wStart, 1.5);
  const gaps = [3, 5, 2, 5, 3, 6, 3, 5, 2, 4, 6, 3];
  gaps.forEach((gy, i) => {
    const gx = wStart + 10 + i * 6;
    if (gy > 0) b.block(gx, 0, 2, gy);
    b.block(gx, gy + 3, 2, 10 - gy - 3);
  });
  b.coin(wStart + 10 + 5 * 6 + 3, 8.5, 1);
  x = wStart + 10 + gaps.length * 6 + 4;
  b.block(x, 3, 3, 7);
  b.portal('cube', x + 2, 1.5);
  b.beat(x + 2, false);
  x += 8;

  // ---------------------------------------------------------------- speed-up + mini
  section(b, x, { bg: '#5c0b4a', ground: '#460838', line: '#ffc0f0' }, 0.2);
  b.speedPortal(x, 1, 2);
  b.spikes(x + 8, 3);
  b.block(x + 18, 0, 3, 1); b.spikes(x + 21, 2); b.block(x + 23, 0, 3, 1);
  b.size(x + 30, 1.5, true);
  b.spike(x + 36); b.spike(x + 40); b.smallSpike(x + 44, 0, 3);
  b.block(x + 50, 0, 2, 1); b.smallSpike(x + 52, 0, 2); b.block(x + 54, 0, 2, 1);
  b.size(x + 60, 1.5, false);
  b.spikes(x + 66, 3);
  x += 76;

  // ---------------------------------------------------------------- tight ship with saws
  const sStart = x;
  section(b, sStart, { bg: '#8f2a0b', ground: '#6b1f08', line: '#ffe0c0' }, 0.2);
  b.flash(sStart, '#ffffff', 0.35, 0.35);
  b.beat(sStart, true, 1, 0.8);
  b.funnel(sStart - 1);
  b.portal('ship', sStart, 1.5);
  const walls = [[10, 2, 6], [18, 4, 8], [26, 1, 5], [34, 4, 8], [42, 2, 6], [50, 5, 9], [58, 3, 7], [66, 1, 5]];
  for (const [dx, lo, hi] of walls) {
    b.block(sStart + dx, 0, 2, lo);
    b.block(sStart + dx, hi, 2, 10 - hi);
    b.spikes(sStart + dx, 2, lo);
    b.ceilSpike(sStart + dx, hi - 1, 2);
  }
  b.saw(sStart + 30.5, 7, 'saw_small');
  b.saw(sStart + 46, 3, 'saw_small');
  pulseBeats(b, B, Math.ceil(sStart / B.blocksPerBeat), Math.ceil(sStart / B.blocksPerBeat) + 20, '#ffe0c0', 1);
  x = sStart + 74;
  b.block(x, 3, 3, 7);
  b.portal('cube', x + 2, 1.5);
  b.speedPortal(x + 3, 1, 1);
  b.beat(x + 2, false);
  x += 10;

  // ---------------------------------------------------------------- UFO through gears
  const uStart = x;
  section(b, uStart, { bg: '#2a0b8f', ground: '#1f086b' }, 0.3);
  b.funnel(uStart - 1);
  b.portal('ufo', uStart, 1.5);
  for (let i = 0; i < 7; i++) {
    const ux = uStart + 10 + i * 8;
    const gy = [3, 5, 2, 6, 4, 2, 5][i];
    b.block(ux, 0, 1, gy);
    b.block(ux, gy + 4, 1, 10 - gy - 4);
    b.saw(ux + 4.5, gy + (i % 2 ? -1.5 : 5.5), 'saw_small');
  }
  b.coin(uStart + 10 + 3 * 8 + 4.5, 1.2, 2);
  x = uStart + 70;
  b.block(x, 3, 3, 7);
  b.portal('cube', x + 2, 1.5);
  x += 8;

  // ---------------------------------------------------------------- finale
  section(b, x, { bg: '#0b5c4a', ground: '#08463a', line: '#ffffff' }, 0.2);
  b.flash(x, '#ffffff', 0.4, 0.4);
  b.beat(x, true, 1, 0.9);
  b.spikes(x + 4, 3);
  b.orb(x + 13, 2, 'yellow'); b.spikes(x + 11, 6);
  b.block(x + 20, 0, 3, 1); b.block(x + 23, 0, 3, 2); b.block(x + 26, 0, 3, 3); b.spikes(x + 29, 3); b.block(x + 32, 0, 2, 1);
  b.pad(x + 38, 0, 'red'); b.spikes(x + 39, 6); b.saw(x + 42, 8.4, 'saw_small');
  b.spikes(x + 50, 2);
  lightRow(b, x, x + 56, 8, 4);
  x += 58;

  // ---------------------------------------------------------------- mini wave encore
  const mw = x;
  section(b, mw, { bg: '#4a0b8f', ground: '#38086b', line: '#e8d0ff' }, 0.2);
  b.flash(mw, '#ffffff', 0.35, 0.35);
  b.funnel(mw - 1);
  b.portal('wave', mw, 1.5);
  b.size(mw + 2, 1.5, true);
  const mgaps = [2, 4, 3, 6, 4, 2, 5, 3, 6, 4];
  mgaps.forEach((gy, i) => {
    const gx = mw + 10 + i * 5;
    if (gy > 0) b.block(gx, 0, 1, gy);
    b.block(gx, gy + 3, 1, 10 - gy - 3);
  });
  x = mw + 10 + mgaps.length * 5 + 4;
  b.block(x, 3, 3, 7);
  b.portal('cube', x + 2, 1.5);
  b.size(x + 2, 1.5, false);
  b.beat(x + 2, false);
  x += 8;
  section(b, x, { bg: '#0b5c4a', ground: '#08463a', line: '#ffffff' }, 0.6);
  b.spikes(x + 4, 2);
  b.block(x + 10, 0, 2, 1); b.spike(x + 13); b.block(x + 15, 0, 2, 2);
  b.spikes(x + 22, 2);
  decorate(b, x, x + 30, { step: 5, kinds: ['deco_glow'], pulse: true });
  return b.build();
}
