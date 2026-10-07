// Development debug overlay (F3). Only available on localhost or with ?debug in the
// URL so it never appears for players of a production build. The FPS counter is a
// regular player setting and is always available.

import { h } from '../ui/dom.js';

export class DebugOverlay {
  constructor(app) {
    this.app = app;
    const q = new URLSearchParams(location.search);
    this.available = q.has('debug') || ['localhost', '127.0.0.1', ''].includes(location.hostname);
    this.enabled = this.available && q.get('debug') === '1';
    this.info = {};
    this.el = h('div.debug-panel', { hidden: true });
    this.fpsEl = h('div.fps-counter', { hidden: true });
    document.body.append(this.el, this.fpsEl);
    this.acc = 0;
  }

  toggle() {
    if (!this.available) return;
    this.enabled = !this.enabled;
    this.el.hidden = !this.enabled;
    this.app.ui && this.app.ui.toast('Debug overlay ' + (this.enabled ? 'on' : 'off'), 'Hitboxes and timing info (F3)');
  }

  setFpsVisible(v) {
    this.fpsVisible = v;
    this.fpsEl.hidden = !v;
  }

  /** Scenes publish their debug data here each frame. */
  set(key, value) {
    this.info[key] = value;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    if (this.fpsVisible) this.fpsEl.textContent = Math.round(this.app.fps) + ' FPS';
    if (!this.enabled) return;
    this.el.hidden = false;
    const lines = [`FPS ${this.app.fps.toFixed(0)}  particles ${this.app.particles.count}`];
    for (const [k, v] of Object.entries(this.info)) lines.push(`${k}: ${v}`);
    this.el.textContent = lines.join('\n');
  }
}
