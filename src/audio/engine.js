// Web Audio graph: master -> limiter -> destination, with separate music and sfx buses.
// Degrades gracefully to a silent no-op engine when Web Audio is unavailable.

export class AudioEngine {
  constructor() {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    this.available = !!Ctx;
    this.ctx = null;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx({ latencyHint: 'interactive' });
    } catch (e) {
      this.available = false;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    // Music filter used for the pause/menu muffled effect.
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 22000;
    this.musicBus.connect(this.musicFilter);
    this.musicFilter.connect(this.master);
    this.sfxBus.connect(this.master);
  }

  get sampleRate() {
    return this.ctx ? this.ctx.sampleRate : 44100;
  }

  /** Must be called from a user gesture on browsers with autoplay restrictions. */
  async unlock() {
    if (!this.ctx) return false;
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch (e) {
        return false;
      }
    }
    return this.ctx.state === 'running';
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setVolumes({ master, music, sfx }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // perceptual curve
    const curve = (v) => v * v;
    this.master.gain.setTargetAtTime(curve(master), t, 0.02);
    this.musicBus.gain.setTargetAtTime(curve(music), t, 0.02);
    this.sfxBus.gain.setTargetAtTime(curve(sfx), t, 0.02);
  }

  setMuffled(on) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 900 : 22000, this.ctx.currentTime, 0.08);
  }

  /** Output latency estimate in seconds (time from scheduling to hearing). */
  get latency() {
    if (!this.ctx) return 0;
    return (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
  }

  /**
   * The context time that is audible at the given performance.now() timestamp.
   * Uses the browser's output timestamp mapping when available (accounts for output
   * latency with sub-quantum precision), otherwise currentTime minus reported latency.
   */
  audibleTimeAt(perfNow) {
    const ctx = this.ctx;
    if (!ctx) return perfNow / 1000;
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.performanceTime > 0 && Number.isFinite(ts.contextTime) && ts.contextTime > 0) {
        const t = ts.contextTime + (perfNow - ts.performanceTime) / 1000;
        // Guard against stale timestamps (some browsers stop updating while idle).
        if (Math.abs(t - (ctx.currentTime - this.latency)) < 0.25) return t;
      }
    }
    return ctx.currentTime - this.latency;
  }
}
