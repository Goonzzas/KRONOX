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
    g.fillStyle = '#141c27';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const px = i * cell;
        const py = j * cell;
        g.fillStyle = '#283649';
        g.fillRect(px + 3, py + 3, cell - 6, cell - 6);
        g.strokeStyle = '#3b4f68';
        g.lineWidth = 1.5;
        g.strokeRect(px + 5, py + 5, cell - 10, cell - 10);
        g.fillStyle = '#182331';
        g.fillRect(px + 13, py + 13, cell - 26, cell - 26);
        g.fillStyle = '#2d3f56';
        for (let ty = py + 18; ty < py + cell - 20; ty += 9) {
          for (let tx = px + 18; tx < px + cell - 20; tx += 9) {
            g.fillRect(tx + ((ty / 9) % 2) * 3, ty, 5, 3);
          }
        }
        if ((i + j) % 2 === 0) {
          g.fillStyle = 'rgba(56, 189, 248, 0.22)';
          g.fillRect(px + 16, py + cell - 11, cell - 32, 2);
        } else {
          g.fillStyle = 'rgba(245, 158, 11, 0.22)';
          g.fillRect(px + 16, py + 8, cell - 32, 2);
        }
        g.fillStyle = '#68809c';
        g.fillRect(px + 6, py + 6, 4, 4);
        g.fillRect(px + cell - 10, py + 6, 4, 4);
        g.fillRect(px + 6, py + cell - 10, 4, 4);
        g.fillRect(px + cell - 10, py + cell - 10, 4, 4);
        g.strokeStyle = '#0b1119';
        g.lineWidth = 2.5;
        g.strokeRect(px + 1, py + 1, cell - 2, cell - 2);
      }
    }
  }, [11, 11], true, textures);

  const floorRoughTex = buildCanvasTexture(256, (g, s) => {
    g.fillStyle = '#525252';
    g.fillRect(0, 0, s, s);
    const cell = s / 4;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        g.fillStyle = '#bcbcbc';
        g.fillRect(i * cell + 8, j * cell + 8, cell - 16, cell - 16);
      }
    }
  }, [11, 11], false, textures);

  const floorNormalTex = buildNormalTexture(256, floorHeight, 2.6, [11, 11], textures);

  // 3. Modular Aerospace Bulkhead Wall Cladding PBR
  const wallHeight = (x, y, s) => {
    const colW = s / 4;
    const lx = x % colW;
    if (lx < 3 || lx > colW - 3) return 0.14;
    if (y < 14 || y > s - 14) return 0.80;
    const ly = y % (s / 2);
    if (ly < 3) return 0.18;
    if (Math.abs(ly - s / 4) < 2.5) return 0.28;
    if (lx > colW * 0.14 && lx < colW * 0.86 && ly > 16 && ly < s / 2 - 16) {
      return 0.48 + 0.06 * Math.sin(x * 0.3) * Math.cos(y * 0.3);
    }
    return 0.74;
  };

  const wallColorTex = buildCanvasTexture(512, (g, s) => {
    g.fillStyle = '#546579';
    g.fillRect(0, 0, s, s);
    const colW = s / 4;
    const rowH = s / 2;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const px = col * colW;
        const py = row * rowH;
        g.fillStyle = (col + row) % 2 === 0 ? '#76889e' : '#6a7c92';
        g.fillRect(px + 3, py + 3, colW - 6, rowH - 6);
        g.fillStyle = '#57687d';
        g.fillRect(px + 14, py + 20, colW - 28, rowH - 42);
        g.strokeStyle = 'rgba(220, 236, 252, 0.22)';
        g.lineWidth = 1.5;
        g.strokeRect(px + 14, py + 20, colW - 28, rowH - 42);
        g.fillStyle = '#293748';
        g.fillRect(px + 18, py + rowH * 0.5 - 3, colW - 36, 6);
        g.fillStyle = 'rgba(72, 212, 255, 0.32)';
        g.fillRect(px + 24, py + rowH * 0.5 - 1, colW - 48, 2);
        g.fillStyle = '#2c3b4e';
        g.fillRect(px + 3, py + rowH - 18, colW - 6, 13);
        g.fillStyle = '#38495e';
        g.fillRect(px + 3, py + 4, colW - 6, 9);
        drawRivetsAlongRect(g, px + 3, py + 3, colW - 6, rowH - 6, 28, 'rgba(18,26,36,0.75)');
        g.strokeStyle = '#1b2531';
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
    color: 0x26384d,
    normalMap: quiltedNormalTex,
    normalScale: new THREE.Vector2(0.38, 0.38),
    roughness: 0.78,
    metalness: 0.08,
  }));

  const compositePanelMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xd6e0ec,
    normalMap: brushedMetalNormalTex,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughness: 0.44,
    metalness: 0.22,
  }));

  const anodizedSlateMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x233144,
    normalMap: wallNormalTex,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.46,
    metalness: 0.68,
  }));

  const warmHabAccentMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x7b5f47,
    normalMap: brushedMetalNormalTex,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.52,
    metalness: 0.16,
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
      compositePanelMat,
      anodizedSlateMat,
      warmHabAccentMat,
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
    g.fillStyle = '#040e1a';
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
      const cx = wx + ww / 2;
      const cy = wy + wh / 2 - 6;
      [22, 40, 56].forEach((r, idx) => {
        g.strokeStyle = idx === 1 ? curAccent : 'rgba(125, 211, 252, 0.32)';
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      });
      // Ecliptic crosshair axes
      g.strokeStyle = 'rgba(125, 211, 252, 0.25)';
      g.beginPath();
      g.moveTo(wx + 8, cy); g.lineTo(wx + ww - 8, cy);
      g.moveTo(cx, wy + 8); g.lineTo(cx, wy + wh - 24);
      g.stroke();
      // Trajectory transfer arc
      g.strokeStyle = '#ffcf5c';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx - 10, cy + 8, 38, -Math.PI * 0.75, -Math.PI * 0.12);
      g.stroke();
      g.fillStyle = curAccent;
      g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffcf5c';
      g.beginPath(); g.arc(cx + 32, cy - 20, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#93c5fd';
      g.font = 'bold 11px monospace';
      g.fillText('ICRS J2000 · NAV', wx + 12, wy + wh - 8);
    } else if (stationId === 'science') {
      // SPHEREx 0.75-5.0 um spectrophotometric curve + absorption bands
      g.fillStyle = 'rgba(8, 28, 48, 0.85)';
      g.fillRect(wx + 8, wy + 10, ww - 16, wh - 42);
      g.strokeStyle = curAccent;
      g.lineWidth = 2.2;
      g.beginPath();
      const pts = [0.62, 0.74, 0.68, 0.32, 0.78, 0.85, 0.41, 0.89, 0.76, 0.64];
      pts.forEach((v, idx) => {
        const px = wx + 14 + (idx / (pts.length - 1)) * (ww - 28);
        const py = wy + wh - 40 - v * (wh - 64);
        if (idx === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.stroke();
      // Spectral band markers (H2O 3.05um, CO2 4.27um)
      g.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      g.lineWidth = 1;
      [0.33, 0.66].forEach((f) => {
        const bx = wx + 14 + f * (ww - 28);
        g.beginPath(); g.moveTo(bx, wy + 14); g.lineTo(bx, wy + wh - 34); g.stroke();
      });
      g.fillStyle = '#fde68a';
      g.font = 'bold 11px monospace';
      g.fillText('0.75–5.0μm LVF', wx + 12, wy + wh - 10);
    } else if (stationId === 'optical-bench' || stationId === 'sensor-calibration') {
      // Hartmann-Shack interferometric PSF wavefront rings
      const cx = wx + ww / 2;
      const cy = wy + wh / 2 - 8;
      [14, 28, 42, 54].forEach((r, idx) => {
        g.strokeStyle = idx % 2 === 0 ? curAccent : '#fbbf24';
        g.lineWidth = idx === 0 ? 2.5 : 1.4;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      });
      g.fillStyle = '#38bdf8';
      g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#bae6fd';
      g.font = 'bold 11px monospace';
      g.fillText('PSF λ/40 · COLIMADO', wx + 10, wy + wh - 10);
    } else if (stationId === 'engineering') {
      const lvl = Number(meta?.powerRatio ?? 0.78);
      g.fillStyle = '#0c2238';
      g.fillRect(wx + 16, wy + 18, 28, wh - 46);
      g.fillStyle = lvl > 0.88 ? '#ff7b47' : curAccent;
      const barH = Math.round((wh - 50) * Math.max(0.15, Math.min(1, lvl)));
      g.fillRect(wx + 18, wy + wh - 30 - barH, 24, barH);
      // Tokamak magnetic torus cross-section
      g.strokeStyle = '#fb923c';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(wx + 98, wy + 76, 32, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = '#38bdf8';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(wx + 98, wy + 76, 18, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#fed7aa';
      g.font = 'bold 11px monospace';
      g.fillText('D-He³ TOKAMAK', wx + 54, wy + wh - 10);
    } else if (stationId === 'bioponics' || stationId === 'galley') {
      // Closed-loop ECLS & Hydroponic PAR / O2-H2O balance
      g.fillStyle = '#38bdf8';
      g.fillRect(wx + 18, wy + 38, 26, wh - 62);
      g.fillStyle = '#34d399';
      g.fillRect(wx + 60, wy + 24, 26, wh - 48);
      g.fillStyle = '#a78bfa';
      g.fillRect(wx + 102, wy + 46, 26, wh - 70);
      g.fillStyle = '#dff5ff';
      g.font = 'bold 11px monospace';
      g.fillText('H2O', wx + 19, wy + 22);
      g.fillText('O2', wx + 65, wy + 18);
      g.fillText('PAR', wx + 103, wy + 30);
      g.fillStyle = '#6ee7b7';
      g.fillText('ECLS 99.4% NOM', wx + 18, wy + wh - 8);
    } else if (stationId === 'elevator') {
      // Deck tower diagram C01..C04 with active & target deck indicators
      const deckNames = ['PUENTE', 'HABIT.', 'LABOR.', 'HANGAR'];
      ['C01', 'C02', 'C03', 'C04'].forEach((lbl, idx) => {
        const fy = wy + 10 + idx * 38;
        const active = meta?.currentFloor === idx;
        const isTarget = meta?.targetFloor === idx && meta?.targetFloor !== meta?.currentFloor;
        g.fillStyle = active ? curAccent : isTarget ? '#f59e0b' : '#0d2236';
        g.fillRect(wx + 12, fy, 124, 31);
        g.strokeStyle = active ? '#ffffff' : isTarget ? '#fde68a' : 'rgba(110,200,245,0.35)';
        g.lineWidth = 1.5;
        g.strokeRect(wx + 12, fy, 124, 31);
        g.fillStyle = active || isTarget ? '#04101a' : '#bfe8ff';
        g.font = 'bold 16px monospace';
        g.fillText(`${lbl} ${deckNames[idx]}`, wx + 20, fy + 21);
      });
    } else {
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
    g.font = 'bold 17px monospace';
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

/**
 * Creates a lightweight custom GLSL shader material for holographic projections,
 * containment fields, and tactical bridge displays (Fresnel rim + animated scanlines).
 */
export function createHolographicShaderMaterial({
  color = 0x38bdf8,
  accentColor = 0xfbbf24,
  opacity = 0.42,
  scanlineDensity = 42.0,
} = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uAccentColor: { value: new THREE.Color(accentColor) },
    uOpacity: { value: opacity },
    uScanlineDensity: { value: scanlineDensity },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      varying vec3 vLocalPos;
      void main() {
        vLocalPos = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uAccentColor;
      uniform float uOpacity;
      uniform float uScanlineDensity;
      varying vec3 vNormalView;
      varying vec3 vViewPosition;
      varying vec3 vLocalPos;
      void main() {
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalView), viewDir)), 2.1);
        float scan = 0.5 + 0.5 * sin(vLocalPos.y * uScanlineDensity - uTime * 3.6);
        float pulse = 0.5 + 0.5 * sin(uTime * 1.8 + vLocalPos.x * 4.0);
        vec3 col = mix(uColor, uAccentColor, fresnel * 0.35 + pulse * 0.12);
        float alpha = clamp(uOpacity * (0.38 + fresnel * 0.85 + scan * 0.28), 0.06, 0.92);
        gl_FragColor = vec4(col * (1.05 + fresnel * 0.45), alpha);
      }
    `,
  });

  return material;
}


