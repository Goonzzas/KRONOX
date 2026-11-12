import * as THREE from 'three';

function createSafeCanvas(width, height) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function makeFallbackTexture(hexColor = '#2a3444') {
  const data = new Uint8Array([
    parseInt(hexColor.slice(1, 3), 16) || 42,
    parseInt(hexColor.slice(3, 5), 16) || 52,
    parseInt(hexColor.slice(5, 7), 16) || 68,
    255,
  ]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function configureRepeat(tex, repeatX = 1, repeatY = 1, srgb = true) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb && THREE.sRGBEncoding !== undefined) {
    tex.encoding = THREE.sRGBEncoding;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates procedural aerospace hull plating textures (albedo + bump + roughness)
 * with panel seams, micro-rivets, wear variation, and technical stencil trims.
 */
export function createHullPanelTextureSet({
  baseColor = '#273244',
  seamColor = '#141b26',
  accentColor = '#38bdf8',
  repeatX = 2,
  repeatY = 2,
} = {}) {
  const canvas = createSafeCanvas(512, 512);
  const bumpCanvas = createSafeCanvas(512, 512);
  if (!canvas || !bumpCanvas) {
    return {
      map: makeFallbackTexture(baseColor),
      bumpMap: makeFallbackTexture('#808080'),
      roughnessMap: makeFallbackTexture('#707070'),
    };
  }

  const ctx = canvas.getContext('2d');
  const btx = bumpCanvas.getContext('2d');

  // Base metallic alloy fill with subtle brushed gradient
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, baseColor);
  grad.addColorStop(0.5, '#2f3c50');
  grad.addColorStop(1, baseColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  btx.fillStyle = '#888888';
  btx.fillRect(0, 0, 512, 512);

  // Subtle brushed hairline streaks
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 180; i++) {
    const y = (i * 2.83) % 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Modular rectangular aerospace cladding panels
  const cells = [
    [0, 0, 256, 256],
    [256, 0, 256, 256],
    [0, 256, 512, 128],
    [0, 384, 256, 128],
    [256, 384, 256, 128],
  ];
  cells.forEach(([x, y, w, h], idx) => {
    ctx.fillStyle = idx % 2 === 0 ? 'rgba(255,255,255,0.028)' : 'rgba(8,14,24,0.12)';
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

    ctx.strokeStyle = seamColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    btx.strokeStyle = '#303030';
    btx.lineWidth = 4;
    btx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    // Corner recessed fasteners / rivets
    const inset = 14;
    const rivets = [
      [x + inset, y + inset],
      [x + w - inset, y + inset],
      [x + inset, y + h - inset],
      [x + w - inset, y + h - inset],
    ];
    rivets.forEach(([rx, ry]) => {
      ctx.fillStyle = '#182130';
      ctx.beginPath();
      ctx.arc(rx, ry, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(210,230,255,0.28)';
      ctx.beginPath();
      ctx.arc(rx - 0.6, ry - 0.6, 1.3, 0, Math.PI * 2);
      ctx.fill();

      btx.fillStyle = '#c8c8c8';
      btx.beginPath();
      btx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      btx.fill();
    });
  });

  // Discrete technical trim stripe along lower edge
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.72;
  ctx.fillRect(18, 494, 140, 4);
  ctx.globalAlpha = 1;

  const map = configureRepeat(new THREE.CanvasTexture(canvas), repeatX, repeatY, true);
  const bumpMap = configureRepeat(new THREE.CanvasTexture(bumpCanvas), repeatX, repeatY, false);
  return { map, bumpMap, roughnessMap: bumpMap };
}

/**
 * Generates procedural perforated non-slip aerospace deck grating & floor track texture.
 */
export function createDeckGratingTextureSet({ repeatX = 4, repeatY = 8 } = {}) {
  const canvas = createSafeCanvas(512, 512);
  const bumpCanvas = createSafeCanvas(512, 512);
  if (!canvas || !bumpCanvas) {
    return {
      map: makeFallbackTexture('#171e2b'),
      bumpMap: makeFallbackTexture('#646464'),
    };
  }

  const ctx = canvas.getContext('2d');
  const btx = bumpCanvas.getContext('2d');

  ctx.fillStyle = '#141a24';
  ctx.fillRect(0, 0, 512, 512);
  btx.fillStyle = '#404040';
  btx.fillRect(0, 0, 512, 512);

  // Structural sub-ribs
  ctx.fillStyle = '#202a3b';
  btx.fillStyle = '#a0a0a0';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(i * 128, 0, 12, 512);
    ctx.fillRect(0, i * 128, 512, 12);
    btx.fillRect(i * 128, 0, 12, 512);
    btx.fillRect(0, i * 128, 512, 12);
  }

  // Non-slip slotted deck perforations
  ctx.fillStyle = '#090d14';
  btx.fillStyle = '#181818';
  for (let gx = 24; gx < 500; gx += 32) {
    for (let gy = 24; gy < 500; gy += 32) {
      if (gx % 128 < 14 || gy % 128 < 14) continue;
      ctx.fillRect(gx, gy, 18, 8);
      btx.fillRect(gx, gy, 18, 8);
    }
  }

  // Center guide walkway rail stripe
  ctx.fillStyle = '#243247';
  ctx.fillRect(216, 0, 80, 512);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
  ctx.fillRect(220, 0, 4, 512);
  ctx.fillRect(288, 0, 4, 512);

  return {
    map: configureRepeat(new THREE.CanvasTexture(canvas), repeatX, repeatY, true),
    bumpMap: configureRepeat(new THREE.CanvasTexture(bumpCanvas), repeatX, repeatY, false),
  };
}

/**
 * Generates quilted acoustic/thermal insulation liner texture for cylindrical lab and crew walls.
 */
export function createThermalQuiltTextureSet({ repeatX = 4, repeatY = 2 } = {}) {
  const canvas = createSafeCanvas(512, 512);
  const bumpCanvas = createSafeCanvas(512, 512);
  if (!canvas || !bumpCanvas) {
    return {
      map: makeFallbackTexture('#1f2b3d'),
      bumpMap: makeFallbackTexture('#787878'),
    };
  }

  const ctx = canvas.getContext('2d');
  const btx = bumpCanvas.getContext('2d');

  ctx.fillStyle = '#1f2b3d';
  ctx.fillRect(0, 0, 512, 512);
  btx.fillStyle = '#787878';
  btx.fillRect(0, 0, 512, 512);

  const step = 64;
  ctx.strokeStyle = 'rgba(74, 102, 138, 0.52)';
  ctx.lineWidth = 3;
  btx.strokeStyle = '#383838';
  btx.lineWidth = 4;

  for (let i = -512; i <= 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + 512, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    btx.beginPath();
    btx.moveTo(i, 0);
    btx.lineTo(i + 512, 512);
    btx.stroke();
    btx.beginPath();
    btx.moveTo(i + 512, 0);
    btx.lineTo(i, 512);
    btx.stroke();
  }

  // Tie-down grommet dots
  for (let x = step / 2; x < 512; x += step) {
    for (let y = step / 2; y < 512; y += step) {
      ctx.fillStyle = '#526d8d';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      btx.fillStyle = '#c4c4c4';
      btx.beginPath();
      btx.arc(x, y, 4, 0, Math.PI * 2);
      btx.fill();
    }
  }

  return {
    map: configureRepeat(new THREE.CanvasTexture(canvas), repeatX, repeatY, true),
    bumpMap: configureRepeat(new THREE.CanvasTexture(bumpCanvas), repeatX, repeatY, false),
  };
}

/**
 * Generates industrial hazard trim stripes (e.g. airlock frames and hatch thresholds).
 */
export function createHazardStripeTexture(repeatX = 4) {
  const canvas = createSafeCanvas(256, 64);
  if (!canvas) return makeFallbackTexture('#f59e0b');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#131720';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#e59a1a';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 24, 64);
    ctx.lineTo(x + 56, 0);
    ctx.lineTo(x + 32, 0);
    ctx.closePath();
    ctx.fill();
  }
  return configureRepeat(new THREE.CanvasTexture(canvas), repeatX, 1, true);
}

/**
 * Creates a crisp live diegetic OLED screen texture that updates cleanly when stations change state.
 */
export function createDiegeticScreenDisplay({
  title = 'KRONOX SYS',
  subtitle = 'STANDBY',
  lines = [],
  accent = '#38bdf8',
  waveformMode = 'orbit',
} = {}) {
  const canvas = createSafeCanvas(512, 288);
  const texture = canvas ? new THREE.CanvasTexture(canvas) : makeFallbackTexture('#06111f');
  if (canvas && THREE.sRGBEncoding !== undefined) {
    texture.encoding = THREE.sRGBEncoding;
  }

  let lastSignature = '';

  function redraw(nextTitle = title, nextSubtitle = subtitle, nextLines = lines, phase = 0) {
    if (!canvas) return;
    const sig = `${nextTitle}|${nextSubtitle}|${(nextLines || []).join(';')}|${Math.round(phase * 4)}`;
    if (sig === lastSignature) return;
    lastSignature = sig;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#050c17';
    ctx.fillRect(0, 0, 512, 288);

    // Subtle instrumentation grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.10)';
    ctx.lineWidth = 1;
    for (let x = 24; x < 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 54);
      ctx.lineTo(x, 268);
      ctx.stroke();
    }
    for (let y = 54; y < 288; y += 32) {
      ctx.beginPath();
      ctx.moveTo(16, y);
      ctx.lineTo(496, y);
      ctx.stroke();
    }

    // Header band
    ctx.fillStyle = '#0c1b30';
    ctx.fillRect(14, 14, 484, 38);
    ctx.fillStyle = accent;
    ctx.fillRect(14, 14, 6, 38);

    ctx.font = 'bold 19px Consolas, monospace';
    ctx.fillStyle = '#eaf4ff';
    ctx.fillText(String(nextTitle).slice(0, 34), 30, 39);

    ctx.font = 'bold 13px Consolas, monospace';
    ctx.fillStyle = accent;
    ctx.fillText(String(nextSubtitle).slice(0, 46), 22, 76);

    // Live vector plot / spectrum graphic
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (waveformMode === 'spectrum') {
      for (let i = 0; i < 42; i++) {
        const px = 22 + i * 11;
        const val =
          0.35 +
          0.45 * Math.exp(-Math.pow((i - 16) / 4.2, 2)) +
          0.3 * Math.exp(-Math.pow((i - 29) / 3.0, 2)) +
          0.08 * Math.sin(i * 0.8 + phase);
        const py = 245 - val * 85;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    } else if (waveformMode === 'tokamak') {
      ctx.arc(385, 175, 58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(385, 175, 34 + Math.sin(phase) * 3, 0, Math.PI * 2);
    } else {
      for (let i = 0; i <= 40; i++) {
        const px = 22 + i * 11.5;
        const py = 198 + Math.sin(i * 0.28 + phase) * 24 * Math.cos(i * 0.11);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Telemetry lines
    ctx.font = '14px Consolas, monospace';
    ctx.fillStyle = '#b9d4ee';
    (nextLines || []).slice(0, 4).forEach((ln, idx) => {
      ctx.fillText(String(ln).slice(0, 48), 22, 104 + idx * 23);
    });

    // Outer bezel hairline
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 492, 268);
    ctx.globalAlpha = 1;

    texture.needsUpdate = true;
  }

  redraw(title, subtitle, lines, 0);
  return { texture, redraw };
}

