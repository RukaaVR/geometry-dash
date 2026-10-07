// Web Worker that renders songs off the main thread so loading never stalls the UI.
import { renderSongPCM } from './synth.js';
import { getSong } from './songs.js';

self.onmessage = (e) => {
  const { id, songId, sampleRate, loop } = e.data;
  try {
    const r = renderSongPCM(getSong(songId), { sampleRate, loop });
    self.postMessage({ id, ok: true, left: r.left, right: r.right, sampleRate: r.sampleRate }, [r.left.buffer, r.right.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
