import test from 'node:test';
import assert from 'node:assert/strict';
import { world } from './helpers.mjs';
import { createState, step, fastForwardTo } from '../src/game/sim/sim.js';
import { objectTransform } from '../src/game/sim/triggers.js';

const run = (w, s, ticks) => { for (let i = 0; i < ticks; i++) step(w, s, { held: false, pressed: false }); };

test('move trigger moves a group over its duration', () => {
  const w = world((b) => {
    b.block(30, 3, 1, 1, { g: [7] });
    b.move(5, 7, 0, 2, 0.5, 'linear');
  });
  const s = createState(w);
  const ro = w.objects.find((o) => o.kind === 'solid');
  run(w, s, 240);
  const t = objectTransform(w, s, ro, {});
  assert.ok(Math.abs(t.y - (ro.y + 2)) < 1e-6, `moved to ${t.y}`);
});

test('color trigger fades a channel', () => {
  const w = world((b) => b.color(5, 'bg', '#ff0000', 0.5));
  const s = createState(w);
  run(w, s, 30); // ~1.3 blocks, before trigger
  assert.notEqual(Math.round(s.colors.bg.r), 255);
  run(w, s, 400);
  assert.equal(Math.round(s.colors.bg.r), 255);
  assert.equal(Math.round(s.colors.bg.g), 0);
});

test('toggle trigger disables collision of a group', () => {
  const w = world((b) => {
    b.spike(20, 0, { g: [3] });
    b.trigger('trig_toggle', 10, { target: 3, on: false });
  });
  const s = createState(w);
  run(w, s, 700);
  assert.equal(s.dead, false);
});

test('spawn trigger activates a group of triggers after a delay', () => {
  const w = world((b) => {
    b.trigger('trig_spawn', 4, { target: 9, delay: 0.25 });
    b.add('trig_color', 100, 12, { p: { channel: 'c1', color: '#00ff00', duration: 0, spawned: true }, g: [9] });
  });
  const s = createState(w);
  run(w, s, 100);
  assert.notEqual(Math.round(s.colors.c1.g), 255, 'not before the delay');
  run(w, s, 140);
  assert.equal(Math.round(s.colors.c1.g), 255);
});

test('fast-forward applies earlier triggers instantly for start positions', () => {
  const w = world((b) => {
    b.color(10, 'bg', '#123456', 3);
    b.block(40, 4, 1, 1, { g: [2] });
    b.move(12, 2, 3, 0, 2);
    b.block(60, 0, 1, 1);
  });
  const s = createState(w, { x: 30, mode: 'cube', speed: 1, grav: 1 });
  fastForwardTo(w, s, 30);
  assert.equal(Math.round(s.colors.bg.r), 0x12);
  assert.equal(s.groups[2].dx, 3);
});
