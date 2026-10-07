// Settings screen generated from the settings schema, plus data management and an
// audio latency calibration tool.

import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { backButton, button } from '../ui.js';
import { SETTINGS_SCHEMA, defaultSettings, sanitizeSettings } from '../../save/settings.js';
import { sanitizeProgress } from '../../save/progress.js';

const SECTIONS = [
  ['graphics', 'Graphics'],
  ['audio', 'Audio'],
  ['gameplay', 'Gameplay'],
  ['accessibility', 'Accessibility'],
  ['data', 'Data'],
];

const DESCRIPTIONS = {
  'graphics.quality': 'Overall preset for particles, glow and resolution.',
  'graphics.renderScale': 'Lower to improve performance on slower devices.',
  'audio.offsetMs': 'Shift gameplay timing relative to the music. Use Calibrate to measure it.',
  'gameplay.respawnDelay': 'Time between a crash and the next attempt.',
  'gameplay.autoCheckpoints': 'Practice mode places checkpoints automatically.',
  'gameplay.holdToRetry': 'Wait for a press after crashing instead of retrying automatically.',
  'accessibility.reducedMotion': 'Disables camera rotation, shake and heavy background motion.',
  'accessibility.reducedFlashing': 'Greatly reduces screen flashes and pulses.',
  'accessibility.highContrast': 'Simplified backgrounds and brighter objects.',
};

export function settingsScreen(app, onBack, { inGame = false } = {}) {
  let section = 'graphics';
  const tabs = h('div.tabs.settings-tabs');
  const panel = h('div.settings-panel');
  const el = h('div.settings' + (inGame ? '.in-game' : ''),
    h('div.screen-header', backButton(onBack), h('h1.screen-title', 'Settings')),
    h('div.settings-layout', tabs, h('div.scroll-area', panel)));

  function set(sec, key, value) {
    app.settings[sec][key] = value;
    app.saveSettings();
  }

  function control(sec, key, f) {
    const value = app.settings[sec][key];
    let input;
    if (f.type === 'bool') {
      input = h('label.switch', h('input', { type: 'checkbox', checked: value, on: { change: (e) => set(sec, key, e.target.checked) } }), h('span.switch-ui'));
    } else if (f.type === 'select') {
      input = h('div.segmented', f.options.map((o) => h('button.seg' + (o === value ? '.active' : ''), {
        type: 'button',
        on: { click: () => { set(sec, key, o); render(); } },
      }, String(o)[0].toUpperCase() + String(o).slice(1))));
    } else {
      const out = h('output.range-value', fmt(f, value));
      const r = h('input.range', {
        type: 'range', min: f.min, max: f.max, step: f.step, value,
        on: {
          input: (e) => {
            const v = Number(e.target.value);
            out.textContent = fmt(f, v);
            set(sec, key, v);
          },
        },
      });
      input = h('div.range-wrap', r, out);
    }
    const desc = DESCRIPTIONS[sec + '.' + key];
    return h('div.setting-row', h('div.setting-text', h('b', f.label), desc ? h('small', desc) : null), input);
  }

  function fmt(f, v) {
    if (f.label.includes('volume')) return Math.round(v * 100) + '%';
    if (f.label.includes('resolution')) return Math.round(v * 100) + '%';
    if (f.label.includes('(ms)')) return (v > 0 ? '+' : '') + v + ' ms';
    if (f.label.includes('(s)')) return v.toFixed(2) + ' s';
    return String(v);
  }

  function renderData() {
    panel.append(
      h('div.setting-row', h('div.setting-text', h('b', 'Export save'), h('small', 'Download your progress, settings and custom levels as a backup file.')),
        button('Export', exportSave, { iconName: 'download' })),
      h('div.setting-row', h('div.setting-text', h('b', 'Import save'), h('small', 'Restore a previously exported backup. This replaces current progress.')),
        button('Import', importSave, { iconName: 'upload' })),
      h('div.setting-row', h('div.setting-text', h('b', 'Reset settings'), h('small', 'Restore all settings to their defaults.')),
        button('Reset', async () => {
          if (await app.ui.confirm('Reset settings?', 'All settings will return to their defaults.')) {
            app.settings = defaultSettings();
            app.saveSettings();
            render();
          }
        }, { iconName: 'restart' })),
      h('div.setting-row.danger-row', h('div.setting-text', h('b', 'Reset progress'), h('small', 'Erase stars, coins, achievements and statistics. Custom levels are kept.')),
        button('Reset', async () => {
          if (await app.ui.confirm('Erase all progress?', 'This cannot be undone. Consider exporting a backup first.', { okLabel: 'Erase', danger: true })) {
            app.progress.resetAll();
            app.ui.toast('Progress reset', '', { iconName: 'trash' });
          }
        }, { iconName: 'trash', cls: 'btn-danger' })),
      app.storage.persistent ? '' : h('p.warning', icon('info'), 'Browser storage is unavailable; progress will not be kept after closing the page.'),
      ...app.storage.issues.map((i) => h('p.warning', icon('info'), i)),
    );
  }

  function exportSave() {
    const data = {
      game: 'prism-pulse', version: 1, exportedAt: new Date().toISOString(),
      settings: app.settings, progress: app.progress.data,
      levels: app.levelStore.list().map((e) => app.levelStore.get(e.id)).filter(Boolean),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `prism-pulse-save-${Date.now()}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    app.ui.toast('Save exported', 'Backup file downloaded', { iconName: 'download' });
  }

  function importSave() {
    const fileInput = h('input', { type: 'file', accept: '.json,application/json' });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || data.game !== 'prism-pulse') throw new Error('This file is not a Prism Pulse save.');
        if (!(await app.ui.confirm('Import save?', 'Your current progress and settings will be replaced.', { okLabel: 'Import' }))) return;
        app.settings = sanitizeSettings(data.settings);
        app.saveSettings();
        app.progress.data = sanitizeProgress(data.progress);
        app.progress.save();
        let n = 0;
        for (const lvl of data.levels || []) {
          try {
            app.levelStore.import(JSON.stringify(lvl));
            n++;
          } catch (e) {
            /* skip invalid level */
          }
        }
        app.ui.toast('Save imported', `${n} custom levels restored`, { iconName: 'check' });
        render();
      } catch (e) {
        app.ui.alert('Import failed', e.message || 'Invalid save file.');
      }
    });
    fileInput.click();
  }

  async function calibrate() {
    const audio = app.audio;
    if (!audio.running) {
      app.ui.alert('Audio unavailable', 'Audio must be enabled to calibrate. Click anywhere first, then try again.');
      return;
    }
    const taps = [];
    const beats = [];
    const bpm = 100;
    const spb = 60 / bpm;
    const count = 12;
    const start = audio.ctx.currentTime + 0.6;
    for (let i = 0; i < count; i++) {
      const t = start + i * spb;
      beats.push(t);
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.frequency.value = i % 4 === 0 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      o.connect(g);
      g.connect(audio.sfxBus);
      o.start(t);
      o.stop(t + 0.1);
    }
    const pad = h('button.calib-pad', 'Tap here (or press Space) on every beat');
    const onTap = (ts) => {
      taps.push(audio.audibleTimeAt(ts));
      pad.classList.remove('hit');
      void pad.offsetWidth;
      pad.classList.add('hit');
    };
    pad.addEventListener('pointerdown', (e) => onTap(e.timeStamp));
    const key = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) onTap(e.timeStamp);
      }
    };
    window.addEventListener('keydown', key, true);
    const result = app.ui.dialog({
      title: 'Audio calibration',
      content: h('div.calib', h('p', 'Listen to the clicks and tap along with every beat. The first few beats are ignored.'), pad),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', value: 'apply', primary: true }],
    });
    const v = await result;
    window.removeEventListener('keydown', key, true);
    if (v !== 'apply') return;
    const deltas = [];
    for (const t of taps) {
      let best = null;
      for (const b of beats.slice(3)) if (best === null || Math.abs(t - b) < Math.abs(t - best)) best = b;
      if (best !== null && Math.abs(t - best) < spb / 2) deltas.push(t - best);
    }
    if (deltas.length < 4) {
      app.ui.alert('Not enough taps', 'Try again and tap along with at least 4 beats.');
      return;
    }
    deltas.sort((a, b) => a - b);
    const median = deltas[Math.floor(deltas.length / 2)];
    const ms = Math.max(-200, Math.min(200, Math.round((median * 1000) / 5) * 5));
    set('audio', 'offsetMs', ms);
    app.ui.toast('Calibrated', `Audio offset set to ${ms > 0 ? '+' : ''}${ms} ms`, { iconName: 'music' });
    render();
  }

  function render() {
    clear(tabs);
    for (const [id, label] of SECTIONS) {
      tabs.append(h('button.tab' + (id === section ? '.active' : ''), { on: { click: () => { section = id; render(); } } }, label));
    }
    clear(panel);
    if (section === 'data') return renderData();
    for (const [key, f] of Object.entries(SETTINGS_SCHEMA[section])) panel.append(control(section, key, f));
    if (section === 'audio') {
      panel.append(h('div.setting-row', h('div.setting-text', h('b', 'Calibrate audio offset'), h('small', 'Tap along to a metronome to measure your audio latency.')),
        button('Calibrate', calibrate, { iconName: 'music' })));
    }
    if (section === 'gameplay') {
      panel.append(h('div.controls-hint', icon('keyboard'), h('span', 'Jump: Space / ↑ / W / Click / Tap / Gamepad A · Pause: Esc / P · Restart: R · Checkpoints: Z / X')));
    }
  }

  render();
  return { el, onBack: () => (onBack(), true) };
}
