import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorModel, snapPosition } from '../src/editor/model.js';
import { createEmptyLevel } from '../src/game/level/format.js';
import { getDef } from '../src/game/objects/registry.js';

const fresh = () => new EditorModel(createEmptyLevel({ objects: [{ t: 'block', x: 0.5, y: 0.5 }] }));

test('add / undo / redo', () => {
  const m = fresh();
  const [uid] = m.add([{ t: 'spike', x: 3.5, y: 0.5 }]);
  assert.equal(m.count, 2);
  m.undo();
  assert.equal(m.count, 1);
  m.redo();
  assert.equal(m.count, 2);
  assert.equal(m.get(uid).t, 'spike');
});

test('modify and remove are undoable', () => {
  const m = fresh();
  const uid = m.list()[0].uid;
  m.modify([uid], (o) => { o.x = 9.5; o.r = 90; });
  assert.equal(m.get(uid).x, 9.5);
  m.remove([uid]);
  assert.equal(m.count, 0);
  m.undo();
  assert.equal(m.get(uid).x, 9.5);
  m.undo();
  assert.equal(m.get(uid).x, 0.5);
  assert.equal(m.get(uid).r, undefined);
});

test('live drag records a single undo step', () => {
  const m = fresh();
  const uid = m.list()[0].uid;
  const live = m.beginLive([uid]);
  for (let i = 1; i <= 5; i++) live.update((o, base) => { o.x = base.x + i; });
  live.commit();
  assert.equal(m.get(uid).x, 5.5);
  m.undo();
  assert.equal(m.get(uid).x, 0.5);
  assert.equal(m.history.canUndo, false);
});

test('copy selection and rotate slopes cycle orientations', () => {
  const m = fresh();
  const [s] = m.add([{ t: 'slope45', x: 5.5, y: 0.5 }]);
  m.selection = new Set([s]);
  const copy = m.copySelection();
  assert.equal(copy.length, 1);
  assert.equal(copy[0].x, 0.5);
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    m.rotateSelection(90);
    const o = m.get(s);
    seen.add(`${o.fx || 0}${o.fy || 0}`);
  }
  assert.equal(seen.size, 4);
});

test('pick selects the smallest object under the cursor', () => {
  const m = new EditorModel(createEmptyLevel({ objects: [{ t: 'saw_large', x: 5, y: 2 }, { t: 'spike', x: 5.5, y: 2.5 }] }));
  const uid = m.pick(5.5, 2.5);
  assert.equal(m.get(uid).t, 'spike');
});

test('grid snapping aligns objects to cells', () => {
  assert.deepEqual(snapPosition(getDef('block'), 3.7, 1.2), { x: 3.5, y: 1.5 });
  assert.deepEqual(snapPosition(getDef('saw'), 3.7, 1.2), { x: 4, y: 1 });
  assert.deepEqual(snapPosition(getDef('pad_yellow'), 3.7, 1.9), { x: 3.5, y: 1.15 });
  assert.deepEqual(snapPosition(getDef('portal_ship'), 3.2, 1.9), { x: 3.5, y: 1.5 });
});

test('exported level is normalised', () => {
  const m = fresh();
  m.add([{ t: 'coin', x: 2.5, y: 2.5, p: { index: 1 } }]);
  const lvl = m.toLevel();
  assert.equal(lvl.objects.length, 2);
  assert.equal(lvl.objects[1].p.index, 1);
});
