import * as THREE from 'three';
import {
  AURORA_SPHERE_RADIUS,
  CABIN_DECKS,
  ELEVATOR_SHAFT_RADIUS,
  HULL_INTERIOR_ZONES,
  INTERIOR_GRAB_RAILS,
  SHIP_INTERIOR_STATIONS,
  clampAstronautPosition,
  findNearestInteractiveStation,
  resolveCurrentDeck,
} from './kronoxInteriorSpatialModel.js';

function createSeededRng(seed = 17) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeFallbackTexture(r = 30, g = 45, b = 62) {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

function makeCanvasTex(w, h, drawFn, repeat = null) {
  if (typeof document === 'undefined') {
    return makeFallbackTexture();
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext?.('2d');
  if (!ctx) return makeFallbackTexture();
  drawFn(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

function makeConsoleScreenTexture(title, lines, accentHex = '#5ce6ff') {
  if (typeof document === 'undefined') {
    const tex = makeFallbackTexture(10, 32, 48);
    return { tex, redraw: () => {} };
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext?.('2d');
  const tex = ctx ? new THREE.CanvasTexture(canvas) : makeFallbackTexture(10, 32, 48);

  const redraw = (curTitle = title, curLines = lines) => {
    if (!ctx) return;
    ctx.fillStyle = '#04101c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle telemetry grid
    ctx.strokeStyle = 'rgba(110, 210, 255, 0.14)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    ctx.fillStyle = accentHex;
    ctx.fillRect(16, 16, canvas.width - 32, 40);

    ctx.fillStyle = '#03101a';
    ctx.font = 'bold 21px monospace';
    ctx.fillText(String(curTitle || '').slice(0, 36), 28, 43);

    ctx.fillStyle = '#dff5ff';
    ctx.font = '18px monospace';
    const list = Array.isArray(curLines) ? curLines.slice(0, 5) : [];
    list.forEach((line, idx) => {
      ctx.fillText(String(line).slice(0, 44), 28, 92 + idx * 34);
    });
    tex.needsUpdate = true;
  };

  redraw(title, lines);
  return { tex, redraw };
}

function buildSlottedDeckSlab(outerRadius, thickness, holeRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  if (holeRadius > 0.05) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 56,
  });
  // Extrude along +Z, rotate -PI/2 around X so slab lies in XZ with bottom at y=0, top at y=thickness
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * Construye el interior completo de las 4 cubiertas apiladas dentro de la esfera
 * habitable (R = 20 m) de la nave Aurora-120, alineada con proa en -Z y popa en +Z.
 */
export function buildKronoxInterior120M() {
  const root = new THREE.Group();
  root.name = 'KronoxInterior120M';

  const rnd = createSeededRng(17);

  // Grupo rotado +PI/2 en Y para trasladar coordenadas nativas Aurora (+X = Proa) -> KRONOX (-Z = Proa)
  const auroraGroup = new THREE.Group();
  auroraGroup.name = 'AuroraInteriorArchitecture';
  auroraGroup.rotation.y = Math.PI / 2;
  root.add(auroraGroup);

  const deckContainers = {
    'deck-01': new THREE.Group(),
    'deck-02': new THREE.Group(),
    'deck-03': new THREE.Group(),
    'deck-04': new THREE.Group(),
  };
  Object.entries(deckContainers).forEach(([id, grp]) => {
    grp.name = `Container_${id}`;
    auroraGroup.add(grp);
  });

  // Materiales fieles a Aurora-120
  const floorTex = makeCanvasTex(
    128,
    128,
    (g, w, h) => {
      g.fillStyle = '#1b2638';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(130, 175, 225, 0.25)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, w - 2, h - 2);
      g.fillStyle = '#25354c';
      g.fillRect(10, 10, 14, 14);
      g.fillRect(w - 24, h - 24, 14, 14);
    },
    [10, 10]
  );

  const holoWaveTex = makeCanvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#04121f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7fe3ff';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < w; i += 4) {
      const y = h * 0.42 + Math.sin(i * 0.07) * h * 0.18 + (rnd() - 0.5) * 8;
      if (i === 0) g.moveTo(i, y);
      else g.lineTo(i, y);
    }
    g.stroke();
    g.fillStyle = '#ffd27a';
    for (let i = 0; i < 6; i++) {
      const bh = rnd() * 30 + 4;
      g.fillRect(12 + i * 38, h - 8 - bh, 26, bh);
    }
    g.strokeRect(2, 2, w - 4, h - 4);
  });

  const floorM = new THREE.MeshStandardMaterial({ color: 0x263242, map: floorTex, roughness: 0.76, metalness: 0.28 });
  const wallM = new THREE.MeshStandardMaterial({ color: 0x6f7e92, roughness: 0.58, metalness: 0.35 });
  const outerShellInnerWallM = new THREE.MeshStandardMaterial({
    color: 0x1c2636,
    roughness: 0.68,
    metalness: 0.45,
    side: THREE.BackSide,
  });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x141b26, metalness: 0.65, roughness: 0.45 });
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd69a2d, metalness: 0.85, roughness: 0.28 });
  const hullM = new THREE.MeshStandardMaterial({ color: 0x607285, metalness: 0.52, roughness: 0.46 });
  const finM = new THREE.MeshStandardMaterial({ color: 0x101722, metalness: 0.7, roughness: 0.35 });
  const bedM = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.82, metalness: 0.14 });

  const cyanGlow = new THREE.MeshBasicMaterial({ color: 0x7fe3ff });
  const amberGlow = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
  const warmGlow = new THREE.MeshBasicMaterial({ color: 0xffe4a8 });
  const glassM = new THREE.MeshBasicMaterial({
    color: 0x0c3450,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const screenHoloMat = new THREE.MeshBasicMaterial({ map: holoWaveTex });

  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (a, b, l, s = 28) => new THREE.CylinderGeometry(a, b, l, s);

  const levels = [6.8, 3.4, 0.0, -3.4, -6.8];

  // 1. Forjados horizontales con perforación para el núcleo vertical compartido de ascensores (r = 1.25 m)
  levels.forEach((y, idx) => {
    const slabR = Math.sqrt(AURORA_SPHERE_RADIUS * AURORA_SPHERE_RADIUS - Math.max(Math.abs(y), Math.abs(y - 0.3)) ** 2) - 0.2;
    const targetParent = idx === 0 ? deckContainers['deck-01'] : deckContainers[`deck-0${Math.min(4, idx)}`] || auroraGroup;
    // El suelo superior (y = +6.8) tapa por completo el techo del puente salvo luz superior; los pisos de cubiertas 1-3 dejan abierto el núcleo r=1.28 m
    const holeR = idx === 0 || idx === 4 ? 0.0 : ELEVATOR_SHAFT_RADIUS + 0.03;
    const slabGeo = buildSlottedDeckSlab(slabR, 0.28, holeR);
    add(targetParent, slabGeo, floorM, 0, y - 0.28, 0);

    const trimRing = add(targetParent, new THREE.TorusGeometry(slabR - 0.22, 0.06, 8, 56), cyanGlow, 0, y + 0.03, 0);
    trimRing.rotation.x = Math.PI / 2;
  });

  // 2. Núcleo vertical compartido de ascensores / pozo microgravedad en (0, 0) con portales abiertos hacia proa (+X Aurora) y popa (-X Aurora)
  const shaftGroup = new THREE.Group();
  shaftGroup.name = 'CentralElevatorShaftCore';
  auroraGroup.add(shaftGroup);

  // Paredes curvas laterales en ±Z Aurora (KRONOX ±X) dejando pasillos completamente abiertos a proa/popa
  [1, -1].forEach((side) => {
    add(shaftGroup, box(1.2, 13.4, 0.16), darkM, 0, 0, side * 1.42);
    add(shaftGroup, box(0.24, 13.4, 0.24), wallM, -0.62, 0, side * 1.38);
    add(shaftGroup, box(0.24, 13.4, 0.24), wallM, 0.62, 0, side * 1.38);
    // Luz guía continua vertical
    add(shaftGroup, box(0.08, 13.1, 0.08), cyanGlow, 0, 0, side * 1.32);
  });
  // Anillos luminosos de transición entre cubiertas dentro del pozo
  [6.7, 3.45, 0.05, -3.35, -6.75].forEach((ringY) => {
    const t = add(shaftGroup, new THREE.TorusGeometry(ELEVATOR_SHAFT_RADIUS + 0.12, 0.05, 8, 32), cyanGlow, 0, ringY, 0);
    t.rotation.x = Math.PI / 2;
  });

  // 3. Revestimiento interior esférico presurizado + ventanas iluminadas de cubiertas 2, 3 y 4
  [0.0, -3.4, -6.8].forEach((floorY, dIdx) => {
    const deckKey = `deck-0${dIdx + 2}`;
    const dParent = deckContainers[deckKey];
    const midY = floorY + 1.65;
    const rTop = Math.sqrt(Math.max(40, AURORA_SPHERE_RADIUS ** 2 - (floorY + 3.25) ** 2)) - 0.35;
    const rBot = Math.sqrt(Math.max(40, AURORA_SPHERE_RADIUS ** 2 - floorY ** 2)) - 0.35;
    add(dParent, new THREE.CylinderGeometry(rTop, rBot, 3.25, 48, 1, true), outerShellInnerWallM, 0, midY, 0);

    // Franja de costillas estructurales y miradores interiores
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rMid = (rTop + rBot) * 0.5 - 0.15;
      const rib = new THREE.Group();
      rib.position.set(rMid * Math.cos(a), midY, rMid * Math.sin(a));
      rib.rotation.y = -a + Math.PI / 2;
      dParent.add(rib);
      add(rib, box(0.24, 3.1, 0.25), darkM, 0, 0, 0);
      if (i % 2 === 0) {
        add(rib, box(1.4, 0.7, 0.08), warmGlow, 1.35, 0.2, 0);
      }
    }
  });

  // Helper silla ergonómica Aurora
  function chair(parent, x, z, f, rot) {
    const g = new THREE.Group();
    g.position.set(x, f, z);
    g.rotation.y = rot;
    parent.add(g);
    add(g, cyl(0.22, 0.3, 0.5, 12), darkM, 0, 0.25, 0);
    add(g, box(0.9, 0.18, 0.9), bedM, 0, 0.55, 0);
    add(g, box(0.9, 0.9, 0.14), bedM, 0, 1.05, -0.42);
  }

  // ==================== CUBIERTA 1 · PUENTE DE MANDO (Y = +3.4) ====================
  {
    const d1 = deckContainers['deck-01'];
    const f = 3.4;
    // Heptágono punta de flecha con proa en +X (Aurora) -> -Z (KRONOX)
    const P = [[15.5, 0], [11, 6.2], [1, 12], [-12, 10.5], [-12, -10.5], [1, -12], [11, -6.2]];
    const edge = (A, B) => {
      const dx = B[0] - A[0];
      const dz = B[1] - A[1];
      const l = Math.hypot(dx, dz);
      const mx = (A[0] + B[0]) / 2;
      const mz = (A[1] + B[1]) / 2;
      let nx = dz / l;
      let nz = -dx / l;
      if (nx * mx + nz * mz < 0) {
        nx = -nx;
        nz = -nz;
      }
      return { l, mx, mz, nx, nz, rot: Math.atan2(nx, nz), at: (t) => [A[0] + dx * t, A[1] + dz * t] };
    };
    const E = P.map((a, i) => edge(a, P[(i + 1) % P.length]));

    // Alfombrado oscuro del puente
    const sh = new THREE.Shape();
    P.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    sh.closePath();
    const bridgeDeckMat = new THREE.MeshStandardMaterial({ color: 0x1b2a42, metalness: 0.22, roughness: 0.7 });
    const bridgeFloor = add(d1, new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }), bridgeDeckMat, 0, f, 0);
    bridgeFloor.rotation.x = -Math.PI / 2;

    // Mamparos del heptágono: ventanales transparentes en facetas de proa (5, 6, 0, 1) para ver el cosmos real
    const bowFacets = new Set([5, 6, 0, 1]);
    E.forEach((e, i) => {
      const g = new THREE.Group();
      g.position.set(e.mx, f, e.mz);
      g.rotation.y = e.rot;
      d1.add(g);
      if (i === 3) {
        [-1, 1].forEach((k) => add(g, box(e.l / 2 - 1.2, 2.9, 0.2), wallM, k * (e.l / 4 + 0.6), 1.45, 0));
      } else if (bowFacets.has(i)) {
        // Peto inferior compacto + cristal continuo transparente arriba para despejar el campo visual a proa
        add(g, box(e.l + 0.04, 0.78, 0.25), wallM, 0, 0.39, 0);
        add(g, box(e.l + 0.04, 2.12, 0.04), glassM, 0, 1.84, 0);
      } else {
        add(g, box(e.l, 2.9, 0.2), wallM, 0, 1.45, 0);
        add(g, box(e.l * 0.55, 1.2, 0.05), screenHoloMat, 0, 1.8, -0.14);
      }
      add(g, box(e.l, 0.22, 0.32), darkM, 0, 2.95, 0);
    });
    // Pilares de unión en vértices laterales y de popa (sin montante central en la punta de proa P[0])
    P.forEach((p, idx) => {
      if (idx === 0) {
        add(d1, box(0.32, 0.8, 0.32), darkM, p[0], f + 0.4, p[1]);
      } else {
        add(d1, box(0.32, 2.9, 0.32), darkM, p[0], f + 1.45, p[1]);
      }
    });

    // Consolas en chevrón siguiendo las facetas de proa con sus sillas
    [[5, 3], [6, 1], [0, 1], [1, 3]].forEach(([i, n]) => {
      const e = E[i];
      const h = new THREE.Group();
      h.position.set(e.mx * 0.72, f + 0.1, e.mz * 0.72);
      h.rotation.y = e.rot;
      d1.add(h);
      add(h, box(e.l * 0.72, 0.02, 0.14), cyanGlow, 0, 0, 0);
      for (let k = 0; k < n; k++) {
        const [x, z] = e.at((k + 0.5) / n);
        const g = new THREE.Group();
        g.position.set(x * 0.72, f, z * 0.72);
        g.rotation.y = e.rot;
        d1.add(g);
        add(g, box(2.1, 1.05, 1.35), darkM, 0, 0.52, 0);
        add(g, box(1.85, 0.04, 0.9), k % 2 ? amberGlow : cyanGlow, 0, 1.08, 0);
        const scr = add(g, box(1.85, 0.8, 0.05), screenHoloMat, 0, 1.45, 0.52);
        scr.rotation.x = -0.45;
        chair(d1, x * 0.72 - e.nx * 1.9, z * 0.72 - e.nz * 1.9, f, e.rot);
      }
    });

    // Puestos laterales mirando hacia dentro
    [2, 4].forEach((i) => {
      const e = E[i];
      for (let k = 0; k < 4; k++) {
        const [x, z] = e.at(0.18 + k * 0.21);
        const g = new THREE.Group();
        g.position.set(x - e.nx * 1.1, f, z - e.nz * 1.1);
        g.rotation.y = e.rot + Math.PI;
        d1.add(g);
        add(g, box(2.2, 1.1, 0.9), darkM, 0, 0.55, 0);
        add(g, box(1.9, 0.04, 0.6), k % 2 ? cyanGlow : amberGlow, 0, 1.12, 0);
      }
    });

    // Estrado hexagonal del capitán (Aurora x = +5.5 -> KRONOX z = -5.5)
    add(d1, cyl(3.1, 3.25, 0.18, 6), wallM, 5.5, f + 0.09, 0);
    add(d1, cyl(2.6, 2.75, 0.38, 6), darkM, 5.5, f + 0.2, 0);
    add(d1, cyl(2.75, 2.75, 0.05, 6), cyanGlow, 5.5, f + 0.36, 0);
    chair(d1, 5.5, 0, f + 0.4, Math.PI / 2);
    [-1, 1].forEach((k) => {
      add(d1, box(1.0, 0.12, 0.22), darkM, 5.6, f + 1.22, k * 0.58);
      add(d1, box(0.5, 0.03, 0.16), screenHoloMat, 5.75, f + 1.29, k * 0.58);
    });

    // Mesa holográfica hexagonal trasera (Aurora x = -6.0 -> KRONOX z = +6.0)
    add(d1, cyl(1.5, 1.7, 0.9, 6), darkM, -6, f + 0.45, 0);
    add(d1, cyl(1.4, 1.4, 0.05, 6), cyanGlow, -6, f + 0.93, 0);
    const wfMat = new THREE.MeshBasicMaterial({ color: 0x9be7ff, wireframe: true });
    const holoTableOrb = new THREE.Group();
    holoTableOrb.name = 'BridgeHoloProjector';
    holoTableOrb.position.set(-6, f + 1.85, 0);
    d1.add(holoTableOrb);
    add(holoTableOrb, new THREE.IcosahedronGeometry(0.68, 1), wfMat, 0, 0, 0);
    const holoOrbit = add(holoTableOrb, new THREE.TorusGeometry(0.95, 0.025, 6, 40), cyanGlow, 0, 0, 0);
    holoOrbit.rotation.x = 1.2;
    const baseRing = add(d1, new THREE.TorusGeometry(1.95, 0.04, 4, 6), cyanGlow, -6, f + 1.08, 0);
    baseRing.rotation.x = Math.PI / 2;

    // Mamparo trasero de popa con puerta iluminada ámbar
    [-1, 1].forEach((k) => {
      add(d1, box(0.06, 1.5, 6.2), screenHoloMat, -11.85, f + 1.7, k * 5.85);
      add(d1, box(0.4, 3.0, 0.3), darkM, -12, f + 1.5, k * 1.25);
    });
    add(d1, box(0.4, 0.3, 2.8), darkM, -12, f + 2.9, 0);
    add(d1, box(0.06, 2.5, 2.1), amberGlow, -12.1, f + 1.3, 0);

    // Vigas de techo del puente y marcos laterales del mirador de proa sin listones atravesados
    add(d1, box(26, 0.2, 0.35), darkM, 0, f + 2.88, 0);
    [[-9, 21], [-4, 22], [1, 23], [6, 17], [11, 11]].forEach(([x, w]) => add(d1, box(0.3, 0.18, w), darkM, x, f + 2.88, 0));
  }

  // ==================== CUBIERTA 2 · HABITACIONAL (Y = 0.0) ====================
  {
    const d2 = deckContainers['deck-02'];
    const f = 0.0;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const g = new THREE.Group();
      g.rotation.y = a;
      d2.add(g);
      add(g, box(12.8, 2.9, 0.15), wallM, 11.8, f + 1.45, 0);

      const c = new THREE.Group();
      c.rotation.y = a + Math.PI / 8;
      d2.add(c);
      add(c, box(2.4, 0.5, 1.1), bedM, 14.2, f + 0.4, 0);
      add(c, box(0.5, 0.15, 0.8), finM, 13.2, f + 0.72, 0);
      add(c, box(0.6, 2.1, 1.4), darkM, 16.9, f + 1.05, 0);
      add(c, box(2.2, 0.05, 0.3), warmGlow, 12.8, f + 2.8, 0);
    }

    // Comedor circular dividido en 2 arcos abiertos hacia el pozo del ascensor (±X Aurora / ±Z KRONOX)
    [
      [0.38, Math.PI - 0.76],
      [Math.PI + 0.38, Math.PI - 0.76],
    ].forEach(([thetaStart, thetaLength]) => {
      const arcBar = new THREE.CylinderGeometry(3.4, 3.4, 0.78, 28, 1, false, thetaStart, thetaLength);
      add(d2, arcBar, darkM, 0, f + 0.39, 0);
      const topRim = new THREE.CylinderGeometry(3.45, 3.45, 0.04, 28, 1, false, thetaStart, thetaLength);
      add(d2, topRim, amberGlow, 0, f + 0.8, 0);
    });

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.52;
      add(d2, cyl(0.35, 0.35, 0.5, 12), bedM, 4.2 * Math.cos(a), f + 0.25, 4.2 * Math.sin(a));
    }

    // Esclusa EVA a proa (Aurora +X = +15.8 -> KRONOX Z = -15.8)
    add(d2, box(0.4, 2.6, 2.6), darkM, 16.0, f + 1.3, 0);
    add(d2, box(0.08, 2.1, 1.8), cyanGlow, 15.75, f + 1.25, 0);
  }

  // ==================== CUBIERTA 3 · INGENIERÍA Y SPHEREx (Y = -3.4) ====================
  {
    const d3 = deckContainers['deck-03'];
    const f = -3.4;

    // Núcleo del reactor principal a popa (Aurora x = -9.0 -> KRONOX z = +9.0): cámara de plasma visible entre anillos magnéticos
    const rg = new THREE.Group();
    rg.position.set(-9, f, 0);
    d3.add(rg);
    add(rg, cyl(2.4, 2.4, 0.68, 32), darkM, 0, 0.34, 0);
    add(rg, cyl(2.4, 2.4, 0.68, 32), darkM, 0, 2.56, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      add(rg, cyl(0.14, 0.14, 2.8, 12), wallM, 2.2 * Math.cos(a), 1.45, 2.2 * Math.sin(a));
    }
    const reactorPlasma = add(rg, cyl(1.05, 1.05, 2.85, 24), new THREE.MeshBasicMaterial({ color: 0x7ce6ff }), 0, 1.48, 0);
    reactorPlasma.name = 'ReactorPlasmaCore';
    [0.68, 1.45, 2.22].forEach((ty) => {
      const t = add(rg, new THREE.TorusGeometry(2.44, 0.11, 8, 32), goldM, 0, ty, 0);
      t.rotation.x = Math.PI / 2;
    });
    [-4, 4].forEach((cz) => add(d3, cyl(0.22, 0.22, 3.0, 10), darkM, -9, f + 1.5, cz));

    // Tanques de combustible criogénicos dorados a proa (Aurora x = +9 -> KRONOX z = -9)
    [-6, 6].forEach((cz) => add(d3, cyl(1.3, 1.3, 2.6, 24), goldM, 9, f + 1.3, cz));

    // Arcos curvos de laboratorio SPHEREx (Aurora z < 0 -> Babor KRONOX -X) y Banco Óptico (Aurora z > 0 -> Estribor KRONOX +X)
    const buildLabArc = (thetaCenter, accentMat) => {
      for (let i = 0; i < 6; i++) {
        const t = thetaCenter - 0.95 + (1.9 * i) / 5;
        const g = new THREE.Group();
        g.position.set(15.2 * Math.sin(t), f, 15.2 * Math.cos(t));
        g.rotation.y = t;
        d3.add(g);
        add(g, box(2.3, 1.0, 1.25), darkM, 0, 0.5, 0);
        add(g, box(2.0, 0.04, 0.85), accentMat, 0, 1.02, 0);
      }
    };
    buildLabArc(Math.PI, amberGlow); // Babor KRONOX (-X): SPHEREx
    buildLabArc(0.0, cyanGlow); // Estribor KRONOX (+X): Banco Óptico de Calibración
  }

  // ==================== CUBIERTA 4 · BODEGA Y HANGAR (Y = -6.8) ====================
  {
    const d4 = deckContainers['deck-04'];
    const f = -6.8;
    const pal = [0xc2552b, 0x2e6fb3, 0x7a8590, 0xd6a23a, 0x3b8f6b];

    for (let x = -14; x <= 4.5; x += 4.2) {
      for (let z = -10; z <= 10; z += 3.4) {
        if (Math.hypot(x, z) > 15.2 || Math.hypot(x, z) < 3.0 || rnd() < 0.22) continue;
        const cm = new THREE.MeshStandardMaterial({ color: pal[(rnd() * 5) | 0], metalness: 0.4, roughness: 0.6 });
        add(d4, box(3.5, 1.45, 2.5), cm, x, f + 0.725, z);
        if (rnd() < 0.38) add(d4, box(3.5, 1.45, 2.5), cm, x, f + 2.175, z);
      }
    }

    // Transbordador de servicio estacionado en el hangar de proa (Aurora x = +11.5 -> KRONOX z = -11.5)
    const sg = new THREE.Group();
    sg.name = 'ServiceShuttleHangar';
    sg.position.set(11.5, f, 0);
    d4.add(sg);
    add(sg, box(6.0, 1.8, 2.6), hullM, 0, 1.4, 0);
    add(sg, box(5.4, 0.14, 2.7), darkM, -0.1, 1.45, 0);
    add(sg, box(3.6, 0.12, 2.68), goldM, 0.4, 1.15, 0);
    const nose = add(sg, cyl(0.4, 1.3, 2.8, 16), hullM, 4.3, 1.4, 0);
    nose.rotation.z = -Math.PI / 2;
    add(sg, box(2.4, 0.15, 7.0), finM, -0.5, 1.2, 0);
    add(sg, box(0.9, 0.65, 0.65), darkM, -2.6, 1.55, -1.1);
    add(sg, box(0.9, 0.65, 0.65), darkM, -2.6, 1.55, 1.1);
    add(sg, box(1.5, 0.55, 1.9), darkM, 2.55, 2.15, 0);
    add(sg, box(1.25, 0.36, 1.68), cyanGlow, 2.68, 2.22, 0);
    [[-2, -1], [-2, 1], [2, 0]].forEach(([sx, sz]) => add(sg, cyl(0.1, 0.1, 0.6, 8), darkM, sx, 0.3, sz * 1.2));

    // Guía amarilla de pista del hangar
    add(d4, box(16, 0.02, 0.25), new THREE.MeshBasicMaterial({ color: 0xffc94a }), 5.0, f + 0.02, 0);
  }

  // Luces interiores suaves por cubierta (equilibradas con el aluminio aeroespacial)
  if (typeof THREE.PointLight === 'function') {
    [0xbfe6ff, 0xffe3bf, 0x9fe0ff, 0xffe9c8].forEach((c, idx) => {
      const deckFloorY = levels[idx + 1];
      const pt = new THREE.PointLight(c, 0.42, 34, 1.2);
      pt.position.set(0, deckFloorY + 2.55, 0);
      auroraGroup.add(pt);
    });
  }

  // 4. Estaciones Interactivas Diegéticas en coordenadas KRONOX reales + Banco Óptico animado (4 etapas)
  const stationMeshes = [];
  let calibrationBenchParts = null;

  SHIP_INTERIOR_STATIONS.forEach((st) => {
    const px = Array.isArray(st.position) ? st.position[0] : st.position.x;
    const py = Array.isArray(st.position) ? st.position[1] : st.position.y;
    const pz = Array.isArray(st.position) ? st.position[2] : st.position.z;
    const lx = Array.isArray(st.lookTarget) ? st.lookTarget[0] : st.lookTarget.x;
    const lz = Array.isArray(st.lookTarget) ? st.lookTarget[2] : st.lookTarget.z;
    const stGroup = new THREE.Group();
    stGroup.name = `Station_${st.id}`;
    stGroup.userData.stationId = st.id;
    stGroup.position.set(px, py, pz);
    const dx = lx - px;
    const dz = lz - pz;
    stGroup.rotation.y = Math.atan2(dx, dz);
    root.add(stGroup);

    const accentStr = `#${st.colorHex.toString(16).padStart(6, '0')}`;
    const screenData = makeConsoleScreenTexture(
      st.label.toUpperCase(),
      [`CUBIERTA ${st.deckId.toUpperCase()}`, `SISTEMA: ${st.tag}`, 'ENLACE KRONOX: NOMINAL'],
      accentStr
    );

    const trimBarMat = new THREE.MeshBasicMaterial({ color: st.colorHex });
    const floorBeacon = add(stGroup, new THREE.RingGeometry(0.68, 0.84, 32), trimBarMat, 0, 0.04, 0);
    floorBeacon.rotation.x = -Math.PI / 2;

    let screenMesh;
    if (st.id === 'windows') {
      // Ventanal despejado: pequeño pedestal bajo de observación a un lado sin bloquear la vista central
      add(stGroup, box(0.95, 0.82, 0.42), darkM, -1.35, 0.41, 0.65);
      screenMesh = add(
        stGroup,
        box(0.84, 0.44, 0.05),
        new THREE.MeshBasicMaterial({ map: screenData.tex }),
        -1.35,
        1.05,
        0.65
      );
      screenMesh.rotation.x = -0.45;
    } else if (st.id === 'missions') {
      // Baliza interactiva sobre la mesa holográfica
      screenMesh = add(
        stGroup,
        box(1.15, 0.62, 0.06),
        new THREE.MeshBasicMaterial({ map: screenData.tex }),
        0,
        1.32,
        -1.15
      );
      screenMesh.rotation.x = -0.35;
    } else if (st.id === 'engineering') {
      // Consola lateral frente al reactor para no tapar la cámara central del núcleo de plasma
      add(stGroup, box(0.92, 0.84, 0.46), darkM, 1.35, 0.42, 0.65);
      add(stGroup, box(0.84, 0.04, 0.38), trimBarMat, 1.35, 0.86, 0.65);
      screenMesh = add(
        stGroup,
        box(0.82, 0.46, 0.05),
        new THREE.MeshBasicMaterial({ map: screenData.tex }),
        1.35,
        1.22,
        0.54
      );
      screenMesh.rotation.x = -0.32;
    } else {
      const offsetScreenX = st.id === 'sensor-calibration' ? -1.35 : 0;
      add(stGroup, box(1.05, 0.88, 0.48), darkM, offsetScreenX, 0.44, 0.88);
      add(stGroup, box(0.95, 0.05, 0.4), trimBarMat, offsetScreenX, 0.9, 0.88);
      screenMesh = add(
        stGroup,
        box(0.92, 0.5, 0.05),
        new THREE.MeshBasicMaterial({ map: screenData.tex }),
        offsetScreenX,
        1.26,
        0.74
      );
      screenMesh.rotation.x = -0.32;
    }
    screenMesh.userData.stationId = st.id;

    // Conjunto animado del Banco Óptico de Calibración (Estación sensor-calibration) desplegado a plena vista
    if (st.id === 'sensor-calibration') {
      const benchGroup = new THREE.Group();
      benchGroup.name = 'OpticalCalibrationBenchAssembly';
      benchGroup.position.set(0.35, 0.92, 0.95);
      stGroup.add(benchGroup);

      add(benchGroup, box(2.2, 0.14, 1.15), darkM, 0, 0, 0);
      add(benchGroup, cyl(0.12, 0.16, 0.92, 12), wallM, -0.8, -0.46, 0);
      add(benchGroup, cyl(0.12, 0.16, 0.92, 12), wallM, 0.8, -0.46, 0);

      const mirrorRing = add(benchGroup, new THREE.TorusGeometry(0.34, 0.045, 10, 32), cyanGlow, -0.65, 0.48, 0);
      const lensCore = add(benchGroup, new THREE.CylinderGeometry(0.24, 0.24, 0.18, 20), goldM, 0.0, 0.48, 0);
      lensCore.rotation.z = Math.PI / 2;
      add(benchGroup, new THREE.TorusGeometry(0.32, 0.035, 10, 28), amberGlow, 0.65, 0.48, 0).rotation.y = Math.PI / 2;
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x45e8ff,
        transparent: true,
        opacity: 0.78,
      });
      const laserBeam = add(benchGroup, new THREE.CylinderGeometry(0.035, 0.035, 1.85, 12), beamMat, 0, 0.48, 0);
      laserBeam.rotation.z = Math.PI / 2;
      calibrationBenchParts = { benchGroup, mirrorRing, lensCore, laserBeam, beamMat };
    }

    stationMeshes.push({
      id: st.id,
      group: stGroup,
      screenMesh,
      trimBarMat,
      floorBeacon,
      updateScreen: (title, lines) => screenData.redraw(title, lines),
    });
  });

  // 5. Pasamanos físicos de sujeción EVA anclados a pedestales o núcleo central (sin barras flotantes en mitad de sala)
  const railMat = new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.4, metalness: 0.65 });
  INTERIOR_GRAB_RAILS.forEach((rail) => {
    if (rail.axis === 'y') {
      const len = Math.min(2.2, rail.span || 2.0);
      add(root, cyl(0.035, 0.035, len, 10), railMat, rail.pos[0] * 1.15, rail.pos[1], rail.pos[2]);
    } else {
      // Barandilla compacta con soportes verticales al suelo junto a la estación
      const shortLen = 1.05;
      const rx = rail.pos[0];
      const ry = rail.pos[1] - 0.12;
      const rz = rail.pos[2];
      const barGeo = rail.axis === 'x' ? box(shortLen, 0.045, 0.045) : box(0.045, 0.045, shortLen);
      add(root, barGeo, railMat, rx, ry, rz);
      [-shortLen * 0.42, shortLen * 0.42].forEach((off) => {
        const sx = rail.axis === 'x' ? rx + off : rx;
        const sz = rail.axis === 'z' ? rz + off : rz;
        add(root, cyl(0.025, 0.025, 0.98, 8), darkM, sx, ry - 0.49, sz);
      });
    }
  });

  const bridgeHoloProjector = auroraGroup.getObjectByName('BridgeHoloProjector');
  const reactorPlasmaCore = auroraGroup.getObjectByName('ReactorPlasmaCore');
  const reactorAssembly = reactorPlasmaCore?.parent || null;

  function updateStations(
    elapsedTime = 0,
    nearestId = null,
    activeId = null,
    focusedId = null,
    _freeHelm = false,
    _astronautPos = null,
    repairStage = 0
  ) {
    const pulse = 0.75 + 0.25 * Math.sin(elapsedTime * 3.2);
    stationMeshes.forEach((st, idx) => {
      const highlighted = st.id === activeId || st.id === focusedId || st.id === nearestId;
      if (st.floorBeacon) {
        const wave = 1.0 + 0.045 * Math.sin(elapsedTime * 2.4 + idx * 0.7);
        st.floorBeacon.scale.setScalar(highlighted ? 1.18 + 0.08 * pulse : wave);
      }
      if (st.trimBarMat) {
        st.trimBarMat.color.setHex(st.colorHex ?? 0x38bdf8);
        if (highlighted) {
          st.trimBarMat.color.offsetHSL(0, 0, 0.08 * Math.sin(elapsedTime * 5.0));
        }
      }
    });

    if (bridgeHoloProjector) {
      bridgeHoloProjector.rotation.y = elapsedTime * 0.65;
      bridgeHoloProjector.rotation.z = Math.sin(elapsedTime * 0.9) * 0.12;
      bridgeHoloProjector.position.y = 3.4 + 1.85 + Math.sin(elapsedTime * 1.9) * 0.085;
      const orbRing = bridgeHoloProjector.children?.[1];
      if (orbRing) {
        orbRing.rotation.z = elapsedTime * 1.25;
        orbRing.rotation.y = Math.cos(elapsedTime * 0.85) * 0.45;
      }
    }
    if (reactorPlasmaCore) {
      const s = 0.94 + 0.09 * Math.sin(elapsedTime * 4.4);
      reactorPlasmaCore.scale.set(s, 1.0 + 0.03 * Math.cos(elapsedTime * 5.2), s);
      reactorPlasmaCore.rotation.y = elapsedTime * 1.1;
      if (reactorAssembly) {
        reactorAssembly.children.forEach((child, cIdx) => {
          if (child !== reactorPlasmaCore && child.geometry?.type === 'TorusGeometry') {
            child.rotation.z = elapsedTime * (cIdx % 2 === 0 ? 0.55 : -0.65);
          }
        });
      }
    }

    if (calibrationBenchParts) {
      const stage = Math.max(0, Math.min(4, Number(repairStage) || 0));
      const sweep = Math.sin(elapsedTime * 2.6);
      calibrationBenchParts.mirrorRing.rotation.z = stage >= 4 ? elapsedTime * 0.35 : sweep * (0.42 - stage * 0.08);
      calibrationBenchParts.mirrorRing.rotation.y = Math.cos(elapsedTime * 1.4) * 0.16;
      calibrationBenchParts.lensCore.position.y = 0.48 + (stage >= 2 ? 0 : Math.sin(elapsedTime * 3.2) * 0.035);
      calibrationBenchParts.lensCore.rotation.x = elapsedTime * 1.3;
      calibrationBenchParts.beamMat.color.setHex(stage >= 4 ? 0x58ff9c : stage >= 2 ? 0x45e8ff : 0xff9f43);
      calibrationBenchParts.beamMat.opacity = 0.48 + stage * 0.11 + 0.14 * Math.sin(elapsedTime * 6.5);
    }
  }

  return {
    root,
    cabinRoot: root,
    auroraGroup,
    decks: CABIN_DECKS,
    deckContainers,
    zones: HULL_INTERIOR_ZONES,
    interactiveStations: SHIP_INTERIOR_STATIONS,
    stationMeshes,
    grabRails: INTERIOR_GRAB_RAILS,
    clampAstronautPosition,
    findNearestInteractiveStation,
    resolveCurrentDeck,
    updateStations,
  };
}
