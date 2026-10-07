// Level editor scene: canvas interaction, toolbar, object browser, inspector,
// timeline/scrubbing, music preview, test play, save/load and auto-verification.

import { h, clear, fmtTime } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { EditorModel, snapPosition, objectBounds } from './model.js';
import { cloneObj } from './history.js';
import { CATEGORIES, OBJECT_DEFS, defsInCategory, getDef, COLOR_CHANNELS, COLOR_CHANNEL_NAMES } from '../game/objects/registry.js';
import { createEmptyLevel, DIFFICULTIES, BACKGROUND_STYLES, GROUND_STYLES, DIFFICULTY_STARS, normalizeLevel } from '../game/level/format.js';
import { compileLevel, timeAtX, xAtTime } from '../game/sim/compile.js';
import { createState } from '../game/sim/sim.js';
import { paintPreview } from '../render/objects.js';
import { PlayScene } from '../scenes/playScene.js';
import { levelSongs, getSong } from '../audio/songs.js';
import { MODES } from '../game/constants.js';
import { hexToRgb, clamp } from '../core/math.js';
import { DIFFICULTY_LABEL } from '../ui/icons.js';

const TOOLS = [
  { id: 'build', label: 'Build', icon: 'build', key: '1' },
  { id: 'edit', label: 'Edit', icon: 'select', key: '2' },
  { id: 'delete', label: 'Delete', icon: 'trash', key: '3' },
];

let clipboard = null;

export class EditorScene {
  constructor(app, nav, levelId) {
    this.app = app;
    this.nav = nav;
    let level = null;
    if (levelId) level = app.levelStore.get(levelId);
    if (!level) {
      level = createEmptyLevel({ name: 'My Level', author: 'You' });
      this.isNew = true;
    }
    this.model = new EditorModel(level);
    this.savedVersion = this.isNew ? -1 : this.model.version;
    this.cam = { cx: 12, cy: 4.5, zoom: 1, rot: 0, shakeX: 0, shakeY: 0 };
    this.tool = 'build';
    this.category = 'blocks';
    this.placeType = 'block';
    this.placeRot = 0;
    this.grid = true;
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0, inside: false };
    this.drag = null;
    this.pointers = new Map();
    this.compiledVersion = -1;
    this.previewMusic = false;
    this.verifyMark = null;
    this.showTriggerLines = true;
    this.spaceHeld = false;
  }

  // ------------------------------------------------------------------ lifecycle

  enter() {
    const app = this.app;
    app.ui.clear();
    app.music.stop(0.3);
    this.buildDom();
    this.bindCanvas();
    this.rebuildWorld(true);
    this.refreshAll();
  }

  exit() {
    this.unbindCanvas();
    this.stopMusicPreview();
    this.root && this.root.remove();
    this.app.particles.clear();
  }

  get dirty() {
    return this.model.version !== this.savedVersion;
  }

  // ------------------------------------------------------------------ DOM

  buildDom() {
    const app = this.app;
    const btn = (iconName, title, fn, cls = '') =>
      h('button.ed-btn' + (cls ? '.' + cls : ''), { title, 'aria-label': title, type: 'button', on: { click: fn } }, icon(iconName));
    this.toolBtns = TOOLS.map((t) =>
      h('button.ed-tool', { title: `${t.label} (${t.key})`, type: 'button', on: { click: () => this.setTool(t.id) }, dataset: { tool: t.id } }, icon(t.icon), h('span', t.label)));
    this.nameBtn = h('button.ed-name', { title: 'Level settings', type: 'button', on: { click: () => this.openSettings() } });
    this.undoBtn = btn('undo', 'Undo (Ctrl+Z)', () => this.undo());
    this.redoBtn = btn('redo', 'Redo (Ctrl+Y)', () => this.redo());
    this.gridBtn = btn('grid', 'Snap to grid (G)', () => { this.grid = !this.grid; this.refreshToolbar(); });
    this.musicBtn = btn('music', 'Preview music from here (M)', () => this.toggleMusicPreview());
    this.saveBtn = h('button.ed-btn.ed-save', { title: 'Save (Ctrl+S)', type: 'button', on: { click: () => this.save() } }, icon('save'), h('span', 'Save'));
    const top = h('div.ed-top',
      btn('back', 'Exit editor', () => this.requestExit(), 'ed-back'),
      this.nameBtn,
      h('div.ed-group', ...this.toolBtns),
      h('div.ed-group', this.undoBtn, this.redoBtn),
      h('div.ed-group.ed-edit-actions',
        btn('copy', 'Copy (Ctrl+C)', () => this.copy()),
        btn('paste', 'Paste (Ctrl+V)', () => this.paste()),
        btn('duplicate', 'Duplicate (Ctrl+D)', () => this.duplicate()),
        btn('rotate', 'Rotate 90° (E)', () => this.model.selection.size ? this.rotate(90) : this.rotatePlacement(90)),
        btn('flipH', 'Flip horizontally (H)', () => this.flip('x')),
        btn('flipV', 'Flip vertically (V)', () => this.flip('y')),
        btn('trash', 'Delete selection (Del)', () => this.deleteSelection())),
      h('div.ed-group', this.gridBtn,
        btn('zoomOut', 'Zoom out (-)', () => this.zoomBy(1 / 1.25)),
        btn('zoomIn', 'Zoom in (+)', () => this.zoomBy(1.25))),
      h('div.ed-spacer'),
      h('div.ed-group',
        this.musicBtn,
        btn('verify', 'Verify level is beatable', () => this.verify()),
        h('button.ed-btn.ed-test', { title: 'Test from here (Shift+Enter)', type: 'button', on: { click: () => this.test(true) } }, icon('flag'), h('span', 'Here')),
        h('button.ed-btn.ed-test.primary', { title: 'Test from start (Enter)', type: 'button', on: { click: () => this.test(false) } }, icon('play'), h('span', 'Test')),
        this.saveBtn));

    // object browser
    this.catTabs = h('div.ed-cats');
    this.palette = h('div.ed-palette');
    const left = h('div.ed-left', this.catTabs, this.palette);

    // inspector
    this.inspector = h('div.ed-inspector');
    const right = h('div.ed-right', this.inspector);

    // timeline
    this.slider = h('input.ed-slider', { type: 'range', min: -10, max: 100, step: 0.1, value: 0, 'aria-label': 'Scrub through level',
      on: { input: (e) => { this.stopMusicPreview(); this.cam.cx = Number(e.target.value) + this.viewHalfW() * 0.6; } } });
    this.info = h('div.ed-info');
    this.status = h('div.ed-status');
    const bottom = h('div.ed-bottom', this.slider, this.info, this.status);

    this.root = h('div.editor', top, left, right, bottom);
    app.uiRoot.appendChild(this.root);
    this.renderPalette();
  }

  refreshAll() {
    this.refreshToolbar();
    this.renderInspector();
  }

  refreshToolbar() {
    for (const b of this.toolBtns) b.classList.toggle('active', b.dataset.tool === this.tool);
    this.undoBtn.disabled = !this.model.history.canUndo;
    this.redoBtn.disabled = !this.model.history.canRedo;
    this.gridBtn.classList.toggle('active', this.grid);
    this.musicBtn.classList.toggle('active', this.previewMusic);
    clear(this.nameBtn).append(h('b', this.model.meta.name), h('small', `${DIFFICULTY_LABEL[this.model.meta.difficulty]} · ${getSong(this.model.meta.song.id).name}`), icon('settings'));
    this.saveBtn.classList.toggle('dirty', this.dirty);
  }

  renderPalette() {
    clear(this.catTabs);
    for (const c of CATEGORIES) {
      const d = getDef(c.icon);
      const cv = h('canvas', { width: 40, height: 40 });
      paintPreview(cv, d, this.app.renderer);
      this.catTabs.append(h('button.ed-cat' + (c.id === this.category ? '.active' : ''), {
        title: c.name, type: 'button', on: { click: () => { this.category = c.id; this.renderPalette(); } },
      }, cv, h('span', c.name)));
    }
    clear(this.palette);
    for (const d of defsInCategory(this.category)) {
      const cv = h('canvas', { width: 64, height: 64 });
      paintPreview(cv, d, this.app.renderer);
      this.palette.append(h('button.ed-obj' + (d.id === this.placeType ? '.active' : ''), {
        title: d.name, type: 'button', dataset: { type: d.id },
        on: { click: () => { this.placeType = d.id; this.placeRot = 0; this.setTool('build'); this.renderPalette(); } },
      }, cv, h('small', d.name)));
    }
  }

  setTool(t) {
    this.tool = t;
    if (t !== 'edit' && t !== 'build') this.model.selection.clear();
    this.refreshAll();
  }

  // ------------------------------------------------------------------ inspector

  renderInspector() {
    const insp = this.inspector;
    clear(insp);
    const sel = [...this.model.selection].map((uid) => ({ uid, o: this.model.get(uid) })).filter((e) => e.o);
    if (!sel.length) {
      const d = getDef(this.placeType);
      insp.append(
        h('h3', 'Level'),
        h('div.ed-kv', h('span', 'Objects'), h('b', String(this.model.count))),
        h('div.ed-kv', h('span', 'Length'), h('b', this.world ? `${Math.round(this.world.length)} blocks` : '-')),
        h('div.ed-kv', h('span', 'Duration'), h('b', this.world ? fmtTime(timeAtX(this.world.timeline, this.world.length)) : '-')),
        h('h3', 'Placing'),
        h('div.ed-kv', h('span', 'Object'), h('b', d ? d.name : '-')),
        h('div.ed-help',
          h('p', h('b', 'Build'), ' click or drag to place. Q/E rotate the next object.'),
          h('p', h('b', 'Edit'), ' click to select, Shift to add, drag empty space to box-select, drag selection to move. Arrows nudge.'),
          h('p', h('b', 'Navigate'), ' wheel / right-drag / Space-drag to pan, Ctrl+wheel to zoom, timeline to scrub.'),
          h('p', h('b', 'Test'), ' Enter from start, Shift+Enter from the camera. Place a Start Position to test from there.')));
      return;
    }
    const same = sel.every((e) => e.o.t === sel[0].o.t);
    const d = getDef(sel[0].o.t);
    const first = sel[0].o;
    insp.append(h('h3', same ? d.name : `${sel.length} objects`));
    if (sel.length > 1 && same) insp.append(h('small.ed-sub', `${sel.length} selected`));

    const row = (label, input) => h('label.ed-field', h('span', label), input);
    const num = (value, step, onChange) => {
      const inp = h('input.ed-input', { type: 'number', step, value: String(value) });
      inp.addEventListener('change', () => {
        const v = Number(inp.value);
        if (Number.isFinite(v)) onChange(v);
      });
      return inp;
    };
    const edit = (fn, label) => {
      this.model.modify(sel.map((e) => e.uid), fn, label);
      this.afterEdit();
    };

    if (sel.length === 1) {
      insp.append(row('X', num(first.x, 0.5, (v) => edit((o) => (o.x = v), 'Move'))));
      insp.append(row('Y', num(first.y, 0.5, (v) => edit((o) => (o.y = v), 'Move'))));
    }
    if (same && d.rotatable) insp.append(row('Rotation', num(first.r || 0, 15, (v) => edit((o) => (o.r = v), 'Rotate'))));
    if (same && d.scalable) insp.append(row('Scale', num(first.s || 1, 0.25, (v) => edit((o) => (o.s = v), 'Scale'))));
    insp.append(h('div.ed-row2',
      h('button.ed-chip' + (first.fx ? '.on' : ''), { type: 'button', on: { click: () => this.flip('x') } }, icon('flipH'), 'Flip H'),
      h('button.ed-chip' + (first.fy ? '.on' : ''), { type: 'button', on: { click: () => this.flip('y') } }, icon('flipV'), 'Flip V')));
    if (d.kind !== 'trigger' && d.kind !== 'startpos') {
      const chSel = h('select.ed-input', COLOR_CHANNELS.map((c) => h('option', { value: c, selected: (first.c || d.color) === c }, COLOR_CHANNEL_NAMES[c])));
      chSel.addEventListener('change', () => edit((o) => (o.c = chSel.value), 'Color'));
      insp.append(row('Color', chSel));
      const zSel = h('select.ed-input', [-3, -2, -1, 0, 1, 2, 3].map((z) => h('option', { value: z, selected: (first.z ?? d.layer) === z }, z < 0 ? `Back ${-z}` : z === 0 ? 'Main' : `Front ${z}`)));
      zSel.addEventListener('change', () => edit((o) => (o.z = Number(zSel.value)), 'Layer'));
      insp.append(row('Layer', zSel));
      insp.append(row('Opacity', num(first.a ?? 1, 0.05, (v) => edit((o) => (o.a = clamp(v, 0, 1)), 'Opacity'))));
    }
    const groups = h('input.ed-input', { type: 'text', value: (first.g || []).join(', '), placeholder: 'e.g. 1, 4' });
    groups.addEventListener('change', () => {
      const g = groups.value.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
      edit((o) => { if (g.length) o.g = g; else delete o.g; }, 'Groups');
    });
    insp.append(row('Groups', groups));

    if (same && d.props.length) {
      insp.append(h('h4', d.kind === 'trigger' ? 'Trigger' : 'Properties'));
      for (const schema of d.props) {
        const cur = first.p && schema.key in first.p ? first.p[schema.key] : schema.default;
        const setProp = (v) => edit((o) => { o.p = { ...(o.p || {}), [schema.key]: v }; }, schema.label);
        let input;
        if (schema.type === 'bool') {
          input = h('input', { type: 'checkbox', checked: !!cur });
          input.addEventListener('change', () => setProp(input.checked));
        } else if (schema.type === 'select') {
          input = h('select.ed-input', schema.options.map((op) => h('option', { value: String(op), selected: String(op) === String(cur) }, String(op))));
          input.addEventListener('change', () => {
            const op = schema.options.find((x) => String(x) === input.value);
            setProp(op);
          });
        } else if (schema.type === 'color') {
          input = h('input.ed-color', { type: 'color', value: cur });
          input.addEventListener('change', () => setProp(input.value));
        } else {
          input = num(cur, schema.step || 0.1, setProp);
        }
        insp.append(row(schema.label, input));
      }
    }
    insp.append(h('div.ed-row2',
      h('button.ed-chip', { type: 'button', on: { click: () => this.duplicate() } }, icon('duplicate'), 'Duplicate'),
      h('button.ed-chip.danger', { type: 'button', on: { click: () => this.deleteSelection() } }, icon('trash'), 'Delete')));
  }

  afterEdit() {
    this.rebuildWorld();
    this.refreshAll();
  }

  // ------------------------------------------------------------------ world

  rebuildWorld(force = false) {
    const v = this.model.version + (this.model.liveVersion || 0) * 1e9;
    if (!force && v === this.compiledVersion) return;
    this.compiledVersion = v;
    const list = this.model.list();
    const level = { ...this.model.meta, objects: list.map((e) => e.o) };
    try {
      this.world = compileLevel(normalizeLevel(level).level);
    } catch (e) {
      console.error(e);
      return;
    }
    // map compiled object index -> editor uid (normalisation keeps order, drops invalid)
    this.state = createState(this.world);
    this.previewColorsAt(this.cam.cx);
    this.slider.max = String(Math.max(60, this.world.length + 10));
  }

  /** Show colour-trigger results at the camera position without moving objects. */
  previewColorsAt(x) {
    if (!this.world) return;
    const st = this.state;
    for (const [k, v] of Object.entries(this.world.baseColors)) st.colors[k] = { ...v };
    for (const t of this.world.posTriggers) {
      if (t.x > x) break;
      if (t.d.id === 'trig_color') st.colors[t.props.channel] = hexToRgb(t.props.color);
    }
    this._colorPreviewX = x;
  }

  // ------------------------------------------------------------------ canvas input

  bindCanvas() {
    const c = this.app.canvas;
    this._pd = (e) => this.onPointerDown(e);
    this._pm = (e) => this.onPointerMove(e);
    this._pu = (e) => this.onPointerUp(e);
    this._wh = (e) => this.onWheel(e);
    this._ku = (e) => { if (e.code === 'Space') this.spaceHeld = false; };
    this._kd = (e) => { if (e.code === 'Space' && !this.app.input.isTyping(e)) { this.spaceHeld = true; e.preventDefault(); } };
    c.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointermove', this._pm);
    window.addEventListener('pointerup', this._pu);
    window.addEventListener('pointercancel', this._pu);
    c.addEventListener('wheel', this._wh, { passive: false });
    window.addEventListener('keyup', this._ku);
    window.addEventListener('keydown', this._kd);
  }

  unbindCanvas() {
    const c = this.app.canvas;
    c.removeEventListener('pointerdown', this._pd);
    window.removeEventListener('pointermove', this._pm);
    window.removeEventListener('pointerup', this._pu);
    window.removeEventListener('pointercancel', this._pu);
    c.removeEventListener('wheel', this._wh);
    window.removeEventListener('keyup', this._ku);
    window.removeEventListener('keydown', this._kd);
  }

  toWorld(e) {
    const r = this.app.renderer;
    const rect = this.app.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (r.width / rect.width);
    const sy = (e.clientY - rect.top) * (r.height / rect.height);
    const [x, y] = r.screenToWorld(this.cam, sx, sy);
    return { x, y, sx, sy };
  }

  onPointerDown(e) {
    e.preventDefault();
    this.app.canvas.setPointerCapture?.(e.pointerId);
    const p = this.toWorld(e);
    this.pointers.set(e.pointerId, p);
    this.stopMusicPreview();
    if (this.pointers.size === 2) {
      // two-finger gesture: cancel any single-pointer action and start pan/zoom
      if (this.drag && this.drag.live) this.drag.live.cancel();
      const [a, b] = [...this.pointers.values()];
      this.drag = { kind: 'pinch', dist: Math.hypot(a.sx - b.sx, a.sy - b.sy), zoom: this.cam.zoom, mid: { x: (a.sx + b.sx) / 2, y: (a.sy + b.sy) / 2 }, cam: { ...this.cam } };
      return;
    }
    if (e.button === 1 || e.button === 2 || this.spaceHeld) {
      this.drag = { kind: 'pan', sx: p.sx, sy: p.sy, cam: { ...this.cam } };
      return;
    }
    const m = this.model;
    if (this.tool === 'build') {
      this.drag = { kind: 'paint', last: null };
      this.placeAt(p.x, p.y);
    } else if (this.tool === 'delete') {
      this.drag = { kind: 'erase' };
      this.eraseAt(p.x, p.y);
    } else {
      const hit = m.pick(p.x, p.y);
      if (hit !== null) {
        if (e.shiftKey) {
          if (m.selection.has(hit)) m.selection.delete(hit);
          else m.selection.add(hit);
          this.renderInspector();
          this.drag = null;
          return;
        }
        if (!m.selection.has(hit)) {
          m.selection.clear();
          m.selection.add(hit);
          this.renderInspector();
        }
        this.drag = { kind: 'move', start: p, live: m.beginLive([...m.selection], 'Move'), moved: false };
      } else {
        if (!e.shiftKey) m.selection.clear();
        this.drag = { kind: 'box', start: p, end: p, additive: e.shiftKey };
        this.renderInspector();
      }
    }
  }

  onPointerMove(e) {
    const p = this.toWorld(e);
    this.mouse = { ...p, inside: e.target === this.app.canvas };
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    const d = this.drag;
    if (!d) return;
    const r = this.app.renderer;
    switch (d.kind) {
      case 'pinch': {
        if (this.pointers.size < 2) return;
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.sx - b.sx, a.sy - b.sy);
        this.cam.zoom = clamp(d.zoom * (dist / Math.max(1, d.dist)), 0.25, 3);
        const mid = { x: (a.sx + b.sx) / 2, y: (a.sy + b.sy) / 2 };
        const s = r.ppb * this.cam.zoom;
        this.cam.cx = d.cam.cx - (mid.x - d.mid.x) / s;
        this.cam.cy = d.cam.cy + (mid.y - d.mid.y) / s;
        break;
      }
      case 'pan': {
        const s = r.ppb * this.cam.zoom;
        this.cam.cx = d.cam.cx - (p.sx - d.sx) / s;
        this.cam.cy = d.cam.cy + (p.sy - d.sy) / s;
        break;
      }
      case 'paint':
        this.placeAt(p.x, p.y);
        break;
      case 'erase':
        this.eraseAt(p.x, p.y);
        break;
      case 'move': {
        let dx = p.x - d.start.x, dy = p.y - d.start.y;
        if (this.grid) {
          dx = Math.round(dx);
          dy = Math.round(dy);
        } else {
          dx = Math.round(dx * 20) / 20;
          dy = Math.round(dy * 20) / 20;
        }
        if (dx || dy || d.moved) {
          d.moved = true;
          d.live.update((o, base) => {
            o.x = base.x + dx;
            o.y = base.y + dy;
          });
        }
        break;
      }
      case 'box':
        d.end = p;
        break;
      default:
        break;
    }
  }

  onPointerUp(e) {
    this.pointers.delete(e.pointerId);
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'pinch' && this.pointers.size) return;
    this.drag = null;
    if (d.kind === 'move') {
      d.live.commit();
      this.afterEdit();
    } else if (d.kind === 'box') {
      const x0 = Math.min(d.start.x, d.end.x), x1 = Math.max(d.start.x, d.end.x);
      const y0 = Math.min(d.start.y, d.end.y), y1 = Math.max(d.start.y, d.end.y);
      if (x1 - x0 > 0.1 || y1 - y0 > 0.1) {
        for (const uid of this.model.inRect(x0, y0, x1, y1)) this.model.selection.add(uid);
      }
      this.renderInspector();
    } else if (d.kind === 'paint' || d.kind === 'erase') {
      this.refreshAll();
    }
  }

  onWheel(e) {
    e.preventDefault();
    this.stopMusicPreview();
    const r = this.app.renderer;
    if (e.ctrlKey || e.metaKey) {
      const before = this.toWorld(e);
      this.cam.zoom = clamp(this.cam.zoom * Math.pow(1.0015, -e.deltaY), 0.25, 3);
      const after = this.toWorld(e);
      this.cam.cx += before.x - after.x;
      this.cam.cy += before.y - after.y;
      return;
    }
    const s = r.ppb * this.cam.zoom;
    if (e.shiftKey) this.cam.cy -= e.deltaY / s;
    else {
      this.cam.cx += (e.deltaX + e.deltaY) / s;
    }
  }

  placeAt(x, y) {
    const d = getDef(this.placeType);
    if (!d) return;
    const pos = snapPosition(d, x, y, this.grid, this.placeRot);
    const key = `${pos.x},${pos.y}`;
    if (this.drag && this.drag.last === key) return;
    if (this.drag) this.drag.last = key;
    if (this.model.existsAt(d.id, pos.x, pos.y)) return;
    const o = { t: d.id, x: pos.x, y: pos.y };
    if (this.placeRot) {
      if (d.rotatable) o.r = this.placeRot;
      else if (d.kind === 'slope') {
        const st = [0, 2, 3, 1][(this.placeRot / 90) % 4];
        o.fx = st & 1;
        o.fy = st & 2 ? 1 : 0;
      }
    }
    if (d.kind === 'trigger') o.y = Math.max(pos.y, 0.5);
    const uids = this.model.add([o], 'Place');
    if (uids.length) {
      this.app.sfx.play('place', { volume: 0.5, minGap: 0.02 });
      this.model.selection.clear();
      this.rebuildWorld();
    } else if (this.model.count >= 40000) this.setStatus('Object limit reached');
  }

  eraseAt(x, y) {
    const hit = this.model.pick(x, y);
    if (hit === null) return;
    this.model.remove([hit], 'Delete');
    this.app.sfx.play('erase', { volume: 0.5, minGap: 0.02 });
    this.rebuildWorld();
  }

  // ------------------------------------------------------------------ commands

  undo() {
    if (this.model.undo()) {
      this.setStatus('Undo');
      this.afterEdit();
    }
  }

  redo() {
    if (this.model.redo()) {
      this.setStatus('Redo');
      this.afterEdit();
    }
  }

  copy() {
    const c = this.model.copySelection();
    if (!c) return;
    clipboard = c;
    this.setStatus(`Copied ${c.length} object${c.length === 1 ? '' : 's'}`);
  }

  paste() {
    if (!clipboard || !clipboard.length) return this.setStatus('Clipboard is empty');
    const bx = this.mouse.inside ? Math.floor(this.mouse.x) : Math.floor(this.cam.cx);
    const by = this.mouse.inside ? Math.max(0, Math.floor(this.mouse.y)) : 0;
    const objs = clipboard.map((o) => ({ ...cloneObj(o), x: o.x + bx, y: o.y + by }));
    const uids = this.model.add(objs, 'Paste');
    this.model.selection = new Set(uids);
    this.setTool('edit');
    this.afterEdit();
    this.setStatus(`Pasted ${uids.length} objects`);
  }

  duplicate() {
    const sel = [...this.model.selection];
    if (!sel.length) return;
    const b = this.model.selectionBounds();
    const w = Math.max(1, Math.ceil(b.x1 - b.x0));
    const objs = sel.map((uid) => {
      const c = cloneObj(this.model.get(uid));
      c.x += w;
      return c;
    });
    const uids = this.model.add(objs, 'Duplicate');
    this.model.selection = new Set(uids);
    this.afterEdit();
  }

  deleteSelection() {
    const sel = [...this.model.selection];
    if (!sel.length) return;
    this.model.remove(sel, 'Delete');
    this.app.sfx.play('erase');
    this.afterEdit();
  }

  rotate(deg) {
    if (!this.model.selection.size) return;
    this.model.rotateSelection(deg);
    this.afterEdit();
  }

  rotatePlacement(deg) {
    this.placeRot = (((this.placeRot + deg) % 360) + 360) % 360;
    this.setStatus(`Placement rotation ${this.placeRot}°`);
  }

  flip(axis) {
    if (!this.model.selection.size) return;
    this.model.flipSelection(axis);
    this.afterEdit();
  }

  nudge(dx, dy) {
    const sel = [...this.model.selection];
    if (!sel.length) {
      this.cam.cx += dx * 4;
      this.cam.cy += dy * 4;
      return;
    }
    this.model.modify(sel, (o) => {
      o.x += dx;
      o.y += dy;
    }, 'Move');
    this.afterEdit();
  }

  zoomBy(f) {
    this.cam.zoom = clamp(this.cam.zoom * f, 0.25, 3);
  }

  viewHalfW() {
    return this.app.renderer.viewHalf(this.cam.zoom).hw;
  }

  setStatus(text) {
    this.status.textContent = text;
    this.status.classList.remove('flash');
    void this.status.offsetWidth;
    this.status.classList.add('flash');
  }

  // ------------------------------------------------------------------ music preview

  toggleMusicPreview() {
    if (this.previewMusic) return this.stopMusicPreview();
    if (!this.world) return;
    this.previewMusic = true;
    const startX = Math.max(0, this.cam.cx - this.viewHalfW() * 0.6);
    const t = timeAtX(this.world.timeline, startX);
    this.app.music.play(this.model.meta.song.id, (this.model.meta.song.offset || 0) + t, { wait: false });
    this.previewStart = { x: startX };
    this.refreshToolbar();
  }

  stopMusicPreview() {
    if (!this.previewMusic) return;
    this.previewMusic = false;
    this.app.music.stop(0.15);
    this.refreshToolbar();
  }

  // ------------------------------------------------------------------ test / save / verify

  test(fromCamera) {
    this.stopMusicPreview();
    const level = this.model.toLevel();
    const startX = fromCamera ? Math.max(0, this.cam.cx - this.viewHalfW() * 0.6) : 0;
    const app = this.app;
    const scene = new PlayScene(app, { level, source: 'editor' }, {
      fromEditor: true,
      startX: fromCamera ? startX : undefined,
      useStartPos: !fromCamera,
      onExit: () => app.setScene(this),
      onVerified: () => {
        if (this.model.meta.id && !this.dirty && !this.isNew) {
          app.levelStore.setVerified(this.model.meta.id, true);
        }
        this.verifiedVersion = this.model.version;
        app.progress.recordLevelVerified();
        app.checkAchievements();
      },
    });
    app.setScene(scene);
  }

  async save() {
    const app = this.app;
    try {
      const level = this.model.toLevel();
      app.levelStore.save(level);
      app.levelStore.setVerified(level.id, this.verifiedVersion === this.model.version);
      this.savedVersion = this.model.version;
      this.isNew = false;
      app.progress.recordLevelSaved();
      app.checkAchievements();
      app.ui.toast('Level saved', `${level.name} · ${level.objects.length} objects`, { iconName: 'save' });
      this.refreshToolbar();
      return true;
    } catch (e) {
      app.ui.alert('Save failed', e.message || String(e));
      return false;
    }
  }

  verify() {
    const app = this.app;
    if (this.verifying) return;
    this.verifying = true;
    this.setStatus('Verifying… the autopilot is searching for a route');
    const level = this.model.toLevel();
    const done = (res) => {
      this.verifying = false;
      if (!res.ok) {
        app.ui.alert('Verification error', res.error || 'Unknown error');
        return;
      }
      if (res.success) {
        this.verifyMark = null;
        app.ui.toast('Level is beatable', 'The autopilot found a route to the end.', { iconName: 'verify' });
        this.setStatus('Verified: a route to the end exists');
      } else {
        this.verifyMark = res.x;
        app.ui.toast('Possibly impossible', `The autopilot got stuck at ${Math.floor(res.progress * 100)}% (marked in red).`, { kind: 'error', iconName: 'verify', duration: 5000 });
        this.setStatus(`Stuck at x=${res.x.toFixed(1)}`);
        this.cam.cx = res.x + this.viewHalfW() * 0.3;
      }
    };
    try {
      const w = new Worker(new URL('./verifyWorker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => {
        w.terminate();
        done(e.data);
      };
      w.onerror = (e) => {
        e.preventDefault?.();
        w.terminate();
        done({ ok: false, error: 'Verification worker failed to start' });
      };
      w.postMessage({ id: 1, level });
    } catch (e) {
      done({ ok: false, error: e.message });
    }
  }

  async requestExit() {
    const app = this.app;
    if (this.dirty) {
      const v = await app.ui.dialog({
        title: 'Unsaved changes',
        content: 'Save your level before leaving the editor?',
        buttons: [{ label: 'Cancel', value: null }, { label: 'Discard', value: 'discard', danger: true }, { label: 'Save & exit', value: 'save', primary: true }],
      });
      if (!v) return;
      if (v === 'save' && !(await this.save())) return;
    }
    this.nav.menu('levels', { tab: 'mine' });
  }

  async openSettings() {
    const app = this.app;
    const m = this.model.meta;
    const field = (label, input) => h('label.ed-field', h('span', label), input);
    const name = h('input.field', { type: 'text', value: m.name, maxLength: 40 });
    const desc = h('input.field', { type: 'text', value: m.description || '', maxLength: 160 });
    const sel = (opts, cur, fmt = (x) => x) => h('select.field', opts.map((o) => h('option', { value: String(o), selected: String(o) === String(cur) }, fmt(o))));
    const diff = sel(DIFFICULTIES, m.difficulty, (d) => DIFFICULTY_LABEL[d]);
    const songs = levelSongs();
    const song = sel(songs.map((s) => s.id), m.song.id, (id) => { const s = getSong(id); return `${s.name} (${s.bpm} BPM)`; });
    const offset = h('input.field', { type: 'number', step: 0.05, value: m.song.offset || 0 });
    const bg = sel(BACKGROUND_STYLES, m.settings.background);
    const ground = sel(GROUND_STYLES, m.settings.ground);
    const mode = sel(MODES, m.settings.mode);
    const speed = sel([0, 1, 2, 3, 4], m.settings.speed, (s) => ['Slow', 'Normal', 'Fast', 'Faster', 'Fastest'][s]);
    const colorInputs = {};
    const colors = h('div.ed-colors', COLOR_CHANNELS.map((ch) => {
      const inp = h('input.ed-color', { type: 'color', value: m.colors[ch] });
      colorInputs[ch] = inp;
      return h('label.ed-color-field', inp, h('span', COLOR_CHANNEL_NAMES[ch]));
    }));
    const content = h('div.ed-settings',
      field('Name', name), field('Description', desc), field('Difficulty', diff),
      field('Song', song), field('Song offset (s)', offset),
      field('Background', bg), field('Ground', ground), field('Start mode', mode), field('Start speed', speed),
      h('h4', 'Colors'), colors);
    const ok = await app.ui.dialog({ title: 'Level settings', content, wide: true, buttons: [{ label: 'Cancel', value: false }, { label: 'Apply', value: true, primary: true }] });
    if (!ok) return;
    const c = {};
    for (const ch of COLOR_CHANNELS) c[ch] = colorInputs[ch].value;
    this.model.setMeta({
      name: name.value.trim().slice(0, 40) || 'Untitled Level',
      description: desc.value.trim().slice(0, 160),
      difficulty: diff.value,
      stars: DIFFICULTY_STARS[diff.value],
      song: { id: song.value, offset: Number(offset.value) || 0 },
      settings: { ...m.settings, background: bg.value, ground: ground.value, mode: mode.value, speed: Number(speed.value) },
      colors: c,
    });
    this.rebuildWorld(true);
    this.refreshAll();
  }

  // ------------------------------------------------------------------ keys

  onKey(code, e) {
    if (this.app.ui.modal) return false;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      switch (code) {
        case 'KeyZ': e.shiftKey ? this.redo() : this.undo(); return true;
        case 'KeyY': this.redo(); return true;
        case 'KeyC': this.copy(); return true;
        case 'KeyV': this.paste(); return true;
        case 'KeyD': this.duplicate(); return true;
        case 'KeyS': this.save(); return true;
        case 'KeyA':
          this.model.selection = new Set(this.model.list().map((x) => x.uid));
          this.setTool('edit');
          return true;
        default: return false;
      }
    }
    const step = e.shiftKey ? 0.1 : this.grid ? 1 : 0.5;
    switch (code) {
      case 'Digit1': this.setTool('build'); return true;
      case 'Digit2': this.setTool('edit'); return true;
      case 'Digit3': this.setTool('delete'); return true;
      case 'KeyQ': this.model.selection.size ? this.rotate(e.shiftKey ? -15 : -90) : this.rotatePlacement(-90); return true;
      case 'KeyE': this.model.selection.size ? this.rotate(e.shiftKey ? 15 : 90) : this.rotatePlacement(90); return true;
      case 'KeyH': this.flip('x'); return true;
      case 'KeyV': this.flip('y'); return true;
      case 'KeyG': this.grid = !this.grid; this.refreshToolbar(); this.setStatus(this.grid ? 'Grid snap on' : 'Grid snap off'); return true;
      case 'KeyM': this.toggleMusicPreview(); return true;
      case 'Delete': case 'Backspace': this.deleteSelection(); return true;
      case 'ArrowLeft': this.nudge(-step, 0); return true;
      case 'ArrowRight': this.nudge(step, 0); return true;
      case 'ArrowUp': this.nudge(0, step); return true;
      case 'ArrowDown': this.nudge(0, -step); return true;
      case 'Equal': case 'NumpadAdd': this.zoomBy(1.25); return true;
      case 'Minus': case 'NumpadSubtract': this.zoomBy(1 / 1.25); return true;
      case 'Enter': case 'NumpadEnter': this.test(e.shiftKey); return true;
      case 'Escape':
        if (this.model.selection.size) {
          this.model.selection.clear();
          this.renderInspector();
        } else this.requestExit();
        return true;
      case 'Space': return true;
      default: return false;
    }
  }

  onHidden() {
    this.stopMusicPreview();
  }

  // ------------------------------------------------------------------ loop

  update(dt, now) {
    this.rebuildWorld();
    if (this.previewMusic && this.world) {
      const pos = this.app.music.position(now) - (this.model.meta.song.offset || 0);
      const x = xAtTime(this.world.timeline, pos);
      this.cam.cx = x + this.viewHalfW() * 0.6;
      this.playheadX = x;
      if (pos > this.app.music.duration + 1) this.stopMusicPreview();
    }
    if (Math.abs((this._colorPreviewX ?? 0) - this.cam.cx) > 1) this.previewColorsAt(this.cam.cx);
    if (document.activeElement !== this.slider) this.slider.value = String(this.cam.cx - this.viewHalfW() * 0.6);
    // info line
    const mx = this.mouse.x, my = this.mouse.y;
    const song = getSong(this.model.meta.song.id);
    const t = this.world ? timeAtX(this.world.timeline, Math.max(0, mx)) : 0;
    const beat = (t * song.bpm) / 60;
    this.info.textContent = `x ${mx.toFixed(1)}  y ${my.toFixed(1)}  ·  ${t.toFixed(2)}s  ·  beat ${beat.toFixed(2)}  ·  ${this.model.count} objects  ·  zoom ${Math.round(this.cam.zoom * 100)}%${this.grid ? '' : '  ·  free placement'}`;
    this.app.particles.update(dt);
  }

  render(now) {
    if (!this.world) return;
    const app = this.app;
    const song = getSong(this.model.meta.song.id);
    const beatF = this.previewMusic ? ((app.music.position(now)) * song.bpm) / 60 : 0;
    const beat = this.previewMusic ? Math.exp(-(beatF - Math.floor(beatF)) * 5) * 0.4 : 0;
    app.gameView.render({
      world: this.world,
      state: this.state,
      cam: this.cam,
      cfg: { ...app.renderCfg, shake: false },
      time: now / 1000,
      beat,
      energy: 0.4,
      editor: true,
      showTriggerLines: this.showTriggerLines,
      groundOverride: { floor: 0, ceil: Infinity },
      editorUnderlay: (ctx, view) => this.drawUnderlay(ctx, view, song),
      editorOverlay: (ctx, view) => this.drawOverlay(ctx, view),
    });
  }

  drawUnderlay(ctx, view, song) {
    const zoom = this.cam.zoom;
    ctx.save();
    // grid
    if (zoom > 0.35) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      for (let x = Math.floor(view.x0); x <= view.x1; x++) {
        ctx.moveTo(x, Math.max(0, view.y0));
        ctx.lineTo(x, view.y1);
      }
      for (let y = Math.max(0, Math.floor(view.y0)); y <= view.y1; y++) {
        ctx.moveTo(view.x0, y);
        ctx.lineTo(view.x1, y);
      }
      ctx.stroke();
    }
    // beat guides
    if (this.world) {
      const t0 = timeAtX(this.world.timeline, Math.max(0, view.x0));
      const t1 = timeAtX(this.world.timeline, Math.max(0, view.x1));
      const spb = 60 / song.bpm;
      const off = this.model.meta.song.offset || 0;
      for (let b = Math.floor((t0 + off) / spb); b * spb - off <= t1; b++) {
        const t = b * spb - off;
        if (t < 0) continue;
        const x = xAtTime(this.world.timeline, t);
        const bar = b % 4 === 0;
        ctx.strokeStyle = bar ? 'rgba(255,210,63,0.35)' : 'rgba(255,210,63,0.13)';
        ctx.lineWidth = bar ? 0.05 : 0.03;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, view.y1);
        ctx.stroke();
      }
    }
    // start line
    ctx.strokeStyle = 'rgba(77,255,122,0.6)';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, view.y1);
    ctx.stroke();
    ctx.restore();
  }

  drawOverlay(ctx, view) {
    const m = this.model;
    ctx.save();
    // level end
    if (this.world) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([0.3, 0.3]);
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(this.world.length, 0);
      ctx.lineTo(this.world.length, view.y1);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.verifyMark !== null) {
      ctx.strokeStyle = 'rgba(255,59,59,0.85)';
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(this.verifyMark, 0);
      ctx.lineTo(this.verifyMark, view.y1);
      ctx.stroke();
    }
    if (this.previewMusic && this.playheadX !== undefined) {
      ctx.strokeStyle = 'rgba(56,200,255,0.9)';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(this.playheadX, 0);
      ctx.lineTo(this.playheadX, view.y1);
      ctx.stroke();
    }
    // selection
    ctx.lineWidth = 0.05;
    for (const uid of m.selection) {
      const o = m.get(uid);
      if (!o) continue;
      const b = objectBounds(o);
      ctx.fillStyle = 'rgba(77,255,122,0.15)';
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.strokeStyle = '#4dff7a';
      ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
    // box select
    if (this.drag && this.drag.kind === 'box') {
      const { start, end } = this.drag;
      ctx.fillStyle = 'rgba(56,200,255,0.12)';
      ctx.strokeStyle = 'rgba(56,200,255,0.9)';
      ctx.setLineDash([0.2, 0.15]);
      ctx.fillRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
      ctx.strokeRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
      ctx.setLineDash([]);
    }
    // build ghost
    if (this.tool === 'build' && this.mouse.inside && !this.drag) {
      const d = getDef(this.placeType);
      if (d) {
        const pos = snapPosition(d, this.mouse.x, this.mouse.y, this.grid, this.placeRot);
        const o = { t: d.id, x: pos.x, y: pos.y, r: d.rotatable ? this.placeRot : 0 };
        const b = objectBounds(o);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.setLineDash([0.15, 0.1]);
        ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      }
    }
    if (this.tool === 'delete' && this.mouse.inside) {
      const hit = m.pick(this.mouse.x, this.mouse.y);
      if (hit !== null) {
        const b = objectBounds(m.get(hit));
        ctx.strokeStyle = '#ff3b3b';
        ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      }
    }
    ctx.restore();
  }
}

export { OBJECT_DEFS };
