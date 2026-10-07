// Level 1 — "First Light" (Easy). Introduces jumping, blocks, pads, orbs and the ship.
import { LevelBuilder } from './builder.js';
import { beatGrid, section, decorate, lightRow, pulseBeats } from './patterns.js';

export function buildLevel1() {
  const b = new LevelBuilder({
    id: 'first-light',
    name: 'First Light',
    author: 'Prism Pulse',
    description: 'Your first steps. Tap to jump over spikes, bounce off pads and take flight.',
    difficulty: 'easy',
    song: { id: 'daybreak', offset: 0 },
    bpm: 120,
    settings: { background: 'grid', ground: 'tiles' },
    colors: { bg: '#1d4fd8', ground: '#1640b8', line: '#ffffff', obj: '#ffffff', c1: '#9fd0ff' },
  });
  const B = beatGrid(120, 1); // 5.2 blocks per beat
  const c = (beat) => B.cell(beat);

  // ---------------------------------------------------------------- intro: single jumps
  b.spike(c(4));
  b.spike(c(6));
  b.block(c(8), 0, 3, 1);
  b.spike(c(10));
  b.block(c(12), 0, 3, 1);
  b.block(c(12) + 3, 0, 3, 2);
  b.spikes(c(14) + 1, 2);
  decorate(b, 10, 80, { step: 9 });

  // ---------------------------------------------------------------- verse: stairs, pads, orbs
  section(b, c(16), { bg: '#2a3fd0', ground: '#2234aa' });
  b.spike(c(16));
  b.block(c(18), 0, 2, 1);
  b.block(c(18) + 4, 0, 2, 2);
  b.block(c(18) + 8, 0, 3, 3);
  b.spikes(c(18) + 11, 3);
  b.pad(c(23), 0, 'yellow');
  b.spikes(c(23) + 1, 4);
  b.spike(c(26));
  b.spikes(c(28), 4);
  b.orb(c(28) - 1, 2, 'yellow');
  b.block(c(31), 0, 6, 1);
  b.spike(c(31) + 3, 1);
  b.spikes(c(31) + 6, 2);
  b.spike(c(35));
  b.spike(c(37));
  b.block(c(39), 0, 3, 1);
  b.block(c(39) + 5, 0, 3, 1);
  b.spikes(c(39) + 3, 2);
  b.pad(c(43), 0, 'yellow');
  b.block(c(43) + 4, 0, 5, 3);
  b.spikes(c(43) + 1, 3);
  b.spikes(c(46), 2);
  // coin 1: on a high ledge reached by riding the pad arc, above the blocks
  b.coin(c(43) + 6.5, 5.5, 0);
  decorate(b, 85, 245, { step: 8, kinds: ['deco_diamond', 'deco_star'] });

  // ---------------------------------------------------------------- build: rising steps on the beat
  section(b, c(48), { bg: '#4b2fc7', ground: '#3a24a0' });
  b.block(c(48), 0, 3, 1);
  b.block(c(48) + 4, 0, 3, 2);
  b.block(c(48) + 8, 0, 3, 3);
  b.block(c(48) + 11, 0, 5, 1);
  b.spikes(c(56), 2);
  b.spike(c(58));
  b.spike(c(60));
  b.spikes(c(62) - 1, 2);
  lightRow(b, c(48), c(63), 8, 5);

  // ---------------------------------------------------------------- drop: first flight
  const shipStart = c(64);
  section(b, shipStart, { bg: '#8a22b8', ground: '#6a1a90', line: '#ffd6ff' }, 0.2);
  b.flash(shipStart, '#ffffff', 0.35, 0.4);
  b.beat(shipStart, true, 1, 0.8);
  b.portal('ship', shipStart, 1.5);
  const pillars = [
    [10, 'floor', 3], [16, 'ceil', 4], [22, 'floor', 4], [28, 'ceil', 4], [34, 'floor', 3],
    [40, 'ceil', 3], [46, 'floor', 5], [52, 'ceil', 3], [58, 'floor', 4], [64, 'ceil', 4],
    [70, 'floor', 3], [76, 'ceil', 5], [82, 'floor', 4], [88, 'ceil', 3], [94, 'floor', 3],
    [100, 'ceil', 4], [106, 'floor', 4], [112, 'ceil', 4], [118, 'floor', 3], [124, 'ceil', 3],
    [130, 'floor', 4], [136, 'ceil', 4], [142, 'floor', 3], [148, 'ceil', 3],
  ];
  for (const [dx, where, hgt] of pillars) {
    const x = shipStart + dx;
    if (where === 'floor') {
      b.block(x, 0, 2, hgt);
      b.spikes(x, 2, hgt);
    } else {
      b.block(x, 10 - hgt, 2, hgt);
      b.ceilSpike(x, 10 - hgt - 1, 2);
    }
  }
  // coin 2: tucked low between two floor pillars
  b.coin(shipStart + 99, 1.2, 1);
  pulseBeats(b, B, 64, 96, '#ffd6ff', 2);
  b.block(shipStart + 151, 3, 8, 7); // funnel into the exit portal
  b.portal('cube', shipStart + 156, 1.5);
  b.beat(shipStart + 156, false);

  // ---------------------------------------------------------------- break: breathe
  const brk = shipStart + 160;
  section(b, brk, { bg: '#2a5fd0', ground: '#2148a8', line: '#ffffff' }, 1.2);
  b.spike(brk + 8);
  b.block(brk + 16, 0, 4, 1);
  b.spike(brk + 22);
  b.spikes(brk + 30, 2);
  b.block(brk + 38, 0, 2, 1);
  b.block(brk + 42, 0, 2, 2);
  b.spikes(brk + 44, 3);
  b.block(brk + 47, 0, 2, 1);
  decorate(b, brk, brk + 70, { step: 6, kinds: ['deco_ring', 'deco_glow'], pulse: true });

  // ---------------------------------------------------------------- build 2: pads & orbs
  const b2 = brk + 60;
  section(b, b2, { bg: '#2f2fb5', ground: '#25258f' });
  b.pad(b2, 0, 'yellow');
  b.spikes(b2 + 1, 5);
  b.orb(b2 + 12, 2, 'yellow');
  b.spikes(b2 + 10, 5);
  b.pad(b2 + 20, 0, 'pink');
  b.spikes(b2 + 21, 2);
  b.orb(b2 + 28, 2, 'pink');
  b.spikes(b2 + 26, 4);
  // coin 3: high above, chain the orb into a pad-boosted line
  b.pad(b2 + 36, 0, 'red');
  b.coin(b2 + 42.5, 6.6, 2);
  b.spikes(b2 + 37, 6);
  b.block(b2 + 48, 0, 3, 1);

  // ---------------------------------------------------------------- final drop: rhythm run
  const d2 = b2 + 56;
  section(b, d2, { bg: '#c0287a', ground: '#901c5c', line: '#ffe0f0' }, 0.15);
  b.flash(d2, '#ffffff', 0.35, 0.4);
  b.beat(d2, true, 1, 0.8);
  pulseBeats(b, B, Math.ceil(d2 / B.blocksPerBeat), Math.ceil(d2 / B.blocksPerBeat) + 24, '#ffffff', 1);
  let x = d2 + 6;
  const runs = [1, 2, 1, 'step', 2, 1, 'pad', 1, 2, 'step', 1, 2];
  for (const r of runs) {
    if (r === 'step') {
      b.block(x, 0, 3, 1);
      b.block(x + 3, 0, 3, 2);
      x += 12;
    } else if (r === 'pad') {
      b.pad(x, 0, 'yellow');
      b.spikes(x + 1, 4);
      x += 12;
    } else {
      b.spikes(x, r);
      x += 9;
    }
  }
  decorate(b, d2, x + 20, { step: 5, kinds: ['deco_chevron', 'deco_diamond'], pulse: true });
  return b.build();
}
