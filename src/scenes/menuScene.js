// Menu scene: an autopiloted demo run renders behind the DOM menus while the menu
// music plays. Also routes between the menu screens.

import { compileLevel } from '../game/sim/compile.js';
import { createState, step } from '../game/sim/sim.js';
import { solveLevel } from '../game/sim/solver.js';
import { DT } from '../game/constants.js';
import { GameCamera } from '../render/camera.js';
import { PlayerView, eventParticles } from '../render/playerView.js';
import { buildAttractLevel } from '../levels/attract.js';
import { titleScreen, mainMenu } from '../ui/screens/menu.js';
import { levelSelect } from '../ui/screens/levelSelect.js';
import { customizeScreen } from '../ui/screens/customize.js';
import { achievementsScreen, statsScreen, creditsScreen } from '../ui/screens/info.js';
import { settingsScreen } from '../ui/screens/settings.js';

let attractCache = null;

/** Build (once) the demo level and a verified input sequence that beats it. */
export function getAttract() {
  if (attractCache) return attractCache;
  let seed = 7;
  for (let tries = 0; tries < 6; tries++, seed += 11) {
    const level = buildAttractLevel(seed);
    const world = compileLevel(level);
    const sol = solveLevel(world, { beam: 24, decision: 4 });
    if (sol.success) {
      attractCache = { level, world, sol };
      return attractCache;
    }
  }
  const level = buildAttractLevel(1);
  attractCache = { level, world: compileLevel(level), sol: { inputs: [], decision: 4, success: false } };
  return attractCache;
}

export class MenuScene {
  constructor(app, nav) {
    this.app = app;
    this.nav = nav;
    this.camera = new GameCamera();
    this.playerView = new PlayerView(app.renderer, app.particles);
    this.pose = { x: 0, y: 0, rot: 0 };
    this.acc = 0;
    this.beat = 0;
    this.lastBeat = -1;
    this.fade = 0;
    this.events = [];
  }

  enter() {
    const a = getAttract();
    this.world = a.world;
    this.sol = a.sol;
    this.resetRun();
    this.startMusic();
  }

  startMusic() {
    const m = this.app.music;
    if (m.songId !== 'prism_menu' || m.state !== 'playing') m.play('prism_menu', 0, { loop: true, fadeIn: 1.2, wait: false });
    this.app.audio.setMuffled(false);
  }

  onAudioUnlocked() {
    // Restart the loop with real audio once the browser allows playback.
    const m = this.app.music;
    if (m.songId === 'prism_menu' && m.fallback) m.play('prism_menu', m.position(performance.now()), { loop: true, fadeIn: 0.8 });
  }

  exit() {
    this.app.particles.clear();
  }

  resetRun() {
    this.state = createState(this.world);
    this.tick = 0;
    this.prevHeld = false;
    this.playerView.reset();
    this.playerView.setLook(this.app.progress.playerLook());
    this.app.particles.clear();
    this.camera.snap(this.state.player, this.app.renderer.viewHalf(1));
  }

  // ------------------------------------------------------------------ screens

  showTitle() {
    this.app.ui.replace(titleScreen(this.app, () => {
      this.app.audio.unlock().then(() => this.onAudioUnlocked());
      this.app.sfx.play('select');
      this.showMain();
    }));
  }

  showMain() {
    const app = this.app;
    const nav = this.nav;
    app.ui.replace(mainMenu(app, {
      nextLevel: () => app.mainLevels.find((l) => !app.progress.level(l.id).completed) || null,
      quickPlay: () => {
        const next = app.mainLevels.find((l) => !app.progress.level(l.id).completed) || app.mainLevels[0];
        nav.play({ level: next, source: 'main' }, { practice: false });
      },
      levels: () => this.showLevels({ practice: false }),
      practice: () => this.showLevels({ practice: true }),
      customize: () => app.ui.push(customizeScreen(app, () => this.back())),
      editor: () => this.showLevels({ tab: 'mine' }),
      achievements: () => app.ui.push(achievementsScreen(app, () => this.back())),
      stats: () => app.ui.push(statsScreen(app, () => this.back())),
      settings: () => app.ui.push(settingsScreen(app, () => this.back())),
      credits: () => app.ui.push(creditsScreen(app, () => this.back())),
    }));
  }

  back() {
    const app = this.app;
    if (app.ui.stack.length > 1) app.ui.pop();
    else this.showMain();
    // refresh main menu stats (stars, icon) when returning to it
    if (app.ui.stack.length === 1) this.showMain();
  }

  showLevels(opts = {}) {
    const app = this.app;
    if (app.ui.stack.length === 0) this.showMain();
    app.ui.push(levelSelect(app, {
      ...opts,
      onBack: () => this.back(),
      onPlay: (entry, practice) => this.nav.play(entry, { practice }),
      onEdit: (id) => this.nav.editor(id),
      onCreate: () => this.nav.editor(null),
    }));
  }

  onKey(code, e) {
    const top = this.app.ui.top;
    if (top && top.onKey && top.onKey(code, e)) return true;
    return false;
  }

  // ------------------------------------------------------------------ loop

  update(dt, now) {
    const app = this.app;
    this.acc += dt;
    let n = 0;
    while (this.acc >= DT && n < 60) {
      this.acc -= DT;
      n++;
      const di = Math.floor(this.tick / this.sol.decision);
      const held = this.sol.inputs[di] ?? false;
      const pressed = held && this.tick % this.sol.decision === 0 && !this.prevHeld;
      if (this.tick % this.sol.decision === 0) this.prevHeld = held;
      this.events.length = 0;
      step(this.world, this.state, { held, pressed }, this.events);
      this.tick++;
      if (app.renderCfg.particles) for (const ev of this.events) eventParticles(app.particles, ev, null, this.state.player);
      if (this.state.dead || this.state.complete) {
        this.resetRun();
        break;
      }
    }
    if (this.acc > 0.5) this.acc = 0;
    const p = this.state.player;
    const a = this.acc / DT;
    this.pose.x = p.px + (p.x - p.px) * a;
    this.pose.y = p.py + (p.y - p.py) * a;
    this.pose.rot = p.prot + (p.rot - p.prot) * a;
    const half = app.renderer.viewHalf(1);
    this.camera.update(dt, this.pose, p, half, this.state.cam, 0, app.renderCfg);
    const pos = app.music.position(now);
    const beatF = (pos * 112) / 60;
    const bi = Math.floor(beatF);
    this.beat = Math.exp(-(beatF - bi) * 5) * 0.6;
    const hit = bi !== this.lastBeat;
    this.lastBeat = bi;
    this.playerView.update(dt, this.pose, p, app.renderCfg, hit);
    app.particles.update(dt);
    app.gameView.update(dt);
  }

  render() {
    const app = this.app;
    app.gameView.render({
      world: this.world,
      state: this.state,
      cam: this.camera,
      cfg: app.renderCfg,
      time: this.state.time,
      beat: this.beat,
      energy: 0.6,
      player: { pose: this.pose, p: this.state.player, view: this.playerView },
    });
  }
}
