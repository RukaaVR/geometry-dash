// Runs the beam-search autopilot on a level off the main thread to check that the
// level can be completed (and report how far it gets if not).
import { compileLevel } from '../game/sim/compile.js';
import { solveLevel } from '../game/sim/solver.js';
import { normalizeLevel } from '../game/level/format.js';

self.onmessage = (e) => {
  const { id, level } = e.data;
  try {
    const world = compileLevel(normalizeLevel(level).level);
    const r = solveLevel(world, { beam: 96, decision: 4, maxTime: 900 });
    self.postMessage({ id, ok: true, success: r.success, progress: r.progress, x: r.progress * world.length });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
