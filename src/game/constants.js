// Gameplay constants. All distances are in blocks, all times in seconds.
// The simulation runs on a fixed tick so behaviour is identical at any frame rate.

export const TICK_RATE = 240;
export const DT = 1 / TICK_RATE;

/** Horizontal speeds (blocks per second) indexed 0..4. */
export const SPEEDS = [8.4, 10.4, 12.96, 15.6, 19.27];
export const SPEED_NAMES = ['Slow', 'Normal', 'Fast', 'Faster', 'Fastest'];
export const DEFAULT_SPEED = 1;

export const MODES = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider'];

/** Default corridor height (blocks) a mode portal creates. 0 = free roaming. */
export const MODE_CORRIDOR = { cube: 0, ship: 10, ball: 8, ufo: 10, wave: 10, robot: 0, spider: 8 };

/** Player hitbox edge length per mode at normal size. */
export const MODE_SIZE = { cube: 0.98, ship: 0.82, ball: 0.94, ufo: 0.9, wave: 0.36, robot: 0.98, spider: 0.94 };
export const MINI_SCALE = 0.6;

/** Fraction of the outer hitbox used for the solid-collision "crash" core. */
export const INNER_RATIO = 0.36;
/** How far (as fraction of size) a player may sink into a surface and still be snapped onto it. */
export const SNAP_RATIO = 0.3;

/** Whether a mode can slide along the underside of surfaces instead of crashing. */
export const MODE_CEILING = { cube: false, ship: true, ball: true, ufo: true, wave: true, robot: false, spider: true };

export const PHYS = {
  cube: { gravity: 97, maxFall: 30, jump: 20.6 },
  ship: { gravity: 54, lift: 70, maxUp: 12.5, maxDown: 14.5 },
  ball: { gravity: 74, maxFall: 26, flipPush: 5 },
  ufo: { gravity: 66, maxFall: 17, jump: 14.6 },
  wave: { slope: 1 },
  robot: { gravity: 97, maxFall: 30, jump: 12.4, holdTime: 0.21 },
  spider: { gravity: 96, maxFall: 30, teleportRange: 40, freeFlip: 32 },
};

/** Mini size physics adjustments. */
export const MINI = { jumpMul: 0.78, gravityMul: 1.0, shipLiftMul: 1.12, waveSlope: 2 };

/** Pad / orb launch velocities (cube scale), applied in gravity-local "up". */
export const PAD_VEL = { yellow: 27.6, pink: 18.4, red: 34.5, blue: 9 };
export const ORB_VEL = { yellow: 20.6, pink: 15.2, red: 28.4, blue: 7, green: 18.5, black: -30 };
/** Multiplier applied to pad/orb launches per mode. Wave ignores non-gravity launches. */
export const LAUNCH_MUL = { cube: 1, ship: 0.52, ball: 0.68, ufo: 0.72, wave: 0, robot: 0.92, spider: 0.72 };

/** Hard limits that kill the player if exceeded (fell out of the world). */
export const WORLD_TOP = 140;
export const WORLD_BOTTOM = -20;

/** Visual cube rotation speed in degrees per second while airborne. */
export const CUBE_SPIN = 430;
