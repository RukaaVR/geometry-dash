// Level object rendering. Static axis-aligned blocks and spikes are batched into a
// handful of paths per colour (one fill + one stroke per batch) which keeps draw
// calls low even for dense levels. Everything else is drawn individually.

import { DEG, rgbCss, mixRgb, clamp } from '../core/math.js';
import { objectTransform, pulseAmount } from '../game/sim/triggers.js';

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

// ------------------------------------------------------------------ preparation

/** One-time per-world render data: exposed block edges for merged outlines. */
export function prepareWorldRender(world) {
  if (world.renderPrep) return world.renderPrep;
  const cells = new Map();
  const key = (x, y) => Math.round(x * 2) + ',' + Math.round(y * 2);
  for (const ro of world.objects) {
    if (ro.d.draw !== 'block' || ro.dynamic || ro.scale !== 1 || ro.rot % 90 !== 0) continue;
    cells.set(key(ro.x, ro.y) + '|' + ro.color + '|' + ro.props.style, ro);
  }
  for (const ro of world.objects) {
    if (ro.d.draw !== 'block') continue;
    if (ro.dynamic || ro.scale !== 1 || ro.rot % 90 !== 0) {
      ro.edges = 15;
      continue;
    }
    const suffix = '|' + ro.color + '|' + ro.props.style;
    const has = (dx, dy) => cells.has(key(ro.x + dx, ro.y + dy) + suffix);
    ro.edges = (has(0, 1) ? 0 : 1) | (has(1, 0) ? 0 : 2) | (has(0, -1) ? 0 : 4) | (has(-1, 0) ? 0 : 8);
  }
  world.renderPrep = { ok: true };
  return world.renderPrep;
}

// ------------------------------------------------------------------ colours

/** Resolve channel colours for this frame, including channel pulses. */
export function resolveColors(state, highContrast = false) {
  const out = {};
  for (const ch in state.colors) out[ch] = state.colors[ch];
  for (const pu of state.pulses) {
    if (pu.mode !== 'channel') continue;
    const a = pulseAmount(pu, state.time);
    if (a > 0 && out[pu.ch]) out[pu.ch] = mixRgb(out[pu.ch], pu.color, a);
  }
  if (highContrast) {
    out.obj = WHITE;
    out.bg = mixRgb(out.bg, BLACK, 0.55);
  }
  return out;
}

function groupPulse(state, ro, col) {
  if (!ro.groups || !state.pulses.length) return col;
  for (const pu of state.pulses) {
    if (pu.mode !== 'group' || !ro.groups.includes(pu.g)) continue;
    const a = pulseAmount(pu, state.time);
    if (a > 0) col = mixRgb(col, pu.color, a);
  }
  return col;
}

// ------------------------------------------------------------------ batching

class Batch {
  constructor() {
    this.map = new Map();
  }
  get(key, init) {
    let b = this.map.get(key);
    if (!b) {
      b = { fill: new Path2D(), stroke: new Path2D(), detail: new Path2D(), ...init };
      this.map.set(key, b);
    }
    return b;
  }
  flush(ctx) {
    for (const b of this.map.values()) {
      if (b.fillStyle) {
        ctx.fillStyle = b.fillStyle;
        ctx.fill(b.fill);
      }
      if (b.detailStyle) {
        ctx.strokeStyle = b.detailStyle;
        ctx.lineWidth = b.detailWidth || 0.04;
        ctx.stroke(b.detail);
      }
      if (b.strokeStyle) {
        ctx.strokeStyle = b.strokeStyle;
        ctx.lineWidth = b.lineWidth || 0.07;
        ctx.stroke(b.stroke);
      }
    }
    this.map.clear();
  }
}

// ------------------------------------------------------------------ main entry

const tmpT = { x: 0, y: 0, rot: 0, scale: 1, alpha: 1, on: true };

export class ObjectRenderer {
  constructor(renderer) {
    this.r = renderer;
    this.batch = new Batch();
    this.visible = { back: [], main: [], portals: [], front: [] };
  }

  /**
   * Collect visible objects into layers. `view` = {x0,x1,y0,y1} in world units.
   * opts.editor shows triggers/start positions; opts.hidden = Set of object indices to skip.
   */
  collect(world, state, view, opts = {}) {
    const v = this.visible;
    v.back.length = v.main.length = v.portals.length = v.front.length = 0;
    const list = world.renderStatic;
    // binary search first candidate
    let lo = 0, hi = list.length;
    const minX = view.x0 - world.maxHalfExtent;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].x < minX) lo = mid + 1;
      else hi = mid;
    }
    const push = (ro, x, y, rot, scale, alpha) => {
      const item = { ro, x, y, rot, scale, alpha };
      if (ro.z < 0) v.back.push(item);
      else if (ro.z > 1) v.front.push(item);
      else if (ro.kind === 'portal') v.portals.push(item);
      else v.main.push(item);
    };
    for (let i = lo; i < list.length; i++) {
      const ro = list[i];
      if (ro.x - ro.extent > view.x1) break;
      if (ro.y + ro.extent < view.y0 || ro.y - ro.extent > view.y1) continue;
      if (ro.x + ro.extent < view.x0) continue;
      if (opts.hidden && opts.hidden.has(ro.i)) continue;
      let alpha = ro.alpha, on = true;
      if (ro.groups) {
        objectTransform(world, state, ro, tmpT);
        alpha = tmpT.alpha;
        on = tmpT.on;
        if (!on && !opts.editor) continue;
      }
      push(ro, ro.x, ro.y, ro.rot, 1, on ? alpha : alpha * 0.3);
    }
    for (const ro of world.renderDynamic) {
      if (opts.hidden && opts.hidden.has(ro.i)) continue;
      objectTransform(world, state, ro, tmpT);
      if (!tmpT.on && !opts.editor) continue;
      if (tmpT.x + ro.extent * tmpT.scale < view.x0 || tmpT.x - ro.extent * tmpT.scale > view.x1) continue;
      if (tmpT.y + ro.extent * tmpT.scale < view.y0 || tmpT.y - ro.extent * tmpT.scale > view.y1) continue;
      push(ro, tmpT.x, tmpT.y, tmpT.rot, tmpT.scale, tmpT.on ? tmpT.alpha : tmpT.alpha * 0.3);
    }
    if (opts.editor) {
      for (const ro of world.objects) {
        if (ro.kind !== 'trigger' && ro.kind !== 'startpos') continue;
        if (ro.x < view.x0 - 1 || ro.x > view.x1 + 1 || ro.y < view.y0 - 1 || ro.y > view.y1 + 1) continue;
        if (opts.hidden && opts.hidden.has(ro.i)) continue;
        v.front.push({ ro, x: ro.x, y: ro.y, rot: 0, scale: 1, alpha: 1 });
      }
    }
    v.main.sort(drawOrder);
    v.back.sort((a, b) => a.ro.z - b.ro.z);
    v.front.sort((a, b) => a.ro.z - b.ro.z);
  }

  /**
   * Draw a layer: 'back' | 'main' | 'portals' | 'portalFronts' | 'front'.
   * fx: {time, beat (0..1 pulse), colors, glow, state, collectedCoins}
   */
  draw(layer, fx) {
    const ctx = this.r.ctx;
    const items = layer === 'portalFronts' ? this.visible.portals : this.visible[layer];
    if (!items.length) return;
    const base = ctx.getTransform();
    for (const it of items) {
      const ro = it.ro;
      let col = fx.colors[ro.color] || WHITE;
      if (ro.groups) col = groupPulse(fx.state, ro, col);
      const painter = PAINTERS[ro.d.draw];
      if (!painter) continue;
      if (layer === 'portalFronts') {
        if (painter.front) {
          setLocal(ctx, base, it);
          ctx.globalAlpha = it.alpha;
          painter.front(ctx, it, col, fx, this);
        }
        continue;
      }
      if (painter.batch && it.alpha >= 0.999 && it.scale === 1 && !ro.dynamic && it.rot % 90 === 0 && !ro.groups) {
        painter.batch(this.batch, it, col, fx);
        continue;
      }
      setLocal(ctx, base, it);
      ctx.globalAlpha = it.alpha;
      painter(ctx, it, col, fx, this);
    }
    ctx.setTransform(base);
    ctx.globalAlpha = 1;
    this.batch.flush(ctx);
  }
}

const ORDER = { deco: 0, solid: 1, slope: 1, crumble: 1, hazard: 2, pad: 3, coin: 4, orb: 4, portal: 5, trigger: 6, startpos: 6 };
function drawOrder(a, b) {
  return (ORDER[a.ro.kind] ?? 3) - (ORDER[b.ro.kind] ?? 3) || a.ro.z - b.ro.z;
}

function setLocal(ctx, base, it) {
  const ro = it.ro;
  const a = -it.rot * DEG;
  const c = Math.cos(a), s = Math.sin(a);
  const sx = ro.sx * it.scale, sy = ro.sy * it.scale;
  // base * translate(x,y) * rotate(a) * scale(sx,sy)
  const m = base;
  const a1 = c * sx, b1 = s * sx, c1 = -s * sy, d1 = c * sy;
  ctx.setTransform(
    m.a * a1 + m.c * b1, m.b * a1 + m.d * b1,
    m.a * c1 + m.c * d1, m.b * c1 + m.d * d1,
    m.a * it.x + m.c * it.y + m.e, m.b * it.x + m.d * it.y + m.f,
  );
}

// ------------------------------------------------------------------ painters
// Local space: y up, object centred at origin, 1 unit = 1 block (before scale).

const dark = (c, k = 0.86) => mixRgb(c, BLACK, k);

function blockStyleColors(style, col) {
  switch (style) {
    case 'solid':
      return { fill: rgbCss(mixRgb(col, BLACK, 0.45)), stroke: rgbCss(col), detail: rgbCss(mixRgb(col, WHITE, 0.3), 0.35) };
    case 'glass':
      return { fill: rgbCss(col, 0.14), stroke: rgbCss(col, 0.9), detail: rgbCss(col, 0.4) };
    case 'outline':
      return { fill: null, stroke: rgbCss(col), detail: null };
    case 'brick':
      return { fill: rgbCss(dark(col, 0.8)), stroke: rgbCss(col), detail: rgbCss(col, 0.35) };
    case 'tech':
      return { fill: rgbCss(dark(col, 0.84)), stroke: rgbCss(col), detail: rgbCss(col, 0.5) };
    default:
      return { fill: rgbCss(dark(col, 0.86)), stroke: rgbCss(col), detail: rgbCss(col, 0.28) };
  }
}

function addBlockDetail(path, style, x0, y0, w, h) {
  switch (style) {
    case 'grid':
      path.rect(x0 + 0.2 * w, y0 + 0.2 * h, 0.6 * w, 0.6 * h);
      break;
    case 'brick':
      path.moveTo(x0, y0 + h / 2);
      path.lineTo(x0 + w, y0 + h / 2);
      path.moveTo(x0 + w / 2, y0 + h / 2);
      path.lineTo(x0 + w / 2, y0 + h);
      path.moveTo(x0 + w / 4, y0);
      path.lineTo(x0 + w / 4, y0 + h / 2);
      break;
    case 'tech':
      path.moveTo(x0 + 0.15 * w, y0 + 0.5 * h);
      path.lineTo(x0 + 0.45 * w, y0 + 0.5 * h);
      path.lineTo(x0 + 0.6 * w, y0 + 0.75 * h);
      path.lineTo(x0 + 0.85 * w, y0 + 0.75 * h);
      path.rect(x0 + 0.6 * w, y0 + 0.2 * h, 0.2 * w, 0.2 * h);
      break;
    case 'solid':
      path.moveTo(x0 + 0.1 * w, y0 + 0.88 * h);
      path.lineTo(x0 + 0.9 * w, y0 + 0.88 * h);
      break;
    case 'glass':
      path.moveTo(x0 + 0.15 * w, y0 + 0.55 * h);
      path.lineTo(x0 + 0.45 * w, y0 + 0.85 * h);
      break;
    default:
      break;
  }
}

function paintBlock(ctx, it, col) {
  const style = it.ro.props.style || 'grid';
  const st = blockStyleColors(style, col);
  const h = it.ro.d.h;
  const y0 = -h / 2;
  if (st.fill) {
    ctx.fillStyle = st.fill;
    ctx.fillRect(-0.5, y0, 1, h);
  }
  if (st.detail) {
    const p = new Path2D();
    addBlockDetail(p, style, -0.5, y0, 1, h);
    ctx.strokeStyle = st.detail;
    ctx.lineWidth = 0.04;
    ctx.stroke(p);
  }
  ctx.strokeStyle = st.stroke;
  ctx.lineWidth = 0.07;
  ctx.strokeRect(-0.5 + 0.035, y0 + 0.035, 0.93, h - 0.07);
}
paintBlock.batch = (batch, it, col) => {
  const ro = it.ro;
  const style = ro.props.style || 'grid';
  const key = 'b|' + style + '|' + ro.color + '|' + (col.r | 0) + ',' + (col.g | 0) + ',' + (col.b | 0);
  const st = blockStyleColors(style, col);
  const b = batch.get(key, { fillStyle: st.fill, strokeStyle: st.stroke, detailStyle: st.detail, lineWidth: 0.07 });
  const rotated = ro.rot % 180 !== 0;
  const w = rotated ? ro.d.h : ro.d.w, h = rotated ? ro.d.w : ro.d.h;
  const x0 = it.x - w / 2, y0 = it.y - h / 2;
  b.fill.rect(x0, y0, w, h);
  if (st.detail) addBlockDetail(b.detail, style, x0, y0, w, h);
  const e = ro.edges ?? 15;
  const i = 0.035;
  if (e === 15) b.stroke.rect(x0 + i, y0 + i, w - 2 * i, h - 2 * i);
  else {
    if (e & 1) { b.stroke.moveTo(x0, y0 + h - i); b.stroke.lineTo(x0 + w, y0 + h - i); }
    if (e & 2) { b.stroke.moveTo(x0 + w - i, y0); b.stroke.lineTo(x0 + w - i, y0 + h); }
    if (e & 4) { b.stroke.moveTo(x0, y0 + i); b.stroke.lineTo(x0 + w, y0 + i); }
    if (e & 8) { b.stroke.moveTo(x0 + i, y0); b.stroke.lineTo(x0 + i, y0 + h); }
  }
};

function paintSlab(ctx, it, col) {
  paintBlock(ctx, it, col);
}
paintSlab.batch = (batch, it, col) => {
  const ro = it.ro;
  const style = ro.props.style || 'grid';
  const st = blockStyleColors(style, col);
  const key = 's|' + style + '|' + (col.r | 0) + ',' + (col.g | 0) + ',' + (col.b | 0);
  const b = batch.get(key, { fillStyle: st.fill, strokeStyle: st.stroke, detailStyle: st.detail });
  const rotated = ro.rot % 180 !== 0;
  const w = rotated ? ro.d.h : ro.d.w, h = rotated ? ro.d.w : ro.d.h;
  b.fill.rect(it.x - w / 2, it.y - h / 2, w, h);
  b.stroke.rect(it.x - w / 2 + 0.035, it.y - h / 2 + 0.035, w - 0.07, h - 0.07);
};

function paintLedge(ctx, it, col) {
  ctx.fillStyle = rgbCss(dark(col, 0.6));
  ctx.fillRect(-0.5, -0.125, 1, 0.25);
  ctx.strokeStyle = rgbCss(col);
  ctx.lineWidth = 0.06;
  ctx.strokeRect(-0.47, -0.095, 0.94, 0.19);
}

function paintSlope(ctx, it, col) {
  const w = it.ro.d.w;
  const style = it.ro.props.style || 'grid';
  const st = blockStyleColors(style, col);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -0.5);
  ctx.lineTo(w / 2, -0.5);
  ctx.lineTo(w / 2, 0.5);
  ctx.closePath();
  if (st.fill) {
    ctx.fillStyle = st.fill;
    ctx.fill();
  }
  ctx.strokeStyle = st.stroke;
  ctx.lineWidth = 0.07;
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (st.detail) {
    ctx.strokeStyle = st.detail;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 0.35 * w, -0.35);
    ctx.lineTo(w / 2 - 0.15, -0.35);
    ctx.lineTo(w / 2 - 0.15, 0.2);
    ctx.closePath();
    ctx.stroke();
  }
}

function paintCrumble(ctx, it, col, fx) {
  const st = fx.state;
  const t0 = st.actTime[it.ro.i];
  let k = 0;
  if (t0 > 0) {
    k = clamp((st.time - t0) / Math.max(0.05, it.ro.props.delay), 0, 1);
    if (k >= 1) return;
    ctx.translate((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06);
    ctx.globalAlpha *= 1 - k * 0.6;
  }
  ctx.fillStyle = rgbCss(dark(col, 0.75));
  ctx.fillRect(-0.5, -0.5, 1, 1);
  ctx.strokeStyle = rgbCss(col);
  ctx.lineWidth = 0.06;
  ctx.strokeRect(-0.465, -0.465, 0.93, 0.93);
  ctx.strokeStyle = rgbCss(col, 0.55);
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(-0.3, 0.5);
  ctx.lineTo(-0.1, 0.1);
  ctx.lineTo(-0.25, -0.15);
  ctx.moveTo(-0.1, 0.1);
  ctx.lineTo(0.25, 0.0);
  ctx.lineTo(0.35, -0.5);
  ctx.moveTo(0.25, 0);
  ctx.lineTo(0.5, 0.2);
  ctx.stroke();
}

function spikePts(kind) {
  if (kind === 'spike_small') return [-0.5, -0.25, 0, 0.25, 0.5, -0.25];
  return [-0.5, -0.5, 0, 0.5, 0.5, -0.5];
}

function paintSpike(ctx, it, col) {
  const p = spikePts(it.ro.d.id);
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[2], p[3]);
  ctx.lineTo(p[4], p[5]);
  ctx.closePath();
  ctx.fillStyle = rgbCss(dark(col, 0.88));
  ctx.fill();
  ctx.strokeStyle = rgbCss(col);
  ctx.lineWidth = 0.07;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = rgbCss(col, 0.3);
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  ctx.moveTo(p[0] * 0.5, p[1] * 0.6 + p[3] * 0.1);
  ctx.lineTo(0, p[3] * 0.45);
  ctx.lineTo(p[4] * 0.5, p[5] * 0.6 + p[3] * 0.1);
  ctx.stroke();
}
paintSpike.batch = (batch, it, col) => {
  const ro = it.ro;
  const key = 'k|' + (col.r | 0) + ',' + (col.g | 0) + ',' + (col.b | 0);
  const b = batch.get(key, { fillStyle: rgbCss(dark(col, 0.88)), strokeStyle: rgbCss(col), detailStyle: rgbCss(col, 0.3) });
  const p = spikePts(ro.d.id);
  const a = -it.rot * DEG;
  const c = Math.cos(a), s = Math.sin(a);
  const tx = (lx, ly) => {
    lx *= ro.sx;
    ly *= ro.sy;
    return [it.x + lx * c - ly * s, it.y + lx * s + ly * c];
  };
  const p0 = tx(p[0], p[1]), p1 = tx(p[2], p[3]), p2 = tx(p[4], p[5]);
  b.fill.moveTo(p0[0], p0[1]);
  b.fill.lineTo(p1[0], p1[1]);
  b.fill.lineTo(p2[0], p2[1]);
  b.fill.closePath();
  b.stroke.moveTo(p0[0], p0[1]);
  b.stroke.lineTo(p1[0], p1[1]);
  b.stroke.lineTo(p2[0], p2[1]);
  b.stroke.closePath();
  const d0 = tx(p[0] * 0.5, p[1] * 0.6 + p[3] * 0.1), d1 = tx(0, p[3] * 0.45), d2 = tx(p[4] * 0.5, p[5] * 0.6 + p[3] * 0.1);
  b.detail.moveTo(d0[0], d0[1]);
  b.detail.lineTo(d1[0], d1[1]);
  b.detail.lineTo(d2[0], d2[1]);
};

function paintThorns(ctx, it, col) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const x0 = -0.5 + i * 0.25;
    ctx.moveTo(x0, -0.2);
    ctx.lineTo(x0 + 0.125, 0.2);
    ctx.lineTo(x0 + 0.25, -0.2);
  }
  ctx.closePath();
  ctx.fillStyle = rgbCss(dark(col, 0.85));
  ctx.fill();
  ctx.strokeStyle = rgbCss(col);
  ctx.lineWidth = 0.05;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function paintSaw(ctx, it, col, fx) {
  const ro = it.ro;
  const r = ro.d.w / 2;
  const ang = (fx.time * (ro.props.spin || 0) * DEG) % (Math.PI * 2);
  ctx.rotate(-ang);
  const teeth = Math.round(10 + r * 4);
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.78 : r * 0.98;
    const a2 = a + (i % 2 ? 0 : 0.12);
    ctx.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = rgbCss(dark(col, 0.86));
  ctx.fill();
  ctx.strokeStyle = rgbCss(col);
  ctx.lineWidth = 0.06;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = rgbCss(col, 0.6);
  ctx.lineWidth = 0.05;
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.moveTo(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18);
    ctx.lineTo(Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = rgbCss(col);
  ctx.fill();
}

function tint(ro) {
  return ro.tintRgb || (ro.tintRgb = hexRgb(ro.d.tint || '#ffffff'));
}
function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function paintPad(ctx, it, col, fx, or) {
  const c = tint(it.ro);
  const used = fx.state.act[it.ro.i];
  if (fx.glow) or.r.glow(0, 0.05, 0.9, c, used ? 0.25 : 0.55 + fx.beat * 0.3);
  ctx.beginPath();
  ctx.moveTo(-0.45, -0.15);
  ctx.quadraticCurveTo(0, 0.42, 0.45, -0.15);
  ctx.closePath();
  ctx.fillStyle = rgbCss(c, used ? 0.6 : 0.95);
  ctx.fill();
  ctx.strokeStyle = rgbCss(mixRgb(c, WHITE, 0.5));
  ctx.lineWidth = 0.05;
  ctx.stroke();
  ctx.fillStyle = rgbCss(mixRgb(c, BLACK, 0.4));
  ctx.fillRect(-0.48, -0.15, 0.96, 0.06);
}

function paintOrb(ctx, it, col, fx, or) {
  const c = tint(it.ro);
  const used = fx.state.act[it.ro.i];
  const pulse = 1 + fx.beat * 0.1;
  const bright = it.ro.d.variant === 'black' ? mixRgb(c, WHITE, 0.25) : c;
  if (fx.glow) or.r.glow(0, 0, 1.1 * pulse, it.ro.d.variant === 'black' ? { r: 140, g: 60, b: 200 } : c, used ? 0.2 : 0.6);
  ctx.scale(pulse * (used ? 0.85 : 1), pulse * (used ? 0.85 : 1));
  // outer rotating ring
  ctx.save();
  ctx.rotate(-fx.time * 2);
  ctx.strokeStyle = rgbCss(bright, used ? 0.4 : 0.95);
  ctx.lineWidth = 0.07;
  ctx.setLineDash([0.22, 0.12]);
  ctx.beginPath();
  ctx.arc(0, 0, 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, 0.34, 0, Math.PI * 2);
  ctx.fillStyle = rgbCss(c, used ? 0.5 : 1);
  ctx.fill();
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = rgbCss(mixRgb(bright, WHITE, 0.6));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-0.1, 0.1, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
}

function ovalHalf(ctx, rx, ry, front) {
  ctx.beginPath();
  if (front) ctx.ellipse(0, 0, rx, ry, 0, -Math.PI / 2, Math.PI / 2);
  else ctx.ellipse(0, 0, rx, ry, 0, Math.PI / 2, (Math.PI * 3) / 2);
}

function paintPortalBase(ctx, it, fx, or, glyph) {
  const c = tint(it.ro);
  const h = it.ro.d.h / 2;
  if (fx.glow) or.r.glow(0, 0, h * 1.2, c, 0.35 + fx.beat * 0.15);
  // inner shimmer
  const g = ctx.createLinearGradient(-0.4, 0, 0.4, 0);
  g.addColorStop(0, rgbCss(c, 0));
  g.addColorStop(0.5, rgbCss(c, 0.28));
  g.addColorStop(1, rgbCss(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.38, h * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  // swirl lines
  ctx.strokeStyle = rgbCss(mixRgb(c, WHITE, 0.4), 0.5);
  ctx.lineWidth = 0.04;
  for (let k = 0; k < 3; k++) {
    const ph = (fx.time * 1.5 + k / 3) % 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.3 * (1 - ph), h * 0.85 * (1 - ph), 0, 0, Math.PI * 2);
    ctx.globalAlpha *= 1;
    ctx.stroke();
  }
  // back half of rim
  ovalHalf(ctx, 0.42, h, false);
  ctx.strokeStyle = rgbCss(mixRgb(c, BLACK, 0.25));
  ctx.lineWidth = 0.16;
  ctx.stroke();
  if (glyph) glyph(ctx, c, h);
}
function portalFront(ctx, it) {
  const c = tint(it.ro);
  const h = it.ro.d.h / 2;
  ovalHalf(ctx, 0.42, h, true);
  ctx.strokeStyle = rgbCss(c);
  ctx.lineWidth = 0.18;
  ctx.stroke();
  ctx.strokeStyle = rgbCss(mixRgb(c, WHITE, 0.6));
  ctx.lineWidth = 0.05;
  ctx.stroke();
}

const MODE_GLYPH = {
  cube: (ctx) => ctx.rect(-0.15, -0.15, 0.3, 0.3),
  ship: (ctx) => { ctx.moveTo(-0.2, -0.12); ctx.lineTo(0.22, 0); ctx.lineTo(-0.2, 0.12); ctx.closePath(); },
  ball: (ctx) => ctx.arc(0, 0, 0.17, 0, Math.PI * 2),
  ufo: (ctx) => { ctx.ellipse(0, -0.03, 0.22, 0.08, 0, 0, Math.PI * 2); ctx.moveTo(0.1, 0.03); ctx.arc(0, 0.03, 0.1, 0, Math.PI); },
  wave: (ctx) => { ctx.moveTo(-0.2, -0.12); ctx.lineTo(-0.07, 0.12); ctx.lineTo(0.07, -0.12); ctx.lineTo(0.2, 0.12); },
  robot: (ctx) => { ctx.rect(-0.13, -0.02, 0.26, 0.2); ctx.moveTo(-0.08, -0.02); ctx.lineTo(-0.1, -0.2); ctx.moveTo(0.08, -0.02); ctx.lineTo(0.1, -0.2); },
  spider: (ctx) => { ctx.ellipse(0, 0.04, 0.14, 0.1, 0, 0, Math.PI * 2); ctx.moveTo(-0.1, 0); ctx.lineTo(-0.22, -0.18); ctx.moveTo(0.1, 0); ctx.lineTo(0.22, -0.18); },
};

function paintModePortal(ctx, it, col, fx, or) {
  paintPortalBase(ctx, it, fx, or, (c2, c, h) => {
    const g = MODE_GLYPH[it.ro.d.value];
    if (!g) return;
    ctx.save();
    ctx.translate(0, h + 0.45);
    ctx.beginPath();
    g(ctx);
    ctx.strokeStyle = rgbCss(c);
    ctx.lineWidth = 0.06;
    ctx.stroke();
    ctx.restore();
  });
}
paintModePortal.front = portalFront;

function paintGravityPortal(ctx, it, col, fx, or) {
  paintPortalBase(ctx, it, fx, or, (c2, c, h) => {
    const dir = it.ro.d.value === -1 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(-0.15, 0);
    ctx.lineTo(0, dir * 0.3);
    ctx.lineTo(0.15, 0);
    ctx.moveTo(0, dir * 0.3);
    ctx.lineTo(0, -dir * 0.35);
    ctx.strokeStyle = rgbCss(mixRgb(c, WHITE, 0.5));
    ctx.lineWidth = 0.07;
    ctx.stroke();
  });
}
paintGravityPortal.front = portalFront;

function paintSizePortal(ctx, it, col, fx, or) {
  paintPortalBase(ctx, it, fx, or, (c2, c, h) => {
    const inward = it.ro.d.value === true;
    ctx.strokeStyle = rgbCss(mixRgb(c, WHITE, 0.5));
    ctx.lineWidth = 0.06;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      const y0 = dir * 0.45, y1 = dir * 0.12;
      const [a, b] = inward ? [y0, y1] : [y1, y0];
      ctx.moveTo(0, a);
      ctx.lineTo(0, b);
      ctx.moveTo(-0.1, b - Math.sign(b - a) * 0.1);
      ctx.lineTo(0, b);
      ctx.lineTo(0.1, b - Math.sign(b - a) * 0.1);
      ctx.stroke();
    }
  });
}
paintSizePortal.front = portalFront;

function paintSpeedPortal(ctx, it, col, fx, or) {
  const c = tint(it.ro);
  if (fx.glow) or.r.glow(0, 0, 1.3, c, 0.45 + fx.beat * 0.2);
  const n = it.ro.d.value + 1;
  const used = fx.state.act[it.ro.i];
  ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.28;
    ctx.beginPath();
    ctx.moveTo(x - 0.18, 0.75);
    ctx.lineTo(x + 0.18, 0);
    ctx.lineTo(x - 0.18, -0.75);
    ctx.strokeStyle = rgbCss(mixRgb(c, BLACK, 0.5));
    ctx.lineWidth = 0.26;
    ctx.stroke();
    ctx.strokeStyle = rgbCss(c, used ? 0.5 : 1);
    ctx.lineWidth = 0.16;
    ctx.stroke();
  }
}

function paintTeleport(ctx, it, col, fx, or) {
  paintPortalBase(ctx, it, fx, or);
  // exit portal
  const dy = it.ro.props.dy || 0;
  ctx.save();
  ctx.translate(0, dy / (it.ro.sy || 1));
  const c = { r: 255, g: 150, b: 60 };
  if (fx.glow) or.r.glow(0, 0, 1.6, c, 0.3);
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.42, 1.5, 0, 0, Math.PI * 2);
  ctx.strokeStyle = rgbCss(c);
  ctx.lineWidth = 0.16;
  ctx.stroke();
  ctx.restore();
  if (fx.editor) {
    ctx.setLineDash([0.2, 0.2]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, dy);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
paintTeleport.front = portalFront;

const GOLD = { r: 255, g: 205, b: 60 };
function paintCoin(ctx, it, col, fx, or) {
  if (fx.state.act[it.ro.i]) return;
  const idx = it.ro.props.index | 0;
  const ghost = fx.collectedCoins && fx.collectedCoins[idx];
  const c = ghost ? { r: 120, g: 180, b: 255 } : GOLD;
  const bob = Math.sin(fx.time * 3 + it.ro.x) * 0.08;
  ctx.translate(0, bob);
  if (fx.glow) or.r.glow(0, 0, 1.2, c, ghost ? 0.25 : 0.55);
  const sx = Math.max(0.15, Math.abs(Math.cos(fx.time * 2.2 + it.ro.x)));
  ctx.scale(sx, 1);
  ctx.beginPath();
  ctx.arc(0, 0, 0.45, 0, Math.PI * 2);
  ctx.fillStyle = rgbCss(mixRgb(c, BLACK, 0.25), ghost ? 0.55 : 1);
  ctx.fill();
  ctx.lineWidth = 0.07;
  ctx.strokeStyle = rgbCss(mixRgb(c, WHITE, 0.5));
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.12 : 0.28;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = rgbCss(mixRgb(c, WHITE, 0.4), ghost ? 0.6 : 1);
  ctx.fill();
}

function paintStartPos(ctx, it, col, fx) {
  if (!fx.editor) return;
  ctx.fillStyle = 'rgba(77,255,122,0.18)';
  ctx.fillRect(-0.5, -0.5, 1, 1);
  ctx.strokeStyle = '#4dff7a';
  ctx.lineWidth = 0.06;
  ctx.strokeRect(-0.47, -0.47, 0.94, 0.94);
  ctx.beginPath();
  ctx.moveTo(-0.15, 0.25);
  ctx.lineTo(0.22, 0);
  ctx.lineTo(-0.15, -0.25);
  ctx.closePath();
  ctx.fillStyle = '#4dff7a';
  ctx.fill();
}

const TRIGGER_LABEL = {
  trig_color: 'COL', trig_move: 'MOV', trig_rotate: 'ROT', trig_scale: 'SCL', trig_pulse: 'PLS', trig_alpha: 'ALP', trig_toggle: 'TGL',
  trig_camera: 'CAM', trig_shake: 'SHK', trig_spawn: 'SPN', trig_gameplay: 'GPL', trig_flash: 'FLS', trig_beat: 'BT',
};
function paintTrigger(ctx, it, col, fx) {
  if (!fx.editor) return;
  const c = tint(it.ro);
  ctx.fillStyle = 'rgba(10,12,30,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgbCss(c);
  ctx.lineWidth = 0.06;
  ctx.stroke();
  if (it.ro.d.id === 'trig_color' && it.ro.props.color) {
    ctx.beginPath();
    ctx.arc(0.3, 0.3, 0.12, 0, Math.PI * 2);
    ctx.fillStyle = it.ro.props.color;
    ctx.fill();
  }
  ctx.save();
  ctx.scale(0.01, -0.01);
  ctx.fillStyle = rgbCss(c);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TRIGGER_LABEL[it.ro.d.id] || 'TRG', 0, 2);
  ctx.restore();
  // vertical guide line
  if (fx.showTriggerLines) {
    ctx.strokeStyle = rgbCss(c, 0.15);
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(0, 60);
    ctx.stroke();
  }
}

// ---- decoration
function decoPrep(ctx, it, fx, or, col) {
  const p = it.ro.props;
  if (p.spin) ctx.rotate((-fx.time * p.spin * DEG) % (Math.PI * 2));
  if (p.pulse) {
    const s = 1 + fx.beat * 0.25;
    ctx.scale(s, s);
  }
  ctx.strokeStyle = rgbCss(col);
  ctx.fillStyle = rgbCss(col);
  ctx.lineWidth = 0.06;
  ctx.lineJoin = 'round';
}
const DECO_SHAPES = {
  deco_diamond: (ctx) => { ctx.beginPath(); ctx.moveTo(0, 0.45); ctx.lineTo(0.45, 0); ctx.lineTo(0, -0.45); ctx.lineTo(-0.45, 0); ctx.closePath(); ctx.stroke(); },
  deco_square: (ctx) => ctx.strokeRect(-0.4, -0.4, 0.8, 0.8),
  deco_ring: (ctx) => { ctx.beginPath(); ctx.arc(0, 0, 0.4, 0, Math.PI * 2); ctx.stroke(); },
  deco_chevron: (ctx) => { ctx.beginPath(); ctx.moveTo(-0.3, 0.35); ctx.lineTo(0.15, 0); ctx.lineTo(-0.3, -0.35); ctx.lineWidth = 0.12; ctx.stroke(); },
  deco_bar: (ctx) => { ctx.globalAlpha *= 0.85; ctx.fillRect(-0.5, -0.06, 1, 0.12); },
  deco_star: (ctx) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 ? 0.18 : 0.45;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
  },
  deco_cross: (ctx) => { ctx.beginPath(); ctx.moveTo(-0.35, 0); ctx.lineTo(0.35, 0); ctx.moveTo(0, -0.35); ctx.lineTo(0, 0.35); ctx.lineWidth = 0.1; ctx.stroke(); },
  deco_pillar: (ctx) => {
    ctx.globalAlpha *= 0.5;
    ctx.fillRect(-0.35, -2, 0.7, 4);
    ctx.globalAlpha *= 1.6;
    ctx.strokeRect(-0.35, -2, 0.7, 4);
    for (let y = -1.5; y < 2; y += 1) {
      ctx.beginPath();
      ctx.moveTo(-0.35, y);
      ctx.lineTo(0.35, y + 0.3);
      ctx.stroke();
    }
  },
  deco_glow: (ctx) => { ctx.beginPath(); ctx.arc(0, 0, 0.18, 0, Math.PI * 2); ctx.fill(); },
  deco_arrow: (ctx) => { ctx.beginPath(); ctx.moveTo(-0.4, 0); ctx.lineTo(0.3, 0); ctx.moveTo(0.05, 0.25); ctx.lineTo(0.35, 0); ctx.lineTo(0.05, -0.25); ctx.lineWidth = 0.09; ctx.stroke(); },
  deco_tri: (ctx) => { ctx.beginPath(); ctx.moveTo(-0.42, -0.36); ctx.lineTo(0, 0.4); ctx.lineTo(0.42, -0.36); ctx.closePath(); ctx.stroke(); },
  deco_dots: (ctx) => {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) ctx.fillRect(i * 0.3 - 0.05, j * 0.3 - 0.05, 0.1, 0.1);
  },
};
function makeDecoPainter(id) {
  return (ctx, it, col, fx, or) => {
    if (fx.glow && (id === 'deco_glow' || it.ro.props.pulse)) or.r.glow(0, 0, id === 'deco_glow' ? 1.1 : 0.8, col, 0.35 + fx.beat * 0.4);
    decoPrep(ctx, it, fx, or, col);
    DECO_SHAPES[id](ctx);
  };
}

export const PAINTERS = {
  block: paintBlock,
  slab: paintSlab,
  ledge: paintLedge,
  slope: paintSlope,
  crumble: paintCrumble,
  spike: paintSpike,
  spike_small: paintSpike,
  thorns: paintThorns,
  saw: paintSaw,
  pad: paintPad,
  orb: paintOrb,
  portal: paintModePortal,
  portal_gravity: paintGravityPortal,
  portal_size: paintSizePortal,
  portal_speed: paintSpeedPortal,
  portal_teleport: paintTeleport,
  coin: paintCoin,
  startpos: paintStartPos,
  trigger: paintTrigger,
};
for (const id of Object.keys(DECO_SHAPES)) PAINTERS[id] = makeDecoPainter(id);

/** Draw a single object definition preview in a UI canvas (editor palette). */
export function paintPreview(canvas, def, fakeRenderer) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = Math.max(def.w, def.h);
  const s = (canvas.width * 0.72) / size;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(s, -s);
  const painter = PAINTERS[def.draw];
  if (!painter) return;
  const ro = { d: def, i: 0, x: 0, y: 0, rot: 0, sx: 1, sy: 1, props: Object.fromEntries(def.props.map((p) => [p.key, p.default])), color: def.color };
  const fx = {
    time: 0.3, beat: 0, glow: false, editor: true,
    state: { act: new Uint8Array(1), actTime: new Float32Array(1), time: 0, pulses: [] },
  };
  const col = def.cat === 'deco' ? { r: 127, g: 184, b: 255 } : WHITE;
  painter(ctx, { ro, x: 0, y: 0, rot: 0, scale: 1, alpha: 1 }, col, fx, { r: fakeRenderer });
  if (painter.front) painter.front(ctx, { ro, x: 0, y: 0, rot: 0, scale: 1, alpha: 1 }, col, fx);
}
