// Level 4 — "Skyline Drift" (Harder). Robot and spider debut, green and black orbs,
// rotating hazard arms and camera moves.
import { LevelBuilder } from './builder.js';
import { section, decorate, lightRow, pulseBeats, beatGrid } from './patterns.js';

export function buildLevel4() {
  const b = new LevelBuilder({
    id: 'skyline-drift',
    name: 'Skyline Drift',
    author: 'Prism Pulse',
    description: 'Walk the rooftops as a robot, skitter between floors as a spider, and keep your nerve at speed.',
    difficulty: 'harder',
    song: { id: 'skyline', offset: 0 },
    bpm: 132,
    settings: { background: 'skyline', ground: 'tiles', speed: 1 },
    colors: { bg: '#0b1f5c', ground: '#081846', line: '#9fd8ff', obj: '#ffffff', c1: '#7fb8ff' },
  });
  const B = beatGrid(132, 1);
  let x = 16;

  // ---------------------------------------------------------------- robot rooftops
  b.spikes(x, 3); x += 10;
  b.funnel(x - 1, 6);
  b.portal('robot', x, 1.5, { corridor: 0 });
  x += 6;
  b.block(x, 0, 3, 2); b.spikes(x + 3, 3); b.block(x + 6, 0, 4, 3); x += 12;
  b.spikes(x, 4); x += 9;
  b.block(x, 0, 2, 1); b.block(x + 4, 0, 2, 3); b.spikes(x + 2, 2); b.spikes(x + 6, 3); b.block(x + 9, 0, 3, 2); x += 16;
  b.spike(x); b.spike(x + 5); b.spikes(x + 9, 3); x += 16;
  b.coin(x - 9.5, 4.0, 0);
  b.funnel(x - 1, 8);
  b.portal('cube', x, 1.5);
  x += 6;

  // ---------------------------------------------------------------- green & black orbs
  section(b, x, { bg: '#1a0b5c', ground: '#130846', line: '#e0c0ff' });
  b.block(x, 8, 22, 1);
  b.orb(x + 4, 2, 'green'); b.spikes(x + 3, 4);
  b.ceilSpike(x + 11, 7, 2);
  b.orb(x + 16, 5, 'green'); b.ceilSpike(x + 18, 7, 2);
  b.spikes(x + 21, 2);
  b.pad(x + 27, 0, 'yellow'); b.spikes(x + 28, 2);
  b.orb(x + 30, 3, 'black');
  b.block(x + 32, 2, 7, 8);
  b.spikes(x + 41, 2);
  x += 48;

  // ---------------------------------------------------------------- spider floors
  const sp = x;
  section(b, sp, { bg: '#5c0b3a', ground: '#46082c', line: '#ffc0e0' }, 0.2);
  b.flash(sp, '#ffffff', 0.3, 0.3);
  b.beat(sp, true, 1, 0.8);
  b.funnel(sp - 1);
  b.portal('spider', sp, 1.5);
  const spiderPattern = [['F', 4], ['C', 3], ['F', 3], ['C', 4], ['F', 2], ['C', 2], ['F', 4], ['C', 3], ['F', 3], ['C', 2], ['F', 3]];
  let px = sp + 8;
  for (const [side, n] of spiderPattern) {
    if (side === 'F') b.spikes(px, n);
    else b.ceilSpike(px, 7, n);
    px += n + 4;
  }
  b.coin(sp + 30.5, 4, 1);
  x = px + 2;
  b.block(x, 3, 3, 5);
  b.portal('cube', x + 2, 1.5);
  b.gravity(x + 2, 1.5, false);
  b.beat(x + 2, false);
  x += 8;

  // ---------------------------------------------------------------- rotating arms
  section(b, x, { bg: '#0b4a5c', ground: '#083846' });
  const arm = b.group();
  b.saw(x + 10, 4, 'saw_small', { g: arm });
  b.saw(x + 10, 6, 'saw_small', { g: arm });
  b.block(x + 9.5 - 0.5, 4.5, 1, 1, { g: arm });
  b.trigger('trig_rotate', x - 6, { target: arm, degrees: 720, duration: 4, pivot: 'group', easing: 'linear' });
  b.spikes(x + 4, 2);
  b.block(x + 14, 0, 3, 1); b.spikes(x + 17, 2); b.block(x + 19, 0, 3, 2);
  b.spikes(x + 25, 3);
  x += 32;
  // camera pull-back over a fast slope launch
  b.camera(x - 4, 0.85, 1, 0.8);
  b.speedPortal(x, 1, 2);
  b.slope22(x + 4, 0, 'up'); b.block(x + 6, 0, 3, 1); b.slope22(x + 6, 1, 'up'); b.block(x + 8, 0, 4, 2);
  b.spikes(x + 12, 5);
  b.block(x + 18, 0, 3, 1);
  b.spikes(x + 24, 3);
  b.camera(x + 28, 1, 0, 0.8);
  b.speedPortal(x + 30, 1, 1);
  x += 36;

  // ---------------------------------------------------------------- ship over the city
  const sh = x;
  section(b, sh, { bg: '#5c3a0b', ground: '#462c08', line: '#ffe8c0' }, 0.2);
  b.flash(sh, '#ffffff', 0.35, 0.35);
  b.beat(sh, true, 0.5, 0.7);
  b.funnel(sh - 1);
  b.portal('ship', sh, 1.5);
  const g2 = b.group();
  for (let i = 0; i < 8; i++) {
    const wx = sh + 10 + i * 7;
    const lo = [2, 4, 1, 5, 3, 2, 4, 3][i];
    b.block(wx, 0, 1, lo);
    b.block(wx, lo + 4, 1, 10 - lo - 4, { g: i === 4 ? g2 : undefined });
  }
  b.move(sh + 30, g2, 0, -0.8, 0.3);
  pulseBeats(b, B, Math.ceil(sh / B.blocksPerBeat), Math.ceil(sh / B.blocksPerBeat) + 18, '#ffe8c0', 1);
  b.coin(sh + 42.5, 1.2, 2);
  x = sh + 70;
  b.block(x, 3, 3, 7);
  b.portal('ball', x + 2, 1.5);
  b.beat(x + 2, false);

  // ---------------------------------------------------------------- ball + gravity tangle
  x += 6;
  for (let i = 0; i < 8; i++) {
    const bx = x + 6 + i * 7;
    if (i % 2 === 0) b.spikes(bx, 3);
    else b.ceilSpike(bx, 7, 3);
    if (i === 4) b.orb(bx - 3, 4, 'yellow');
  }
  x += 6 + 56 + 2;
  b.block(x, 3, 3, 5);
  b.portal('cube', x + 2, 1.5);
  b.gravity(x + 2, 1.5, false);
  x += 8;

  // ---------------------------------------------------------------- wave / ufo relay
  const rl = x;
  section(b, rl, { bg: '#0b5c2a', ground: '#08461f', line: '#d0ffe0' }, 0.2);
  b.flash(rl, '#ffffff', 0.3, 0.3);
  b.funnel(rl - 1);
  b.portal('wave', rl, 1.5);
  const wg = [4, 2, 5, 3, 6, 2];
  wg.forEach((gy, i) => {
    const gx = rl + 8 + i * 6;
    b.block(gx, 0, 2, gy);
    b.block(gx, gy + 3, 2, 10 - gy - 3);
  });
  let rx = rl + 8 + wg.length * 6 + 2;
  b.block(rx, 0, 3, 4);
  b.block(rx, 6, 3, 4);
  b.portal('ufo', rx + 1, 5);
  for (let i = 0; i < 5; i++) {
    const ux = rx + 9 + i * 7;
    const gy = [2, 5, 3, 6, 3][i];
    b.block(ux, 0, 1, gy);
    b.block(ux, gy + 4, 1, 10 - gy - 4);
  }
  rx += 9 + 35 + 2;
  b.block(rx, 3, 3, 7);
  b.portal('cube', rx + 2, 1.5);
  x = rx + 8;

  // ---------------------------------------------------------------- finale
  section(b, x, { bg: '#0b1f5c', ground: '#081846', line: '#ffffff' }, 0.2);
  b.flash(x, '#ffffff', 0.4, 0.4);
  b.beat(x, true, 1, 1);
  b.spikes(x + 4, 3);
  b.pad(x + 12, 0, 'yellow'); b.spikes(x + 13, 3); b.orb(x + 21, 2, 'yellow'); b.spikes(x + 22, 4);
  b.block(x + 30, 0, 2, 1); b.block(x + 34, 0, 2, 2); b.block(x + 38, 0, 2, 3); b.spikes(x + 32, 2); b.spikes(x + 36, 2);
  b.spikes(x + 40, 3);
  b.orb(x + 47, 2, 'pink'); b.spikes(x + 48, 2);
  lightRow(b, x, x + 50, 8, 4);
  decorate(b, 10, x + 50, { step: 11, kinds: ['deco_diamond', 'deco_ring'] });
  return b.build();
}
