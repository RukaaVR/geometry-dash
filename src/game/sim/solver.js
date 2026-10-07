// Beam-search autopilot. Because the simulation is deterministic, we can search over
// hold/release decisions to prove a level is beatable. Used by the test-suite to
// verify every built-in level, by the editor's "verify" button and for the menu demo.

import { createState, cloneState, step } from './sim.js';
import { DT } from '../constants.js';

/**
 * @param world compiled level
 * @param opts.state      optional starting state (cloned)
 * @param opts.decision   ticks per decision (4 => 60 decisions/s)
 * @param opts.beam       maximum states kept per decision
 * @param opts.maxTime    give up after this many simulated seconds
 * @returns {{success:boolean, progress:number, inputs:boolean[], decision:number, time:number}}
 */
export function solveLevel(world, opts = {}) {
  const decision = opts.decision || 4;
  const beamWidth = opts.beam || 64;
  const maxTicks = Math.ceil((opts.maxTime || 600) / DT);
  const root = { s: opts.state ? cloneState(opts.state) : createState(world), node: null, held: false };
  // With opts.coins, states that pass a coin without collecting it are pruned, so a
  // success proves every coin can be collected in a single run.
  const coins = opts.coins ? world.objects.filter((o) => o.kind === 'coin').map((o) => ({ x: o.x, i: o.props.index | 0 })) : [];
  let beam = [root];
  let best = root;
  const seen = new Map();

  for (let tick = 0; tick < maxTicks; tick += decision) {
    seen.clear();
    const next = [];
    for (const entry of beam) {
      for (const held of [false, true]) {
        const s = cloneState(entry.s);
        for (let k = 0; k < decision; k++) {
          step(world, s, { held, pressed: held && (k > 0 ? false : !entry.held) });
          if (s.dead || s.complete) break;
        }
        if (s.dead) continue;
        if (coins.length && coins.some((c) => !s.coins[c.i] && s.player.x > c.x + 1.5)) continue;
        const node = { parent: entry.node, held };
        const e = { s, node, held };
        if (s.complete) return finish(e, decision, true, world);
        const key = stateKey(s, held);
        if (seen.has(key)) continue;
        seen.set(key, true);
        next.push(e);
      }
    }
    if (!next.length) return finish(best, decision, false, world);
    beam = next.length > beamWidth ? thin(next, beamWidth) : next;
    best = beam[0];
  }
  return finish(best, decision, false, world);
}

function stateKey(s, held) {
  const p = s.player;
  return [
    Math.round(p.y * 40), Math.round(p.vy * 4), p.grav, p.mode, p.mini ? 1 : 0, p.speed,
    p.onGround ? 1 : 0, p.pressBuf ? 1 : 0, held ? 1 : 0, p.robotHold > 0 ? Math.round(p.robotHold * 60) : 0,
    Math.round(p.x * 10),
  ].join(',');
}

/**
 * Keep a diverse subset of candidate states: first one state per coarse
 * (position, velocity, gravity, mode) cell, then an even spread over height.
 */
function thin(list, n) {
  const cells = new Map();
  for (const e of list) {
    const p = e.s.player;
    const key = `${Math.round(p.y * 6)},${Math.round(p.vy / 2)},${p.grav},${p.mode},${p.onGround ? 1 : 0},${p.mini ? 1 : 0}`;
    if (!cells.has(key)) cells.set(key, e);
  }
  let pool = [...cells.values()];
  if (pool.length < n) {
    // top up with leftovers so we use the whole beam
    const used = new Set(pool);
    for (const e of list) {
      if (pool.length >= n) break;
      if (!used.has(e)) pool.push(e);
    }
    return pool;
  }
  pool.sort((a, b) => a.s.player.y - b.s.player.y || a.s.player.vy - b.s.player.vy);
  const out = [];
  const stepSize = pool.length / n;
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(i * stepSize)]);
  return out;
}

function finish(entry, decision, success, world) {
  const inputs = [];
  for (let n = entry.node; n; n = n.parent) inputs.push(n.held);
  inputs.reverse();
  return {
    success,
    progress: entry.s.player.x / world.length,
    inputs,
    decision,
    time: entry.s.time,
  };
}

/** Replay a solver result tick by tick; returns the final state. */
export function replay(world, result, state = createState(world), events = null) {
  let prev = false;
  for (const held of result.inputs) {
    for (let k = 0; k < result.decision; k++) {
      step(world, state, { held, pressed: held && k === 0 && !prev }, events);
      if (state.dead || state.complete) return state;
    }
    prev = held;
  }
  // Coast to the end (the final decision may have finished early).
  for (let i = 0; i < 4000 && !state.dead && !state.complete; i++) step(world, state, { held: prev, pressed: false }, events);
  return state;
}
