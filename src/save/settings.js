// Player settings with schema-driven sanitising and quality presets.

export const QUALITY_PRESETS = {
  low: { particles: 0.3, glow: false, background: 'simple', renderScale: 0.75, maxParticles: 400, trail: false },
  medium: { particles: 0.6, glow: true, background: 'full', renderScale: 1, maxParticles: 900, trail: true },
  high: { particles: 1, glow: true, background: 'full', renderScale: 1, maxParticles: 1800, trail: true },
  ultra: { particles: 1.5, glow: true, background: 'full', renderScale: 1.25, maxParticles: 3000, trail: true },
};

export const SETTINGS_SCHEMA = {
  graphics: {
    quality: { type: 'select', options: ['low', 'medium', 'high', 'ultra'], default: 'high', label: 'Quality preset' },
    particles: { type: 'bool', default: true, label: 'Particles' },
    glow: { type: 'bool', default: true, label: 'Glow' },
    backgroundEffects: { type: 'bool', default: true, label: 'Background effects' },
    screenShake: { type: 'bool', default: true, label: 'Screen shake' },
    visualEffects: { type: 'bool', default: true, label: 'Screen effects' },
    renderScale: { type: 'range', min: 0.5, max: 1.5, step: 0.05, default: 1, label: 'Render resolution' },
    showFps: { type: 'bool', default: false, label: 'Show FPS' },
  },
  audio: {
    master: { type: 'range', min: 0, max: 1, step: 0.01, default: 0.8, label: 'Master volume' },
    music: { type: 'range', min: 0, max: 1, step: 0.01, default: 0.8, label: 'Music volume' },
    sfx: { type: 'range', min: 0, max: 1, step: 0.01, default: 0.7, label: 'Effects volume' },
    offsetMs: { type: 'range', min: -200, max: 200, step: 5, default: 0, label: 'Audio offset (ms)' },
  },
  gameplay: {
    showProgress: { type: 'bool', default: true, label: 'Progress bar' },
    showPercent: { type: 'bool', default: true, label: 'Percentage' },
    showAttempts: { type: 'bool', default: true, label: 'Attempt counter' },
    autoCheckpoints: { type: 'bool', default: true, label: 'Auto practice checkpoints' },
    respawnDelay: { type: 'range', min: 0.2, max: 1.2, step: 0.05, default: 0.5, label: 'Respawn delay (s)' },
    autoRetry: { type: 'bool', default: true, label: 'Auto retry' },
    holdToRetry: { type: 'bool', default: false, label: 'Restart requires input' },
  },
  accessibility: {
    reducedMotion: { type: 'bool', default: false, label: 'Reduced motion' },
    reducedFlashing: { type: 'bool', default: false, label: 'Reduced flashing' },
    highContrast: { type: 'bool', default: false, label: 'High contrast' },
  },
};

export function defaultSettings() {
  const out = {};
  for (const [sec, fields] of Object.entries(SETTINGS_SCHEMA)) {
    out[sec] = {};
    for (const [k, f] of Object.entries(fields)) out[sec][k] = f.default;
  }
  return out;
}

export function sanitizeSettings(raw) {
  const out = defaultSettings();
  if (!raw || typeof raw !== 'object') return out;
  for (const [sec, fields] of Object.entries(SETTINGS_SCHEMA)) {
    const src = raw[sec];
    if (!src || typeof src !== 'object') continue;
    for (const [k, f] of Object.entries(fields)) {
      const v = src[k];
      if (f.type === 'bool' && typeof v === 'boolean') out[sec][k] = v;
      else if (f.type === 'select' && f.options.includes(v)) out[sec][k] = v;
      else if (f.type === 'range' && typeof v === 'number' && Number.isFinite(v)) out[sec][k] = Math.min(f.max, Math.max(f.min, v));
    }
  }
  return out;
}

/** Effective render configuration combining the preset with individual toggles. */
export function renderConfig(settings) {
  const g = settings.graphics;
  const a = settings.accessibility;
  const preset = QUALITY_PRESETS[g.quality] || QUALITY_PRESETS.high;
  return {
    quality: g.quality,
    particles: g.particles ? preset.particles : 0,
    maxParticles: preset.maxParticles,
    glow: g.glow && preset.glow,
    background: g.backgroundEffects ? preset.background : 'simple',
    trail: preset.trail,
    renderScale: Math.min(2, preset.renderScale * g.renderScale),
    shake: g.screenShake && !a.reducedMotion,
    effects: g.visualEffects,
    reducedMotion: a.reducedMotion,
    reducedFlashing: a.reducedFlashing,
    highContrast: a.highContrast,
  };
}
