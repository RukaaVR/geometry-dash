// Compiles normalised level data into an immutable runtime World: resolved object
// definitions, precomputed collision geometry, a spatial index, trigger tables and
// the time<->position timeline used for music synchronisation.

import { getDef, defaultProps } from '../objects/registry.js';
import { computeLevelLength } from '../level/format.js';
import { buildHitGeometry, buildSlopeInfo } from './geometry.js';
import { SPEEDS, MODE_CORRIDOR } from '../constants.js';
import { hexToRgb } from '../../core/math.js';

export const BUCKET = 2; // spatial bucket width in blocks

const COLLIDABLE = new Set(['solid', 'slope', 'crumble', 'hazard', 'pad', 'orb', 'portal', 'coin']);
const TRANSFORMING_TRIGGERS = new Set(['trig_move', 'trig_rotate', 'trig_scale']);

export function compileLevel(level) {
  const objects = [];
  const movedGroups = new Set();
  for (const o of level.objects) {
    if (TRANSFORMING_TRIGGERS.has(o.t)) {
      const target = o.p && o.p.target !== undefined ? o.p.target : 1;
      movedGroups.add(target);
    }
  }

  const groupMembers = new Map();
  const triggers = [];
  const startPositions = [];
  let coinCount = 0;

  level.objects.forEach((src, index) => {
    const d = getDef(src.t);
    if (!d) return;
    const props = { ...defaultProps(d), ...(src.p || {}) };
    const s = src.s || 1;
    const ro = {
      i: objects.length,
      src: index,
      d,
      kind: d.kind,
      x: src.x,
      y: src.y,
      rot: src.r || 0,
      sx: s * (src.fx ? -1 : 1),
      sy: s * (src.fy ? -1 : 1),
      scale: s,
      fx: !!src.fx,
      fy: !!src.fy,
      color: src.c || d.color,
      z: src.z !== undefined ? src.z : d.layer,
      alpha: src.a !== undefined ? src.a : 1,
      groups: src.g || null,
      props,
      dynamic: false,
      geom: null,
      slope: null,
      trig: -1,
    };
    if (ro.groups) {
      for (const g of ro.groups) {
        if (movedGroups.has(g)) ro.dynamic = true;
        if (!groupMembers.has(g)) groupMembers.set(g, []);
        groupMembers.get(g).push(ro.i);
      }
    }
    if (d.hit) {
      ro.geom = buildHitGeometry(d.hit, ro.x, ro.y, ro.rot, ro.sx, ro.sy);
      if (d.kind === 'slope') ro.slope = buildSlopeInfo(ro.geom, ro.fx, ro.fy);
    }
    if (d.kind === 'trigger') {
      ro.trig = triggers.length;
      triggers.push(ro);
    }
    if (d.kind === 'startpos') startPositions.push(ro);
    if (d.kind === 'coin') coinCount++;
    objects.push(ro);
  });

  // ---------------------------------------------------------------- spatial index
  const length = computeLevelLength(level);
  const bucketCount = Math.max(1, Math.ceil((length + 40) / BUCKET) + 1);
  const buckets = Array.from({ length: bucketCount }, () => []);
  const negBucket = []; // anything left of x = 0
  const dynamicCollidables = [];
  for (const ro of objects) {
    if (!COLLIDABLE.has(ro.kind) || !ro.geom) continue;
    if (ro.dynamic) {
      dynamicCollidables.push(ro);
      continue;
    }
    const b0 = Math.floor(ro.geom.x0 / BUCKET);
    const b1 = Math.floor(ro.geom.x1 / BUCKET);
    for (let b = b0; b <= b1; b++) {
      if (b < 0) {
        if (!negBucket.includes(ro)) negBucket.push(ro);
      } else if (b < bucketCount) buckets[b].push(ro);
      else buckets[bucketCount - 1].push(ro);
    }
  }

  // ---------------------------------------------------------------- render ordering
  // Static objects sorted by left edge for fast culling; dynamic ones are checked each frame.
  const renderStatic = [];
  const renderDynamic = [];
  let maxHalfExtent = 1;
  for (const ro of objects) {
    if (ro.kind === 'trigger' || ro.kind === 'startpos') continue;
    const ext = (Math.max(ro.d.w, ro.d.h) * ro.scale) / 2;
    ro.extent = ext * 1.5;
    if (ro.dynamic) renderDynamic.push(ro);
    else {
      renderStatic.push(ro);
      maxHalfExtent = Math.max(maxHalfExtent, ro.extent);
    }
  }
  renderStatic.sort((a, b) => a.x - b.x);

  // ---------------------------------------------------------------- triggers
  const posTriggers = triggers
    .filter((t) => !t.props.touch && !t.props.spawned)
    .sort((a, b) => a.x - b.x || a.src - b.src);
  const touchTriggers = triggers.filter((t) => t.props.touch && !t.props.spawned);
  const groupTriggers = new Map(); // group id -> triggers that a spawn trigger can activate
  for (const t of triggers) {
    if (!t.groups) continue;
    for (const g of t.groups) {
      if (!groupTriggers.has(g)) groupTriggers.set(g, []);
      groupTriggers.get(g).push(t);
    }
  }

  // ---------------------------------------------------------------- group pivots
  const groupCenters = new Map();
  for (const [g, members] of groupMembers) {
    let sx = 0, sy = 0, n = 0;
    for (const i of members) {
      if (objects[i].kind === 'trigger') continue;
      sx += objects[i].x;
      sy += objects[i].y;
      n++;
    }
    if (n) groupCenters.set(g, { x: sx / n, y: sy / n });
  }

  const colors = {};
  for (const [k, v] of Object.entries(level.colors)) colors[k] = hexToRgb(v);

  const world = {
    level,
    objects,
    length,
    buckets,
    negBucket,
    bucketCount,
    dynamicCollidables,
    renderStatic,
    renderDynamic,
    maxHalfExtent,
    triggers,
    posTriggers,
    touchTriggers,
    groupTriggers,
    groupMembers,
    groupCenters,
    startPositions,
    coinCount,
    baseColors: colors,
    queryStamp: new Uint32Array(objects.length),
    queryId: 1,
    timeline: null,
  };
  world.timeline = buildTimeline(world);
  return world;
}

/** Initial player configuration from level settings. */
export function levelStartConfig(level) {
  const s = level.settings;
  return {
    x: 0,
    mode: s.mode,
    speed: s.speed,
    grav: s.gravity,
    mini: s.mini,
    corridor: s.corridor || (s.mode !== 'cube' && s.mode !== 'robot' ? MODE_CORRIDOR[s.mode] : 0),
  };
}

// ------------------------------------------------------------------ timeline

/**
 * Piecewise-linear mapping between player x and elapsed time, derived from speed
 * portals. Used to start the music at the right point and for editor beat guides.
 */
export function buildTimeline(world) {
  const start = levelStartConfig(world.level);
  const portals = world.objects
    .filter((o) => o.kind === 'portal' && o.d.action === 'speed')
    .sort((a, b) => a.x - b.x);
  const segs = [{ x: start.x, t: 0, speed: SPEEDS[start.speed] }];
  for (const p of portals) {
    const last = segs[segs.length - 1];
    const hitX = p.geom ? p.geom.x0 : p.x; // portals activate on first contact
    if (hitX <= last.x) {
      if (hitX <= start.x) segs[0].speed = SPEEDS[p.d.value];
      continue;
    }
    const t = last.t + (hitX - last.x) / last.speed;
    segs.push({ x: hitX, t, speed: SPEEDS[p.d.value] });
  }
  return segs;
}

export function timeAtX(timeline, x) {
  let seg = timeline[0];
  for (let i = 1; i < timeline.length && timeline[i].x <= x; i++) seg = timeline[i];
  return seg.t + (x - seg.x) / seg.speed;
}

export function xAtTime(timeline, t) {
  let seg = timeline[0];
  for (let i = 1; i < timeline.length && timeline[i].t <= t; i++) seg = timeline[i];
  return seg.x + (t - seg.t) * seg.speed;
}
