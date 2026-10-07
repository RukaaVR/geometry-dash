// Procedural parallax backgrounds. Drawn in screen space, driven by the camera
// position, the background colour channel and the music (beat pulse + energy).

import { rgbCss, mixRgb, makeRng } from '../core/math.js';

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

export class Background {
  constructor() {
    const rng = makeRng(424242);
    this.stars = Array.from({ length: 140 }, () => ({ x: rng(), y: rng(), s: rng.range(0.5, 2.2), tw: rng() * 6.28, depth: rng.range(0.05, 0.3) }));
    this.shapes = Array.from({ length: 26 }, () => ({
      x: rng(), y: rng(), size: rng.range(0.06, 0.2), rot: rng() * 6.28, vr: rng.range(-0.3, 0.3), depth: rng.range(0.05, 0.25), kind: rng.int(0, 2),
    }));
    this.buildings = [0, 1].map((layer) => {
      const r = makeRng(77 + layer);
      const list = [];
      let x = 0;
      while (x < 1) {
        const w = r.range(0.03, 0.08);
        list.push({ x, w, h: r.range(0.12, 0.45) * (layer ? 0.7 : 1), win: r.int(0, 3) });
        x += w + r.range(0.003, 0.02);
      }
      return list;
    });
  }

  /**
   * @param o {ctx, w, h, camX, camY, ppb, color, beat, energy, time, style, simple, highContrast}
   */
  draw(o) {
    const { ctx, w, h } = o;
    const base = o.color;
    const top = mixRgb(base, BLACK, 0.55);
    const bottom = mixRgb(base, WHITE, 0.06 + o.beat * 0.06 * o.energy);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgbCss(top));
    g.addColorStop(1, rgbCss(bottom));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (o.simple) return;
    switch (o.style) {
      case 'skyline':
        this.skyline(o, base);
        break;
      case 'waves':
        this.waves(o, base);
        break;
      case 'nebula':
        this.nebula(o, base);
        break;
      case 'circuit':
        this.circuit(o, base);
        break;
      case 'void':
        this.voidStyle(o, base);
        break;
      default:
        this.grid(o, base);
        break;
    }
    // beat flash on the horizon
    if (o.beat > 0.01 && o.energy > 0.3) {
      const hg = ctx.createLinearGradient(0, h * 0.45, 0, h);
      hg.addColorStop(0, rgbCss(WHITE, 0));
      hg.addColorStop(1, rgbCss(mixRgb(base, WHITE, 0.6), 0.1 * o.beat * o.energy));
      ctx.fillStyle = hg;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
    }
  }

  parallax(o, depth, period) {
    return (((o.camX * o.ppb * depth) % period) + period) % period;
  }

  floatingShapes(o, base, alpha = 0.12) {
    const { ctx, w, h } = o;
    ctx.save();
    ctx.lineWidth = Math.max(1, h * 0.004);
    for (const s of this.shapes) {
      const span = w * 1.3;
      const x = ((s.x * span - o.camX * o.ppb * s.depth) % span + span) % span - w * 0.15;
      const y = s.y * h * 0.85 - o.camY * o.ppb * s.depth * 0.5;
      const size = s.size * h * (1 + o.beat * 0.08 * o.energy);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s.rot + o.time * s.vr);
      ctx.strokeStyle = rgbCss(mixRgb(base, WHITE, 0.35), alpha * (0.5 + s.depth * 3));
      if (s.kind === 0) ctx.strokeRect(-size / 2, -size / 2, size, size);
      else if (s.kind === 1) {
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(size / 2, size / 2);
        ctx.lineTo(-size / 2, size / 2);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  grid(o, base) {
    const { ctx, w, h } = o;
    const cell = h / 3.2;
    for (let layer = 0; layer < 2; layer++) {
      const depth = layer ? 0.18 : 0.08;
      const c = cell * (layer ? 1 : 1.6);
      const ox = this.parallax(o, depth, c);
      const oy = (((-o.camY * o.ppb * depth * 0.5) % c) + c) % c;
      ctx.strokeStyle = rgbCss(mixRgb(base, WHITE, 0.25), layer ? 0.08 : 0.05);
      ctx.lineWidth = Math.max(1, h * 0.003);
      ctx.beginPath();
      for (let x = -ox; x < w + c; x += c) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = h - oy; y > -c; y -= c) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
      // filled accent squares
      ctx.fillStyle = rgbCss(mixRgb(base, WHITE, 0.3), 0.035 + o.beat * 0.03 * o.energy);
      let k = 0;
      for (let x = -ox; x < w + c; x += c, k++) {
        for (let y = h - oy, j = 0; y > -c; y -= c, j++) {
          const idx = Math.floor((o.camX * depth) / (c / o.ppb)) + k;
          if (((idx * 7 + j * 13 + layer * 5) % 9) === 0) ctx.fillRect(x + 2, y - c + 2, c - 4, c - 4);
        }
      }
    }
    this.floatingShapes(o, base, 0.1);
  }

  skyline(o, base) {
    const { ctx, w, h } = o;
    this.drawStars(o, base, 0.5);
    for (let layer = 0; layer < 2; layer++) {
      const depth = layer ? 0.06 : 0.12;
      const span = w * 1.5;
      const off = this.parallax(o, depth, span);
      const col = mixRgb(base, BLACK, layer ? 0.35 : 0.55);
      ctx.fillStyle = rgbCss(col);
      const winCol = rgbCss(mixRgb(base, WHITE, 0.6), 0.25 + o.beat * 0.3 * o.energy);
      const ground = h * (layer ? 0.78 : 0.86) - o.camY * o.ppb * depth * 0.4;
      for (let rep = 0; rep < 2; rep++) {
        for (const b of this.buildings[layer]) {
          const x = b.x * span - off + rep * span;
          if (x > w || x + b.w * span < 0) continue;
          const bh = b.h * h;
          ctx.fillStyle = rgbCss(col);
          ctx.fillRect(x, ground - bh, b.w * span, bh + h);
          if (layer === 0) {
            ctx.fillStyle = winCol;
            const ww = b.w * span;
            for (let wy = ground - bh + 8; wy < ground - 6; wy += 14) {
              for (let wx = x + 5; wx < x + ww - 6; wx += 11) {
                if (((wx * 13 + wy * 7) | 0) % (5 + b.win) === 0) ctx.fillRect(wx, wy, 5, 6);
              }
            }
          }
        }
      }
    }
  }

  waves(o, base) {
    const { ctx, w, h } = o;
    for (let layer = 0; layer < 4; layer++) {
      const depth = 0.04 + layer * 0.04;
      const amp = h * (0.03 + layer * 0.012) * (1 + o.beat * 0.3 * o.energy);
      const yBase = h * (0.35 + layer * 0.14) - o.camY * o.ppb * depth * 0.5;
      ctx.fillStyle = rgbCss(mixRgb(base, layer % 2 ? WHITE : BLACK, 0.12 + layer * 0.05), 0.35);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 20; x += 20) {
        const ph = (x + o.camX * o.ppb * depth) / (h * 0.35);
        ctx.lineTo(x, yBase + Math.sin(ph + o.time * (0.5 + layer * 0.2)) * amp + Math.sin(ph * 2.3 + layer) * amp * 0.4);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
  }

  nebula(o, base) {
    const { ctx, w, h } = o;
    this.drawStars(o, base, 1);
    for (let i = 0; i < 4; i++) {
      const span = w * 1.6;
      const x = ((i * 0.31 * span - o.camX * o.ppb * 0.03) % span + span) % span - w * 0.2;
      const y = h * (0.25 + 0.15 * Math.sin(i * 1.7));
      const r = h * (0.35 + 0.1 * i) * (1 + o.beat * 0.05 * o.energy);
      const tint = mixRgb(base, i % 2 ? { r: 255, g: 60, b: 200 } : { r: 60, g: 200, b: 255 }, 0.35);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgbCss(tint, 0.22));
      g.addColorStop(1, rgbCss(tint, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.floatingShapes(o, base, 0.06);
  }

  circuit(o, base) {
    const { ctx, w, h } = o;
    const cell = h / 6;
    const depth = 0.1;
    const ox = this.parallax(o, depth, cell);
    const startIdx = Math.floor((o.camX * o.ppb * depth) / cell);
    ctx.lineWidth = Math.max(1, h * 0.004);
    for (let i = -1; i < w / cell + 2; i++) {
      const idx = startIdx + i;
      const x = i * cell - ox;
      const r = makeRng((idx * 2654435761) >>> 0);
      for (let j = 0; j < 6; j++) {
        if (r() < 0.55) continue;
        const y = j * cell + cell / 2;
        const lit = (Math.floor(o.time * 4) + idx + j) % 7 === 0;
        ctx.strokeStyle = rgbCss(mixRgb(base, WHITE, lit ? 0.7 : 0.3), lit ? 0.35 + o.beat * 0.3 : 0.1);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cell * 0.5, y);
        ctx.lineTo(x + cell * 0.8, y + (r() < 0.5 ? -cell * 0.3 : cell * 0.3));
        ctx.lineTo(x + cell * 1.1, y + (r() < 0.5 ? -cell * 0.3 : cell * 0.3));
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
  }

  voidStyle(o, base) {
    const { ctx, w, h } = o;
    this.drawStars(o, base, 1.2);
    const cx = w * 0.7 - ((o.camX * o.ppb * 0.02) % (w * 2));
    const cy = h * 0.35;
    for (let i = 0; i < 6; i++) {
      const ph = (o.time * 0.15 + i / 6) % 1;
      ctx.strokeStyle = rgbCss(mixRgb(base, WHITE, 0.4), (1 - ph) * 0.15 * (0.5 + o.energy));
      ctx.lineWidth = Math.max(1, h * 0.005);
      ctx.beginPath();
      ctx.arc(((cx % (w * 2)) + w * 2) % (w * 2) - w * 0.3, cy, ph * h * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawStars(o, base, amount) {
    const { ctx, w, h } = o;
    ctx.fillStyle = rgbCss(mixRgb(base, WHITE, 0.8));
    const n = Math.floor(this.stars.length * Math.min(1, amount));
    for (let i = 0; i < n; i++) {
      const s = this.stars[i];
      const x = ((s.x * w - o.camX * o.ppb * s.depth) % w + w) % w;
      const y = s.y * h * 0.8;
      const a = 0.25 + 0.35 * Math.sin(o.time * 2 + s.tw) + o.beat * 0.2;
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.fillRect(x, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }
}

/** Ground / ceiling strips drawn in world space. */
export function drawGround(ctx, opts) {
  const { view, y, ceiling, colors, glow, renderer, style, camX } = opts;
  const gc = colors.ground;
  const lc = colors.line;
  const dir = ceiling ? 1 : -1; // direction the ground body extends
  const far = ceiling ? view.y1 + 2 : view.y0 - 2;
  const y0 = Math.min(y, far), y1 = Math.max(y, far);
  if (y1 - y0 <= 0) return;
  // body
  const g = ctx.createLinearGradient(0, y, 0, y + dir * 4);
  g.addColorStop(0, rgbCss(mixRgb(gc, BLACK, 0.1)));
  g.addColorStop(1, rgbCss(mixRgb(gc, BLACK, 0.55)));
  ctx.fillStyle = g;
  ctx.fillRect(view.x0 - 1, y0, view.x1 - view.x0 + 2, y1 - y0);
  // tiles
  const tile = 4;
  ctx.strokeStyle = rgbCss(mixRgb(gc, WHITE, 0.25), 0.25);
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  const startX = Math.floor(view.x0 / tile) * tile;
  if (style === 'stripes') {
    for (let x = startX; x < view.x1 + tile; x += 1) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 1.5, y + dir * 4);
    }
  } else if (style === 'circuit') {
    for (let x = startX; x < view.x1 + tile; x += 2) {
      ctx.moveTo(x, y + dir * 0.8);
      ctx.lineTo(x + 1, y + dir * 0.8);
      ctx.lineTo(x + 1.5, y + dir * 1.6);
    }
  } else if (style !== 'plain') {
    for (let x = startX; x < view.x1 + tile; x += tile) {
      ctx.rect(x + 0.1, Math.min(y + dir * 0.1, y + dir * (tile - 0.1)), tile - 0.2, tile - 0.2);
    }
  }
  ctx.stroke();
  // line with glow
  const lineHalf = Math.min(9, (view.x1 - view.x0) / 2);
  const lx = camX;
  const lg = ctx.createLinearGradient(lx - lineHalf, 0, lx + lineHalf, 0);
  lg.addColorStop(0, rgbCss(lc, 0));
  lg.addColorStop(0.5, rgbCss(lc, 1));
  lg.addColorStop(1, rgbCss(lc, 0));
  ctx.fillStyle = lg;
  ctx.fillRect(lx - lineHalf, y - 0.03, lineHalf * 2, 0.06);
  if (glow) {
    const gl = ctx.createLinearGradient(0, y, 0, y - dir * 0.6);
    gl.addColorStop(0, rgbCss(lc, 0.18));
    gl.addColorStop(1, rgbCss(lc, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(lx - lineHalf, Math.min(y, y - dir * 0.6), lineHalf * 2, 0.6);
  }
}
