// Cosmetic catalogue and unlock rules. Designs are drawn procedurally by the icon
// renderer (src/render/icons.js) using the design index.

export const ICON_KINDS = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'];

const FREE = { free: true };
const designs = (kind, names, reqs) => names.map((name, i) => ({ id: `${kind}:${i}`, kind, index: i, name, req: reqs[i] || FREE }));

export const COSMETICS = [
  ...designs('cube', ['Core', 'Visor', 'Split', 'Target', 'Bolt', 'Grin', 'Diamond', 'Circuit', 'Crown', 'Void'], [
    FREE, FREE, { stars: 5 }, { stars: 10 }, { coins: 3 }, { achievement: 'attempts_100' }, { stars: 20 }, { coins: 8 }, { stars: 36 }, { achievement: 'complete_extreme' },
  ]),
  ...designs('ship', ['Glider', 'Dart', 'Manta', 'Rocket', 'Phantom', 'Comet'], [
    FREE, { stars: 3 }, { stars: 12 }, { coins: 5 }, { achievement: 'complete_insane' }, { stars: 30 },
  ]),
  ...designs('ball', ['Orbit', 'Gear', 'Eclipse', 'Spiral', 'Nova'], [FREE, { stars: 5 }, { coins: 4 }, { stars: 18 }, { achievement: 'perfect' }]),
  ...designs('ufo', ['Saucer', 'Halo', 'Beacon', 'Crown', 'Prism'], [FREE, { stars: 7 }, { coins: 6 }, { stars: 24 }, { achievement: 'practice_50' }]),
  ...designs('wave', ['Arrow', 'Fang', 'Comet', 'Blade', 'Shard'], [FREE, { stars: 8 }, { coins: 7 }, { stars: 26 }, { achievement: 'complete_harder' }]),
  ...designs('robot', ['Walker', 'Sentinel', 'Mech', 'Titan'], [FREE, { stars: 10 }, { coins: 9 }, { achievement: 'jumps_5000' }]),
  ...designs('spider', ['Crawler', 'Widow', 'Strider', 'Arachnon'], [FREE, { stars: 14 }, { coins: 10 }, { achievement: 'complete_all' }]),
  ...designs('trail', ['Streak', 'Sparkle', 'Ribbon', 'Pixel', 'Pulse', 'None'], [FREE, { stars: 4 }, { coins: 2 }, { stars: 16 }, { achievement: 'first_complete' }, FREE]),
  ...designs('death', ['Shatter', 'Shockwave', 'Pixel Burst', 'Implode', 'Supernova'], [FREE, { stars: 6 }, { coins: 3 }, { achievement: 'deaths_1000' }, { stars: 40 }]),
];

export const PALETTE = [
  '#4dff7a', '#38c8ff', '#ffd23f', '#ff5fd2', '#ffffff', '#ff8a3d', '#a46bff', '#ff3b3b',
  '#00ffd0', '#7fb8ff', '#ffe08a', '#b6ff3b', '#ff9bd2', '#3b5bff', '#202030', '#8a8aa0',
  '#00a86b', '#c0ff00', '#ff006e', '#8338ec', '#fb5607', '#3a86ff', '#e9c46a', '#06d6a0',
];
/** Palette index -> unlock requirement (unlisted = free). */
export const PALETTE_REQ = {
  8: { stars: 4 }, 9: { stars: 6 }, 10: { stars: 8 }, 11: { coins: 2 }, 12: { stars: 12 }, 13: { coins: 4 }, 14: { stars: 15 }, 15: { stars: 15 },
  16: { coins: 6 }, 17: { stars: 20 }, 18: { stars: 25 }, 19: { coins: 9 }, 20: { stars: 30 }, 21: { achievement: 'checkpoints_100' },
  22: { coins: 12 }, 23: { stars: 36 },
};

export function defaultLoadout() {
  return {
    cube: 0, ship: 0, ball: 0, ufo: 0, wave: 0, robot: 0, spider: 0, trail: 0, death: 0,
    primary: 0, secondary: 1, glow: true,
  };
}

export function requirementMet(req, summary) {
  if (!req || req.free) return true;
  if (req.stars !== undefined && summary.stars < req.stars) return false;
  if (req.coins !== undefined && summary.coins < req.coins) return false;
  if (req.achievement && !summary.achievements[req.achievement]) return false;
  if (req.level && !summary.completed[req.level]) return false;
  return true;
}

export function describeRequirement(req) {
  if (!req || req.free) return 'Unlocked';
  if (req.stars !== undefined) return `Collect ${req.stars} stars`;
  if (req.coins !== undefined) return `Collect ${req.coins} secret coins`;
  if (req.achievement) return 'Achievement reward';
  if (req.level) return 'Complete a specific level';
  return 'Locked';
}

export function cosmeticsOfKind(kind) {
  return COSMETICS.filter((c) => c.kind === kind);
}
