// Deterministic fixed-tick simulation. No DOM, no wall-clock: the same inputs on the
// same tick always produce the same result, which makes physics frame-rate independent
// and lets the test-suite (and practice checkpoints) replay attempts exactly.

import {
  DT, SPEEDS, MODE_SIZE, MINI_SCALE, INNER_RATIO, SNAP_RATIO, MODE_CEILING, PHYS, MINI,
  PAD_VEL, ORB_VEL, LAUNCH_MUL, WORLD_TOP, WORLD_BOTTOM, CUBE_SPIN, MODE_CORRIDOR,
} from '../constants.js';
import { aabbOverlap, polyAabbOverlap, circleAabbOverlap, approach, clamp } from '../../core/math.js';
import { BUCKET, levelStartConfig } from './compile.js';
import {
  fireTrigger, updateTriggers, currentGeometry, isObjectEnabled, objectTransform, spawnGroup,
} from './triggers.js';

// ------------------------------------------------------------------ state

export function playerHalf(p) {
  return (MODE_SIZE[p.mode] * (p.mini ? MINI_SCALE : 1)) / 2;
}

function corridorBounds(centerY, height) {
  if (!height) return { floorY: 0, ceilY: Infinity };
  const floorY = Math.max(0, Math.round(centerY - height / 2));
  return { floorY, ceilY: floorY + height };
}

export function createPlayer(cfg) {
  const p = {
    x: cfg.x || 0,
    y: 0,
    px: 0,
    py: 0,
    vy: 0,
    mode: cfg.mode || 'cube',
    mini: !!cfg.mini,
    grav: cfg.grav === -1 ? -1 : 1,
    speed: cfg.speed ?? 1,
    floorY: 0,
    ceilY: Infinity,
    onGround: true,
    onCeil: false,
    wasGround: true,
    slopeLaunch: 0,
    robotHold: 0,
    pressBuf: false,
    held: false,
    rot: 0,
    prot: 0,
    airTime: 0,
    dead: false,
  };
  const corridor = cfg.corridor || 0;
  const cy = cfg.y !== undefined ? cfg.y : corridor ? corridor / 2 : 0;
  Object.assign(p, corridorBounds(cy, corridor));
  const h = playerHalf(p);
  if (cfg.y !== undefined && !corridor) p.y = cfg.y;
  else p.y = p.grav === 1 ? p.floorY + h : p.ceilY === Infinity ? p.floorY + h : p.ceilY - h;
  p.px = p.x;
  p.py = p.y;
  return p;
}

export function createState(world, cfg = levelStartConfig(world.level)) {
  const colors = {};
  for (const [k, v] of Object.entries(world.baseColors)) colors[k] = { ...v };
  const state = {
    tick: 0,
    time: 0,
    player: createPlayer(cfg),
    act: new Uint8Array(world.objects.length),
    actTime: new Float32Array(world.objects.length),
    trigCursor: 0,
    trigFired: new Uint8Array(world.triggers.length),
    groups: {},
    tweens: [],
    pending: [],
    pulses: [],
    colors,
    cam: { zoom: 1, offY: 0, rot: 0 },
    shake: null,
    flash: null,
    beat: { on: false, div: 1, i: 0.6 },
    coins: [false, false, false],
    dead: false,
    complete: false,
    progress: 0,
  };
  return state;
}

/** Deep copy of simulation state (cheap: everything is plain data). */
export function cloneState(s) {
  const groups = {};
  for (const k in s.groups) groups[k] = { ...s.groups[k] };
  const colors = {};
  for (const k in s.colors) colors[k] = { ...s.colors[k] };
  return {
    tick: s.tick,
    time: s.time,
    player: { ...s.player },
    act: s.act.slice(),
    actTime: s.actTime.slice(),
    trigCursor: s.trigCursor,
    trigFired: s.trigFired.slice(),
    groups,
    tweens: s.tweens.map((t) => ({ ...t })),
    pending: s.pending.map((p) => ({ ...p })),
    pulses: s.pulses.map((p) => ({ ...p })),
    colors,
    cam: { ...s.cam },
    shake: s.shake ? { ...s.shake } : null,
    flash: s.flash ? { ...s.flash } : null,
    beat: { ...s.beat },
    coins: s.coins.slice(),
    dead: s.dead,
    complete: s.complete,
    progress: s.progress,
  };
}

/**
 * Prepare state for starting at an arbitrary x (editor test / start position):
 * passed triggers are applied instantly and passed one-shot objects are marked used.
 */
export function fastForwardTo(world, state, x) {
  const events = null;
  while (state.trigCursor < world.posTriggers.length && world.posTriggers[state.trigCursor].x < x) {
    const ro = world.posTriggers[state.trigCursor++];
    state.trigFired[ro.trig] = 1;
    fireTrigger(world, state, ro, events, true);
  }
  // Settle any tweens created by spawned triggers.
  for (const tw of state.tweens) tw.t0 = -1e6;
  state.pending = [];
  updateTriggers(world, state, events);
  state.pulses = [];
  for (const ro of world.objects) {
    if ((ro.kind === 'portal' || ro.kind === 'pad' || ro.kind === 'orb') && ro.geom && ro.geom.x1 < x) state.act[ro.i] = 1;
  }
}

/** Player configuration at a given x by scanning portals in order (for editor testing). */
export function configAtX(world, x) {
  const cfg = { ...levelStartConfig(world.level) };
  let corridorY = null;
  const portals = world.objects.filter((o) => o.kind === 'portal' && o.x < x).sort((a, b) => a.x - b.x);
  for (const p of portals) {
    switch (p.d.action) {
      case 'mode':
        cfg.mode = p.d.value;
        cfg.corridor = p.props.corridor;
        corridorY = p.y;
        break;
      case 'gravity':
        cfg.grav = p.d.value;
        break;
      case 'size':
        cfg.mini = p.d.value;
        break;
      case 'speed':
        cfg.speed = p.d.value;
        break;
      default:
        break;
    }
  }
  cfg.x = x;
  if (cfg.corridor && corridorY !== null) cfg.y = corridorY;
  return cfg;
}

export function configFromStartPos(ro) {
  const p = ro.props;
  return {
    x: ro.x,
    y: p.corridor ? ro.y : ro.y,
    mode: p.mode,
    speed: Number(p.speed),
    grav: Number(p.gravity) === -1 ? -1 : 1,
    mini: !!p.mini,
    corridor: p.corridor,
  };
}

// ------------------------------------------------------------------ queries

const candidates = [];

/** Collidable objects whose bucket range overlaps [x0, x1]. Results are reused; copy if kept. */
export function queryRange(world, state, x0, x1) {
  candidates.length = 0;
  const id = ++world.queryId;
  if (id >= 0xfffffff0) {
    world.queryStamp.fill(0);
    world.queryId = 1;
  }
  const stamp = world.queryStamp;
  const b0 = Math.max(0, Math.floor(x0 / BUCKET));
  const b1 = Math.min(world.bucketCount - 1, Math.floor(x1 / BUCKET));
  if (x0 < 0) for (const ro of world.negBucket) if (stamp[ro.i] !== id) { stamp[ro.i] = id; candidates.push(ro); }
  for (let b = b0; b <= b1; b++) {
    const list = world.buckets[b];
    for (let k = 0; k < list.length; k++) {
      const ro = list[k];
      if (stamp[ro.i] === id) continue;
      stamp[ro.i] = id;
      candidates.push(ro);
    }
  }
  for (const ro of world.dynamicCollidables) {
    if (stamp[ro.i] === id) continue;
    stamp[ro.i] = id;
    candidates.push(ro);
  }
  return candidates;
}

function hitTest(geom, box) {
  if (!aabbOverlap(geom, box)) return false;
  if (geom.circle) return circleAabbOverlap(geom.circle.x, geom.circle.y, geom.circle.r, box);
  if (geom.poly) return polyAabbOverlap(geom.poly, box);
  return true;
}

// ------------------------------------------------------------------ step

const outer = { x0: 0, y0: 0, x1: 0, y1: 0 };
const inner = { x0: 0, y0: 0, x1: 0, y1: 0 };
const scratch = [];
const tmpT = { x: 0, y: 0, rot: 0, scale: 1, alpha: 1, on: true };

function setBox(box, p, h) {
  box.x0 = p.x - h;
  box.x1 = p.x + h;
  box.y0 = p.y - h;
  box.y1 = p.y + h;
}

function kill(state, events, cause) {
  if (state.dead) return;
  state.dead = true;
  state.player.dead = true;
  events && events.push({ type: 'death', cause, x: state.player.x, y: state.player.y });
}

/**
 * Advance the simulation by one tick.
 * @param input {{held:boolean, pressed:boolean}} pressed = a press edge occurred this tick
 * @param events optional array receiving gameplay events for audio/visual feedback
 */
export function step(world, state, input, events = null) {
  if (state.dead || state.complete) return;
  const p = state.player;
  p.px = p.x;
  p.py = p.y;
  p.prot = p.rot;
  state.tick++;
  state.time = state.tick * DT;

  // ---- input
  if (input.pressed) p.pressBuf = true;
  p.held = !!input.held;
  if (!input.held && !input.pressed) p.pressBuf = false;

  updateTriggers(world, state, events);

  const speed = SPEEDS[p.speed];
  let h = playerHalf(p);

  // ---- orbs (checked before movement so they take priority over ground jumps)
  let launched = false;
  if (p.pressBuf) {
    setBox(outer, p, h);
    const list = queryRange(world, state, outer.x0 - 1, outer.x1 + 1);
    for (let k = 0; k < list.length; k++) {
      const ro = list[k];
      if (ro.kind !== 'orb' || state.act[ro.i]) continue;
      if (!isObjectEnabled(state, ro)) continue;
      const g = currentGeometry(world, state, ro);
      if (!hitTest(g, outer)) continue;
      state.act[ro.i] = 1;
      p.pressBuf = false;
      applyOrb(p, ro.d.variant);
      launched = true;
      events && events.push({ type: 'orb', variant: ro.d.variant, x: g.x0 + (g.x1 - g.x0) / 2, y: g.y0 + (g.y1 - g.y0) / 2 });
      break;
    }
  }

  // ---- mode physics (in gravity-local space: vL > 0 = away from floor)
  let vL = p.vy * p.grav;
  const mini = p.mini;
  switch (p.mode) {
    case 'cube': {
      const ph = PHYS.cube;
      if (!launched && p.onGround && p.held) {
        vL = ph.jump * (mini ? MINI.jumpMul : 1);
        p.onGround = false;
        p.pressBuf = false;
        events && events.push({ type: 'jump', x: p.x, y: p.y - h * p.grav });
      } else vL = Math.max(vL - ph.gravity * DT, -ph.maxFall);
      break;
    }
    case 'robot': {
      const ph = PHYS.robot;
      if (!launched && p.onGround && p.held) {
        vL = ph.jump * (mini ? MINI.jumpMul : 1);
        p.robotHold = ph.holdTime;
        p.onGround = false;
        p.pressBuf = false;
        events && events.push({ type: 'jump', x: p.x, y: p.y - h * p.grav, robot: true });
      } else if (p.robotHold > 0 && p.held && !launched) {
        p.robotHold -= DT;
        vL = Math.max(vL, ph.jump * (mini ? MINI.jumpMul : 1));
      } else {
        p.robotHold = 0;
        vL = Math.max(vL - ph.gravity * DT, -ph.maxFall);
      }
      break;
    }
    case 'ship': {
      const ph = PHYS.ship;
      const acc = p.held ? ph.lift * (mini ? MINI.shipLiftMul : 1) : -ph.gravity;
      vL = clamp(vL + acc * DT, -ph.maxDown, ph.maxUp);
      break;
    }
    case 'ball': {
      const ph = PHYS.ball;
      if (!launched && p.onGround && p.pressBuf) {
        p.pressBuf = false;
        p.grav = -p.grav;
        vL = -ph.flipPush;
        p.onGround = false;
        events && events.push({ type: 'flip', x: p.x, y: p.y });
      }
      vL = Math.max(vL - ph.gravity * DT, -ph.maxFall);
      break;
    }
    case 'ufo': {
      const ph = PHYS.ufo;
      if (!launched && p.pressBuf) {
        p.pressBuf = false;
        vL = ph.jump * (mini ? MINI.jumpMul : 1);
        p.onGround = false;
        events && events.push({ type: 'jump', x: p.x, y: p.y - h * p.grav, ufo: true });
      } else vL = Math.max(vL - ph.gravity * DT, -ph.maxFall);
      break;
    }
    case 'wave': {
      const k = mini ? MINI.waveSlope : PHYS.wave.slope;
      vL = (p.held ? 1 : -1) * k * speed;
      break;
    }
    case 'spider': {
      const ph = PHYS.spider;
      if (!launched && p.onGround && p.pressBuf) {
        p.pressBuf = false;
        spiderTeleport(world, state, p, h, events);
        vL = p.vy * p.grav;
      } else vL = Math.max(vL - ph.gravity * DT, -ph.maxFall);
      break;
    }
    default:
      break;
  }
  p.vy = vL * p.grav;

  // ---- integrate
  const prevY = p.y;
  p.x += speed * DT;
  p.y += p.vy * DT;
  p.wasGround = p.onGround;
  const prevSlopeLaunch = p.slopeLaunch;
  p.onGround = false;
  p.onCeil = false;
  p.slopeLaunch = 0;

  // ---- solids
  h = playerHalf(p);
  const canCeil = MODE_CEILING[p.mode];
  const tol = Math.max(SNAP_RATIO * h * 2, 0.05);
  const ih = p.mode === 'wave' ? h : h * INNER_RATIO;
  setBox(outer, p, h);
  const near = queryRange(world, state, outer.x0 - 1.5, outer.x1 + 1.5);
  scratch.length = 0;
  for (let k = 0; k < near.length; k++) scratch.push(near[k]);

  for (let k = 0; k < scratch.length && !state.dead; k++) {
    const ro = scratch[k];
    const kind = ro.kind;
    if (kind !== 'solid' && kind !== 'crumble') continue;
    if (kind === 'crumble' && state.actTime[ro.i] > 0 && state.time >= state.actTime[ro.i] + ro.props.delay) continue;
    if (!isObjectEnabled(state, ro)) continue;
    const g = currentGeometry(world, state, ro);
    setBox(outer, p, h);
    if (!aabbOverlap(g, outer)) continue;
    const res = resolveSolid(p, g, h, prevY, tol, canCeil);
    if (res === 1) {
      if (kind === 'crumble' && !state.actTime[ro.i]) {
        state.actTime[ro.i] = state.time;
        events && events.push({ type: 'crumble', i: ro.i, x: ro.x, y: ro.y });
      }
    } else if (res === 0) {
      inner.x0 = p.x - ih; inner.x1 = p.x + ih; inner.y0 = p.y - ih; inner.y1 = p.y + ih;
      if (aabbOverlap(g, inner)) kill(state, events, 'solid');
    }
  }

  // slopes
  for (let k = 0; k < scratch.length && !state.dead; k++) {
    const ro = scratch[k];
    if (ro.kind !== 'slope' || !isObjectEnabled(state, ro)) continue;
    const g = currentGeometry(world, state, ro);
    const sl = g.slope || ro.slope;
    collideSlope(state, p, g, sl, h, ih, prevY, tol, canCeil, speed, events);
  }

  // corridor / ground bounds
  if (!state.dead) {
    const bottom = p.y - h, top = p.y + h;
    if (bottom < p.floorY) {
      p.y = p.floorY + h;
      if (p.grav === 1) {
        if (p.vy < 0) p.vy = 0;
        p.onGround = true;
      } else {
        if (p.vy < 0) p.vy = 0;
        p.onCeil = true;
      }
    }
    if (top > p.ceilY) {
      p.y = p.ceilY - h;
      if (p.grav === -1) {
        if (p.vy > 0) p.vy = 0;
        p.onGround = true;
      } else {
        if (p.vy > 0) p.vy = 0;
        p.onCeil = true;
      }
    }
    if (p.y > WORLD_TOP || p.y < WORLD_BOTTOM) kill(state, events, 'fall');
  }

  // launch off the top of a rising slope
  if (!p.onGround && prevSlopeLaunch > 0) {
    const v = p.vy * p.grav;
    if (v < prevSlopeLaunch) p.vy = prevSlopeLaunch * p.grav;
  }

  if (p.onGround) {
    if (!p.wasGround && p.airTime > 0.06) events && events.push({ type: 'land', x: p.x, y: p.y - h * p.grav, v: p.airTime });
    p.airTime = 0;
    if (p.mode !== 'robot') p.robotHold = 0;
  } else p.airTime += DT;

  // ---- hazards & interactive objects
  if (!state.dead) interact(world, state, p, events);

  // ---- position triggers
  while (state.trigCursor < world.posTriggers.length && world.posTriggers[state.trigCursor].x <= p.x) {
    const ro = world.posTriggers[state.trigCursor++];
    if (!state.trigFired[ro.trig]) {
      state.trigFired[ro.trig] = 1;
      fireTrigger(world, state, ro, events);
    }
  }

  updateRotation(p, speed);

  state.progress = clamp(p.x / world.length, 0, 1);
  if (!state.dead && p.x >= world.length) {
    state.complete = true;
    state.progress = 1;
    events && events.push({ type: 'complete' });
  }
}

/**
 * Resolve overlap with a solid box.
 * @returns 1 landed, 2 ceiling, 0 unresolved (caller checks inner hitbox)
 */
function resolveSolid(p, g, h, prevY, tol, canCeil) {
  if (p.grav === 1) {
    if (p.vy <= 0 && prevY - h >= g.y1 - tol) {
      p.y = g.y1 + h;
      p.vy = 0;
      p.onGround = true;
      return 1;
    }
    if (canCeil && p.vy >= 0 && prevY + h <= g.y0 + tol) {
      p.y = g.y0 - h;
      p.vy = 0;
      p.onCeil = true;
      return 2;
    }
  } else {
    if (p.vy >= 0 && prevY + h <= g.y0 + tol) {
      p.y = g.y0 - h;
      p.vy = 0;
      p.onGround = true;
      return 1;
    }
    if (canCeil && p.vy <= 0 && prevY - h >= g.y1 - tol) {
      p.y = g.y1 + h;
      p.vy = 0;
      p.onCeil = true;
      return 2;
    }
  }
  return 0;
}

function slopeSurface(sl, X) {
  const t = clamp(X, sl.x0, sl.x1) - sl.x0;
  return sl.rising ? sl.y0 + t * sl.k : sl.y1 - t * sl.k;
}

function collideSlope(state, p, g, sl, h, ih, prevY, tol, canCeil, speed, events) {
  // Horizontal overlap with the slope's footprint.
  const xa = Math.max(p.x - h, sl.x0);
  const xb = Math.min(p.x + h, sl.x1);
  if (xa >= xb) return;
  // Work in a frame where the solid side is below the surface.
  const mirror = !sl.faceUp;
  const cy = sl.y0 + sl.y1;
  const y = mirror ? cy - p.y : p.y;
  const py = mirror ? cy - prevY : prevY;
  const vy = mirror ? -p.vy : p.vy;
  const G = mirror ? -p.grav : p.grav;
  const surf = sl.rising ? slopeSurface(sl, xb) : slopeSurface(sl, xa);
  const bottom = y - h;
  const top = y + h;
  const rise = sl.k * speed * 2 / 240 + 0.02;
  let newY = null;
  let landed = false;
  let ceiling = false;

  if (G === 1) {
    if (bottom < surf && top > sl.y0) {
      if (surf - bottom <= tol + rise || (vy <= 0 && py - h >= surf - tol - rise)) {
        newY = surf + h;
        landed = true;
      } else if (py + h <= sl.y0 + tol && canCeil) {
        newY = sl.y0 - h;
        ceiling = true;
      }
    } else if (p.wasGround && vy <= 0 && bottom >= surf && bottom - surf <= rise + 0.04 && p.mode !== 'wave' && p.mode !== 'ship' && p.mode !== 'ufo') {
      newY = surf + h; // stick to descending slopes
      landed = true;
    }
  } else if (bottom < surf && top > sl.y0) {
    // Gravity points away from the surface: the flat underside is a floor, the surface a ceiling.
    if (vy >= 0 && py + h <= sl.y0 + tol) {
      newY = sl.y0 - h;
      landed = true;
    } else if (canCeil && surf - bottom <= tol + rise) {
      newY = surf + h;
      ceiling = true;
    }
  }

  if (newY !== null) {
    p.y = mirror ? cy - newY : newY;
    if (landed) {
      p.onGround = true;
      p.vy = 0;
      if (G === 1 && sl.rising) p.slopeLaunch = sl.k * speed * 0.9;
    } else if (ceiling) {
      p.onCeil = true;
      p.vy = 0;
    }
    return;
  }
  // Deep penetration from the side: crash if the core touches the triangle.
  const core = { x0: p.x - ih, x1: p.x + ih, y0: p.y - ih, y1: p.y + ih };
  if (g.poly ? polyAabbOverlap(g.poly, core) : aabbOverlap(g, core)) {
    const tri = slopePoly(sl);
    if (polyAabbOverlap(tri, core)) kill(state, events, 'slope');
  }
}

function slopePoly(sl) {
  // Triangle in world space from slope info.
  const { x0, x1, y0, y1, rising, faceUp } = sl;
  if (faceUp) return rising ? [x0, y0, x1, y0, x1, y1] : [x0, y0, x1, y0, x0, y1];
  return rising ? [x0, y1, x1, y1, x1, y0] : [x0, y1, x1, y1, x0, y0];
}

function applyOrb(p, variant) {
  const mul = LAUNCH_MUL[p.mode] * (p.mini ? MINI.jumpMul : 1);
  p.onGround = false;
  p.robotHold = 0;
  switch (variant) {
    case 'blue':
      p.grav = -p.grav;
      p.vy = -ORB_VEL.blue * p.grav;
      break;
    case 'green':
      p.grav = -p.grav;
      p.vy = -ORB_VEL.green * Math.max(0.5, LAUNCH_MUL[p.mode] || 0.6) * p.grav;
      break;
    case 'black':
      if (p.mode === 'wave') return;
      p.vy = ORB_VEL.black * Math.max(mul, 0.5) * p.grav;
      break;
    default:
      if (p.mode === 'wave') return;
      p.vy = ORB_VEL[variant] * mul * p.grav;
      break;
  }
}

function applyPad(p, variant) {
  p.onGround = false;
  p.robotHold = 0;
  if (variant === 'blue') {
    p.grav = -p.grav;
    p.vy = -PAD_VEL.blue * p.grav;
    return;
  }
  if (p.mode === 'wave') return;
  const mul = LAUNCH_MUL[p.mode] * (p.mini ? MINI.jumpMul : 1);
  p.vy = PAD_VEL[variant] * mul * p.grav;
}

function spiderTeleport(world, state, p, h, events) {
  // Flip gravity and snap to the nearest surface in the new "down" direction.
  const dir = -p.grav; // world direction we travel
  const fromY = p.y;
  let best = dir === 1 ? p.ceilY - h : p.floorY + h;
  const range = PHYS.spider.teleportRange;
  const list = queryRange(world, state, p.x - h, p.x + h);
  for (let k = 0; k < list.length; k++) {
    const ro = list[k];
    if (ro.kind !== 'solid' && ro.kind !== 'crumble' && ro.kind !== 'slope') continue;
    if (!isObjectEnabled(state, ro)) continue;
    if (ro.kind === 'crumble' && state.actTime[ro.i] > 0 && state.time >= state.actTime[ro.i] + ro.props.delay) continue;
    const g = currentGeometry(world, state, ro);
    if (g.x1 <= p.x - h || g.x0 >= p.x + h) continue;
    if (dir === 1 && g.y0 >= p.y + h - 0.01) best = Math.min(best, g.y0 - h);
    if (dir === -1 && g.y1 <= p.y - h + 0.01) best = Math.max(best, g.y1 + h);
  }
  p.grav = -p.grav;
  p.onGround = false;
  if (Number.isFinite(best) && Math.abs(best - p.y) <= range) {
    p.y = best;
    p.py = best; // no interpolation streak through geometry
    p.vy = 0;
    p.onGround = true;
  } else {
    p.vy = PHYS.spider.freeFlip * dir;
  }
  events && events.push({ type: 'teleport', x: p.x, y0: fromY, y1: p.y });
}

function interact(world, state, p, events) {
  const h = playerHalf(p);
  setBox(outer, p, h);
  const list = queryRange(world, state, outer.x0 - 2, outer.x1 + 2);
  for (let k = 0; k < list.length; k++) {
    const ro = list[k];
    const kind = ro.kind;
    if (kind === 'solid' || kind === 'slope' || kind === 'crumble' || kind === 'orb') continue;
    if (state.act[ro.i] && kind !== 'hazard') continue;
    if (!isObjectEnabled(state, ro)) continue;
    const g = currentGeometry(world, state, ro);
    setBox(outer, p, h);
    if (!hitTest(g, outer)) continue;
    switch (kind) {
      case 'hazard':
        kill(state, events, 'hazard');
        return;
      case 'pad':
        state.act[ro.i] = 1;
        applyPad(p, ro.d.variant);
        events && events.push({ type: 'pad', variant: ro.d.variant, x: ro.x, y: ro.y });
        break;
      case 'coin': {
        state.act[ro.i] = 1;
        const idx = clamp(ro.props.index | 0, 0, 2);
        state.coins[idx] = true;
        events && events.push({ type: 'coin', index: idx, x: g.x0 + (g.x1 - g.x0) / 2, y: g.y0 + (g.y1 - g.y0) / 2 });
        break;
      }
      case 'portal':
        state.act[ro.i] = 1;
        applyPortal(world, state, p, ro, g, events);
        break;
      default:
        break;
    }
  }
  // touch triggers
  for (const ro of world.touchTriggers) {
    if (state.trigFired[ro.trig]) continue;
    if (Math.abs(ro.x - p.x) > 2) continue;
    objectTransform(world, state, ro, tmpT);
    if (Math.abs(tmpT.x - p.x) < 0.5 + h && Math.abs(tmpT.y - p.y) < 0.5 + h) {
      state.trigFired[ro.trig] = 1;
      fireTrigger(world, state, ro, events);
    }
  }
}

function applyPortal(world, state, p, ro, g, events) {
  const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2;
  switch (ro.d.action) {
    case 'mode': {
      const m = ro.d.value;
      const changed = m !== p.mode;
      const prevH = playerHalf(p);
      p.mode = m;
      const corridor = ro.props.corridor ?? MODE_CORRIDOR[m];
      const b = corridorBounds(cy, corridor);
      p.floorY = b.floorY;
      p.ceilY = b.ceilY;
      if (changed) {
        if (m === 'ship' || m === 'ufo' || m === 'ball') p.vy *= 0.5;
        if (m === 'wave' || m === 'spider') p.vy = 0;
        p.robotHold = 0;
        // keep feet on the same surface when the hitbox size changes
        if (p.onGround || p.wasGround) p.y += (playerHalf(p) - prevH) * p.grav;
      }
      events && events.push({ type: 'portal', action: 'mode', value: m, x: cx, y: cy, tint: ro.d.tint, changed, floorY: p.floorY, ceilY: p.ceilY });
      break;
    }
    case 'gravity':
      if (p.grav !== ro.d.value) {
        p.grav = ro.d.value;
        p.vy *= 0.5;
        p.onGround = false;
      }
      events && events.push({ type: 'portal', action: 'gravity', value: ro.d.value, x: cx, y: cy, tint: ro.d.tint });
      break;
    case 'size': {
      const prevH = playerHalf(p);
      p.mini = ro.d.value;
      if (p.onGround || p.wasGround) p.y += (playerHalf(p) - prevH) * p.grav;
      events && events.push({ type: 'portal', action: 'size', value: ro.d.value, x: cx, y: cy, tint: ro.d.tint });
      break;
    }
    case 'speed':
      p.speed = ro.d.value;
      events && events.push({ type: 'portal', action: 'speed', value: ro.d.value, x: cx, y: cy, tint: ro.d.tint });
      break;
    case 'teleport': {
      const from = p.y;
      p.y += ro.props.dy;
      p.py = p.y;
      p.onGround = false;
      events && events.push({ type: 'teleport', x: p.x, y0: from, y1: p.y, portal: true });
      break;
    }
    default:
      break;
  }
}

function updateRotation(p, speed) {
  const h = playerHalf(p);
  switch (p.mode) {
    case 'cube':
      if (p.onGround) {
        const target = Math.round(p.rot / 90) * 90;
        p.rot = approach(p.rot, target, 900 * DT);
      } else p.rot += CUBE_SPIN * DT * p.grav * (p.mini ? 1.15 : 1);
      break;
    case 'ship':
    case 'wave': {
      const target = (-Math.atan2(p.vy, speed) * 180) / Math.PI;
      const k = p.mode === 'wave' ? 1 : 0.25;
      p.rot += (target - p.rot) * k;
      break;
    }
    case 'ball':
      p.rot += ((speed / Math.max(h, 0.1)) * 180 / Math.PI) * DT * p.grav * 0.6;
      break;
    case 'ufo': {
      const target = clamp(-p.vy * 0.8, -12, 12);
      p.rot += (target - p.rot) * 0.15;
      break;
    }
    default:
      p.rot = approach(p.rot, 0, 1200 * DT);
      break;
  }
  // keep the angle bounded to avoid precision loss on long levels
  if (p.rot > 3600 || p.rot < -3600) {
    const wrap = Math.round(p.rot / 360) * 360;
    p.rot -= wrap;
    p.prot -= wrap;
  }
}

export { spawnGroup };
