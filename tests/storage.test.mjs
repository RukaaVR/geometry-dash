import test from 'node:test';
import assert from 'node:assert/strict';
import { Storage } from '../src/save/storage.js';
import { defaultSettings, sanitizeSettings } from '../src/save/settings.js';
import { Progress, defaultProgress, sanitizeProgress } from '../src/save/progress.js';

class Mem {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}

test('save and load round-trip', () => {
  const st = new Storage(new Mem());
  st.save('x', { a: 1 });
  assert.deepEqual(st.load('x', {}), { a: 1 });
});

test('corrupt primary record restores from backup', () => {
  const mem = new Mem();
  const st = new Storage(mem);
  st.save('p', { v: 1 });
  st.save('p', { v: 2 }); // backup now holds v:1
  mem.setItem('prismpulse.p', '{garbage');
  const st2 = new Storage(mem);
  assert.deepEqual(st2.load('p', { v: 0 }), { v: 1 });
  assert.equal(st2.issues.length, 1);
});

test('tampered checksum falls back; both corrupt yields defaults', () => {
  const mem = new Mem();
  const st = new Storage(mem);
  st.save('q', { v: 5 });
  const rec = JSON.parse(mem.getItem('prismpulse.q'));
  rec.d = JSON.stringify({ v: 999 });
  mem.setItem('prismpulse.q', JSON.stringify(rec));
  mem.setItem('prismpulse.q.bak', 'nope');
  const st2 = new Storage(mem);
  assert.deepEqual(st2.load('q', { v: 0 }), { v: 0 });
  assert.ok(mem.getItem('prismpulse.q.corrupt'), 'corrupt data preserved for recovery');
});

test('settings sanitiser rejects bad types and clamps ranges', () => {
  const s = sanitizeSettings({ graphics: { quality: 'insane', glow: 'yes' }, audio: { master: 7, music: -1 }, junk: 1 });
  const d = defaultSettings();
  assert.equal(s.graphics.quality, d.graphics.quality);
  assert.equal(s.graphics.glow, d.graphics.glow);
  assert.equal(s.audio.master, 1);
  assert.equal(s.audio.music, 0);
});

test('progress records completion, stars, coins and achievements', () => {
  const st = new Storage(new Mem());
  const p = new Progress(st, [{ id: 'a', difficulty: 'hard', stars: 5, coinCount: 3 }]);
  p.recordAttempt('a', false);
  const r = p.recordCompletion('a', { practice: false, coins: [true, false, true], levelStars: 5 });
  assert.equal(r.firstCompletion, true);
  assert.equal(r.stars, 5);
  assert.equal(r.newCoins, 2);
  const s = p.summary();
  assert.equal(s.stars, 5);
  assert.equal(s.coins, 2);
  const unlocked = p.checkAchievements().map((a) => a.id);
  assert.ok(unlocked.includes('first_complete'));
  assert.ok(unlocked.includes('complete_hard'));
  assert.ok(unlocked.includes('first_try'));
  // persisted
  const p2 = new Progress(st, [{ id: 'a', difficulty: 'hard', stars: 5, coinCount: 3 }]);
  assert.equal(p2.level('a').completed, true);
});

test('progress sanitiser survives garbage', () => {
  const p = sanitizeProgress({ levels: { a: { attempts: -4, best: 900, coins: 'x' } }, totals: { attempts: NaN }, loadout: { cube: -1, primary: 9999 } });
  assert.equal(p.levels.a.attempts, 0);
  assert.equal(p.levels.a.best, 100);
  assert.deepEqual(p.levels.a.coins, [false, false, false]);
  assert.equal(p.totals.attempts, 0);
  assert.equal(p.loadout.cube, defaultProgress().loadout.cube);
});
