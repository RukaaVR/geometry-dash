import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLevel, LevelError, serializeLevel, createEmptyLevel } from '../src/game/level/format.js';
import { compileLevel } from '../src/game/sim/compile.js';
import { createState, step } from '../src/game/sim/sim.js';

test('rejects non-level input with LevelError', () => {
  assert.throws(() => normalizeLevel('not json'), LevelError);
  assert.throws(() => normalizeLevel('[]'), LevelError);
  assert.throws(() => normalizeLevel(null), LevelError);
  assert.throws(() => normalizeLevel({ objects: 'nope' }), LevelError);
});

test('drops invalid objects with warnings and keeps valid ones', () => {
  const { level, warnings } = normalizeLevel({
    name: 'x'.repeat(200),
    difficulty: 'impossible',
    objects: [
      { t: 'spike', x: 5, y: 0.5 },
      { t: 'nonsense', x: 1, y: 1 },
      { t: 'block', x: 'NaN', y: 1 },
      null,
      { t: 'block', x: 3, y: 0.5, r: 450, s: 999, p: { style: 'weird' }, g: [0, 5, 5, 'x'] },
      { t: 'trig_move', x: 3, y: 9, p: { dx: 1e9, duration: -5, easing: 'bogus' } },
    ],
  });
  assert.equal(level.objects.length, 3);
  assert.equal(warnings.length, 3);
  assert.equal(level.name.length, 40);
  assert.equal(level.difficulty, 'normal');
  const block = level.objects[1];
  assert.equal(block.r, 90);
  assert.equal(block.s, 10);
  assert.equal(block.p, undefined); // invalid style -> default, omitted
  assert.deepEqual(block.g, [5]);
  const trig = level.objects[2];
  assert.equal(trig.p.dx, 200);
  assert.equal(trig.p.duration, 0);
  assert.equal(trig.p.easing, undefined);
});

test('serialisation round-trips', () => {
  const lvl = createEmptyLevel({ name: 'Round Trip', objects: [{ t: 'orb_yellow', x: 4.5, y: 2.5 }, { t: 'coin', x: 9, y: 3, p: { index: 2 } }] });
  const again = normalizeLevel(serializeLevel(lvl)).level;
  assert.deepEqual(again, lvl);
});

test('malformed but salvageable level still compiles and simulates', () => {
  const { level } = normalizeLevel({ objects: [{ t: 'spike', x: 10, y: 0.5 }, { t: 'portal_ship', x: 20, y: 1.5, p: { corridor: 'abc' } }, { t: 'trig_spawn', x: 5, y: 9, p: { target: 3 }, g: [3] }] });
  const world = compileLevel(level);
  const s = createState(world);
  for (let i = 0; i < 2000 && !s.dead && !s.complete; i++) step(world, s, { held: i % 60 < 30, pressed: i % 60 === 0 });
  assert.ok(s.dead || s.complete);
});

test('empty level is completable', () => {
  const world = compileLevel(createEmptyLevel());
  const s = createState(world);
  for (let i = 0; i < 4000 && !s.complete; i++) step(world, s, { held: false, pressed: false });
  assert.equal(s.complete, true);
});
