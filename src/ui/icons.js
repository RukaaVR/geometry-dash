// Inline SVG icon set for the interface (original, geometric).

const svg = (body, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  play: svg('<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>'),
  pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>'),
  levels: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>'),
  practice: svg('<path d="M5 21V4"/><path d="M5 4h11l-2.5 4L16 12H5" fill="currentColor" fill-opacity=".25"/>'),
  editor: svg('<path d="M4 20l4.5-1 10-10-3.5-3.5-10 10z"/><path d="M13.5 6.5l3.5 3.5"/>'),
  customize: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="currentColor" fill-opacity=".35"/>'),
  trophy: svg('<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M12 13v4M8 20h8M9.5 17h5"/>'),
  settings: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  stats: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  credits: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  left: svg('<path d="M15 4l-8 8 8 8"/>'),
  right: svg('<path d="M9 4l8 8-8 8"/>'),
  restart: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>'),
  exit: svg('<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  star: svg('<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="none"/>'),
  coin: svg('<circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity=".25"/><path d="M12 7.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="currentColor" stroke="none"/>'),
  lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
  check: svg('<path d="M4.5 12.5l5 5 10-11"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  trash: svg('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
  save: svg('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
  download: svg('<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>'),
  paste: svg('<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2"/>'),
  duplicate: svg('<rect x="3.5" y="3.5" width="11" height="11" rx="1.5"/><rect x="9.5" y="9.5" width="11" height="11" rx="1.5"/>'),
  rotate: svg('<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v4.5h-4.5"/>'),
  flipH: svg('<path d="M12 3v18"/><path d="M8 7L3 12l5 5zM16 7l5 5-5 5z"/>'),
  flipV: svg('<path d="M3 12h18"/><path d="M7 8l5-5 5 5zM7 16l5 5 5-5z"/>'),
  grid: svg('<path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  select: svg('<path d="M5 3l14 8-6 2-2 6z"/>'),
  build: svg('<path d="M3 21h18"/><rect x="5" y="11" width="5" height="10"/><rect x="14" y="5" width="5" height="16"/>'),
  move: svg('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
  music: svg('<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  zoomIn: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M10.5 7.5v6M7.5 10.5h6"/>'),
  zoomOut: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.5 10.5h6"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2.5 4L16 12H5z"/>'),
  flagX: svg('<path d="M5 21V4"/><path d="M5 4h11l-2.5 4L16 12H5z"/><path d="M15 15l5 5M20 15l-5 5"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  eye: svg('<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  verify: svg('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  skull: svg('<path d="M5 11a7 7 0 0 1 14 0v4h-2v4H7v-4H5z"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/>'),
  bolt: svg('<path d="M13 2L5 14h6l-1 8 8-12h-6z" fill="currentColor" fill-opacity=".3"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  retry: svg('<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>'),
  jump: svg('<path d="M12 20V6M6 12l6-6 6 6"/><path d="M5 21h14"/>'),
  orb: svg('<circle cx="12" cy="12" r="5" fill="currentColor" fill-opacity=".35"/><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>'),
  crown: svg('<path d="M3 18l2-11 5 5 2-7 2 7 5-5 2 11z"/>'),
  hard: svg('<path d="M12 3l9 16H3z"/>'),
  harder: svg('<path d="M12 3l9 16H3z"/><path d="M12 9v5"/>'),
  insane: svg('<path d="M12 2l3 7 7 .5-5.5 4.5 2 7.5L12 17l-6.5 4.5 2-7.5L2 9.5 9 9z"/>'),
  extreme: svg('<path d="M12 3l2.5 5 5.5-2-2 5.5 5 2.5-5 2.5 2 5.5-5.5-2-2.5 5-2.5-5-5.5 2 2-5.5-5-2.5 5-2.5-2-5.5 5.5 2z"/>'),
  keyboard: svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h1M10 10h1M14 10h1M18 10h0M7 14h10"/>'),
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = 'ico ' + cls;
  span.innerHTML = ICONS[name] || ICONS.info;
  return span;
}

// ------------------------------------------------------------------ difficulty emblems

const DIFF_STYLE = {
  easy: { c1: '#38c8ff', c2: '#0b4a6e', glyph: '<path d="M16 26l8-8 8 8" stroke-width="4"/>' },
  normal: { c1: '#4dff7a', c2: '#0b5a26', glyph: '<path d="M16 22l8-8 8 8M16 30l8-8 8 8" stroke-width="3.5"/>' },
  hard: { c1: '#ffd23f', c2: '#6b5100', glyph: '<path d="M16 19l8-7 8 7M16 26l8-7 8 7M16 33l8-7 8 7" stroke-width="3"/>' },
  harder: { c1: '#ff8a3d', c2: '#6b2b00', glyph: '<path d="M24 11c4 6 9 8 9 15a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 5 3 6 0-6 1-9 2-13z" fill="currentColor" stroke="none"/>' },
  insane: { c1: '#ff5fd2', c2: '#5e0d4a', glyph: '<path d="M24 10l3.5 9 9.5.5-7.5 6 2.5 9.5L24 30l-8 5 2.5-9.5-7.5-6 9.5-.5z" fill="currentColor" stroke="none"/>' },
  extreme: { c1: '#ff3b3b', c2: '#4a0610', glyph: '<path d="M14 14l5 6M34 14l-5 6" stroke-width="3.5"/><path d="M15 24a9 9 0 0 0 18 0v6H15z" fill="currentColor" stroke="none"/><circle cx="20" cy="26" r="2" fill="#1a0006" stroke="none"/><circle cx="28" cy="26" r="2" fill="#1a0006" stroke="none"/>' },
};

/** Original difficulty emblem as an SVG string. */
export function difficultyEmblem(diff, size = 64) {
  const s = DIFF_STYLE[diff] || DIFF_STYLE.normal;
  return `<svg class="diff-emblem diff-${diff}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-label="${diff}">
    <defs><linearGradient id="dg-${diff}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.c1}"/><stop offset="1" stop-color="${s.c2}"/></linearGradient></defs>
    <path d="M24 2l19 11v22L24 46 5 35V13z" fill="url(#dg-${diff})" stroke="#000" stroke-opacity=".6" stroke-width="2"/>
    <path d="M24 6l15.5 9v18L24 42 8.5 33V15z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>
    <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" color="#fff">${s.glyph}</g>
  </svg>`;
}

export const DIFFICULTY_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard', harder: 'Harder', insane: 'Insane', extreme: 'Extreme' };
export const DIFFICULTY_COLOR = { easy: '#38c8ff', normal: '#4dff7a', hard: '#ffd23f', harder: '#ff8a3d', insane: '#ff5fd2', extreme: '#ff3b3b' };
