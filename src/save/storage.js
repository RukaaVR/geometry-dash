// Robust persistent storage on top of localStorage.
// Every record is written as {v, sum, data} with a checksum; the previous good copy is
// kept as a backup. Corrupt or unreadable records fall back to the backup, then to
// defaults, so a malformed save can never brick the game or silently wipe progress.

const PREFIX = 'prismpulse.';

function checksum(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** In-memory fallback when localStorage is unavailable (private mode, sandboxed iframes). */
class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

function detectStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = PREFIX + '__probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return { storage: s, persistent: true };
  } catch (e) {
    return { storage: new MemoryStorage(), persistent: false };
  }
}

export class Storage {
  constructor(backend) {
    const det = backend ? { storage: backend, persistent: true } : detectStorage();
    this.backend = det.storage;
    this.persistent = det.persistent;
    this.issues = []; // human readable notes about recovered/corrupt data
  }

  _readRecord(key) {
    const raw = this.backend.getItem(key);
    if (raw === null) return { ok: false, missing: true };
    try {
      const rec = JSON.parse(raw);
      if (!rec || typeof rec !== 'object' || typeof rec.d !== 'string') return { ok: false };
      if (checksum(rec.d) !== rec.s) return { ok: false };
      return { ok: true, data: JSON.parse(rec.d), version: rec.v };
    } catch (e) {
      return { ok: false };
    }
  }

  /**
   * Load a record. `sanitize(data)` must return a valid object (merging defaults).
   */
  load(name, defaults, sanitize = (d) => d) {
    const key = PREFIX + name;
    const primary = this._readRecord(key);
    if (primary.ok) {
      try {
        return sanitize(primary.data);
      } catch (e) {
        /* fall through to backup */
      }
    }
    if (!primary.missing) {
      const backup = this._readRecord(key + '.bak');
      if (backup.ok) {
        try {
          const data = sanitize(backup.data);
          this.issues.push(`${name}: save was damaged and has been restored from backup`);
          this.save(name, data, false);
          return data;
        } catch (e) {
          /* fall through */
        }
      }
      this.issues.push(`${name}: save data was unreadable and has been reset`);
      // Keep the corrupt blob for manual recovery instead of destroying it.
      try {
        this.backend.setItem(key + '.corrupt', this.backend.getItem(key) || '');
      } catch (e) {
        /* ignore */
      }
    }
    return sanitize(structuredCloneSafe(defaults));
  }

  save(name, data, backup = true) {
    const key = PREFIX + name;
    try {
      const d = JSON.stringify(data);
      const rec = JSON.stringify({ v: 1, s: checksum(d), d });
      if (backup) {
        const prev = this.backend.getItem(key);
        if (prev !== null && this._readRecord(key).ok) this.backend.setItem(key + '.bak', prev);
      }
      this.backend.setItem(key, rec);
      return true;
    } catch (e) {
      this.lastError = e;
      return false;
    }
  }

  remove(name) {
    const key = PREFIX + name;
    try {
      this.backend.removeItem(key);
      this.backend.removeItem(key + '.bak');
    } catch (e) {
      /* ignore */
    }
  }

  /** Names (without prefix) of records starting with `prefix`. */
  list(prefix) {
    const out = [];
    try {
      for (let i = 0; i < this.backend.length; i++) {
        const k = this.backend.key(i);
        if (k && k.startsWith(PREFIX + prefix) && !k.endsWith('.bak') && !k.endsWith('.corrupt')) out.push(k.slice(PREFIX.length));
      }
    } catch (e) {
      /* ignore */
    }
    return out;
  }
}

export function structuredCloneSafe(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}
