// Unified low-latency input. Every primary-action press/release is timestamped with
// the browser's high resolution event time so the simulation can apply it on the
// exact tick it happened, independent of the render frame rate.

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const PAD_JUMP_BUTTONS = [0, 1, 2, 3, 5, 7]; // A, B, X, Y, RB, RT
const PAD_START = 9;

export class Input {
  constructor(target) {
    this.target = target; // element receiving gameplay pointer input (the canvas)
    this.queue = []; // {down, t}
    this.sources = new Set(); // ids of sources currently holding the primary action
    this.gameplay = false; // primary-action capture enabled
    this.keyHandlers = [];
    this.padState = new Map();
    this.padConnected = false;
    this.lastPadPoll = 0;

    this._onKeyDown = (e) => this.handleKey(e, true);
    this._onKeyUp = (e) => this.handleKey(e, false);
    this._onPointerDown = (e) => this.handlePointer(e, true);
    this._onPointerUp = (e) => this.handlePointer(e, false);
    this._onBlur = () => this.releaseAll(performance.now());
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('blur', this._onBlur);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('gamepadconnected', () => (this.padConnected = true));
  }

  /** Register a handler for non-primary keys: fn(code, event) -> true if consumed. */
  onKey(fn) {
    this.keyHandlers.push(fn);
    return () => {
      this.keyHandlers = this.keyHandlers.filter((h) => h !== fn);
    };
  }

  isTyping(e) {
    const el = e.target;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  handleKey(e, down) {
    if (this.isTyping(e)) return;
    if (this.gameplay && JUMP_KEYS.has(e.code)) {
      e.preventDefault();
      if (e.repeat) return;
      this.press('key:' + e.code, down, e.timeStamp);
      return;
    }
    if (down) {
      for (let i = this.keyHandlers.length - 1; i >= 0; i--) {
        if (this.keyHandlers[i](e.code, e)) {
          e.preventDefault();
          return;
        }
      }
    }
  }

  handlePointer(e, down) {
    if (down) {
      if (!this.gameplay) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try {
        this.target.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      this.press('ptr:' + e.pointerId, true, e.timeStamp);
    } else if (this.sources.has('ptr:' + e.pointerId)) {
      this.press('ptr:' + e.pointerId, false, e.timeStamp);
    }
  }

  press(source, down, t) {
    const wasHeld = this.sources.size > 0;
    if (down) this.sources.add(source);
    else this.sources.delete(source);
    const isHeld = this.sources.size > 0;
    // Only edges of the combined "any source held" signal matter, but a second
    // source pressing while another is held is still a fresh press (click buffering).
    if (down) this.queue.push({ down: true, t: t || performance.now() });
    else if (wasHeld && !isHeld) this.queue.push({ down: false, t: t || performance.now() });
  }

  get held() {
    return this.sources.size > 0;
  }

  releaseAll(t) {
    if (this.sources.size) {
      this.sources.clear();
      this.queue.push({ down: false, t });
    }
  }

  /** Drain queued primary events (oldest first). */
  drain() {
    const q = this.queue;
    this.queue = [];
    return q;
  }

  clear() {
    this.queue = [];
  }

  setGameplay(on) {
    this.gameplay = on;
    if (!on) {
      this.sources.clear();
      this.queue = [];
    }
  }

  /** Poll gamepads (call once per frame). Returns menu navigation intents. */
  pollGamepads(now) {
    const nav = [];
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const prev = this.padState.get(pad.index) || { buttons: [], axes: [0, 0], jump: false };
      const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
      const jump = PAD_JUMP_BUTTONS.some(pressed);
      if (this.gameplay && jump !== prev.jump) this.press('pad:' + pad.index, jump, now);
      const edge = (i) => pressed(i) && !prev.buttons[i];
      if (edge(PAD_START)) nav.push('pause');
      if (!this.gameplay) {
        if (edge(0)) nav.push('confirm');
        if (edge(1)) nav.push('back');
      }
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      const dir = (v, pv) => (v > 0.6 && pv <= 0.6 ? 1 : v < -0.6 && pv >= -0.6 ? -1 : 0);
      const dx = dir(ax, prev.axes[0]) || (edge(15) ? 1 : edge(14) ? -1 : 0);
      const dy = dir(ay, prev.axes[1]) || (edge(13) ? 1 : edge(12) ? -1 : 0);
      if (dx) nav.push(dx > 0 ? 'right' : 'left');
      if (dy) nav.push(dy > 0 ? 'down' : 'up');
      this.padState.set(pad.index, { buttons: pad.buttons.map((b) => b.pressed), axes: [ax, ay], jump });
    }
    return nav;
  }
}
