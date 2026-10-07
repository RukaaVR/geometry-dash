// Authoring helper for the built-in levels. Works in grid cells: cell (cx, cy) is the
// unit square [cx, cx+1] x [cy, cy+1]. Produces normal level JSON, identical to what
// the in-game editor saves, so built-in levels can be opened and edited in the editor.

import { normalizeLevel } from '../game/level/format.js';
import { SPEEDS } from '../game/constants.js';

export class LevelBuilder {
  constructor(meta) {
    this.meta = meta;
    this.objects = [];
    this.groupCounter = 1;
    this.speed = meta.settings?.speed ?? 1;
  }

  add(t, x, y, extra = {}) {
    const o = { t, x, y };
    for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null) o[k] = v;
    this.objects.push(o);
    return o;
  }

  /** Allocate a fresh group id for triggers. */
  group() {
    return this.groupCounter++;
  }

  // ------------------------------------------------------------ solids
  block(cx, cy, w = 1, h = 1, opts = {}) {
    for (let i = 0; i < w; i++)
      for (let j = 0; j < h; j++) {
        const style = opts.style || ((j === h - 1) ? 'grid' : 'solid');
        this.add('block', cx + i + 0.5, cy + j + 0.5, { p: style !== 'grid' ? { style } : undefined, g: opts.g, c: opts.c });
      }
    return this;
  }
  /** A column from the ground up to (and including) row cy+h-1. */
  pillar(cx, h, opts = {}) {
    return this.block(cx, 0, 1, h, opts);
  }
  slab(cx, cy, w = 1, opts = {}) {
    for (let i = 0; i < w; i++) this.add('slab', cx + i + 0.5, cy + 0.25, { g: opts.g, p: opts.style ? { style: opts.style } : undefined });
    return this;
  }
  /** Slab hanging from the top of a cell. */
  slabTop(cx, cy, w = 1, opts = {}) {
    for (let i = 0; i < w; i++) this.add('slab', cx + i + 0.5, cy + 0.75, { g: opts.g });
    return this;
  }
  ledge(cx, cy, w = 1, opts = {}) {
    for (let i = 0; i < w; i++) this.add('ledge', cx + i + 0.5, cy + 0.875, { g: opts.g });
    return this;
  }
  crumble(cx, cy, w = 1, opts = {}) {
    for (let i = 0; i < w; i++) this.add('crumble', cx + i + 0.5, cy + 0.5, { g: opts.g });
    return this;
  }
  /** 45° slope occupying cell (cx, cy). dir 'up' rises to the right. */
  slope(cx, cy, dir = 'up', opts = {}) {
    this.add('slope45', cx + 0.5, cy + 0.5, { fx: dir === 'down' ? 1 : 0, fy: opts.ceiling ? 1 : 0, g: opts.g });
    return this;
  }
  slope22(cx, cy, dir = 'up', opts = {}) {
    this.add('slope22', cx + 1, cy + 0.5, { fx: dir === 'down' ? 1 : 0, fy: opts.ceiling ? 1 : 0, g: opts.g });
    return this;
  }

  // ------------------------------------------------------------ hazards
  spike(cx, cy = 0, opts = {}) {
    this.add('spike', cx + 0.5, cy + 0.5, { r: opts.down ? 180 : 0, g: opts.g });
    return this;
  }
  spikes(cx, n, cy = 0, opts = {}) {
    for (let i = 0; i < n; i++) this.spike(cx + i, cy, opts);
    return this;
  }
  /** Spike hanging from the underside of cell row cy (pointing down). */
  ceilSpike(cx, cy, n = 1, opts = {}) {
    for (let i = 0; i < n; i++) this.add('spike', cx + i + 0.5, cy + 0.5, { r: 180, g: opts.g });
    return this;
  }
  smallSpike(cx, cy = 0, n = 1, opts = {}) {
    for (let i = 0; i < n; i++) this.add('spike_small', cx + i + 0.5, cy + (opts.down ? 0.75 : 0.25), { r: opts.down ? 180 : 0, g: opts.g });
    return this;
  }
  thorns(cx, cy = 0, n = 1, opts = {}) {
    for (let i = 0; i < n; i++) this.add('thorns', cx + i + 0.5, cy + (opts.down ? 0.8 : 0.2), { r: opts.down ? 180 : 0, g: opts.g });
    return this;
  }
  saw(x, y, size = 'saw', opts = {}) {
    this.add(size, x, y, { g: opts.g, p: opts.spin !== undefined ? { spin: opts.spin } : undefined });
    return this;
  }

  // ------------------------------------------------------------ interactive
  pad(cx, cy = 0, color = 'yellow', opts = {}) {
    this.add('pad_' + color, cx + 0.5, opts.down ? cy + 0.85 : cy + 0.15, { r: opts.down ? 180 : 0, g: opts.g });
    return this;
  }
  orb(cx, cy, color = 'yellow', opts = {}) {
    this.add('orb_' + color, cx + 0.5, cy + 0.5, { g: opts.g });
    return this;
  }
  /** Wall from y=3 upward just before cell cx so a ground-level portal at cx+1 cannot be skipped. */
  funnel(cx, top = 22) {
    for (let y = 3; y < top; y++) this.add('block', cx + 0.5, y + 0.5, { p: { style: 'solid' } });
    return this;
  }
  /** Mode portal centred vertically at y (world units). */
  portal(mode, cx, y, opts = {}) {
    this.add('portal_' + mode, cx + 0.5, y, { p: opts.corridor !== undefined ? { corridor: opts.corridor } : undefined });
    return this;
  }
  gravity(cx, y, flipped) {
    this.add(flipped ? 'portal_gravity_up' : 'portal_gravity_down', cx + 0.5, y);
    return this;
  }
  size(cx, y, mini) {
    this.add(mini ? 'portal_mini' : 'portal_big', cx + 0.5, y);
    return this;
  }
  speedPortal(cx, y, speed) {
    this.add('speed_' + speed, cx + 0.5, y);
    return this;
  }
  teleport(cx, y, dy) {
    this.add('teleport', cx + 0.5, y, { p: { dy } });
    return this;
  }
  coin(x, y, index) {
    this.add('coin', x, y, { p: { index } });
    return this;
  }

  // ------------------------------------------------------------ decoration & triggers
  deco(id, x, y, opts = {}) {
    this.add(id, x, y, { r: opts.r, s: opts.s, c: opts.c, z: opts.z, a: opts.a, g: opts.g, p: opts.p });
    return this;
  }
  trigger(id, x, props, opts = {}) {
    this.add(id, x, opts.y ?? 12, { p: props, g: opts.g });
    return this;
  }
  color(x, channel, color, duration = 0.5) {
    return this.trigger('trig_color', x, { channel, color, duration });
  }
  beat(x, enabled = true, division = 1, intensity = 0.6) {
    return this.trigger('trig_beat', x, { enabled, division, intensity });
  }
  flash(x, color = '#ffffff', intensity = 0.5, duration = 0.35) {
    return this.trigger('trig_flash', x, { color, intensity, duration });
  }
  shake(x, strength = 0.25, duration = 0.35) {
    return this.trigger('trig_shake', x, { strength, duration });
  }
  move(x, target, dx, dy, duration = 0.5, easing = 'easeInOut') {
    return this.trigger('trig_move', x, { target, dx, dy, duration, easing });
  }
  camera(x, zoom = 1, offsetY = 0, duration = 1, rotation = 0) {
    return this.trigger('trig_camera', x, { zoom, offsetY, duration, rotation });
  }

  /** x position reached after `seconds` at the builder's speed (ignores speed portals). */
  secondsToX(seconds) {
    return seconds * SPEEDS[this.speed];
  }

  build() {
    const { level, warnings } = normalizeLevel({ ...this.meta, objects: this.objects });
    if (warnings.length) throw new Error(`Level "${this.meta.name}" has invalid objects:\n` + warnings.join('\n'));
    return level;
  }
}
