// Level 5 — "Voltage Spire" (Insane). Fast speed throughout, mini modes, chained orbs,
// moving walls and quick mode swaps.
import { LevelBuilder } from './builder.js';
import { section, decorate, lightRow, pulseBeats, beatGrid } from './patterns.js';

export function buildLevel5() {
  const b = new LevelBuilder({
    id: 'voltage-spire',
    name: 'Voltage Spire',
    author: 'Prism Pulse',
    description: 'Climb the spire at full voltage. Every portal swaps the rules. No hesitation allowed.',
    difficulty: 'insane',
    song: { id: 'voltage', offset: 0 },
    bpm: 150,
    settings: { background: 'nebula', ground: 'circuit', speed: 2 },
    colors: { bg: '#3a0b5c', ground: '#2c0846', line: '#ffb0ff', obj: '#ffffff', c1: '#ff9bf0' },
  });
  const B = beatGrid(150, 2);
  let x = 20;

  // ---------------------------------------------------------------- fast cube gauntlet
  b.beat(4, true, 1, 0.6);
  b.spikes(x, 3); x += 12;
  b.block(x, 0, 2, 1); b.spikes(x + 2, 2); b.block(x + 4, 0, 2, 2); b.spikes(x + 6, 2); b.block(x + 8, 0, 2, 3); x += 16;
  b.orb(x - 1, 2, 'yellow'); b.spikes(x, 5); x += 13;
  b.pad(x, 0, 'yellow'); b.spikes(x + 1, 6); x += 14;
  b.orb(x - 1, 2, 'pink'); b.spikes(x, 5); x += 12;
  b.crumble(x, 0, 6); b.thorns(x + 6, 0, 3); b.block(x + 9, 0, 3, 1); b.spike(x + 3, 1); x += 18;
  b.saw(x + 3, 0.6, 'saw'); b.block(x + 5, 0, 3, 1); b.saw(x + 9, 1.4, 'saw_small'); b.block(x + 10, 0, 3, 2); x += 18;
  b.coin(x - 9, 3.4, 0);
  decorate(b, 10, x, { step: 8, kinds: ['deco_star', 'deco_tri'] });

  // ---------------------------------------------------------------- mini wave
  const w = x;
  section(b, w, { bg: '#0b3a5c', ground: '#082c46', line: '#b0e8ff' }, 0.2);
  b.flash(w, '#ffffff', 0.35, 0.35);
  b.beat(w, true, 0.5, 0.8);
  b.funnel(w - 1);
  b.portal('wave', w, 1.5);
  b.size(w + 1, 1.5, true);
  const gaps = [3, 5, 2, 6, 4, 1, 5, 3, 7, 4, 2, 5, 3, 6];
  gaps.forEach((gy, i) => {
    const gx = w + 8 + i * 5;
    if (gy > 0) b.block(gx, 0, 1, gy);
    b.block(gx, gy + 2, 1, 10 - gy - 2);
  });
  b.coin(w + 8 + 8 * 5 + 2.5, 9.2, 1);
  x = w + 8 + gaps.length * 5 + 3;
  b.block(x, 3, 3, 7);
  b.portal('cube', x + 2, 1.5);
  b.size(x + 2, 1.5, false);
  x += 8;

  // ---------------------------------------------------------------- gravity orb chain
  section(b, x, { bg: '#5c0b2a', ground: '#460820', line: '#ffc0d0' }, 0.2);
  b.block(x, 9, 44, 1);
  b.orb(x + 3, 2, 'blue'); b.spikes(x + 2, 4);
  b.thorns(x + 6, 0, 9);
  b.ceilSpike(x + 9, 8, 2);
  b.orb(x + 15, 6, 'blue');
  b.ceilSpike(x + 16, 8, 8);
  b.orb(x + 27, 2, 'green'); b.spikes(x + 26, 3);
  b.thorns(x + 29, 0, 10);
  b.ceilSpike(x + 33, 8, 2);
  b.gravity(x + 39, 7.5, false);
  b.spikes(x + 44, 2);
  x += 52;

  // ---------------------------------------------------------------- spider + ball switchback
  const sp = x;
  section(b, sp, { bg: '#5c4a0b', ground: '#463808', line: '#fff0b0' }, 0.2);
  b.flash(sp, '#ffffff', 0.35, 0.35);
  b.beat(sp, true, 1, 0.9);
  b.funnel(sp - 1);
  b.portal('spider', sp, 1.5);
  let px = sp + 7;
  for (const [side, n] of [['F', 3], ['C', 3], ['F', 2], ['C', 4], ['F', 3], ['C', 2]]) {
    if (side === 'F') b.spikes(px, n);
    else b.ceilSpike(px, 7, n);
    px += n + 3;
  }
  b.block(px, 3, 4, 5);
  b.portal('ball', px + 2, 1.5);
  px += 6;
  for (let i = 0; i < 6; i++) {
    const bx = px + 4 + i * 6;
    if (i % 2 === 0) b.spikes(bx, 2);
    else b.ceilSpike(bx, 7, 2);
  }
  px += 4 + 36 + 2;
  b.block(px, 3, 3, 5);
  b.portal('cube', px + 2, 1.5);
  b.gravity(px + 2, 1.5, false);
  b.beat(px + 2, false);
  x = px + 8;

  // ---------------------------------------------------------------- ship with moving walls
  const sh = x;
  section(b, sh, { bg: '#0b5c3a', ground: '#08462c', line: '#c0ffe0' }, 0.2);
  b.flash(sh, '#ffffff', 0.35, 0.35);
  b.beat(sh, true, 0.5, 0.9);
  b.funnel(sh - 1);
  b.portal('ship', sh, 1.5);
  for (let i = 0; i < 9; i++) {
    const wx = sh + 10 + i * 7;
    const lo = [3, 5, 2, 4, 6, 3, 5, 2, 4][i];
    const g = b.group();
    b.block(wx, 0, 1, lo, { g });
    b.block(wx, lo + 3.5, 1, 1, { g });
    b.block(wx, lo + 4.5, 1, 10 - lo - 4.5);
    b.spike(wx, lo, { g });
    if (i % 3 === 1) b.move(wx - 12, g, 0, -1, 0.4);
  }
  
  pulseBeats(b, B, Math.ceil(sh / B.blocksPerBeat), Math.ceil(sh / B.blocksPerBeat) + 24, '#c0ffe0', 1);
  x = sh + 10 + 63 + 3;
  b.block(x, 3, 3, 7);
  b.portal('ufo', x + 2, 1.5);
  x += 6;

  // ---------------------------------------------------------------- UFO saws
  for (let i = 0; i < 6; i++) {
    const ux = x + 6 + i * 6;
    const gy = [2, 5, 3, 6, 2, 4][i];
    b.block(ux, 0, 1, gy);
    b.block(ux, gy + 4, 1, 10 - gy - 4);
    b.saw(ux + 3, i % 2 ? 1 : 9, 'saw_small');
  }
  x += 6 + 36 + 2;
  b.block(x, 3, 3, 7);
  b.portal('cube', x + 2, 1.5);
  b.speedPortal(x + 2, 1.5, 3);
  x += 10;

  // ---------------------------------------------------------------- faster finale
  section(b, x, { bg: '#3a0b5c', ground: '#2c0846', line: '#ffffff' }, 0.2);
  b.flash(x, '#ffffff', 0.45, 0.45);
  b.beat(x, true, 1, 1);
  b.spikes(x + 6, 3);
  b.block(x + 16, 0, 3, 1); b.block(x + 21, 0, 3, 2); b.spikes(x + 19, 2);
  b.pad(x + 30, 0, 'yellow'); b.spikes(x + 31, 5);
  b.orb(x + 42, 2, 'yellow'); b.spikes(x + 41, 6);
  b.spikes(x + 55, 3);
  b.block(x + 64, 0, 4, 1); b.spike(x + 66, 1); b.spikes(x + 68, 2);
  lightRow(b, x, x + 70, 8, 5);
  x += 76;

  // ---------------------------------------------------------------- robot leaps
  section(b, x, { bg: '#5c0b0b', ground: '#460808', line: '#ffd0d0' }, 0.2);
  b.funnel(x - 1, 8);
  b.portal('robot', x, 1.5, { corridor: 0 });
  b.spikes(x + 8, 4);
  b.block(x + 18, 0, 3, 2); b.spikes(x + 21, 4); b.block(x + 25, 0, 3, 3);
  b.spikes(x + 33, 5);
  b.block(x + 44, 0, 2, 1); b.spikes(x + 46, 3); b.block(x + 49, 0, 2, 2);
  x += 58;

  // ---------------------------------------------------------------- mini ship sprint
  const ms = x;
  section(b, ms, { bg: '#0b0b5c', ground: '#080846', line: '#d0d0ff' }, 0.2);
  b.flash(ms, '#ffffff', 0.4, 0.4);
  b.funnel(ms - 1);
  b.portal('ship', ms, 1.5);
  b.size(ms + 1, 1.5, true);
  for (let i = 0; i < 12; i++) {
    const wx = ms + 10 + i * 7;
    const lo = [2, 4, 3, 6, 4, 2, 5, 3, 6, 4, 2, 4][i];
    b.block(wx, 0, 1, lo);
    b.block(wx, lo + 3, 1, 10 - lo - 3);
  }
  b.coin(ms + 20.5, 2.3, 2);
  x = ms + 10 + 84 + 2;
  b.block(x, 3, 3, 7);
  b.portal('cube', x + 2, 1.5);
  b.size(x + 2, 1.5, false);
  b.spikes(x + 10, 3);
  b.spikes(x + 22, 2);
  return b.build();
}
