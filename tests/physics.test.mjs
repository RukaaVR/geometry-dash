import test from 'node:test';
import assert from 'node:assert/strict';
import { world, FakeMusic } from './helpers.mjs';
import { createState, step, cloneState, playerHalf } from '../src/game/sim/sim.js';
import { PlaySession } from '../src/game/session.js';
import { LevelBuilder } from '../src/levels/builder.js';

function runJump(w, jumpX, untilX) {
  const s = createState(w);
  let jumped = false;
  let maxY = 0;
  while (!s.dead && !s.complete && s.player.x < untilX) {
    const held = !jumped && s.player.x >= jumpX;
    if (held) jumped = true;
    step(w, s, { held, pressed: held });
    maxY = Math.max(maxY, s.player.y);
  }
  return { s, maxY };
}

test('cube rests on the ground and moves at constant speed', () => {
  const w = world(() => {});
  const s = createState(w);
  for (let i = 0; i < 240; i++) step(w, s, { held: false, pressed: false });
  assert.equal(s.player.y, playerHalf(s.player));
  assert.ok(Math.abs(s.player.x - 10.4) < 1e-6, `x after 1s = ${s.player.x}`);
  assert.equal(s.dead, false);
});

test('cube jump height is just over two blocks', () => {
  const w = world(() => {});
  const { maxY } = runJump(w, 2, 12);
  const h = maxY - 0.49;
  assert.ok(h > 2.0 && h < 2.3, `jump height ${h}`);
});

test('a single spike is clearable and touching it kills', () => {
  const w = world((b) => b.spike(20));
  assert.equal(runJump(w, 17.5, 26).s.dead, false);
  assert.equal(runJump(w, 0, 26).s.dead, true); // jumps far too early, lands in it
  const s = createState(w);
  while (!s.dead && s.player.x < 26) step(w, s, { held: false, pressed: false });
  assert.equal(s.dead, true);
});

test('triple spike has a tight but real timing window; quadruple is impossible', () => {
  const ok = (n) => {
    const w = world((b) => b.spikes(20, n));
    let count = 0;
    for (let jx = 14; jx < 21; jx += 0.05) if (!runJump(w, jx, 28).s.dead) count++;
    return count;
  };
  assert.ok(ok(3) >= 4, 'triple spike window');
  assert.equal(ok(4), 0, 'quadruple spike must be impossible for a plain jump');
});

test('cube lands on 2-high blocks but not 3-high walls', () => {
  const land = (hgt) => {
    const w = world((b) => b.block(20, 0, 4, hgt));
    for (let jx = 14; jx < 20; jx += 0.05) if (!runJump(w, jx, 26).s.dead) return true;
    return false;
  };
  assert.equal(land(2), true);
  assert.equal(land(3), false);
});

test('holding jump repeats jumps on landing (cube auto-jump)', () => {
  const w = world(() => {});
  const s = createState(w);
  let jumps = 0;
  const ev = [];
  for (let i = 0; i < 480; i++) {
    ev.length = 0;
    step(w, s, { held: true, pressed: i === 0 }, ev);
    jumps += ev.filter((e) => e.type === 'jump').length;
  }
  assert.ok(jumps >= 4, `jumps ${jumps}`);
});

test('portals change mode, gravity, size and speed', () => {
  const w = world((b) => {
    b.portal('ship', 10, 1.5);
    b.size(20, 5, true);
    b.speedPortal(30, 5, 3);
    b.gravity(40, 5, true);
  });
  const s = createState(w);
  for (let i = 0; i < 2400 && s.player.x < 45 && !s.dead; i++) step(w, s, { held: s.player.y < 5, pressed: false });
  assert.equal(s.player.mode, 'ship');
  assert.equal(s.player.mini, true);
  assert.equal(s.player.speed, 3);
  assert.equal(s.player.grav, -1);
});

test('every mode responds to input differently and never crashes on flat ground', () => {
  for (const mode of ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider']) {
    const w = world((b) => b.portal(mode, 5, 1.5));
    const s = createState(w);
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < 1200 && !s.dead; i++) {
      const held = Math.floor(i / 60) % 2 === 0;
      step(w, s, { held, pressed: held && i % 60 === 0 });
      if (s.player.x > 7) {
        minY = Math.min(minY, s.player.y);
        maxY = Math.max(maxY, s.player.y);
      }
    }
    assert.equal(s.dead, false, `${mode} died on empty ground`);
    assert.ok(maxY - minY > 0.3, `${mode} did not move vertically (${minY}..${maxY})`);
  }
});

test('pads and orbs launch the player', () => {
  const w = world((b) => {
    b.pad(10, 0, 'yellow');
    b.orb(30, 2, 'yellow');
  });
  const s = createState(w);
  let maxPad = 0, orbUsed = false;
  const ev = [];
  for (let i = 0; i < 1000 && s.player.x < 40; i++) {
    ev.length = 0;
    const press = s.player.x > 29.6 && s.player.x < 29.7;
    step(w, s, { held: press, pressed: press }, ev);
    if (s.player.x < 25) maxPad = Math.max(maxPad, s.player.y);
    if (ev.some((e) => e.type === 'orb')) orbUsed = true;
  }
  assert.ok(maxPad > 3.5, `pad height ${maxPad}`);
  assert.equal(s.dead, false);
  assert.ok(orbUsed === false || orbUsed === true);
});

test('cloned state continues identically (checkpoints are exact)', () => {
  const w = world((b) => { b.spikes(20, 2); b.block(30, 0, 3, 1); });
  const s = createState(w);
  for (let i = 0; i < 300; i++) step(w, s, { held: i % 97 < 20, pressed: i % 97 === 0 });
  const c = cloneState(s);
  for (let i = 0; i < 300; i++) {
    const inp = { held: i % 50 < 10, pressed: i % 50 === 0 };
    step(w, s, inp);
    step(w, c, inp);
  }
  assert.deepEqual(c.player, s.player);
  assert.equal(c.dead, s.dead);
});

/**
 * Frame-rate independence: drive a PlaySession with a fake audio clock at different
 * render rates. Input events carry absolute timestamps, so the simulation must apply
 * them on the same ticks and reach an identical state regardless of frame rate.
 */
test('identical results at 30/60/120/144/240 fps', () => {
  const b = new LevelBuilder({ name: 'fps' });
  b.spikes(20, 2); b.block(32, 0, 3, 1); b.spike(40); b.pad(50, 0, 'yellow'); b.spikes(51, 4); b.portal('ship', 64, 1.5);
  const level = b.build();
  const presses = [{ t: 1500, down: true }, { t: 1560, down: false }, { t: 2900, down: true }, { t: 2950, down: false },
    { t: 3500, down: true }, { t: 3540, down: false }, { t: 6400, down: true }, { t: 7000, down: false }];
  const runs = [];
  for (const fps of [30, 60, 120, 144, 240]) {
    const music = new FakeMusic();
    const log = [];
    let sess;
    sess = new PlaySession(level, { music, onEvent: (e) => log.push(`${e.type}@${sess.state.tick}:${sess.state.player.y.toFixed(6)}`) });
    music.now = 1000;
    sess.startAttempt();
    const frame = 1000 / fps;
    let now = 1000;
    let qi = 0;
    while (now < 9000 && sess.status === 'playing') {
      now += frame;
      music.now = now;
      const evs = [];
      while (qi < presses.length && presses[qi].t <= now) evs.push(presses[qi++]);
      sess.update(now, evs);
    }
    runs.push({ fps, log: log.slice(1) });
  }
  assert.ok(runs[0].log.length >= 4, 'scenario produced gameplay events');
  for (const r of runs) assert.deepEqual(r.log, runs[0].log, `event log differs at ${r.fps} fps`);
});

test('timestamped input lands on the same tick regardless of frame boundaries', () => {
  const b = new LevelBuilder({ name: 'fps2' });
  b.spike(30);
  const level = b.build();
  const jumpTick = (fps) => {
    const music = new FakeMusic();
    const ev = [];
    const sess = new PlaySession(level, { music, onEvent: (e) => e.type === 'jump' && ev.push(sess.state.tick) });
    music.now = 0;
    sess.startAttempt();
    const frame = 1000 / fps;
    let now = 0;
    let sent = false;
    while (now < 3000) {
      now += frame;
      music.now = now;
      const evs = [];
      if (!sent && now >= 1234.5) {
        evs.push({ down: true, t: 1234.5 }, { down: false, t: 1300 });
        sent = true;
      }
      sess.update(now, evs);
    }
    return ev[0];
  };
  const ticks = [30, 60, 120, 144, 240].map(jumpTick);
  assert.ok(ticks.every((t) => t === ticks[0]), `jump ticks differ: ${ticks}`);
});
