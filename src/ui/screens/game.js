// In-game UI: HUD, pause menu and level-complete screen.

import { h, fmtNum, fmtTime, clear } from '../dom.js';
import { icon, difficultyEmblem } from '../icons.js';
import { button } from '../ui.js';

export class Hud {
  constructor(root) {
    this.bar = h('div.hud-progress-fill');
    this.pct = h('div.hud-pct', '0%');
    this.progress = h('div.hud-progress', h('div.hud-progress-track', this.bar), this.pct);
    this.attempt = h('div.hud-attempt');
    this.practice = h('div.hud-practice', icon('practice'), h('span', 'Practice'));
    this.cpButtons = h('div.hud-cp',
      h('button.btn.btn-icon.hud-btn', { title: 'Place checkpoint (Z)', 'aria-label': 'Place checkpoint', on: { click: (e) => { e.stopPropagation(); this.onCheckpoint && this.onCheckpoint(); } } }, icon('flag')),
      h('button.btn.btn-icon.hud-btn', { title: 'Remove checkpoint (X)', 'aria-label': 'Remove checkpoint', on: { click: (e) => { e.stopPropagation(); this.onRemoveCheckpoint && this.onRemoveCheckpoint(); } } }, icon('flagX')));
    this.pauseBtn = h('button.btn.btn-icon.hud-btn.hud-pause', { title: 'Pause (Esc)', 'aria-label': 'Pause', on: { click: (e) => { e.stopPropagation(); this.onPause && this.onPause(); } } }, icon('pause'));
    this.newBest = h('div.hud-newbest');
    this.editorInfo = h('div.hud-editor-info', { hidden: true });
    this.coins = h('div.hud-coins');
    this.el = h('div.hud',
      h('div.hud-top', this.practice, this.progress, this.pauseBtn),
      this.coins, this.cpButtons, this.newBest, this.editorInfo);
    root.appendChild(this.el);
    this._last = { pct: -1 };
  }

  configure({ practice, showProgress, showPercent, editor, coinCount }) {
    this.practice.hidden = !practice;
    this.cpButtons.hidden = !practice;
    this.progress.hidden = !showProgress && !showPercent;
    this.bar.parentElement.hidden = !showProgress;
    this.pct.hidden = !showPercent;
    this.editorInfo.hidden = !editor;
    clear(this.coins);
    for (let i = 0; i < coinCount; i++) this.coins.append(h('span.hud-coin', icon('coin')));
    this._last.pct = -1;
  }

  setProgress(p) {
    const pct = Math.floor(p * 100);
    if (pct !== this._last.pct) {
      this._last.pct = pct;
      this.pct.textContent = pct + '%';
    }
    this.bar.style.transform = `scaleX(${Math.min(1, p)})`;
  }

  setCoins(arr) {
    [...this.coins.children].forEach((c, i) => c.classList.toggle('got', !!arr[i]));
  }

  showNewBest(pct) {
    this.newBest.textContent = `NEW BEST ${Math.floor(pct)}%`;
    this.newBest.classList.remove('show');
    void this.newBest.offsetWidth;
    this.newBest.classList.add('show');
  }

  setEditorInfo(text) {
    this.editorInfo.textContent = text;
  }

  show(v) {
    this.el.classList.toggle('visible', v);
  }

  destroy() {
    this.el.remove();
  }
}

function bar(label, pct, cls) {
  return h('div.pbar.' + cls,
    h('div.pbar-label', h('span', label), h('b', `${Math.floor(pct)}%`)),
    h('div.pbar-track', h('div.pbar-fill', { style: { width: `${Math.min(100, pct)}%` } })));
}

export function pauseScreen(app, o) {
  const practiceBtn = button(o.practice ? 'Normal mode' : 'Practice mode', o.onTogglePractice, { iconName: 'practice', cls: 'btn-pill' });
  const el = h('div.pause-menu',
    h('div.pause-card',
      h('div.pause-head',
        h('div.pause-emblem', { html: difficultyEmblem(o.level.difficulty, 54) }),
        h('div', h('h2.pause-title', o.level.name), h('small', o.subtitle))),
      o.stats ? h('div.pause-bars', bar('Normal', o.stats.best, 'normal'), bar('Practice', o.stats.practiceBest, 'practice')) : null,
      o.practiceStats ? h('div.pause-practice-stats', icon('flag'), `${o.practiceStats.checkpoints} checkpoints · ${o.practiceStats.attempts} practice attempts`) : null,
      h('div.pause-buttons',
        h('button.btn.btn-primary.btn-big', { 'data-autofocus': '', on: { click: o.onResume } }, icon('play'), h('span.btn-label', 'Resume')),
        button('Restart', o.onRestart, { iconName: 'restart', cls: 'btn-big' })),
      h('div.pause-row',
        o.fromEditor ? null : practiceBtn,
        button('Settings', o.onSettings, { iconName: 'settings', cls: 'btn-pill' }),
        button(o.fromEditor ? 'Back to editor' : 'Exit', o.onExit, { iconName: 'exit', cls: 'btn-pill btn-back' })),
      h('div.pause-attempt', `Attempt ${fmtNum(o.attempt)} · ${fmtNum(o.jumps)} jumps · ${fmtTime(o.time)}`)));
  return { el, onBack: () => (o.onResume(), true) };
}

export function completeScreen(app, o) {
  const coins = h('div.complete-coins', Array.from({ length: o.coinCount }, (_, i) => h('span.coin-slot' + (o.coins[i] ? '.got' : ''), { style: { animationDelay: 0.6 + i * 0.15 + 's' } }, icon('coin'))));
  const el = h('div.complete-screen',
    h('div.complete-burst'),
    h('div.complete-card',
      h('h1.complete-title', o.practice ? 'PRACTICE COMPLETE' : 'LEVEL COMPLETE'),
      h('h2.complete-level', o.level.name),
      h('div.complete-stats',
        h('div', h('b', fmtNum(o.attempts)), h('span', 'Attempts')),
        h('div', h('b', fmtNum(o.jumps)), h('span', 'Jumps')),
        h('div', h('b', fmtTime(o.time)), h('span', 'Time'))),
      o.coinCount ? coins : null,
      o.reward && o.reward.stars ? h('div.complete-reward', icon('star'), h('b', `+${o.reward.stars}`), h('span', 'stars earned')) : null,
      o.reward && o.reward.newCoins ? h('div.complete-reward.coin', icon('coin'), h('b', `+${o.reward.newCoins}`), h('span', 'new coins')) : null,
      o.verified ? h('div.complete-reward.verify', icon('verify'), h('span', 'Level verified!')) : null,
      h('div.complete-buttons',
        button('Replay', o.onReplay, { iconName: 'restart', cls: 'btn-big' }),
        h('button.btn.btn-primary.btn-big', { 'data-autofocus': '', on: { click: o.onExit } }, icon(o.fromEditor ? 'editor' : 'levels'), h('span.btn-label', o.fromEditor ? 'Editor' : 'Continue')))));
  return { el, onBack: () => (o.onExit(), true) };
}

export function loadingOverlay(text) {
  return h('div.loading-overlay', h('div.spinner'), h('div.loading-text', text));
}
