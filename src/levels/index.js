// Built-in level list, in progression order. Levels are generated from code with the
// LevelBuilder but are ordinary level data (they can be opened in the editor).
import { buildLevel1 } from './level1.js';
import { buildLevel2 } from './level2.js';
import { buildLevel3 } from './level3.js';
import { buildLevel4 } from './level4.js';
import { buildLevel5 } from './level5.js';
import { buildLevel6 } from './level6.js';

export const LEVEL_BUILDERS = [buildLevel1, buildLevel2, buildLevel3, buildLevel4, buildLevel5, buildLevel6];

export const MAIN_LEVELS = LEVEL_BUILDERS.map((fn) => fn());
