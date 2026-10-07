// Data-driven object definitions. Every placeable thing in a level is described here;
// simulation, rendering and the editor all read from this single table.
//
// Coordinates: an object's (x, y) is its centre. `w`/`h` are the visual size in blocks
// at scale 1. Hitboxes are expressed in object-local space (centre origin, before
// rotation/flip/scale) and transformed when a level is built.

import { MODES, MODE_CORRIDOR, SPEED_NAMES } from '../constants.js';
import { EASING_NAMES } from '../../core/math.js';

export const CATEGORIES = [
  { id: 'blocks', name: 'Blocks', icon: 'block' },
  { id: 'hazards', name: 'Hazards', icon: 'spike' },
  { id: 'pads', name: 'Pads & Orbs', icon: 'orb_yellow' },
  { id: 'portals', name: 'Portals', icon: 'portal_ship' },
  { id: 'special', name: 'Special', icon: 'coin' },
  { id: 'deco', name: 'Decoration', icon: 'deco_diamond' },
  { id: 'triggers', name: 'Triggers', icon: 'trig_color' },
];

export const COLOR_CHANNELS = ['bg', 'ground', 'line', 'obj', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
export const COLOR_CHANNEL_NAMES = {
  bg: 'Background', ground: 'Ground', line: 'Ground Line', obj: 'Objects',
  c1: 'Color 1', c2: 'Color 2', c3: 'Color 3', c4: 'Color 4', c5: 'Color 5', c6: 'Color 6', c7: 'Color 7', c8: 'Color 8',
};

const rect = (x, y, w, h) => ({ type: 'rect', x, y, w, h });
const poly = (...pts) => ({ type: 'poly', pts });
const circle = (r) => ({ type: 'circle', r });

const P = {
  num: (key, label, def, min, max, step = 0.1) => ({ key, label, type: 'number', default: def, min, max, step }),
  int: (key, label, def, min, max) => ({ key, label, type: 'number', default: def, min, max, step: 1 }),
  bool: (key, label, def) => ({ key, label, type: 'bool', default: def }),
  select: (key, label, def, options) => ({ key, label, type: 'select', default: def, options }),
  color: (key, label, def) => ({ key, label, type: 'color', default: def }),
  channel: (key, label, def) => ({ key, label, type: 'select', default: def, options: COLOR_CHANNELS }),
  group: (key, label) => ({ key, label, type: 'number', default: 1, min: 1, max: 999, step: 1 }),
  easing: () => ({ key: 'easing', label: 'Easing', type: 'select', default: 'easeInOut', options: EASING_NAMES }),
};

const BLOCK_STYLES = ['grid', 'solid', 'brick', 'glass', 'tech', 'outline'];

const defs = [];
const def = (d) => {
  defs.push({
    rotatable: true,
    scalable: true,
    layer: 0,
    color: 'obj',
    props: [],
    w: 1,
    h: 1,
    ...d,
  });
};

// ------------------------------------------------------------------ blocks
def({ id: 'block', name: 'Block', cat: 'blocks', kind: 'solid', draw: 'block', hit: rect(0, 0, 1, 1),
  props: [P.select('style', 'Style', 'grid', BLOCK_STYLES)] });
def({ id: 'slab', name: 'Slab', cat: 'blocks', kind: 'solid', draw: 'slab', h: 0.5, hit: rect(0, 0, 1, 0.5),
  props: [P.select('style', 'Style', 'grid', BLOCK_STYLES)] });
def({ id: 'ledge', name: 'Ledge', cat: 'blocks', kind: 'solid', draw: 'ledge', h: 0.25, hit: rect(0, 0, 1, 0.25) });
def({ id: 'slope45', name: 'Slope 45°', cat: 'blocks', kind: 'slope', draw: 'slope', rotatable: false, hit: poly(-0.5, -0.5, 0.5, -0.5, 0.5, 0.5),
  props: [P.select('style', 'Style', 'grid', BLOCK_STYLES)] });
def({ id: 'slope22', name: 'Slope 22°', cat: 'blocks', kind: 'slope', draw: 'slope', w: 2, rotatable: false, hit: poly(-1, -0.5, 1, -0.5, 1, 0.5),
  props: [P.select('style', 'Style', 'grid', BLOCK_STYLES)] });
def({ id: 'crumble', name: 'Crumble Block', cat: 'blocks', kind: 'crumble', draw: 'crumble', hit: rect(0, 0, 1, 1), color: 'c4',
  props: [P.num('delay', 'Break delay', 0.18, 0, 2, 0.02)] });

// ------------------------------------------------------------------ hazards
def({ id: 'spike', name: 'Spike', cat: 'hazards', kind: 'hazard', draw: 'spike', hit: rect(0, -0.04, 0.22, 0.46) });
def({ id: 'spike_small', name: 'Small Spike', cat: 'hazards', kind: 'hazard', draw: 'spike_small', h: 0.5, hit: rect(0, -0.04, 0.2, 0.22) });
def({ id: 'thorns', name: 'Thorns', cat: 'hazards', kind: 'hazard', draw: 'thorns', h: 0.4, hit: rect(0, -0.06, 0.8, 0.16) });
def({ id: 'saw', name: 'Saw', cat: 'hazards', kind: 'hazard', draw: 'saw', w: 2, h: 2, hit: circle(0.78),
  props: [P.num('spin', 'Spin speed', 360, -1440, 1440, 30)] });
def({ id: 'saw_small', name: 'Small Saw', cat: 'hazards', kind: 'hazard', draw: 'saw', hit: circle(0.38),
  props: [P.num('spin', 'Spin speed', 480, -1440, 1440, 30)] });
def({ id: 'saw_large', name: 'Large Saw', cat: 'hazards', kind: 'hazard', draw: 'saw', w: 3, h: 3, hit: circle(1.2),
  props: [P.num('spin', 'Spin speed', 240, -1440, 1440, 30)] });

// ------------------------------------------------------------------ pads & orbs
const PAD_COLORS = { yellow: '#ffd23f', pink: '#ff5fd2', red: '#ff3b3b', blue: '#38c8ff' };
for (const c of ['yellow', 'pink', 'red', 'blue']) {
  def({ id: `pad_${c}`, name: `${c[0].toUpperCase() + c.slice(1)} Pad`, cat: 'pads', kind: 'pad', variant: c, tint: PAD_COLORS[c],
    draw: 'pad', h: 0.3, hit: rect(0, 0, 0.9, 0.3), scalable: false });
}
const ORB_COLORS = { yellow: '#ffd23f', pink: '#ff5fd2', red: '#ff3b3b', blue: '#38c8ff', green: '#4dff7a', black: '#20202a' };
for (const c of ['yellow', 'pink', 'red', 'blue', 'green', 'black']) {
  def({ id: `orb_${c}`, name: `${c[0].toUpperCase() + c.slice(1)} Orb`, cat: 'pads', kind: 'orb', variant: c, tint: ORB_COLORS[c],
    draw: 'orb', hit: rect(0, 0, 1.16, 1.16), scalable: false, rotatable: false });
}

// ------------------------------------------------------------------ portals
const MODE_TINT = { cube: '#4dff7a', ship: '#ff5fd2', ball: '#ff8a3d', ufo: '#ffd23f', wave: '#38c8ff', robot: '#f2f2f2', spider: '#a46bff' };
for (const m of MODES) {
  def({ id: `portal_${m}`, name: `${m[0].toUpperCase() + m.slice(1)} Portal`, cat: 'portals', kind: 'portal', action: 'mode', value: m,
    tint: MODE_TINT[m], draw: 'portal', w: 1, h: 3, hit: rect(0, 0, 0.8, 3), scalable: false,
    props: [P.int('corridor', 'Corridor height', MODE_CORRIDOR[m], 0, 30)] });
}
def({ id: 'portal_gravity_down', name: 'Normal Gravity', cat: 'portals', kind: 'portal', action: 'gravity', value: 1, tint: '#38c8ff',
  draw: 'portal_gravity', h: 3, hit: rect(0, 0, 0.8, 3), scalable: false });
def({ id: 'portal_gravity_up', name: 'Flip Gravity', cat: 'portals', kind: 'portal', action: 'gravity', value: -1, tint: '#ffd23f',
  draw: 'portal_gravity', h: 3, hit: rect(0, 0, 0.8, 3), scalable: false });
def({ id: 'portal_mini', name: 'Mini Portal', cat: 'portals', kind: 'portal', action: 'size', value: true, tint: '#ff5fd2',
  draw: 'portal_size', h: 3, hit: rect(0, 0, 0.8, 3), scalable: false });
def({ id: 'portal_big', name: 'Normal Size Portal', cat: 'portals', kind: 'portal', action: 'size', value: false, tint: '#4dff7a',
  draw: 'portal_size', h: 3, hit: rect(0, 0, 0.8, 3), scalable: false });
const SPEED_TINT = ['#ff9b3d', '#38c8ff', '#4dff7a', '#ff5fd2', '#ff3b3b'];
SPEED_NAMES.forEach((n, i) => {
  def({ id: `speed_${i}`, name: `${n} Speed`, cat: 'portals', kind: 'portal', action: 'speed', value: i, tint: SPEED_TINT[i],
    draw: 'portal_speed', w: 1.4, h: 2, hit: rect(0, 0, 1, 2.4), scalable: false, rotatable: false });
});
def({ id: 'teleport', name: 'Teleport Portal', cat: 'portals', kind: 'portal', action: 'teleport', value: 0, tint: '#38c8ff',
  draw: 'portal_teleport', h: 3, hit: rect(0, 0, 0.8, 3), scalable: false,
  props: [P.num('dy', 'Exit offset Y', 4, -60, 60, 0.5)] });

// ------------------------------------------------------------------ special
def({ id: 'coin', name: 'Secret Coin', cat: 'special', kind: 'coin', draw: 'coin', hit: circle(0.55), scalable: false, rotatable: false,
  props: [P.int('index', 'Coin #', 0, 0, 2)] });
def({ id: 'startpos', name: 'Start Position', cat: 'special', kind: 'startpos', draw: 'startpos', w: 1, h: 1, hit: null, scalable: false, rotatable: false,
  props: [
    P.select('mode', 'Mode', 'cube', MODES),
    P.select('speed', 'Speed', 1, [0, 1, 2, 3, 4]),
    P.select('gravity', 'Gravity', 1, [1, -1]),
    P.bool('mini', 'Mini', false),
    P.int('corridor', 'Corridor height', 0, 0, 30),
  ] });

// ------------------------------------------------------------------ decoration
const DECO = [
  ['deco_diamond', 'Diamond'], ['deco_square', 'Hollow Square'], ['deco_ring', 'Ring'], ['deco_chevron', 'Chevron'],
  ['deco_bar', 'Light Bar'], ['deco_star', 'Star'], ['deco_cross', 'Cross'], ['deco_pillar', 'Pillar'],
  ['deco_glow', 'Glow Orb'], ['deco_arrow', 'Arrow'], ['deco_tri', 'Triangle'], ['deco_dots', 'Dot Grid'],
];
for (const [id, name] of DECO) {
  def({ id, name, cat: 'deco', kind: 'deco', draw: id, color: 'c1', layer: -1, hit: null,
    w: id === 'deco_pillar' ? 1 : 1, h: id === 'deco_pillar' ? 4 : 1,
    props: [P.bool('pulse', 'Beat pulse', id === 'deco_glow'), P.num('spin', 'Spin speed', 0, -720, 720, 15)] });
}

// ------------------------------------------------------------------ triggers
const TRIGGER_COMMON = [P.bool('touch', 'Touch triggered', false), P.bool('spawned', 'Spawn triggered only', false)];
const trig = (id, name, tint, props) =>
  def({ id, name, cat: 'triggers', kind: 'trigger', draw: 'trigger', tint, hit: rect(0, 0, 1, 1), scalable: false, rotatable: false,
    layer: 1, props: [...props, ...TRIGGER_COMMON] });

trig('trig_color', 'Color', '#ff5fd2', [P.channel('channel', 'Channel', 'bg'), P.color('color', 'Color', '#203070'), P.num('duration', 'Duration', 0.5, 0, 30, 0.05)]);
trig('trig_move', 'Move', '#38c8ff', [P.group('target', 'Target group'), P.num('dx', 'Move X', 0, -200, 200, 0.5), P.num('dy', 'Move Y', 2, -200, 200, 0.5),
  P.num('duration', 'Duration', 0.5, 0, 30, 0.05), P.easing()]);
trig('trig_rotate', 'Rotate', '#ffd23f', [P.group('target', 'Target group'), P.num('degrees', 'Degrees', 90, -3600, 3600, 15),
  P.num('duration', 'Duration', 0.5, 0, 30, 0.05), P.select('pivot', 'Pivot', 'self', ['self', 'group']), P.easing()]);
trig('trig_scale', 'Scale', '#4dff7a', [P.group('target', 'Target group'), P.num('scale', 'Scale', 1.5, 0.05, 8, 0.05),
  P.num('duration', 'Duration', 0.5, 0, 30, 0.05), P.easing()]);
trig('trig_pulse', 'Pulse', '#ff8a3d', [P.select('mode', 'Target', 'channel', ['channel', 'group']), P.channel('channel', 'Channel', 'obj'),
  P.group('target', 'Group'), P.color('color', 'Color', '#ffffff'), P.num('fadeIn', 'Fade in', 0, 0, 5, 0.05), P.num('hold', 'Hold', 0.05, 0, 5, 0.05),
  P.num('fadeOut', 'Fade out', 0.4, 0, 5, 0.05)]);
trig('trig_alpha', 'Alpha', '#c8c8ff', [P.group('target', 'Target group'), P.num('opacity', 'Opacity', 0, 0, 1, 0.05), P.num('duration', 'Duration', 0.5, 0, 30, 0.05)]);
trig('trig_toggle', 'Toggle', '#ff3b3b', [P.group('target', 'Target group'), P.bool('on', 'Enable', false)]);
trig('trig_camera', 'Camera', '#a46bff', [P.num('zoom', 'Zoom', 1, 0.4, 3, 0.05), P.num('offsetY', 'Offset Y', 0, -20, 20, 0.5),
  P.num('rotation', 'Rotation', 0, -180, 180, 1), P.num('duration', 'Duration', 1, 0, 30, 0.05), P.easing()]);
trig('trig_shake', 'Shake', '#ff6b6b', [P.num('strength', 'Strength', 0.3, 0, 3, 0.05), P.num('duration', 'Duration', 0.4, 0, 10, 0.05)]);
trig('trig_spawn', 'Spawn', '#7affd9', [P.group('target', 'Target group'), P.num('delay', 'Delay', 0, 0, 30, 0.05)]);
trig('trig_gameplay', 'Gameplay', '#ffffff', [
  P.select('mode', 'Mode', 'keep', ['keep', ...MODES]), P.select('speed', 'Speed', 'keep', ['keep', 0, 1, 2, 3, 4]),
  P.select('gravity', 'Gravity', 'keep', ['keep', 1, -1]), P.select('mini', 'Size', 'keep', ['keep', 'mini', 'normal'])]);
trig('trig_flash', 'Flash', '#fff3a0', [P.color('color', 'Color', '#ffffff'), P.num('intensity', 'Intensity', 0.6, 0, 1, 0.05), P.num('duration', 'Duration', 0.35, 0.05, 5, 0.05)]);
trig('trig_beat', 'Beat FX', '#ff9bf0', [P.bool('enabled', 'Enabled', true), P.select('division', 'Division', 1, [0.25, 0.5, 1, 2, 4]),
  P.num('intensity', 'Intensity', 0.6, 0, 1, 0.05)]);

// ------------------------------------------------------------------ lookup

export const OBJECT_DEFS = defs;
const byId = new Map(defs.map((d) => [d.id, d]));
export const getDef = (id) => byId.get(id) || null;
export const defsInCategory = (cat) => defs.filter((d) => d.cat === cat);

/** Default property values for a definition. */
export function defaultProps(d) {
  const out = {};
  for (const p of d.props) out[p.key] = p.default;
  return out;
}

/** Coerce a property value to the type in its schema; falls back to the default when invalid. */
export function coerceProp(schema, value) {
  if (value === undefined || value === null) return schema.default;
  switch (schema.type) {
    case 'number': {
      const n = Number(value);
      if (!Number.isFinite(n)) return schema.default;
      return Math.min(schema.max ?? Infinity, Math.max(schema.min ?? -Infinity, n));
    }
    case 'bool':
      return value === true || value === 'true' || value === 1;
    case 'select': {
      const match = schema.options.find((o) => String(o) === String(value));
      return match === undefined ? schema.default : match;
    }
    case 'color':
      return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : schema.default;
    default:
      return value;
  }
}
