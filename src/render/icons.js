// Procedural player icons for every mode and design. Drawn in a y-down local space
// where the cube occupies [-0.5, 0.5]; callers set up scale/rotation. Used both in
// gameplay and in UI previews (customisation screen, menus).

const OUT = 'rgba(0,0,0,0.85)';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function fillStroke(ctx, fill, lw = 0.06) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUT;
  ctx.stroke();
}

// ------------------------------------------------------------------ cube

export function drawCube(ctx, design, P, S) {
  ctx.lineJoin = 'round';
  rr(ctx, -0.5, -0.5, 1, 1, 0.06);
  fillStroke(ctx, P, 0.07);
  switch (design % 10) {
    case 0: // Core
      rr(ctx, -0.3, -0.3, 0.6, 0.6, 0.04);
      fillStroke(ctx, S);
      rr(ctx, -0.12, -0.12, 0.24, 0.24, 0.02);
      fillStroke(ctx, P, 0.05);
      break;
    case 1: // Visor
      rr(ctx, -0.38, -0.2, 0.76, 0.26, 0.05);
      fillStroke(ctx, S);
      ctx.fillStyle = OUT;
      ctx.fillRect(-0.26, -0.13, 0.14, 0.12);
      ctx.fillRect(0.12, -0.13, 0.14, 0.12);
      rr(ctx, -0.22, 0.2, 0.44, 0.1, 0.03);
      fillStroke(ctx, S, 0.04);
      break;
    case 2: // Split
      poly(ctx, [-0.5, 0.5, 0.5, -0.5, 0.5, 0.5]);
      fillStroke(ctx, S, 0.05);
      poly(ctx, [0, -0.18, 0.18, 0, 0, 0.18, -0.18, 0]);
      fillStroke(ctx, P, 0.05);
      break;
    case 3: // Target
      rr(ctx, -0.36, -0.36, 0.72, 0.72, 0.03);
      fillStroke(ctx, S, 0.05);
      rr(ctx, -0.23, -0.23, 0.46, 0.46, 0.03);
      fillStroke(ctx, P, 0.05);
      rr(ctx, -0.1, -0.1, 0.2, 0.2, 0.02);
      fillStroke(ctx, S, 0.05);
      break;
    case 4: // Bolt
      poly(ctx, [0.08, -0.4, -0.22, 0.05, -0.02, 0.05, -0.1, 0.4, 0.24, -0.08, 0.03, -0.08]);
      fillStroke(ctx, S, 0.05);
      break;
    case 5: // Grin
      rr(ctx, -0.3, -0.25, 0.18, 0.2, 0.04);
      fillStroke(ctx, S, 0.05);
      rr(ctx, 0.12, -0.25, 0.18, 0.2, 0.04);
      fillStroke(ctx, S, 0.05);
      ctx.beginPath();
      ctx.moveTo(-0.28, 0.1);
      ctx.quadraticCurveTo(0, 0.42, 0.28, 0.1);
      ctx.closePath();
      fillStroke(ctx, S, 0.05);
      break;
    case 6: // Diamond
      poly(ctx, [0, -0.42, 0.42, 0, 0, 0.42, -0.42, 0]);
      fillStroke(ctx, S, 0.05);
      poly(ctx, [0, -0.2, 0.2, 0, 0, 0.2, -0.2, 0]);
      fillStroke(ctx, P, 0.05);
      break;
    case 7: // Circuit
      ctx.strokeStyle = S;
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(-0.5, -0.2);
      ctx.lineTo(-0.15, -0.2);
      ctx.lineTo(0.1, 0.1);
      ctx.lineTo(0.5, 0.1);
      ctx.moveTo(-0.3, 0.5);
      ctx.lineTo(-0.3, 0.2);
      ctx.lineTo(0.2, -0.3);
      ctx.lineTo(0.2, -0.5);
      ctx.stroke();
      for (const [x, y] of [[-0.15, -0.2], [0.1, 0.1], [-0.3, 0.2], [0.2, -0.3]]) {
        ctx.beginPath();
        ctx.arc(x, y, 0.07, 0, Math.PI * 2);
        fillStroke(ctx, S, 0.04);
      }
      break;
    case 8: // Crown
      poly(ctx, [-0.32, 0.25, -0.32, -0.2, -0.16, 0, 0, -0.3, 0.16, 0, 0.32, -0.2, 0.32, 0.25]);
      fillStroke(ctx, S, 0.05);
      break;
    case 9: // Void
      rr(ctx, -0.42, -0.42, 0.84, 0.84, 0.05);
      fillStroke(ctx, '#05050a', 0.04);
      ctx.beginPath();
      ctx.arc(0, 0, 0.18, 0, Math.PI * 2);
      fillStroke(ctx, S, 0.04);
      ctx.beginPath();
      ctx.arc(0, 0, 0.07, 0, Math.PI * 2);
      ctx.fillStyle = P;
      ctx.fill();
      break;
    default:
      break;
  }
}

// ------------------------------------------------------------------ ship

export function drawShip(ctx, design, P, S, cubeDesign) {
  ctx.lineJoin = 'round';
  // pilot cube
  ctx.save();
  ctx.translate(-0.08, -0.2);
  ctx.scale(0.5, 0.5);
  drawCube(ctx, cubeDesign, P, S);
  ctx.restore();
  switch (design % 6) {
    case 0: // Glider
      poly(ctx, [-0.75, -0.05, 0.25, -0.05, 0.75, 0.12, 0.3, 0.38, -0.7, 0.38, -0.8, 0.1]);
      fillStroke(ctx, P);
      poly(ctx, [-0.55, 0.05, 0.35, 0.05, 0.45, 0.15, -0.5, 0.25]);
      fillStroke(ctx, S, 0.04);
      break;
    case 1: // Dart
      poly(ctx, [-0.8, -0.1, 0.8, 0.12, -0.8, 0.4, -0.6, 0.15]);
      fillStroke(ctx, P);
      poly(ctx, [-0.5, 0.05, 0.4, 0.13, -0.5, 0.25]);
      fillStroke(ctx, S, 0.04);
      break;
    case 2: // Manta
      ctx.beginPath();
      ctx.moveTo(-0.8, 0);
      ctx.quadraticCurveTo(0, -0.15, 0.78, 0.12);
      ctx.quadraticCurveTo(0, 0.55, -0.8, 0.35);
      ctx.closePath();
      fillStroke(ctx, P);
      ctx.beginPath();
      ctx.ellipse(0, 0.16, 0.36, 0.07, 0, 0, Math.PI * 2);
      fillStroke(ctx, S, 0.04);
      break;
    case 3: // Rocket
      rr(ctx, -0.7, -0.02, 1.2, 0.36, 0.17);
      fillStroke(ctx, P);
      poly(ctx, [0.45, -0.02, 0.8, 0.16, 0.45, 0.34]);
      fillStroke(ctx, S, 0.05);
      poly(ctx, [-0.7, -0.02, -0.85, -0.2, -0.45, -0.02]);
      fillStroke(ctx, S, 0.05);
      poly(ctx, [-0.7, 0.34, -0.85, 0.5, -0.45, 0.34]);
      fillStroke(ctx, S, 0.05);
      break;
    case 4: // Phantom
      poly(ctx, [-0.8, -0.05, -0.2, 0.0, 0.8, 0.15, -0.2, 0.32, -0.8, 0.4, -0.55, 0.17]);
      fillStroke(ctx, '#111118');
      poly(ctx, [-0.6, 0.05, 0.6, 0.16, -0.6, 0.3]);
      fillStroke(ctx, P, 0.04);
      ctx.beginPath();
      ctx.arc(0.25, 0.15, 0.06, 0, Math.PI * 2);
      ctx.fillStyle = S;
      ctx.fill();
      break;
    default: // Comet
      ctx.beginPath();
      ctx.ellipse(0.05, 0.16, 0.7, 0.22, 0, 0, Math.PI * 2);
      fillStroke(ctx, P);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-0.35 + i * 0.3, 0.16, 0.07, 0, Math.PI * 2);
        fillStroke(ctx, S, 0.035);
      }
      break;
  }
}

// ------------------------------------------------------------------ ball

export function drawBall(ctx, design, P, S) {
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, 0.5, 0, Math.PI * 2);
  fillStroke(ctx, P, 0.07);
  switch (design % 5) {
    case 0: // Orbit
      ctx.beginPath();
      ctx.arc(0, 0, 0.3, 0, Math.PI * 2);
      fillStroke(ctx, S);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        rr(ctx, Math.cos(a) * 0.4 - 0.06, Math.sin(a) * 0.4 - 0.06, 0.12, 0.12, 0.02);
        fillStroke(ctx, S, 0.03);
      }
      break;
    case 1: // Gear
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = i % 2 ? 0.26 : 0.36;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      fillStroke(ctx, S, 0.04);
      ctx.beginPath();
      ctx.arc(0, 0, 0.1, 0, Math.PI * 2);
      fillStroke(ctx, P, 0.04);
      break;
    case 2: // Eclipse
      ctx.beginPath();
      ctx.arc(0, 0, 0.5, -Math.PI / 2, Math.PI / 2);
      ctx.closePath();
      fillStroke(ctx, S, 0.05);
      ctx.beginPath();
      ctx.arc(0, 0, 0.18, 0, Math.PI * 2);
      fillStroke(ctx, P, 0.05);
      break;
    case 3: // Spiral
      ctx.strokeStyle = S;
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = i * 0.32;
        const r = 0.02 + i * 0.009;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.stroke();
      break;
    default: // Nova
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? 0.17 : 0.4;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      fillStroke(ctx, S, 0.04);
      break;
  }
}

// ------------------------------------------------------------------ ufo

export function drawUfo(ctx, design, P, S, cubeDesign) {
  ctx.lineJoin = 'round';
  // glass dome with pilot
  ctx.beginPath();
  ctx.arc(0, -0.05, 0.36, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(160,230,255,0.35)';
  ctx.fill();
  ctx.save();
  ctx.translate(0, -0.18);
  ctx.scale(0.42, 0.42);
  drawCube(ctx, cubeDesign, P, S);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, -0.05, 0.36, Math.PI, 0);
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = OUT;
  ctx.stroke();
  switch (design % 5) {
    case 0:
      ctx.beginPath();
      ctx.ellipse(0, 0.12, 0.68, 0.2, 0, 0, Math.PI * 2);
      fillStroke(ctx, P);
      rr(ctx, -0.45, 0.07, 0.9, 0.1, 0.05);
      fillStroke(ctx, S, 0.035);
      break;
    case 1: // Halo
      ctx.beginPath();
      ctx.ellipse(0, 0.12, 0.7, 0.16, 0, 0, Math.PI * 2);
      fillStroke(ctx, S);
      ctx.beginPath();
      ctx.ellipse(0, 0.14, 0.5, 0.12, 0, 0, Math.PI * 2);
      fillStroke(ctx, P, 0.04);
      break;
    case 2: // Beacon
      poly(ctx, [-0.7, 0.05, 0.7, 0.05, 0.45, 0.32, -0.45, 0.32]);
      fillStroke(ctx, P);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * 0.3, 0.18, 0.06, 0, Math.PI * 2);
        fillStroke(ctx, S, 0.03);
      }
      break;
    case 3: // Crown
      poly(ctx, [-0.7, 0.1, -0.5, -0.02, 0.5, -0.02, 0.7, 0.1, 0.5, 0.3, -0.5, 0.3]);
      fillStroke(ctx, P);
      poly(ctx, [-0.3, 0.3, 0, 0.45, 0.3, 0.3]);
      fillStroke(ctx, S, 0.04);
      break;
    default: // Prism
      poly(ctx, [-0.72, 0.12, 0, -0.02, 0.72, 0.12, 0, 0.34]);
      fillStroke(ctx, P);
      poly(ctx, [-0.35, 0.12, 0, 0.04, 0.35, 0.12, 0, 0.23]);
      fillStroke(ctx, S, 0.035);
      break;
  }
}

// ------------------------------------------------------------------ wave

export function drawWave(ctx, design, P, S) {
  ctx.lineJoin = 'round';
  switch (design % 5) {
    case 0:
      poly(ctx, [0.55, 0, -0.45, -0.4, -0.25, 0, -0.45, 0.4]);
      fillStroke(ctx, P);
      poly(ctx, [0.25, 0, -0.25, -0.18, -0.12, 0, -0.25, 0.18]);
      fillStroke(ctx, S, 0.04);
      break;
    case 1: // Fang
      poly(ctx, [0.55, 0, -0.5, -0.35, -0.1, 0, -0.5, 0.35]);
      fillStroke(ctx, S);
      poly(ctx, [0.4, 0, -0.3, -0.12, -0.3, 0.12]);
      fillStroke(ctx, P, 0.04);
      break;
    case 2: // Comet
      ctx.beginPath();
      ctx.moveTo(0.55, 0);
      ctx.quadraticCurveTo(0, -0.45, -0.5, -0.1);
      ctx.lineTo(-0.5, 0.1);
      ctx.quadraticCurveTo(0, 0.45, 0.55, 0);
      fillStroke(ctx, P);
      ctx.beginPath();
      ctx.arc(0.1, 0, 0.12, 0, Math.PI * 2);
      fillStroke(ctx, S, 0.04);
      break;
    case 3: // Blade
      poly(ctx, [0.6, 0, 0, -0.18, -0.5, -0.42, -0.3, 0, -0.5, 0.42, 0, 0.18]);
      fillStroke(ctx, P);
      poly(ctx, [0.35, 0, -0.1, -0.08, -0.1, 0.08]);
      fillStroke(ctx, S, 0.03);
      break;
    default: // Shard
      poly(ctx, [0.55, 0.05, 0.05, -0.38, -0.45, -0.2, -0.2, 0.05, -0.45, 0.35]);
      fillStroke(ctx, P);
      poly(ctx, [0.3, 0.03, 0.02, -0.15, -0.12, 0.05]);
      fillStroke(ctx, S, 0.03);
      break;
  }
}

// ------------------------------------------------------------------ robot

export function drawRobot(ctx, design, P, S, phase = 0, airborne = false) {
  ctx.lineJoin = 'round';
  const legSwing = airborne ? 0.25 : Math.sin(phase) * 0.22;
  // legs
  for (const side of [-1, 1]) {
    const sw = legSwing * side;
    ctx.beginPath();
    ctx.moveTo(-0.08 * side, 0.12);
    ctx.lineTo(-0.1 * side + sw, 0.32);
    ctx.lineTo(-0.02 * side + sw * 1.4, 0.46);
    ctx.lineWidth = 0.17;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.lineWidth = 0.09;
    ctx.strokeStyle = side > 0 ? S : P;
    ctx.stroke();
    rr(ctx, -0.02 * side + sw * 1.4 - 0.12, 0.43, 0.26, 0.08, 0.03);
    fillStroke(ctx, P, 0.035);
  }
  const variant = design % 4;
  // body
  if (variant === 2) poly(ctx, [-0.42, -0.42, 0.42, -0.42, 0.34, 0.16, -0.34, 0.16]);
  else rr(ctx, -0.4, -0.45, 0.8, 0.62, variant === 1 ? 0.18 : 0.06);
  fillStroke(ctx, P);
  // visor
  if (variant === 3) {
    rr(ctx, -0.3, -0.33, 0.6, 0.12, 0.05);
    fillStroke(ctx, S, 0.04);
    rr(ctx, -0.2, -0.12, 0.4, 0.16, 0.04);
    fillStroke(ctx, S, 0.04);
  } else {
    rr(ctx, -0.04, -0.3, 0.36, 0.2, 0.05);
    fillStroke(ctx, S, 0.04);
    ctx.fillStyle = OUT;
    ctx.fillRect(0.14, -0.25, 0.1, 0.1);
  }
  if (variant === 0) {
    rr(ctx, -0.3, -0.02, 0.3, 0.1, 0.03);
    fillStroke(ctx, S, 0.03);
  }
}

// ------------------------------------------------------------------ spider

export function drawSpider(ctx, design, P, S, phase = 0) {
  ctx.lineJoin = 'round';
  const variant = design % 4;
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const k = i % 2;
    const sw = Math.sin(phase + i * 1.7) * 0.06;
    const bx = side * (0.12 + k * 0.1);
    ctx.beginPath();
    ctx.moveTo(bx, 0.05);
    ctx.lineTo(side * (0.32 + k * 0.12) + sw, -0.05 + k * 0.05);
    ctx.lineTo(side * (0.38 + k * 0.14) + sw, 0.46);
    ctx.lineWidth = 0.13;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = k ? S : P;
    ctx.stroke();
  }
  if (variant === 1) poly(ctx, [0, -0.42, 0.36, -0.1, 0.24, 0.22, -0.24, 0.22, -0.36, -0.1]);
  else if (variant === 2) rr(ctx, -0.36, -0.36, 0.72, 0.52, 0.12);
  else {
    ctx.beginPath();
    ctx.ellipse(0, -0.08, 0.38, 0.3, 0, 0, Math.PI * 2);
  }
  fillStroke(ctx, P);
  if (variant === 3) {
    for (const x of [-0.14, 0, 0.14]) {
      ctx.beginPath();
      ctx.arc(x + 0.06, -0.14, 0.05, 0, Math.PI * 2);
      fillStroke(ctx, S, 0.025);
    }
  } else {
    rr(ctx, 0.0, -0.22, 0.26, 0.14, 0.05);
    fillStroke(ctx, S, 0.04);
  }
}

/** Draw the icon for any mode. Local space: y down, cube = 1 unit. */
export function drawIcon(ctx, mode, look, opts = {}) {
  const P = look.primary, S = look.secondary;
  const d = look.designs;
  switch (mode) {
    case 'ship':
      drawShip(ctx, d.ship, P, S, d.cube);
      break;
    case 'ball':
      drawBall(ctx, d.ball, P, S);
      break;
    case 'ufo':
      drawUfo(ctx, d.ufo, P, S, d.cube);
      break;
    case 'wave':
      drawWave(ctx, d.wave, P, S);
      break;
    case 'robot':
      drawRobot(ctx, d.robot, P, S, opts.phase || 0, opts.airborne);
      break;
    case 'spider':
      drawSpider(ctx, d.spider, P, S, opts.phase || 0);
      break;
    default:
      drawCube(ctx, d.cube, P, S);
      break;
  }
}

/** Render an icon preview into a standalone canvas element (for UI). */
export function iconCanvas(mode, look, sizePx = 64, opts = {}) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(sizePx * dpr);
  c.style.width = c.style.height = sizePx + 'px';
  paintIcon(c, mode, look, opts);
  return c;
}

export function paintIcon(canvas, mode, look, opts = {}) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width * (mode === 'ship' || mode === 'ufo' ? 0.52 : 0.62);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(s, s);
  if (opts.rotation) ctx.rotate(opts.rotation);
  drawIcon(ctx, mode, look, opts);
}
