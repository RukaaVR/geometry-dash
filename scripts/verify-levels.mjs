// Runs the autopilot on every built-in level and prints a report.
// Usage: npm run verify-levels
import { LEVEL_BUILDERS } from '../src/levels/index.js';
import { compileLevel, timeAtX } from '../src/game/sim/compile.js';
import { solveLevel, replay } from '../src/game/sim/solver.js';

for (const build of LEVEL_BUILDERS) {
  const level = build();
  const world = compileLevel(level);
  const t0 = performance.now();
  const r = solveLevel(world, { beam: 192, decision: 4, coins: true });
  const s = replay(world, r);
  console.log(
    `${level.name.padEnd(16)} ${level.difficulty.padEnd(8)} ${String(level.objects.length).padStart(4)} objects  ` +
      `${timeAtX(world.timeline, world.length).toFixed(1)}s  ` +
      `${r.success ? 'BEATABLE' : `STUCK at ${(r.progress * 100).toFixed(1)}%`}  coins ${s.coins.filter(Boolean).length}/3  ` +
      `(${(performance.now() - t0).toFixed(0)} ms)`,
  );
}
