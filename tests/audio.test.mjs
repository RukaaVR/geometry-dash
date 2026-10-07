import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSongPCM, composeSong, songDuration } from '../src/audio/synth.js';
import { SONGS, getSong } from '../src/audio/songs.js';

test('menu loop renders clean audio', () => {
  const song = getSong('prism_menu');
  const r = renderSongPCM(song, { sampleRate: 22050, loop: true });
  assert.equal(r.left.length, Math.floor(songDuration(song) * 22050));
  let peak = 0, nan = false;
  for (let i = 0; i < r.left.length; i++) {
    const v = r.left[i];
    if (!Number.isFinite(v)) nan = true;
    peak = Math.max(peak, Math.abs(v));
  }
  assert.equal(nan, false);
  assert.ok(peak > 0.1 && peak < 1, `peak ${peak}`);
});

test('every song composes deterministically', () => {
  for (const s of SONGS) {
    const a = composeSong(s), b = composeSong(s);
    assert.equal(a.events.length, b.events.length);
    assert.ok(a.events.length > 100, s.id);
    assert.ok(Math.abs(a.duration - songDuration(s)) < 1e-9);
  }
});
