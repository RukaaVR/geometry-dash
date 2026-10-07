// Player presentation: icon, glow, trails, mode-specific particles and death effects.

import { DEG, hexToRgb, rgbCss, mixRgb, clamp } from '../core/math.js';
import { drawIcon } from './icons.js';
import { SHAPES } from './particles.js';
import { playerHalf } from '../game/sim/sim.js';
import { SPEEDS } from '../game/constants.js';

const WHITE = { r: 255, g: 255, b: 255 };

export class PlayerView {
  constructor(renderer, particles) {
    this.r = renderer;
    this.particles = particles;
    this.setLook({ primary: '#4dff7a', secondary: '#38c8ff', designs: {}, trail: 0, death: 0, glow: true });
    this.trail = [];
    this.waveTrail = [];
    this.runPhase = 0;
    this.lastMode = null;
    this.emitAcc = 0;
    this.hidden = false;
  }

  setLook(look) {
    this.look = { ...look, designs: { cube: 0, ship: 0, ball: 0, ufo: 0, wave: 0, robot: 0, spider: 0, ...look.designs } };
    this.pRgb = hexToRgb(look.primary);
    this.sRgb = hexToRgb(look.secondary);
  }

  reset() {
    this.trail.length = 0;
    this.waveTrail.length = 0;
    this.lastMode = null;
    this.hidden = false;
  }

  /** Per-frame update with the interpolated player pose. */
  update(dt, pose, p, cfg, beatHit) {
    if (this.hidden) return;
    if (p.mode !== this.lastMode) {
      this.waveTrail.length = 0;
      this.trail.length = 0;
      this.lastMode = p.mode;
    }
    const speed = SPEEDS[p.speed] || 10;
    this.runPhase += dt * speed * 2.2;
    const h = playerHalf(p);
    // generic trail history
    this.trail.push({ x: pose.x, y: pose.y, t: 0 });
    for (const pt of this.trail) pt.t += dt;
    while (this.trail.length && this.trail[0].t > 0.22) this.trail.shift();
    if (p.mode === 'wave') {
      const last = this.waveTrail[this.waveTrail.length - 1];
      if (!last || Math.abs(last.x - pose.x) > 0.04 || Math.abs(last.y - pose.y) > 0.04) this.waveTrail.push({ x: pose.x, y: pose.y });
      if (this.waveTrail.length > 400) this.waveTrail.splice(0, this.waveTrail.length - 400);
    }
    if (!cfg.particles) return;
    const ps = this.particles;
    this.emitAcc += dt;
    const step = 1 / 60;
    while (this.emitAcc > step) {
      this.emitAcc -= step;
      const g = p.grav;
      switch (p.mode) {
        case 'ship':
        case 'ufo':
          ps.emit(p.held ? 2 : 1, {
            x: pose.x - h * (p.mode === 'ship' ? 1.4 : 0.2), y: pose.y + (p.mode === 'ufo' ? -h * 0.6 * g : 0),
            angle: p.mode === 'ship' ? 180 : -90 * g, spread: 40, speed: [2, 5], life: [0.2, 0.45], size: [0.06, 0.14], sizeEnd: 0,
            color: [this.pRgb, this.sRgb, { r: 255, g: 200, b: 80 }], shape: SHAPES.circle, drag: 3, alpha: 0.9,
          });
          break;
        case 'cube':
        case 'robot':
        case 'spider':
        case 'ball':
          if (p.onGround && Math.random() < 0.5) {
            ps.emit(1, {
              x: pose.x - h * 0.9, y: pose.y - h * g, angle: 90 * g + 60, spread: 50, speed: [0.5, 2], life: [0.2, 0.35],
              size: [0.04, 0.08], sizeEnd: 0, color: [this.pRgb, WHITE], shape: SHAPES.square, gravity: 4 * g, alpha: 0.7,
            });
          }
          break;
        default:
          break;
      }
      if (this.look.trail === 1 && Math.random() < 0.7) {
        ps.emit(1, { x: pose.x - h * 0.5, y: pose.y, jitter: h, angle: 180, spread: 60, speed: [0.3, 1.2], life: [0.3, 0.6], size: [0.05, 0.1], sizeEnd: 0, color: [WHITE, this.sRgb], shape: SHAPES.tri, spin: [-6, 6] });
      } else if (this.look.trail === 3 && Math.random() < 0.6) {
        ps.emit(1, { x: pose.x - h * 0.6, y: pose.y, jitter: h * 1.2, angle: 180, spread: 20, speed: [0.5, 1.5], life: [0.25, 0.5], size: [0.07, 0.11], sizeEnd: 0.02, color: [this.pRgb, this.sRgb], shape: SHAPES.square, additive: false });
      }
    }
    if (this.look.trail === 4 && beatHit) {
      ps.emit(1, { x: pose.x, y: pose.y, speed: 0, life: 0.45, size: h * 1.1, sizeEnd: h * 2.6, color: this.sRgb, shape: SHAPES.ring, alpha: 0.7 });
    }
  }

  drawTrail(ctx, p, cfg) {
    if (this.hidden) return;
    const h = playerHalf(p);
    // wave: solid two-tone trail
    if (p.mode === 'wave' && this.waveTrail.length > 1) {
      const pts = this.waveTrail;
      ctx.save();
      ctx.lineJoin = 'miter';
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = rgbCss(this.sRgb, 0.9);
      ctx.lineWidth = p.mini ? 0.14 : 0.24;
      ctx.stroke();
      ctx.strokeStyle = rgbCss(mixRgb(this.sRgb, WHITE, 0.6), 0.9);
      ctx.lineWidth = p.mini ? 0.05 : 0.08;
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (!cfg.trail || this.look.trail === 5 || this.trail.length < 2) return;
    const pts = this.trail;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const ribbon = this.look.trail === 2;
    for (let i = 1; i < pts.length; i++) {
      const a = 1 - pts[i].t / 0.22;
      ctx.strokeStyle = rgbCss(ribbon && i % 2 ? this.sRgb : this.pRgb, a * (ribbon ? 0.5 : 0.35));
      ctx.lineWidth = h * (ribbon ? 1.4 : 0.9) * a;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Draw the icon at pose {x, y, rot} (world units). */
  draw(ctx, pose, p, cfg, pulse = 0) {
    if (this.hidden) return;
    const h = playerHalf(p);
    const visual = (p.mini ? 0.6 : 1) * (p.mode === 'wave' ? 0.8 : 1);
    if (cfg.glow && this.look.glow) this.r.glow(pose.x, pose.y, visual * (1.3 + pulse * 0.2), this.pRgb, 0.45);
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.scale(visual, -visual); // to y-down icon space
    ctx.rotate(pose.rot * DEG);
    if (p.grav === -1) ctx.scale(1, -1);
    const airborne = !p.onGround;
    drawIcon(ctx, p.mode, this.look, { phase: this.runPhase, airborne });
    ctx.restore();
  }

  /** Spawn the configured death effect. */
  death(x, y, p, cfg) {
    this.hidden = true;
    const ps = this.particles;
    const cols = [this.pRgb, this.sRgb, WHITE];
    const kind = this.look.death || 0;
    const mul = cfg.particles ? 1 : 0.25;
    ps.emit(1 * Math.max(mul, 1), { x, y, speed: 0, life: 0.5, size: 0.3, sizeEnd: 3.2, color: WHITE, shape: SHAPES.ring, alpha: 0.9 });
    switch (kind) {
      case 1: // Shockwave
        for (let i = 0; i < 3; i++) ps.emit(1, { x, y, speed: 0, life: 0.5 + i * 0.15, size: 0.2, sizeEnd: 2.5 + i * 1.4, color: cols[i], shape: SHAPES.ring });
        ps.emit(40 * mul, { x, y, speed: [6, 16], life: [0.2, 0.5], size: [0.1, 0.2], color: cols, shape: SHAPES.spark, drag: 2 });
        break;
      case 2: // Pixel burst
        ps.emit(70 * mul, { x, y, jitter: 0.8, speed: [2, 10], life: [0.4, 0.9], size: [0.05, 0.1], color: cols, shape: SHAPES.square, gravity: 12, additive: false });
        break;
      case 3: // Implode
        for (let i = 0; i < 36 * mul; i++) {
          const a = (i / 36) * Math.PI * 2;
          ps.emit(1, { x: x + Math.cos(a) * 2.2, y: y + Math.sin(a) * 2.2, angle: (a * 180) / Math.PI + 180, spread: 0, speed: 7, life: 0.3, size: 0.12, sizeEnd: 0.02, color: cols, shape: SHAPES.circle });
        }
        ps.emit(1, { x, y, speed: 0, life: 0.6, size: 1.6, sizeEnd: 0, color: this.pRgb, shape: SHAPES.circle, alpha: 0.6 });
        break;
      case 4: // Supernova
        ps.emit(1, { x, y, speed: 0, life: 0.7, size: 0.5, sizeEnd: 6, color: this.sRgb, shape: SHAPES.ring });
        ps.emit(1, { x, y, speed: 0, life: 0.35, size: 2.5, sizeEnd: 0, color: WHITE, shape: SHAPES.circle, alpha: 0.8 });
        ps.emit(90 * mul, { x, y, speed: [4, 22], life: [0.3, 0.9], size: [0.1, 0.25], color: cols, shape: SHAPES.spark, drag: 1.5 });
        break;
      default: {
        // Shatter: fragments of the icon
        const size = playerHalf(p);
        for (let i = 0; i < 16 * Math.max(0.5, mul); i++) {
          ps.emit(1, {
            x, y, jitter: size * 1.4, speed: [3, 11], life: [0.45, 0.85], size: [size * 0.18, size * 0.36], sizeEnd: 0.02,
            color: i % 3 ? this.pRgb : this.sRgb, shape: SHAPES.square, spin: [-14, 14], gravity: 18, additive: false,
          });
        }
        ps.emit(30 * mul, { x, y, speed: [5, 14], life: [0.2, 0.45], size: [0.06, 0.12], color: cols, shape: SHAPES.spark, drag: 3 });
        break;
      }
    }
  }
}

/** Short-lived gameplay feedback particles for sim events. */
export function eventParticles(ps, ev, view, p) {
  const tintOf = (variant) => hexToRgb({ yellow: '#ffd23f', pink: '#ff5fd2', red: '#ff3b3b', blue: '#38c8ff', green: '#4dff7a', black: '#b46bff' }[variant] || '#ffffff');
  switch (ev.type) {
    case 'jump':
      if (!ev.ufo) ps.emit(5, { x: ev.x, y: ev.y, angle: 90 * (p ? p.grav : 1), spread: 120, speed: [1, 3], life: [0.15, 0.3], size: [0.04, 0.08], color: WHITE, shape: SHAPES.square, alpha: 0.6 });
      else ps.emit(6, { x: ev.x, y: ev.y, angle: -90 * (p ? p.grav : 1), spread: 60, speed: [2, 5], life: [0.15, 0.3], size: [0.05, 0.1], color: [WHITE, { r: 160, g: 230, b: 255 }], shape: SHAPES.circle });
      break;
    case 'land':
      ps.emit(Math.min(14, 4 + ev.v * 14), { x: ev.x, y: ev.y, angle: 90 * (p ? p.grav : 1), spread: 160, speed: [1, 4], life: [0.2, 0.4], size: [0.05, 0.1], sizeEnd: 0, color: WHITE, shape: SHAPES.square, gravity: 10 * (p ? p.grav : 1), alpha: 0.75 });
      break;
    case 'orb': {
      const c = tintOf(ev.variant);
      ps.emit(1, { x: ev.x, y: ev.y, speed: 0, life: 0.35, size: 0.3, sizeEnd: 1.6, color: c, shape: SHAPES.ring });
      ps.emit(14, { x: ev.x, y: ev.y, speed: [3, 7], life: [0.2, 0.4], size: [0.06, 0.12], color: [c, WHITE], shape: SHAPES.spark, drag: 3 });
      break;
    }
    case 'pad': {
      const c = tintOf(ev.variant);
      ps.emit(16, { x: ev.x, y: ev.y, angle: 90, spread: 50, speed: [4, 10], life: [0.2, 0.45], size: [0.05, 0.1], color: [c, WHITE], shape: SHAPES.spark, drag: 2 });
      break;
    }
    case 'portal': {
      const c = hexToRgb(ev.tint || '#ffffff');
      ps.emit(1, { x: ev.x, y: ev.y, speed: 0, life: 0.4, size: 0.5, sizeEnd: 2.4, color: c, shape: SHAPES.ring, alpha: 0.8 });
      ps.emit(20, { x: ev.x, y: ev.y, jitter: 0.5, jitterY: 2.6, angle: 0, spread: 90, speed: [2, 6], life: [0.25, 0.5], size: [0.05, 0.12], color: [c, WHITE], shape: SHAPES.circle, drag: 2 });
      break;
    }
    case 'coin':
      ps.emit(1, { x: ev.x, y: ev.y, speed: 0, life: 0.5, size: 0.4, sizeEnd: 2.2, color: { r: 255, g: 210, b: 80 }, shape: SHAPES.ring });
      ps.emit(26, { x: ev.x, y: ev.y, speed: [2, 8], life: [0.4, 0.8], size: [0.06, 0.14], color: [{ r: 255, g: 210, b: 80 }, WHITE], shape: SHAPES.tri, spin: [-8, 8], drag: 2 });
      break;
    case 'teleport':
      for (let k = 0; k < 6; k++) {
        const t = k / 5;
        ps.emit(2, { x: ev.x, y: ev.y0 + (ev.y1 - ev.y0) * t, speed: [0.5, 2], life: [0.15, 0.3], size: [0.08, 0.14], sizeEnd: 0, color: [WHITE, { r: 180, g: 120, b: 255 }], shape: SHAPES.square });
      }
      break;
    case 'flip':
      ps.emit(8, { x: ev.x, y: ev.y, speed: [1, 4], life: [0.15, 0.3], size: [0.05, 0.1], color: WHITE, shape: SHAPES.circle });
      break;
    case 'crumble':
      ps.emit(12, { x: ev.x, y: ev.y, jitter: 0.8, speed: [0.5, 3], life: [0.4, 0.7], size: [0.08, 0.15], color: [{ r: 255, g: 180, b: 80 }, WHITE], shape: SHAPES.square, gravity: 14, additive: false });
      break;
    default:
      break;
  }
}

export function clampPose(v) {
  return clamp(v, -1e6, 1e6);
}
