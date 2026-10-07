// Canvas renderer core: sizing, device-pixel-ratio handling, world transforms and a
// small cache of pre-rendered glow sprites.

import { DEG, rgbCss } from '../core/math.js';

/** Blocks visible vertically at zoom 1 (width follows the aspect ratio). */
export const VIEW_BLOCKS_TALL = 11;
const MIN_VIEW_BLOCKS_WIDE = 15;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.scale = 1; // render resolution multiplier
    this.dpr = 1;
    this.width = 0; // backing-store pixels
    this.height = 0;
    this.cssWidth = 0;
    this.cssHeight = 0;
    this.ppb = 40; // pixels per block at zoom 1
    this.glowCache = new Map();
    this.resize();
  }

  setRenderScale(s) {
    if (Math.abs(s - this.scale) > 1e-3) {
      this.scale = s;
      this.resize();
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width || window.innerWidth);
    const cssH = Math.max(1, rect.height || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.scale;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
    this.width = w;
    this.height = h;
    this.cssWidth = cssW;
    this.cssHeight = cssH;
    this.ppb = Math.min(h / VIEW_BLOCKS_TALL, w / MIN_VIEW_BLOCKS_WIDE);
  }

  /** Half extents of the view in blocks for a given zoom. */
  viewHalf(zoom = 1) {
    const s = this.ppb * zoom;
    return { hw: this.width / 2 / s, hh: this.height / 2 / s };
  }

  /** Apply a world transform: y up, units in blocks, centred on (cx, cy). */
  setWorldTransform(cam) {
    const ctx = this.ctx;
    const s = this.ppb * cam.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(this.width / 2 + (cam.shakeX || 0) * s, this.height / 2 + (cam.shakeY || 0) * s);
    if (cam.rot) ctx.rotate(cam.rot * DEG);
    ctx.scale(s, -s);
    ctx.translate(-cam.cx, -cam.cy);
  }

  resetTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  worldToScreen(cam, x, y) {
    const s = this.ppb * cam.zoom;
    return [(x - cam.cx) * s + this.width / 2, -(y - cam.cy) * s + this.height / 2];
  }

  screenToWorld(cam, sx, sy) {
    const s = this.ppb * cam.zoom;
    return [(sx - this.width / 2) / s + cam.cx, -(sy - this.height / 2) / s + cam.cy];
  }

  /**
   * Radial glow sprite tinted with colour c ({r,g,b}). Colours are quantised so
   * smooth colour transitions reuse a bounded number of cached sprites.
   */
  glowSprite(c) {
    const q = (v) => Math.min(255, Math.round(v / 16) * 16);
    const key = (q(c.r) << 16) | (q(c.g) << 8) | q(c.b);
    let spr = this.glowCache.get(key);
    if (spr) return spr;
    const size = 64;
    spr = document.createElement('canvas');
    spr.width = spr.height = size;
    const g = spr.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    const col = { r: q(c.r), g: q(c.g), b: q(c.b) };
    grad.addColorStop(0, rgbCss(col, 0.9));
    grad.addColorStop(0.25, rgbCss(col, 0.45));
    grad.addColorStop(0.6, rgbCss(col, 0.12));
    grad.addColorStop(1, rgbCss(col, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    if (this.glowCache.size > 256) this.glowCache.delete(this.glowCache.keys().next().value);
    this.glowCache.set(key, spr);
    return spr;
  }

  /** Draw a glow centred at (x, y) with radius r in current (world) units. */
  glow(x, y, r, c, alpha = 1) {
    if (alpha <= 0.01) return;
    const ctx = this.ctx;
    const prevA = ctx.globalAlpha;
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = prevA * Math.min(1, alpha);
    ctx.drawImage(this.glowSprite(c), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prevA;
    ctx.globalCompositeOperation = prevOp;
  }
}
