// Composes a full gameplay frame: background, objects, ground, player, particles,
// screen effects and optional debug overlays. Shared by gameplay, the editor and the
// animated menu background.

import { Background, drawGround } from './background.js';
import { ObjectRenderer, resolveColors, prepareWorldRender } from './objects.js';
import { rgbCss, mixRgb, clamp } from '../core/math.js';
import { currentGeometry, isObjectEnabled } from '../game/sim/triggers.js';
import { playerHalf } from '../game/sim/sim.js';

export class GameView {
  constructor(renderer, particles) {
    this.r = renderer;
    this.particles = particles;
    this.bg = new Background();
    this.objects = new ObjectRenderer(renderer);
    this.flashes = [];
    this.vignette = null;
    this.vignetteKey = '';
  }

  flash(color, intensity, duration) {
    this.flashes.push({ color, intensity, t: 0, dur: Math.max(0.05, duration) });
  }

  update(dt) {
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
  }

  viewRect(cam) {
    const half = this.r.viewHalf(cam.zoom);
    const m = cam.rot ? Math.max(half.hw, half.hh) : 0; // rotated view: use a bounding square
    const hw = Math.max(half.hw, m) + 1, hh = Math.max(half.hh, m) + 1;
    return { x0: cam.cx - hw, x1: cam.cx + hw, y0: cam.cy - hh, y1: cam.cy + hh };
  }

  /**
   * @param o {world, state, cam, cfg, time, beat, energy, player?: {pose, p, view}, editor, hidden,
   *           collectedCoins, debug, groundOverride}
   */
  render(o) {
    const r = this.r;
    const ctx = r.ctx;
    const { world, state, cam, cfg } = o;
    prepareWorldRender(world);
    const colors = resolveColors(state, cfg.highContrast);
    const beat = cfg.reducedMotion ? o.beat * 0.3 : o.beat;

    // ---- background (screen space)
    r.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.bg.draw({
      ctx, w: r.width, h: r.height, camX: cam.cx, camY: cam.cy, ppb: r.ppb * cam.zoom, color: colors.bg,
      beat, energy: o.energy ?? 0.5, time: o.time, style: world.level.settings.background, simple: cfg.background === 'simple' || cfg.highContrast,
    });

    // ---- world
    r.setWorldTransform(cam);
    const view = this.viewRect(cam);
    this.objects.collect(world, state, view, { editor: o.editor, hidden: o.hidden });
    const fx = {
      time: o.time, beat, colors, glow: cfg.glow, state, editor: !!o.editor, collectedCoins: o.collectedCoins,
      showTriggerLines: o.editor && o.showTriggerLines,
    };
    if (o.editorUnderlay) o.editorUnderlay(ctx, view);
    this.objects.draw('back', fx);
    this.objects.draw('main', fx);
    this.objects.draw('portals', fx);

    // ---- ground & ceiling
    const groundY = o.groundOverride ? o.groundOverride.floor : cam.groundY;
    const ceilY = o.groundOverride ? o.groundOverride.ceil : cam.ceilY;
    drawGround(ctx, { view, y: groundY, ceiling: false, colors, glow: cfg.glow, renderer: r, style: world.level.settings.ground, camX: cam.cx });
    if (Number.isFinite(ceilY) && ceilY < view.y1 + 1) {
      drawGround(ctx, { view, y: ceilY, ceiling: true, colors, glow: cfg.glow, renderer: r, style: world.level.settings.ground, camX: cam.cx });
    }

    // ---- player
    if (o.player) {
      const pv = o.player.view;
      pv.drawTrail(ctx, o.player.p, cfg);
      pv.draw(ctx, o.player.pose, o.player.p, cfg, beat);
    }

    this.particles.draw(ctx, view);
    this.objects.draw('portalFronts', fx);
    this.objects.draw('front', fx);

    if (o.debug) this.drawDebug(ctx, world, state, view, o);
    if (o.editorOverlay) o.editorOverlay(ctx, view);

    // ---- screen effects
    r.resetTransform();
    if (cfg.effects) {
      const flashMul = cfg.reducedFlashing ? 0.25 : 1;
      const all = [...this.flashes];
      if (state.flash) all.push({ color: state.flash.color, intensity: state.flash.i, t: state.time - state.flash.t0, dur: state.flash.dur });
      for (const f of all) {
        if (f.t < 0 || f.t >= f.dur) continue;
        const a = f.intensity * (1 - f.t / f.dur) * flashMul;
        if (a <= 0.005) continue;
        ctx.fillStyle = rgbCss(f.color, clamp(a, 0, 0.85));
        ctx.fillRect(0, 0, r.width, r.height);
      }
      this.drawVignette(ctx, colors.bg);
    }
  }

  drawVignette(ctx, bg) {
    const r = this.r;
    const key = r.width + 'x' + r.height;
    if (this.vignetteKey !== key) {
      this.vignetteKey = key;
      const c = document.createElement('canvas');
      c.width = Math.max(1, r.width >> 2);
      c.height = Math.max(1, r.height >> 2);
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = grad;
      g.fillRect(0, 0, c.width, c.height);
      this.vignette = c;
    }
    ctx.drawImage(this.vignette, 0, 0, r.width, r.height);
  }

  drawDebug(ctx, world, state, view, o) {
    ctx.save();
    ctx.lineWidth = 0.03;
    for (const ro of world.objects) {
      if (!ro.geom || ro.kind === 'deco') continue;
      if (ro.geom.x1 < view.x0 || ro.geom.x0 > view.x1) continue;
      if (!isObjectEnabled(state, ro)) continue;
      const g = currentGeometry(world, state, ro);
      const colr = ro.kind === 'hazard' ? '#ff3b3b' : ro.kind === 'solid' || ro.kind === 'slope' || ro.kind === 'crumble' ? '#38c8ff' : '#4dff7a';
      ctx.strokeStyle = colr;
      ctx.fillStyle = colr + '22';
      ctx.beginPath();
      if (g.circle) ctx.arc(g.circle.x, g.circle.y, g.circle.r, 0, Math.PI * 2);
      else if (g.poly) {
        ctx.moveTo(g.poly[0], g.poly[1]);
        for (let i = 2; i < g.poly.length; i += 2) ctx.lineTo(g.poly[i], g.poly[i + 1]);
        ctx.closePath();
      } else if (ro.kind === 'slope') {
        const sl = g.slope || ro.slope;
        const tri = sl.faceUp
          ? sl.rising ? [sl.x0, sl.y0, sl.x1, sl.y0, sl.x1, sl.y1] : [sl.x0, sl.y0, sl.x1, sl.y0, sl.x0, sl.y1]
          : sl.rising ? [sl.x0, sl.y1, sl.x1, sl.y1, sl.x1, sl.y0] : [sl.x0, sl.y1, sl.x1, sl.y1, sl.x0, sl.y0];
        ctx.moveTo(tri[0], tri[1]);
        ctx.lineTo(tri[2], tri[3]);
        ctx.lineTo(tri[4], tri[5]);
        ctx.closePath();
      } else ctx.rect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
      ctx.fill();
      ctx.stroke();
    }
    if (o.player) {
      const p = o.player.p;
      const h = playerHalf(p);
      const pose = o.player.pose;
      ctx.strokeStyle = '#ffd23f';
      ctx.strokeRect(pose.x - h, pose.y - h, h * 2, h * 2);
      const ih = p.mode === 'wave' ? h : h * 0.36;
      ctx.strokeStyle = '#ff3b3b';
      ctx.strokeRect(pose.x - ih, pose.y - ih, ih * 2, ih * 2);
    }
    ctx.restore();
  }
}

export { mixRgb };
