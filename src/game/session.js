// A play session: one level being attempted (normal, practice or editor test).
// Drives the deterministic simulation from the music clock, applies timestamped
// input on the exact tick it occurred, and manages attempts, deaths, checkpoints
// and completion. Presentation is delegated to the PlayScene through callbacks.

import { compileLevel, timeAtX, levelStartConfig } from './sim/compile.js';
import { createState, cloneState, step, fastForwardTo, configAtX, configFromStartPos } from './sim/sim.js';
import { DT } from './constants.js';

const MAX_CATCHUP = 0.25; // seconds of simulation per frame before we resync

export class PlaySession {
  /**
   * @param level normalised level
   * @param opts {practice, startX, useStartPos, fromEditor, music, songOffset, onEvent(ev), clockOffset}
   */
  constructor(level, opts = {}) {
    this.level = level;
    this.opts = opts;
    this.world = compileLevel(level);
    this.practice = !!opts.practice;
    this.music = opts.music;
    this.onEvent = opts.onEvent || (() => {});
    this.base = this.buildBaseState();
    this.state = cloneState(this.base);
    this.checkpoints = [];
    this.attempt = 0;
    this.status = 'idle'; // idle | playing | dead | complete | paused
    this.pending = [];
    this.held = false;
    this.anchor = { music: 0, sim: 0 };
    this.simEvents = [];
    this.lastAutoCheckpoint = 0;
    this.stats = { jumps: 0, orbs: 0, practiceAttempts: 0, checkpointsPlaced: 0 };
    this.fromStart = this.base.player.x <= 0.01;
  }

  buildBaseState() {
    const w = this.world;
    let cfg = levelStartConfig(this.level);
    let startX = 0;
    if (this.opts.startX !== undefined && this.opts.startX > 0) {
      startX = this.opts.startX;
      cfg = configAtX(w, startX);
    } else if (this.opts.useStartPos && w.startPositions.length) {
      const sp = [...w.startPositions].sort((a, b) => b.x - a.x)[0];
      cfg = configFromStartPos(sp);
      startX = sp.x;
    }
    const s = createState(w, cfg);
    if (startX > 0) {
      fastForwardTo(w, s, startX);
      // simulated time is measured from the level start so triggers and music align
      s.time = timeAtX(w.timeline, startX);
      s.tick = Math.round(s.time / DT);
    }
    return s;
  }

  get songOffset() {
    return this.level.song.offset || 0;
  }

  /** Music position corresponding to a simulation time. */
  musicPosFor(simTime) {
    return this.songOffset + simTime + (this.opts.clockOffset || 0);
  }

  /** Begin a new attempt from the start or the latest checkpoint. */
  startAttempt({ fromCheckpoint = true } = {}) {
    const cp = this.practice && fromCheckpoint && this.checkpoints.length ? this.checkpoints[this.checkpoints.length - 1] : null;
    this.state = cloneState(cp ? cp.state : this.base);
    this.attempt++;
    if (this.practice) this.stats.practiceAttempts++;
    this.pending = [];
    this.held = false;
    this.status = 'playing';
    this.lastAutoCheckpoint = this.state.time;
    const musicPos = this.musicPosFor(this.state.time);
    this.anchor = { music: musicPos, sim: this.state.time };
    if (this.music) this.music.play(this.level.song.id, musicPos, { loop: false, wait: false });
    this.onEvent({ type: 'attempt', attempt: this.attempt, fromCheckpoint: !!cp });
  }

  /** Simulation time the clock says we should be at. */
  targetTime(now) {
    if (!this.music) return this.state.time;
    return this.anchor.sim + (this.music.position(now) - this.anchor.music);
  }

  pause() {
    if (this.status !== 'playing') return false;
    this.status = 'paused';
    this.music && this.music.pause();
    this.pending = [];
    return true;
  }

  resume() {
    if (this.status !== 'paused') return;
    this.status = 'playing';
    // Re-anchor so the clock continues exactly from the current simulation time.
    const pos = this.musicPosFor(this.state.time);
    this.anchor = { music: pos, sim: this.state.time };
    if (this.music) this.music.play(this.level.song.id, pos, { loop: false, wait: false });
  }

  /**
   * Advance the simulation up to the audio clock.
   * @param now     performance.now() of this frame
   * @param inputEvents [{down, t}] primary input edges with event timestamps
   * @returns interpolation alpha (0..1)
   */
  update(now, inputEvents) {
    if (this.status !== 'playing') {
      return 1;
    }
    let target = this.targetTime(now);
    if (target - this.state.time > MAX_CATCHUP) {
      // We fell far behind (debugger, tab switch, long GC): resync the clock rather
      // than fast-forwarding through a chunk of the level.
      this.anchor = { music: this.music ? this.music.position(now) : 0, sim: this.state.time };
      target = this.state.time;
    }
    for (const ev of inputEvents) {
      const simT = Math.max(this.state.time, target - (now - ev.t) / 1000);
      this.pending.push({ down: ev.down, t: simT });
    }
    let steps = 0;
    while (this.state.time + DT <= target + 1e-9) {
      const tickEnd = this.state.time + DT;
      let pressed = false;
      let heldDuring = this.held;
      while (this.pending.length && this.pending[0].t <= tickEnd) {
        const ev = this.pending.shift();
        if (ev.down) {
          pressed = true;
          heldDuring = true;
          this.held = true;
        } else this.held = false;
      }
      this.simEvents.length = 0;
      step(this.world, this.state, { held: heldDuring || this.held, pressed }, this.simEvents);
      steps++;
      for (const ev of this.simEvents) this.handleSimEvent(ev);
      if (this.state.dead || this.state.complete) break;
      if (this.practice && this.opts.autoCheckpoints) this.maybeAutoCheckpoint();
    }
    if (this.state.dead) {
      this.status = 'dead';
      this.music && this.music.stop(0.08);
      return 1;
    }
    if (this.state.complete) {
      this.status = 'complete';
      return 1;
    }
    // Render between the previous and current tick (one tick of visual latency).
    return Math.min(1, Math.max(0, (target - this.state.time) / DT));
  }

  handleSimEvent(ev) {
    if (ev.type === 'jump') this.stats.jumps++;
    if (ev.type === 'orb') this.stats.orbs++;
    this.onEvent(ev);
  }

  // ------------------------------------------------------------------ practice

  maybeAutoCheckpoint() {
    const p = this.state.player;
    const stable = p.onGround || p.mode === 'ship' || p.mode === 'ufo' || p.mode === 'wave';
    if (this.state.time - this.lastAutoCheckpoint >= 2.6 && stable && !this.state.dead) this.placeCheckpoint(true);
  }

  placeCheckpoint(auto = false) {
    if (!this.practice || this.status !== 'playing') return false;
    const s = cloneState(this.state);
    // The checkpoint resumes with no input held, like a fresh spawn.
    s.player.pressBuf = false;
    s.player.held = false;
    this.checkpoints.push({ state: s, x: s.player.x, y: s.player.y, auto });
    this.lastAutoCheckpoint = this.state.time;
    this.stats.checkpointsPlaced++;
    this.onEvent({ type: 'checkpoint', x: s.player.x, y: s.player.y, auto });
    return true;
  }

  removeCheckpoint() {
    if (!this.practice || !this.checkpoints.length) return false;
    const cp = this.checkpoints.pop();
    this.onEvent({ type: 'uncheckpoint', x: cp.x, y: cp.y });
    return true;
  }

  setPractice(on) {
    this.practice = on;
    if (!on) this.checkpoints = [];
  }

  get percent() {
    return this.state.progress * 100;
  }
}
