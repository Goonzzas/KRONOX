import * as THREE from 'three';

function createCanvas(w, h) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function makeSolidDataTex(r, g, b, a = 255) {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function finalizeTexture(canvas, { repeatX = 1, repeatY = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
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
 * Generates clean, large-format aerospace composite wall paneling (matte architectural satin
 * with hair-thin shadow-gap seams and zero noisy dark brick grids or oversized rivets).
 */
export function createCleanCompositePanelMaps({
  baseHex = '#2a303a',
  panelAltHex = '#262c35',
  seamHex = '#171b22',
  accentHex = '#5b8fb9',
  grainStrength = 6,
  repeatX = 2,
  repeatY = 1,
  size = 512,
} = {}) {
  const cMap = createCanvas(size, size);
  const cBump = createCanvas(size, size);
  const cRough = createCanvas(size, size);
  if (!cMap || !cBump || !cRough) {
    return {
      map: makeSolidDataTex(42, 48, 58),
      bumpMap: makeSolidDataTex(128, 128, 128),
      roughnessMap: makeSolidDataTex(178, 178, 178),
    };
  }

  const m = cMap.getContext('2d');
  const b = cBump.getContext('2d');
  const r = cRough.getContext('2d');

  m.fillStyle = baseHex;
  m.fillRect(0, 0, size, size);
  b.fillStyle = '#848484';
  b.fillRect(0, 0, size, size);
  r.fillStyle = '#b4b4b4';
  r.fillRect(0, 0, size, size);

  // Subtle multi-tonal large aerospace cassettes (2 clean vertical strips, 2 horizontal splits)
  const zones = [
    [0, 0, size * 0.5, size * 0.62, baseHex, '#b2b2b2'],
    [size * 0.5, 0, size * 0.5, size * 0.62, panelAltHex, '#bcbcbc'],
    [0, size * 0.62, size, size * 0.38, panelAltHex, '#bababa'],
  ];
  zones.forEach(([x, y, w, h, col, rCol]) => {
    m.fillStyle = col;
    m.fillRect(x + 2, y + 2, w - 4, h - 4);
    r.fillStyle = rCol;
    r.fillRect(x + 2, y + 2, w - 4, h - 4);

    m.strokeStyle = seamHex;
    m.lineWidth = 2;
    m.strokeRect(x + 1, y + 1, w - 2, h - 2);

    b.strokeStyle = '#525252';
    b.lineWidth = 2.5;
    b.strokeRect(x + 1, y + 1, w - 2, h - 2);
  });

  // Deterministic subtle micro-grain (breaks up flat CG look without tiling artifacts)
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 2400; i++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const bw = 2 + rand() * 8;
    const alpha = (rand() * grainStrength) / 255;
    m.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    m.fillRect(gx, gy, bw, 1.5);
  }

  // Thin discrete service dado hairline
  m.fillStyle = accentHex;
  m.globalAlpha = 0.42;
  m.fillRect(14, size * 0.62 - 6, 84, 2);
  m.globalAlpha = 1;

  return {
    map: finalizeTexture(cMap, { repeatX, repeatY, srgb: true }),
    bumpMap: finalizeTexture(cBump, { repeatX, repeatY, srgb: false }),
    roughnessMap: finalizeTexture(cRough, { repeatX, repeatY, srgb: false }),
  };
}

/**
 * Generates woven textile / acoustic upholstery texture for crew berths & padded wall soffits.
 */
export function createWovenTextileMaps({
  baseHex = '#8c5a44',
  threadHex = '#a06c55',
  shadowHex = '#5f3b2c',
  repeatX = 4,
  repeatY = 4,
} = {}) {
  const size = 256;
  const cMap = createCanvas(size, size);
  const cBump = createCanvas(size, size);
  if (!cMap || !cBump) {
    return {
      map: makeSolidDataTex(140, 90, 68),
      bumpMap: makeSolidDataTex(128, 128, 128),
    };
  }
  const m = cMap.getContext('2d');
  const b = cBump.getContext('2d');

  m.fillStyle = baseHex;
  m.fillRect(0, 0, size, size);
  b.fillStyle = '#7c7c7c';
  b.fillRect(0, 0, size, size);

  const pitch = 8;
  for (let y = 0; y < size; y += pitch) {
    m.fillStyle = y % (pitch * 2) === 0 ? threadHex : shadowHex;
    m.globalAlpha = 0.24;
    m.fillRect(0, y, size, 3);
    b.fillStyle = y % (pitch * 2) === 0 ? '#9e9e9e' : '#666666';
    b.fillRect(0, y, size, 3);
  }
  for (let x = 0; x < size; x += pitch) {
    m.fillStyle = x % (pitch * 2) === 0 ? threadHex : shadowHex;
    m.globalAlpha = 0.18;
    m.fillRect(x, 0, 3, size);
    b.fillStyle = x % (pitch * 2) === 0 ? '#a4a4a4' : '#686868';
    b.fillRect(x, 0, 3, size);
  }
  m.globalAlpha = 1;

  // Quilted horizontal acoustic baffle ribs
  for (let y = 64; y < size; y += 64) {
    m.fillStyle = shadowHex;
    m.globalAlpha = 0.4;
    m.fillRect(0, y - 2, size, 4);
    m.globalAlpha = 1;
    b.fillStyle = '#383838';
    b.fillRect(0, y - 2, size, 4);
  }

  return {
    map: finalizeTexture(cMap, { repeatX, repeatY, srgb: true }),
    bumpMap: finalizeTexture(cBump, { repeatX, repeatY, srgb: false }),
  };
}

/**
 * Generates warm architectural phenolic birch/walnut composite texture for Deck 03 Habitability trim.
 */
export function createPhenolicWoodTrimMaps({
  baseHex = '#7c583c',
  grainHex = '#5d3f29',
  highlightHex = '#966d4d',
  repeatX = 2,
  repeatY = 1,
} = {}) {
  const size = 256;
  const cMap = createCanvas(size, size);
  const cBump = createCanvas(size, size);
  if (!cMap || !cBump) {
    return {
      map: makeSolidDataTex(124, 88, 60),
      bumpMap: makeSolidDataTex(128, 128, 128),
    };
  }
  const m = cMap.getContext('2d');
  const b = cBump.getContext('2d');

  m.fillStyle = baseHex;
  m.fillRect(0, 0, size, size);
  b.fillStyle = '#828282';
  b.fillRect(0, 0, size, size);

  for (let i = 0; i < 64; i++) {
    const y = (i / 64) * size;
    const isDark = i % 3 === 0;
    m.fillStyle = isDark ? grainHex : highlightHex;
    m.globalAlpha = isDark ? 0.25 : 0.14;
    m.fillRect(0, y, size, 2 + (i % 2));
    b.fillStyle = isDark ? '#707070' : '#909090';
    b.fillRect(0, y, size, 2);
  }
  m.globalAlpha = 1;

  return {
    map: finalizeTexture(cMap, { repeatX, repeatY, srgb: true }),
    bumpMap: finalizeTexture(cBump, { repeatX, repeatY, srgb: false }),
  };
}

/**
 * Generates multi-tone architectural floor deck surface (non-slip slotted walkway tiles with subtle wear).
 */
export function createTechnicalDeckFloorMaps({
  baseHex = '#232830',
  girderHex = '#2e3540',
  stripeHex = '#c88722',
  repeatX = 3,
  repeatY = 6,
} = {}) {
  const size = 512;
  const cMap = createCanvas(size, size);
  const cBump = createCanvas(size, size);
  const cRough = createCanvas(size, size);
  if (!cMap || !cBump || !cRough) {
    return {
      map: makeSolidDataTex(35, 40, 48),
      bumpMap: makeSolidDataTex(100, 100, 100),
      roughnessMap: makeSolidDataTex(155, 155, 155),
    };
  }

  const m = cMap.getContext('2d');
  const b = cBump.getContext('2d');
  const r = cRough.getContext('2d');

  m.fillStyle = baseHex;
  m.fillRect(0, 0, size, size);
  b.fillStyle = '#787878';
  b.fillRect(0, 0, size, size);
  r.fillStyle = '#b4b4b4';
  r.fillRect(0, 0, size, size);

  // Flush deck plate joints
  m.fillStyle = girderHex;
  b.fillStyle = '#a4a4a4';
  r.fillStyle = '#929292';
  for (let i = 0; i < 4; i++) {
    m.fillRect(i * 128, 0, 8, size);
    m.fillRect(0, i * 128, size, 8);
    b.fillRect(i * 128, 0, 8, size);
    b.fillRect(0, i * 128, size, 8);
  }

  // Subtle recessed non-slip traction slots
  m.fillStyle = '#14171c';
  b.fillStyle = '#383838';
  r.fillStyle = '#cfcfcf';
  for (let gx = 22; gx < 500; gx += 32) {
    for (let gy = 22; gy < 500; gy += 32) {
      if (gx % 128 < 14 || gy % 128 < 14) continue;
      m.fillRect(gx, gy, 14, 5);
      b.fillRect(gx, gy, 14, 5);
    }
  }

  // Central foot-restraint magnetic track channel
  m.fillStyle = '#2c323b';
  m.fillRect(212, 0, 88, size);
  m.fillStyle = stripeHex;
  m.globalAlpha = 0.45;
  for (let y = 18; y < size; y += 64) {
    m.fillRect(218, y, 3, 20);
    m.fillRect(291, y, 3, 20);
  }
  m.globalAlpha = 1;

  return {
    map: finalizeTexture(cMap, { repeatX, repeatY, srgb: true }),
    bumpMap: finalizeTexture(cBump, { repeatX, repeatY, srgb: false }),
    roughnessMap: finalizeTexture(cRough, { repeatX, repeatY, srgb: false }),
  };
}

/**
 * Generates cleanroom ceramic/micro-perforated acoustic cassette liner (used on vaulted overhead & lab walls).
 */
export function createAcousticLinerMaps({
  baseHex = '#232830',
  ribHex = '#323944',
  perfAlpha = 0.35,
  repeatX = 4,
  repeatY = 2,
} = {}) {
  const size = 512;
  const cMap = createCanvas(size, size);
  const cBump = createCanvas(size, size);
  if (!cMap || !cBump) {
    return {
      map: makeSolidDataTex(35, 40, 48),
      bumpMap: makeSolidDataTex(120, 120, 120),
    };
  }
  const m = cMap.getContext('2d');
  const b = cBump.getContext('2d');

  m.fillStyle = baseHex;
  m.fillRect(0, 0, size, size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 2;
  const cw = size / cols;
  const ch = size / rows;
  for (let ix = 0; ix < cols; ix++) {
    for (let iy = 0; iy < rows; iy++) {
      const px = ix * cw;
      const py = iy * ch;
      m.strokeStyle = ribHex;
      m.lineWidth = 3;
      m.strokeRect(px + 2, py + 2, cw - 4, ch - 4);
      b.strokeStyle = '#606060';
      b.lineWidth = 3;
      b.strokeRect(px + 2, py + 2, cw - 4, ch - 4);

      m.fillStyle = `rgba(10, 12, 16, ${perfAlpha})`;
      b.fillStyle = '#565656';
      for (let mx = px + 16; mx < px + cw - 12; mx += 16) {
        for (let my = py + 16; my < py + ch - 12; my += 16) {
          m.fillRect(mx, my, 1.8, 1.8);
          b.fillRect(mx, my, 1.8, 1.8);
        }
      }
    }
  }

  return {
    map: finalizeTexture(cMap, { repeatX, repeatY, srgb: true }),
    bumpMap: finalizeTexture(cBump, { repeatX, repeatY, srgb: false }),
  };
}

/**
 * Precision M6 optical breadboard honeycomb surface (matte anodized steel, zero specular washout).
 */
export function createOpticalBreadboardMaps({ repeatX = 2, repeatY = 3 } = {}) {
  const size = 256;
  const cMap = createCanvas(size, size);
  const cBump = createCanvas(size, size);
  if (!cMap || !cBump) {
    return {
      map: makeSolidDataTex(44, 48, 54),
      bumpMap: makeSolidDataTex(128, 128, 128),
    };
  }
  const m = cMap.getContext('2d');
  const b = cBump.getContext('2d');
  m.fillStyle = '#30343b';
  m.fillRect(0, 0, size, size);
  b.fillStyle = '#9c9c9c';
  b.fillRect(0, 0, size, size);

  for (let gx = 16; gx < size; gx += 16) {
    for (let gy = 16; gy < size; gy += 16) {
      m.fillStyle = '#121519';
      m.beginPath();
      m.arc(gx, gy, 2.0, 0, Math.PI * 2);
      m.fill();
      b.fillStyle = '#343434';
      b.beginPath();
      b.arc(gx, gy, 2.2, 0, Math.PI * 2);
      b.fill();
    }
  }

  return {
    map: finalizeTexture(cMap, { repeatX, repeatY, srgb: true }),
    bumpMap: finalizeTexture(cBump, { repeatX, repeatY, srgb: false }),
  };
}

/**
 * Generates industrial hazard stripes strictly for EVA hatch thresholds & lower engineering shafts.
 */
export function createHazardStripeMap(repeatX = 4) {
  const c = createCanvas(256, 64);
  if (!c) return makeSolidDataTex(210, 142, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a1d22';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#d49022';
  for (let x = -64; x < 320; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 22, 64);
    ctx.lineTo(x + 54, 0);
    ctx.lineTo(x + 32, 0);
    ctx.closePath();
    ctx.fill();
  }
  return finalizeTexture(c, { repeatX, repeatY: 1, srgb: true });
}

/**
 * Generates realistic ISPR telemetry patchbay front face texture.
 */
export function createAvionicsRackFrontTexture({ label = 'AVIONICS BUS', accent = '#38bdf8' } = {}) {
  const c = createCanvas(256, 512);
  if (!c) return makeSolidDataTex(34, 39, 48);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f242c';
  ctx.fillRect(0, 0, 256, 512);

  const bays = [
    [12, 16, 232, 92],
    [12, 118, 232, 128],
    [12, 256, 232, 112],
    [12, 378, 232, 118],
  ];
  bays.forEach(([x, y, w, h], idx) => {
    ctx.fillStyle = '#29303a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#12151a';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#47505e';
    ctx.fillRect(x + 6, y + 12, 5, h - 24);
    ctx.fillRect(x + w - 11, y + 12, 5, h - 24);

    if (idx === 0) {
      ctx.fillStyle = accent;
      ctx.fillRect(x + 20, y + 14, 5, 22);
      ctx.font = 'bold 14px Consolas, monospace';
      ctx.fillStyle = '#e5ebf2';
      ctx.fillText(label.slice(0, 20), x + 32, y + 30);
      ctx.fillStyle = '#11161d';
      ctx.fillRect(x + 20, y + 46, 192, 32);
      ctx.fillStyle = accent;
      ctx.fillRect(x + 26, y + 58, 120, 4);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(x + 158, y + 54, 12, 12);
    } else if (idx === 1) {
      ctx.fillStyle = '#14181e';
      for (let lx = x + 22; lx < x + w - 28; lx += 12) {
        ctx.fillRect(lx, y + 18, 6, h - 36);
      }
    } else if (idx === 2) {
      for (let i = 0; i < 6; i++) {
        const px = x + 28 + i * 32;
        ctx.fillStyle = '#14181e';
        ctx.fillRect(px, y + 26, 20, 20);
        ctx.fillStyle = i % 2 === 0 ? accent : '#f59e0b';
        ctx.beginPath();
        ctx.arc(px + 10, y + 36, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#525b68';
        ctx.fillRect(px + 2, y + 60, 16, 26);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const gx = x + 42 + i * 48;
        ctx.strokeStyle = '#6c7684';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gx, y + 48, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = accent;
        ctx.beginPath();
        ctx.moveTo(gx, y + 48);
        ctx.lineTo(gx + Math.cos(i * 0.9 - 1.2) * 12, y + 48 + Math.sin(i * 0.9 - 1.2) * 12);
        ctx.stroke();
      }
    }
  });

  return finalizeTexture(c, { repeatX: 1, repeatY: 1, srgb: true });
}

/**
 * KRONOX FASE 2 ARTISTIC PALETTE:
 * Distinct architectural identities per deck (never uniform blue metallic walls),
 * sharing consistent industrial structural ribs, anodized fittings, and calibrated roughness.
 */
export function createSharedInteriorPbrPalette() {
  // Unified KRONOX Aerospace Chassis DNA:
  // 1. Bridge & Spine Structural Charcoal-Titanium Composite
  const graphiteCompositeMaps = createCleanCompositePanelMaps({
    baseHex: '#252b34',
    panelAltHex: '#1f252d',
    seamHex: '#101419',
    accentHex: '#38bdf8',
    repeatX: 2,
    repeatY: 1,
  });

  // 2. Cleanroom Laboratory Matte Titanium-Mist Composite (Deck 02 SPHEREx, controlled low-glare contrast)
  const labCeramicMaps = createCleanCompositePanelMaps({
    baseHex: '#808b99',
    panelAltHex: '#737e8c',
    seamHex: '#46505e',
    accentHex: '#10b981',
    grainStrength: 4,
    repeatX: 2,
    repeatY: 1,
  });

  // 3. Habitability Warm Lunar-Taupe Composite (Deck 03, grounded human-centric warmth without plaster glare)
  const habSandMaps = createCleanCompositePanelMaps({
    baseHex: '#92887a',
    panelAltHex: '#847a6c',
    seamHex: '#524b42',
    accentHex: '#d97706',
    grainStrength: 5,
    repeatX: 2,
    repeatY: 1,
  });

  // 4. Engineering Industrial Graphite-Steel Shielding (Deck 04 Tokamak)
  const engShieldMaps = createCleanCompositePanelMaps({
    baseHex: '#343c48',
    panelAltHex: '#2a313b',
    seamHex: '#15191f',
    accentHex: '#f59e0b',
    grainStrength: 8,
    repeatX: 2,
    repeatY: 1,
  });

  const bridgeFloorMaps = createTechnicalDeckFloorMaps({
    baseHex: '#181c22',
    girderHex: '#252b35',
    stripeHex: '#38bdf8',
    repeatX: 3,
    repeatY: 5,
  });
  const labFloorMaps = createTechnicalDeckFloorMaps({
    baseHex: '#2a313b',
    girderHex: '#38414e',
    stripeHex: '#10b981',
    repeatX: 3,
    repeatY: 5,
  });
  const habFloorMaps = createTechnicalDeckFloorMaps({
    baseHex: '#302b26',
    girderHex: '#403932',
    stripeHex: '#d99322',
    repeatX: 3,
    repeatY: 5,
  });

  const acousticDarkMaps = createAcousticLinerMaps({
    baseHex: '#1a1f26',
    ribHex: '#29303b',
    repeatX: 4,
    repeatY: 2,
  });
  const labAcousticMaps = createAcousticLinerMaps({
    baseHex: '#454f5d',
    ribHex: '#313a46',
    perfAlpha: 0.24,
    repeatX: 4,
    repeatY: 2,
  });
  const habAcousticMaps = createAcousticLinerMaps({
    baseHex: '#524a42',
    ribHex: '#3c3630',
    perfAlpha: 0.2,
    repeatX: 4,
    repeatY: 2,
  });

  const warmTextileMaps = createWovenTextileMaps({
    baseHex: '#824b35',
    threadHex: '#9c5f47',
    shadowHex: '#522c1d',
    repeatX: 3,
    repeatY: 3,
  });
  const sageTextileMaps = createWovenTextileMaps({
    baseHex: '#445d51',
    threadHex: '#587567',
    shadowHex: '#2d3f36',
    repeatX: 3,
    repeatY: 3,
  });
  const phenolicWoodMaps = createPhenolicWoodTrimMaps({ repeatX: 2, repeatY: 1 });
  const breadboardMaps = createOpticalBreadboardMaps({ repeatX: 2, repeatY: 3 });
  const hazardMap = createHazardStripeMap(5);

  return {
    // --- Unified Architectural Structural Skeleton ---
    darkFrame: new THREE.MeshStandardMaterial({
      name: 'PBR_AnodizedGraphiteRibs',
      color: 0x1b2028,
      metalness: 0.66,
      roughness: 0.42,
      side: THREE.DoubleSide,
    }),
    bulkhead: new THREE.MeshStandardMaterial({
      name: 'PBR_GraphiteCompositeCladding',
      map: graphiteCompositeMaps.map,
      bumpMap: graphiteCompositeMaps.bumpMap,
      bumpScale: 0.008,
      roughnessMap: graphiteCompositeMaps.roughnessMap,
      color: 0xcbd2dc,
      metalness: 0.34,
      roughness: 0.58,
      side: THREE.DoubleSide,
    }),
    workSurface: new THREE.MeshStandardMaterial({
      name: 'PBR_SatinWorkComposite',
      color: 0x353e4b,
      metalness: 0.38,
      roughness: 0.42,
      side: THREE.DoubleSide,
    }),
    anodizedGunmetal: new THREE.MeshStandardMaterial({
      name: 'PBR_MachinedGunmetal',
      color: 0x2a313c,
      metalness: 0.74,
      roughness: 0.32,
      side: THREE.DoubleSide,
    }),
    floorDeck: new THREE.MeshStandardMaterial({
      name: 'PBR_SlottedDeckGrating',
      map: bridgeFloorMaps.map,
      bumpMap: bridgeFloorMaps.bumpMap,
      bumpScale: 0.018,
      roughnessMap: bridgeFloorMaps.roughnessMap,
      color: 0xcbd3de,
      metalness: 0.46,
      roughness: 0.56,
      side: THREE.DoubleSide,
    }),
    thermalQuilt: new THREE.MeshStandardMaterial({
      name: 'PBR_AcousticDarkLiner',
      map: acousticDarkMaps.map,
      bumpMap: acousticDarkMaps.bumpMap,
      bumpScale: 0.014,
      color: 0xc5ccd6,
      metalness: 0.08,
      roughness: 0.86,
      side: THREE.DoubleSide,
    }),

    // --- Deck 02 Science Cleanroom Materials ---
    labCeramic: new THREE.MeshStandardMaterial({
      name: 'PBR_LabCleanroomCeramic',
      map: labCeramicMaps.map,
      bumpMap: labCeramicMaps.bumpMap,
      bumpScale: 0.007,
      roughnessMap: labCeramicMaps.roughnessMap,
      color: 0xd0d7e0,
      metalness: 0.16,
      roughness: 0.58,
      side: THREE.DoubleSide,
    }),
    labAcoustic: new THREE.MeshStandardMaterial({
      name: 'PBR_LabCeilingAcoustic',
      map: labAcousticMaps.map,
      bumpMap: labAcousticMaps.bumpMap,
      bumpScale: 0.012,
      color: 0xc2cbd6,
      metalness: 0.12,
      roughness: 0.78,
      side: THREE.DoubleSide,
    }),
    labDeck: new THREE.MeshStandardMaterial({
      name: 'PBR_LabAntiStaticFloor',
      map: labFloorMaps.map,
      bumpMap: labFloorMaps.bumpMap,
      bumpScale: 0.014,
      roughnessMap: labFloorMaps.roughnessMap,
      color: 0xc6ced9,
      metalness: 0.34,
      roughness: 0.56,
      side: THREE.DoubleSide,
    }),
    opticalBreadboard: new THREE.MeshStandardMaterial({
      name: 'PBR_OpticalBreadboardM6',
      map: breadboardMaps.map,
      bumpMap: breadboardMaps.bumpMap,
      bumpScale: 0.016,
      color: 0x262c36,
      metalness: 0.72,
      roughness: 0.34,
    }),

    // --- Deck 03 Habitability Warm Aerospace Materials ---
    habSandstone: new THREE.MeshStandardMaterial({
      name: 'PBR_HabSandstoneWall',
      map: habSandMaps.map,
      bumpMap: habSandMaps.bumpMap,
      bumpScale: 0.007,
      roughnessMap: habSandMaps.roughnessMap,
      color: 0xd4cbc0,
      metalness: 0.08,
      roughness: 0.72,
      side: THREE.DoubleSide,
    }),
    habAcoustic: new THREE.MeshStandardMaterial({
      name: 'PBR_HabWarmCeilingLiner',
      map: habAcousticMaps.map,
      bumpMap: habAcousticMaps.bumpMap,
      bumpScale: 0.012,
      color: 0xcbc2b6,
      metalness: 0.08,
      roughness: 0.82,
      side: THREE.DoubleSide,
    }),
    habFloor: new THREE.MeshStandardMaterial({
      name: 'PBR_HabWarmFloorTile',
      map: habFloorMaps.map,
      bumpMap: habFloorMaps.bumpMap,
      bumpScale: 0.014,
      roughnessMap: habFloorMaps.roughnessMap,
      color: 0xc4bbb0,
      metalness: 0.24,
      roughness: 0.64,
      side: THREE.DoubleSide,
    }),
    habWoodTrim: new THREE.MeshStandardMaterial({
      name: 'PBR_PhenolicTimberTrim',
      map: phenolicWoodMaps.map,
      bumpMap: phenolicWoodMaps.bumpMap,
      bumpScale: 0.008,
      color: 0xa6856a,
      metalness: 0.06,
      roughness: 0.46,
    }),
    habTextileWarm: new THREE.MeshStandardMaterial({
      name: 'PBR_WovenAcousticTerracotta',
      map: warmTextileMaps.map,
      bumpMap: warmTextileMaps.bumpMap,
      bumpScale: 0.02,
      color: 0xd2b9ac,
      metalness: 0.02,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    habTextileSage: new THREE.MeshStandardMaterial({
      name: 'PBR_WovenAcousticSage',
      map: sageTextileMaps.map,
      bumpMap: sageTextileMaps.bumpMap,
      bumpScale: 0.02,
      color: 0xb6c8bf,
      metalness: 0.02,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),

    // --- Deck 04 Engineering Industrial Materials ---
    engShield: new THREE.MeshStandardMaterial({
      name: 'PBR_EngineeringRadiationShield',
      map: engShieldMaps.map,
      bumpMap: engShieldMaps.bumpMap,
      bumpScale: 0.016,
      roughnessMap: engShieldMaps.roughnessMap,
      color: 0xb8c2cf,
      metalness: 0.44,
      roughness: 0.54,
      side: THREE.DoubleSide,
    }),
    darkTitaniumCoil: new THREE.MeshStandardMaterial({
      name: 'PBR_TokamakCoilArmor',
      color: 0x1d242f,
      metalness: 0.76,
      roughness: 0.28,
      side: THREE.DoubleSide,
    }),

    // --- Shared Metals, Optical Coatings, Polymers & Glass ---
    chromePipe: new THREE.MeshStandardMaterial({
      name: 'PBR_BrushedStainlessAlloy',
      color: 0xbcc4cf,
      metalness: 0.84,
      roughness: 0.25,
    }),
    copperPipe: new THREE.MeshStandardMaterial({
      name: 'PBR_CryoCopperManifold',
      color: 0xc2763c,
      metalness: 0.82,
      roughness: 0.28,
    }),
    goldFoil: new THREE.MeshStandardMaterial({
      name: 'PBR_GoldOpticalMLI',
      color: 0xd6a33a,
      metalness: 0.88,
      roughness: 0.24,
    }),
    carbonFiber: new THREE.MeshStandardMaterial({
      name: 'PBR_MatteCarbonPolymer',
      color: 0x191c22,
      metalness: 0.18,
      roughness: 0.74,
    }),
    grabRail: new THREE.MeshStandardMaterial({
      name: 'PBR_AnodizedAmberGrabRail',
      color: 0xd99322,
      metalness: 0.56,
      roughness: 0.32,
      emissive: 0x3b2205,
      emissiveIntensity: 0.12,
    }),
    hazardTrim: new THREE.MeshStandardMaterial({
      name: 'PBR_HazardThreshold',
      map: hazardMap,
      metalness: 0.22,
      roughness: 0.62,
      side: THREE.DoubleSide,
    }),
    darkSeat: new THREE.MeshStandardMaterial({
      name: 'PBR_CrewRestraintUpholstery',
      color: 0x171a20,
      metalness: 0.03,
      roughness: 0.9,
    }),
    viewportGlass: new THREE.MeshPhysicalMaterial({
      name: 'PBR_QuartzObservationViewport',
      color: 0xbbe0f8,
      transparent: true,
      opacity: 0.08,
      roughness: 0.04,
      metalness: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),

    // --- Calibrated Functional Lighting Diffusers ---
    warmDiffuser: new THREE.MeshStandardMaterial({
      name: 'PBR_WarmResidentialDiffuser',
      color: 0xffe4c4,
      emissive: 0xffc68c,
      emissiveIntensity: 0.68,
      roughness: 0.44,
    }),
    coolDiffuser: new THREE.MeshStandardMaterial({
      name: 'PBR_CleanNeutralLabDiffuser',
      color: 0xdcebf7,
      emissive: 0xaed0f0,
      emissiveIntensity: 0.62,
      roughness: 0.42,
    }),
    amberServiceDiffuser: new THREE.MeshStandardMaterial({
      name: 'PBR_AmberMaintenanceDiffuser',
      color: 0xfad7a0,
      emissive: 0xe68a00,
      emissiveIntensity: 0.58,
      roughness: 0.42,
    }),
    accentCyan: new THREE.MeshStandardMaterial({
      name: 'PBR_TelemetryAccentCyan',
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.28,
    }),
    accentEmerald: new THREE.MeshStandardMaterial({
      name: 'PBR_TelemetryAccentEmerald',
      color: 0x34d399,
      emissive: 0x059669,
      emissiveIntensity: 0.58,
      roughness: 0.28,
    }),
    accentAmber: new THREE.MeshStandardMaterial({
      name: 'PBR_TelemetryAccentAmber',
      color: 0xfbbf24,
      emissive: 0xb45309,
      emissiveIntensity: 0.56,
      roughness: 0.28,
    }),
  };
}
