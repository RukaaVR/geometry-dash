// Pooled particle system using flat typed arrays (no per-particle allocation).
// Particles live in world space (blocks, y up) and are drawn with additive blending.

const F = 18; // floats per particle
// layout: x y vx vy life maxLife size size1 rot vrot r g b alpha gravity drag shape additive
const X = 0, Y = 1, VX = 2, VY = 3, LIFE = 4, MAX = 5, S0 = 6, S1 = 7, ROT = 8, VROT = 9, R = 10, G = 11, B = 12, A = 13, GRAV = 14, DRAG = 15, SHAPE = 16, ADD = 17;

export const SHAPES = { square: 0, circle: 1, spark: 2, ring: 3, tri: 4 };

export class ParticleSystem {
  constructor(capacity = 2000) {
    this.setCapacity(capacity);
    this.scale = 1; // emission multiplier from quality settings
  }

  setCapacity(n) {
    this.capacity = n;
    this.data = new Float32Array(n * F);
    this.count = 0;
  }

  clear() {
    this.count = 0;
  }

  /**
   * Emit `n` particles. Options are ranges [min, max] or single values.
   * opts: x, y, speed, angle (deg, 0 = right, CCW), spread, life, size, sizeEnd,
   *       color {r,g,b} | array of colors, alpha, gravity, drag, shape, spin, additive, jitter
   */
  emit(n, opts) {
    n = Math.round(n * this.scale);
    if (n <= 0) return;
    const d = this.data;
    const rnd = (v, def) => (v === undefined ? def : Array.isArray(v) ? v[0] + Math.random() * (v[1] - v[0]) : v);
    const colors = Array.isArray(opts.color) ? opts.color : [opts.color || { r: 255, g: 255, b: 255 }];
    for (let k = 0; k < n; k++) {
      if (this.count >= this.capacity) {
        // recycle the oldest-ish slot to keep the newest effects visible
        this.count = this.capacity - 1;
      }
      const i = this.count++ * F;
      const ang = ((rnd(opts.angle, 90) + (Math.random() - 0.5) * rnd(opts.spread, 360)) * Math.PI) / 180;
      const sp = rnd(opts.speed, 3);
      const jit = opts.jitter || 0;
      d[i + X] = opts.x + (Math.random() - 0.5) * jit;
      d[i + Y] = opts.y + (Math.random() - 0.5) * (opts.jitterY ?? jit);
      d[i + VX] = Math.cos(ang) * sp + (opts.vx || 0);
      d[i + VY] = Math.sin(ang) * sp + (opts.vy || 0);
      const life = rnd(opts.life, 0.5);
      d[i + LIFE] = life;
      d[i + MAX] = life;
      d[i + S0] = rnd(opts.size, 0.15);
      d[i + S1] = opts.sizeEnd === undefined ? 0 : rnd(opts.sizeEnd, 0);
      d[i + ROT] = Math.random() * Math.PI * 2;
      d[i + VROT] = rnd(opts.spin, 0);
      const c = colors[(Math.random() * colors.length) | 0];
      d[i + R] = c.r;
      d[i + G] = c.g;
      d[i + B] = c.b;
      d[i + A] = rnd(opts.alpha, 1);
      d[i + GRAV] = rnd(opts.gravity, 0);
      d[i + DRAG] = rnd(opts.drag, 0);
      d[i + SHAPE] = opts.shape || 0;
      d[i + ADD] = opts.additive === false ? 0 : 1;
    }
  }

  update(dt) {
    const d = this.data;
    let n = this.count;
    for (let p = 0; p < n; p++) {
      const i = p * F;
      d[i + LIFE] -= dt;
      if (d[i + LIFE] <= 0) {
        // swap-remove
        n--;
        if (p !== n) d.copyWithin(i, n * F, n * F + F);
        p--;
        continue;
      }
      const drag = 1 - Math.min(1, d[i + DRAG] * dt);
      d[i + VX] *= drag;
      d[i + VY] = d[i + VY] * drag - d[i + GRAV] * dt;
      d[i + X] += d[i + VX] * dt;
      d[i + Y] += d[i + VY] * dt;
      d[i + ROT] += d[i + VROT] * dt;
    }
    this.count = n;
  }

  /** Draw with the world transform already applied. */
  draw(ctx, view) {
    const d = this.data;
    const n = this.count;
    if (!n) return;
    ctx.save();
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass === 0 ? 'source-over' : 'lighter';
      for (let p = 0; p < n; p++) {
        const i = p * F;
        if (d[i + ADD] !== pass) continue;
        const x = d[i + X], y = d[i + Y];
        if (view && (x < view.x0 - 1 || x > view.x1 + 1 || y < view.y0 - 1 || y > view.y1 + 1)) continue;
        const t = d[i + LIFE] / d[i + MAX];
        const size = d[i + S1] + (d[i + S0] - d[i + S1]) * t;
        if (size <= 0.002) continue;
        const a = d[i + A] * Math.min(1, t * 1.6);
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${d[i + R] | 0},${d[i + G] | 0},${d[i + B] | 0})`;
        const shape = d[i + SHAPE];
        if (shape === 1) {
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        } else if (shape === 2) {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = size * 0.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - d[i + VX] * 0.04, y - d[i + VY] * 0.04);
          ctx.stroke();
        } else if (shape === 3) {
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 0.06 * (0.3 + t);
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const rot = d[i + ROT];
          if (rot) {
            const ux = Math.cos(rot) * size, uy = Math.sin(rot) * size;
            ctx.beginPath();
            if (shape === 4) {
              ctx.moveTo(x + ux, y + uy);
              ctx.lineTo(x - ux * 0.5 - uy * 0.87, y - uy * 0.5 + ux * 0.87);
              ctx.lineTo(x - ux * 0.5 + uy * 0.87, y - uy * 0.5 - ux * 0.87);
            } else {
              ctx.moveTo(x + ux - uy, y + uy + ux);
              ctx.lineTo(x - ux - uy, y - uy + ux);
              ctx.lineTo(x - ux + uy, y - uy - ux);
              ctx.lineTo(x + ux + uy, y + uy - ux);
            }
            ctx.fill();
          } else ctx.fillRect(x - size, y - size, size * 2, size * 2);
        }
      }
    }
    ctx.restore();
  }
}
