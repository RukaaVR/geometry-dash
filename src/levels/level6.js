// Level 6 — "Event Horizon" (Extreme). Maximum speed, every mode, narrow corridors,
// moving and rotating hazards and camera tricks. The final exam.
import { LevelBuilder } from './builder.js';
import { section, lightRow, pulseBeats, beatGrid, decorate } from './patterns.js';

export function buildLevel6() {
  const b = new LevelBuilder({
    id: 'event-horizon',
    name: 'Event Horizon',
    author: 'Prism Pulse',
    description: 'Past the point of no return. Every mode, every speed, no mercy.',
    difficulty: 'extreme',
    song: { id: 'singularity', offset: 0 },
    bpm: 160,
    settings: { background: 'void', ground: 'plain', speed: 3 },
    colors: { bg: '#14051f', ground: '#0e0316', line: '#ff4d6a', obj: '#ffffff', c1: '#ff4d6a' },
  });
  const B = beatGrid(160, 3);
  let x = 24;

  // ---------------------------------------------------------------- intro
  b.beat(4, true, 1, 0.7);
  b.spikes(x, 3); x += 13;
  b.block(x, 0, 2, 1); b.spikes(x + 2, 3); b.block(x + 5, 0, 2, 2); b.spikes(x + 7, 3); b.block(x + 10, 0, 2, 3); x += 18;
  b.orb(x - 1, 2, 'yellow'); b.spikes(x, 6); b.orb(x + 6, 3, 'pink'); b.spikes(x + 6, 4); x += 16;
  b.pad(x, 0, 'red'); b.spikes(x + 1, 6); b.orb(x + 5, 6, 'black'); b.block(x + 10, 2, 7, 8); b.spikes(x + 18, 2); x += 24;

  // ---------------------------------------------------------------- mini wave at speed
  const w = x;
  section(b, w, { bg: '#1f0514', ground: '#16030e', line: '#ff8fb0' }, 0.1);
  b.flash(w, '#ff4d6a', 0.45, 0.4);
  b.beat(w, true, 0.5, 1);
  b.funnel(w - 1);
  b.portal('wave', w, 1.5);
  b.size(w + 1, 1.5, true);
  const gaps = [3, 6, 2, 5, 7, 3, 6, 1, 4, 7, 4, 2, 5, 3];
  gaps.forEach((gy, i) => {
    const gx = w + 8 + i * 5;
    if (gy > 0) b.block(gx, 0, 1, gy);
    b.block(gx, gy + 2, 1, 10 - gy - 2);
  });
  x = w + 8 + gaps.length * 5 + 3;
  b.block(x, 3, 3, 7);
  b.portal('spider', x + 2, 1.5);
  b.size(x + 2, 1.5, false);
  x += 6;

  // ---------------------------------------------------------------- spider + rotating arm
  let px = x + 4;
  for (const [side, n] of [['F', 3], ['C', 4], ['F', 3], ['C', 3], ['F', 4], ['C', 3]]) {
    if (side === 'F') b.spikes(px, n);
    else b.ceilSpike(px, 7, n);
    px += n + 3;
  }
  b.coin(x + 22.5, 4, 1);
  b.block(px, 3, 3, 5);
  b.portal('cube', px + 2, 1.5);
  b.gravity(px + 2, 1.5, false);
  b.beat(px + 2, false);
  x = px + 8;
  const arm = b.group();
  b.saw(x + 12, 2, 'saw_small', { g: arm });
  b.saw(x + 12, 6, 'saw_small', { g: arm });
  b.trigger('trig_rotate', x - 10, { target: arm, degrees: 540, duration: 3, pivot: 'group', easing: 'linear' });
  b.spikes(x + 4, 3);
  b.block(x + 16, 0, 3, 1); b.spikes(x + 19, 3); b.block(x + 22, 0, 3, 2);
  x += 32;

  // ---------------------------------------------------------------- fastest ship
  const sh = x;
  section(b, sh, { bg: '#05141f', ground: '#030e16', line: '#7fe8ff' }, 0.1);
  b.flash(sh, '#7fe8ff', 0.45, 0.4);
  b.beat(sh, true, 0.5, 1);
  b.camera(sh - 4, 1, 0, 0.6, -6);
  b.funnel(sh - 1);
  b.portal('ship', sh, 1.5);
  b.speedPortal(sh + 1, 1.5, 4);
  for (let i = 0; i < 12; i++) {
    const wx = sh + 12 + i * 8;
    const lo = [2, 5, 3, 6, 2, 4, 6, 3, 5, 2, 4, 3][i];
    b.block(wx, 0, 1, lo);
    b.spike(wx, lo);
    b.block(wx, lo + 4, 1, 10 - lo - 4);
    b.ceilSpike(wx, lo + 3);
  }
  pulseBeats(b, B, Math.ceil(sh / B.blocksPerBeat), Math.ceil(sh / B.blocksPerBeat) + 24, '#7fe8ff', 1);
  b.camera(sh + 100, 1, 0, 0.6, 0);
  x = sh + 12 + 96 + 2;
  b.block(x, 3, 3, 7);
  b.portal('ball', x + 2, 1.5);
  b.speedPortal(x + 2, 1.5, 3);
  x += 6;

  // ---------------------------------------------------------------- ball / ufo switch
  for (let i = 0; i < 6; i++) {
    const bx = x + 5 + i * 7;
    if (i % 2 === 0) b.spikes(bx, 3);
    else b.ceilSpike(bx, 7, 3);
  }
  x += 5 + 42;
  b.block(x, 3, 4, 5);
  b.portal('ufo', x + 2, 1.5);
  b.gravity(x + 2, 1.5, false);
  x += 6;
  for (let i = 0; i < 6; i++) {
    const ux = x + 6 + i * 7;
    const gy = [2, 6, 3, 5, 2, 6][i];
    b.block(ux, 0, 1, gy);
    b.block(ux, gy + 4, 1, 10 - gy - 4);
    b.saw(ux + 3.5, gy + (i % 2 ? -1.6 : 5.6), 'saw_small');
  }
  b.coin(x + 6 + 3 * 7 + 5.5, 1.3, 2);
  x += 6 + 42 + 2;
  b.block(x, 3, 3, 7);
  b.portal('robot', x + 2, 1.5, { corridor: 0 });
  x += 8;

  // ---------------------------------------------------------------- robot over the void
  section(b, x, { bg: '#1f1405', ground: '#160e03', line: '#ffd88f' }, 0.1);
  b.flash(x, '#ffd88f', 0.4, 0.4);
  b.spikes(x + 4, 4);
  b.block(x + 14, 0, 3, 2); b.spikes(x + 17, 5); b.block(x + 22, 0, 3, 3);
  b.spikes(x + 28, 6);
  b.block(x + 40, 0, 2, 1); b.spikes(x + 42, 4); b.block(x + 46, 0, 2, 2);
  x += 56;
  b.funnel(x - 1, 8);
  b.portal('cube', x, 1.5);
  x += 4;

  // ---------------------------------------------------------------- gravity maze with teleports
  section(b, x, { bg: '#051f14', ground: '#03160e', line: '#8fffc8' }, 0.1);
  b.block(x, 9, 70, 1);
  b.spikes(x + 4, 3);
  b.gravity(x + 12, 1.5, true);
  b.thorns(x + 14, 0, 10);
  b.ceilSpike(x + 18, 8, 3);
  b.teleport(x + 26, 7.5, -6);
  b.gravity(x + 27, 1.5, false);
  b.spikes(x + 31, 3);
  b.orb(x + 38, 2, 'blue'); b.spikes(x + 37, 4);
  b.thorns(x + 41, 0, 12);
  b.ceilSpike(x + 45, 8, 2);
  b.ceilSpike(x + 51, 8, 2);
  b.gravity(x + 56, 7.5, false);
  b.spikes(x + 60, 3);
  b.coin(x + 47.5, 5.6, 0);
  x += 72;

  // ---------------------------------------------------------------- finale
  section(b, x, { bg: '#14051f', ground: '#0e0316', line: '#ffffff' }, 0.1);
  b.flash(x, '#ffffff', 0.5, 0.5);
  b.beat(x, true, 1, 1);
  b.shake(x, 0.2, 0.4);
  b.spikes(x + 6, 3);
  b.pad(x + 16, 0, 'yellow'); b.spikes(x + 17, 7);
  b.orb(x + 28, 2, 'yellow'); b.spikes(x + 27, 7);
  b.block(x + 40, 0, 3, 1); b.block(x + 45, 0, 3, 2); b.block(x + 50, 0, 3, 3); b.spikes(x + 43, 2); b.spikes(x + 48, 2); b.spikes(x + 53, 3);
  b.spikes(x + 62, 3);
  lightRow(b, x, x + 70, 8, 4);
  decorate(b, 10, x + 70, { step: 10, kinds: ['deco_ring', 'deco_cross'], spin: 60 });
  return b.build();
}
