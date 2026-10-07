// Progression: per-level stats, totals, coins, stars, achievements and cosmetics.

import { ACHIEVEMENTS } from './achievements.js';
import { COSMETICS, PALETTE, PALETTE_REQ, defaultLoadout, requirementMet } from './cosmetics.js';

const TOTAL_KEYS = ['attempts', 'jumps', 'deaths', 'playTime', 'orbs', 'checkpoints', 'practiceCompletions', 'levelsSaved', 'levelsVerified', 'completions'];

export function defaultProgress() {
  const totals = {};
  for (const k of TOTAL_KEYS) totals[k] = 0;
  return { levels: {}, totals, achievements: {}, loadout: defaultLoadout(), perfectRuns: 0, firstTryCompletions: 0, seen: {} };
}

function sanitizeLevelStats(raw) {
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return {
    attempts: Math.floor(n(raw.attempts)),
    best: Math.min(100, n(raw.best)),
    practiceBest: Math.min(100, n(raw.practiceBest)),
    completed: !!raw.completed,
    practiceCompleted: !!raw.practiceCompleted,
    coins: Array.isArray(raw.coins) ? [0, 1, 2].map((i) => !!raw.coins[i]) : [false, false, false],
    jumps: Math.floor(n(raw.jumps)),
    playTime: n(raw.playTime),
    completedAt: typeof raw.completedAt === 'number' ? raw.completedAt : 0,
  };
}

export function sanitizeProgress(raw) {
  const out = defaultProgress();
  if (!raw || typeof raw !== 'object') return out;
  if (raw.levels && typeof raw.levels === 'object') {
    for (const [id, st] of Object.entries(raw.levels)) if (st && typeof st === 'object') out.levels[id] = sanitizeLevelStats(st);
  }
  if (raw.totals && typeof raw.totals === 'object') {
    for (const k of TOTAL_KEYS) if (typeof raw.totals[k] === 'number' && Number.isFinite(raw.totals[k])) out.totals[k] = Math.max(0, raw.totals[k]);
  }
  if (raw.achievements && typeof raw.achievements === 'object') {
    for (const a of ACHIEVEMENTS) if (raw.achievements[a.id]) out.achievements[a.id] = Number(raw.achievements[a.id]) || Date.now();
  }
  if (raw.loadout && typeof raw.loadout === 'object') {
    for (const k of Object.keys(out.loadout)) {
      const v = raw.loadout[k];
      if (k === 'glow') out.loadout.glow = v !== false;
      else if (Number.isInteger(v) && v >= 0) out.loadout[k] = v;
    }
    out.loadout.primary = Math.min(out.loadout.primary, PALETTE.length - 1);
    out.loadout.secondary = Math.min(out.loadout.secondary, PALETTE.length - 1);
  }
  out.perfectRuns = Math.max(0, Number(raw.perfectRuns) || 0);
  out.firstTryCompletions = Math.max(0, Number(raw.firstTryCompletions) || 0);
  if (raw.seen && typeof raw.seen === 'object') out.seen = { ...raw.seen };
  return out;
}

export class Progress {
  constructor(storage, mainLevels) {
    this.storage = storage;
    this.mainLevels = mainLevels; // [{id, difficulty, stars, coinCount}]
    this.data = storage.load('progress', defaultProgress(), sanitizeProgress);
    this.listeners = new Set();
    this._dirty = false;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  save() {
    this.storage.save('progress', this.data);
    this._dirty = false;
  }

  /** Persist at most every few seconds for high-frequency stats. */
  saveSoon() {
    if (this._dirty) return;
    this._dirty = true;
    setTimeout(() => this._dirty && this.save(), 2500);
  }

  level(id) {
    if (!this.data.levels[id]) this.data.levels[id] = sanitizeLevelStats({});
    return this.data.levels[id];
  }

  isMain(id) {
    return this.mainLevels.some((l) => l.id === id);
  }

  // ------------------------------------------------------------ recording

  recordAttempt(id, practice) {
    const st = this.level(id);
    if (!practice) st.attempts++;
    this.data.totals.attempts++;
    this.saveSoon();
  }

  recordDeath(id) {
    this.data.totals.deaths++;
    this.saveSoon();
  }

  recordJumps(id, n) {
    if (!n) return;
    this.level(id).jumps += n;
    this.data.totals.jumps += n;
  }

  recordOrbs(n) {
    this.data.totals.orbs += n;
  }

  recordPlayTime(id, seconds) {
    if (!(seconds > 0)) return;
    this.level(id).playTime += seconds;
    this.data.totals.playTime += seconds;
  }

  recordCheckpoint() {
    this.data.totals.checkpoints++;
  }

  /** @returns {boolean} true if this is a new best */
  recordProgress(id, percent, practice) {
    const st = this.level(id);
    const key = practice ? 'practiceBest' : 'best';
    const p = Math.floor(percent);
    if (p > st[key]) {
      st[key] = p;
      this.saveSoon();
      return true;
    }
    return false;
  }

  /**
   * Level completed. Returns rewards: {firstCompletion, stars, newCoins}.
   */
  recordCompletion(id, { practice, coins, attemptsThisSession, levelStars }) {
    const st = this.level(id);
    const out = { firstCompletion: false, stars: 0, newCoins: 0 };
    if (practice) {
      st.practiceBest = 100;
      if (!st.practiceCompleted) this.data.totals.practiceCompletions++;
      st.practiceCompleted = true;
      this.save();
      this.emit();
      return out;
    }
    st.best = 100;
    this.data.totals.completions++;
    if (!st.completed) {
      st.completed = true;
      st.completedAt = Date.now();
      out.firstCompletion = true;
      out.stars = this.isMain(id) ? levelStars : 0;
      if (st.attempts <= 1) this.data.firstTryCompletions++;
    }
    coins.forEach((c, i) => {
      if (c && !st.coins[i]) {
        st.coins[i] = true;
        out.newCoins++;
      }
    });
    const levelCoinCount = this.mainLevels.find((l) => l.id === id)?.coinCount ?? 0;
    if (levelCoinCount > 0 && coins.slice(0, levelCoinCount).every(Boolean)) this.data.perfectRuns++;
    this.save();
    this.emit();
    return out;
  }

  recordLevelSaved() {
    this.data.totals.levelsSaved++;
    this.save();
  }

  recordLevelVerified() {
    this.data.totals.levelsVerified++;
    this.save();
  }

  emit() {
    for (const fn of this.listeners) fn(this);
  }

  // ------------------------------------------------------------ derived

  summary() {
    let stars = 0, coins = 0, starsTotal = 0, coinsTotal = 0, mainCompleted = 0;
    const difficulties = {};
    const completed = {};
    for (const l of this.mainLevels) {
      starsTotal += l.stars;
      coinsTotal += l.coinCount;
      const st = this.data.levels[l.id];
      if (!st) continue;
      coins += st.coins.slice(0, l.coinCount).filter(Boolean).length;
      if (st.completed) {
        stars += l.stars;
        mainCompleted++;
        difficulties[l.difficulty] = true;
        completed[l.id] = true;
      }
    }
    for (const [id, st] of Object.entries(this.data.levels)) if (st.completed) completed[id] = true;
    return {
      stars, coins, starsTotal, coinsTotal, mainCompleted, mainTotal: this.mainLevels.length,
      difficulties, completed,
      completions: this.data.totals.completions,
      totals: this.data.totals,
      achievements: this.data.achievements,
      perfectRuns: this.data.perfectRuns,
      firstTryCompletions: this.data.firstTryCompletions,
    };
  }

  /** Evaluate achievements; returns newly unlocked definitions. */
  checkAchievements() {
    const s = this.summary();
    const unlocked = [];
    for (const a of ACHIEVEMENTS) {
      if (this.data.achievements[a.id]) continue;
      let ok = false;
      try {
        ok = a.check(s);
      } catch (e) {
        ok = false;
      }
      if (ok) {
        this.data.achievements[a.id] = Date.now();
        unlocked.push(a);
        s.achievements = this.data.achievements;
      }
    }
    if (unlocked.length) this.save();
    return unlocked;
  }

  isCosmeticUnlocked(item) {
    return requirementMet(item.req, this.summary());
  }

  isColorUnlocked(index) {
    return requirementMet(PALETTE_REQ[index], this.summary());
  }

  /** Cosmetics that are unlocked now but were not unlocked before `prevSummary`. */
  newlyUnlockedCosmetics(prevSummary) {
    const now = this.summary();
    return COSMETICS.filter((c) => !requirementMet(c.req, prevSummary) && requirementMet(c.req, now));
  }

  get loadout() {
    return this.data.loadout;
  }

  setLoadout(key, value) {
    this.data.loadout[key] = value;
    this.save();
    this.emit();
  }

  /** Resolved colours and designs for rendering the player. */
  playerLook() {
    const l = this.data.loadout;
    return {
      primary: PALETTE[l.primary] || PALETTE[0],
      secondary: PALETTE[l.secondary] || PALETTE[1],
      designs: { cube: l.cube, ship: l.ship, ball: l.ball, ufo: l.ufo, wave: l.wave, robot: l.robot, spider: l.spider },
      trail: l.trail,
      death: l.death,
      glow: l.glow,
    };
  }

  resetAll() {
    this.data = defaultProgress();
    this.save();
    this.emit();
  }
}
