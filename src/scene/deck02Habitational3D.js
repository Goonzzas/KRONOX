import * as THREE from 'three';
import {
  C02_BULKHEAD_ANGLES,
  C02_CABIN_BAYS,
  C02_DINING_ARCS,
  C02_HAB_SUITES,
  radialBayWallFurniturePose,
} from './kronoxInteriorSpatialModel.js';
import { makeDeckSignTexture, makeDiegeticScreenTexture } from './shipPbrMaterials.js';

/**
 * Construye el Nivel 2 completo (`deck-02` · Cubierta Habitacional, Y = 0.0) directamente
 * en coordenadas mundiales KRONOX (-Z = Proa Esclusa EVA, +Z = Popa Biopónica, ±X = Comedores)
 * con arquitectura radial limpia, cero superposiciones 3D, mobiliario adosado a mamparos 1:1
 * y 6 suites habitables interactivas (`HAB-01..HAB-06`).
 */
export function buildDeck02Habitational3D({
  parentGroup,
  floorY = 0.0,
  materials = {},
  earthPhotoMat = null,
  mountDeckPlacard,
  registerColliderMesh,
  registerInteractMesh,
  staticFreezeCandidates,
}) {
  const f = floorY;
  const gDeck = new THREE.Group();
  gDeck.name = 'Deck02HabitationalArchitecture';
  gDeck.userData.deckId = 'deck-02';
  parentGroup.add(gDeck);

  const extraDisposables = [];
  const trackMat = (m) => {
    extraDisposables.push(m);
    return m;
  };
  const trackGeo = (g) => {
    extraDisposables.push(g);
    return g;
  };
  const trackTex = (t) => {
    if (t) extraDisposables.push(t);
    return t;
  };

  const geoCache = new Map();
  const cached = (key, factory) => {
    if (!geoCache.has(key)) geoCache.set(key, trackGeo(factory()));
    return geoCache.get(key);
  };
  const box = (w, h, d) =>
    cached(`b:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d));
  const rbox = (w, h, d, r = 0.03) =>
    cached(`rb:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}`, () => {
      const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
      const pos = geo.attributes.position;
      const hx = Math.max(0.01, w * 0.5 - r);
      const hy = Math.max(0.01, h * 0.5 - r);
      const hz = Math.max(0.01, d * 0.5 - r);
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const cx = Math.max(-hx, Math.min(hx, vx));
        const cy = Math.max(-hy, Math.min(hy, vy));
        const cz = Math.max(-hz, Math.min(hz, vz));
        const dx = vx - cx;
        const dy = vy - cy;
        const dz = vz - cz;
        const len = Math.hypot(dx, dy, dz);
        if (len > 1e-4) {
          pos.setXYZ(i, cx + (dx / len) * r, cy + (dy / len) * r, cz + (dz / len) * r);
        }
      }
      geo.computeVertexNormals();
      return geo;
    });
  const cyl = (rt, rb, h, s = 16) =>
    cached(`c:${rt.toFixed(3)}:${rb.toFixed(3)}:${h.toFixed(3)}:${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
  const sph = (r, ws = 14, hs = 10) =>
    cached(`sp:${r.toFixed(3)}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
  const torus = (r, t, rs = 8, ts = 24) =>
    cached(`t:${r.toFixed(3)}:${t.toFixed(3)}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));

  function buildArcExtrudeGeo(rInner, rOuter, halfAngleRad, height, bevel = 0.012, segs = 28) {
    const shape = new THREE.Shape();
    shape.moveTo(rInner * Math.cos(-halfAngleRad), rInner * Math.sin(-halfAngleRad));
    for (let i = 0; i <= segs; i++) {
      const a = -halfAngleRad + (i / segs) * (halfAngleRad * 2);
      shape.lineTo(rOuter * Math.cos(a), rOuter * Math.sin(a));
    }
    for (let i = segs; i >= 0; i--) {
      const a = -halfAngleRad + (i / segs) * (halfAngleRad * 2);
      shape.lineTo(rInner * Math.cos(a), rInner * Math.sin(a));
    }
    shape.closePath();
    const depth = Math.max(0.01, height - bevel * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0.001,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: segs,
    });
    geo.rotateX(Math.PI / 2);
    // Centrar verticalmente [ -height/2, +height/2 ] respecto al origen de malla
    geo.translate(0, height * 0.5 - bevel, 0);
    return trackGeo(geo);
  }

  function place(parent, geo, mat, x = 0, y = 0, z = 0, colliderKind = null, isDynamic = false) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (isDynamic) m.userData.dynamicTransform = true;
    parent.add(m);
    if (colliderKind && registerColliderMesh) {
      registerColliderMesh(m, colliderKind, 'deck-02');
    }
    if (staticFreezeCandidates && !isDynamic) {
      staticFreezeCandidates.push(m);
    }
    return m;
  }

  function regInteract(mesh, id, kind = 'direct') {
    if (registerInteractMesh && mesh && id) {
      registerInteractMesh(mesh, id, kind, 'deck-02');
    }
  }

  // ==================== TEXTURAS PROCEDURALES PROPIAS DE NIVEL 2 ====================
  function makeWoodPlankTexture(baseHex = '#6e492e', veinHex = '#482d1a') {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = veinHex;
    ctx.globalAlpha = 0.25;
    for (let y = 0; y < 256; y += 32) {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let v = 3; v < 30; v += 7) {
        ctx.beginPath();
        ctx.moveTo(0, y + v);
        ctx.bezierCurveTo(84, y + v + 3, 172, y + v - 3, 256, y + v);
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return trackTex(tex);
  }

  function makeFabricTexture(bgHex = '#233146', lineHex = '#334663') {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = lineHex;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 128; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return trackTex(tex);
  }

  function makeWovenRugTexture(accentHexStr = '#38d8ff') {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 384;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#1d2738';
    ctx.fillRect(0, 0, 256, 384);
    // Marco tejido perimetral
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 14;
    ctx.strokeRect(12, 12, 232, 360);
    ctx.strokeStyle = accentHexStr;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, 208, 336);
    // Patrón chevron geométrico suave
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    for (let y = 36; y < 348; y += 26) {
      ctx.beginPath();
      ctx.moveTo(32, y + 10);
      ctx.lineTo(128, y);
      ctx.lineTo(224, y + 10);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    return trackTex(tex);
  }

  function makeCosmicViewportTexture(bayIdx = 0) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const palettes = [
      ['#020612', '#0b2247', '#38bdf8'],
      ['#030514', '#1f1645', '#fbbf24'],
      ['#020a10', '#0a2d2d', '#34d399'],
      ['#070414', '#271447', '#c084fc'],
      ['#080612', '#2d1c10', '#fb923c'],
      ['#020814', '#0b253f', '#22d3ee'],
    ];
    const [deep, mid, glow] = palettes[bayIdx % palettes.length];
    const bg = ctx.createLinearGradient(0, 0, 512, 256);
    bg.addColorStop(0, deep);
    bg.addColorStop(0.55, mid);
    bg.addColorStop(1, deep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);

    // Banda diagonal de nebulosa / Vía Láctea
    const neb = ctx.createRadialGradient(256 + (bayIdx - 2.5) * 35, 132, 16, 256, 128, 210);
    neb.addColorStop(0, glow);
    neb.addColorStop(0.35, mid);
    neb.addColorStop(1, 'rgba(2, 6, 18, 0)');
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, 512, 256);

    // Campo estelar nítido determinista
    ctx.globalAlpha = 1;
    let seed = 177 + bayIdx * 911;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 240; i++) {
      const sx = rand() * 512;
      const sy = rand() * 256;
      const sr = rand() < 0.08 ? 1.8 : rand() < 0.3 ? 1.1 : 0.65;
      ctx.fillStyle = i % 9 === 0 ? '#bae6fd' : i % 11 === 0 ? '#fde68a' : '#f8fafc';
      ctx.globalAlpha = 0.45 + rand() * 0.55;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    return trackTex(tex);
  }

  function makeMissionPosterTexture(code, title, accentHexStr) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 320;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#09111f';
    ctx.fillRect(0, 0, 256, 320);
    ctx.strokeStyle = accentHexStr;
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, 228, 292);

    // Órbita esquemática + planeta
    const grd = ctx.createRadialGradient(128, 128, 8, 128, 128, 56);
    grd.addColorStop(0, accentHexStr);
    grd.addColorStop(1, '#0f172a');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(128, 128, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(128, 128, 86, 24, -0.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(code, 128, 242);
    ctx.fillStyle = accentHexStr;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(title, 128, 272);
    const tex = new THREE.CanvasTexture(c);
    return trackTex(tex);
  }

  // ==================== PALETA DE MATERIALES ====================
  const {
    wallM,
    darkM,
    steelM,
    goldM,
    copperM,
    doorM,
    bedM,
    warmHabM,
    glassM,
    quiltedM,
    railAmberM,
    cyanGlow,
    amberGlow,
    greenGlow,
    warmGlow,
    uvVioletGlow,
  } = materials;
  const slateM = materials.slateM || darkM;
  const compositeM = materials.compositeM || steelM;

  const oakTex = makeWoodPlankTexture('#7b5336', '#4a2e1a');
  const oakWoodM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9c6e4b,
      map: oakTex || null,
      roughness: 0.56,
      metalness: 0.08,
    })
  );
  const walnutM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x523724,
      map: oakTex || null,
      roughness: 0.52,
      metalness: 0.1,
    })
  );
  const slateFabricTex = makeFabricTexture('#212e42', '#334663');
  const floorTileM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1a2333,
      roughness: 0.68,
      metalness: 0.25,
    })
  );
  const darkScreenFrameM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.45,
      metalness: 0.6,
    })
  );
  const whiteCeramicM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.28,
      metalness: 0.06,
    })
  );
  const cushionCreamM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd9cbb8,
      roughness: 0.85,
      metalness: 0.02,
    })
  );
  const sofaSlateM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2c3b52,
      map: slateFabricTex || null,
      roughness: 0.88,
      metalness: 0.04,
    })
  );
  const brassAccentM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4a459,
      roughness: 0.28,
      metalness: 0.82,
    })
  );
  const terracottaM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7c3f2c,
      roughness: 0.72,
      metalness: 0.05,
    })
  );
  const soilM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x241914,
      roughness: 0.95,
      metalness: 0.0,
    })
  );
  const foliageM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x16803d,
      roughness: 0.64,
      metalness: 0.04,
    })
  );
  const foliageBrightM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22a858,
      roughness: 0.58,
      metalness: 0.03,
    })
  );
  const vegRedM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      roughness: 0.7,
      metalness: 0.05,
    })
  );
  const foodPouchM = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.82,
      roughness: 0.24,
    })
  );
  const bookMats = [0x9a3412, 0x0f766e, 0x1e3a8a, 0xa16207].map((hex) =>
    trackMat(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.62, metalness: 0.08 }))
  );

  // Luces puntuales compartidas para no exceder presupuesto GPU (siguen las 2 suites más cercanas)
  const bayAccentLightA = new THREE.PointLight(0xffcf87, 1.05, 13.0, 1.45);
  bayAccentLightA.position.set(10, f + 2.4, -10);
  gDeck.add(bayAccentLightA);

  const bayAccentLightB = new THREE.PointLight(0x8ae8ff, 0.75, 13.5, 1.45);
  bayAccentLightB.position.set(-10, f + 2.4, 10);
  gDeck.add(bayAccentLightB);

  const handledStationIds = new Set();
  const stationScreenMeshes = {};
  const screenUpdates = {};

  // ==================== HELPERS DE MOBILIARIO SIN SOLAPAMIENTOS ====================
  /** Construye un mueble hueco de 5 caras sin invadir jamás su espacio interior. */
  function buildHollowCabinet(parent, cx, yBase, cz, w, h, d, wallT, outerMat, innerMat, colliderKind = 'wall') {
    const innerH = h - 2 * wallT - 0.004;
    const yMid = yBase + h * 0.5;
    place(parent, box(w, wallT, d), outerMat, cx, yBase + wallT * 0.5, cz, colliderKind);
    place(parent, box(w, wallT, d), outerMat, cx, yBase + h - wallT * 0.5, cz, colliderKind);
    place(parent, box(w, innerH, wallT), innerMat, cx, yMid, cz - d * 0.5 + wallT * 0.5, colliderKind);
    place(
      parent,
      box(wallT, innerH, d - wallT - 0.004),
      outerMat,
      cx - w * 0.5 + wallT * 0.5,
      yMid,
      cz + wallT * 0.5 + 0.001,
      colliderKind
    );
    place(
      parent,
      box(wallT, innerH, d - wallT - 0.004),
      outerMat,
      cx + w * 0.5 - wallT * 0.5,
      yMid,
      cz + wallT * 0.5 + 0.001,
      colliderKind
    );
  }

  function addBookRow(parent, xStart, yShelfTop, zCenter, count = 5, seed = 0) {
    let cursorX = xStart;
    for (let b = 0; b < count; b++) {
      const bw = 0.044 + ((b + seed) % 3) * 0.012;
      const bh = 0.21 + ((b * 2 + seed) % 4) * 0.025;
      const bd = 0.16;
      place(
        parent,
        rbox(bw, bh, bd, 0.006),
        bookMats[(b + seed) % bookMats.length],
        cursorX + bw * 0.5,
        yShelfTop + bh * 0.5 + 0.003,
        zCenter
      );
      cursorX += bw + 0.008;
    }
  }

  function addBioPlanter(parent, cx, yBase, cz, radius = 0.24, height = 0.92, potMat = terracottaM) {
    const potH = height * 0.36;
    place(parent, cyl(radius, radius * 0.78, potH, 16), potMat, cx, yBase + potH * 0.5, cz);
    place(parent, cyl(radius * 0.88, radius * 0.88, 0.02, 14), soilM, cx, yBase + potH + 0.012, cz);
    const stemBaseY = yBase + potH + 0.024;
    const stemH = height * 0.28;
    place(parent, cyl(0.025, 0.036, stemH, 8), walnutM, cx, stemBaseY + stemH * 0.5, cz);
    const crownY = stemBaseY + stemH + 0.06;
    const leafR = radius * 0.44;
    place(parent, sph(leafR * 1.08, 12, 8), foliageM, cx, crownY + leafR * 1.35, cz);
    [0, 2.09, 4.18].forEach((a, idx) => {
      const dist = leafR * 2.12;
      place(
        parent,
        sph(leafR * 0.85, 10, 8),
        idx % 2 === 0 ? foliageBrightM : foliageM,
        cx + Math.cos(a) * dist,
        crownY + idx * 0.025,
        cz + Math.sin(a) * dist
      );
    });
  }

  function addBedsideLamp(parent, cx, yBase, cz, shadeMat) {
    place(parent, cyl(0.085, 0.105, 0.036, 14), brassAccentM, cx, yBase + 0.018, cz);
    place(parent, cyl(0.018, 0.02, 0.19, 10), steelM, cx, yBase + 0.038 + 0.095, cz);
    const shade = place(parent, cyl(0.095, 0.145, 0.18, 16), shadeMat, cx, yBase + 0.232 + 0.09, cz);
    return shade;
  }

  function addCrewLoungeChair(parent, w = 1.44, d = 0.82, cushionMat = sofaSlateM, pillowMat = cushionCreamM) {
    // Patas metálicas esbeltas
    const lx = w * 0.42;
    const lz = d * 0.38;
    [
      [-lx, -lz],
      [lx, -lz],
      [-lx, lz],
      [lx, lz],
    ].forEach(([px, pz]) => {
      place(parent, cyl(0.024, 0.018, 0.12, 8), brassAccentM, px, 0.06, pz);
    });
    // Base estructural de nogal (0.122 .. 0.232)
    place(parent, rbox(w - 0.04, 0.11, d - 0.04, 0.025), walnutM, 0, 0.177, 0, 'console');
    // Brazos laterales (por fuera del ancho de cojines)
    const armW = 0.11;
    const seatW = w - armW * 2 - 0.02;
    [-w * 0.5 + armW * 0.5, w * 0.5 - armW * 0.5].forEach((ax) => {
      place(parent, rbox(armW, 0.34, d - 0.06, 0.03), walnutM, ax, 0.405, -0.01, 'console');
    });
    // Cojín de asiento mullido (strictly above base & between arms)
    place(parent, rbox(seatW, 0.14, d - 0.14, 0.04), cushionMat, 0, 0.305, 0.03);
    // Respaldo inclinado atrás del cojín de asiento
    const back = place(parent, rbox(seatW - 0.02, 0.44, 0.13, 0.04), cushionMat, 0, 0.56, -d * 0.34);
    back.rotation.x = -0.14;
    // Almohadón decorativo apoyado limpio adelante del respaldo
    const throwP = place(parent, rbox(0.32, 0.24, 0.09, 0.03), pillowMat, -seatW * 0.25, 0.50, -0.12);
    throwP.rotation.y = 0.28;
    throwP.rotation.x = -0.22;
  }

  // =========================================================================
  // 1. ARQUITECTURA ANULAR DEL PASILLO, ARCOS Y MAMPAROS RADIALES (k = 0..7)
  // =========================================================================
  // Plintos luminosos circulares de orientación alrededor del pasillo (y < 0.02, cero colisión)
  const guideArcBow = buildArcExtrudeGeo(4.36, 4.42, Math.PI * 0.96, 0.014, 0.002, 48);
  place(gDeck, guideArcBow, cyanGlow, 0, f + 0.009, 0).rotation.y = Math.PI * 0.5;

  // 8 mamparos divisorios radiales entre bahías (r = 6.86 .. 17.65, espesor base 0.20 m)
  C02_BULKHEAD_ANGLES.forEach((a) => {
    const g = new THREE.Group();
    g.rotation.y = -a;
    gDeck.add(g);
    // Alma estructural del mamparo (|x| <= 0.10)
    place(g, box(0.2, 2.96, 10.78), wallM, 0, f + 1.48, -12.25, 'wall');
    // Columnas estructurales montadas limpiamente sobre cada cara (|x| = 0.135)
    [-7.1, -10.5, -13.9, -17.3].forEach((rz) => {
      place(g, box(0.06, 2.94, 0.18), darkM, -0.132, f + 1.47, rz);
      place(g, box(0.06, 2.94, 0.18), darkM, 0.132, f + 1.47, rz);
    });
    // Rodapiés limpios fuera del núcleo de pared
    place(g, box(0.026, 0.14, 10.6), darkM, -0.115, f + 0.072, -12.25);
    place(g, box(0.026, 0.14, 10.6), darkM, 0.115, f + 0.072, -12.25);
    // Arco de soffit en techo del pasillo anular (alineado entre bahías, bajo losa 3.09)
    place(g, rbox(0.18, 0.1, 2.42, 0.02), darkM, 0, f + 2.98, -5.55);
  });

  // 8 luminarias arquitectónicas alineadas al centro de cada bahía sobre el pasillo anular (r = 5.45)
  for (let s = 0; s < 8; s++) {
    const a = (s * Math.PI) / 4;
    const gCorrLight = new THREE.Group();
    gCorrLight.rotation.y = -a;
    gDeck.add(gCorrLight);
    place(gCorrLight, rbox(1.18, 0.05, 0.42, 0.015), darkM, 0, f + 3.01, -5.45);
    place(gCorrLight, box(1.04, 0.02, 0.28), warmGlow, 0, f + 2.972, -5.45);
  }

  // =========================================================================
  // 2. COMEDOR CIRCULAR EN ±X (1:1 con C02_DINING_ARCS) + GALLEY + LOUNGE
  // =========================================================================
  const counterPedGeo = buildArcExtrudeGeo(
    C02_DINING_ARCS.rInner + 0.08,
    C02_DINING_ARCS.rOuter - 0.08,
    C02_DINING_ARCS.halfAngleRad,
    0.754,
    0.015
  );
  const counterTopGeo = buildArcExtrudeGeo(
    C02_DINING_ARCS.rInner,
    C02_DINING_ARCS.rOuter,
    C02_DINING_ARCS.halfAngleRad + 0.025,
    0.07,
    0.016
  );
  const counterGlowGeo = buildArcExtrudeGeo(
    C02_DINING_ARCS.rOuter - 0.055,
    C02_DINING_ARCS.rOuter - 0.018,
    C02_DINING_ARCS.halfAngleRad,
    0.026,
    0.004
  );

  [1, -1].forEach((sideSign) => {
    const barGroup = new THREE.Group();
    barGroup.name = sideSign === 1 ? 'DiningBarStarboard' : 'DiningBarPort';
    barGroup.rotation.y = sideSign === 1 ? 0 : Math.PI;
    gDeck.add(barGroup);

    // Barra curva continua sin uniones solapadas (y = 0.001..0.830)
    place(barGroup, counterPedGeo, slateM, 0, f + 0.378, 0, 'console');
    place(barGroup, counterTopGeo, warmHabM, 0, f + 0.795, 0, 'console');
    place(barGroup, counterGlowGeo, warmGlow, 0, f + 0.73, 0);

    // 3 taburetes estilizados sobre C02_DINING_ARCS.stoolRadius (3.92)
    C02_DINING_ARCS.stoolAnglesFromX.forEach((ang) => {
      const sx = sideSign * C02_DINING_ARCS.stoolRadius * Math.cos(ang);
      const sz = C02_DINING_ARCS.stoolRadius * Math.sin(ang);
      const stool = new THREE.Group();
      stool.position.set(sx, f, sz);
      stool.rotation.y = Math.atan2(-sx, -sz); // Mirando hacia la barra
      gDeck.add(stool);
      place(stool, cyl(0.2, 0.22, 0.03, 16), steelM, 0, 0.015, 0, 'console');
      place(stool, cyl(0.044, 0.06, 0.41, 12), darkM, 0, 0.237, 0, 'console');
      place(stool, torus(0.165, 0.014, 6, 16), steelM, 0, 0.165, 0).rotation.x = Math.PI / 2;
      place(stool, cyl(0.225, 0.205, 0.075, 16), sofaSlateM, 0, 0.483, 0, 'console');
      place(stool, rbox(0.06, 0.12, 0.05, 0.01), steelM, 0, 0.56, -0.17);
      place(stool, rbox(0.28, 0.14, 0.055, 0.02), sofaSlateM, 0, 0.695, -0.17);
    });

    // Bandejas, tazas y detalles culinarios limpios sobre la encimera (y = 0.832, lejos de extremos ±0.52)
    [-0.18, 0.22].forEach((pa, idx) => {
      const rObj = 2.86;
      const px = rObj * Math.cos(pa);
      const pz = rObj * Math.sin(pa);
      place(barGroup, rbox(0.32, 0.016, 0.22, 0.006), slateM, px, f + 0.84, pz).rotation.y = -pa;
      place(barGroup, cyl(0.042, 0.036, 0.095, 12), whiteCeramicM, px - 0.04, f + 0.898, pz + 0.02);
      if (idx === 0) {
        place(barGroup, cyl(0.08, 0.07, 0.03, 12), brassAccentM, px + 0.05, f + 0.865, pz - 0.02);
      } else {
        place(barGroup, cyl(0.035, 0.03, 0.12, 10), glassM, px + 0.06, f + 0.91, pz - 0.02);
      }
    });

    // 2 lámparas colgantes cálidas sobre cada barra (techo y = 3.04 -> y = 2.22, cero colisión peatonal)
    [-0.4, 0.4].forEach((la) => {
      const rx = sideSign * 2.87 * Math.cos(la);
      const rz = 2.87 * Math.sin(la);
      place(gDeck, cyl(0.045, 0.045, 0.03, 12), darkM, rx, f + 3.05, rz);
      place(gDeck, cyl(0.01, 0.01, 0.72, 8), steelM, rx, f + 2.67, rz);
      place(gDeck, cyl(0.11, 0.2, 0.14, 16), brassAccentM, rx, f + 2.23, rz);
      place(gDeck, sph(0.055, 10, 8), warmGlow, rx, f + 2.13, rz);
    });
  });

  // Dispensador Hidratación H2O ('galley') en extremo proa de la barra Estribor (+X, -Z) sobre y = 0.832
  const galleyGroup = new THREE.Group();
  galleyGroup.position.set(2.85, f + 0.832, -1.56);
  galleyGroup.rotation.y = -0.52;
  gDeck.add(galleyGroup);
  const hydBody = place(galleyGroup, rbox(0.46, 0.56, 0.36, 0.025), slateM, 0, 0.282, 0.04, 'console');
  place(galleyGroup, box(0.32, 0.22, 0.04), darkM, 0, 0.23, -0.165);
  const spoutA = place(galleyGroup, cyl(0.022, 0.022, 0.075, 8), steelM, -0.07, 0.3, -0.17);
  const spoutB = place(galleyGroup, cyl(0.022, 0.022, 0.075, 8), cyanGlow, 0.07, 0.3, -0.17);
  place(galleyGroup, cyl(0.048, 0.04, 0.11, 12), whiteCeramicM, 0.07, 0.06, -0.17);
  const galleyStream = place(galleyGroup, cyl(0.012, 0.012, 0.14, 8), cyanGlow, 0.07, 0.19, -0.17, null, true);
  galleyStream.visible = false;
  const galleyScreenTex = makeDiegeticScreenTexture(
    'galley',
    'COMEDOR Y H₂O · C02',
    ['RESERVA MINERAL: 98.4%', 'TEMPERATURA: 6.2 °C', 'PULSA [E] PARA DISPENSAR'],
    '#ffc66d'
  );
  trackTex(galleyScreenTex.tex);
  const galleyScrMat = trackMat(new THREE.MeshBasicMaterial({ map: galleyScreenTex.tex }));
  const galleyScrMesh = place(galleyGroup, box(0.38, 0.2, 0.025), galleyScrMat, 0, 0.45, -0.158);
  galleyScrMesh.rotation.x = 0.16;
  regInteract(hydBody, 'galley', 'direct');
  regInteract(spoutA, 'galley', 'direct');
  regInteract(spoutB, 'galley', 'direct');
  regInteract(galleyScrMesh, 'galley', 'direct');
  handledStationIds.add('galley');
  stationScreenMeshes.galley = galleyScrMesh;
  screenUpdates.galley = (t, l, m) => galleyScreenTex.redraw(t, l, '#ffc66d', m);

  // Sintetizador de Café y Raciones ('galley-synth') en extremo popa de la barra Estribor (+X, +Z)
  const synthGroup = new THREE.Group();
  synthGroup.position.set(2.85, f + 0.832, 1.56);
  synthGroup.rotation.y = 0.52;
  gDeck.add(synthGroup);
  const synthBody = place(synthGroup, rbox(0.5, 0.54, 0.38, 0.025), darkM, 0, 0.272, 0.04, 'console');
  const synthLedMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x64748b }));
  const synthLed = place(synthGroup, box(0.38, 0.036, 0.025), synthLedMat, 0, 0.49, -0.165);
  const synthCup = place(synthGroup, cyl(0.052, 0.044, 0.12, 14), copperM, -0.08, 0.062, -0.18, null, true);
  place(synthGroup, rbox(0.15, 0.07, 0.14, 0.015), foodPouchM, 0.1, 0.037, -0.18);
  const synthTex = makeDiegeticScreenTexture(
    'galley-synth',
    'SINTETIZADOR CULINARIO',
    ['MENÚ: CAFÉ ORBITAL / RACIÓN', 'ESTADO: EN REPOSO', 'PULSA [E] PARA PREPARAR'],
    '#fbbf24'
  );
  trackTex(synthTex.tex);
  const synthScr = place(
    synthGroup,
    box(0.4, 0.21, 0.025),
    trackMat(new THREE.MeshBasicMaterial({ map: synthTex.tex })),
    0,
    0.34,
    -0.165
  );
  regInteract(synthBody, 'galley-synth', 'direct');
  regInteract(synthCup, 'galley-synth', 'direct');
  regInteract(synthLed, 'galley-synth', 'direct');
  regInteract(synthScr, 'galley-synth', 'direct');
  handledStationIds.add('galley-synth');
  stationScreenMeshes['galley-synth'] = synthScr;
  screenUpdates['galley-synth'] = (t, l, m) => synthTex.redraw(t, l, '#fbbf24', m);

  // Consola Ambiental y Lounge Musical en barra Babor (-X)
  const loungeGroup = new THREE.Group();
  loungeGroup.position.set(-2.85, f + 0.832, 0.0);
  gDeck.add(loungeGroup);
  const loungeBase = place(loungeGroup, rbox(0.44, 0.1, 0.78, 0.025), darkScreenFrameM, 0, 0.052, 0, 'console');
  const loungeEqualizerMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xa78bfa }));
  const loungeBars = [-0.22, -0.11, 0.0, 0.11, 0.22].map((bz, idx) =>
    place(loungeGroup, box(0.055, 0.14 + (idx % 2) * 0.07, 0.055), loungeEqualizerMat, 0.06, 0.21, bz, null, true)
  );
  const loungeTex = makeDiegeticScreenTexture(
    'lounge-audio-c02',
    'ACÚSTICA LOUNGE',
    ['PISTA: DERIVA SOLAR 432Hz', 'SONIDO ENVOLVENTE C02', 'PULSA [E] PARA REPRODUCIR'],
    '#a78bfa'
  );
  trackTex(loungeTex.tex);
  const loungeScr = place(
    loungeGroup,
    box(0.03, 0.28, 0.46),
    trackMat(new THREE.MeshBasicMaterial({ map: loungeTex.tex })),
    -0.12,
    0.255,
    0
  );
  regInteract(loungeBase, 'lounge-audio-c02', 'direct');
  regInteract(loungeScr, 'lounge-audio-c02', 'direct');
  loungeBars.forEach((b) => regInteract(b, 'lounge-audio-c02', 'direct'));
  handledStationIds.add('lounge-audio-c02');
  stationScreenMeshes['lounge-audio-c02'] = loungeScr;
  screenUpdates['lounge-audio-c02'] = (t, l, m) => loungeTex.redraw(t, l, '#a78bfa', m);

  // =========================================================================
  // 3. MÓDULO BIOPÓNICO A POPA (+Z · Sector k=4) SIN BLOQUE SÓLIDO ENVOLVENTE
  // =========================================================================
  const bioBay = new THREE.Group();
  bioBay.name = 'BioponicsBayAssembly';
  gDeck.add(bioBay);
  const bioponicLightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x7effb2 }));

  [-2.55, 2.55].forEach((bx) => {
    const innerDir = bx > 0 ? -1 : 1;
    // Bastidor abierto: panel trasero, zócalo inferior, corona superior y 3 montantes verticales externos
    place(bioBay, box(0.06, 2.48, 4.18), slateM, bx - innerDir * 0.39, f + 1.24, 11.4, 'wall');
    place(bioBay, box(0.76, 0.22, 4.18), darkM, bx, f + 0.11, 11.4, 'wall');
    place(bioBay, box(0.76, 0.1, 4.18), darkM, bx, f + 2.53, 11.4, 'wall');
    [9.35, 11.4, 13.45].forEach((mz) => {
      place(bioBay, box(0.06, 2.22, 0.08), steelM, bx + innerDir * 0.35, f + 1.35, mz);
    });
    // Columna hidráulica de cobre limpia en extremo exterior
    place(bioBay, cyl(0.11, 0.11, 2.32, 12), copperM, bx - innerDir * 0.26, f + 1.18, 13.56);

    // 3 niveles abiertos visibles con cultivos, luminarias de crecimiento arriba y cristal al pasillo
    [0.48, 1.16, 1.84].forEach((tierY, tierIdx) => {
      place(bioBay, box(0.58, 0.06, 3.86), darkM, bx + innerDir * 0.02, f + tierY, 11.4);
      const lamp = place(bioBay, box(0.42, 0.03, 3.68), bioponicLightMat, bx + innerDir * 0.02, f + tierY + 0.42, 11.4);
      regInteract(lamp, 'bioponics', 'direct');
      for (let p = -1.52; p <= 1.54; p += 0.44) {
        const px = bx + innerDir * 0.03;
        const pz = 11.4 + p;
        // Maceta hidropónica y planta claramente sobre la bandeja y bajo la lámpara
        place(bioBay, cyl(0.09, 0.075, 0.07, 8), soilM, px, f + tierY + 0.07, pz);
        place(
          bioBay,
          sph(0.125, 10, 8),
          (tierIdx + Math.round(p * 3)) % 2 === 0 ? foliageBrightM : vegRedM,
          px,
          f + tierY + 0.21,
          pz
        );
      }
    });
    const bioGlass = place(bioBay, box(0.025, 2.18, 3.92), glassM, bx + innerDir * 0.41, f + 1.35, 11.4);
    regInteract(bioGlass, 'bioponics', 'direct');
  });

  // Pedestal central de telemetría botánica en (0, 0, +12.85)
  const bioConsoleBase = place(bioBay, rbox(0.76, 0.94, 0.72, 0.035), darkM, 0, f + 0.47, 12.85, 'console');
  const bioScreenTex = makeDiegeticScreenTexture(
    'bioponics',
    'INVERNADERO BIOPÓNICO',
    ['CULTIVOS HIDROPÓNICOS C02', 'ESPECTRO 445nm / O₂ +21%', 'PULSA [E] PARA ALTERNAR'],
    '#45e89e'
  );
  trackTex(bioScreenTex.tex);
  const bioScreenMesh = place(
    bioBay,
    box(0.68, 0.42, 0.04),
    trackMat(new THREE.MeshBasicMaterial({ map: bioScreenTex.tex })),
    0,
    f + 1.18,
    12.66
  );
  bioScreenMesh.rotation.x = 0.28;
  regInteract(bioConsoleBase, 'bioponics', 'direct');
  regInteract(bioScreenMesh, 'bioponics', 'direct');
  handledStationIds.add('bioponics');
  stationScreenMeshes.bioponics = bioScreenMesh;
  screenUpdates.bioponics = (t, l, m) => bioScreenTex.redraw(t, l, '#45e89e', m);
  mountDeckPlacard?.(gDeck, 0, f + 2.66, 13.75, Math.PI, 'BIO', 'INVERNADERO BIOPÓNICO', 'SOPORTE VITAL HIDROPÓNICO', '#45e89e');

  // =========================================================================
  // 4. ESCLUSA EVA A PROA (-Z · Sector k=0) — VITRINAS HUECAS ILUMINADAS
  // =========================================================================
  const airlockBeaconMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
  const hatchRing = place(gDeck, torus(1.05, 0.14, 10, 28), steelM, 0, f + 1.38, -16.0);
  const hatchDisc = place(gDeck, cyl(0.95, 0.95, 0.12, 28), doorM, 0, f + 1.38, -15.96, 'wall');
  hatchDisc.rotation.x = Math.PI / 2;
  const airlockBeacon = place(gDeck, box(1.2, 0.075, 0.06), airlockBeaconMat, 0, f + 2.58, -15.84);
  regInteract(hatchRing, 'airlock', 'direct');
  regInteract(hatchDisc, 'airlock', 'direct');
  regInteract(airlockBeacon, 'airlock', 'direct');

  // Vitrinas abiertas con frontal de cristal donde se exhiben claramente ambos trajes EVA
  [-2.35, 2.35].forEach((sx) => {
    const vitrineGroup = new THREE.Group();
    vitrineGroup.position.set(sx, f, -15.35);
    gDeck.add(vitrineGroup);
    buildHollowCabinet(vitrineGroup, 0, 0, 0, 0.88, 2.34, 0.78, 0.045, slateM, darkM, 'wall');
    place(vitrineGroup, box(0.68, 0.025, 0.42), cyanGlow, 0, 2.27, 0.02);
    // Pedestal interno bajo los pies del traje (0.046 .. 0.34)
    place(vitrineGroup, rbox(0.56, 0.28, 0.48, 0.02), steelM, 0, 0.19, 0.02);
    // Botas, piernas, torso blanco, mochila dorada y casco con visor dorado limpios en el volumen abierto
    place(vitrineGroup, rbox(0.14, 0.56, 0.15, 0.02), whiteCeramicM, -0.11, 0.62, 0.02);
    place(vitrineGroup, rbox(0.14, 0.56, 0.15, 0.02), whiteCeramicM, 0.11, 0.62, 0.02);
    place(vitrineGroup, rbox(0.36, 0.54, 0.24, 0.04), whiteCeramicM, 0, 1.2, 0.04);
    place(vitrineGroup, rbox(0.3, 0.48, 0.14, 0.02), copperM, 0, 1.24, -0.17);
    place(vitrineGroup, sph(0.18, 14, 10), whiteCeramicM, 0, 1.72, 0.02);
    place(vitrineGroup, rbox(0.22, 0.13, 0.045, 0.015), goldM, 0, 1.72, 0.228);
    // Cristal frontal limpio delante de todo
    place(vitrineGroup, box(0.76, 2.18, 0.02), glassM, 0, 1.17, 0.38);
  });

  const airlockPed = place(gDeck, rbox(0.76, 0.94, 0.52, 0.03), darkM, 0, f + 0.47, -15.35, 'console');
  const airlockScrTex = makeDiegeticScreenTexture(
    'airlock',
    'ESCLUSA EVA · PROA C02',
    ['PRESIÓN: 101.3 kPa', 'TRAJES EVA: CARGA COMPLETA', 'PULSA [E] PARA PRESURIZAR'],
    '#5be3aa'
  );
  trackTex(airlockScrTex.tex);
  const airlockScrMesh = place(
    gDeck,
    box(0.68, 0.38, 0.03),
    trackMat(new THREE.MeshBasicMaterial({ map: airlockScrTex.tex })),
    0,
    f + 1.16,
    -15.16
  );
  airlockScrMesh.rotation.x = -0.34;
  regInteract(airlockPed, 'airlock', 'direct');
  regInteract(airlockScrMesh, 'airlock', 'direct');
  handledStationIds.add('airlock');
  stationScreenMeshes.airlock = airlockScrMesh;
  screenUpdates.airlock = (t, l, m) => airlockScrTex.redraw(t, l, '#5be3aa', m);
  mountDeckPlacard?.(gDeck, 0, f + 2.74, -15.84, 0, 'EVA', 'ESCLUSA RADIAL DE PROA', 'PRESURIZACIÓN Y TRAJES', '#5be3aa');

  // =========================================================================
  // 5. TAQUILLA DE SUMINISTROS EVA EN PASILLO (`storage-c02`) — CERO CRUCE DE MUROS
  // =========================================================================
  const bay5 = C02_CABIN_BAYS[5];
  const stR = 6.18;
  const stP = -1.78;
  const storageGroup = new THREE.Group();
  storageGroup.name = 'StorageLockerC02';
  storageGroup.position.set(
    bay5.ux * stR + bay5.px * stP,
    f,
    bay5.uz * stR + bay5.pz * stP
  );
  storageGroup.rotation.y = -bay5.angleRad; // Frente (+Z local) mirando hacia el pasillo interior
  gDeck.add(storageGroup);

  // Mueble hueco limpio de 5 paneles (profundidad local z ∈ [-0.26, +0.26])
  buildHollowCabinet(storageGroup, 0, 0, 0, 1.06, 2.02, 0.52, 0.045, slateM, darkM, 'console');
  // Balda divisoria estrictamente entre paredes internas
  place(storageGroup, box(0.95, 0.036, 0.44), steelM, 0, 1.01, 0.02);
  // Botellas de O2 apoyadas en el suelo interior + estuche EVA en la balda superior (sin tocar paredes)
  place(storageGroup, cyl(0.085, 0.085, 0.64, 12), cyanGlow, -0.22, 0.37, 0.02);
  place(storageGroup, cyl(0.085, 0.085, 0.64, 12), goldM, 0.04, 0.37, 0.02);
  place(storageGroup, rbox(0.42, 0.22, 0.3, 0.025), terracottaM, -0.05, 1.15, 0.02);
  place(storageGroup, rbox(0.28, 0.2, 0.26, 0.02), foodPouchM, 0.3, 1.14, 0.02);

  // Puerta abatible limpia montada delante de la apertura (+Z = +0.28)
  const storageDoorPivot = new THREE.Group();
  storageDoorPivot.position.set(-0.5, 1.01, 0.28);
  storageDoorPivot.userData.dynamicTransform = true;
  storageGroup.add(storageDoorPivot);
  const storageDoor = place(storageDoorPivot, rbox(0.96, 1.9, 0.04, 0.015), doorM, 0.5, 0, 0, null, true);
  const storageHandle = place(storageDoorPivot, box(0.05, 0.34, 0.03), cyanGlow, 0.9, 0, 0.038, null, true);

  const storageScrTex = makeDiegeticScreenTexture('storage-c02', 'TAQUILLA EVA', ['SUMINISTROS LISTOS', 'CERRADA'], '#67e8f9');
  trackTex(storageScrTex.tex);
  const storageScr = place(
    storageGroup,
    box(0.3, 0.2, 0.02),
    trackMat(new THREE.MeshBasicMaterial({ map: storageScrTex.tex })),
    0.34,
    1.56,
    0.295
  );
  regInteract(storageDoor, 'storage-c02', 'direct');
  regInteract(storageHandle, 'storage-c02', 'direct');
  regInteract(storageScr, 'storage-c02', 'direct');
  handledStationIds.add('storage-c02');
  stationScreenMeshes['storage-c02'] = storageScr;
  screenUpdates['storage-c02'] = (t, l, m) => storageScrTex.redraw(t, l, '#67e8f9', m);

  // =========================================================================
  // 6. LAS 6 SUITES HABITACIONALES DE LUJO (`HAB-01..HAB-06`) — MAPEO 1:1
  // =========================================================================
  const suiteControllers = [];

  C02_HAB_SUITES.forEach((suite, idx) => {
    const bay = C02_CABIN_BAYS[suite.bayIndex];
    const accentHexStr = `#${suite.accentHex.toString(16).padStart(6, '0')}`;
    const gBay = new THREE.Group();
    gBay.name = `HabitacionalSuite_${suite.code}`;
    gBay.rotation.y = -bay.angleRad;
    gDeck.add(gBay);

    const accentMat = trackMat(new THREE.MeshBasicMaterial({ color: suite.accentHex }));
    const blanketMat = trackMat(new THREE.MeshStandardMaterial({ color: suite.blanketHex, roughness: 0.84 }));
    const pillowMat = trackMat(new THREE.MeshStandardMaterial({ color: suite.pillowHex, roughness: 0.78 }));

    // A) PAVIMENTO Y ALFOMBRA TEJIDA RADIAL (sin invadir mamparos)
    const rugTex = makeWovenRugTexture(accentHexStr);
    const rugMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        map: rugTex || null,
        roughness: 0.92,
      })
    );
    place(gBay, rbox(4.2, 0.014, 7.2, 0.006), rugMat, 0, f + 0.009, -11.95);
    place(gBay, box(2.1, 0.012, 0.42), floorTileM, 0, f + 0.007, -7.28);

    // B) MÓDULO FRONTAL DE ENTRADA (r = 7.0 m · p ∈ [-2.695,-1.155] y [+1.155,+2.695], CERO choque entre suites)
    place(gBay, box(1.54, 2.96, 0.22), wallM, -1.925, f + 1.48, -7.0, 'wall');
    place(gBay, box(1.54, 2.96, 0.22), wallM, 1.925, f + 1.48, -7.0, 'wall');
    // Dintel superior estrictamente entre los muros laterales (ancho 2.29)
    place(gBay, box(2.29, 0.58, 0.22), wallM, 0, f + 2.67, -7.0, 'wall');
    // Jambas verticales de marco en el vano
    place(gBay, box(0.03, 2.37, 0.24), darkM, -1.135, f + 1.185, -7.0);
    place(gBay, box(0.03, 2.37, 0.24), darkM, 1.135, f + 1.185, -7.0);
    // Pilastras de cierre limpio en las esquinas contra el mamparo (r = 7.0)
    place(gBay, box(0.06, 2.94, 0.22), darkM, -2.725, f + 1.47, -7.0);
    place(gBay, box(0.06, 2.94, 0.22), darkM, 2.725, f + 1.47, -7.0);

    // Placa exterior identificativa en pasillo
    const signTex = trackTex(makeDeckSignTexture(suite.code, suite.name || suite.crewRole, suite.specialtyTag || '', accentHexStr));
    const signMat = trackMat(new THREE.MeshBasicMaterial({ map: signTex }));
    place(gBay, box(1.26, 0.34, 0.03), darkM, -1.92, f + 2.08, -6.87);
    place(gBay, box(1.18, 0.28, 0.015), signMat, -1.92, f + 2.08, -6.845);

    const doorLedOuterMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
    place(gBay, box(2.14, 0.038, 0.025), doorLedOuterMat, 0, f + 2.41, -6.875);

    // Hojas corredizas sobre carril interior empotrado en z = -7.145 m (strictly clear of -7.11 solid wall)
    const doorLeft = new THREE.Group();
    doorLeft.position.set(-1.72, f, -7.145);
    doorLeft.userData.dynamicTransform = true;
    gBay.add(doorLeft);
    const doorLPanel = place(doorLeft, box(1.1, 2.32, 0.035), doorM, 0, 1.18, 0, null, true);
    place(doorLeft, box(0.18, 1.8, 0.015), glassM, 0.22, 1.28, -0.028, null, true);

    const doorRight = new THREE.Group();
    doorRight.position.set(1.72, f, -7.145);
    doorRight.userData.dynamicTransform = true;
    gBay.add(doorRight);
    const doorRPanel = place(doorRight, box(1.1, 2.32, 0.035), doorM, 0, 1.18, 0, null, true);
    place(doorRight, box(0.18, 1.8, 0.015), glassM, -0.22, 1.28, -0.028, null, true);

    const doorPadOuter = place(gBay, rbox(0.15, 0.24, 0.035, 0.01), darkM, 1.38, f + 1.24, -6.868);
    const doorPadOuterGlow = place(gBay, box(0.085, 0.11, 0.015), accentMat, 1.38, f + 1.27, -6.842);
    const doorPadInner = place(gBay, rbox(0.15, 0.24, 0.035, 0.01), darkM, -1.38, f + 1.24, -7.132);
    const doorPadInnerGlow = place(gBay, box(0.085, 0.11, 0.015), accentMat, -1.38, f + 1.27, -7.158);
    [doorLPanel, doorRPanel, doorPadOuter, doorPadOuterGlow, doorPadInner, doorPadInnerGlow].forEach((m) =>
      regInteract(m, suite.doorId, 'direct')
    );

    // Listones verticales de madera cálida adosados a cara interior de mamparos ±22.5° (sin penetrarlos)
    [8.8, 12.4, 15.8].forEach((rw) => {
      [-1, 1].forEach((sideSign) => {
        const slatPose = radialBayWallFurniturePose(bay, sideSign, rw, 0.025, f);
        const slatGroup = new THREE.Group();
        slatGroup.position.set(slatPose.localP, f, slatPose.localZ);
        slatGroup.rotation.y = slatPose.localRotY;
        gBay.add(slatGroup);
        [-0.36, -0.18, 0, 0.18, 0.36].forEach((sx) => {
          place(slatGroup, box(0.06, 2.52, 0.022), walnutM, sx, 1.36, 0);
        });
      });
    });

    // B2) CIERRE EXTERIOR CURVADO/OCHO-PUNTOS + VENTANAL CÓSMICO + BANQUETA + BIBLIOTECAS (z ≈ -17.15)
    // Pared frontal del ventanal (ancho 6.60 m en z = -17.15 m)
    place(gBay, box(6.6, 0.78, 0.18), wallM, 0, f + 0.39, -17.15, 'wall');
    place(gBay, box(6.6, 0.56, 0.18), wallM, 0, f + 2.68, -17.15, 'wall');
    place(gBay, box(0.18, 1.59, 0.18), darkM, -3.21, f + 1.58, -17.15, 'wall');
    place(gBay, box(0.18, 1.59, 0.18), darkM, 3.21, f + 1.58, -17.15, 'wall');
    // Parteluces intermedios + 3 cristales limpios
    place(gBay, box(0.08, 1.59, 0.14), steelM, -1.07, f + 1.58, -17.15);
    place(gBay, box(0.08, 1.59, 0.14), steelM, 1.07, f + 1.58, -17.15);
    [-2.14, 0, 2.14].forEach((vx) => {
      place(gBay, box(2.02, 1.56, 0.02), glassM, vx, f + 1.58, -17.15);
    });
    // Vista espacial exterior en caja óptica detrás del cristal (-17.34)
    const spaceTex = makeCosmicViewportTexture(idx);
    const spaceMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: spaceTex ? 0xffffff : 0x0b2247,
        map: spaceTex || null,
      })
    );
    place(gBay, box(6.48, 1.62, 0.03), spaceMat, 0, f + 1.58, -17.34);

    // Dos alas en chaflán conectando (±3.30, -17.15) hasta los mamparos radiales en (±6.68, -16.18)
    [-1, 1].forEach((sideSign) => {
      const wing = new THREE.Group();
      wing.position.set(sideSign * 4.98, f, -16.66);
      wing.rotation.y = sideSign * 0.278;
      gBay.add(wing);
      place(wing, box(3.38, 2.96, 0.18), wallM, 0, 1.48, 0, 'wall');
      // Cuadro artístico espacial enmarcado limpio sobre la pared de chaflán
      const postTex = makeMissionPosterTexture(suite.code, suite.specialtyTag, accentHexStr);
      const postMat = trackMat(
        new THREE.MeshBasicMaterial({ color: postTex ? 0xffffff : suite.accentHex, map: postTex || null })
      );
      place(wing, box(0.92, 1.14, 0.03), darkM, -sideSign * 0.25, 1.62, 0.115);
      place(wing, box(0.84, 1.06, 0.015), postMat, -sideSign * 0.25, 1.62, 0.14);
    });

    // Banqueta panorámica bajo el ventanal (r = 16.72, ancho 4.0)
    place(gBay, rbox(4.0, 0.35, 0.58, 0.02), walnutM, 0, f + 0.175, -16.72, 'console');
    place(gBay, box(3.84, 0.03, 0.03), cyanGlow, 0, f + 0.04, -16.4);
    place(gBay, rbox(3.96, 0.11, 0.56, 0.03), cushionCreamM, 0, f + 0.408, -16.72);
    place(gBay, rbox(0.32, 0.18, 0.36, 0.03), pillowMat, -1.68, f + 0.556, -16.72);
    place(gBay, rbox(0.32, 0.18, 0.36, 0.03), pillowMat, 1.68, f + 0.556, -16.72);

    // Estanterías laterales huecas con libros y vasijas (p = ±2.62, z = -16.72)
    [-1, 1].forEach((sideSign, bIdx) => {
      const shelfGroup = new THREE.Group();
      shelfGroup.position.set(sideSign * 2.62, f, -16.72);
      gBay.add(shelfGroup);
      buildHollowCabinet(shelfGroup, 0, 0, 0, 0.94, 2.16, 0.46, 0.04, walnutM, slateM, 'console');
      [0.64, 1.18, 1.68].forEach((sy, sIdx) => {
        place(shelfGroup, box(0.84, 0.034, 0.4), oakWoodM, 0, sy, 0.015);
        addBookRow(shelfGroup, -0.34, sy + 0.017, 0.02, 5, idx + bIdx + sIdx);
      });
      place(shelfGroup, cyl(0.08, 0.06, 0.18, 10), terracottaM, 0.24, 1.792, 0.02);
    });

    // Dos jardineras altas en los rincones de popa de la habitación
    addBioPlanter(gBay, -4.85, f, -15.85, 0.25, 1.05, terracottaM);
    addBioPlanter(gBay, 4.85, f, -15.85, 0.25, 1.05, darkM);

    // C) PLATAFORMA DE CAMA Y CABECERO ARQUITECTÓNICO (`bed-hab-01..06`, r = 14.1, p = 0)
    const underBedGlowMat = trackMat(new THREE.MeshBasicMaterial({ color: suite.accentHex }));
    // Zócalo oscuro + luces indirectas debajo de cama
    place(gBay, box(1.56, 0.12, 2.34), darkM, 0, f + 0.06, -14.1, 'console');
    place(gBay, box(1.58, 0.028, 0.025), underBedGlowMat, 0, f + 0.08, -12.9);
    // Plataforma de roble + colchón + edredón + almohadas perfectamente apoyadas (sin intersecar)
    place(gBay, rbox(1.74, 0.08, 2.48, 0.02), walnutM, 0, f + 0.162, -14.1, 'console');
    const bedMattress = place(gBay, rbox(1.58, 0.24, 2.32, 0.035), whiteCeramicM, 0, f + 0.324, -14.1, 'console');
    const bedBlanket = place(gBay, rbox(1.6, 0.068, 1.48, 0.025), blanketMat, 0, f + 0.48, -13.66);
    place(gBay, rbox(1.61, 0.025, 0.34, 0.01), cushionCreamM, 0, f + 0.528, -14.18);
    place(gBay, rbox(0.56, 0.11, 0.38, 0.035), pillowMat, -0.38, f + 0.502, -14.88);
    place(gBay, rbox(0.56, 0.11, 0.38, 0.035), pillowMat, 0.38, f + 0.502, -14.88);

    // Cabecero alto continuo detrás de cama + mesillas
    place(gBay, rbox(3.16, 1.98, 0.1, 0.02), walnutM, 0, f + 0.99, -15.42, 'wall');
    place(gBay, rbox(2.04, 1.08, 0.04, 0.015), sofaSlateM, 0, f + 0.94, -15.345);
    const headboardLed = place(gBay, box(2.88, 0.032, 0.022), underBedGlowMat, 0, f + 1.88, -15.355);

    const bedScreenTex = makeDiegeticScreenTexture(
      suite.bedId,
      `${suite.code} · LITERA DESCANSO`,
      [`TITULAR: ${suite.occupant || suite.crewRole}`, 'MODO REPOSO LISTO', 'PULSA [E] / [R] PARA DORMIR'],
      accentHexStr
    );
    trackTex(bedScreenTex.tex);
    const bedHeadMonitor = place(
      gBay,
      box(0.52, 0.26, 0.025),
      trackMat(new THREE.MeshBasicMaterial({ map: bedScreenTex.tex })),
      0,
      f + 1.46,
      -15.32
    );
    regInteract(bedMattress, suite.bedId, 'direct');
    regInteract(bedBlanket, suite.bedId, 'direct');
    regInteract(bedHeadMonitor, suite.bedId, 'direct');

    handledStationIds.add(suite.bedId);
    stationScreenMeshes[suite.bedId] = bedHeadMonitor;
    screenUpdates[suite.bedId] = (t, l, m) => bedScreenTex.redraw(t, l, accentHexStr, m);

    // D) DOS MESILLAS DE NOCHE (p = ±1.20, z = -15.05) + LÁMPARA CIRCADIANA (`lamp-hab-01..06`)
    const lampShadeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffdfad,
        emissive: 0xffc66d,
        emissiveIntensity: 0.72,
        roughness: 0.4,
      })
    );
    [-1.2, 1.2].forEach((nx, nIdx) => {
      place(gBay, rbox(0.46, 0.48, 0.44, 0.025), walnutM, nx, f + 0.24, -15.05, 'console');
      place(gBay, box(0.38, 0.14, 0.02), oakWoodM, nx, f + 0.34, -14.818);
      const shade = addBedsideLamp(gBay, nx, f + 0.482, -15.05, lampShadeMat);
      regInteract(shade, suite.lampId, 'direct');
      if (nIdx === 0) {
        place(gBay, cyl(0.036, 0.03, 0.08, 10), whiteCeramicM, nx + 0.14, f + 0.524, -14.92);
      } else {
        place(gBay, rbox(0.16, 0.028, 0.22, 0.004), bookMats[idx % bookMats.length], nx - 0.12, f + 0.498, -14.92);
      }
    });

    // E) ARMARIO PERSONAL ABIERTO POR DENTRO ADOSADO AL MAMPARO IZQUIERDO (-22.5°, rWall = 14.3)
    const wPose = radialBayWallFurniturePose(bay, -1, 14.3, 0.42, f);
    const wardrobe = new THREE.Group();
    wardrobe.position.set(wPose.localP, f, wPose.localZ);
    wardrobe.rotation.y = wPose.localRotY;
    gBay.add(wardrobe);
    buildHollowCabinet(wardrobe, 0, 0, 0, 1.18, 2.16, 0.72, 0.045, slateM, darkM, 'wall');
    place(wardrobe, box(1.06, 0.03, 0.62), oakWoodM, 0, 1.56, 0.02);
    place(wardrobe, cyl(0.015, 0.015, 1.06, 8), steelM, 0, 1.48, 0.02).rotation.z = Math.PI / 2;
    place(wardrobe, rbox(0.28, 0.88, 0.22, 0.04), whiteCeramicM, -0.24, 1.0, 0.02);
    place(wardrobe, sph(0.135, 10, 8), whiteCeramicM, 0.22, 1.72, 0.04);
    place(wardrobe, rbox(0.32, 0.16, 0.36, 0.02), sofaSlateM, 0.22, 0.13, 0.02);

    const lockerPivot = new THREE.Group();
    lockerPivot.position.set(-0.54, 1.08, 0.38);
    lockerPivot.userData.dynamicTransform = true;
    wardrobe.add(lockerPivot);
    const lockerDoorMesh = place(lockerPivot, rbox(1.08, 2.04, 0.045, 0.015), oakWoodM, 0.54, 0, 0, null, true);
    const lockerHandleMesh = place(lockerPivot, box(0.045, 0.36, 0.04), accentMat, 0.96, 0, 0.036, null, true);
    regInteract(lockerDoorMesh, suite.lockerId, 'direct');
    regInteract(lockerHandleMesh, suite.lockerId, 'direct');

    // F) RINCÓN DE LECTURA (SOFÁ + MESITA + LÁMPARA DE PIE) EN MAMPARO DERECHO (+22.5°, rWall = 14.3)
    const sofaPose = radialBayWallFurniturePose(bay, 1, 14.3, 0.46, f);
    const loungeCorner = new THREE.Group();
    loungeCorner.position.set(sofaPose.localP, f, sofaPose.localZ);
    loungeCorner.rotation.y = sofaPose.localRotY;
    gBay.add(loungeCorner);
    addCrewLoungeChair(loungeCorner, 1.46, 0.82, sofaSlateM, cushionCreamM);
    // Mesita redonda auxiliar limpia delante del sofá (+0.95 m local Z)
    place(loungeCorner, cyl(0.34, 0.34, 0.032, 20), glassM, 0, 0.42, 0.95, 'console');
    place(loungeCorner, cyl(0.03, 0.03, 0.4, 10), brassAccentM, 0, 0.2, 0.95);
    place(loungeCorner, cyl(0.18, 0.2, 0.025, 14), darkM, 0, 0.0125, 0.95);
    place(loungeCorner, cyl(0.042, 0.035, 0.085, 10), whiteCeramicM, 0.08, 0.48, 0.95);

    // G) ESCRITORIO CON ESTANTERÍA INTEGRADA, FOTO DE LA TIERRA Y TABLETA (`tablet-hab-01..06`, rWall = 10.6 +)
    const deskPose = radialBayWallFurniturePose(bay, 1, 10.6, 0.43, f);
    const deskGroup = new THREE.Group();
    deskGroup.position.set(deskPose.localP, f, deskPose.localZ);
    deskGroup.rotation.y = deskPose.localRotY;
    gBay.add(deskGroup);
    // Cajonera izquierda + soporte derecho + tablero de roble limpio
    place(deskGroup, rbox(0.42, 0.72, 0.7, 0.02), darkM, -0.58, 0.36, 0, 'console');
    place(deskGroup, box(0.07, 0.72, 0.68), darkM, 0.74, 0.36, 0, 'console');
    place(deskGroup, rbox(1.64, 0.055, 0.76, 0.02), oakWoodM, 0, 0.748, 0, 'console');
    // Panel trasero integrado con estante superior (ancla la foto de la Tierra sin flotar en el aire)
    place(deskGroup, box(1.58, 1.18, 0.04), walnutM, 0, 1.368, -0.35);
    place(deskGroup, box(1.52, 0.035, 0.22), oakWoodM, 0, 1.88, -0.22);
    if (earthPhotoMat) {
      place(deskGroup, rbox(0.56, 0.56, 0.03, 0.01), darkM, -0.44, 1.38, -0.312);
      place(deskGroup, box(0.48, 0.48, 0.015), earthPhotoMat, -0.44, 1.38, -0.286);
    }
    addBookRow(deskGroup, 0.14, 1.898, -0.22, 4, idx);
    // Silla giratoria limpia delante del escritorio (z = +0.84 m local)
    place(deskGroup, cyl(0.24, 0.24, 0.03, 12), steelM, 0.08, 0.015, 0.84, 'console');
    place(deskGroup, cyl(0.032, 0.032, 0.39, 10), darkM, 0.08, 0.225, 0.84);
    place(deskGroup, rbox(0.46, 0.07, 0.44, 0.02), sofaSlateM, 0.08, 0.46, 0.84);
    place(deskGroup, rbox(0.44, 0.44, 0.06, 0.02), sofaSlateM, 0.08, 0.72, 1.04);

    // Tableta diegética + tasa de café sobre el escritorio
    place(deskGroup, cyl(0.042, 0.036, 0.09, 12), whiteCeramicM, -0.52, 0.822, 0.14);
    const deskShade = addBedsideLamp(deskGroup, 0.58, 0.777, -0.14, lampShadeMat);
    regInteract(deskShade, suite.lampId, 'direct');

    const tabletTex = makeDiegeticScreenTexture(
      suite.tabletId,
      `SUITE ${suite.code}`,
      [`TITULAR: ${suite.occupant || suite.crewRole}`, 'SISTEMAS HAB: NOMINAL', 'PULSA [E] CAMBIAR PÁGINA'],
      accentHexStr
    );
    trackTex(tabletTex.tex);
    const tabletBase = place(deskGroup, rbox(0.42, 0.032, 0.28, 0.01), darkScreenFrameM, 0.1, 0.793, 0.06);
    const tabletScreen = place(
      deskGroup,
      box(0.38, 0.23, 0.018),
      trackMat(new THREE.MeshBasicMaterial({ map: tabletTex.tex })),
      0.1,
      0.88,
      -0.06
    );
    tabletScreen.rotation.x = -0.52;
    regInteract(tabletBase, suite.tabletId, 'direct');
    regInteract(tabletScreen, suite.tabletId, 'direct');

    // H) MÓDULO ESPECIALIZADO ÚNICO EN MAMPARO IZQUIERDO (-22.5°, rWall = 10.6) — TODOS REGISTRADOS EN handledStationIds
    const spPose = radialBayWallFurniturePose(bay, -1, 10.6, 0.42, f);
    const alcoveGroup = new THREE.Group();
    alcoveGroup.position.set(spPose.localP, f, spPose.localZ);
    alcoveGroup.rotation.y = spPose.localRotY;
    gBay.add(alcoveGroup);
    // Panel arquitectónico trasero contra el mamparo
    place(alcoveGroup, box(1.48, 2.26, 0.04), darkM, 0, 1.13, -0.35);
    place(alcoveGroup, box(1.42, 0.03, 0.025), accentMat, 0, 2.22, -0.315);

    const specParts = { kind: suite.specialtyId };
    let specPrimaryMesh = null;

    if (suite.specialtyId === 'aurora-trophy-c02') {
      const ped = place(alcoveGroup, rbox(0.96, 0.86, 0.56, 0.03), walnutM, 0, 0.43, 0.02, 'console');
      const pad = place(alcoveGroup, cyl(0.34, 0.36, 0.04, 24), cyanGlow, 0, 0.882, 0.02);
      const holoMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x38d8ff, wireframe: true, transparent: true, opacity: 0.82 }));
      const modelGroup = new THREE.Group();
      modelGroup.position.set(0, 1.32, 0.02);
      modelGroup.userData.dynamicTransform = true;
      alcoveGroup.add(modelGroup);
      place(modelGroup, torus(0.3, 0.035, 8, 24), holoMat, 0, 0, 0, null, true).rotation.x = Math.PI / 2;
      place(modelGroup, sph(0.145, 12, 8), holoMat, 0, 0, 0, null, true);
      place(modelGroup, cyl(0.032, 0.032, 0.14, 8), goldM, 0, 0, -0.23, null, true).rotation.x = Math.PI / 2;
      place(modelGroup, cyl(0.032, 0.032, 0.14, 8), goldM, 0, 0, 0.23, null, true).rotation.x = Math.PI / 2;
      regInteract(ped, suite.specialtyId, 'direct');
      regInteract(pad, suite.specialtyId, 'direct');
      specPrimaryMesh = pad;
      specParts.holoModel = modelGroup;
    } else if (suite.specialtyId === 'orrery-hab-02') {
      const ped = place(alcoveGroup, rbox(1.06, 0.86, 0.56, 0.03), walnutM, 0, 0.43, 0.02, 'console');
      place(alcoveGroup, cyl(0.04, 0.08, 0.22, 12), brassAccentM, 0, 0.972, 0.02);
      const orreryGroup = new THREE.Group();
      orreryGroup.position.set(0, 1.36, 0.02);
      orreryGroup.userData.dynamicTransform = true;
      alcoveGroup.add(orreryGroup);
      const starCore = place(orreryGroup, sph(0.1, 14, 10), amberGlow, 0, 0, 0, null, true);
      const ringA = place(orreryGroup, torus(0.22, 0.012, 6, 24), goldM, 0, 0, 0, null, true);
      ringA.rotation.x = Math.PI * 0.42;
      const ringB = place(orreryGroup, torus(0.32, 0.012, 6, 24), cyanGlow, 0, 0, 0, null, true);
      ringB.rotation.x = Math.PI * 0.55;
      ringB.rotation.y = 0.4;
      regInteract(ped, suite.specialtyId, 'direct');
      regInteract(starCore, suite.specialtyId, 'direct');
      specPrimaryMesh = starCore;
      specParts.orreryGroup = orreryGroup;
    } else if (suite.specialtyId === 'med-bay-c02') {
      const medBed = place(alcoveGroup, rbox(1.26, 0.72, 0.62, 0.03), whiteCeramicM, 0, 0.36, 0.02, 'console');
      const cushion = place(alcoveGroup, rbox(1.18, 0.08, 0.54, 0.02), sofaSlateM, 0, 0.762, 0.02);
      const medArcMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
      // Pilares de escáner + aro superior elevado (despejado de la camilla)
      place(alcoveGroup, box(0.07, 1.24, 0.09), steelM, -0.69, 0.62, -0.24);
      place(alcoveGroup, box(0.07, 1.24, 0.09), steelM, 0.69, 0.62, -0.24);
      const scanRing = place(alcoveGroup, torus(0.34, 0.03, 8, 24), medArcMat, 0, 1.48, 0.02, null, true);
      scanRing.rotation.x = Math.PI / 2;
      const medTex = makeDiegeticScreenTexture('med-bay-c02', 'ENFERMERÍA C02', ['ESCÁNER BIOMÉDICO', 'PULSA [E] ESCANEAR'], '#45e89e');
      trackTex(medTex.tex);
      const medScr = place(alcoveGroup, box(0.76, 0.46, 0.03), trackMat(new THREE.MeshBasicMaterial({ map: medTex.tex })), 0, 1.66, -0.31);
      regInteract(medBed, suite.specialtyId, 'direct');
      regInteract(cushion, suite.specialtyId, 'direct');
      regInteract(medScr, suite.specialtyId, 'direct');
      specPrimaryMesh = medScr;
      screenUpdates[suite.specialtyId] = (t, l, m) => medTex.redraw(t, l, '#45e89e', m);
      specParts.scanRing = scanRing;
      specParts.medArcMat = medArcMat;
    } else if (suite.specialtyId === 'spec-samples-c02') {
      const caseBase = place(alcoveGroup, rbox(1.14, 0.88, 0.58, 0.03), darkM, 0, 0.44, 0.02, 'console');
      // 3 cilindros de cristal separados alrededor de sus cristales (cero solapamiento con specimen interior)
      const emitterMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xb788ff }));
      const specimen = place(alcoveGroup, sph(0.115, 12, 8), emitterMat, 0, 1.18, 0.02, null, true);
      place(alcoveGroup, cyl(0.24, 0.24, 0.04, 16), steelM, 0, 0.902, 0.02);
      place(alcoveGroup, cyl(0.24, 0.24, 0.04, 16), steelM, 0, 1.42, 0.02);
      place(alcoveGroup, cyl(0.025, 0.025, 0.48, 8), brassAccentM, -0.2, 1.16, -0.06);
      place(alcoveGroup, cyl(0.025, 0.025, 0.48, 8), brassAccentM, 0.2, 1.16, -0.06);
      place(alcoveGroup, sph(0.08, 10, 8), cyanGlow, -0.38, 1.02, 0.02);
      place(alcoveGroup, sph(0.08, 10, 8), amberGlow, 0.38, 1.02, 0.02);
      regInteract(caseBase, suite.specialtyId, 'direct');
      regInteract(specimen, suite.specialtyId, 'direct');
      specPrimaryMesh = specimen;
      specParts.specimen = specimen;
      specParts.emitterMat = emitterMat;
    } else if (suite.specialtyId === 'gym-c02') {
      const frame = place(alcoveGroup, rbox(0.56, 0.14, 1.06, 0.025), slateM, 0, 0.07, 0.24, 'console');
      place(alcoveGroup, box(0.11, 0.82, 0.12), darkM, 0, 0.552, -0.02);
      place(alcoveGroup, box(0.52, 0.07, 0.11), steelM, 0, 1.0, -0.02);
      place(alcoveGroup, box(0.09, 0.68, 0.1), darkM, 0, 0.482, 0.58);
      place(alcoveGroup, rbox(0.28, 0.08, 0.3, 0.025), cushionCreamM, 0, 0.865, 0.58);
      const flywheel = place(alcoveGroup, cyl(0.25, 0.25, 0.08, 20), copperM, -0.14, 0.44, -0.02, null, true);
      flywheel.rotation.z = Math.PI / 2;
      const gymTex = makeDiegeticScreenTexture('gym-c02', 'CICLOERGÓMETRO', ['CARGA MAGNÉTICA 180W', 'PULSA [E] ENTRENAR'], '#ffb347');
      trackTex(gymTex.tex);
      const gymScr = place(alcoveGroup, box(0.38, 0.24, 0.03), trackMat(new THREE.MeshBasicMaterial({ map: gymTex.tex })), 0, 1.16, 0.0);
      gymScr.rotation.x = -0.3;
      regInteract(frame, suite.specialtyId, 'direct');
      regInteract(flywheel, suite.specialtyId, 'direct');
      regInteract(gymScr, suite.specialtyId, 'direct');
      specPrimaryMesh = gymScr;
      screenUpdates[suite.specialtyId] = (t, l, m) => gymTex.redraw(t, l, '#ffb347', m);
      specParts.flywheel = flywheel;
    } else if (suite.specialtyId === 'eva-rack-c02') {
      const rackBase = place(alcoveGroup, rbox(1.12, 0.28, 0.54, 0.025), slateM, 0, 0.14, 0.02, 'console');
      place(alcoveGroup, box(0.06, 1.56, 0.06), steelM, -0.42, 1.06, -0.16);
      place(alcoveGroup, box(0.06, 1.56, 0.06), steelM, 0.42, 1.06, -0.16);
      place(alcoveGroup, box(0.92, 0.05, 0.06), steelM, 0, 1.86, -0.16);
      place(alcoveGroup, rbox(0.42, 0.46, 0.22, 0.03), whiteCeramicM, -0.18, 1.18, 0.04);
      const helmet = place(alcoveGroup, sph(0.175, 14, 10), whiteCeramicM, -0.18, 1.66, 0.04);
      place(alcoveGroup, rbox(0.2, 0.12, 0.045, 0.015), goldM, -0.18, 1.66, 0.242);
      place(alcoveGroup, cyl(0.14, 0.14, 0.18, 12), copperM, 0.26, 0.48, 0.04);
      const evaLightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf97316 }));
      place(alcoveGroup, box(0.68, 0.05, 0.03), evaLightMat, 0, 1.94, -0.16);
      regInteract(rackBase, suite.specialtyId, 'direct');
      regInteract(helmet, suite.specialtyId, 'direct');
      specPrimaryMesh = helmet;
      specParts.evaLightMat = evaLightMat;
    }

    handledStationIds.add(suite.specialtyId);
    if (specPrimaryMesh) {
      stationScreenMeshes[suite.specialtyId] = specPrimaryMesh;
    }

    // I) ARTESONADO DE TECHO PROPIO CON LUZ PERIMETRAL (y = 2.94 .. 3.01, bajo losa 3.09)
    place(gBay, rbox(3.4, 0.05, 5.8, 0.015), darkM, 0, f + 3.0, -12.1);
    const ceilingGlowMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffe4b8 }));
    place(gBay, box(3.2, 0.025, 0.04), ceilingGlowMat, 0, f + 2.96, -9.16);
    place(gBay, box(3.2, 0.025, 0.04), ceilingGlowMat, 0, f + 2.96, -15.04);
    place(gBay, box(0.04, 0.025, 5.6), ceilingGlowMat, -1.73, f + 2.96, -12.1);
    place(gBay, box(0.04, 0.025, 5.6), ceilingGlowMat, 1.73, f + 2.96, -12.1);

    suiteControllers.push({
      suite,
      bay,
      doorLeft,
      doorRight,
      doorLedOuterMat,
      lockerPivot,
      lampShadeMat,
      underBedGlowMat,
      ceilingGlowMat,
      headboardLed,
      tabletTex,
      bedScreenTex,
      specParts,
      lastTabletHash: '',
      lastBedHash: '',
    });
  });

  // =========================================================================
  // 7. BUCLE DE ANIMACIÓN E INTERACTIVIDAD EN TIEMPO REAL
  // =========================================================================
  let lastTabletRefreshAt = -10;

  function update(elapsedTime, mech = {}, astronautPos = null) {
    const targetStorage = mech.storageC02Open ? -Math.PI * 0.58 : 0;
    storageDoorPivot.rotation.y += (targetStorage - storageDoorPivot.rotation.y) * 0.14;

    if (elapsedTime - lastTabletRefreshAt >= 0.75) {
      storageScrTex.redraw(
        'TAQUILLA EVA',
        [mech.storageC02Open ? 'COMPUERTA ABIERTA' : 'COMPUERTA SELLADA', 'BOTELLAS O₂ + HERRAMIENTA', 'PULSA [E] PARA ALTERNAR'],
        '#67e8f9',
        { tick: elapsedTime }
      );
    }

    const hydrating = Boolean(mech.hydrationDispensing);
    galleyStream.visible = hydrating;
    if (hydrating) {
      galleyStream.scale.y = 0.85 + Math.sin(elapsedTime * 16) * 0.15;
    }

    const brewing = Boolean(mech.galleyCoffeeBrewing);
    synthLedMat.color.setHex(brewing ? 0xfbbf24 : 0x475569);
    if (brewing) {
      synthCup.rotation.y = Math.sin(elapsedTime * 8) * 0.08;
    }

    const loungeActive = mech.loungeMusicActive !== false;
    loungeBars.forEach((bar, bIdx) => {
      const targetScaleY = loungeActive ? 0.55 + 0.55 * Math.abs(Math.sin(elapsedTime * (2.6 + bIdx * 0.6) + bIdx)) : 0.25;
      bar.scale.y += (targetScaleY - bar.scale.y) * 0.2;
    });

    const bioOn = mech.bioponicsActive !== false;
    bioponicLightMat.color.setHex(bioOn ? (Math.sin(elapsedTime * 1.4) > 0 ? 0x7effb2 : 0x67e8f9) : 0x334155);
    airlockBeaconMat.color.setHex(mech.airlockPressurized !== false ? 0x45e89e : 0xf97316);

    const activeRestBay = Number.isInteger(mech.restingBayIndex) ? mech.restingBayIndex : null;
    if (astronautPos) {
      let nearest = 0;
      let second = 1;
      let d0 = Infinity;
      let d1 = Infinity;
      for (let i = 0; i < suiteControllers.length; i++) {
        const b = suiteControllers[i].bay;
        const cx = b.ux * 12.2;
        const cz = b.uz * 12.2;
        const d = (astronautPos.x - cx) ** 2 + (astronautPos.z - cz) ** 2;
        if (d < d0) {
          d1 = d0;
          second = nearest;
          d0 = d;
          nearest = i;
        } else if (d < d1) {
          d1 = d;
          second = i;
        }
      }
      const bA = suiteControllers[activeRestBay !== null ? activeRestBay : nearest].bay;
      bayAccentLightA.position.set(bA.ux * 12.4, f + 2.45, bA.uz * 12.4);
      const cA = suiteControllers[activeRestBay !== null ? activeRestBay : nearest];
      bayAccentLightA.color.setHex(cA.lampShadeMat.emissive.getHex() || 0xffcf87);
      bayAccentLightA.intensity = mech.restingSleepActive ? 0.35 : 1.05;

      const bB = suiteControllers[second].bay;
      bayAccentLightB.position.set(bB.ux * 11.4, f + 2.45, bB.uz * 11.4);
    }

    const shouldRefreshTexts = elapsedTime - lastTabletRefreshAt >= 0.75;
    if (shouldRefreshTexts) lastTabletRefreshAt = elapsedTime;

    for (let i = 0; i < suiteControllers.length; i++) {
      const c = suiteControllers[i];
      const doorOpen = mech.cabinDoorsOpen?.[i] !== false;
      const targetX = doorOpen ? 1.72 : 0.56;
      c.doorLeft.position.x += (-targetX - c.doorLeft.position.x) * 0.16;
      c.doorRight.position.x += (targetX - c.doorRight.position.x) * 0.16;
      c.doorLedOuterMat.color.setHex(doorOpen ? 0x45e89e : 0xf59e0b);

      const lockerOpen = Boolean(mech.cabinLockersOpen?.[i]);
      const targetLockerRot = lockerOpen ? -Math.PI * 0.58 : 0;
      c.lockerPivot.rotation.y += (targetLockerRot - c.lockerPivot.rotation.y) * 0.15;

      const lampMode = mech.cabinLamps?.[i] || 'warm';
      const isNight = lampMode === 'night' || (mech.restingSleepActive && activeRestBay === i);
      if (lampMode === 'off' && activeRestBay !== i) {
        c.lampShadeMat.color.setHex(0x475569);
        c.lampShadeMat.emissive.setHex(0x111827);
        c.lampShadeMat.emissiveIntensity = 0.1;
        c.underBedGlowMat.color.setHex(0x1e293b);
        c.ceilingGlowMat.color.setHex(0x334155);
      } else if (isNight) {
        c.lampShadeMat.color.setHex(0x93c5fd);
        c.lampShadeMat.emissive.setHex(0x3b82f6);
        c.lampShadeMat.emissiveIntensity = 0.48;
        c.underBedGlowMat.color.setHex(0x3b82f6);
        c.ceilingGlowMat.color.setHex(0x3b82f6);
      } else {
        c.lampShadeMat.color.setHex(0xffdfad);
        c.lampShadeMat.emissive.setHex(0xffc66d);
        c.lampShadeMat.emissiveIntensity = 0.85;
        c.underBedGlowMat.color.setHex(c.suite.accentHex);
        c.ceilingGlowMat.color.setHex(0xffe4b8);
      }

      const sp = c.specParts;
      if (sp.holoModel) {
        sp.holoModel.visible = mech.auroraHoloActive !== false;
        sp.holoModel.rotation.y = elapsedTime * 0.7;
        sp.holoModel.position.y = 1.32 + Math.sin(elapsedTime * 1.8) * 0.04;
      }
      if (sp.orreryGroup) {
        const rate = mech.orrerySpinFast ? 2.4 : 0.55;
        sp.orreryGroup.rotation.y = elapsedTime * rate;
        sp.orreryGroup.children[2].rotation.z = elapsedTime * rate * 0.7;
      }
      if (sp.scanRing) {
        const scanning = Boolean(mech.medScanActive);
        sp.scanRing.rotation.z = elapsedTime * (scanning ? 2.2 : 0.35);
        sp.scanRing.position.y = 1.48 + (scanning ? Math.sin(elapsedTime * 3.8) * 0.08 : 0);
        sp.medArcMat.color.setHex(scanning ? 0x38d8ff : 0x45e89e);
      }
      if (sp.specimen) {
        const active = Boolean(mech.specSamplesActive);
        sp.specimen.rotation.y = elapsedTime * (active ? 2.5 : 0.5);
        sp.specimen.position.y = 1.18 + Math.sin(elapsedTime * 2.2) * (active ? 0.06 : 0.02);
        sp.emitterMat.color.setHex(active ? 0xe879f9 : 0xb788ff);
      }
      if (sp.flywheel && mech.gymWorkoutActive) {
        sp.flywheel.rotation.x += 0.14;
      }
      if (sp.evaLightMat) {
        sp.evaLightMat.color.setHex(mech.evaCheckActive ? 0x45e89e : 0xf97316);
      }

      if (shouldRefreshTexts) {
        const page = Number(mech.cabinTabletPages?.[i] || 0);
        const restPct = Math.round(Number(mech.crewRestPct ?? 82));
        const tHash = `${doorOpen}|${lampMode}|${lockerOpen}|${page}|${activeRestBay === i}|${restPct}`;
        if (tHash !== c.lastTabletHash) {
          c.lastTabletHash = tHash;
          const acc = `#${c.suite.accentHex.toString(16).padStart(6, '0')}`;
          const lines =
            page === 0
              ? [
                  `TITULAR: ${c.suite.occupant || c.suite.crewRole}`,
                  `PUERTA: ${doorOpen ? 'ABIERTA' : 'CERRADA'} · LUZ: ${lampMode.toUpperCase()}`,
                  `ARMARIO: ${lockerOpen ? 'ABIERTO' : 'CERRADO'} · ENERGÍA: ${restPct}%`,
                ]
              : [
                  `ESPECIALIDAD: ${c.suite.specialtyLabel.toUpperCase()}`,
                  `ESTADO CAMA: ${activeRestBay === i ? 'EN DESCANSO' : 'DISPONIBLE'}`,
                  `CICLOS DESCANSO: ${Number(mech.restCyclesCompleted || 0)}`,
                ];
          c.tabletTex.redraw(`SUITE ${c.suite.code}`, lines, acc, { tick: elapsedTime });
        }

        const bHash = `${activeRestBay === i}|${mech.restingSleepActive}|${restPct}`;
        if (bHash !== c.lastBedHash) {
          c.lastBedHash = bHash;
          const acc = `#${c.suite.accentHex.toString(16).padStart(6, '0')}`;
          c.bedScreenTex.redraw(
            `${c.suite.code} · LITERA DESCANSO`,
            [
              `TITULAR: ${c.suite.occupant || c.suite.crewRole}`,
              activeRestBay === i ? 'DURMIENDO · RECUPERANDO...' : `ENERGÍA ASTRONAUTA: ${restPct}%`,
              activeRestBay === i ? 'PULSA [E] / [R] LEVANTAR' : 'PULSA [E] / [R] DESCANSAR',
            ],
            acc,
            { tick: elapsedTime }
          );
        }
      }
    }
  }

  return {
    handledStationIds,
    stationScreenMeshes,
    screenUpdates,
    update,
    dispose: () => {
      extraDisposables.forEach((d) => {
        if (d && typeof d.dispose === 'function') d.dispose();
      });
    },
  };
}
