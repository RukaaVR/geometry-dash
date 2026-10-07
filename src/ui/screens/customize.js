// Icon / colour / trail / death-effect customisation with unlockables and a live preview.

import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { backButton } from '../ui.js';
import { ICON_KINDS, cosmeticsOfKind, PALETTE, PALETTE_REQ, describeRequirement } from '../../save/cosmetics.js';
import { iconCanvas, paintIcon } from '../../render/icons.js';

const TAB_LABEL = { cube: 'Cube', ship: 'Ship', ball: 'Ball', ufo: 'UFO', wave: 'Wave', robot: 'Robot', spider: 'Spider', trail: 'Trail', death: 'Death FX' };

export function customizeScreen(app, onBack) {
  let tab = 'cube';
  const preview = h('canvas.cz-preview-canvas', { width: 360, height: 360 });
  const previewModes = h('div.cz-preview-modes');
  const tabs = h('div.tabs.cz-tabs');
  const grid = h('div.cz-grid');
  const colors = h('div.cz-colors');
  const info = h('div.cz-info');
  let previewMode = 'cube';
  let raf = 0;

  const el = h('div.customize',
    h('div.screen-header', backButton(onBack), h('h1.screen-title', 'Customize')),
    h('div.cz-layout',
      h('div.cz-preview', h('div.cz-stage', preview), previewModes, info),
      h('div.cz-panel', tabs, grid, colors)));

  const look = () => app.progress.playerLook();

  function renderTabs() {
    clear(tabs);
    for (const k of [...ICON_KINDS, 'trail', 'death']) {
      tabs.append(h('button.tab' + (k === tab ? '.active' : ''), { on: { click: () => { tab = k; if (ICON_KINDS.includes(k)) previewMode = k; render(); } } }, TAB_LABEL[k]));
    }
  }

  function renderPreviewModes() {
    clear(previewModes);
    for (const m of ICON_KINDS) {
      const b = h('button.cz-mode' + (m === previewMode ? '.active' : ''), { title: TAB_LABEL[m], on: { click: () => { previewMode = m; renderPreviewModes(); } } }, iconCanvas(m, look(), 30));
      previewModes.append(b);
    }
  }

  function renderGrid() {
    clear(grid);
    const items = cosmeticsOfKind(tab);
    const selected = app.progress.loadout[tab];
    for (const item of items) {
      const unlocked = app.progress.isCosmeticUnlocked(item);
      let thumb;
      if (ICON_KINDS.includes(tab)) {
        const l = look();
        thumb = iconCanvas(tab, { ...l, designs: { ...l.designs, [tab]: item.index } }, 54);
      } else thumb = h('div.cz-fx-thumb', icon(tab === 'trail' ? 'bolt' : 'skull'), h('small', item.name));
      const b = h('button.cz-item' + (item.index === selected ? '.selected' : '') + (unlocked ? '' : '.locked'), {
        title: unlocked ? item.name : `${item.name} — ${describeRequirement(item.req)}`,
        'aria-label': item.name,
        on: {
          click: () => {
            if (!unlocked) {
              app.sfx.play('back');
              info.textContent = `${item.name}: ${describeRequirement(item.req)}`;
              return;
            }
            app.progress.setLoadout(tab, item.index);
            app.sfx.play('select');
            info.textContent = item.name;
            render();
          },
        },
      }, thumb, unlocked ? null : h('span.cz-lock', icon('lock')));
      grid.append(b);
    }
  }

  function renderColors() {
    clear(colors);
    const l = app.progress.loadout;
    const row = (label, key) => {
      const sw = h('div.swatches');
      PALETTE.forEach((c, i) => {
        const unlocked = app.progress.isColorUnlocked(i);
        sw.append(h('button.swatch' + (l[key] === i ? '.selected' : '') + (unlocked ? '' : '.locked'), {
          style: { '--c': c }, 'aria-label': `${label} color ${i + 1}`,
          title: unlocked ? c : describeRequirement(PALETTE_REQ[i]),
          on: {
            click: () => {
              if (!unlocked) {
                info.textContent = describeRequirement(PALETTE_REQ[i]);
                app.sfx.play('back');
                return;
              }
              app.progress.setLoadout(key, i);
              render();
            },
          },
        }, unlocked ? null : icon('lock')));
      });
      return h('div.color-row', h('h4', label), sw);
    };
    const glow = h('label.switch', h('input', { type: 'checkbox', checked: l.glow, on: { change: (e) => { app.progress.setLoadout('glow', e.target.checked); } } }), h('span.switch-ui'), h('span', 'Icon glow'));
    colors.append(row('Primary', 'primary'), row('Secondary', 'secondary'), glow);
  }

  function render() {
    renderTabs();
    renderGrid();
    renderColors();
    renderPreviewModes();
  }

  function animate(t) {
    raf = requestAnimationFrame(animate);
    const rot = previewMode === 'cube' ? ((t / 1000) * 2.2) % (Math.PI * 2) : previewMode === 'ball' ? (t / 1000) * 3 : 0;
    const l = look();
    paintIcon(preview, previewMode, l, { rotation: rot, phase: t / 90 });
  }

  render();
  return {
    el,
    onEnter() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(animate);
    },
    onLeave() {
      cancelAnimationFrame(raf);
    },
    onBack() {
      onBack();
      return true;
    },
  };
}
