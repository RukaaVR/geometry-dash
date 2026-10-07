// Pure math / geometry helpers shared by simulation, rendering and editor.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const DEG = Math.PI / 180;
export const approach = (v, target, amount) =>
  v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);

/** Easing functions, keyed by name so they can be stored in level data. */
export const EASINGS = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  backOut: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  bounceOut: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};
export const EASING_NAMES = Object.keys(EASINGS);
export const ease = (name, t) => (EASINGS[name] || EASINGS.linear)(clamp(t, 0, 1));

// ---------------------------------------------------------------- colors

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(s) {
  return typeof s === 'string' && HEX_RE.test(s);
}

/** Parse '#rgb' / '#rrggbb' into {r,g,b} 0..255. Invalid input yields white. */
export function hexToRgb(hex) {
  if (!isHexColor(hex)) return { r: 255, g: 255, b: 255 };
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export const mixRgb = (a, b, t) => ({ r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) });

export function rgbCss(c, a = 1) {
  return a >= 1
    ? `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`
    : `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${a.toFixed(3)})`;
}

export function shade(c, amount) {
  // amount < 0 darkens, > 0 lightens
  const t = Math.abs(amount);
  const target = amount < 0 ? 0 : 255;
  return { r: lerp(c.r, target, t), g: lerp(c.g, target, t), b: lerp(c.b, target, t) };
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

// ---------------------------------------------------------------- geometry

export function rotatePoint(x, y, cx, cy, rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

export const aabbOverlap = (a, b) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Separating-axis test: convex polygon (flat [x,y,x,y...]) vs AABB. */
export function polyAabbOverlap(pts, box) {
  // AABB axes
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i], y = pts[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX <= box.x0 || minX >= box.x1 || maxY <= box.y0 || minY >= box.y1) return false;
  // polygon edge normals
  const n = pts.length;
  const bx = [box.x0, box.x1, box.x1, box.x0];
  const by = [box.y0, box.y0, box.y1, box.y1];
  for (let i = 0; i < n; i += 2) {
    const ax = pts[i], ay = pts[i + 1];
    const bx2 = pts[(i + 2) % n], by2 = pts[(i + 3) % n];
    const nx = -(by2 - ay), ny = bx2 - ax;
    if (nx === 0 && ny === 0) continue;
    let pMin = Infinity, pMax = -Infinity;
    for (let j = 0; j < n; j += 2) {
      const d = pts[j] * nx + pts[j + 1] * ny;
      if (d < pMin) pMin = d;
      if (d > pMax) pMax = d;
    }
    let qMin = Infinity, qMax = -Infinity;
    for (let j = 0; j < 4; j++) {
      const d = bx[j] * nx + by[j] * ny;
      if (d < qMin) qMin = d;
      if (d > qMax) qMax = d;
    }
    if (pMax <= qMin || qMax <= pMin) return false;
  }
  return true;
}

export function circleAabbOverlap(cx, cy, r, box) {
  const nx = clamp(cx, box.x0, box.x1);
  const ny = clamp(cy, box.y0, box.y1);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- rng

/** Small deterministic PRNG (mulberry32). */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
