// Shared test helpers.
import { LevelBuilder } from '../src/levels/builder.js';
import { compileLevel } from '../src/game/sim/compile.js';

export function world(build, meta = {}) {
  const b = new LevelBuilder({ name: 'test', ...meta });
  build(b);
  return compileLevel(b.build());
}

/** Fake music clock driven by an explicit "now" (ms), like performance.now(). */
export class FakeMusic {
  constructor() {
    this.state = 'stopped';
    this.base = 0;
    this.start = 0;
    this.now = 0;
  }
  play(id, pos) {
    this.state = 'playing';
    this.base = pos;
    this.start = this.now;
  }
  stop() {
    this.state = 'stopped';
  }
  pause() {
    this.paused = this.position(this.now);
    this.state = 'paused';
  }
  position(now) {
    if (this.state === 'paused') return this.paused;
    return this.base + (now - this.start) / 1000;
  }
}
