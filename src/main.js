// Entry point: boots the app behind a loading screen and wires scene navigation.

import { App } from './app.js';
import { MenuScene } from './scenes/menuScene.js';
import { PlayScene } from './scenes/playScene.js';

const canvas = document.getElementById('game');
const uiRoot = document.getElementById('ui');
const loading = document.getElementById('loading');
const bar = loading.querySelector('.boot-bar-fill');
const label = loading.querySelector('.boot-label');

function setProgress(pct, text) {
  bar.style.transform = `scaleX(${pct / 100})`;
  label.textContent = text;
}

function fatal(err) {
  console.error(err);
  loading.classList.add('error');
  label.textContent = 'Failed to start: ' + (err && err.message ? err.message : String(err));
}

const app = new App({ canvas, uiRoot, loading });
window.__prism = app; // handy for debugging from the console

const nav = {
  menu(where = 'main', params = {}) {
    const scene = new MenuScene(app, nav);
    app.setScene(scene);
    if (where === 'title') scene.showTitle();
    else {
      scene.showMain();
      if (where === 'levels') scene.showLevels(params);
    }
    return scene;
  },
  play(entry, { practice = false } = {}) {
    const index = app.mainLevels.findIndex((l) => l.id === entry.level.id);
    app.setScene(new PlayScene(app, entry, {
      practice,
      onExit: () => nav.menu('levels', entry.source === 'custom' ? { tab: 'mine', practice } : { index: Math.max(0, index), practice }),
    }));
  },
  async editor(levelId) {
    const { EditorScene } = await import('./editor/editorScene.js');
    app.setScene(new EditorScene(app, nav, levelId));
  },
};
app.nav = nav;

app
  .boot(setProgress)
  .then(() => {
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 600);
    nav.menu('title');
    app.start();
    for (const issue of app.storage.issues) app.ui.toast('Save data recovered', issue, { kind: 'error', duration: 6000 });
  })
  .catch(fatal);

window.addEventListener('error', (e) => app.ui && app.reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => app.ui && app.reportError(e.reason));
