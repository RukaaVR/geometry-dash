// Procedurally generated endless-looking level used as the animated menu background.

import { LevelBuilder } from './builder.js';
import { makeRng } from '../core/math.js';

export function buildAttractLevel(seed = 7) {
  const rng = makeRng(seed);
  const b = new LevelBuilder({
    id: 'attract', name: 'Attract', author: 'Prism Pulse', difficulty: 'easy',
    song: { id: 'prism_menu' },
    settings: { background: 'grid', ground: 'tiles' },
    colors: { bg: '#2a1a6e', ground: '#24166b', line: '#ffffff', obj: '#ffffff', c1: '#8fb8ff' },
  });
  const hues = ['#2a1a6e', '#0f4a7a', '#5a1460', '#13305e', '#5e2a10', '#0e5a4a'];
  let x = 14;
  let k = 0;
  while (x < 260) {
    const r = rng();
    if (r < 0.28) {
      b.spikes(x, rng.int(1, 2));
      x += rng.int(6, 9);
    } else if (r < 0.45) {
      const w = rng.int(3, 6);
      b.block(x, 0, w, 1);
      if (rng() < 0.5) b.spike(x + w + 1);
      x += w + rng.int(5, 8);
    } else if (r < 0.58) {
      b.block(x, 0, 2, 1);
      b.block(x + 4, 0, 2, 2);
      x += rng.int(11, 13);
    } else if (r < 0.7) {
      b.pad(x, 0, 'yellow');
      b.spikes(x + 2, 3);
      x += 12;
    } else if (r < 0.82) {
      b.spikes(x, 3);
      b.orb(x + 1, 2, 'yellow');
      x += 10;
    } else {
      b.deco('deco_glow', x + 0.5, 4 + rng() * 3, { p: { pulse: true } });
      x += 4;
    }
    if (x / 40 > k) {
      k++;
      b.color(x, 'bg', hues[k % hues.length], 1.5);
      b.color(x, 'ground', hues[k % hues.length], 1.5);
    }
    if (rng() < 0.25) b.deco('deco_diamond', x - 2, 5 + rng() * 3, { z: -1, a: 0.6, p: { spin: 45 } });
  }
  b.add('trig_beat', 2, 12, { p: { enabled: true, division: 1, intensity: 0.5 } });
  return b.build();
}
