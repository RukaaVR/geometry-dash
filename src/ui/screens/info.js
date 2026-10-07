// Achievements, statistics and credits screens.

import { h, fmtNum, fmtTime } from '../dom.js';
import { icon, difficultyEmblem, DIFFICULTY_LABEL } from '../icons.js';
import { backButton } from '../ui.js';
import { ACHIEVEMENTS } from '../../save/achievements.js';
import { logo } from './menu.js';

export function achievementsScreen(app, onBack) {
  const unlocked = app.progress.data.achievements;
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  const list = h('div.ach-grid', ACHIEVEMENTS.map((a) => {
    const got = !!unlocked[a.id];
    return h('div.ach-card.nav' + (got ? '.got' : ''), { tabIndex: 0 },
      h('div.ach-badge', icon(got ? a.icon : 'lock')),
      h('div.ach-text', h('b', a.name), h('span', a.desc), got ? h('small', 'Unlocked ' + new Date(unlocked[a.id]).toLocaleDateString()) : null));
  }));
  const el = h('div.info-screen',
    h('div.screen-header', backButton(onBack), h('h1.screen-title', 'Achievements'),
      h('div.header-meta', `${count} / ${ACHIEVEMENTS.length}`)),
    h('div.ach-progress', h('div.pbar-track', h('div.pbar-fill', { style: { width: (count / ACHIEVEMENTS.length) * 100 + '%' } }))),
    h('div.scroll-area', list));
  return { el, onBack: () => (onBack(), true) };
}

export function statsScreen(app, onBack) {
  const s = app.progress.summary();
  const t = s.totals;
  const tile = (label, value, ico) => h('div.stat-tile', icon(ico), h('b', value), h('span', label));
  const rows = app.mainLevels.map((l) => {
    const st = app.progress.level(l.id);
    return h('tr',
      h('td', h('span.mini-emblem', { html: difficultyEmblem(l.difficulty, 22) }), l.name),
      h('td', DIFFICULTY_LABEL[l.difficulty]),
      h('td', `${st.best}%`),
      h('td', `${st.practiceBest}%`),
      h('td', fmtNum(st.attempts)),
      h('td', fmtNum(st.jumps)),
      h('td', fmtTime(st.playTime)),
      h('td', st.coins.filter(Boolean).length + ''));
  });
  const el = h('div.info-screen',
    h('div.screen-header', backButton(onBack), h('h1.screen-title', 'Statistics')),
    h('div.scroll-area',
      h('div.stat-tiles',
        tile('Stars', `${s.stars}/${s.starsTotal}`, 'star'),
        tile('Secret coins', `${s.coins}/${s.coinsTotal}`, 'coin'),
        tile('Levels completed', `${s.mainCompleted}/${s.mainTotal}`, 'check'),
        tile('Total attempts', fmtNum(t.attempts), 'retry'),
        tile('Jumps', fmtNum(t.jumps), 'jump'),
        tile('Crashes', fmtNum(t.deaths), 'skull'),
        tile('Orbs activated', fmtNum(t.orbs), 'orb'),
        tile('Checkpoints placed', fmtNum(t.checkpoints), 'flag'),
        tile('Time played', fmtTime(t.playTime), 'clock'),
        tile('Levels created', fmtNum(t.levelsSaved), 'editor'),
        tile('Achievements', `${Object.keys(s.achievements).length}`, 'trophy'),
        tile('Practice completions', fmtNum(t.practiceCompletions), 'practice')),
      h('div.table-wrap', h('table.stat-table',
        h('thead', h('tr', ['Level', 'Difficulty', 'Best', 'Practice', 'Attempts', 'Jumps', 'Time', 'Coins'].map((c) => h('th', c)))),
        h('tbody', rows)))));
  return { el, onBack: () => (onBack(), true) };
}

export function creditsScreen(app, onBack) {
  const el = h('div.info-screen.credits',
    h('div.screen-header', backButton(onBack), h('h1.screen-title', 'Credits')),
    h('div.scroll-area',
      h('div.credits-body',
        logo(),
        h('p.credits-lead', 'An original rhythm platformer built from scratch for the web.'),
        h('div.credits-grid',
          h('div', h('h3', 'Design & Programming'), h('p', 'Prism Pulse team')),
          h('div', h('h3', 'Music'), h('p', 'Procedurally synthesized original soundtrack, rendered live with the Web Audio API')),
          h('div', h('h3', 'Art'), h('p', 'Every icon, object, background and effect is drawn procedurally — no external assets')),
          h('div', h('h3', 'Technology'), h('p', 'Deterministic 240 Hz fixed-step physics, audio-clock synchronisation, Canvas 2D rendering'))),
        h('h3', 'Controls'),
        h('div.controls-table',
          ...[
            ['Jump / Fly / Flip', 'Space · ↑ · W · Click · Tap · Gamepad A'],
            ['Pause', 'Esc · P · Gamepad Start'],
            ['Restart', 'R'],
            ['Practice checkpoint', 'Z (place) · X (remove)'],
            ['Editor', 'Click place · Shift select · Ctrl+Z/Y undo/redo · Ctrl+C/V copy/paste · Ctrl+D duplicate · Q/E rotate · Del delete'],
          ].map(([k, v]) => h('div.ct-row', h('b', k), h('span', v)))),
        h('p.credits-thanks', 'Thank you for playing.'))));
  return { el, onBack: () => (onBack(), true) };
}
