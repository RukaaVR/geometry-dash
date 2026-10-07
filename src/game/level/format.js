// Level file format: validation, normalisation and serialisation.
//
// A level is plain JSON so it can be saved, shared and edited. Loading never trusts
// input: every field is coerced, unknown objects are dropped with a warning, and a
// malformed level produces a LevelError instead of crashing the game.

import { getDef, coerceProp, COLOR_CHANNELS } from '../objects/registry.js';
import { MODES } from '../constants.js';
import { isHexColor } from '../../core/math.js';

export const FORMAT_VERSION = 1;
export const DIFFICULTIES = ['easy', 'normal', 'hard', 'harder', 'insane', 'extreme'];
export const DIFFICULTY_STARS = { easy: 2, normal: 3, hard: 5, harder: 7, insane: 9, extreme: 10 };
export const BACKGROUND_STYLES = ['grid', 'skyline', 'waves', 'nebula', 'circuit', 'void'];
export const GROUND_STYLES = ['tiles', 'stripes', 'plain', 'circuit'];
export const MAX_OBJECTS = 40000;

export const DEFAULT_COLORS = {
  bg: '#1b3fa6', ground: '#1239a8', line: '#ffffff', obj: '#ffffff',
  c1: '#7fb8ff', c2: '#ff5fd2', c3: '#4dff7a', c4: '#ffb347', c5: '#a46bff', c6: '#ffd23f', c7: '#38c8ff', c8: '#ff3b3b',
};

export class LevelError extends Error {}

const num = (v, def, min = -1e6, max = 1e6) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const str = (v, def, max = 64) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : def);

export function createEmptyLevel(overrides = {}) {
  return normalizeLevel({
    id: 'custom-' + Date.now().toString(36),
    name: 'Untitled Level',
    author: 'You',
    difficulty: 'normal',
    song: { id: 'neon_drive', offset: 0 },
    objects: [],
    ...overrides,
  }).level;
}

/** Normalise one raw object. Returns null (and pushes a warning) when invalid. */
export function normalizeObject(raw, warnings, index = 0) {
  if (!raw || typeof raw !== 'object') {
    warnings.push(`Object #${index}: not an object`);
    return null;
  }
  const d = getDef(raw.t);
  if (!d) {
    warnings.push(`Object #${index}: unknown type "${raw.t}"`);
    return null;
  }
  const x = Number(raw.x), y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    warnings.push(`Object #${index} (${raw.t}): invalid position`);
    return null;
  }
  const o = { t: d.id, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  const r = num(raw.r, 0, -3600, 3600);
  if (r && d.rotatable) o.r = ((r % 360) + 360) % 360;
  const s = num(raw.s, 1, 0.1, 10);
  if (s !== 1 && d.scalable) o.s = s;
  if (raw.fx) o.fx = 1;
  if (raw.fy) o.fy = 1;
  if (raw.c && COLOR_CHANNELS.includes(raw.c) && raw.c !== d.color) o.c = raw.c;
  if (raw.z !== undefined && Number.isFinite(Number(raw.z))) o.z = Math.max(-3, Math.min(3, Math.round(Number(raw.z))));
  const alpha = num(raw.a, 1, 0, 1);
  if (alpha !== 1) o.a = alpha;
  if (Array.isArray(raw.g)) {
    const groups = [...new Set(raw.g.map((g) => Math.round(Number(g))).filter((g) => g >= 1 && g <= 999))].slice(0, 10);
    if (groups.length) o.g = groups;
  }
  if (d.props.length) {
    const p = {};
    const src = raw.p && typeof raw.p === 'object' ? raw.p : {};
    for (const schema of d.props) {
      const v = coerceProp(schema, src[schema.key]);
      if (v !== schema.default) p[schema.key] = v;
    }
    if (Object.keys(p).length) o.p = p;
  }
  return o;
}

/** Read a property from a normalised object, falling back to the schema default. */
export function prop(o, key) {
  if (o.p && key in o.p) return o.p[key];
  const d = getDef(o.t);
  const schema = d && d.props.find((s) => s.key === key);
  return schema ? schema.default : undefined;
}

/**
 * Validate and normalise raw level data (object or JSON string).
 * @returns {{level: object, warnings: string[]}}
 */
export function normalizeLevel(input) {
  let raw = input;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      throw new LevelError('Level data is not valid JSON');
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new LevelError('Level data must be an object');
  if (raw.objects !== undefined && !Array.isArray(raw.objects)) throw new LevelError('Level objects must be a list');
  const warnings = [];

  const settingsIn = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const settings = {
    mode: MODES.includes(settingsIn.mode) ? settingsIn.mode : 'cube',
    speed: Math.round(num(settingsIn.speed, 1, 0, 4)),
    gravity: Number(settingsIn.gravity) === -1 ? -1 : 1,
    mini: !!settingsIn.mini,
    corridor: Math.round(num(settingsIn.corridor, 0, 0, 30)),
    background: BACKGROUND_STYLES.includes(settingsIn.background) ? settingsIn.background : 'grid',
    ground: GROUND_STYLES.includes(settingsIn.ground) ? settingsIn.ground : 'tiles',
    length: settingsIn.length !== undefined ? num(settingsIn.length, 0, 0, 1e5) : 0,
  };

  const colors = { ...DEFAULT_COLORS };
  if (raw.colors && typeof raw.colors === 'object') {
    for (const ch of COLOR_CHANNELS) if (isHexColor(raw.colors[ch])) colors[ch] = raw.colors[ch].toLowerCase();
  }

  const objects = [];
  const list = Array.isArray(raw.objects) ? raw.objects : [];
  if (list.length > MAX_OBJECTS) warnings.push(`Level has ${list.length} objects; only the first ${MAX_OBJECTS} were loaded`);
  for (let i = 0; i < Math.min(list.length, MAX_OBJECTS); i++) {
    const o = normalizeObject(list[i], warnings, i);
    if (o) objects.push(o);
  }

  const difficulty = DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : 'normal';
  const song = raw.song && typeof raw.song === 'object' ? raw.song : {};
  const level = {
    format: FORMAT_VERSION,
    id: str(raw.id, 'level-' + Math.random().toString(36).slice(2, 8), 80),
    name: str(raw.name, 'Untitled Level', 40),
    author: str(raw.author, 'Unknown', 32),
    description: str(raw.description, '', 160),
    difficulty,
    stars: Math.round(num(raw.stars, DIFFICULTY_STARS[difficulty], 0, 10)),
    song: { id: str(song.id, 'neon_drive', 40), offset: num(song.offset, 0, -10, 600) },
    bpm: num(raw.bpm, 0, 0, 400),
    settings,
    colors,
    objects,
  };
  return { level, warnings };
}

export function serializeLevel(level) {
  return JSON.stringify(level);
}

/** Furthest right edge of any gameplay object; used for the level length. */
export function computeLevelLength(level) {
  if (level.settings.length > 0) return level.settings.length;
  let maxX = 0;
  for (const o of level.objects) {
    const d = getDef(o.t);
    if (!d || d.kind === 'trigger' || d.kind === 'startpos') continue;
    const s = o.s || 1;
    maxX = Math.max(maxX, o.x + (Math.max(d.w, d.h) * s) / 2);
  }
  return Math.max(30, Math.ceil(maxX + 12));
}
