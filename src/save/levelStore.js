// Persistent storage for user-created levels.

import { normalizeLevel, LevelError } from '../game/level/format.js';

export class LevelStore {
  constructor(storage) {
    this.storage = storage;
    this.index = storage.load('levelIndex', [], (d) => (Array.isArray(d) ? d.filter((e) => e && typeof e.id === 'string') : []));
  }

  list() {
    return [...this.index].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id) {
    const raw = this.storage.load('level.' + id, null, (d) => d);
    if (!raw) return null;
    try {
      return normalizeLevel(raw).level;
    } catch (e) {
      return null;
    }
  }

  save(level) {
    const ok = this.storage.save('level.' + level.id, level);
    if (!ok) throw new LevelError('Could not save level: storage is full or unavailable');
    const entry = {
      id: level.id,
      name: level.name,
      difficulty: level.difficulty,
      objectCount: level.objects.length,
      updatedAt: Date.now(),
      verified: !!level.verified,
    };
    const i = this.index.findIndex((e) => e.id === level.id);
    if (i >= 0) this.index[i] = { ...this.index[i], ...entry };
    else this.index.push(entry);
    this.storage.save('levelIndex', this.index);
    return entry;
  }

  setVerified(id, verified) {
    const e = this.index.find((x) => x.id === id);
    if (e) {
      e.verified = verified;
      this.storage.save('levelIndex', this.index);
    }
  }

  delete(id) {
    this.storage.remove('level.' + id);
    this.index = this.index.filter((e) => e.id !== id);
    this.storage.save('levelIndex', this.index);
  }

  /** Import level JSON text; returns the stored level (with a fresh id on collision). */
  import(text) {
    const { level, warnings } = normalizeLevel(text);
    if (this.index.some((e) => e.id === level.id)) level.id = level.id + '-' + Date.now().toString(36);
    this.save(level);
    return { level, warnings };
  }
}
