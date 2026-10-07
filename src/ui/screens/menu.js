// Title and main menu screens.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { button } from '../ui.js';
import { iconCanvas } from '../../render/icons.js';

export function logo() {
  const word = (w, cls) => h('span.logo-word.' + cls, [...w].map((ch, i) => h('span.logo-ch', { style: { animationDelay: i * 0.06 + 's' } }, ch)));
  return h('div.logo', h('div.logo-mark'), h('div.logo-text', word('PRISM', 'w1'), word('PULSE', 'w2')));
}

export function titleScreen(app, onStart) {
  const el = h('div.title-screen', { on: { click: () => onStart() } },
    logo(),
    h('div.title-tag', 'A rhythm platformer of precision and light'),
    h('button.btn.btn-primary.btn-huge.title-start.silent', { 'data-autofocus': '', on: { click: (e) => { e.stopPropagation(); onStart(); } } }, icon('play'), h('span.btn-label', 'Press to start')),
    h('div.title-hint', 'Space / Click / Tap / (A) to jump'),
  );
  return {
    el,
    onBack: () => true,
  };
}

export function mainMenu(app, actions) {
  const summary = app.progress.summary();
  const look = app.progress.playerLook();
  const profile = h('div.profile-chip',
    h('div.profile-icon', iconCanvas('cube', look, 40)),
    h('div.profile-stats',
      h('span.stat-pill.stars', icon('star'), h('b', `${summary.stars}`), h('small', `/${summary.starsTotal}`)),
      h('span.stat-pill.coins', icon('coin'), h('b', `${summary.coins}`), h('small', `/${summary.coinsTotal}`)),
    ));
  const next = actions.nextLevel();
  const playBtn = h('button.btn.btn-play', { 'data-autofocus': '', on: { click: () => actions.quickPlay() }, title: next ? `Play ${next.name}` : 'Play' },
    h('div.play-ring'), icon('play', 'play-ico'), h('span.btn-label', 'PLAY'),
    next ? h('small.play-next', next.name) : null);
  const side = (label, ico, fn, cls) => h('button.btn.btn-side.' + cls, { on: { click: fn } }, h('div.side-ico', icon(ico)), h('span.btn-label', label));
  const small = (label, ico, fn) => h('button.btn.btn-round', { on: { click: fn }, title: label, 'aria-label': label }, icon(ico), h('span.round-label', label));

  const el = h('div.main-menu',
    h('div.menu-top', profile, h('div.menu-version', 'v1.0')),
    logo(),
    h('div.menu-center',
      side('Customize', 'customize', actions.customize, 'side-left'),
      playBtn,
      side('Create', 'editor', actions.editor, 'side-right')),
    h('div.menu-row',
      button('Levels', actions.levels, { iconName: 'levels', cls: 'btn-pill' }),
      button('Practice', actions.practice, { iconName: 'practice', cls: 'btn-pill' })),
    h('div.menu-bottom',
      small('Achievements', 'trophy', actions.achievements),
      small('Statistics', 'stats', actions.stats),
      small('Settings', 'settings', actions.settings),
      small('Credits', 'credits', actions.credits)),
  );
  return { el, onBack: () => true };
}
