// Music manager: renders/caches songs, plays/pauses/seeks them, and exposes a smooth,
// monotonic playback position derived from the audio hardware clock. Gameplay uses
// this position as its master clock so obstacles stay locked to the music.

import { renderSongPCM, songDuration, songSections } from './synth.js';
import { getSong } from './songs.js';

const CACHE_LIMIT = 3;

export class MusicManager {
  constructor(engine) {
    this.engine = engine;
    this.cache = new Map(); // songId -> Promise<AudioBuffer|null>
    this.source = null;
    this.gain = null;
    this.songId = null;
    this.buffer = null;
    this.state = 'stopped'; // stopped | playing | paused
    this.loop = false;
    this.startCtx = 0; // context time at which position `startPos` was scheduled
    this.startPos = 0;
    this.pausedPos = 0;
    this.fallback = null; // {perf, pos} when audio is unavailable
    this.anchor = null;
    this.lastPos = 0;
  }

  /** Render (or fetch from cache) the buffer for a song. Resolves to null on failure. */
  load(songId) {
    const id = getSong(songId).id;
    if (this.cache.has(id)) {
      const p = this.cache.get(id);
      this.cache.delete(id); // LRU refresh
      this.cache.set(id, p);
      return p;
    }
    const song = getSong(id);
    const p = this.engine.available
      ? this._renderPCM(id, !!song.menuOnly)
          .then((pcm) => {
            const ctx = this.engine.ctx;
            const buf = ctx.createBuffer(2, pcm.left.length, pcm.sampleRate);
            buf.copyToChannel(pcm.left, 0);
            buf.copyToChannel(pcm.right, 1);
            return buf;
          })
          .catch((e) => {
            console.warn('Music render failed', e);
            this.cache.delete(id);
            return null;
          })
      : Promise.resolve(null);
    this.cache.set(id, p);
    while (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest === this.songId) break;
      this.cache.delete(oldest);
    }
    return p;
  }

  /** Render PCM in a worker when possible, otherwise on the main thread. */
  _renderPCM(songId, loop) {
    const sampleRate = this.engine.sampleRate;
    if (!this.worker && typeof Worker !== 'undefined' && this.worker !== false) {
      try {
        this.worker = new Worker(new URL('./synthWorker.js', import.meta.url), { type: 'module' });
        this.jobs = new Map();
        this.jobId = 0;
        this.worker.onmessage = (e) => {
          const job = this.jobs.get(e.data.id);
          if (!job) return;
          this.jobs.delete(e.data.id);
          if (e.data.ok) job.resolve(e.data);
          else job.reject(new Error(e.data.error));
        };
        this.worker.onerror = (e) => {
          // Module workers unsupported: fall back to rendering on the main thread.
          e.preventDefault && e.preventDefault();
          for (const job of this.jobs.values()) job.fallback();
          this.jobs.clear();
          this.worker = false;
        };
      } catch (e) {
        this.worker = false;
      }
    }
    const mainThread = () =>
      new Promise((resolve, reject) => setTimeout(() => {
        try {
          resolve(renderSongPCM(getSong(songId), { sampleRate, loop }));
        } catch (err) {
          reject(err);
        }
      }, 0));
    if (!this.worker) return mainThread();
    return new Promise((resolve, reject) => {
      const id = ++this.jobId;
      this.jobs.set(id, { resolve, reject, fallback: () => mainThread().then(resolve, reject) });
      this.worker.postMessage({ id, songId, sampleRate, loop });
    });
  }

  isLoaded(songId) {
    return this.cache.has(getSong(songId).id);
  }

  songInfo(songId) {
    const s = getSong(songId);
    return { ...s, duration: songDuration(s), sectionTimes: songSections(s) };
  }

  _stopSource(fade = 0) {
    if (!this.source) return;
    const src = this.source, g = this.gain;
    this.source = null;
    this.gain = null;
    try {
      if (fade > 0 && this.engine.ctx) {
        const t = this.engine.ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + fade);
        src.stop(t + fade + 0.02);
      } else src.stop();
    } catch (e) {
      /* already stopped */
    }
    setTimeout(() => {
      try {
        src.disconnect();
        g.disconnect();
      } catch (e) {
        /* ignore */
      }
    }, (fade + 0.2) * 1000);
  }

  /**
   * Start playing `songId` from `position` seconds. If the buffer is not ready yet
   * the clock still runs (silently) so gameplay is never blocked by audio.
   */
  async play(songId, position = 0, { loop = false, fadeIn = 0, wait = true } = {}) {
    const id = getSong(songId).id;
    const bufP = this.load(id);
    const buffer = wait ? await bufP : null;
    this._stopSource(0.03);
    this.songId = id;
    this.buffer = buffer;
    this.loop = loop;
    this.state = 'playing';
    this.anchor = null;
    this.lastPos = position;
    const ctx = this.engine.ctx;
    if (buffer && ctx && this.engine.running) {
      this.fallback = null;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = loop;
      const g = ctx.createGain();
      src.connect(g);
      g.connect(this.engine.musicBus);
      const when = ctx.currentTime + 0.02;
      if (fadeIn > 0) {
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(1, when + fadeIn);
      }
      let pos = position;
      if (loop) pos = ((pos % buffer.duration) + buffer.duration) % buffer.duration;
      if (pos < 0) {
        src.start(when - pos, 0);
      } else if (pos < buffer.duration) src.start(when, pos);
      this.source = src;
      this.gain = g;
      this.startCtx = when;
      this.startPos = position;
    } else {
      this.fallback = { perf: performance.now(), pos: position };
    }
    if (!wait) {
      // Swap in the real audio once it is ready, keeping the clock continuous.
      bufP.then((b) => {
        if (b && this.songId === id && this.state === 'playing' && !this.source && this.fallback) {
          const pos = this.position(performance.now());
          this.play(id, pos, { loop, wait: true });
        }
      });
    }
  }

  stop(fade = 0) {
    this._stopSource(fade);
    this.state = 'stopped';
    this.fallback = null;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.pausedPos = this.position(performance.now());
    this._stopSource(0.04);
    this.state = 'paused';
  }

  resume() {
    if (this.state !== 'paused') return;
    this.play(this.songId, this.pausedPos, { loop: this.loop });
  }

  seek(position) {
    if (!this.songId) return;
    this.play(this.songId, position, { loop: this.loop });
  }

  /** Raw (unsmoothed) audible playback position. */
  rawPosition(perfNow) {
    if (this.state === 'paused') return this.pausedPos;
    if (this.state !== 'playing') return this.lastPos;
    if (this.fallback) return this.fallback.pos + (perfNow - this.fallback.perf) / 1000;
    const heard = this.engine.audibleTimeAt(perfNow);
    return this.startPos + (heard - this.startCtx);
  }

  /**
   * Smoothed, monotonic playback position in seconds. The audio clock advances in
   * coarse render quanta on some browsers; we extrapolate with performance.now() and
   * gently slew toward the hardware position, snapping only on large drift.
   */
  position(perfNow) {
    const raw = this.rawPosition(perfNow);
    if (this.state !== 'playing' || this.fallback) {
      this.lastPos = raw;
      return raw;
    }
    if (!this.anchor) {
      this.anchor = { perf: perfNow, pos: raw };
      this.lastPos = raw;
      return raw;
    }
    const predicted = this.anchor.pos + (perfNow - this.anchor.perf) / 1000;
    const drift = raw - predicted;
    if (Math.abs(drift) > 0.05) {
      this.anchor = { perf: perfNow, pos: raw };
    } else {
      this.anchor = { perf: perfNow, pos: predicted + drift * 0.08 };
    }
    let pos = this.anchor.pos;
    if (pos < this.lastPos && this.lastPos - pos < 0.05) pos = this.lastPos; // monotonic
    this.lastPos = pos;
    return pos;
  }

  get duration() {
    return this.buffer ? this.buffer.duration : this.songId ? songDuration(getSong(this.songId)) : 0;
  }

  /** Beat information at the current position: {beat (float), bpm}. */
  beatAt(position, songId = this.songId) {
    const s = getSong(songId);
    return { beat: (position * s.bpm) / 60, bpm: s.bpm };
  }
}
