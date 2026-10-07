// Screen stack, transitions, spatial keyboard/controller navigation, toasts and
// modal dialogs. Screens are plain objects: {el, onEnter?, onLeave?, onBack?, onNav?}.

import { h } from './dom.js';
import { icon } from './icons.js';

export class UI {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.stack = [];
    this.layer = h('div.screens');
    this.toasts = h('div.toasts', { 'aria-live': 'polite' });
    this.modalLayer = h('div.modal-layer');
    root.append(this.layer, this.toasts, this.modalLayer);
    this.modal = null;
    root.addEventListener('pointerover', (e) => {
      const b = e.target.closest('.btn, .nav');
      if (b && b !== this._lastHover && !b.disabled) {
        this._lastHover = b;
        this.app.sfx.play('hover', { minGap: 0.04 });
      }
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('.btn');
      if (b && !b.disabled && !b.classList.contains('silent')) this.app.sfx.play(b.classList.contains('btn-back') ? 'back' : 'click');
    }, true);
  }

  get top() {
    return this.stack[this.stack.length - 1] || null;
  }

  _mount(screen, dir) {
    screen.el.classList.add('screen');
    screen.el.classList.remove('leave', 'leave-back');
    screen.el.classList.add(dir === 'back' ? 'enter-back' : 'enter');
    this.layer.appendChild(screen.el);
    requestAnimationFrame(() => requestAnimationFrame(() => screen.el.classList.remove('enter', 'enter-back')));
    screen.onEnter && screen.onEnter();
    this.focusFirst(screen);
  }

  _unmount(screen, dir, keep = false) {
    screen.onLeave && screen.onLeave();
    const el = screen.el;
    el.classList.add(dir === 'back' ? 'leave-back' : 'leave');
    el.style.pointerEvents = 'none';
    setTimeout(() => {
      if (!keep && el.parentNode) el.parentNode.removeChild(el);
      el.style.pointerEvents = '';
    }, 260);
  }

  /** Push a screen on top (previous stays underneath but hidden). */
  push(screen) {
    const prev = this.top;
    if (prev) {
      prev.onLeave && prev.onLeave();
      prev.el.classList.add('covered');
    }
    this.stack.push(screen);
    this._mount(screen, 'fwd');
    return screen;
  }

  /** Overlay a screen without hiding the one below (pause menu, dialogs). */
  overlay(screen) {
    screen.overlay = true;
    this.stack.push(screen);
    this._mount(screen, 'fwd');
    return screen;
  }

  pop() {
    const s = this.stack.pop();
    if (!s) return;
    this._unmount(s, 'back');
    const top = this.top;
    if (top) {
      top.el.classList.remove('covered');
      if (!s.overlay) {
        top.el.classList.add('enter-back');
        requestAnimationFrame(() => requestAnimationFrame(() => top.el.classList.remove('enter-back')));
      }
      top.onEnter && top.onEnter();
      this.focusFirst(top);
    }
  }

  /** Replace the whole stack with a single screen. */
  replace(screen) {
    while (this.stack.length) this._unmount(this.stack.pop(), 'fwd');
    this.stack.push(screen);
    this._mount(screen, 'fwd');
    return screen;
  }

  clear() {
    while (this.stack.length) this._unmount(this.stack.pop(), 'fwd');
  }

  back() {
    if (this.modal) {
      this.modal.cancel();
      return true;
    }
    const top = this.top;
    if (!top) return false;
    if (top.onBack) return top.onBack() !== false;
    if (this.stack.length > 1) {
      this.pop();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ navigation

  focusables(container) {
    return [...container.querySelectorAll('.nav, .btn, input, select, button')].filter(
      (el) => !el.disabled && el.offsetParent !== null && !el.closest('.covered') && !el.closest('[inert]'),
    );
  }

  focusFirst(screen) {
    if (!screen || matchMedia('(pointer: coarse)').matches) return;
    setTimeout(() => {
      if (this.top !== screen || this.modal) return;
      const pref = screen.el.querySelector('[data-autofocus]');
      const el = pref || this.focusables(screen.el)[0];
      if (el) el.focus({ preventScroll: true });
    }, 30);
  }

  /** Move focus spatially in direction 'up'|'down'|'left'|'right'. */
  nav(dir) {
    const scope = this.modal ? this.modal.el : this.top && this.top.el;
    if (!scope) return false;
    if (this.top && this.top.onNav && !this.modal && this.top.onNav(dir) === true) return true;
    const items = this.focusables(scope);
    if (!items.length) return false;
    const cur = document.activeElement;
    if (!items.includes(cur)) {
      items[0].focus();
      return true;
    }
    const r0 = cur.getBoundingClientRect();
    const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
    let best = null, bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const dx = c.x - c0.x, dy = c.y - c0.y;
      const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      best.focus();
      best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this.app.sfx.play('hover', { minGap: 0.03 });
      return true;
    }
    return false;
  }

  activateFocused() {
    const el = document.activeElement;
    if (el && el !== document.body && this.root.contains(el)) {
      el.click();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ toasts

  toast(title, body = '', { kind = 'info', iconName = 'info', duration = 3200 } = {}) {
    const t = h('div.toast.toast-' + kind, icon(iconName, 'toast-ico'), h('div.toast-text', h('b', title), body ? h('span', body) : null));
    this.toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, duration);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  achievement(def) {
    const t = h('div.toast.toast-achievement',
      h('div.ach-badge', icon(def.icon || 'trophy')),
      h('div.toast-text', h('small', 'Achievement unlocked'), h('b', def.name), h('span', def.desc)));
    this.toasts.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    this.app.sfx.play('achievement');
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 400);
    }, 4200);
  }

  // ------------------------------------------------------------------ dialogs

  /**
   * Show a modal dialog. buttons: [{label, value, primary, danger}]
   * content may be a string or an element. Resolves to the clicked value (null on cancel).
   */
  dialog({ title, content, buttons = [{ label: 'OK', value: true, primary: true }], input = null, wide = false }) {
    return new Promise((resolve) => {
      let inputEl = null;
      if (input) {
        inputEl = input.multiline
          ? h('textarea.field', { rows: 8, placeholder: input.placeholder || '', spellcheck: false })
          : h('input.field', { type: 'text', placeholder: input.placeholder || '', maxLength: input.maxLength || 200 });
        inputEl.value = input.value || '';
      }
      const close = (v) => {
        this.modal = null;
        el.classList.remove('show');
        setTimeout(() => el.remove(), 200);
        if (this._modalPrevFocus) this._modalPrevFocus.focus?.({ preventScroll: true });
        resolve(v);
      };
      const btns = buttons.map((b) =>
        h('button.btn' + (b.primary ? '.btn-primary' : '') + (b.danger ? '.btn-danger' : ''), {
          on: { click: () => close(input && b.value === true ? inputEl.value : b.value) },
        }, b.label),
      );
      const el = h('div.modal' + (wide ? '.modal-wide' : ''), { role: 'dialog', 'aria-modal': 'true' },
        h('div.modal-card',
          h('h2.modal-title', title),
          typeof content === 'string' ? h('p.modal-text', content) : content || null,
          inputEl,
          h('div.modal-buttons', btns)));
      el.addEventListener('pointerdown', (e) => {
        if (e.target === el) close(null);
      });
      this._modalPrevFocus = document.activeElement;
      this.modal = { el, cancel: () => close(null) };
      this.modalLayer.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => (inputEl || btns.find((b) => b.classList.contains('btn-primary')) || btns[0])?.focus(), 40);
      if (inputEl && !input.multiline) {
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') close(inputEl.value);
        });
      }
    });
  }

  confirm(title, text, { okLabel = 'Confirm', danger = false } = {}) {
    return this.dialog({
      title, content: text,
      buttons: [{ label: 'Cancel', value: false }, { label: okLabel, value: true, primary: !danger, danger }],
    }).then((v) => v === true);
  }

  alert(title, text) {
    return this.dialog({ title, content: text, buttons: [{ label: 'OK', value: true, primary: true }] });
  }

  prompt(title, text, value = '', opts = {}) {
    return this.dialog({
      title, content: text, input: { value, ...opts },
      buttons: [{ label: 'Cancel', value: null }, { label: opts.okLabel || 'OK', value: true, primary: true }],
      wide: !!opts.multiline,
    });
  }
}

/** Standard game button. */
export function button(label, onClick, { iconName, cls = '', title, disabled } = {}) {
  return h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { on: { click: onClick }, title, disabled, type: 'button' },
    iconName ? icon(iconName) : null, label ? h('span.btn-label', label) : null);
}

export function backButton(onClick) {
  return h('button.btn.btn-back.btn-icon', { on: { click: onClick }, title: 'Back (Esc)', 'aria-label': 'Back', type: 'button' }, icon('back'));
}
