// Editor data model (DOM-free, unit-testable): the level being edited, stable object
// identities, transactional edits with undo/redo, selection and grid snapping.

import { normalizeLevel, normalizeObject, MAX_OBJECTS } from '../game/level/format.js';
import { getDef } from '../game/objects/registry.js';
import { History, cloneObj } from './history.js';
import { DEG } from '../core/math.js';

export class EditorModel {
  constructor(level) {
    this.history = new History();
    this.selection = new Set();
    this.uidCounter = 1;
    this.metaVersion = 0;
    this.load(level);
  }

  load(level) {
    const { objects, ...meta } = level;
    this.meta = JSON.parse(JSON.stringify(meta));
    this.map = new Map(); // uid -> object
    this.ord = new Map(); // uid -> draw order
    this.ordCounter = 0;
    for (const o of objects) this._insert(cloneObj(o));
    this.selection.clear();
    this.history.clear();
    this._listCache = null;
  }

  _insert(o, uid = this.uidCounter++, ord = this.ordCounter++) {
    this.map.set(uid, o);
    this.ord.set(uid, ord);
    this._listCache = null;
    return uid;
  }

  _delete(uid) {
    this.map.delete(uid);
    this.ord.delete(uid);
    this.selection.delete(uid);
    this._listCache = null;
  }

  get version() {
    return this.history.version + this.metaVersion * 100000;
  }

  /** [{uid, o}] in draw order. */
  list() {
    if (!this._listCache) {
      this._listCache = [...this.map.entries()]
        .map(([uid, o]) => ({ uid, o }))
        .sort((a, b) => this.ord.get(a.uid) - this.ord.get(b.uid));
    }
    return this._listCache;
  }

  get count() {
    return this.map.size;
  }

  get(uid) {
    return this.map.get(uid);
  }

  /** Export as a normalised level. */
  toLevel() {
    const objects = this.list().map((e) => cloneObj(e.o));
    return normalizeLevel({ ...this.meta, objects }).level;
  }

  setMeta(patch) {
    Object.assign(this.meta, patch);
    this.metaVersion++;
  }

  // ------------------------------------------------------------------ edits

  /** Apply a history state map (uid -> obj|null). */
  _applyMap = (target) => {
    for (const [uid, o] of target) {
      if (o === null) this._delete(uid);
      else if (this.map.has(uid)) {
        const cur = this.map.get(uid);
        for (const k of Object.keys(cur)) delete cur[k];
        Object.assign(cur, cloneObj(o));
        this._listCache = null;
      } else {
        this.map.set(uid, cloneObj(o));
        if (!this.ord.has(uid)) this.ord.set(uid, this.ordCounter++);
        this._listCache = null;
      }
    }
  };

  /** Add raw objects (normalised on the way in). Returns new uids. */
  add(objs, label = 'Add') {
    const before = new Map(), after = new Map(), uids = [];
    const warnings = [];
    for (const raw of objs) {
      if (this.map.size >= MAX_OBJECTS) break;
      const o = normalizeObject(raw, warnings);
      if (!o) continue;
      const uid = this._insert(o);
      before.set(uid, null);
      after.set(uid, cloneObj(o));
      uids.push(uid);
    }
    this.history.push({ label, before, after });
    return uids;
  }

  remove(uids, label = 'Delete') {
    const before = new Map(), after = new Map();
    for (const uid of uids) {
      const o = this.map.get(uid);
      if (!o) continue;
      before.set(uid, cloneObj(o));
      after.set(uid, null);
      this._delete(uid);
    }
    this.history.push({ label, before, after });
  }

  /** Modify objects in place with fn(o); records a single undo step. */
  modify(uids, fn, label = 'Edit') {
    const before = new Map(), after = new Map();
    const warnings = [];
    for (const uid of uids) {
      const o = this.map.get(uid);
      if (!o) continue;
      before.set(uid, cloneObj(o));
      fn(o);
      const n = normalizeObject(o, warnings);
      if (n) {
        for (const k of Object.keys(o)) delete o[k];
        Object.assign(o, n);
      } else {
        Object.assign(o, before.get(uid));
      }
      after.set(uid, cloneObj(o));
    }
    this._listCache = null;
    this.history.push({ label, before, after });
  }

  /**
   * Start a live (continuous) edit such as a drag. Call update(fn) repeatedly and
   * commit() once; only one undo step is recorded.
   */
  beginLive(uids, label = 'Move') {
    const start = new Map();
    for (const uid of uids) if (this.map.has(uid)) start.set(uid, cloneObj(this.map.get(uid)));
    return {
      update: (fn) => {
        for (const [uid, base] of start) {
          const o = this.map.get(uid);
          if (!o) continue;
          for (const k of Object.keys(o)) delete o[k];
          Object.assign(o, cloneObj(base));
          fn(o, base);
        }
        this._listCache = null;
        this.liveVersion = (this.liveVersion || 0) + 1;
      },
      commit: () => {
        const before = new Map(), after = new Map();
        for (const [uid, base] of start) {
          const o = this.map.get(uid);
          if (!o) continue;
          const n = normalizeObject(o, []);
          if (n) {
            for (const k of Object.keys(o)) delete o[k];
            Object.assign(o, n);
          }
          if (JSON.stringify(base) !== JSON.stringify(o)) {
            before.set(uid, base);
            after.set(uid, cloneObj(o));
          }
        }
        this.history.push({ label, before, after });
      },
      cancel: () => {
        for (const [uid, base] of start) {
          const o = this.map.get(uid);
          if (!o) continue;
          for (const k of Object.keys(o)) delete o[k];
          Object.assign(o, base);
        }
        this._listCache = null;
      },
    };
  }

  undo() {
    const e = this.history.undo(this._applyMap);
    this._pruneSelection();
    return e;
  }

  redo() {
    const e = this.history.redo(this._applyMap);
    this._pruneSelection();
    return e;
  }

  _pruneSelection() {
    for (const uid of [...this.selection]) if (!this.map.has(uid)) this.selection.delete(uid);
  }

  // ------------------------------------------------------------------ queries

  /** Object at a world point (topmost first). */
  pick(x, y) {
    const list = this.list();
    let best = null, bestArea = Infinity;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = objectBounds(list[i].o);
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) {
        const area = (b.x1 - b.x0) * (b.y1 - b.y0);
        // prefer the smallest object under the cursor so tiny objects stay clickable
        if (area < bestArea - 1e-6) {
          best = list[i].uid;
          bestArea = area;
        }
      }
    }
    return best;
  }

  inRect(x0, y0, x1, y1) {
    const out = [];
    for (const { uid, o } of this.list()) {
      const b = objectBounds(o);
      if (b.x1 >= x0 && b.x0 <= x1 && b.y1 >= y0 && b.y0 <= y1) out.push(uid);
    }
    return out;
  }

  existsAt(t, x, y) {
    for (const o of this.map.values()) if (o.t === t && Math.abs(o.x - x) < 0.01 && Math.abs(o.y - y) < 0.01) return true;
    return false;
  }

  selectionBounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const uid of this.selection) {
      const o = this.map.get(uid);
      if (!o) continue;
      const b = objectBounds(o);
      x0 = Math.min(x0, b.x0);
      y0 = Math.min(y0, b.y0);
      x1 = Math.max(x1, b.x1);
      y1 = Math.max(y1, b.y1);
    }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
  }

  /** Copy selection to plain objects relative to the selection's bottom-left. */
  copySelection() {
    const b = this.selectionBounds();
    if (!b) return null;
    const ox = Math.floor(b.x0), oy = Math.floor(b.y0);
    return [...this.selection].map((uid) => {
      const c = cloneObj(this.map.get(uid));
      c.x -= ox;
      c.y -= oy;
      return c;
    });
  }

  /** Rotate selection by deg around its centre (positions and rotatable objects). */
  rotateSelection(deg) {
    const b = this.selectionBounds();
    if (!b) return;
    const cx = Math.round((b.x0 + b.x1) * 2) / 4, cy = Math.round((b.y0 + b.y1) * 2) / 4;
    const multi = this.selection.size > 1;
    const a = -deg * DEG;
    const c = Math.cos(a), s = Math.sin(a);
    this.modify([...this.selection], (o) => {
      const d = getDef(o.t);
      if (multi) {
        const dx = o.x - cx, dy = o.y - cy;
        o.x = Math.round((cx + dx * c - dy * s) * 1000) / 1000;
        o.y = Math.round((cy + dx * s + dy * c) * 1000) / 1000;
      }
      if (d.rotatable) o.r = (((o.r || 0) + deg) % 360 + 360) % 360;
      else if (d.kind === 'slope' && Math.abs(deg) === 90) {
        // cycle slope orientation: up -> ceiling-up -> ceiling-down -> down
        const state = (o.fx ? 1 : 0) + (o.fy ? 2 : 0);
        const order = deg > 0 ? [2, 0, 3, 1] : [1, 3, 0, 2];
        const ns = order[state];
        o.fx = ns & 1 ? 1 : 0;
        o.fy = ns & 2 ? 1 : 0;
      }
    }, 'Rotate');
  }

  flipSelection(axis) {
    const b = this.selectionBounds();
    if (!b) return;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const multi = this.selection.size > 1;
    this.modify([...this.selection], (o) => {
      if (axis === 'x') {
        if (multi) o.x = 2 * cx - o.x;
        o.fx = o.fx ? 0 : 1;
      } else {
        if (multi) o.y = 2 * cy - o.y;
        o.fy = o.fy ? 0 : 1;
      }
    }, 'Flip');
  }
}

/** Axis-aligned bounds of an object's visual footprint. */
export function objectBounds(o) {
  const d = getDef(o.t);
  const s = o.s || 1;
  let w = (d ? d.w : 1) * s, h = (d ? d.h : 1) * s;
  const r = ((o.r || 0) % 360 + 360) % 360;
  if (r % 180 === 90) [w, h] = [h, w];
  else if (r % 90 !== 0) {
    const a = r * DEG;
    const c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    [w, h] = [w * c + h * sn, w * sn + h * c];
  }
  return { x0: o.x - w / 2, x1: o.x + w / 2, y0: o.y - h / 2, y1: o.y + h / 2 };
}

/**
 * Grid-snapped placement position for an object type at a world point.
 * Thin objects (pads, slabs, small spikes) rest on the bottom of their cell; portals,
 * orbs, coins and triggers centre on the cell; everything else aligns its edges.
 */
export function snapPosition(def, x, y, grid = true, rot = 0) {
  if (!grid) return { x: Math.round(x * 20) / 20, y: Math.round(y * 20) / 20 };
  let w = def.w, h = def.h;
  if (rot % 180 === 90) [w, h] = [h, w];
  const centred = ['portal', 'orb', 'coin', 'trigger', 'startpos'].includes(def.kind) || (def.kind === 'deco' && h >= 1);
  let sx, sy;
  if (centred) {
    sx = Math.floor(x) + 0.5;
    sy = Math.floor(y) + 0.5;
    if (def.kind === 'portal' && w > 1) sx = Math.round(x);
  } else {
    sx = Math.round(x - w / 2) + w / 2;
    if (h < 1) {
      const cellY = Math.floor(y);
      const down = rot % 360 === 180;
      sy = down ? cellY + 1 - h / 2 : cellY + h / 2;
    } else sy = Math.round(y - h / 2) + h / 2;
  }
  return { x: sx, y: sy };
}
