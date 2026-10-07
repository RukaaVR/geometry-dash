// Application shell: owns every service (rendering, audio, input, saves, UI) and the
// main loop, and switches between scenes (menu, gameplay, editor).

import { Renderer } from './render/renderer.js';
import { ParticleSystem } from './render/particles.js';
import { GameView } from './render/gameView.js';
import { AudioEngine } from './audio/engine.js';
import { MusicManager } from './audio/music.js';
import { Sfx } from './audio/sfx.js';
import { Input } from './input/input.js';
import { Storage } from './save/storage.js';
import { defaultSettings, sanitizeSettings, renderConfig } from './save/settings.js';
import { Progress } from './save/progress.js';
import { LevelStore } from './save/levelStore.js';
import { UI } from './ui/ui.js';
import { MAIN_LEVELS } from './levels/index.js';
import { DebugOverlay } from './debug/debug.js';

export class App {
  constructor({ canvas, uiRoot, loading }) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.loadingEl = loading;
    this.scene = null;
    this.lastFrame = 0;
    this.frameCount = 0;
    this.fps = 60;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.time = 0;
    this.started = false;
  }

  async boot(onProgress) {
    const step = async (pct, label, fn) => {
      onProgress(pct, label);
      await new Promise((r) => setTimeout(r, 0));
      return fn();
    };
    await step(5, 'Loading save data', () => {
      this.storage = new Storage();
      this.settings = this.storage.load('settings', defaultSettings(), sanitizeSettings);
      this.mainLevels = MAIN_LEVELS;
      this.progress = new Progress(this.storage, MAIN_LEVELS.map((l) => ({
        id: l.id, difficulty: l.difficulty, stars: l.stars, coinCount: l.objects.filter((o) => o.t === 'coin').length,
      })));
      this.levelStore = new LevelStore(this.storage);
    });
    await step(15, 'Starting renderer', () => {
      this.renderer = new Renderer(this.canvas);
      this.particles = new ParticleSystem(2000);
      this.gameView = new GameView(this.renderer, this.particles);
      this.input = new Input(this.canvas);
      this.debug = new DebugOverlay(this);
    });
    await step(25, 'Starting audio', () => {
      this.audio = new AudioEngine();
      this.music = new MusicManager(this.audio);
      this.sfx = new Sfx(this.audio);
    });
    await step(35, 'Synthesizing sound effects', () => this.sfx.init());
    await step(55, 'Composing menu music', () => this.music.load('prism_menu'));
    await step(75, 'Composing first track', () => this.music.load(MAIN_LEVELS[0].song.id));
    await step(90, 'Building interface', () => {
      this.ui = new UI(this.uiRoot, this);
      this.applySettings();
      this.installGlobalHandlers();
    });
    onProgress(100, 'Ready');
  }

  get renderCfg() {
    return this._renderCfg || (this._renderCfg = renderConfig(this.settings));
  }

  applySettings() {
    this._renderCfg = renderConfig(this.settings);
    const cfg = this._renderCfg;
    this.renderer.setRenderScale(cfg.renderScale);
    this.particles.scale = cfg.particles;
    if (this.particles.capacity !== cfg.maxParticles) this.particles.setCapacity(cfg.maxParticles);
    this.audio.setVolumes(this.settings.audio);
    document.documentElement.classList.toggle('reduced-motion', cfg.reducedMotion);
    document.documentElement.classList.toggle('high-contrast', cfg.highContrast);
    this.debug.setFpsVisible(this.settings.graphics.showFps);
  }

  saveSettings() {
    this.storage.save('settings', this.settings);
    this.applySettings();
  }

  installGlobalHandlers() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.scene && this.scene.onResize && this.scene.onResize();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.scene && this.scene.onHidden) this.scene.onHidden();
    });
    // Unlock audio on the first interaction anywhere.
    const unlock = () => {
      this.audio.unlock().then((ok) => {
        if (ok && this.scene && this.scene.onAudioUnlocked) this.scene.onAudioUnlocked();
      });
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    this.input.onKey((code, e) => {
      if (code === 'F3' || (code === 'KeyD' && e.ctrlKey && e.shiftKey)) {
        this.debug.toggle();
        return true;
      }
      if (this.ui.modal) {
        if (code === 'Escape') {
          this.ui.back();
          return true;
        }
        return false;
      }
      if (this.scene && this.scene.onKey && this.scene.onKey(code, e)) return true;
      if (code === 'Escape' || code === 'Backspace') return this.ui.back();
      if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
        const dir = code.replace('Arrow', '').toLowerCase();
        return this.ui.nav(dir);
      }
      return false;
    });
  }

  setScene(scene) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = scene;
    this.input.setGameplay(false);
    scene.enter && scene.enter();
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.lastFrame = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      this.frame(now);
    };
    requestAnimationFrame(frame);
  }

  frame(now) {
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    // controller menu navigation / pause
    const nav = this.input.pollGamepads(now);
    for (const n of nav) {
      if (this.scene && this.scene.onPad && this.scene.onPad(n)) continue;
      if (n === 'confirm') this.ui.activateFocused();
      else if (n === 'back') this.ui.back();
      else if (n !== 'pause') this.ui.nav(n);
    }
    try {
      if (this.scene) {
        this.scene.update && this.scene.update(dt, now);
        this.scene.render && this.scene.render(now, dt);
      }
    } catch (e) {
      this.reportError(e);
    }
    this.debug.update(dt);
  }

  reportError(e) {
    console.error(e);
    if (this._lastErrorAt && performance.now() - this._lastErrorAt < 3000) return;
    this._lastErrorAt = performance.now();
    this.ui && this.ui.toast('Something went wrong', String(e && e.message ? e.message : e).slice(0, 120), { kind: 'error', iconName: 'info' });
  }

  /** Unlock and announce achievements; returns definitions unlocked. */
  checkAchievements(before = this.progress.summary()) {
    const list = this.progress.checkAchievements();
    list.forEach((a, i) => setTimeout(() => this.ui.achievement(a), 600 + i * 900));
    const newCos = this.progress.newlyUnlockedCosmetics(before);
    if (newCos.length) {
      setTimeout(() => {
        this.sfx.play('unlock');
        this.ui.toast('New cosmetics unlocked', newCos.map((c) => c.name).join(', '), { kind: 'unlock', iconName: 'customize', duration: 4200 });
      }, 600 + list.length * 900);
    }
    return list;
  }
}
