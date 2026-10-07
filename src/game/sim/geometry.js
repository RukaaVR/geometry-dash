// Builds world-space collision geometry for an object given its transform.

import { DEG } from '../../core/math.js';

/**
 * @param {object} hit   local hitbox from the object definition
 * @param {number} x,y   world centre
 * @param {number} rot   clockwise degrees
 * @param {number} sx,sy signed scale (negative = flipped)
 * @returns {{x0,y0,x1,y1, poly?:number[], circle?:{x,y,r}}}
 */
export function buildHitGeometry(hit, x, y, rot, sx, sy) {
  if (!hit) return null;
  if (hit.type === 'circle') {
    const r = hit.r * Math.max(Math.abs(sx), Math.abs(sy));
    return { x0: x - r, y0: y - r, x1: x + r, y1: y + r, circle: { x, y, r } };
  }
  let local;
  if (hit.type === 'rect') {
    const hw = hit.w / 2, hh = hit.h / 2;
    local = [hit.x - hw, hit.y - hh, hit.x + hw, hit.y - hh, hit.x + hw, hit.y + hh, hit.x - hw, hit.y + hh];
  } else {
    local = hit.pts;
  }
  const r = ((rot % 360) + 360) % 360;
  const a = -r * DEG; // clockwise in a y-up world
  const c = Math.cos(a), s = Math.sin(a);
  const pts = new Array(local.length);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < local.length; i += 2) {
    const lx = local[i] * sx, ly = local[i + 1] * sy;
    const wx = x + lx * c - ly * s;
    const wy = y + lx * s + ly * c;
    pts[i] = wx;
    pts[i + 1] = wy;
    if (wx < x0) x0 = wx;
    if (wx > x1) x1 = wx;
    if (wy < y0) y0 = wy;
    if (wy > y1) y1 = wy;
  }
  const axisAligned = hit.type === 'rect' && r % 90 === 0;
  const g = { x0, y0, x1, y1 };
  if (!axisAligned) {
    // Keep winding counter-clockwise-agnostic: SAT does not care.
    g.poly = pts;
  }
  return g;
}

/**
 * Slope description in world space. A slope is a right triangle. `faceUp` means the
 * solid part is below the surface. `rising` describes the surface in the face-up frame
 * (i.e. after mirroring a face-down slope vertically): true = goes up to the right.
 */
export function buildSlopeInfo(geom, flipX, flipY) {
  return {
    x0: geom.x0,
    x1: geom.x1,
    y0: geom.y0,
    y1: geom.y1,
    k: (geom.y1 - geom.y0) / Math.max(1e-6, geom.x1 - geom.x0),
    rising: !flipX,
    faceUp: !flipY,
  };
}
