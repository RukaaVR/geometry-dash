// Level browser: carousel of main levels plus a "My Levels" tab for custom levels.

import { h, clear, fmtNum, fmtTime } from '../dom.js';
import { icon, difficultyEmblem, DIFFICULTY_LABEL, DIFFICULTY_COLOR } from '../icons.js';
import { backButton, button } from '../ui.js';
import { getSong } from '../../audio/songs.js';
import { songDuration } from '../../audio/synth.js';
import { compileLevel, timeAtX } from '../../game/sim/compile.js';

function levelDuration(level) {
  try {
    const w = compileLevel(level);
    return timeAtX(w.timeline, w.length);
  } catch (e) {
    return 0;
  }
}

function progressBar(label, pct, cls) {
  return h('div.pbar.' + cls,
    h('div.pbar-label', h('span', label), h('b', `${Math.floor(pct)}%`)),
    h('div.pbar-track', h('div.pbar-fill', { style: { width: `${Math.min(100, pct)}%` } })));
}

export function levelSelect(app, opts) {
  let practice = !!opts.practice;
  let tab = opts.tab || 'main';
  let index = Math.max(0, opts.index ?? app.mainLevels.findIndex((l) => !app.progress.level(l.id).completed));
  if (index < 0) index = 0;
  const durations = new Map();

  const practiceToggle = h('button.toggle-pill', {
    on: { click: () => { practice = !practice; renderPracticeToggle(); } },
    'aria-pressed': String(practice), title: 'Practice mode (P)',
  });
  function renderPracticeToggle() {
    practiceToggle.setAttribute('aria-pressed', String(practice));
    clear(practiceToggle).append(icon('practice'), h('span', practice ? 'Practice: ON' : 'Practice: OFF'));
    el.classList.toggle('practice-on', practice);
  }

  const tabs = h('div.tabs', { role: 'tablist' });
  const body = h('div.ls-body');
  const el = h('div.level-select',
    h('div.screen-header', backButton(() => opts.onBack()), h('h1.screen-title', 'Levels'), tabs, practiceToggle),
    body);

  function renderTabs() {
    clear(tabs);
    for (const [id, label] of [['main', 'Main Levels'], ['mine', 'My Levels']]) {
      tabs.append(h('button.tab' + (tab === id ? '.active' : ''), { role: 'tab', 'aria-selected': String(tab === id), on: { click: () => { tab = id; render(); } } }, label));
    }
  }

  // ---------------------------------------------------------------- main carousel
  function card(level, i) {
    const st = app.progress.level(level.id);
    const song = getSong(level.song.id);
    if (!durations.has(level.id)) durations.set(level.id, levelDuration(level));
    const coinCount = level.objects.filter((o) => o.t === 'coin').length;
    const coins = h('div.coin-row', Array.from({ length: coinCount }, (_, k) => h('span.coin-slot' + (st.coins[k] ? '.got' : ''), icon('coin'))));
    const c = h('div.level-card' + (st.completed ? '.completed' : ''), {
      style: { '--diff': DIFFICULTY_COLOR[level.difficulty] },
      dataset: { index: String(i) },
      on: { click: () => { if (i !== index) go(i); } },
    },
      h('div.lc-top',
        h('div.lc-emblem', { html: difficultyEmblem(level.difficulty, 76) }),
        h('div.lc-title',
          h('h2.lc-name', level.name),
          h('div.lc-meta', h('span.diff-label', DIFFICULTY_LABEL[level.difficulty]), h('span.lc-stars', icon('star'), level.stars)),
          h('div.lc-song', icon('music'), `${song.name} · ${song.bpm} BPM · ${fmtTime(durations.get(level.id))}`)),
        st.completed ? h('div.lc-done', icon('check')) : null),
      h('p.lc-desc', level.description || ''),
      progressBar('Normal', st.best, 'normal'),
      progressBar('Practice', st.practiceBest, 'practice'),
      h('div.lc-foot', h('span.lc-attempts', icon('retry'), `${fmtNum(st.attempts)} attempts`), coins),
      h('button.btn.btn-primary.lc-play', { on: { click: (e) => { e.stopPropagation(); play(level); } }, tabIndex: i === index ? 0 : -1 },
        icon('play'), h('span.btn-label', 'Play')),
    );
    return c;
  }

  let track = null;
  let dots = null;
  function renderMain() {
    const levels = app.mainLevels;
    track = h('div.carousel-track', levels.map(card));
    dots = h('div.carousel-dots', levels.map((l, i) => h('button.dot', { 'aria-label': l.name, on: { click: () => go(i) }, style: { '--diff': DIFFICULTY_COLOR[l.difficulty] } })));
    const prev = h('button.btn.btn-icon.carousel-arrow.left', { 'aria-label': 'Previous level', on: { click: () => go(index - 1) } }, icon('left'));
    const next = h('button.btn.btn-icon.carousel-arrow.right', { 'aria-label': 'Next level', on: { click: () => go(index + 1) } }, icon('right'));
    const viewport = h('div.carousel', prev, h('div.carousel-viewport', track), next);
    // wheel + swipe
    let wheelLock = 0;
    viewport.addEventListener('wheel', (e) => {
      const now = performance.now();
      if (now < wheelLock) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 8) return;
      wheelLock = now + 280;
      go(index + Math.sign(d));
    }, { passive: true });
    let sx = null;
    viewport.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    viewport.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 50) go(index - Math.sign(dx));
    });
    body.append(viewport, dots);
    layout();
  }

  function layout() {
    if (!track) return;
    [...track.children].forEach((c, i) => {
      const off = i - index;
      c.style.setProperty('--off', off);
      c.classList.toggle('active', off === 0);
      c.classList.toggle('near', Math.abs(off) === 1);
      c.setAttribute('aria-hidden', String(off !== 0));
      const b = c.querySelector('.lc-play');
      if (b) b.tabIndex = off === 0 ? 0 : -1;
    });
    [...dots.children].forEach((d, i) => d.classList.toggle('active', i === index));
    const lvl = app.mainLevels[index];
    el.style.setProperty('--accent', DIFFICULTY_COLOR[lvl.difficulty]);
  }

  function go(i) {
    const n = app.mainLevels.length;
    const ni = Math.max(0, Math.min(n - 1, i));
    if (ni === index) return;
    index = ni;
    app.sfx.play('select', { volume: 0.6 });
    layout();
    const b = track.children[index].querySelector('.lc-play');
    if (b && document.activeElement && el.contains(document.activeElement)) b.focus({ preventScroll: true });
  }

  function play(level) {
    opts.onPlay({ level, source: 'main' }, practice);
  }

  // ---------------------------------------------------------------- my levels
  function renderMine() {
    const list = app.levelStore.list();
    const grid = h('div.my-levels');
    grid.append(
      h('div.my-actions',
        button('New level', () => opts.onCreate(), { iconName: 'plus', cls: 'btn-primary' }),
        button('Import', () => importLevel(), { iconName: 'upload' })));
    if (!list.length) {
      grid.append(h('div.empty-state', icon('editor', 'empty-ico'), h('h3', 'No custom levels yet'), h('p', 'Build your own in the editor, or import a level shared by a friend.')));
    }
    for (const e of list) {
      const st = app.progress.level(e.id);
      grid.append(h('div.my-card', { style: { '--diff': DIFFICULTY_COLOR[e.difficulty] || '#fff' } },
        h('div.my-card-head', h('div.my-emblem', { html: difficultyEmblem(e.difficulty || 'normal', 44) }),
          h('div', h('h3', e.name), h('small', `${e.objectCount} objects · ${new Date(e.updatedAt).toLocaleDateString()}`)),
          e.verified ? h('span.badge.verified', { title: 'Verified: beaten from the start in test mode' }, icon('verify'), 'Verified') : null),
        progressBar('Best', st.best, 'normal'),
        h('div.my-card-actions',
          button('Play', () => {
            const level = app.levelStore.get(e.id);
            if (!level) return app.ui.alert('Level unavailable', 'This level could not be loaded. Its data may be damaged.');
            opts.onPlay({ level, source: 'custom' }, practice);
          }, { iconName: 'play', cls: 'btn-primary btn-small' }),
          button('Edit', () => opts.onEdit(e.id), { iconName: 'editor', cls: 'btn-small' }),
          button('', () => exportLevel(e.id), { iconName: 'download', cls: 'btn-small btn-icon', title: 'Export' }),
          button('', () => deleteLevel(e.id, e.name), { iconName: 'trash', cls: 'btn-small btn-icon btn-danger', title: 'Delete' }))));
    }
    body.append(grid);
  }

  async function importLevel() {
    const text = await app.ui.prompt('Import level', 'Paste level data (JSON) below.', '', { multiline: true, okLabel: 'Import', placeholder: '{"name": ...}' });
    if (!text) return;
    try {
      const { level, warnings } = app.levelStore.import(text);
      app.ui.toast('Level imported', level.name + (warnings.length ? ` (${warnings.length} invalid objects skipped)` : ''), { iconName: 'check' });
      render();
    } catch (err) {
      app.ui.alert('Import failed', err.message || 'The level data is invalid.');
    }
  }

  async function exportLevel(id) {
    const level = app.levelStore.get(id);
    if (!level) return;
    const text = JSON.stringify(level);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (e) {
      copied = false;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${level.name.replace(/[^\w-]+/g, '_')}.prism.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    app.ui.toast('Level exported', copied ? 'Copied to clipboard and downloaded' : 'Downloaded as a file', { iconName: 'download' });
  }

  async function deleteLevel(id, name) {
    if (await app.ui.confirm('Delete level?', `"${name}" will be permanently deleted.`, { okLabel: 'Delete', danger: true })) {
      app.levelStore.delete(id);
      render();
    }
  }

  function render() {
    renderTabs();
    clear(body);
    track = null;
    el.classList.toggle('tab-mine', tab === 'mine');
    if (tab === 'main') renderMain();
    else renderMine();
  }

  render();
  renderPracticeToggle();

  return {
    el,
    onNav(dir) {
      if (tab !== 'main') return false;
      if (dir === 'left' || dir === 'right') {
        go(index + (dir === 'left' ? -1 : 1));
        return true;
      }
      return false;
    },
    onKey(code) {
      if (code === 'KeyP') {
        practice = !practice;
        renderPracticeToggle();
        return true;
      }
      if (tab === 'main' && (code === 'Enter' || code === 'NumpadEnter') && document.activeElement === document.body) {
        play(app.mainLevels[index]);
        return true;
      }
      return false;
    },
    onEnter() {
      if (track) {
        // refresh stats after returning from a level
        const keepIndex = index;
        render();
        index = keepIndex;
        layout();
      }
    },
    onBack() {
      opts.onBack();
      return true;
    },
  };
}

export { songDuration };
