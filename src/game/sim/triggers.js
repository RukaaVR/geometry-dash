// Trigger system: group transforms, colour channels, camera, pulses and spawning.
// Everything lives in plain-data simulation state so it can be snapshotted for
// practice checkpoints and replayed deterministically.

import { ease, hexToRgb, DEG } from '../../core/math.js';
import { MODES } from '../constants.js';
import { buildHitGeometry, buildSlopeInfo } from './geometry.js';

const MAX_SPAWN_DEPTH = 24;

export function getGroup(state, g) {
  let gs = state.groups[g];
  if (!gs) gs = state.groups[g] = { dx: 0, dy: 0, rot: 0, orbit: 0, scale: 1, alpha: 1, on: true };
  return gs;
}

/** Current transform of an object, combining every group it belongs to. */
export function objectTransform(world, state, ro, out) {
  let x = ro.x, y = ro.y, rot = ro.rot, scale = 1, alpha = ro.alpha, on = true;
  if (ro.groups) {
    for (const g of ro.groups) {
      const gs = state.groups[g];
      if (!gs) continue;
      x += gs.dx;
      y += gs.dy;
      rot += gs.rot;
      scale *= gs.scale;
      alpha *= gs.alpha;
      if (!gs.on) on = false;
      if (gs.orbit) {
        const c = world.groupCenters.get(g);
        if (c) {
          const px = c.x + gs.dx, py = c.y + gs.dy;
          const a = -gs.orbit * DEG;
          const cs = Math.cos(a), sn = Math.sin(a);
          const dx = x - px, dy = y - py;
          x = px + dx * cs - dy * sn;
          y = py + dx * sn + dy * cs;
          rot += gs.orbit;
        }
      }
    }
  }
  out.x = x;
  out.y = y;
  out.rot = rot;
  out.scale = scale;
  out.alpha = alpha;
  out.on = on;
  return out;
}

const tmpT = { x: 0, y: 0, rot: 0, scale: 1, alpha: 1, on: true };

/** Recompute collision geometry for a dynamic object (or return static geometry). */
export function currentGeometry(world, state, ro) {
  if (!ro.dynamic) return ro.geom;
  objectTransform(world, state, ro, tmpT);
  if (tmpT.x === ro.x && tmpT.y === ro.y && tmpT.rot === ro.rot && tmpT.scale === 1) return ro.geom;
  const g = buildHitGeometry(ro.d.hit, tmpT.x, tmpT.y, tmpT.rot, ro.sx * tmpT.scale, ro.sy * tmpT.scale);
  if (ro.kind === 'slope') g.slope = buildSlopeInfo(g, ro.fx, ro.fy);
  return g;
}

export function isObjectEnabled(state, ro) {
  if (!ro.groups) return true;
  for (const g of ro.groups) {
    const gs = state.groups[g];
    if (gs && !gs.on) return false;
  }
  return true;
}

// ------------------------------------------------------------------ firing

/**
 * Activate a trigger. With `instant`, effects jump to their end state (used when
 * starting mid-level from a start position).
 */
export function fireTrigger(world, state, ro, events, instant = false, depth = 0) {
  const p = ro.props;
  const t = state.time;
  switch (ro.d.id) {
    case 'trig_color': {
      const to = hexToRgb(p.color);
      state.tweens = state.tweens.filter((tw) => !(tw.k === 'color' && tw.ch === p.channel));
      if (instant || p.duration <= 0) state.colors[p.channel] = to;
      else {
        const from = { ...(state.colors[p.channel] || to) };
        state.tweens.push({ k: 'color', ch: p.channel, from, to, t0: t, dur: p.duration, e: 'linear', p: 0 });
      }
      break;
    }
    case 'trig_move':
      if (instant || p.duration <= 0) {
        const gs = getGroup(state, p.target);
        gs.dx += p.dx;
        gs.dy += p.dy;
      } else state.tweens.push({ k: 'move', g: p.target, dx: p.dx, dy: p.dy, t0: t, dur: p.duration, e: p.easing, p: 0 });
      break;
    case 'trig_rotate':
      if (instant || p.duration <= 0) {
        const gs = getGroup(state, p.target);
        if (p.pivot === 'group') gs.orbit += p.degrees;
        else gs.rot += p.degrees;
      } else state.tweens.push({ k: 'rot', g: p.target, deg: p.degrees, pivot: p.pivot, t0: t, dur: p.duration, e: p.easing, p: 0 });
      break;
    case 'trig_scale': {
      const gs = getGroup(state, p.target);
      state.tweens = state.tweens.filter((tw) => !(tw.k === 'scale' && tw.g === p.target));
      if (instant || p.duration <= 0) gs.scale = p.scale;
      else state.tweens.push({ k: 'scale', g: p.target, from: gs.scale, to: p.scale, t0: t, dur: p.duration, e: p.easing, p: 0 });
      break;
    }
    case 'trig_alpha': {
      const gs = getGroup(state, p.target);
      state.tweens = state.tweens.filter((tw) => !(tw.k === 'alpha' && tw.g === p.target));
      if (instant || p.duration <= 0) gs.alpha = p.opacity;
      else state.tweens.push({ k: 'alpha', g: p.target, from: gs.alpha, to: p.opacity, t0: t, dur: p.duration, e: 'linear', p: 0 });
      break;
    }
    case 'trig_toggle':
      getGroup(state, p.target).on = !!p.on;
      break;
    case 'trig_pulse':
      if (!instant) {
        state.pulses.push({
          mode: p.mode, ch: p.channel, g: p.target, color: hexToRgb(p.color),
          t0: t, fi: p.fadeIn, hold: p.hold, fo: p.fadeOut,
        });
      }
      break;
    case 'trig_camera': {
      state.tweens = state.tweens.filter((tw) => tw.k !== 'cam');
      const to = { zoom: p.zoom, offY: p.offsetY, rot: p.rotation };
      if (instant || p.duration <= 0) state.cam = to;
      else state.tweens.push({ k: 'cam', from: { ...state.cam }, to, t0: t, dur: p.duration, e: p.easing, p: 0 });
      break;
    }
    case 'trig_shake':
      if (!instant) state.shake = { s: p.strength, t0: t, dur: p.duration };
      break;
    case 'trig_flash':
      if (!instant) state.flash = { color: hexToRgb(p.color), i: p.intensity, t0: t, dur: p.duration };
      break;
    case 'trig_beat':
      state.beat = { on: !!p.enabled, div: Number(p.division) || 1, i: p.intensity };
      break;
    case 'trig_spawn':
      if (instant || p.delay <= 0) spawnGroup(world, state, p.target, events, instant, depth + 1);
      else state.pending.push({ at: t + p.delay, g: p.target });
      break;
    case 'trig_gameplay': {
      const pl = state.player;
      if (MODES.includes(p.mode) && p.mode !== pl.mode) {
        pl.mode = p.mode;
        events && events.push({ type: 'mode', mode: p.mode });
      }
      if (p.speed !== 'keep') pl.speed = Number(p.speed);
      if (p.gravity !== 'keep' && Number(p.gravity) !== pl.grav) {
        pl.grav = Number(p.gravity);
        pl.vy *= 0.5;
        pl.onGround = false;
      }
      if (p.mini !== 'keep') pl.mini = p.mini === 'mini';
      break;
    }
    default:
      break;
  }
}

export function spawnGroup(world, state, g, events, instant, depth) {
  if (depth > MAX_SPAWN_DEPTH) return;
  const list = world.groupTriggers.get(g);
  if (!list) return;
  for (const ro of list) fireTrigger(world, state, ro, events, instant, depth);
}

// ------------------------------------------------------------------ updating

/** Advance tweens, pending spawns and expire pulses. Called once per tick. */
export function updateTriggers(world, state, events) {
  const t = state.time;
  if (state.pending.length) {
    const due = state.pending.filter((s) => s.at <= t);
    if (due.length) {
      state.pending = state.pending.filter((s) => s.at > t);
      for (const s of due) spawnGroup(world, state, s.g, events, false, 0);
    }
  }
  if (state.tweens.length) {
    let anyDone = false;
    for (const tw of state.tweens) {
      const raw = tw.dur > 0 ? (t - tw.t0) / tw.dur : 1;
      const prog = ease(tw.e, raw);
      const delta = prog - tw.p;
      tw.p = prog;
      switch (tw.k) {
        case 'move': {
          const gs = getGroup(state, tw.g);
          gs.dx += tw.dx * delta;
          gs.dy += tw.dy * delta;
          break;
        }
        case 'rot': {
          const gs = getGroup(state, tw.g);
          if (tw.pivot === 'group') gs.orbit += tw.deg * delta;
          else gs.rot += tw.deg * delta;
          break;
        }
        case 'scale':
          getGroup(state, tw.g).scale = tw.from + (tw.to - tw.from) * prog;
          break;
        case 'alpha':
          getGroup(state, tw.g).alpha = tw.from + (tw.to - tw.from) * prog;
          break;
        case 'color':
          state.colors[tw.ch] = {
            r: tw.from.r + (tw.to.r - tw.from.r) * prog,
            g: tw.from.g + (tw.to.g - tw.from.g) * prog,
            b: tw.from.b + (tw.to.b - tw.from.b) * prog,
          };
          break;
        case 'cam':
          state.cam = {
            zoom: tw.from.zoom + (tw.to.zoom - tw.from.zoom) * prog,
            offY: tw.from.offY + (tw.to.offY - tw.from.offY) * prog,
            rot: tw.from.rot + (tw.to.rot - tw.from.rot) * prog,
          };
          break;
        default:
          break;
      }
      if (raw >= 1) {
        tw.done = true;
        anyDone = true;
      }
    }
    if (anyDone) state.tweens = state.tweens.filter((tw) => !tw.done);
  }
  if (state.pulses.length) {
    state.pulses = state.pulses.filter((pu) => t < pu.t0 + pu.fi + pu.hold + pu.fo);
  }
}

/** Pulse intensity (0..1) for a pulse at time t. */
export function pulseAmount(pu, t) {
  const e = t - pu.t0;
  if (e < 0) return 0;
  if (e < pu.fi) return pu.fi > 0 ? e / pu.fi : 1;
  if (e < pu.fi + pu.hold) return 1;
  const f = e - pu.fi - pu.hold;
  return pu.fo > 0 ? Math.max(0, 1 - f / pu.fo) : 0;
}
