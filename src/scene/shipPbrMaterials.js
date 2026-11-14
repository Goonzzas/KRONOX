import * as THREE from 'three';

function createRng(seed = 101) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeDataFallback(r = 128, g = 136, b = 148, a = 255) {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a tangent-space Three.js CanvasTexture normal map from a heightfield callback `(x, y) => [0..1]`.
 */
function buildNormalTexture(size, heightFn, strength = 2.2, repeat = [1, 1], registry = null) {
  const texSize = Math.min(256, size);
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const fb = makeDataFallback(128, 128, 255, 255);
    if (registry) registry.push(fb);
    return fb;
  }
  const c = document.createElement('canvas');
  c.width = texSize;
  c.height = texSize;
  const ctx = c.getContext?.('2d');
  if (!ctx) return makeDataFallback(128, 128, 255, 255);

  const img = ctx.createImageData(texSize, texSize);
  const hMap = new Float32Array(texSize * texSize);
  for (let y = 0; y < texSize; y++) {
    const rowOff = y * texSize;
    for (let x = 0; x < texSize; x++) {
      hMap[rowOff + x] = heightFn(x, y, texSize);
    }
  }
  const d = img.data;
  const last = texSize - 1;
  for (let y = 0; y < texSize; y++) {
    const rowOff = y * texSize;
    const ymOff = (y === 0 ? last : y - 1) * texSize;
    const ypOff = (y === last ? 0 : y + 1) * texSize;
    for (let x = 0; x < texSize; x++) {
      const xm = x === 0 ? last : x - 1;
      const xp = x === last ? 0 : x + 1;
      const dx = (hMap[rowOff + xp] - hMap[rowOff + xm]) * strength;
      const dy = (hMap[ypOff + x] - hMap[ymOff + x]) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1.0);
      const nx = -dx * inv;
      const ny = -dy * inv;
      const nz = inv;
      const idx = (rowOff + x) * 4;
      d[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      d[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  if (registry) registry.push(tex);
  return tex;
}

function buildCanvasTexture(size, drawFn, repeat = [1, 1], isColor = true, registry = null) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const fb = makeDataFallback(isColor ? 96 : 140, isColor ? 108 : 140, isColor ? 124 : 140, 255);
    if (registry) registry.push(fb);
    return fb;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext?.('2d');
  if (ctx) drawFn(ctx, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  if (isColor && 'encoding' in tex && THREE.sRGBEncoding) {
    tex.encoding = THREE.sRGBEncoding;
  }
  tex.needsUpdate = true;
  if (registry) registry.push(tex);
  return tex;
}

function drawRivetsAlongRect(ctx, x, y, w, h, step = 28, color = 'rgba(20,28,38,0.65)') {
  ctx.fillStyle = color;
  for (let px = x + 8; px < x + w - 4; px += step) {
    ctx.fillRect(px, y + 4, 3, 3);
    ctx.fillRect(px, y + h - 7, 3, 3);
  }
  for (let py = y + 18; py < y + h - 10; py += step) {
    ctx.fillRect(x + 4, py, 3, 3);
    ctx.fillRect(x + w - 7, py, 3, 3);
  }
}

let sharedPbrTexturesEntry = null;

function createSharedPbrTextures(seed = 29) {
  const textures = [];
  const rng = createRng(seed);

  // 1. Exterior / Aerospace Titanium Modular Hull Plating
  const hullHeight = (x, y, s) => {
    const gx = Math.floor((x / s) * 6);
    const gy = Math.floor((y / s) * 6);
    const cell = s / 6;
    const lx = x % cell;
    const ly = y % cell;
    if (lx < 2.2 || ly < 2.2) return 0.12; // deep panel seam
    if (lx < 5 || ly < 5 || lx > cell - 4 || ly > cell - 4) return 0.68;
    const hash = ((gx * 73856093) ^ (gy * 19349663)) & 255;
    const base = 0.72 + (hash / 255) * 0.14;
    if ((lx < 9 || lx > cell - 9) && Math.abs((ly % 20) - 10) < 1.6) return 0.92;
    return base;
  };

  const hullColorTex = buildCanvasTexture(512, (g, s) => {
    g.fillStyle = '#cfd8e3';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const shade = Math.round(202 + ((i * 5 + j * 3) % 4) * 4);
        const warmShift = (i + j) % 5 === 0 ? -3 : 3;
        g.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 7 + warmShift})`;
        const px = i * cell;
        const py = j * cell;
        g.fillRect(px + 1, py + 1, cell - 2, cell - 2);
        g.strokeStyle = 'rgba(28, 38, 52, 0.36)';
        g.lineWidth = 1.5;
        g.strokeRect(px + 0.75, py + 0.75, cell - 1.5, cell - 1.5);
        g.fillStyle = 'rgba(255,255,255,0.05)';
        for (let st = 0; st < 6; st++) {
          g.fillRect(px + 8 + rng() * (cell - 32), py + 8 + rng() * (cell - 16), 24, 1);
        }
        drawRivetsAlongRect(g, px, py, cell, cell, 32);
      }
    }
  }, [2, 2], true, textures);

  const hullRoughTex = buildCanvasTexture(512, (g, s) => {
    g.fillStyle = '#707070';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const rVal = Math.round(92 + ((i + j * 2) % 3) * 10);
        g.fillStyle = `rgb(${rVal},${rVal},${rVal})`;
        g.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
        g.strokeStyle = '#b8b8b8';
        g.lineWidth = 2;
        g.strokeRect(i * cell, j * cell, cell, cell);
      }
    }
  }, [2, 2], false, textures);

  const hullNormalTex = buildNormalTexture(256, hullHeight, 1.4, [2, 2], textures);

  const brushedMetalNormalTex = buildNormalTexture(128, (x, y) => {
    return 0.5 + 0.08 * Math.sin(y * 1.35) + 0.04 * Math.cos(x * 0.25);
  }, 0.85, [1, 1], textures);

  // 2. Interior Anti-Slip Diamond / Technical Deck Floor PBR
  const floorHeight = (x, y, s) => {
    const cell = s / 4;
    const lx = x % cell;
    const ly = y % cell;
    if (lx < 3 || ly < 3) return 0.1;
    if (lx > cell * 0.14 && lx < cell * 0.86 && ly > cell * 0.14 && ly < cell * 0.86) {
      const d = ((Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0) && ((x % 6) < 3) && ((y % 6) < 3);
      return d ? 0.88 : 0.52;
    }
    return 0.72;
  };

  const floorColorTex = buildCanvasTexture(512, (g, s) => {
    g.fillStyle = '#1b2432';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const px = i * cell;
        const py = j * cell;
        g.fillStyle = '#2a374b';
        g.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        g.fillStyle = '#17212f';
        g.fillRect(px + 14, py + 14, cell - 28, cell - 28);
        g.fillStyle = '#253447';
        for (let ty = py + 18; ty < py + cell - 20; ty += 10) {
          for (let tx = px + 18; tx < px + cell - 20; tx += 10) {
            g.fillRect(tx + ((ty / 10) % 2) * 3, ty, 5, 3);
          }
        }
        g.fillStyle = '#536880';
        g.fillRect(px + 6, py + 6, 4, 4);
        g.fillRect(px + cell - 10, py + 6, 4, 4);
        g.fillRect(px + 6, py + cell - 10, 4, 4);
        g.fillRect(px + cell - 10, py + cell - 10, 4, 4);
        g.strokeStyle = '#0d141d';
        g.lineWidth = 2;
        g.strokeRect(px + 1, py + 1, cell - 2, cell - 2);
      }
    }
  }, [11, 11], true, textures);

  const floorRoughTex = buildCanvasTexture(256, (g, s) => {
    g.fillStyle = '#606060';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = '#c8c8c8';
        g.fillRect(i * cell + 8, j * cell + 8, cell - 16, cell - 16);
      }
    }
  }, [11, 11], false, textures);

  const floorNormalTex = buildNormalTexture(256, floorHeight, 2.5, [11, 11], textures);

  // 3. Modular Aerospace Bulkhead Wall Cladding PBR
  const wallHeight = (x, y, s) => {
    const colW = s / 4;
    const lx = x % colW;
    if (lx < 3 || lx > colW - 3) return 0.15;
    if (y < 14 || y > s - 14) return 0.78;
    const ly = y % (s / 2);
    if (ly < 3) return 0.2;
    if (lx > colW * 0.16 && lx < colW * 0.84 && ly > 16 && ly < s / 2 - 16) {
      return 0.45 + 0.06 * Math.sin(x * 0.3) * Math.cos(y * 0.3);
    }
    return 0.72;
  };

  const wallColorTex = buildCanvasTexture(512, (g, s) => {
    g.fillStyle = '#627388';
    g.fillRect(0, 0, s, s);
    const colW = s / 4;
    const rowH = s / 2;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const px = col * colW;
        const py = row * rowH;
        g.fillStyle = (col + row) % 2 === 0 ? '#78899e' : '#6d7e93';
        g.fillRect(px + 3, py + 3, colW - 6, rowH - 6);
        g.fillStyle = '#5c6d82';
        g.fillRect(px + 18, py + 24, colW - 36, rowH - 48);
        g.fillStyle = '#334254';
        g.fillRect(px + 3, py + rowH - 18, colW - 6, 12);
        drawRivetsAlongRect(g, px + 2, py + 2, colW - 4, rowH - 4, 30, 'rgba(22,30,40,0.7)');
        g.strokeStyle = '#202b38';
        g.lineWidth = 3;
        g.strokeRect(px + 1, py + 1, colW - 2, rowH - 2);
      }
    }
  }, [3, 1], true, textures);

  const wallNormalTex = buildNormalTexture(256, wallHeight, 2.2, [3, 1], textures);
  const wallRoughTex = buildCanvasTexture(256, (g, s) => {
    g.fillStyle = '#8a8a8a';
    g.fillRect(0, 0, s, s);
    const colW = s / 4;
    const rowH = s / 2;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        g.fillStyle = '#bebebe';
        g.fillRect(col * colW + 10, row * rowH + 12, colW - 20, rowH - 24);
      }
    }
  }, [3, 1], false, textures);

  // 4. Wrinkled Gold MLI Thermal Foil & Superconducting Copper PBR
  const mliNormalTex = buildNormalTexture(256, (x, y) => {
    return 0.5 + 0.25 * Math.sin(x * 0.14 + Math.cos(y * 0.11) * 2.3) + 0.18 * Math.cos(y * 0.19 - Math.sin(x * 0.08) * 1.9);
  }, 2.0, [2, 2], textures);

  // 5. Armored Blast / Elevator Door Texture + Hazard Stripes
  const doorColorTex = buildCanvasTexture(512, (g, s) => {
    g.fillStyle = '#2c3949';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#38485c';
    g.fillRect(16, 18, s - 32, s - 36);
    g.strokeStyle = '#18222e';
    g.lineWidth = 8;
    g.strokeRect(20, 22, s - 40, s - 44);
    g.save();
    g.beginPath();
    g.rect(16, s - 56, s - 32, 26);
    g.clip();
    g.fillStyle = '#1b222c';
    g.fillRect(16, s - 56, s - 32, 26);
    g.fillStyle = '#e09f24';
    for (let x = -40; x < s + 40; x += 36) {
      g.beginPath();
      g.moveTo(x, s - 30);
      g.lineTo(x + 18, s - 30);
      g.lineTo(x + 34, s - 56);
      g.lineTo(x + 16, s - 56);
      g.closePath();
      g.fill();
    }
    g.restore();
    drawRivetsAlongRect(g, 16, 18, s - 32, s - 36, 40);
  }, [1, 1], true, textures);

  // 6. Corrugated ISO Cargo Pod PBR Texture
  const cargoNormalTex = buildNormalTexture(256, (x, y, s) => {
    if (x < 18 || x > s - 18 || y < 18 || y > s - 18) return 0.92;
    return 0.45 + 0.38 * Math.sin((x / s) * Math.PI * 16);
  }, 2.4, [1, 1], textures);

  const cargoRoughTex = buildCanvasTexture(256, (g, s) => {
    g.fillStyle = '#a0a0a0';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#6e6e6e';
    g.strokeRect(8, 8, s - 16, s - 16);
  }, [1, 1], false, textures);

  // 7. Perforated Aerospace Ceiling Coffer + Vent Louvres + Quilted Crew Wall + Hazard Trim
  const ceilingHeight = (x, y, s) => {
    const cell = s / 4;
    const lx = x % cell;
    const ly = y % cell;
    if (lx < 4 || ly < 4 || lx > cell - 4 || ly > cell - 4) return 0.78;
    const hole = (x % 8 < 3) && (y % 8 < 3);
    return hole ? 0.26 : 0.56;
  };
  const ceilingColorTex = buildCanvasTexture(256, (g, s) => {
    g.fillStyle = '#253142';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const px = i * cell;
        const py = j * cell;
        g.fillStyle = '#314156';
        g.fillRect(px + 2, py + 2, cell - 4, cell - 4);
        g.fillStyle = '#1d2736';
        g.fillRect(px + 7, py + 7, cell - 14, cell - 14);
        g.fillStyle = '#131b26';
        for (let hy = py + 11; hy < py + cell - 12; hy += 7) {
          for (let hx = px + 11; hx < px + cell - 12; hx += 7) {
            g.fillRect(hx, hy, 3, 3);
          }
        }
      }
    }
  }, [9, 9], true, textures);
  const ceilingNormalTex = buildNormalTexture(256, ceilingHeight, 1.8, [9, 9], textures);

  const quiltedHeight = (x, y) => {
    const d1 = Math.sin((x + y) * 0.24);
    const d2 = Math.sin((x - y) * 0.24);
    return 0.5 + 0.16 * d1 * d2;
  };
  const quiltedColorTex = buildCanvasTexture(256, (g, s) => {
    g.fillStyle = '#c8d1dc';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(72,88,108,0.34)';
    g.lineWidth = 2;
    for (let i = -s; i < s * 2; i += 32) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke();
      g.beginPath(); g.moveTo(i + s, 0); g.lineTo(i, s); g.stroke();
    }
  }, [6, 3], true, textures);
  const quiltedNormalTex = buildNormalTexture(128, quiltedHeight, 1.4, [6, 3], textures);

  const hazardStripeTex = buildCanvasTexture(256, (g, s) => {
    g.fillStyle = '#18202c';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#d98a1e';
    for (let i = -s; i < s * 2; i += 44) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 22, 0);
      g.lineTo(i + 22 + s, s);
      g.lineTo(i + s, s);
      g.closePath();
      g.fill();
    }
  }, [8, 1], true, textures);

  const ventGrilleNormalTex = buildNormalTexture(128, (_x, y) => {
    return (y % 12) < 4 ? 0.22 : 0.78;
  }, 2.2, [4, 4], textures);

  return {
    refCount: 0,
    list: textures,
    map: {
      hullColorTex,
      hullRoughTex,
      hullNormalTex,
      brushedMetalNormalTex,
      floorColorTex,
      floorRoughTex,
      floorNormalTex,
      wallColorTex,
      wallNormalTex,
      wallRoughTex,
      mliNormalTex,
      doorColorTex,
      cargoNormalTex,
      cargoRoughTex,
      ceilingColorTex,
      ceilingNormalTex,
      quiltedColorTex,
      quiltedNormalTex,
      hazardStripeTex,
      ventGrilleNormalTex,
    },
  };
}

/**
 * Shared procedural PBR texture & material suite for KRONOX exterior and 4 interior decks.
 * Uses reference-counted GPU CanvasTexture caching so hull & interior suites never regenerate
 * or duplicate procedural textures in VRAM.
 */
export function createShipPbrSuite(seed = 29) {
  if (!sharedPbrTexturesEntry) {
    sharedPbrTexturesEntry = createSharedPbrTextures(seed);
  }
  const texEntry = sharedPbrTexturesEntry;
  texEntry.refCount += 1;

  const {
    hullColorTex,
    hullRoughTex,
    hullNormalTex,
    brushedMetalNormalTex,
    floorColorTex,
    floorRoughTex,
    floorNormalTex,
    wallColorTex,
    wallNormalTex,
    wallRoughTex,
    mliNormalTex,
    doorColorTex,
    cargoNormalTex,
    cargoRoughTex,
    ceilingColorTex,
    ceilingNormalTex,
    quiltedColorTex,
    quiltedNormalTex,
    hazardStripeTex,
    ventGrilleNormalTex,
  } = texEntry.map;

  const materials = [];

  const trackMat = (mat) => {
    materials.push(mat);
    return mat;
  };

  // Material instances (reused cleanly across the ship & 4 decks)
  const hullExteriorMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xd4dde7,
    map: hullColorTex,
    normalMap: hullNormalTex,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: hullRoughTex,
    roughness: 0.72,
    metalness: 0.72,
  }));

  const hullExteriorDoubleMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xd4dde7,
    map: hullColorTex,
    normalMap: hullNormalTex,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: hullRoughTex,
    roughness: 0.72,
    metalness: 0.68,
    side: THREE.DoubleSide,
  }));

  const deckFloorMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x384658,
    map: floorColorTex,
    normalMap: floorNormalTex,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap: floorRoughTex,
    roughness: 0.88,
    metalness: 0.56,
  }));

  const bulkheadWallMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xa2b1c4,
    map: wallColorTex,
    normalMap: wallNormalTex,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: wallRoughTex,
    roughness: 0.82,
    metalness: 0.48,
  }));

  const darkTrimMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x1b2431,
    normalMap: brushedMetalNormalTex,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughness: 0.42,
    metalness: 0.74,
  }));

  const brushedSteelMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x99abc0,
    normalMap: brushedMetalNormalTex,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.3,
    metalness: 0.85,
  }));

  const shuttleCompositeMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xdce4ee,
    normalMap: brushedMetalNormalTex,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughness: 0.32,
    metalness: 0.36,
  }));

  const ceilingCofferMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x3b495d,
    map: ceilingColorTex,
    normalMap: ceilingNormalTex,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.72,
    metalness: 0.44,
  }));

  const quiltedHabWallMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xb7c2ce,
    map: quiltedColorTex,
    normalMap: quiltedNormalTex,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.84,
    metalness: 0.08,
  }));

  const ventGrilleMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x263344,
    normalMap: ventGrilleNormalTex,
    normalScale: new THREE.Vector2(1.0, 1.0),
    roughness: 0.46,
    metalness: 0.72,
  }));

  const hazardStripeMat = trackMat(new THREE.MeshStandardMaterial({
    map: hazardStripeTex,
    roughness: 0.54,
    metalness: 0.32,
  }));

  const outerShellInnerWallMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x263242,
    map: wallColorTex,
    normalMap: wallNormalTex,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughness: 0.68,
    metalness: 0.54,
    side: THREE.BackSide,
  }));

  const goldMliMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xdba63a,
    normalMap: mliNormalTex,
    normalScale: new THREE.Vector2(0.95, 0.95),
    metalness: 0.92,
    roughness: 0.24,
  }));

  const copperCoilMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xb86d3b,
    normalMap: mliNormalTex,
    normalScale: new THREE.Vector2(0.55, 0.55),
    metalness: 0.88,
    roughness: 0.28,
  }));

  const armoredDoorMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xb8c6d6,
    map: doorColorTex,
    normalMap: hullNormalTex,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.46,
    metalness: 0.72,
  }));

  const glassViewportMat = trackMat(new THREE.MeshPhysicalMaterial({
    color: 0x5cc4f5,
    transparent: true,
    opacity: 0.16,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    depthWrite: false,
    side: THREE.DoubleSide,
  }));

  const radiatorGrapheneMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x202833,
    normalMap: floorNormalTex,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.38,
    metalness: 0.62,
  }));

  const upholsteryMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x2c3c52,
    roughness: 0.86,
    metalness: 0.08,
  }));

  const safetyAmberMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.42,
    metalness: 0.48,
  }));

  const makeCargoMat = (hex) =>
    trackMat(new THREE.MeshStandardMaterial({
      color: hex,
      normalMap: cargoNormalTex,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: cargoRoughTex,
      roughness: 0.58,
      metalness: 0.52,
    }));

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    materials.forEach((m) => m?.dispose?.());
    texEntry.refCount -= 1;
    if (texEntry.refCount <= 0) {
      texEntry.list.forEach((t) => t?.dispose?.());
      if (sharedPbrTexturesEntry === texEntry) {
        sharedPbrTexturesEntry = null;
      }
    }
  };

  const setAnisotropy = (val = 4) => {
    const next = Math.max(1, Math.min(8, Number(val) || 4));
    for (let i = 0; i < texEntry.list.length; i += 1) {
      const tex = texEntry.list[i];
      if (tex && tex.anisotropy !== next) {
        tex.anisotropy = next;
        tex.needsUpdate = true;
      }
    }
  };

  return {
    textures: {
      hullColorTex,
      hullRoughTex,
      hullNormalTex,
      floorColorTex,
      floorRoughTex,
      floorNormalTex,
      wallColorTex,
      wallNormalTex,
      wallRoughTex,
      mliNormalTex,
      doorColorTex,
      cargoNormalTex,
      cargoRoughTex,
      ceilingColorTex,
      quiltedColorTex,
      hazardStripeTex,
    },
    materials: {
      hullExteriorMat,
      hullExteriorDoubleMat,
      deckFloorMat,
      bulkheadWallMat,
      darkTrimMat,
      brushedSteelMat,
      outerShellInnerWallMat,
      goldMliMat,
      copperCoilMat,
      armoredDoorMat,
      glassViewportMat,
      radiatorGrapheneMat,
      upholsteryMat,
      safetyAmberMat,
      shuttleCompositeMat,
      ceilingCofferMat,
      quiltedHabWallMat,
      ventGrilleMat,
      hazardStripeMat,
    },
    makeCargoMat,
    setAnisotropy,
    dispose,
  };
}

/**
 * Generates crisp procedural CanvasTexture placards for deck & zone signage.
 */
export function makeDeckSignTexture(code, title, subtitle = '', accentHex = '#38d8ff') {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeDataFallback(16, 36, 54, 255);
  }
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext?.('2d');
  if (!g) return makeDataFallback(16, 36, 54, 255);

  g.fillStyle = '#07111d';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = accentHex;
  g.lineWidth = 4;
  g.strokeRect(4, 4, 504, 120);

  g.fillStyle = accentHex;
  g.fillRect(14, 16, 98, 96);
  g.fillStyle = '#04101a';
  g.font = 'bold 42px monospace';
  g.textAlign = 'center';
  g.fillText(code, 63, 79);

  g.textAlign = 'left';
  g.fillStyle = '#f0f8ff';
  g.font = 'bold 28px sans-serif';
  g.fillText(title.slice(0, 26), 130, 58);

  g.fillStyle = '#8dc7e8';
  g.font = '19px monospace';
  g.fillText(subtitle.slice(0, 34), 130, 94);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Live-updatable procedural diegetic screen texture tailored per station role.
 */
export function makeDiegeticScreenTexture(stationId, title, lines, accentHex = '#5ce6ff', stateMeta = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const tex = makeDataFallback(8, 28, 44, 255);
    return { tex, redraw: () => {} };
  }
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext?.('2d');
  const tex = g ? new THREE.CanvasTexture(c) : makeDataFallback(8, 28, 44, 255);
  tex.anisotropy = 4;

  const redraw = (curTitle = title, curLines = lines, curAccent = accentHex, meta = stateMeta) => {
    if (!g) return;
    g.fillStyle = '#030d17';
    g.fillRect(0, 0, 512, 256);

    // Technical grid
    g.strokeStyle = 'rgba(110, 200, 245, 0.12)';
    g.lineWidth = 1;
    for (let x = 0; x <= 512; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
    }
    for (let y = 0; y <= 256; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke();
    }

    // Bezel header bar
    g.strokeStyle = curAccent;
    g.lineWidth = 3;
    g.strokeRect(8, 8, 496, 240);
    g.fillStyle = curAccent;
    g.fillRect(14, 14, 484, 38);

    g.fillStyle = '#03101a';
    g.font = 'bold 20px monospace';
    g.fillText(String(curTitle || '').slice(0, 38), 24, 40);

    // Role-specific graphic widget on right third of screen
    const wx = 342;
    const wy = 68;
    const ww = 148;
    const wh = 166;
    g.strokeStyle = 'rgba(180,230,255,0.28)';
    g.lineWidth = 1.5;
    g.strokeRect(wx, wy, ww, wh);

    if (stationId === 'nav' || stationId === 'missions' || stationId === 'windows') {
      // Polar radar / orbit chart
      const cx = wx + ww / 2;
      const cy = wy + wh / 2;
      [26, 46, 62].forEach((r) => {
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      });
      g.fillStyle = curAccent;
      g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffcf5c';
      g.beginPath(); g.arc(cx + 34, cy - 22, 4.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = curAccent;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 34, cy - 22); g.stroke();
    } else if (stationId === 'science' || stationId === 'sensor-calibration') {
      // Spectral IR bands bar chart
      const bars = meta?.activeScan ? [0.85, 0.62, 0.94, 0.78, 0.55, 0.9] : [0.45, 0.7, 0.52, 0.88, 0.6, 0.72];
      bars.forEach((v, idx) => {
        const bh = Math.round(v * (wh - 30));
        g.fillStyle = idx % 2 === 0 ? curAccent : '#ffbe55';
        g.fillRect(wx + 12 + idx * 21, wy + wh - 12 - bh, 14, bh);
      });
    } else if (stationId === 'engineering') {
      // Tokamak plasma containment bar & power gauge
      const lvl = Number(meta?.powerRatio ?? 0.74);
      g.fillStyle = '#0c2238';
      g.fillRect(wx + 24, wy + 22, 34, wh - 44);
      g.fillStyle = lvl > 0.88 ? '#ff7b47' : curAccent;
      const barH = Math.round((wh - 48) * Math.max(0.15, Math.min(1, lvl)));
      g.fillRect(wx + 26, wy + wh - 24 - barH, 30, barH);
      g.strokeStyle = '#67e8f9';
      g.beginPath();
      g.arc(wx + 105, wy + 84, 30, 0, Math.PI * 2);
      g.stroke();
    } else if (stationId === 'galley') {
      // Water reservoir & O2 indicator bars
      g.fillStyle = '#38bdf8';
      g.fillRect(wx + 20, wy + 40, 32, wh - 56);
      g.fillStyle = '#34d399';
      g.fillRect(wx + 74, wy + 26, 32, wh - 42);
      g.fillStyle = '#dff5ff';
      g.font = '13px monospace';
      g.fillText('H2O', wx + 22, wy + 24);
      g.fillText('O2', wx + 80, wy + 20);
    } else if (stationId === 'elevator') {
      // Deck tower diagram C01..C04
      ['C01', 'C02', 'C03', 'C04'].forEach((lbl, idx) => {
        const fy = wy + 12 + idx * 38;
        const active = meta?.currentFloor === idx;
        g.fillStyle = active ? curAccent : '#0d2236';
        g.fillRect(wx + 18, fy, 112, 30);
        g.fillStyle = active ? '#04101a' : '#bfe8ff';
        g.font = 'bold 17px monospace';
        g.fillText(lbl, wx + 54, fy + 21);
      });
    } else {
      // Telemetry waveform + status bars
      g.strokeStyle = curAccent;
      g.lineWidth = 2.5;
      g.beginPath();
      for (let x = 0; x < ww - 16; x += 6) {
        const py = wy + wh * 0.5 + Math.sin(x * 0.12 + (meta?.tick || 0)) * 32;
        if (x === 0) g.moveTo(wx + 8 + x, py);
        else g.lineTo(wx + 8 + x, py);
      }
      g.stroke();
    }

    // Left telemetry readout lines
    g.fillStyle = '#e2f4ff';
    g.font = '17px monospace';
    const list = Array.isArray(curLines) ? curLines.slice(0, 5) : [];
    list.forEach((line, idx) => {
      g.fillStyle = idx === 0 ? curAccent : '#dff4ff';
      g.fillText(String(line).slice(0, 29), 22, 86 + idx * 34);
    });
    tex.needsUpdate = true;
  };

  redraw(title, lines, accentHex, stateMeta);
  return { tex, redraw };
}

