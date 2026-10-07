// Gameplay scene: runs a PlaySession and presents it (rendering, audio feedback,
// HUD, pause/complete menus, practice checkpoints, editor test mode).

import { PlaySession } from '../game/session.js';
import { GameCamera } from '../render/camera.js';
import { PlayerView, eventParticles } from '../render/playerView.js';
import { Hud, pauseScreen, completeScreen, loadingOverlay } from '../ui/screens/game.js';
import { settingsScreen } from '../ui/screens/settings.js';
import { getSong } from '../audio/songs.js';
import { songSections } from '../audio/synth.js';
import { SPEED_NAMES, DT } from '../game/constants.js';
import { SHAPES } from '../render/particles.js';
import { hexToRgb } from '../core/math.js';
import { LevelError } from '../game/level/format.js';

const WHITE = { r: 255, g: 255, b: 255 };

export class PlayScene {
  /**
   * @param entry {level, source: 'main'|'custom'|'editor'}
   * @param opts {practice, fromEditor, startX, useStartPos, onExit}
   */
  constructor(app, entry, opts = {}) {
    this.app = app;
    this.entry = entry;
    this.level = entry.level;
    this.opts = opts;
    this.camera = new GameCamera();
    this.playerView = new PlayerView(app.renderer, app.particles);
    this.pose = { x: 0, y: 0, rot: 0 };
    this.deathTimer = 0;
    this.completeTimer = 0;
    this.loading = true;
    this.paused = false;
    this.sessionTime = 0;
    this.attemptStartX = 0;
    this.lastBeatIndex = -1;
    this.beatPulse = 0;
    this.energy = 0.5;
    this.checkpointMarks = [];
    this.newBestShown = false;
  }

  get levelId() {
    return this.level.id;
  }

  enter() {
    const app = this.app;
    app.ui.clear();
    this.hud = new Hud(app.uiRoot);
    this.hud.onPause = () => this.pause();
    this.hud.onCheckpoint = () => this.session && this.session.placeCheckpoint();
    this.hud.onRemoveCheckpoint = () => this.session && this.session.removeCheckpoint();
    this.playerView.setLook(app.progress.playerLook());
    try {
      this.createSession(!!this.opts.practice);
    } catch (e) {
      const msg = e instanceof LevelError ? e.message : 'This level could not be loaded.';
      console.error(e);
      app.ui.alert('Level error', msg).then(() => this.leave());
      return;
    }
    this.song = getSong(this.level.song.id);
    this.sections = songSections(this.song);
    this.loadingEl = loadingOverlay('Loading music…');
    if (!app.music.isLoaded(this.song.id)) app.uiRoot.appendChild(this.loadingEl);
    app.music.stop(0.15);
    app.audio.setMuffled(false);
    const ready = app.music.load(this.song.id);
    Promise.race([ready, new Promise((r) => setTimeout(r, 15000))]).then(() => {
      this.loadingEl.remove();
      if (this.app.scene !== this) return;
      this.loading = false;
      this.hud.show(true);
      app.input.setGameplay(true);
      this.restart(false);
    });
  }

  createSession(practice) {
    const app = this.app;
    this.session = new PlaySession(this.level, {
      practice,
      startX: this.opts.startX,
      useStartPos: this.opts.useStartPos,
      fromEditor: this.opts.fromEditor,
      music: app.music,
      autoCheckpoints: app.settings.gameplay.autoCheckpoints,
      clockOffset: app.settings.audio.offsetMs / 1000,
      onEvent: (ev) => this.onSimEvent(ev),
    });
    this.checkpointMarks = [];
    this.hud.configure({
      practice,
      showProgress: app.settings.gameplay.showProgress,
      showPercent: app.settings.gameplay.showPercent,
      editor: !!this.opts.fromEditor,
      coinCount: this.session.world.coinCount,
    });
  }

  exit() {
    this.app.input.setGameplay(false);
    this.hud && this.hud.destroy();
    this.loadingEl && this.loadingEl.remove();
    this.app.particles.clear();
    this.flushStats();
  }

  flushStats() {
    const s = this.session;
    if (!s) return;
    const prog = this.app.progress;
    prog.recordJumps(this.levelId, s.stats.jumps);
    prog.recordOrbs(s.stats.orbs);
    s.stats.jumps = 0;
    s.stats.orbs = 0;
    prog.recordPlayTime(this.levelId, this.sessionTime);
    this.sessionTime = 0;
    prog.saveSoon();
  }

  get recordsProgress() {
    return this.entry.source !== 'editor';
  }

  // ------------------------------------------------------------------ attempts

  restart(fromCheckpoint = true) {
    const s = this.session;
    this.deathTimer = 0;
    this.completeTimer = 0;
    this.newBestShown = false;
    this.app.particles.clear();
    this.playerView.reset();
    this.app.input.clear();
    s.startAttempt({ fromCheckpoint });
    this.attemptStartX = s.state.player.x;
    const half = this.app.renderer.viewHalf(1);
    this.camera.snap(s.state.player, half);
    this.updatePose(1);
    this.hud.setCoins(s.state.coins);
    if (this.recordsProgress) {
      this.app.progress.recordAttempt(this.levelId, s.practice);
      if (this.app.progress.data.totals.attempts % 10 === 0) this.app.checkAchievements();
    }
  }

  pause() {
    if (this.loading || this.paused || !this.session) return;
    if (this.session.status === 'complete') return;
    if (this.opts.fromEditor) {
      this.leave();
      return;
    }
    const wasPlaying = this.session.pause();
    if (!wasPlaying && this.session.status !== 'dead') return;
    this.paused = true;
    this.app.input.setGameplay(false);
    this.app.audio.setMuffled(true);
    this.hud.show(false);
    const st = this.app.progress.level(this.levelId);
    this.app.ui.overlay(pauseScreen(this.app, {
      level: this.level,
      subtitle: this.session.practice ? 'Practice mode' : `${this.level.author}`,
      stats: this.recordsProgress ? st : null,
      practice: this.session.practice,
      practiceStats: this.session.practice ? { checkpoints: this.session.stats.checkpointsPlaced, attempts: this.session.stats.practiceAttempts } : null,
      attempt: this.session.attempt,
      jumps: this.session.stats.jumps,
      time: this.sessionTime,
      fromEditor: this.opts.fromEditor,
      onResume: () => this.resume(),
      onRestart: () => {
        this.closePause();
        if (this.session.practice) this.session.checkpoints = [];
        this.checkpointMarks = [];
        this.restart(false);
      },
      onTogglePractice: () => {
        this.closePause();
        this.createSession(!this.session.practice);
        this.restart(false);
      },
      onSettings: () => this.app.ui.push(settingsScreen(this.app, () => this.app.ui.pop(), { inGame: true })),
      onExit: () => this.leave(),
    }));
  }

  closePause() {
    if (!this.paused) return;
    this.paused = false;
    while (this.app.ui.stack.length) this.app.ui.pop();
    this.app.audio.setMuffled(false);
    this.app.input.setGameplay(true);
    this.hud.show(true);
  }

  resume() {
    this.closePause();
    if (this.session.status === 'paused') {
      this.session.resume();
      this.app.input.clear();
    }
  }

  leave() {
    this.app.music.stop(0.2);
    this.app.audio.setMuffled(false);
    this.flushStats();
    if (this.opts.onExit) this.opts.onExit(this);
  }

  // ------------------------------------------------------------------ events

  onSimEvent(ev) {
    const app = this.app;
    const cfg = app.renderCfg;
    const p = this.session.state.player;
    if (cfg.particles) eventParticles(app.particles, ev, null, p);
    switch (ev.type) {
      case 'death': {
        app.sfx.play('death');
        this.playerView.death(ev.x, ev.y, p, cfg);
        if (cfg.shake) this.camera.addShake(0.35);
        if (cfg.effects) app.gameView.flash(WHITE, 0.25, 0.25);
        this.deathTimer = 0;
        if (this.recordsProgress) {
          app.progress.recordDeath(this.levelId);
          const pct = this.session.percent;
          const isNewBest = app.progress.recordProgress(this.levelId, pct, this.session.practice);
          if (isNewBest && pct >= 1 && !this.session.practice) {
            this.hud.showNewBest(pct);
            app.sfx.play('newbest', { volume: 0.7 });
          }
        }
        break;
      }
      case 'orb':
        app.sfx.play('orb', { volume: 0.6 });
        break;
      case 'pad':
        app.sfx.play('pad', { volume: 0.55 });
        break;
      case 'portal':
        if (ev.action === 'gravity') app.sfx.play('gravity', { volume: 0.6 });
        else if (ev.action === 'speed') app.sfx.play('speed', { volume: 0.6 });
        else if (ev.changed !== false) app.sfx.play('portal', { volume: 0.55 });
        if (cfg.effects && ev.action === 'mode' && ev.changed) app.gameView.flash(hexToRgb(ev.tint || '#ffffff'), 0.12, 0.25);
        break;
      case 'coin':
        app.sfx.play('coin');
        this.hud.setCoins(this.session.state.coins);
        break;
      case 'teleport':
        app.sfx.play('teleport', { volume: 0.5 });
        break;
      case 'crumble':
        app.sfx.play('crumble', { volume: 0.5 });
        break;
      case 'checkpoint':
        app.sfx.play('checkpoint', { volume: ev.auto ? 0.35 : 0.7 });
        this.checkpointMarks.push({ x: ev.x, y: ev.y });
        if (this.recordsProgress) app.progress.recordCheckpoint();
        break;
      case 'uncheckpoint':
        app.sfx.play('uncheckpoint', { volume: 0.6 });
        this.checkpointMarks.pop();
        break;
      case 'complete':
        this.onComplete();
        break;
      case 'mode':
        app.sfx.play('portal', { volume: 0.4 });
        break;
      default:
        break;
    }
  }

  onComplete() {
    const app = this.app;
    const s = this.session;
    app.sfx.play('complete');
    const x = s.state.player.x, y = s.state.player.y;
    if (app.renderCfg.effects) app.gameView.flash(WHITE, 0.5, 0.6);
    const cols = [hexToRgb(app.progress.playerLook().primary), hexToRgb(app.progress.playerLook().secondary), WHITE];
    app.particles.emit(1, { x, y, speed: 0, life: 0.9, size: 0.5, sizeEnd: 8, color: WHITE, shape: SHAPES.ring });
    app.particles.emit(120, { x, y, speed: [4, 20], life: [0.6, 1.4], size: [0.1, 0.25], color: cols, shape: SHAPES.spark, drag: 1.2 });
    this.playerView.hidden = true;
    app.music.stop(2.5);
    this.completeTimer = 0;
  }

  showComplete() {
    const app = this.app;
    const s = this.session;
    let reward = null;
    let verified = false;
    const before = app.progress.summary();
    if (this.recordsProgress) {
      reward = app.progress.recordCompletion(this.levelId, {
        practice: s.practice, coins: s.state.coins, levelStars: this.level.stars,
      });
    }
    if (this.opts.fromEditor && !s.practice && s.fromStart && this.opts.onVerified) {
      verified = true;
      this.opts.onVerified();
    }
    this.flushStats();
    app.checkAchievements(before);
    this.hud.show(false);
    app.input.setGameplay(false);
    app.ui.overlay(completeScreen(app, {
      level: this.level,
      practice: s.practice,
      attempts: this.recordsProgress && !s.practice ? app.progress.level(this.levelId).attempts : s.attempt,
      jumps: app.progress.level(this.levelId).jumps,
      time: app.progress.level(this.levelId).playTime,
      coinCount: s.world.coinCount,
      coins: s.state.coins,
      reward,
      verified,
      fromEditor: this.opts.fromEditor,
      onReplay: () => {
        while (app.ui.stack.length) app.ui.pop();
        this.hud.show(true);
        app.input.setGameplay(true);
        this.checkpointMarks = [];
        if (s.practice) s.checkpoints = [];
        this.restart(false);
      },
      onExit: () => this.leave(),
    }));
  }

  // ------------------------------------------------------------------ loop

  onKey(code) {
    if (this.loading) return code === 'Escape';
    if (this.paused || this.app.ui.stack.length) {
      if (code === 'Escape' || code === 'KeyP') {
        if (this.app.ui.stack.length > 1) this.app.ui.pop();
        else if (this.paused) this.resume();
        else if (this.app.ui.top && this.app.ui.top.onBack) this.app.ui.top.onBack();
        return true;
      }
      if (code.startsWith('Arrow')) return this.app.ui.nav(code.slice(5).toLowerCase());
      return false;
    }
    switch (code) {
      case 'Escape':
      case 'KeyP':
        this.pause();
        return true;
      case 'KeyR':
        if (this.session.status === 'complete') return true;
        this.restart(true);
        return true;
      case 'KeyZ':
        this.session.placeCheckpoint();
        return true;
      case 'KeyX':
        this.session.removeCheckpoint();
        return true;
      default:
        return false;
    }
  }

  onPad(n) {
    if (n === 'pause') {
      if (this.paused) this.resume();
      else this.pause();
      return true;
    }
    return false;
  }

  onHidden() {
    if (!this.paused && this.session && this.session.status === 'playing') this.pause();
  }

  updatePose(alpha) {
    const p = this.session.state.player;
    this.pose.x = p.px + (p.x - p.px) * alpha;
    this.pose.y = p.py + (p.y - p.py) * alpha;
    this.pose.rot = p.prot + (p.rot - p.prot) * alpha;
  }

  update(dt, now) {
    if (this.loading || !this.session) return;
    const app = this.app;
    const s = this.session;
    const cfg = app.renderCfg;
    let alpha = 1;
    if (!this.paused) {
      const events = app.input.drain();
      if (s.status === 'playing') {
        alpha = s.update(now, events);
        this.sessionTime += dt;
      } else if (s.status === 'dead') {
        this.deathTimer += dt;
        const wantsRetry = !app.settings.gameplay.holdToRetry || events.some((e) => e.down);
        if (this.deathTimer >= app.settings.gameplay.respawnDelay && wantsRetry) this.restart(true);
      } else if (s.status === 'complete') {
        this.completeTimer += dt;
        if (this.completeTimer > 1.3 && this.completeTimer - dt <= 1.3) this.showComplete();
      }
      app.particles.update(dt);
      app.gameView.update(dt);
    }
    if (s.status === 'playing' || s.status === 'paused') this.updatePose(alpha);

    // music-driven visuals
    const musicPos = app.music.position(now);
    const beatF = (musicPos * this.song.bpm) / 60;
    const div = s.state.beat.on ? s.state.beat.div : 1;
    const bIdx = Math.floor(beatF / div);
    const phase = beatF / div - bIdx;
    const beatHit = bIdx !== this.lastBeatIndex;
    this.lastBeatIndex = bIdx;
    const intensity = s.state.beat.on ? s.state.beat.i : 0.35;
    this.beatPulse = s.status === 'playing' ? Math.exp(-phase * 5) * intensity : this.beatPulse * 0.9;
    const sec = this.sections.find((x) => musicPos >= x.start && musicPos < x.end);
    const targetEnergy = sec ? sec.energy : 0.4;
    this.energy += (targetEnergy - this.energy) * Math.min(1, dt * 2);

    const half = app.renderer.viewHalf(1);
    const sh = s.state.shake;
    const shake = sh && s.state.time - sh.t0 < sh.dur ? sh.s * (1 - (s.state.time - sh.t0) / sh.dur) : 0;
    if (!this.paused) {
      this.camera.update(dt, this.pose, s.state.player, half, s.state.cam, shake, cfg);
      this.playerView.update(dt, this.pose, s.state.player, cfg, beatHit && s.status === 'playing');
    }
    this.hud.setProgress(s.state.progress);
    if (this.opts.fromEditor) {
      const p = s.state.player;
      this.hud.setEditorInfo(`x ${p.x.toFixed(1)}  y ${p.y.toFixed(1)}  t ${s.state.time.toFixed(2)}s  ${p.mode}${p.mini ? ' mini' : ''}  ${SPEED_NAMES[p.speed]}  grav ${p.grav > 0 ? '↓' : '↑'}  · Esc to return`);
    }
    if (app.debug.enabled) {
      const p = s.state.player;
      app.debug.set('pos', `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`);
      app.debug.set('vel', `vy ${p.vy.toFixed(2)}`);
      app.debug.set('mode', `${p.mode}${p.mini ? ' (mini)' : ''} grav ${p.grav} speed ${SPEED_NAMES[p.speed]} ground ${p.onGround}`);
      app.debug.set('music', `${musicPos.toFixed(3)}s  sim ${s.state.time.toFixed(3)}s  drift ${((musicPos - s.songOffset - (app.settings.audio.offsetMs / 1000)) - s.state.time).toFixed(4)}s`);
      app.debug.set('bpm', `${this.song.bpm} beat ${beatF.toFixed(2)}`);
      app.debug.set('triggers', `tweens ${s.state.tweens.length} pending ${s.state.pending.length} next ${s.state.trigCursor}/${s.world.posTriggers.length}`);
      app.debug.set('objects', `${s.world.objects.length} total`);
    }
  }

  render(now) {
    if (!this.session) return;
    const app = this.app;
    const s = this.session;
    const st = this.recordsProgress ? app.progress.level(this.levelId) : null;
    app.gameView.render({
      world: s.world,
      state: s.state,
      cam: this.camera,
      cfg: app.renderCfg,
      time: s.state.time,
      beat: this.beatPulse,
      energy: this.energy,
      player: { pose: this.pose, p: s.state.player, view: this.playerView },
      collectedCoins: st ? st.coins : null,
      debug: app.debug.enabled,
      editorOverlay: (ctx) => this.drawWorldOverlay(ctx),
    });
  }

  drawWorldOverlay(ctx) {
    // "Attempt N" text placed in the world near the start of the attempt
    const s = this.session;
    if (this.app.settings.gameplay.showAttempts && s.attempt > 0) {
      ctx.save();
      ctx.translate(this.attemptStartX + 8, this.camera.groundY + 5.2);
      ctx.scale(0.02, -0.02);
      ctx.font = '700 64px "Russo One", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 8;
      const label = s.practice ? `Practice · Attempt ${s.attempt}` : `Attempt ${s.attempt}`;
      ctx.strokeText(label, 0, 0);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    // practice checkpoints
    for (const m of this.checkpointMarks) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = 'rgba(77,255,122,0.9)';
      ctx.strokeStyle = '#0a2a12';
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      ctx.moveTo(0, 0.45);
      ctx.lineTo(0.3, 0);
      ctx.lineTo(0, -0.45);
      ctx.lineTo(-0.3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

export { DT };
