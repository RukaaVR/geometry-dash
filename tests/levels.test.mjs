// Every built-in level must be valid, completable, traverse all its portals and
// allow collecting all of its coins.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_BUILDERS } from '../src/levels/index.js';
import { normalizeLevel } from '../src/game/level/format.js';
import { compileLevel, timeAtX } from '../src/game/sim/compile.js';
import { solveLevel, replay } from '../src/game/sim/solver.js';
import { songDuration } from '../src/audio/synth.js';
import { getSong } from '../src/audio/songs.js';

const DECISION = { easy: 8, normal: 6, hard: 6, harder: 4, insane: 4, extreme: 4 };

for (const build of LEVEL_BUILDERS) {
  const level = build();
  test(`level "${level.name}" is valid, completable and fair`, () => {
    const { warnings } = normalizeLevel(JSON.parse(JSON.stringify(level)));
    assert.deepEqual(warnings, []);
    const world = compileLevel(level);
    const duration = timeAtX(world.timeline, world.length);
    assert.ok(duration > 40, `${level.name} lasts ${duration.toFixed(1)}s`);
    assert.ok(songDuration(getSong(level.song.id)) > duration, 'song outlasts the level');

    // Decision granularity scales with difficulty: easy levels must be beatable with
    // coarse (30 Hz) input, i.e. no frame-perfect timing.
    const r = solveLevel(world, { beam: 160, decision: DECISION[level.difficulty] });
    assert.ok(r.success, `${level.name}: autopilot stuck at ${(r.progress * 100).toFixed(1)}%`);
    const s = replay(world, r);
    assert.equal(s.complete, true, 'replaying the solution completes the level (determinism)');
    const missed = world.objects.filter((o) => o.kind === 'portal' && o.d.action === 'mode' && !s.act[o.i]);
    assert.deepEqual(missed.map((o) => o.d.id + '@' + o.x), [], 'every mode portal is unavoidable');
  });

  test(`level "${level.name}" has 3 collectible coins`, () => {
    const world = compileLevel(level);
    assert.equal(world.coinCount, 3);
    const r = solveLevel(world, { beam: 384, decision: 4, coins: true });
    assert.ok(r.success, `${level.name}: coin route stuck at ${(r.progress * 100).toFixed(1)}%`);
    const s = replay(world, r);
    assert.deepEqual(s.coins, [true, true, true]);
  });
}

test('level ids are unique and difficulties ascend', () => {
  const levels = LEVEL_BUILDERS.map((b) => b());
  assert.equal(new Set(levels.map((l) => l.id)).size, levels.length);
  assert.deepEqual(levels.map((l) => l.difficulty), ['easy', 'normal', 'hard', 'harder', 'insane', 'extreme']);
});
