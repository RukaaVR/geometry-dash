// Gameplay camera: follows the player horizontally (locked) and vertically (smoothed,
// GD-style dead zone), frames mode corridors, applies trigger zoom/rotation and shake.

import { clamp } from '../core/math.js';

export class GameCamera {
  constructor() {
    this.cx = 0;
    this.cy = 4;
    this.zoom = 1;
    this.rot = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.impulse = 0; // decaying shake from local events (death)
    this.groundY = 0; // displayed floor (animated for corridor transitions)
    this.ceilY = Infinity;
    this.ceilShown = 0; // 0..1 how far the ceiling strip has slid in
  }

  /** Snap to a player position without smoothing (on spawn/restart). */
  snap(p, half) {
    this.zoom = 1;
    this.rot = 0;
    this.cx = p.x + half.hw * 0.45;
    this.cy = this.targetY(p, half, this.cy, true);
    this.groundY = p.floorY;
    this.ceilY = p.ceilY;
    this.ceilShown = Number.isFinite(p.ceilY) ? 1 : 0;
    this.impulse = 0;
  }

  targetY(p, half, current, initial = false) {
    const hh = half.hh;
    if (Number.isFinite(p.ceilY)) {
      // centre the corridor
      return (p.floorY + p.ceilY) / 2;
    }
    const minCy = hh - 2.3; // keep the ground near the bottom of the screen
    let ty = initial ? minCy : current;
    const upper = ty + hh * 0.3;
    const lower = ty - hh * 0.45;
    if (p.y > upper) ty = p.y - hh * 0.3;
    else if (p.y < lower) ty = p.y + hh * 0.45;
    return Math.max(minCy, ty);
  }

  /**
   * @param dt     frame delta (seconds, real time)
   * @param pose   interpolated player {x, y}
   * @param p      player sim state (mode bounds)
   * @param simCam state.cam {zoom, offY, rot}
   */
  update(dt, pose, p, half, simCam, shake, cfg) {
    this.zoom = simCam ? simCam.zoom : 1;
    this.rot = simCam && !cfg.reducedMotion ? simCam.rot : 0;
    const view = { hw: half.hw / this.zoom, hh: half.hh / this.zoom };
    this.cx = pose.x + view.hw * 0.45;
    const target = this.targetY({ ...p, y: pose.y }, view, this.cy) + (simCam ? simCam.offY : 0);
    const k = 1 - Math.exp(-dt * (Number.isFinite(p.ceilY) ? 4.5 : 6));
    this.cy += (target - this.cy) * k;
    // animated corridor edges
    const kg = 1 - Math.exp(-dt * 7);
    this.groundY += (p.floorY - this.groundY) * kg;
    if (Number.isFinite(p.ceilY)) {
      if (!Number.isFinite(this.ceilY)) this.ceilY = p.ceilY + view.hh * 1.5;
      this.ceilY += (p.ceilY - this.ceilY) * kg;
      this.ceilShown = Math.min(1, this.ceilShown + dt * 3);
    } else if (Number.isFinite(this.ceilY)) {
      this.ceilY += view.hh * 3 * dt;
      if (this.ceilY > this.cy + view.hh * 1.5) this.ceilY = Infinity;
    }
    // shake (trigger + impulse), capped so it never obscures gameplay
    let amp = this.impulse;
    if (shake) amp = Math.max(amp, shake);
    this.impulse = Math.max(0, this.impulse - dt * 2.5);
    if (cfg.shake && amp > 0.001) {
      const a = clamp(amp, 0, 0.6);
      const t = performance.now() / 1000;
      this.shakeX = (Math.sin(t * 61) + Math.sin(t * 37.3) * 0.5) * a * 0.5;
      this.shakeY = (Math.cos(t * 53) + Math.sin(t * 29.1) * 0.5) * a * 0.5;
    } else {
      this.shakeX = this.shakeY = 0;
    }
  }

  addShake(amount) {
    this.impulse = Math.max(this.impulse, amount);
  }
}
