# Prism Pulse

An original rhythm platformer in the classic precision-runner style, built from scratch
for the web with **zero runtime dependencies** — all art, icons, music and sound effects
are generated procedurally at runtime.

- 6 hand-built levels from **Easy** to **Extreme**, each with 3 secret coins
- 7 game modes: **cube, ship, ball, UFO, wave, robot, spider** (plus mini size, gravity flips, 5 speeds, teleporters)
- Deterministic **240 Hz fixed-step physics**, identical at any frame rate
- Gameplay clocked from the **audio hardware position**, with sub-frame timestamped input
- Practice mode with automatic/manual checkpoints
- Full **level editor**: build/edit/delete tools, multi-select, drag, rotate, flip, scale,
  copy/paste/duplicate, undo/redo, grid snap, triggers, colour channels, level settings,
  scrubbing, music preview, test-from-anywhere, save/load/import/export and an
  **autopilot verifier** that proves a level is beatable
- Progression: stars, coins, attempts, statistics, 24 achievements, 50+ unlockable cosmetics
- Settings for graphics quality, audio levels and latency calibration, gameplay and accessibility
- Robust saves (checksums + backups, corrupted data is recovered or reset safely)

## Running

```bash
npm start          # serves the game at http://localhost:8080
```

Any static file server works too — open `index.html` through HTTP (ES modules and Web
Workers do not load from `file://`).

## Controls

| Action | Keys |
| --- | --- |
| Jump / fly / flip | Space, ↑, W, left click, tap, gamepad A |
| Pause | Esc, P, gamepad Start |
| Restart | R |
| Practice checkpoint | Z place · X remove |
| Menus | Arrow keys / gamepad d-pad, Enter / A, Esc / B |
| Editor | 1/2/3 tools · Q/E rotate · H/V flip · G grid · Ctrl+Z/Y undo/redo · Ctrl+C/V/D copy/paste/duplicate · Del delete · Enter test · Shift+Enter test here · M music preview · Ctrl+S save |
| Debug overlay (dev only) | F3 (on localhost or with `?debug` in the URL) |

## Tests

```bash
npm test               # unit + integration tests (node:test)
npm run verify-levels  # autopilot report for every built-in level
npm run smoke          # end-to-end browser test (needs Playwright installed)
```

The test-suite covers jump physics and timing windows, every mode, portals, pads/orbs,
checkpoint cloning, **frame-rate independence (30/60/120/144/240 fps produce identical
event logs)**, trigger behaviour, level validation of malformed data, save corruption and
recovery, progression and achievements, the editor model (undo/redo, live drags, snapping)
and the music synthesizer. Every built-in level is proven completable by the autopilot at
a difficulty-appropriate input resolution, every mode portal is proven unavoidable, and
all three coins are proven collectable in a single run.

## Architecture

```
src/
  core/        math, easing, colours, geometry (SAT), deterministic RNG
  game/
    constants.js        physics tuning (speeds, gravity, jump, pads/orbs)
    objects/registry.js data-driven object definitions (hitboxes, props, editor schema)
    level/format.js     level JSON format: validation, normalisation, serialisation
    sim/                deterministic simulation (DOM-free)
      compile.js        level -> runtime world, spatial buckets, time<->x timeline
      sim.js            fixed-tick step: modes, collisions, slopes, portals, orbs, pads
      triggers.js       move/rotate/scale/alpha/toggle/color/pulse/camera/spawn/... triggers
      solver.js         beam-search autopilot used for verification and the menu demo
    session.js          attempt lifecycle, audio-clocked stepping, practice checkpoints
  audio/       Web Audio engine, music manager (audio-clock sync), procedural synth + worker, SFX
  render/      canvas renderer, camera, batched object painters, icons, particles, backgrounds
  input/       keyboard / pointer / touch / gamepad with timestamped events
  scenes/      menu (with autopiloted demo), gameplay
  editor/      editor model (undo/redo), scene/UI, verification worker
  ui/          screen stack, dialogs, toasts and all menu screens
  save/        storage (checksums, backups), settings, progress, achievements, cosmetics
  levels/      level builder + the six built-in levels
  debug/       FPS / hitbox / timing overlay
```

### Timing model

The simulation advances in fixed 1/240 s ticks. Each frame, the session asks the music
manager for the audible song position (derived from `AudioContext.getOutputTimestamp`,
smoothed and kept monotonic) and runs exactly as many ticks as needed to reach it. Input
events carry their browser timestamps and are converted to the tick in which they
occurred, so a press registers on the same tick at 30 fps or 240 fps. Rendering
interpolates between the last two ticks. A user-adjustable (and calibratable) audio offset
compensates for device latency.

### Level format

Levels are plain JSON (`format: 1`) with metadata (name, author, difficulty, song, BPM),
settings (start mode/speed/gravity, background and ground styles), colour channels and a
list of objects `{t, x, y, r?, s?, fx?, fy?, c?, z?, a?, g?, p?}`. Everything is validated
on load; invalid objects are dropped with warnings instead of crashing. Built-in levels
are generated with the same format and can be opened in the editor.

## Originality

All names, artwork, music, levels and UI are original. Music is composed procedurally from
data in `src/audio/songs.js` and synthesised in `src/audio/synth.js`.
