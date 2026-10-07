// Level 2 — "Neon Steps" (Normal). Adds slopes, gravity portals, the ball and the UFO.
import { LevelBuilder } from './builder.js';
import { section, decorate, lightRow, pulseBeats, beatGrid } from './patterns.js';

export function buildLevel2() {
  const b = new LevelBuilder({
    id: 'neon-steps',
    name: 'Neon Steps',
    author: 'Prism Pulse',
    description: 'Ride slopes, flip gravity and learn to roll. The city never sleeps.',
    difficulty: 'normal',
    song: { id: 'neon_drive', offset: 0 },
    bpm: 128,
    settings: { background: 'skyline', ground: 'stripes' },
    colors: { bg: '#5b1a8f', ground: '#3d1266', line: '#ffd6ff', obj: '#ffffff', c1: '#ff9bf0' },
  });
  const B = beatGrid(128, 1);

  // ---------------------------------------------------------------- intro: rhythm warm-up
  let x = 18;
  b.spike(x); x += 8;
  b.spikes(x, 2); x += 9;
  b.block(x, 0, 4, 1); b.spike(x + 4); x += 11;
  b.spikes(x, 3); x += 10;
  // slopes up onto a plateau and down again
  b.slope(x, 0, 'up'); b.block(x + 1, 0, 6, 1); b.slope(x + 1, 1, 'up'); b.block(x + 2, 1, 4, 1);
  b.slope(x + 6, 1, 'down'); b.slope(x + 7, 0, 'down');
  b.spike(x + 3, 2);
  x += 14;
  b.spikes(x, 2); x += 8;
  decorate(b, 10, x, { step: 9, kinds: ['deco_star', 'deco_diamond'] });

  // ---------------------------------------------------------------- crumble bridge over thorns
  section(b, x, { bg: '#6a1a7a', ground: '#4a1258' });
  b.block(x, 0, 2, 1);
  b.crumble(x + 2, 0, 5);
  b.thorns(x + 7, 0, 4);
  b.block(x + 11, 0, 2, 1);
  b.spike(x + 4, 1);
  x += 18;
  b.pad(x, 0, 'pink'); b.spikes(x + 1, 2); x += 8;
  b.orb(x + 1, 2, 'yellow'); b.spikes(x, 5); x += 12;

  // ---------------------------------------------------------------- gravity flip corridor
  const gStart = x;
  section(b, gStart, { bg: '#1a3b8f', ground: '#132c6b', line: '#bfe0ff' });
  b.block(gStart - 2, 8, 46, 1); // ceiling
  b.gravity(gStart, 1.5, true);
  b.ceilSpike(gStart + 8, 7, 2);
  b.ceilSpike(gStart + 16, 7, 1);
  b.block(gStart + 22, 7, 3, 1);
  b.ceilSpike(gStart + 25, 6, 1);
  b.block(gStart + 26, 7, 3, 1);
  b.ceilSpike(gStart + 33, 7, 2);
  b.gravity(gStart + 40, 6.5, false);
  b.spikes(gStart + 41, 2);
  b.coin(gStart + 28.5, 5.5, 0);
  x = gStart + 50;

  // ---------------------------------------------------------------- ball section
  const ballStart = x;
  section(b, ballStart, { bg: '#8f2a1a', ground: '#6b1d12', line: '#ffe0c0' }, 0.2);
  b.flash(ballStart, '#ffffff', 0.3, 0.3);
  b.beat(ballStart, true, 1, 0.7);
  b.funnel(ballStart - 1);
  b.portal('ball', ballStart, 1.5);
  const ballObs = ['F', 'C', 'F', 'C', 'FC', 'F', 'C', 'F', 'C', 'F', 'C', 'F'];
  ballObs.forEach((k, i) => {
    const bx = ballStart + 10 + i * 7;
    if (k.includes('F')) b.spikes(bx, 2);
    if (k.includes('C')) b.ceilSpike(bx + (k === 'FC' ? 4 : 0), 7, 2);
  });
  b.coin(ballStart + 47.5, 4, 1);
  x = ballStart + 10 + ballObs.length * 7 + 4;
  b.block(x, 3, 3, 5); // funnel down
  b.portal('cube', x + 2, 1.5);
  b.gravity(x + 2, 1.5, false);
  b.beat(x + 2, false);
  x += 8;

  // ---------------------------------------------------------------- blue pads & orbs
  section(b, x, { bg: '#1a6b8f', ground: '#125068', line: '#ffffff' });
  b.block(x + 2, 9, 30, 1);
  b.pad(x + 4, 0, 'blue');
  b.spikes(x + 6, 6);
  b.pad(x + 14, 8, 'blue', { down: true });
  b.ceilSpike(x + 16, 8, 3);
  b.orb(x + 22, 3, 'blue');
  b.spikes(x + 21, 5);
  b.ceilSpike(x + 26, 8, 2);
  b.gravity(x + 31, 7.5, false);
  x += 36;
  b.spikes(x, 3);
  x += 12;

  // ---------------------------------------------------------------- UFO
  const ufoStart = x;
  section(b, ufoStart, { bg: '#2a8f5b', ground: '#1d6b42', line: '#e0ffe8' }, 0.2);
  b.flash(ufoStart, '#ffffff', 0.3, 0.3);
  b.beat(ufoStart, true, 1, 0.7);
  b.funnel(ufoStart - 1);
  b.portal('ufo', ufoStart, 1.5);
  const ufoPillars = [[10, 3], [17, 5], [24, 2], [31, 6], [38, 4], [45, 3], [52, 6], [59, 2], [66, 5]];
  for (const [dx, hgt] of ufoPillars) {
    b.block(ufoStart + dx, 0, 1, hgt);
    b.spike(ufoStart + dx, hgt);
    b.block(ufoStart + dx, hgt + 5, 1, 10 - hgt - 5);
  }
  b.coin(ufoStart + 34.5, 8.5, 2);
  pulseBeats(b, B, Math.ceil(ufoStart / B.blocksPerBeat), Math.ceil(ufoStart / B.blocksPerBeat) + 16, '#e0ffe8', 1);
  x = ufoStart + 74;
  b.block(x - 1, 3, 3, 7);
  b.portal('cube', x + 1, 1.5);
  b.beat(x + 1, false);
  x += 8;

  // ---------------------------------------------------------------- finale
  section(b, x, { bg: '#8f1a5b', ground: '#6b1244', line: '#ffffff' }, 0.2);
  b.flash(x, '#ffffff', 0.3, 0.3);
  b.spikes(x + 4, 3);
  b.block(x + 12, 0, 3, 1); b.block(x + 15, 0, 3, 2); b.spikes(x + 18, 2);
  b.pad(x + 24, 0, 'yellow'); b.spikes(x + 25, 4);
  b.slope(x + 32, 0, 'up'); b.block(x + 33, 0, 4, 1); b.spike(x + 35, 1); b.slope(x + 37, 0, 'down');
  b.spikes(x + 42, 3);
  b.orb(x + 51, 2, 'yellow'); b.spikes(x + 49, 6);
  lightRow(b, x, x + 60, 8, 5);
  b.spikes(x + 62, 2);

  // ---------------------------------------------------------------- mini section
  let y = x + 70;
  section(b, y, { bg: '#3a1a8f', ground: '#2a126b' });
  b.size(y, 1.5, true);
  b.spike(y + 6);
  b.spikes(y + 12, 2);
  b.block(y + 18, 0, 2, 1); b.spike(y + 21);
  b.block(y + 24, 0, 2, 1); b.smallSpike(y + 26, 0, 2); b.block(y + 28, 0, 2, 1);
  b.spikes(y + 33, 2);
  b.size(y + 38, 1.5, false);
  y += 44;

  // ---------------------------------------------------------------- fast ball run
  section(b, y, { bg: '#8f5b1a', ground: '#6b4212', line: '#fff0d0' }, 0.2);
  b.flash(y, '#ffffff', 0.3, 0.3);
  b.speedPortal(y, 1, 2);
  b.funnel(y + 3);
  b.portal('ball', y + 4, 1.5);
  for (let i = 0; i < 10; i++) {
    const bx = y + 14 + i * 8;
    if (i % 2 === 0) b.spikes(bx, 3);
    else b.ceilSpike(bx, 7, 3);
  }
  y += 14 + 80 + 2;
  b.block(y, 3, 3, 5);
  b.portal('cube', y + 2, 1.5);
  b.gravity(y + 2, 1.5, false);
  y += 8;
  b.spikes(y + 2, 2);
  b.pad(y + 10, 0, 'yellow'); b.spikes(y + 11, 5);
  b.block(y + 20, 0, 4, 1); b.block(y + 24, 0, 4, 2); b.spikes(y + 28, 3);
  b.speedPortal(y + 34, 1, 1);
  b.spike(y + 40);
  decorate(b, x + 60, y + 40, { step: 7, kinds: ['deco_ring', 'deco_chevron'], pulse: true });
  return b.build();
}
