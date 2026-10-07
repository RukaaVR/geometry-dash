// Undo/redo history for the editor. Each entry records, per object uid, the object's
// state before and after the operation (null = did not exist), so add, delete and
// modify operations share one representation and are cheap for large levels.

const LIMIT = 300;

export class History {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.version = 0; // increments on every change, used for dirty tracking
  }

  /** @param entry {label, before: Map<uid, obj|null>, after: Map<uid, obj|null>} */
  push(entry) {
    if (!entry.before.size && !entry.after.size) return;
    this.undoStack.push(entry);
    if (this.undoStack.length > LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
    this.version++;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  undo(apply) {
    const e = this.undoStack.pop();
    if (!e) return null;
    apply(e.before, e.after);
    this.redoStack.push(e);
    this.version++;
    return e;
  }

  redo(apply) {
    const e = this.redoStack.pop();
    if (!e) return null;
    apply(e.after, e.before);
    this.undoStack.push(e);
    this.version++;
    return e;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

/** Deep clone of a level object (plain JSON data). */
export function cloneObj(o) {
  const c = { t: o.t, x: o.x, y: o.y };
  for (const k of ['r', 's', 'fx', 'fy', 'c', 'z', 'a']) if (o[k] !== undefined) c[k] = o[k];
  if (o.g) c.g = [...o.g];
  if (o.p) c.p = { ...o.p };
  return c;
}
