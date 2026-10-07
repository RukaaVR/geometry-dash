// Original soundtrack, defined as data and synthesized at runtime (see synth.js).

const std = (extra = []) => [
  { type: 'intro', bars: 4 },
  { type: 'verse', bars: 8 },
  { type: 'build', bars: 4 },
  { type: 'drop', bars: 16 },
  ...extra,
];

export const SONGS = [
  {
    id: 'prism_menu', name: 'Prism Lobby', artist: 'Prism Pulse OST', bpm: 112, root: 57, scale: 'dorian', seed: 7,
    progressions: { A: [0, 3, 5, 4] }, sections: [{ type: 'loop', bars: 8 }], arp: 'updown', leadWave: 'triangle', clap: true, menuOnly: true,
  },
  {
    id: 'daybreak', name: 'Daybreak Circuit', artist: 'Prism Pulse OST', bpm: 120, root: 60, scale: 'lydian', seed: 11,
    progressions: { A: [0, 4, 5, 3], B: [5, 3, 0, 4] },
    sections: [
      { type: 'intro', bars: 4 }, { type: 'verse', bars: 8 }, { type: 'build', bars: 4 }, { type: 'drop', bars: 8 },
      { type: 'break', bars: 4, prog: 'B' }, { type: 'build', bars: 4 }, { type: 'drop', bars: 8 }, { type: 'outro', bars: 8 },
    ],
    arp: 'up', leadWave: 'square', pluckWave: 'triangle',
  },
  {
    id: 'neon_drive', name: 'Neon Drive', artist: 'Prism Pulse OST', bpm: 128, root: 57, scale: 'minor', seed: 23,
    progressions: { A: [0, 5, 2, 6], B: [3, 4, 0, 0] },
    sections: std([{ type: 'break', bars: 4, prog: 'B' }, { type: 'build', bars: 4 }, { type: 'drop', bars: 8 }, { type: 'outro', bars: 8 }]),
    arp: 'updown', leadWave: 'sawtooth',
  },
  {
    id: 'overclock', name: 'Overclock', artist: 'Prism Pulse OST', bpm: 140, root: 62, scale: 'dorian', seed: 37,
    progressions: { A: [0, 3, 6, 4], B: [5, 6, 0, 0] },
    sections: std([{ type: 'bridge', bars: 8, prog: 'B' }, { type: 'build', bars: 4 }, { type: 'drop', bars: 16 }, { type: 'outro', bars: 4 }]),
    arp: 'skip', leadWave: 'square', bassPattern: 'rolling', swing: 0.08,
  },
  {
    id: 'skyline', name: 'Skyline Drift', artist: 'Prism Pulse OST', bpm: 132, root: 59, scale: 'minor', seed: 41,
    progressions: { A: [0, 6, 5, 6], B: [3, 5, 4, 4] },
    sections: std([{ type: 'break', bars: 8, prog: 'B' }, { type: 'build', bars: 4 }, { type: 'drop', bars: 16 }, { type: 'outro', bars: 4 }]),
    arp: 'random', leadWave: 'sawtooth', arpOctave: true,
  },
  {
    id: 'voltage', name: 'Voltage Spire', artist: 'Prism Pulse OST', bpm: 150, root: 58, scale: 'phrygian', seed: 53,
    progressions: { A: [0, 1, 0, 6], B: [5, 4, 1, 0] },
    sections: std([{ type: 'bridge', bars: 8, prog: 'B' }, { type: 'build', bars: 4 }, { type: 'drop', bars: 16 }, { type: 'outro', bars: 8 }]),
    arp: 'skip', leadWave: 'sawtooth', bassPattern: 'rolling',
  },
  {
    id: 'singularity', name: 'Singularity', artist: 'Prism Pulse OST', bpm: 160, root: 56, scale: 'harmonicMinor', seed: 71,
    progressions: { A: [0, 5, 3, 4], B: [0, 1, 4, 4] },
    sections: [
      { type: 'intro', bars: 4 }, { type: 'build', bars: 4 }, { type: 'drop', bars: 16 }, { type: 'bridge', bars: 8, prog: 'B' },
      { type: 'build', bars: 4 }, { type: 'drop', bars: 16 }, { type: 'break', bars: 4, prog: 'B' }, { type: 'build', bars: 4 },
      { type: 'drop', bars: 16 }, { type: 'outro', bars: 4 },
    ],
    arp: 'updown', leadWave: 'square', bassPattern: 'rolling', arpOctave: true,
  },
  {
    id: 'afterglow', name: 'Afterglow', artist: 'Prism Pulse OST', bpm: 100, root: 55, scale: 'major', seed: 83,
    progressions: { A: [0, 5, 3, 4] },
    sections: [{ type: 'intro', bars: 4 }, { type: 'verse', bars: 8 }, { type: 'break', bars: 8 }, { type: 'verse', bars: 8 }, { type: 'outro', bars: 8 }],
    arp: 'up', leadWave: 'triangle', pluckWave: 'triangle',
  },
];

const byId = new Map(SONGS.map((s) => [s.id, s]));
export const getSong = (id) => byId.get(id) || byId.get('neon_drive');
export const levelSongs = () => SONGS.filter((s) => !s.menuOnly);
