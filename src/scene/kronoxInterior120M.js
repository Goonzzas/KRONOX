import * as THREE from 'three';
import {
  AURORA_SPHERE_RADIUS,
  C02_HAB_SUITES,
  C03_LAB_ARCS,
  C04_CARGO_CONTAINERS,
  CABIN_DECKS,
  ELEVATOR_CALL_STATIONS,
  ELEVATOR_DOOR_CLEAR_HALF_WIDTH,
  ELEVATOR_SHAFT_RADIUS,
  HULL_INTERIOR_ZONES,
  INTERIOR_GRAB_RAILS,
  SHIP_INTERIOR_STATIONS,
  clampAstronautPosition,
  findNearestInteractiveStation,
  resolveCurrentDeck,
} from './kronoxInteriorSpatialModel.js';
import {
  createHolographicShaderMaterial,
  createShipPbrSuite,
  makeDeckSignTexture,
  makeDiegeticScreenTexture,
} from './shipPbrMaterials.js';
import { buildBridgeCabina13D } from './bridgeCabina13D.js';
import { buildDeck02Habitational3D } from './deck02Habitational3D.js';

function smootherstep01(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function buildHollowArcCounterGeo(rInner, rOuter, halfAngle, height, segments = 24) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    const x = rOuter * Math.cos(a);
    const y = rOuter * Math.sin(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const a = -halfAngle + (2 * halfAngle * i) / segments;
    shape.lineTo(rInner * Math.cos(a), rInner * Math.sin(a));
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function createSeededRng(seed = 17) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
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
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function buildSculptedArchRibGeo(outerW, outerH, depth, innerW, innerH, chamfer = 0.24) {
  const hw = outerW * 0.5;
  const iw = innerW * 0.5;
  const c = Math.min(chamfer, (outerW - innerW) * 0.35, innerH * 0.3);
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, outerH - c);
  shape.lineTo(-hw + c, outerH);
  shape.lineTo(hw - c, outerH);
  shape.lineTo(hw, outerH - c);
  shape.lineTo(hw, 0);
  shape.lineTo(iw, 0);
  shape.lineTo(iw, innerH - c);
  shape.lineTo(iw - c, innerH);
  shape.lineTo(-iw + c, innerH);
  shape.lineTo(-iw, innerH - c);
  shape.lineTo(-iw, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

function buildBeveledConsoleShellGeo(width, height, depth) {
  const shape = new THREE.Shape();
  const hd = depth * 0.5;
  shape.moveTo(-hd * 0.86, 0);
  shape.lineTo(hd * 0.92, 0);
  shape.lineTo(hd, height * 0.72);
  shape.lineTo(hd * 0.58, height);
  shape.lineTo(-hd * 0.95, height * 1.04);
  shape.lineTo(-hd, height * 0.45);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  geo.rotateY(Math.PI / 2);
  geo.translate(-width * 0.5, 0, 0);
  return geo;
}

/**
 * Construye el interior completo PBR de las 4 cubiertas apiladas dentro de la esfera
 * habitable (R = 20 m) de la nave Aurora-120 / KRONOX, con ascensor físico funcional 3D,
 * módulos interactivos reales y optimización por instancias en GPU.
 */
export function buildKronoxInterior120M() {
  const root = new THREE.Group();
  root.name = 'KronoxInterior120M';

  const rnd = createSeededRng(17);
  const pbrSuite = createShipPbrSuite(23);
  const disposableExtras = [];
  const liveStaticDisplays = { hab: null, science: null, optical: null };
  const geoCache = new Map();
  const trackedGeos = new Set();
  const trackExtraGeo = (g) => {
    if (g && !trackedGeos.has(g)) {
      if (g.attributes?.uv && !g.attributes.uv2) {
        g.setAttribute('uv2', g.attributes.uv);
      }
      trackedGeos.add(g);
      disposableExtras.push(g);
    }
    return g;
  };
  const cachedGeo = (key, factory) => {
    let g = geoCache.get(key);
    if (!g) {
      g = trackExtraGeo(factory());
      geoCache.set(key, g);
    }
    return g;
  };
  const trackExtraTex = (tex) => {
    if (tex) disposableExtras.push(tex);
    return tex;
  };
  const trackExtraMat = (mat) => {
    if (mat) disposableExtras.push(mat);
    return mat;
  };

  const resolveOwnerDeckId = (obj) => {
    let cur = obj;
    while (cur) {
      if (cur.userData?.deckId) return cur.userData.deckId;
      cur = cur.parent;
    }
    return null;
  };

  // Mallas sólidas usadas para evitar clipping de cámara en 3ª/1ª persona (indexadas por cubierta)
  const cameraCollisionMeshes = [];
  const cameraCollisionMeshesByDeck = {
    'deck-01': [],
    'deck-02': [],
    'deck-03': [],
    'deck-04': [],
    global: [],
  };
  const registerColliderMesh = (mesh, kind = 'wall') => {
    if (mesh) {
      mesh.userData.cameraCollider = kind;
      cameraCollisionMeshes.push(mesh);
      const deckId = resolveOwnerDeckId(mesh);
      mesh.userData.ownerDeckId = deckId || 'global';
      if (deckId && cameraCollisionMeshesByDeck[deckId]) {
        cameraCollisionMeshesByDeck[deckId].push(mesh);
      } else {
        cameraCollisionMeshesByDeck.global.push(mesh);
      }
    }
    return mesh;
  };

  // Mallas físicas apuntables con el centro de cámara (Raycast interactivo indexado por cubierta)
  const interactRaycasterMeshes = [];
  const interactRaycasterMeshesByDeck = {
    'deck-01': [],
    'deck-02': [],
    'deck-03': [],
    'deck-04': [],
    global: [],
  };
  const registerInteractMesh = (mesh, interactId, interactKind = 'panel', explicitDeckId = null) => {
    if (mesh && interactId) {
      mesh.userData.interactId = interactId;
      mesh.userData.interactKind = interactKind;
      interactRaycasterMeshes.push(mesh);
      const deckId = explicitDeckId || resolveOwnerDeckId(mesh);
      mesh.userData.ownerDeckId = deckId || 'global';
      if (deckId && interactRaycasterMeshesByDeck[deckId]) {
        interactRaycasterMeshesByDeck[deckId].push(mesh);
      } else {
        interactRaycasterMeshesByDeck.global.push(mesh);
      }
    }
    return mesh;
  };

  // Grupo rotado +PI/2 en Y para trasladar coordenadas Aurora (+X = Proa) -> KRONOX (-Z = Proa)
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
  const deckOverlayGroups = {
    'deck-01': new THREE.Group(),
    'deck-02': new THREE.Group(),
    'deck-03': new THREE.Group(),
    'deck-04': new THREE.Group(),
  };
  Object.entries(deckContainers).forEach(([id, grp]) => {
    grp.name = `Container_${id}`;
    grp.userData.deckId = id;
    auroraGroup.add(grp);
    const ov = deckOverlayGroups[id];
    ov.name = `Overlay_${id}`;
    ov.userData.deckId = id;
    root.add(ov);
  });

  // Materiales PBR compartidos + emisivos calibrados
  const floorM = pbrSuite.materials.deckFloorMat;
  const wallM = pbrSuite.materials.bulkheadWallMat;
  const outerShellInnerWallM = pbrSuite.materials.outerShellInnerWallMat;
  const darkM = pbrSuite.materials.darkTrimMat;
  const steelM = pbrSuite.materials.brushedSteelMat;
  const goldM = pbrSuite.materials.goldMliMat;
  const copperM = pbrSuite.materials.copperCoilMat;
  const doorM = pbrSuite.materials.armoredDoorMat;
  const hullM = pbrSuite.materials.hullExteriorMat;
  const finM = pbrSuite.materials.radiatorGrapheneMat;
  const bedM = pbrSuite.materials.upholsteryMat;
  const compositeM = pbrSuite.materials.compositePanelMat || steelM;
  const slateM = pbrSuite.materials.anodizedSlateMat || darkM;
  const warmHabM = pbrSuite.materials.warmHabAccentMat || darkM;
  const railAmberM = pbrSuite.materials.safetyAmberMat;
  const glassM = pbrSuite.materials.glassViewportMat;
  const ceilingM = pbrSuite.materials.ceilingCofferMat || darkM;
  const quiltedM = pbrSuite.materials.quiltedHabWallMat || wallM;
  const ventM = pbrSuite.materials.ventGrilleMat || darkM;
  const hazardM = pbrSuite.materials.hazardStripeMat || railAmberM;

  const cyanGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x6ce3ff }));
  const amberGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0xffb347 }));
  const greenGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
  const uvVioletGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0xb788ff }));
  const warmGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0xffdfad }));

  const staticFreezeCandidates = [];
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, colliderKind = null) => {
    trackExtraGeo(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    if (colliderKind) registerColliderMesh(m, colliderKind);
    staticFreezeCandidates.push(m);
    return m;
  };
  const box = (w, h, d) =>
    cachedGeo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (a, b, l, s = 24) =>
    cachedGeo(`cyl:${a}:${b}:${l}:${s}`, () => new THREE.CylinderGeometry(a, b, l, s));
  const torus = (r, t, rs = 8, ts = 32) =>
    cachedGeo(`tor:${r.toFixed(3)}:${t.toFixed(3)}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));
  const ringGeo = (rIn, rOut, s = 32) =>
    cachedGeo(`rng:${rIn}:${rOut}:${s}`, () => new THREE.RingGeometry(rIn, rOut, s));
  const sphereGeo = (r, ws = 20, hs = 12, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) =>
    cachedGeo(`sph:${r}:${ws}:${hs}:${ps}:${pl.toFixed(3)}:${ts}:${tl.toFixed(3)}`, () => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl));

  const levels = [6.8, 3.4, 0.0, -3.4, -6.8];

  // 1. Forjados estructurales con apertura exacta del núcleo vertical de ascensores
  levels.forEach((y, idx) => {
    const slabR = Math.sqrt(AURORA_SPHERE_RADIUS * AURORA_SPHERE_RADIUS - Math.max(Math.abs(y), Math.abs(y - 0.3)) ** 2) - 0.2;
    const targetParent = idx === 0 ? deckContainers['deck-01'] : deckContainers[`deck-0${Math.min(4, idx)}`] || auroraGroup;
    const holeR = idx === 0 || idx === 4 ? 0.0 : ELEVATOR_SHAFT_RADIUS + 0.03;
    const slabGeo = buildSlottedDeckSlab(slabR, 0.28, holeR);
    add(targetParent, slabGeo, floorM, 0, y - 0.28, 0, 'floor');

    // Panelado perforado técnico de techo en cubiertas 2, 3 y 4 (Cabina 1 usa techo abovedado esculpido propio)
    if (idx > 0 && idx < 4) {
      const ceilingParent = deckContainers[`deck-0${idx + 1}`];
      const ceilingR = slabR - 0.28;
      const ceilingHoleR = ELEVATOR_SHAFT_RADIUS + 0.06;
      const ceilGeo = buildSlottedDeckSlab(ceilingR, 0.028, ceilingHoleR);
      add(ceilingParent, ceilGeo, ceilingM, 0, y - 0.308, 0);

      // Conductos de aireación y vigas radiales en techo (Cubierta 02 usa artesonado radial por camarotes propio)
      if (idx !== 1) {
        for (let b = 0; b < 4; b++) {
          const ang = (b * Math.PI) / 2 + Math.PI / 4;
          const duct = add(ceilingParent, box(ceilingR * 1.45, 0.09, 0.26), ventM, 0, y - 0.36, 0);
          duct.rotation.y = ang;
        }
      }
    }

    const trimRing = add(targetParent, torus(slabR - 0.24, 0.05, 8, 56), steelM, 0, y + 0.025, 0);
    trimRing.rotation.x = Math.PI / 2;

    // Aro superior arquitectónico de techo técnico en cubiertas 2, 3 y 4
    if (idx > 0 && idx < 4) {
      const ceilBeam = add(targetParent, torus(slabR * 0.56, 0.09, 8, 48), darkM, 0, y - 0.35, 0);
      ceilBeam.rotation.x = Math.PI / 2;
      const ceilLed = add(targetParent, torus(slabR * 0.56, 0.025, 6, 48), idx === 1 ? warmGlow : cyanGlow, 0, y - 0.43, 0);
      ceilLed.rotation.x = Math.PI / 2;
    }
  });

  // Lote instanciado de luminarias empotradas para cubiertas 2, 3 y 4 (GPU-instanced; Cabina 1 usa coves indirectos propios)
  {
    const ceilFixtureMats = [];
    const ceilTrussMats = [];
    const dummy = new THREE.Object3D();
    [3.4, 0.0, -3.4, -6.8].forEach((floorY, dIdx) => {
      if (dIdx === 0 || dIdx === 1) return;
      const ceilY = floorY + 3.04;
      const rings = [4.8, 9.8, 14.2];
      rings.forEach((rr) => {
        const countOnRing = rr < 6 ? 6 : rr < 11 ? 8 : 12;
        for (let k = 0; k < countOnRing; k++) {
          const ang = (k / countOnRing) * Math.PI * 2 + 0.2;
          dummy.position.set(rr * Math.cos(ang), ceilY, rr * Math.sin(ang));
          dummy.rotation.set(0, -ang, 0);
          dummy.scale.set(1.25, 0.08, 0.26);
          dummy.updateMatrix();
          ceilFixtureMats.push(dummy.matrix.clone());

          dummy.position.set(rr * Math.cos(ang), ceilY + 0.07, rr * Math.sin(ang));
          dummy.scale.set(1.45, 0.1, 0.36);
          dummy.updateMatrix();
          ceilTrussMats.push(dummy.matrix.clone());
        }
      });
    });
    const instLed = new THREE.InstancedMesh(box(1, 1, 1), warmGlow, ceilFixtureMats.length);
    const instHousing = new THREE.InstancedMesh(box(1, 1, 1), darkM, ceilTrussMats.length);
    ceilFixtureMats.forEach((m4, i) => instLed.setMatrixAt(i, m4));
    ceilTrussMats.forEach((m4, i) => instHousing.setMatrixAt(i, m4));
    instLed.instanceMatrix.needsUpdate = true;
    instHousing.instanceMatrix.needsUpdate = true;
    auroraGroup.add(instHousing, instLed);
  }

  // =========================================================================
  // =========================================================================
  // 2. ASCENSOR FÍSICO 3D (NÚCLEO VERTICAL ARQUITECTÓNICO, CABINA PANORÁMICA, PÓRTICOS Y BOTONERAS)
  // =========================================================================
  const shaftGroup = new THREE.Group();
  shaftGroup.name = 'CentralElevatorShaftCore';
  auroraGroup.add(shaftGroup);

  // Materiales calibrados del ascensor en armonía arquitectónica con Cabina 1 (titanio, champán, carbono y cristal óptico)
  const elTitaniumM = trackExtraMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b495d,
      metalness: 0.82,
      roughness: 0.28,
    })
  );
  const elChampagneM = trackExtraMat(
    new THREE.MeshStandardMaterial({
      color: 0xc2ab8a,
      metalness: 0.88,
      roughness: 0.24,
    })
  );
  const elCarbonSillM = trackExtraMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e2634,
      metalness: 0.56,
      roughness: 0.42,
    })
  );
  const elOpticalGlassM = trackExtraMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xdcf4ff,
      metalness: 0.06,
      roughness: 0.07,
      transparent: true,
      opacity: 0.18,
      reflectivity: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );

  const makeElevatorFloorButtonTexture = (deck) => {
    const fallbackAccent = `#${(deck.accentHex ?? 0x38d8ff).toString(16).padStart(6, '0')}`;
    if (typeof document === 'undefined') {
      return trackExtraTex(makeDeckSignTexture(deck.code, deck.shortName.toUpperCase(), 'PLANTA', fallbackAccent));
    }
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 96;
    const ctx = cv.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0e1726';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.strokeStyle = 'rgba(208, 232, 255, 0.72)';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, cv.width - 8, cv.height - 8);
      ctx.fillStyle = fallbackAccent;
      ctx.fillRect(10, 12, 10, cv.height - 24);
      ctx.fillStyle = '#f8fbff';
      ctx.font = 'bold 42px "Segoe UI", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(deck.code, 30, 48);
      ctx.fillStyle = '#bfd9f2';
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(String(deck.shortName || '').toUpperCase().slice(0, 12), 118, 49);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = Math.min(8, tex.anisotropy || 4);
    return trackExtraTex(tex);
  };

  // Paredes laterales estructurales (±Z Aurora / ±X KRONOX), costillas champán y balizas luminosas de cota entre cubiertas
  [1, -1].forEach((side) => {
    add(shaftGroup, box(1.32, 13.5, 0.14), elTitaniumM, 0, 0, side * 1.44, 'wall');
    add(shaftGroup, box(0.26, 13.5, 0.22), elCarbonSillM, -0.74, 0, side * 1.40, 'wall');
    add(shaftGroup, box(0.26, 13.5, 0.22), elCarbonSillM, 0.74, 0, side * 1.40, 'wall');
    add(shaftGroup, box(0.08, 13.4, 0.08), elChampagneM, -0.62, 0, side * 1.31);
    add(shaftGroup, box(0.08, 13.4, 0.08), elChampagneM, 0.62, 0, side * 1.31);
    add(shaftGroup, box(0.09, 13.4, 0.11), steelM, -1.18, 0, side * 1.26);
    add(shaftGroup, box(0.09, 13.4, 0.11), steelM, 1.18, 0, side * 1.26);
    add(shaftGroup, box(0.036, 13.1, 0.035), cyanGlow, -0.34, 0, side * 1.33);
    add(shaftGroup, box(0.036, 13.1, 0.035), warmGlow, 0.34, 0, side * 1.33);
    for (let tickY = -6.2; tickY <= 6.2; tickY += 0.85) {
      const isDeckLevel = Math.abs(tickY % 3.4) < 0.35;
      add(shaftGroup, box(isDeckLevel ? 1.06 : 0.72, isDeckLevel ? 0.042 : 0.024, 0.035), isDeckLevel ? amberGlow : cyanGlow, 0, tickY, side * 1.34);
    }
  });

  // Travesaños estructurales y molduras entre cubiertas en frentes ±X (visibles desde la cabina acristalada durante el desplazamiento)
  [1, -1].forEach((endDir) => {
    [2.92, -0.48, -3.88].forEach((beamY) => {
      add(shaftGroup, box(0.14, 0.34, 2.66), elTitaniumM, endDir * 1.34, beamY, 0);
      add(shaftGroup, box(0.17, 0.05, 2.42), elChampagneM, endDir * 1.34, beamY + 0.16, 0);
      add(shaftGroup, box(0.16, 0.035, 2.16), cyanGlow, endDir * 1.28, beamY - 0.12, 0);
    });
  });

  // Anillos luminosos de nivel por cada cubierta dentro del pozo vertical
  [6.7, 3.44, 0.04, -3.36, -6.76].forEach((ringY) => {
    const t = add(shaftGroup, torus(ELEVATOR_SHAFT_RADIUS + 0.12, 0.032, 8, 36), elChampagneM, 0, ringY, 0);
    t.rotation.x = Math.PI / 2;
    const tGlow = add(shaftGroup, torus(ELEVATOR_SHAFT_RADIUS + 0.07, 0.018, 8, 36), cyanGlow, 0, ringY - 0.035, 0);
    tGlow.rotation.x = Math.PI / 2;
  });

  // Helper para crear hojas de puerta corrediza con mirilla óptica alta, marco de titanio y filete luminoso de cierre
  const buildFramedElevatorDoorLeaf = (parent, x, y, z, thickness, leafMat, isLanding = false) => {
    const leafGroup = new THREE.Group();
    leafGroup.position.set(x, y, z);
    leafGroup.userData.dynamicTransform = true;
    parent.add(leafGroup);
    // Zócalo inferior blindado + dintel superior + montantes verticales con mirilla central panorámica limpia
    const lowerM = add(leafGroup, box(thickness, 0.88, 0.66), leafMat, 0, -0.65, 0, isLanding ? 'door' : null);
    add(leafGroup, box(thickness, 0.28, 0.66), leafMat, 0, 0.95, 0, isLanding ? 'door' : null);
    add(leafGroup, box(thickness, 1.04, 0.14), elTitaniumM, 0, 0.19, -0.26, isLanding ? 'door' : null);
    add(leafGroup, box(thickness, 1.04, 0.14), elTitaniumM, 0, 0.19, 0.26, isLanding ? 'door' : null);
    // Molduras horizontales champán y cristal óptico transparente limpio (sin veladura lechosa)
    add(leafGroup, box(thickness + 0.014, 0.038, 0.40), elChampagneM, 0, 0.72, 0);
    add(leafGroup, box(thickness + 0.014, 0.038, 0.40), elChampagneM, 0, -0.20, 0);
    add(leafGroup, box(0.02, 0.88, 0.38), elOpticalGlassM, 0, 0.26, 0);
    // Filete óptico vertical de borde de encuentro
    const edgeZ = z < 0 ? 0.315 : -0.315;
    add(leafGroup, box(thickness + 0.012, 1.98, 0.024), cyanGlow, 0, 0.0, edgeZ);
    lowerM.userData.dynamicTransform = true;
    return leafGroup;
  };

  // Puertas y pórticos arquitectónicos en C01–C04 con señalética iluminada y consolas de llamada exteriores
  const landingDoorsByDeck = {};
  const callPanelLights = {};
  const doorStateByDeck = {
    'deck-01': 1.0,
    'deck-02': 0.0,
    'deck-03': 0.0,
    'deck-04': 0.0,
  };

  CABIN_DECKS.forEach((deck) => {
    const f = deck.elevationY;
    const doors = [];
    const beaconMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: deck.id === 'deck-01' ? 0x45e89e : 0xffb347 }));
    const signTex = trackExtraTex(makeDeckSignTexture(deck.code, deck.name.toUpperCase(), 'ASCENSOR CENTRAL KRONOX', `#${deck.accentHex.toString(16).padStart(6, '0')}`));
    const signMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: signTex }));

    [1, -1].forEach((endDir) => {
      const doorX = endDir * 1.34;
      // Pórtico metálico esculpido con jambas biseladas, dintel champán y umbral de titanio/carbono a ras de suelo
      add(shaftGroup, box(0.24, 0.46, 2.74), elTitaniumM, doorX, f + 2.52, 0, 'wall');
      add(shaftGroup, box(0.28, 0.07, 2.78), elChampagneM, doorX, f + 2.27, 0);
      add(shaftGroup, box(0.30, 0.016, 1.54), elCarbonSillM, doorX + endDir * 0.11, f + 0.008, 0);
      add(shaftGroup, box(0.05, 0.012, 1.44), cyanGlow, doorX + endDir * 0.14, f + 0.016, 0);
      add(shaftGroup, box(0.28, 2.34, 0.24), elTitaniumM, doorX, f + 1.17, -0.88, 'wall');
      add(shaftGroup, box(0.28, 2.34, 0.24), elTitaniumM, doorX, f + 1.17, 0.88, 'wall');
      add(shaftGroup, box(0.30, 2.26, 0.055), elChampagneM, doorX, f + 1.15, -0.75);
      add(shaftGroup, box(0.30, 2.26, 0.055), elChampagneM, doorX, f + 1.15, 0.75);
      // Placa luminosa exterior e interior de cubierta sobre cada pórtico
      const outerSign = add(shaftGroup, box(0.036, 0.34, 1.54), signMat, doorX + endDir * 0.13, f + 2.53, 0);
      outerSign.rotation.y = endDir > 0 ? Math.PI : 0;
      add(shaftGroup, box(0.12, 0.045, 0.88), beaconMat, doorX + endDir * 0.13, f + 2.31, 0);

      // Hojas correderas bipartitas sincronizadas
      const leftLeaf = buildFramedElevatorDoorLeaf(shaftGroup, doorX, f + 1.13, -0.35, 0.075, elTitaniumM, true);
      const rightLeaf = buildFramedElevatorDoorLeaf(shaftGroup, doorX, f + 1.13, 0.35, 0.075, elTitaniumM, true);
      doors.push({ leftLeaf, rightLeaf, doorX });

      // Columna de llamada exterior estilizada lateral ([E]) con aro champán y pulsador activo
      const sideSign = endDir > 0 ? 1 : -1;
      const callId = `elevator-call-${deck.id}-${endDir > 0 ? 'bow' : 'aft'}`;
      const callPedestal = add(shaftGroup, box(0.20, 1.44, 0.24), elTitaniumM, doorX + endDir * 0.16, f + 0.72, sideSign * 0.96);
      add(shaftGroup, box(0.22, 0.04, 0.26), elChampagneM, doorX + endDir * 0.16, f + 1.44, sideSign * 0.96);
      add(shaftGroup, box(0.22, 0.42, 0.25), elCarbonSillM, doorX + endDir * 0.17, f + 1.18, sideSign * 0.96);
      const callBtn = add(shaftGroup, box(0.075, 0.22, 0.14), beaconMat, doorX + endDir * 0.25, f + 1.18, sideSign * 0.96);
      registerInteractMesh(callPedestal, callId, 'elevator-call', deck.id);
      registerInteractMesh(callBtn, callId, 'elevator-call', deck.id);
    });

    landingDoorsByDeck[deck.id] = doors;
    callPanelLights[deck.id] = beaconMat;
  });

  // Cabina móvil panorámica del ascensor central con suelo compuesto, pasamanos y techo con luminaria indirecta
  const elevatorCab = new THREE.Group();
  elevatorCab.name = 'ElevatorCabAssembly';
  elevatorCab.position.set(0, 3.4, 0);
  auroraGroup.add(elevatorCab);

  // Plataforma antideslizante a ras de cubierta + aro guía de estado + cielo raso técnico con luz cálida indirecta
  add(elevatorCab, box(2.04, 0.14, 2.02), floorM, 0, -0.055, 0, 'floor');
  add(elevatorCab, box(1.66, 0.018, 1.66), elCarbonSillM, 0, 0.014, 0);
  const cabFloorRimMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
  const cabFloorRim = add(elevatorCab, torus(0.84, 0.024, 8, 40), cabFloorRimMat, 0, 0.024, 0);
  cabFloorRim.rotation.x = Math.PI / 2;
  add(elevatorCab, box(2.02, 0.14, 2.02), elTitaniumM, 0, 2.40, 0);
  add(elevatorCab, box(1.56, 0.05, 1.56), elCarbonSillM, 0, 2.31, 0);
  add(elevatorCab, torus(0.68, 0.024, 8, 36), warmGlow, 0, 2.28, 0).rotation.x = Math.PI / 2;
  add(elevatorCab, torus(0.76, 0.022, 8, 36), elChampagneM, 0, 2.29, 0).rotation.x = Math.PI / 2;

  // Pilastras estructurales biseladas en las 4 esquinas + acristalamiento óptico lateral + pasamanos de titanio
  [
    [-0.95, -0.95],
    [-0.95, 0.95],
    [0.95, -0.95],
    [0.95, 0.95],
  ].forEach(([cx, cz]) => {
    add(elevatorCab, box(0.14, 2.38, 0.14), elTitaniumM, cx, 1.19, cz);
    add(elevatorCab, box(0.06, 2.22, 0.06), elChampagneM, cx * 0.94, 1.19, cz * 0.94);
    add(elevatorCab, box(0.022, 1.98, 0.022), cyanGlow, cx * 0.90, 1.19, cz * 0.90);
  });
  [-1, 1].forEach((sz) => {
    add(elevatorCab, box(1.78, 0.34, 0.06), elTitaniumM, 0, 0.18, sz * 0.97);
    add(elevatorCab, box(1.78, 0.036, 0.075), elChampagneM, 0, 0.36, sz * 0.97);
    add(elevatorCab, box(1.78, 0.24, 0.06), elTitaniumM, 0, 2.23, sz * 0.97);
    add(elevatorCab, box(1.74, 1.72, 0.03), elOpticalGlassM, 0, 1.24, sz * 0.97);
    add(elevatorCab, cyl(0.022, 0.022, 1.46, 12), steelM, 0, 0.98, sz * 0.89).rotation.z = Math.PI / 2;
    [-0.58, 0.58].forEach((hx) => {
      add(elevatorCab, box(0.04, 0.04, 0.09), elChampagneM, hx, 0.98, sz * 0.93);
    });
  });

  // Puertas sincronizadas de la cabina móvil con mirilla limpia
  const cabDoorLeaves = [];
  [1, -1].forEach((endDir) => {
    const cx = endDir * 1.02;
    const cLeft = buildFramedElevatorDoorLeaf(elevatorCab, cx, 1.12, -0.33, 0.05, compositeM, false);
    const cRight = buildFramedElevatorDoorLeaf(elevatorCab, cx, 1.12, 0.33, 0.05, compositeM, false);
    cabDoorLeaves.push({ leftLeaf: cLeft, rightLeaf: cRight });
  });

  // Pantalla digital viva del ascensor (panel lateral + dinteles superiores sobre ambas salidas)
  const cabScreen = makeDiegeticScreenTexture(
    'elevator',
    'ASCENSOR CENTRAL KRONOX',
    ['PLANTA ACTUAL: C01 PUENTE', 'PUERTAS: ABIERTAS', 'PULSA [E] O [1-4] PARA VIAJAR', 'CUBIERTAS: C01 - C04'],
    '#38d8ff',
    { currentFloor: 0, targetFloor: 0 }
  );
  trackExtraTex(cabScreen.tex);
  const cabScreenMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: cabScreen.tex }));

  [1, -1].forEach((endDir) => {
    const tx = endDir * 0.94;
    add(elevatorCab, box(0.08, 0.30, 1.24), elTitaniumM, tx, 2.15, 0);
    const transomScr = add(elevatorCab, box(0.02, 0.22, 0.62), cabScreenMat, tx - endDir * 0.035, 2.15, 0);
    transomScr.rotation.y = endDir > 0 ? 0 : Math.PI;
    add(elevatorCab, box(0.03, 0.03, 1.16), cabFloorRimMat, tx - endDir * 0.03, 2.02, 0);
  });

  // Consola de control lateral (+Z Aurora / +X KRONOX) y columna delantera derecha con botones rotulados C01..C04
  add(elevatorCab, box(0.50, 1.14, 0.07), elTitaniumM, 0, 1.30, 0.90);
  add(elevatorCab, box(0.52, 0.032, 0.08), elChampagneM, 0, 1.88, 0.90);
  add(elevatorCab, box(0.42, 0.36, 0.02), cabScreenMat, 0, 1.63, 0.855);
  add(elevatorCab, box(0.09, 1.14, 0.28), elTitaniumM, 0.89, 1.30, 0.76);
  add(elevatorCab, box(0.02, 0.28, 0.22), cabScreenMat, 0.835, 1.66, 0.76);

  const cabButtonsByDeck = {};
  const elevatorButtonHitMat = trackExtraMat(new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  }));
  CABIN_DECKS.forEach((d, idx) => {
    const btnTex = makeElevatorFloorButtonTexture(d);
    const btnMat = trackExtraMat(
      new THREE.MeshBasicMaterial({
        map: btnTex,
        color: idx === 0 ? 0xb5ffda : 0xeaf6ff,
      })
    );
    const by = 1.34 - idx * 0.135;
    add(elevatorCab, box(0.36, 0.115, 0.02), elCarbonSillM, 0, by, 0.86);
    const btn = add(elevatorCab, box(0.32, 0.098, 0.042), btnMat, 0, by, 0.84);
    btn.userData.elevatorFloorButton = d.id;
    registerInteractMesh(btn, `elevator-floor-${d.id}`, 'elevator-floor');
    // Zona de impacto ampliada para poder pulsar la botonera con ratón o con el centro de cámara.
    const btnHitTarget = add(elevatorCab, box(0.44, 0.16, 0.11), elevatorButtonHitMat, 0, by, 0.81);
    registerInteractMesh(btnHitTarget, `elevator-floor-${d.id}`, 'elevator-floor');

    // Botón rotulado también en la pilastra frontal de marcha
    const frontBtn = add(elevatorCab, box(0.04, 0.095, 0.20), btnMat, 0.83, by, 0.76);
    frontBtn.userData.elevatorFloorButton = d.id;
    registerInteractMesh(frontBtn, `elevator-floor-${d.id}`, 'elevator-floor');
    const frontHitTarget = add(elevatorCab, box(0.12, 0.16, 0.28), elevatorButtonHitMat, 0.83, by, 0.76);
    registerInteractMesh(frontHitTarget, `elevator-floor-${d.id}`, 'elevator-floor');
    cabButtonsByDeck[d.id] = btnMat;
  });

  // Estado y máquina de estados del ascensor 3D con aceleración/desaceleración en curva S
  const elevatorState = {
    currentDeckId: 'deck-01',
    targetDeckId: 'deck-01',
    cabY: 3.4,
    rideStartY: 3.4,
    rideDuration: 0,
    rideElapsed: 0,
    speed: 0,
    progress: 1,
    phase: 'idle', // 'idle' | 'door-closing' | 'moving' | 'door-opening'
    phaseTimer: 0,
    moving: false,
    passengerRiding: false,
    doorOpenByDeck: doorStateByDeck,
    chimeCount: 0,
    lastChimeAt: 0,
    lastEvent: 'Cabina estacionada en C01 Puente de Mando.',
  };
  let lastCabScreenProgress = -1;

  function syncElevatorDoorsAndCabVisuals() {
    elevatorCab.position.y = elevatorState.cabY;
    const currentDeck = resolveCurrentDeck({ y: elevatorState.cabY });
    const activeCabDoorOpen = doorStateByDeck[currentDeck.id] ?? 0;

    CABIN_DECKS.forEach((d) => {
      const openVal = Math.max(0, Math.min(1, doorStateByDeck[d.id] ?? 0));
      const slide = openVal * ELEVATOR_DOOR_CLEAR_HALF_WIDTH;
      (landingDoorsByDeck[d.id] || []).forEach(({ leftLeaf, rightLeaf }) => {
        leftLeaf.position.z = -0.34 - slide;
        rightLeaf.position.z = 0.34 + slide;
      });
      const isHere = d.id === currentDeck.id && Math.abs(elevatorState.cabY - d.elevationY) < 0.25;
      if (callPanelLights[d.id]) {
        callPanelLights[d.id].color.setHex(
          elevatorState.targetDeckId === d.id && elevatorState.phase !== 'idle'
            ? 0x38d8ff
            : isHere && openVal > 0.7
              ? 0x45e89e
              : 0xffb347
        );
      }
      if (cabButtonsByDeck[d.id]) {
        cabButtonsByDeck[d.id].color.setHex(
          d.id === elevatorState.targetDeckId
            ? 0xa8ffcf
            : d.id === currentDeck.id
              ? 0xfff2a8
              : 0x9de6ff
        );
      }
    });

    const cabSlide = Math.max(0, Math.min(1, activeCabDoorOpen)) * 0.72;
    cabDoorLeaves.forEach(({ leftLeaf, rightLeaf }) => {
      leftLeaf.position.z = -0.31 - cabSlide;
      rightLeaf.position.z = 0.31 + cabSlide;
    });
    if (cabFloorRimMat) {
      cabFloorRimMat.color.setHex(
        elevatorState.phase === 'moving'
          ? 0x38d8ff
          : elevatorState.phase === 'door-closing' || elevatorState.phase === 'door-opening'
            ? 0xffb347
            : activeCabDoorOpen > 0.7
              ? 0x45e89e
              : 0x38d8ff
      );
    }
  }

  function redrawCabScreen() {
    const floorIdx = Math.max(0, CABIN_DECKS.findIndex((d) => d.id === elevatorState.currentDeckId));
    const targetIdx = Math.max(0, CABIN_DECKS.findIndex((d) => d.id === elevatorState.targetDeckId));
    const curDeck = CABIN_DECKS[floorIdx] || CABIN_DECKS[0];
    const targetDeck = CABIN_DECKS[targetIdx] || curDeck;
    const dirArrow = targetIdx > floorIdx ? '▼' : targetIdx < floorIdx ? '▲' : '●';
    const doorStatus =
      elevatorState.phase === 'moving'
        ? `EN TRÁNSITO ${dirArrow} ${targetDeck.code}`
        : elevatorState.phase === 'door-closing'
          ? 'CERRANDO COMPUERTAS'
          : elevatorState.phase === 'door-opening'
            ? 'ABRIENDO COMPUERTAS'
            : (doorStateByDeck[curDeck.id] ?? 0) > 0.7
              ? 'PUERTAS: ABIERTAS'
              : 'PUERTAS: CERRADAS';
    cabScreen.redraw(
      `ASCENSOR · ${curDeck.code} (${elevatorState.cabY >= 0 ? '+' : ''}${elevatorState.cabY.toFixed(1)}m)`,
      [
        `CUBIERTA: ${curDeck.shortName.toUpperCase()}`,
        doorStatus,
        `DESTINO: ${targetDeck.code} · ${targetDeck.shortName.toUpperCase()}`,
        'PULSA C01–C04 O TECLAS [1–4]',
      ],
      '#38d8ff',
      {
        currentFloor: floorIdx,
        targetFloor: targetIdx,
        rideProgress: elevatorState.progress,
        elevatorSpeed: elevatorState.speed,
      }
    );
  }

  function requestElevatorDeck(targetDeckId, passengerInside = false) {
    const targetDeck = CABIN_DECKS.find((d) => d.id === targetDeckId);
    if (!targetDeck) return false;
    if (
      Math.abs(elevatorState.cabY - targetDeck.elevationY) < 0.08 &&
      elevatorState.phase === 'idle'
    ) {
      elevatorState.passengerRiding = false;
      elevatorState.targetDeckId = targetDeck.id;
      elevatorState.currentDeckId = targetDeck.id;
      elevatorState.rideStartY = targetDeck.elevationY;
      elevatorState.rideElapsed = 0;
      elevatorState.rideDuration = 0;
      elevatorState.speed = 0;
      elevatorState.progress = 1;
      if ((doorStateByDeck[targetDeck.id] ?? 0) < 0.98) {
        elevatorState.phase = 'door-opening';
        elevatorState.phaseTimer = 0;
        elevatorState.lastEvent = `Abriendo puertas del ascensor en ${targetDeck.code}.`;
      }
      redrawCabScreen();
      return true;
    }

    // Mantener pasajero a bordo durante los trayectos iniciados desde la botonera física.
    elevatorState.passengerRiding = Boolean(passengerInside || elevatorState.passengerRiding);
    elevatorState.targetDeckId = targetDeck.id;
    elevatorState.phase = 'door-closing';
    elevatorState.phaseTimer = 0;
    elevatorState.moving = false;
    elevatorState.speed = 0;
    elevatorState.progress = 0;
    elevatorState.lastEvent = `Llamada confirmada hacia ${targetDeck.code} (${targetDeck.name}).`;
    redrawCabScreen();
    return true;
  }

  function snapElevatorToDeck(targetDeckId) {
    const targetDeck = CABIN_DECKS.find((d) => d.id === targetDeckId) || CABIN_DECKS[0];
    elevatorState.currentDeckId = targetDeck.id;
    elevatorState.targetDeckId = targetDeck.id;
    elevatorState.cabY = targetDeck.elevationY;
    elevatorState.rideStartY = targetDeck.elevationY;
    elevatorState.rideElapsed = 0;
    elevatorState.rideDuration = 0;
    elevatorState.speed = 0;
    elevatorState.progress = 1;
    elevatorState.phase = 'idle';
    elevatorState.moving = false;
    elevatorState.passengerRiding = false;
    CABIN_DECKS.forEach((d) => {
      doorStateByDeck[d.id] = d.id === targetDeck.id ? 1.0 : 0.0;
    });
    syncElevatorDoorsAndCabVisuals();
    redrawCabScreen();
  }

  function updateElevatorSystem(dt = 0.016) {
    const safeDt = Math.max(0, Math.min(0.08, dt));
    const targetDeck = CABIN_DECKS.find((d) => d.id === elevatorState.targetDeckId) || CABIN_DECKS[0];

    if (elevatorState.phase === 'door-closing') {
      elevatorState.speed = 0;
      let anyOpen = false;
      CABIN_DECKS.forEach((d) => {
        if (doorStateByDeck[d.id] > 0) {
          doorStateByDeck[d.id] = Math.max(0, doorStateByDeck[d.id] - safeDt * 1.85);
          if (doorStateByDeck[d.id] > 0) anyOpen = true;
        }
      });
      if (!anyOpen) {
        const span = Math.abs(targetDeck.elevationY - elevatorState.cabY);
        elevatorState.rideStartY = elevatorState.cabY;
        elevatorState.rideElapsed = 0;
        elevatorState.rideDuration = Math.max(1.15, 0.95 + span * 0.42);
        elevatorState.progress = 0;
        elevatorState.phase = 'moving';
        elevatorState.moving = true;
        elevatorState.lastEvent = `Ascensor en tránsito hacia ${targetDeck.code}.`;
        redrawCabScreen();
      }
    } else if (elevatorState.phase === 'moving') {
      elevatorState.moving = true;
      elevatorState.rideElapsed += safeDt;
      const dur = Math.max(0.85, elevatorState.rideDuration || 1.8);
      const t = Math.min(1, elevatorState.rideElapsed / dur);
      const eased = smootherstep01(t);
      const prevY = elevatorState.cabY;
      elevatorState.cabY =
        elevatorState.rideStartY + (targetDeck.elevationY - elevatorState.rideStartY) * eased;
      elevatorState.speed = safeDt > 1e-4 ? Math.abs(elevatorState.cabY - prevY) / safeDt : 0;
      elevatorState.progress = eased;
      if (Math.abs(elevatorState.progress - lastCabScreenProgress) >= 0.04) {
        redrawCabScreen();
        lastCabScreenProgress = elevatorState.progress;
      }

      const midDeck = resolveCurrentDeck({ y: elevatorState.cabY });
      if (midDeck.id !== elevatorState.currentDeckId) {
        elevatorState.currentDeckId = midDeck.id;
        redrawCabScreen();
      }
      if (t >= 1 || Math.abs(targetDeck.elevationY - elevatorState.cabY) <= 0.004) {
        elevatorState.cabY = targetDeck.elevationY;
        elevatorState.currentDeckId = targetDeck.id;
        elevatorState.phase = 'door-opening';
        elevatorState.moving = false;
        elevatorState.speed = 0;
        elevatorState.progress = 1;
        elevatorState.chimeCount += 1;
        elevatorState.lastChimeAt = performance.now?.() || Date.now();
        elevatorState.lastEvent = `Llegada a ${targetDeck.code} (${targetDeck.name}).`;
        redrawCabScreen();
      }
    } else if (elevatorState.phase === 'door-opening') {
      elevatorState.moving = false;
      elevatorState.speed = 0;
      doorStateByDeck[targetDeck.id] = Math.min(1, (doorStateByDeck[targetDeck.id] ?? 0) + safeDt * 1.65);
      if (doorStateByDeck[targetDeck.id] >= 0.995) {
        doorStateByDeck[targetDeck.id] = 1.0;
        elevatorState.phase = 'idle';
        elevatorState.passengerRiding = false;
        redrawCabScreen();
      }
    }

    syncElevatorDoorsAndCabVisuals();
  }

  syncElevatorDoorsAndCabVisuals();

  // =========================================================================
  // 3. REVESTIMIENTO ESFÉRICO INTERIOR + VENTANALES CON MARCOS Y CONTRASTE PBR
  // =========================================================================
  [0.0, -3.4, -6.8].forEach((floorY, dIdx) => {
    const deckKey = `deck-0${dIdx + 2}`;
    const dParent = deckContainers[deckKey];
    const midY = floorY + 1.65;
    const rTop = Math.sqrt(Math.max(40, AURORA_SPHERE_RADIUS ** 2 - (floorY + 3.25) ** 2)) - 0.35;
    const rBot = Math.sqrt(Math.max(40, AURORA_SPHERE_RADIUS ** 2 - floorY ** 2)) - 0.35;
    add(dParent, cachedGeo(`shellCyl:${rTop.toFixed(2)}:${rBot.toFixed(2)}`, () => new THREE.CylinderGeometry(rTop, rBot, 3.25, 48, 1, true)), outerShellInnerWallM, 0, midY, 0);

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (dIdx === 0 ? Math.PI / 8 : 0);
      const rMid = (rTop + rBot) * 0.5 - 0.15;
      const rib = new THREE.Group();
      rib.position.set(rMid * Math.cos(a), midY, rMid * Math.sin(a));
      rib.rotation.y = -a + Math.PI / 2;
      dParent.add(rib);
      add(rib, box(0.28, 3.12, 0.28), darkM, 0, 0, 0);
      add(rib, box(0.12, 3.1, 0.08), steelM, 0.14, 0, 0);
      if (dIdx !== 0 && i % 2 === 0) {
        // Ventanilla enmarcada en acero con brillo interior sutil y cristal reflectante
        add(rib, box(1.56, 0.88, 0.14), darkM, 1.35, 0.2, 0.04);
        add(rib, box(1.38, 0.72, 0.06), warmGlow, 1.35, 0.2, -0.02);
        add(rib, box(1.42, 0.76, 0.03), glassM, 1.35, 0.2, 0.08);
      }
    }
  });

  function chair(parent, x, z, f, rot) {
    const g = new THREE.Group();
    g.position.set(x, f, z);
    g.rotation.y = rot;
    parent.add(g);
    add(g, cyl(0.2, 0.3, 0.48, 12), darkM, 0, 0.24, 0);
    add(g, cyl(0.34, 0.36, 0.06, 14), steelM, 0, 0.03, 0);
    add(g, box(0.84, 0.14, 0.82), slateM, 0, 0.49, 0);
    add(g, box(0.78, 0.12, 0.76), bedM, 0, 0.56, 0.02);
    // Respaldo anatómico esculpido con refuerzos lumbares laterales y cabecero articulado
    add(g, box(0.82, 0.92, 0.12), slateM, 0, 1.02, -0.41);
    add(g, box(0.74, 0.84, 0.12), bedM, 0, 1.01, -0.35);
    [-0.34, 0.34].forEach((bx) => {
      add(g, box(0.12, 0.72, 0.16), warmHabM, bx, 0.96, -0.31);
    });
    add(g, box(0.46, 0.24, 0.14), bedM, 0, 1.54, -0.34);
    add(g, box(0.50, 0.04, 0.16), steelM, 0, 1.41, -0.35);
    // Reposabrazos con minipaneles táctiles integrados
    [-0.44, 0.44].forEach((ax) => {
      add(g, box(0.11, 0.18, 0.64), slateM, ax, 0.68, -0.04);
      add(g, box(0.12, 0.04, 0.56), steelM, ax, 0.78, -0.02);
      add(g, box(0.08, 0.02, 0.18), cyanGlow, ax, 0.805, 0.14);
    });
  }

  function mountDeckPlacard(parent, x, y, z, rotY, code, title, subtitle, hex = '#38d8ff') {
    const tex = trackExtraTex(makeDeckSignTexture(code, title, subtitle, hex));
    const mat = trackExtraMat(new THREE.MeshBasicMaterial({ map: tex }));
    const holder = new THREE.Group();
    holder.position.set(x, y, z);
    holder.rotation.y = rotY;
    parent.add(holder);
    add(holder, box(1.9, 0.52, 0.06), darkM, 0, 0, 0);
    add(holder, box(1.78, 0.44, 0.02), mat, 0, 0, 0.035);
  }

  // ==================== CUBIERTA 1 · PUENTE DE MANDO ESCULPIDO (Y = +3.4) ====================
  const bridgeCabina1Result = buildBridgeCabina13D({
    parentGroup: deckContainers['deck-01'],
    floorY: 3.4,
    mountDeckPlacard,
    registerColliderMesh,
    staticFreezeCandidates,
  });
  bridgeCabina1Result?.extraConsoleScreens?.forEach(({ mesh, stationId }) => {
    if (mesh && stationId) {
      mesh.userData.stationId = stationId;
      registerInteractMesh(mesh, stationId, 'panel', 'deck-01');
    }
  });
  disposableExtras.push(bridgeCabina1Result);

  // ==================== CUBIERTA 2 · HABITACIONAL, BIOPÓNICA Y ESCLUSA (Y = 0.0) ====================
  const interactiveMechanisms = {
    bioponicsActive: true,
    hydrationDispensing: false,
    airlockPressurized: true,
    storageC02Open: false,
    cabinDoorsOpen: [true, true, true, true, true, true],
    cabinLamps: ['warm', 'warm', 'warm', 'warm', 'warm', 'warm'],
    cabinLockersOpen: [false, false, false, false, false, false],
    cabinTabletPages: [0, 0, 0, 0, 0, 0],
    restingBayIndex: null,
    restingSleepActive: false,
    crewRestPct: 82,
    restCyclesCompleted: 0,
    galleyCoffeeBrewing: false,
    loungeMusicActive: true,
    medScanActive: false,
    gymWorkoutActive: false,
    orrerySpinFast: false,
    auroraHoloActive: true,
    specSamplesActive: false,
    evaCheckActive: false,
    reactorMode: 'nominal', // 'nominal' | 'overclock' | 'quiet'
    hangarCraneDeployed: false,
    maintDrawerOpen: false,
    multitoolCollected: false,
    scannerCollected: false,
    workLightActive: true,
    benchClampLocked: false,
    partsTrayOpen: false,
  };
  const snapshotMechanisms = () => ({
    ...interactiveMechanisms,
    cabinDoorsOpen: [...interactiveMechanisms.cabinDoorsOpen],
    cabinLamps: [...interactiveMechanisms.cabinLamps],
    cabinLockersOpen: [...interactiveMechanisms.cabinLockersOpen],
    cabinTabletPages: [...interactiveMechanisms.cabinTabletPages],
  });
  let reactorPlasmaCore = null;
  let reactorPlasmaMat = null;
  let cryoValvePivot = null;
  let craneTrolleyGroup = null;
  let maintArmPivot = null;
  let maintDrawerPivot = null;
  let partsTrayPivot = null;
  let workLightPivot = null;
  let workLampMat = null;
  let clampJawParts = null;
  let maintenanceFanRotor = null;
  let maintenanceDrone = null;
  let maintenanceDroneRings = [];
  let shuttleHatchPivot = null;
  let pickupMultitoolGroup = null;
  let pickupScannerGroup = null;

  // Textura procedural: Fotografía de la Tierra vista desde la órbita (cuadro personal en camarotes)
  function makeEarthPhotoTexture() {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, 256, 256);
    // Resplandor atmosférico azul
    const glow = ctx.createRadialGradient(128, 128, 68, 128, 128, 108);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
    glow.addColorStop(0.65, 'rgba(14, 116, 144, 0.22)');
    glow.addColorStop(1, 'rgba(0, 10, 30, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.fill();
    // Océano terrestre profundo
    const earthGrad = ctx.createRadialGradient(112, 104, 12, 128, 128, 80);
    earthGrad.addColorStop(0, '#1d4ed8');
    earthGrad.addColorStop(0.6, '#0f3a7a');
    earthGrad.addColorStop(1, '#051838');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(128, 128, 80, 0, Math.PI * 2);
    ctx.fill();
    // Continentes verdes y ocres
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.ellipse(116, 106, 32, 22, 0.32, 0, Math.PI * 2);
    ctx.ellipse(142, 136, 24, 36, -0.42, 0, Math.PI * 2);
    ctx.ellipse(96, 136, 18, 15, 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.ellipse(118, 108, 20, 14, 0.32, 0, Math.PI * 2);
    ctx.ellipse(140, 140, 15, 22, -0.32, 0, Math.PI * 2);
    ctx.fill();
    // Nubes arremolinadas en espiral
    ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
    ctx.beginPath();
    ctx.ellipse(108, 96, 34, 10, -0.22, 0, Math.PI * 2);
    ctx.ellipse(140, 118, 40, 11, 0.38, 0, Math.PI * 2);
    ctx.ellipse(118, 152, 36, 13, -0.16, 0, Math.PI * 2);
    ctx.ellipse(86, 122, 18, 7, 0.48, 0, Math.PI * 2);
    ctx.fill();
    // Marco exterior con tipografía técnica
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, 244, 244);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('PLANETA TIERRA · MISION KRONOX', 20, 242);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  const earthPhotoTex = trackExtraTex(makeEarthPhotoTexture());
  const earthPhotoMat = trackExtraMat(
    earthPhotoTex
      ? new THREE.MeshBasicMaterial({ map: earthPhotoTex })
      : new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }),
  );

  const deck02Result = buildDeck02Habitational3D({
    parentGroup: deckOverlayGroups['deck-02'],
    floorY: 0.0,
    materials: {
      wallM, darkM, steelM, slateM, goldM, copperM, doorM, bedM, compositeM,
      warmHabM, glassM, quiltedM, railAmberM, cyanGlow, amberGlow, greenGlow, warmGlow, uvVioletGlow,
    },
    earthPhotoMat,
    mountDeckPlacard,
    registerColliderMesh,
    registerInteractMesh,
    staticFreezeCandidates,
  });
  disposableExtras.push(deck02Result);

  // ==================== CUBIERTA 3 · INGENIERÍA, REACTOR Y SPHEREx (Y = -3.4) ====================
  {
    const d3 = deckContainers['deck-03'];
    const f = -3.4;

    // ═══════════════════════════════════════════════════════════════════════════
    // REACTOR TOROIDAL DE FUSIÓN NUCLEAR — MOTOR PRINCIPAL DE PROPULSIÓN AURORA
    // Sistema de confinamiento magnético tokamak con cámara de vacío toroidal,
    // 12 bobinas superconductoras de campo toroidal (TF), 6 bobinas poloidales (PF),
    // núcleo de plasma D-T a 150 millones K, sistema criogénico de helio líquido,
    // barras de control de neutrones, blindaje de boro y pantallas de telemetría.
    // Potencia nominal: 4.2 GW térmicos → 1.8 GW propulsión iónica + 600 MW eléctricos
    // ═══════════════════════════════════════════════════════════════════════════
    const rg = new THREE.Group();
    rg.name = 'ReactorToroidalAssembly';
    rg.position.set(-9, f, 0);
    d3.add(rg);

    // --- Materiales especializados del reactor ---
    const reactorRedGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.85 }));
    const reactorPurpleGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.8 }));
    const plasmaOrangeGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.7 }));
    const neutronBlueGlow = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 }));
    const containmentFieldMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x6ce3ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
    const warningRedMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0xff2222 }));

    // --- Plataforma base elevada del reactor con suelo antideslizante texturado ---
    add(rg, cyl(3.85, 4.1, 0.32, 36), slateM, 0, 0.16, 0, 'console');
    add(rg, cyl(3.72, 3.72, 0.06, 36), darkM, 0, 0.34, 0);
    // Piso de rejilla técnica con patrón de diamante
    for (let i = 0; i < 12; i++) {
      const ga = (i / 12) * Math.PI * 2;
      add(rg, box(3.4, 0.02, 0.04), steelM, 0, 0.35, 0).rotation.y = ga;
    }
    // Anillo inferior de contención con marcas de peligro
    const baseRing = add(rg, torus(3.92, 0.08, 8, 48), hazardM, 0, 0.08, 0);
    baseRing.rotation.x = Math.PI / 2;

    // --- CÁMARA DE VACÍO TOROIDAL (anillo principal del tokamak) ---
    // Torus principal: R_mayor = 1.85m, r_menor = 0.72m — cámara de alto vacío donde se confina el plasma
    add(rg, torus(1.85, 0.72, 16, 48), steelM, 0, 1.48, 0).rotation.x = Math.PI / 2;
    // Revestimiento interno de tungsteno del divertor (visible como anillo interno más oscuro)
    add(rg, torus(1.85, 0.58, 12, 48), darkM, 0, 1.48, 0).rotation.x = Math.PI / 2;

    // --- NÚCLEO DE PLASMA (cilindro luminoso central que gira) ---
    reactorPlasmaMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x7ce6ff, transparent: true, opacity: 0.88 }));
    reactorPlasmaCore = add(rg, torus(1.85, 0.42, 12, 36), reactorPlasmaMat, 0, 1.48, 0);
    reactorPlasmaCore.rotation.x = Math.PI / 2;
    reactorPlasmaCore.name = 'ReactorPlasmaCore';
    reactorPlasmaCore.userData.dynamicTransform = true;
    // Anillo interior de plasma supercaliente (segunda capa más brillante)
    const innerPlasmaRing = add(rg, torus(1.85, 0.22, 8, 32), plasmaOrangeGlow, 0, 1.48, 0);
    innerPlasmaRing.rotation.x = Math.PI / 2;
    innerPlasmaRing.userData.dynamicTransform = true;
    innerPlasmaRing.name = 'InnerPlasmaHot';

    // --- 12 BOBINAS SUPERCONDUCTORAS DE CAMPO TOROIDAL (TF Coils) ---
    // Cada bobina es un toroide vertical que abraza la cámara de vacío
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cx = 1.85 * Math.cos(a);
      const cz = 1.85 * Math.sin(a);
      // Bobina principal de Nb₃Sn superconductor (cobre por fuera)
      const tfCoil = add(rg, torus(0.92, 0.11, 8, 24), copperM, cx, 1.48, cz);
      tfCoil.rotation.y = a;
      tfCoil.rotation.x = Math.PI / 2;
      tfCoil.userData.dynamicTransform = true;
      // Soporte estructural de la bobina al carcasa
      add(rg, cyl(0.065, 0.065, 0.35, 8), steelM, cx * 1.32, 1.48, cz * 1.32).rotation.x = a;
      // Crioshroud de la bobina (aislamiento térmico MLI dorado)
      if (i % 3 === 0) {
        const cryoShield = add(rg, box(0.24, 1.0, 0.08), goldM, cx * 1.15, 1.48, cz * 1.15);
        cryoShield.rotation.y = a;
      }
      // Conexión eléctrica superior con bus de superconductor
      add(rg, cyl(0.025, 0.025, 0.45, 6), copperM, cx * 0.85, 2.25, cz * 0.85);
    }

    // --- 6 BOBINAS POLOIDALES (PF Coils) — control de posición y forma del plasma ---
    [0.55, 0.95, 1.25, 1.71, 2.01, 2.41].forEach((py, idx) => {
      const pfR = 2.65 + (idx < 3 ? 0.1 * idx : 0.1 * (5 - idx));
      const pfCoil = add(rg, torus(pfR, 0.075, 8, 32), copperM, 0, py, 0);
      pfCoil.rotation.x = Math.PI / 2;
      pfCoil.userData.dynamicTransform = true;
      // Indicador LED de estado de cada bobina poloidal
      const ledColor = idx < 2 ? greenGlow : idx < 4 ? cyanGlow : amberGlow;
      add(rg, sphereGeo(0.04, 8, 6), ledColor, pfR + 0.12, py, 0);
    });

    // --- SOLENOIDE CENTRAL (CS — Central Solenoid) para inducir corriente en el plasma ---
    add(rg, cyl(0.35, 0.35, 2.4, 16), copperM, 0, 1.48, 0);
    add(rg, cyl(0.28, 0.28, 2.55, 12), darkM, 0, 1.48, 0);
    // Bus bar superior e inferior del solenoide
    add(rg, cyl(0.42, 0.42, 0.08, 16), goldM, 0, 2.72, 0);
    add(rg, cyl(0.42, 0.42, 0.08, 16), goldM, 0, 0.24, 0);

    // --- 6 COLUMNAS ESTRUCTURALES del reactor con soportes antisísmicos ---
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      const cr = 3.15;
      // Columna principal de acero
      add(rg, cyl(0.18, 0.18, 2.95, 12), steelM, cr * Math.cos(a), 1.48, cr * Math.sin(a));
      // Refuerzo diagonal antitorque (arbotante)
      const brace = add(rg, cyl(0.06, 0.06, 1.65, 8), darkM, cr * 0.82 * Math.cos(a), 0.82, cr * 0.82 * Math.sin(a));
      brace.rotation.z = 0.45;
      brace.rotation.y = -a;
      // Bobina de estabilización magnética pasiva en cada columna
      const stabCoil = add(rg, torus(0.28, 0.065, 8, 16), copperM, cr * Math.cos(a), 1.48, cr * Math.sin(a));
      stabCoil.rotation.y = -a;
      stabCoil.userData.dynamicTransform = true;
      // Indicadores de temperatura criogénica
      add(rg, box(0.06, 0.12, 0.04), i % 2 === 0 ? greenGlow : cyanGlow, (cr + 0.14) * Math.cos(a), 2.1, (cr + 0.14) * Math.sin(a));
    }

    // --- BARANDILLA DE SEGURIDAD PERIMETRAL con postes iluminados ---
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const postR = 3.65;
      add(rg, cyl(0.04, 0.05, 1.05, 8), darkM, postR * Math.cos(a), 0.52, postR * Math.sin(a));
      // Mini luces de seguridad en cada poste
      add(rg, sphereGeo(0.025, 6, 4), i % 3 === 0 ? warningRedMat : amberGlow, postR * Math.cos(a), 1.06, postR * Math.sin(a));
    }
    // Pasamanos superior continuo
    const guardRing = add(rg, torus(3.65, 0.035, 8, 48), railAmberM, 0, 1.04, 0);
    guardRing.rotation.x = Math.PI / 2;
    // Segundo pasamanos intermedio
    const midRail = add(rg, torus(3.65, 0.025, 6, 48), steelM, 0, 0.62, 0);
    midRail.rotation.x = Math.PI / 2;

    // --- ANILLOS DE CONFINAMIENTO MAGNÉTICO visibles (campo de contención holográfico) ---
    [0.85, 1.15, 1.48, 1.81, 2.11].forEach((fy, fIdx) => {
      const fieldRing = add(rg, torus(2.2 + fIdx * 0.04, 0.015, 6, 32), containmentFieldMat, 0, fy, 0);
      fieldRing.rotation.x = Math.PI / 2;
      fieldRing.userData.dynamicTransform = true;
      fieldRing.name = `ContainmentField_${fIdx}`;
    });

    // --- ANILLOS DECORATIVOS DE CARCASA (exterior del tokamak) ---
    [0.42, 0.78, 1.18, 1.78, 2.18, 2.54].forEach((ty) => {
      const casingRing = add(rg, torus(2.95, 0.09, 8, 36), goldM, 0, ty, 0);
      casingRing.rotation.x = Math.PI / 2;
      casingRing.userData.dynamicTransform = true;
    });
    // Placas de tapa superior e inferior de la carcasa del reactor
    add(rg, cyl(2.95, 2.82, 0.18, 32), slateM, 0, 0.34, 0, 'console');
    add(rg, cyl(2.82, 2.95, 0.18, 32), slateM, 0, 2.62, 0, 'console');

    // --- 8 BARRAS DE CONTROL DE NEUTRONES (insertables desde arriba) ---
    for (let i = 0; i < 8; i++) {
      const ba = (i / 8) * Math.PI * 2;
      const br = 1.85;
      // Guía de la barra
      add(rg, cyl(0.055, 0.055, 0.65, 8), steelM, br * Math.cos(ba), 2.65, br * Math.sin(ba));
      // Barra de carburo de boro (elemento absorbedor)
      const ctrlRod = add(rg, cyl(0.035, 0.035, 0.85, 8), darkM, br * Math.cos(ba), 2.35, br * Math.sin(ba));
      ctrlRod.userData.dynamicTransform = true;
      ctrlRod.name = `ControlRod_${i}`;
      // Indicador LED de posición de barra
      add(rg, sphereGeo(0.03, 6, 4), i % 2 === 0 ? greenGlow : amberGlow, br * Math.cos(ba), 2.98, br * Math.sin(ba));
    }

    // --- SISTEMA DE DIAGNÓSTICO DEL PLASMA (puertos de diagnóstico radiales) ---
    for (let i = 0; i < 4; i++) {
      const da = (i / 4) * Math.PI * 2 + Math.PI / 8;
      const diagPort = new THREE.Group();
      diagPort.position.set(2.65 * Math.cos(da), 1.48, 2.65 * Math.sin(da));
      diagPort.rotation.y = -da;
      rg.add(diagPort);
      // Tubo del puerto de diagnóstico
      add(diagPort, cyl(0.12, 0.12, 0.55, 10), steelM, 0, 0, 0).rotation.x = Math.PI / 2;
      // Ventana de cuarzo del espectrómetro
      add(diagPort, cyl(0.09, 0.09, 0.04, 10), glassM, 0, 0, 0.28);
      // Detector (caja electrónica al extremo)
      add(diagPort, box(0.22, 0.16, 0.12), compositeM, 0, 0, 0.38);
      // LED de estado del diagnóstico
      add(diagPort, sphereGeo(0.025, 6, 4), greenGlow, 0.08, 0.06, 0.42);
    }

    // --- PANTALLA DE TELEMETRÍA DEL REACTOR (monitor principal) ---
    const reactorTelTex = makeDiegeticScreenTexture('engineering', 'REACTOR AURORA — ESTADO DEL PLASMA', [
      'MODO: NOMINAL · 4.2 GW TÉRMICOS',
      'TEMP PLASMA: 150.4 × 10⁶ K',
      'β TOROIDAL: 3.8% · q₉₅: 4.12',
      'CORRIENTE PLASMA: 12.6 MA',
      'CONFINAMIENTO τE: 3.82 s',
      'DENSIDAD: 1.2 × 10²⁰ m⁻³',
      'POTENCIA FUSIÓN D-T: 4.21 GW',
      'BLINDAJE NEUTRÓNICO: ACTIVO',
    ], '#6ce0ff', { activeScan: true });
    trackExtraTex(reactorTelTex.tex);
    const reactorTelMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: reactorTelTex.tex }));
    // Soporte del monitor principal (orientado de frente al operador en +X_local)
    const monitorGroup = new THREE.Group();
    monitorGroup.position.set(-5.8, f + 1.48, 0);
    monitorGroup.rotation.y = Math.PI / 2;
    d3.add(monitorGroup);
    add(monitorGroup, box(1.5, 1.0, 0.08), darkM, 0, 0, 0);
    add(monitorGroup, box(1.42, 0.92, 0.03), reactorTelMat, 0, 0, 0.045);
    add(monitorGroup, box(1.54, 0.04, 0.12), steelM, 0, 0.52, 0);
    add(monitorGroup, box(1.54, 0.04, 0.12), steelM, 0, -0.52, 0);
    add(monitorGroup, cyl(0.045, 0.045, 0.62, 8), steelM, 0, -0.62, 0);
    registerInteractMesh(monitorGroup.children[1], 'engineering', 'panel');

    // --- SEGUNDA PANTALLA: SISTEMA DE REFRIGERACIÓN CRIOGÉNICA ---
    const cryoScreenTex = makeDiegeticScreenTexture('engineering', 'CRIOGENIA Y REFRIGERACIÓN', [
      'HELIO LÍQUIDO: 4.2 K · PRESIÓN: 1.2 bar',
      'FLUJO CRIOSTATO TF: 340 g/s',
      'FLUJO CRIOSTATO PF: 180 g/s',
      'TEMP ESCUDO TÉRMICO: 77.4 K',
      'NIVEL LHe TANQUE A: 87.3%',
      'NIVEL LHe TANQUE B: 91.6%',
      'BOMBA CRYO-1: NOMINAL',
      'BOMBA CRYO-2: NOMINAL',
    ], '#2dd4bf', { activeScan: false });
    trackExtraTex(cryoScreenTex.tex);
    const cryoScreenMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: cryoScreenTex.tex }));
    const cryoMonitor = new THREE.Group();
    cryoMonitor.position.set(-5.6, f + 1.45, 1.45);
    cryoMonitor.rotation.y = Math.PI / 2 - 0.28;
    d3.add(cryoMonitor);
    add(cryoMonitor, box(1.3, 0.85, 0.07), darkM, 0, 0, 0);
    const cryoScrMesh = add(cryoMonitor, box(1.22, 0.77, 0.03), cryoScreenMat, 0, 0, 0.04);
    add(cryoMonitor, cyl(0.035, 0.035, 0.58, 8), steelM, 0, -0.58, 0);
    registerInteractMesh(cryoScrMesh, 'engineering', 'panel', 'deck-03');

    // --- TERCERA PANTALLA: CONTROL DE PROPULSIÓN ---
    const propScreenTex = makeDiegeticScreenTexture('engineering', 'PROPULSIÓN IÓNICA — EMPUJE VECTORIAL', [
      'MOTOR PRINCIPAL: 1.8 GW → 42.6 kN',
      'ISP ESPECÍFICO: 18,400 s',
      'CONSUMO Xe: 12.4 mg/s',
      'VECTORIZACIÓN: 0.0° / 0.0°',
      'ACELERACIÓN: 0.0034 m/s²',
      'DELTA-V RESTANTE: 47.2 km/s',
      'AUXILIAR 1-4: STANDBY',
      'ALCUBIERRE WARP: OFFLINE',
    ], '#ff8c42', { activeScan: true });
    trackExtraTex(propScreenTex.tex);
    const propScreenMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: propScreenTex.tex }));
    const propMonitor = new THREE.Group();
    propMonitor.position.set(-5.6, f + 1.45, -1.45);
    propMonitor.rotation.y = Math.PI / 2 + 0.28;
    d3.add(propMonitor);
    add(propMonitor, box(1.3, 0.85, 0.07), darkM, 0, 0, 0);
    const propScrMesh = add(propMonitor, box(1.22, 0.77, 0.03), propScreenMat, 0, 0, 0.04);
    add(propMonitor, cyl(0.035, 0.035, 0.58, 8), steelM, 0, -0.58, 0);
    registerInteractMesh(propScrMesh, 'engineering', 'panel', 'deck-03');

    // --- CONSOLA DE CONTROL PRINCIPAL frente al reactor ---
    const ctrlConsole = new THREE.Group();
    ctrlConsole.position.set(-5.3, f, 0);
    ctrlConsole.rotation.y = Math.PI / 2;
    d3.add(ctrlConsole);
    // Mesa de la consola ergonómica
    add(ctrlConsole, box(3.2, 0.08, 0.75), slateM, 0, 0.88, 0);
    const consoleFace = add(ctrlConsole, box(3.2, 0.72, 0.06), darkM, 0, 0.54, -0.36);
    consoleFace.rotation.x = 0.15;
    // Teclado/touchpad empotrado
    add(ctrlConsole, box(0.82, 0.03, 0.28), compositeM, 0.6, 0.91, 0.18);
    const reactorPad = add(ctrlConsole, box(0.74, 0.02, 0.22), cyanGlow, 0.6, 0.925, 0.18);
    registerInteractMesh(reactorPad, 'engineering', 'panel', 'deck-03');
    // Trackball de control de vectorización
    add(ctrlConsole, sphereGeo(0.065, 10, 8), steelM, -0.8, 0.96, 0.22);
    add(ctrlConsole, cyl(0.08, 0.08, 0.04, 12), darkM, -0.8, 0.895, 0.22);
    // Botones de control (fila de indicadores luminosos)
    [-1.2, -0.9, -0.6, -0.3, 0, 0.3].forEach((bx, bIdx) => {
      add(ctrlConsole, cyl(0.035, 0.035, 0.025, 8), bIdx < 2 ? greenGlow : bIdx < 4 ? cyanGlow : amberGlow, bx, 0.93, -0.12);
    });
    // Interruptor de emergencia SCRAM (botón rojo grande)
    add(ctrlConsole, cyl(0.065, 0.065, 0.04, 12), reactorRedGlow, -1.4, 0.93, 0.22);
    add(ctrlConsole, cyl(0.08, 0.08, 0.02, 12), hazardM, -1.4, 0.905, 0.22);
    // Silla del ingeniero de reactor con holgura para entrar y salir caminando
    chair(d3, -4.3, 0, f, -Math.PI / 2);

    // --- COLUMNAS AUXILIARES de soporte con conductos de refrigerante visibles ---
    [-4.5, 4.5].forEach((cz) => {
      // Columna de soporte con brida
      add(d3, cyl(0.32, 0.32, 3.05, 14), steelM, -9, f + 1.52, cz, 'console');
      add(d3, torus(0.38, 0.05, 8, 20), copperM, -9, f + 1.52, cz).rotation.x = Math.PI / 2;
      // Tubería de criogénico que sube por la columna
      add(d3, cyl(0.065, 0.065, 2.8, 8), goldM, -9 + 0.26, f + 1.52, cz);
      add(d3, cyl(0.065, 0.065, 2.8, 8), goldM, -9 - 0.26, f + 1.52, cz);
      // Válvulas de aislamiento en cada columna
      add(d3, torus(0.09, 0.025, 6, 12), railAmberM, -9 + 0.26, f + 2.2, cz).rotation.x = Math.PI / 2;
      add(d3, torus(0.09, 0.025, 6, 12), railAmberM, -9 - 0.26, f + 0.8, cz).rotation.x = Math.PI / 2;
    });

    // --- CONDUCTOS CRIOGÉNICOS PRINCIPALES en techo (ampliados) ---
    [-3.2, 3.2].forEach((pz) => {
      // Conducto primario
      add(d3, cyl(0.22, 0.22, 20.0, 14), steelM, 0, f + 2.75, pz).rotation.z = Math.PI / 2;
      // Aislamiento MLI dorado
      add(d3, cyl(0.28, 0.28, 1.5, 14), goldM, -4.5, f + 2.75, pz).rotation.z = Math.PI / 2;
      add(d3, cyl(0.28, 0.28, 1.5, 14), goldM, 4.5, f + 2.75, pz).rotation.z = Math.PI / 2;
      add(d3, cyl(0.28, 0.28, 1.5, 14), goldM, 0, f + 2.75, pz).rotation.z = Math.PI / 2;
      // Soportes colgantes del conducto
      [-6, -2, 2, 6].forEach((sx) => {
        add(d3, cyl(0.035, 0.035, 0.28, 6), darkM, sx, f + 2.9, pz);
      });
      // Canaleta de seguridad en piso con franjas hazard
      add(d3, box(16.0, 0.025, 0.38), hazardM, 0, f + 0.015, pz);
    });
    // Conductos cruzados transversales (nuevos)
    [-6, 0, 6].forEach((cx) => {
      add(d3, cyl(0.12, 0.12, 6.4, 10), steelM, cx, f + 2.72, 0).rotation.x = Math.PI / 2;
    });

    // --- PANEL DE VENTILACIÓN DE EMERGENCIA ampliado ---
    add(d3, box(0.28, 2.4, 5.2), ventM, -13.0, f + 1.2, 0);
    // Rejillas individuales con LEDs de flujo
    [-1.8, -0.6, 0.6, 1.8].forEach((vz) => {
      add(d3, box(0.04, 0.4, 0.6), darkM, -12.85, f + 2.0, vz);
      add(d3, sphereGeo(0.03, 6, 4), greenGlow, -12.82, f + 2.25, vz);
    });

    // --- VÁLVULA CRIOGÉNICA PRINCIPAL (mejorada con volante y vástago) ---
    cryoValvePivot = new THREE.Group();
    cryoValvePivot.position.set(-6.0, f + 1.1, 0);
    d3.add(cryoValvePivot);
    // Volante de la válvula con radios
    const rv = add(cryoValvePivot, torus(0.28, 0.04, 8, 24), railAmberM, 0, 0, 0);
    rv.rotation.y = Math.PI / 2;
    for (let vs = 0; vs < 4; vs++) {
      const va = (vs / 4) * Math.PI * 2;
      add(cryoValvePivot, box(0.24, 0.025, 0.025), steelM, 0, 0.12 * Math.cos(va), 0.12 * Math.sin(va));
    }
    // Vástago y cuerpo de la válvula
    add(d3, cyl(0.06, 0.06, 0.35, 8), steelM, -6.0, f + 1.1, 0).rotation.z = Math.PI / 2;
    add(d3, box(0.22, 0.18, 0.16), compositeM, -5.7, f + 1.1, 0);

    // --- PLACAS DE SEÑALIZACIÓN MEJORADAS ---
    mountDeckPlacard(d3, -6.4, f + 2.68, 0, Math.PI / 2, 'C03', 'REACTOR TOROIDAL AURORA', 'FUSIÓN D-T · 4.2 GW · CONFINAMIENTO MAGNÉTICO', '#6ce0ff');
    mountDeckPlacard(d3, -11.5, f + 2.68, 3.0, Math.PI * 0.75, 'C03', 'CRIOGENIA', 'HELIO LÍQUIDO 4.2 K', '#2dd4bf');
    mountDeckPlacard(d3, -11.5, f + 2.68, -3.0, Math.PI * 0.25, 'C03', 'PROPULSIÓN', 'MOTOR IÓNICO 1.8 GW', '#ff8c42');

    // --- TANQUES CRIOGÉNICOS DORADOS (altura contenida estrictamente bajo techo de Cubierta 03) ---
    [-6, 6].forEach((cz, tIdx) => {
      const tg = new THREE.Group();
      tg.position.set(9, f, cz);
      d3.add(tg);
      // Tanque cilíndrico principal con MLI dorado
      add(tg, cyl(1.42, 1.42, 1.88, 28), goldM, 0, 1.12, 0, 'console');
      // Domo esférico superior achatado (tope y=2.85 m < 3.05 m bajo losa de Cubierta 02)
      const dome = add(tg, sphereGeo(1.4, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), steelM, 0, 2.04, 0);
      dome.scale.y = 0.58;
      // Base con anclaje y brida
      add(tg, cyl(1.52, 1.52, 0.3, 28), slateM, 0, 0.16, 0);
      add(tg, cyl(1.48, 1.48, 0.08, 28), darkM, 0, 0.32, 0);
      // Anillo de refuerzo a media altura
      add(tg, cyl(1.48, 1.48, 0.16, 28), copperM, 0, 1.52, 0);
      add(tg, cyl(1.48, 1.48, 0.16, 28), copperM, 0, 0.85, 0);
      // Indicador de nivel de líquido (tubo visor)
      add(tg, cyl(0.04, 0.04, 1.42, 8), glassM, 1.32, 1.15, 0);
      const levelColor = tIdx === 0 ? 0.873 : 0.916;
      const levelH = 1.42 * levelColor;
      add(tg, cyl(0.03, 0.03, levelH, 8), neutronBlueGlow, 1.32, 0.44 + levelH * 0.5, 0);
      // Manómetro y válvula de alivio
      add(tg, cyl(0.15, 0.15, 0.04, 12), darkM, 0, 2.86, 0);
      add(tg, cyl(0.12, 0.12, 0.03, 12), cyanGlow, 0, 2.88, 0);
      // Válvula de seguridad
      add(tg, cyl(0.06, 0.06, 0.22, 8), steelM, 0.8, 2.38, 0).rotation.z = Math.PI / 4;
      add(tg, torus(0.08, 0.02, 6, 12), railAmberM, 0.8 + 0.11, 2.38 + 0.11, 0);
      // Placas de identificación
      const tankLabel = tIdx === 0 ? 'A' : 'B';
      add(tg, box(0.5, 0.3, 0.03), darkM, -1.38, 1.25, 0);
      add(tg, box(0.42, 0.22, 0.02), cyanGlow, -1.38, 1.25, 0.02);
      // Tuberías de conexión al reactor
      add(tg, cyl(0.09, 0.09, 4.5, 10), steelM, -4.5, 1.85, -cz * 0.3).rotation.z = Math.PI / 2;
      add(tg, cyl(0.12, 0.12, 0.3, 10), copperM, -2.5, 1.85, -cz * 0.3);
    });
    // Colector criogénico transversal mejorado entre ambos tanques
    add(d3, box(0.48, 0.24, 12.8), slateM, 9, f + 2.82, 0);
    add(d3, cyl(0.14, 0.14, 12.4, 14), copperM, 9, f + 2.62, 0).rotation.x = Math.PI / 2;
    // Tubo de ecualización de presión
    add(d3, cyl(0.06, 0.06, 12.0, 8), steelM, 9, f + 2.48, 0).rotation.x = Math.PI / 2;

    // --- LUZ AMBIENTAL DEL REACTOR (PointLight que cambia con el modo) ---
    const reactorPointLight = new THREE.PointLight(0x6ce3ff, 1.6, 12);
    reactorPointLight.position.set(-9, f + 1.5, 0);
    d3.add(reactorPointLight);
    reactorPointLight.userData.dynamicTransform = true;

    // --- BLINDAJE DE NEUTRONES (paneles de boro a los lados del reactor) ---
    [-2.5, 2.5].forEach((bz) => {
      add(d3, box(3.8, 2.6, 0.22), compositeM, -9, f + 1.4, bz + (bz > 0 ? 1.5 : -1.5));
      // Etiqueta de radiación
      add(d3, box(0.35, 0.35, 0.03), hazardM, -9, f + 2.2, bz + (bz > 0 ? 1.52 : -1.52));
    });

    // Pantallas diferenciadas para Laboratorio Espectral SPHEREx (Babor) vs Banco Óptico Láser (Estribor)
    const spherexLabTex = makeDiegeticScreenTexture('science', 'ESPECTROMETRÍA IR SPHEREx', ['BANDAS: 0.75 - 5.0 µm (102 CANALES)', 'CRIOSTATO DETECTOR: 42.0 K', 'CALIBRACIÓN FOTOMÉTRICA: ACTIVA'], '#ffbe55', { activeScan: true });
    liveStaticDisplays.science = spherexLabTex;
    trackExtraTex(spherexLabTex.tex);
    const spherexLabMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: spherexLabTex.tex }));

    const opticsLabTex = makeDiegeticScreenTexture('sensor-calibration', 'METROLOGÍA LÁSER Y ÓPTICA', ['INTERFERÓMETRO HE-NE: EN FASE', 'ERROR FRENTE DE ONDA: < 12 nm', 'COLIMADOR PRIMARIO: ALINEADO'], '#45e8ff', { activeScan: false });
    liveStaticDisplays.optical = opticsLabTex;
    trackExtraTex(opticsLabTex.tex);
    const opticsLabMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: opticsLabTex.tex }));

    const labShellGeo = cachedGeo('labShell:2.32:1.02:1.26', () =>
      buildBeveledConsoleShellGeo(2.32, 1.02, 1.26),
    );
    const labArchRibGeo = cachedGeo('labArchRib:2.48:2.64:0.18', () =>
      buildSculptedArchRibGeo(2.48, 2.64, 0.18, 2.16, 2.42, 0.24),
    );

    const buildLabArc = (sideName, accentMat, scrMat, placardTitle, placardSub, zPlacard, rotPlacard, placardHex) => {
      const isPortSpherex = sideName === 'port';
      C03_LAB_ARCS.filter((item) => item.side === sideName).forEach((item, idx) => {
        const g = new THREE.Group();
        g.position.set(15.2 * Math.sin(item.t), f, 15.2 * Math.cos(item.t));
        g.rotation.y = item.t;
        d3.add(g);
        // Costilla estructural de laboratorio esculpida y banco científico biselado
        add(g, labArchRibGeo, slateM, 0, 0, -0.42);
        add(g, labShellGeo, slateM, 0, 0, 0, 'console');
        add(g, box(2.26, 0.06, 1.18), compositeM, 0, 1.03, 0);
        add(g, box(2.05, 0.04, 0.88), accentMat, 0, 1.07, 0);
        add(g, box(1.88, 0.28, 0.12), ventM, 0, 0.22, -0.62);
        add(g, box(1.74, 0.64, 0.07), darkM, 0, 1.48, -0.36);
        const labMonitorMesh = add(g, box(1.66, 0.56, 0.03), scrMat, 0, 1.48, -0.32);
        registerInteractMesh(
          labMonitorMesh,
          isPortSpherex ? 'science' : 'sensor-calibration',
          'panel',
          'deck-03',
        );
        // Marquesina superior de instrumentos sobre cada estación del laboratorio
        add(g, box(2.28, 0.16, 1.15), slateM, 0, 2.58, -0.1);
        add(g, box(1.95, 0.035, 0.28), isPortSpherex ? warmGlow : cyanGlow, 0, 2.49, -0.1);

        if (isPortSpherex) {
          // Equipamiento específico SPHEREx: criostato cilíndrico dorado MLI, cámara de guantes (glovebox) aislada y cápsulas de muestra
          add(g, cyl(0.22, 0.26, 0.68, 14), goldM, -0.78, 1.40, 0.18);
          add(g, cyl(0.18, 0.18, 0.12, 14), steelM, -0.78, 1.78, 0.18);
          add(g, cyl(0.06, 0.06, 0.85, 8), steelM, -0.78, 2.18, 0.18);
          // Cámara estanca de análisis espectroscópico con puertos de guantes frontales
          add(g, box(0.74, 0.42, 0.44), glassM, 0.04, 1.29, 0.22);
          add(g, box(0.78, 0.04, 0.48), steelM, 0.04, 1.51, 0.22);
          [-0.14, 0.22].forEach((gx) => {
            add(g, torus(0.068, 0.014, 8, 16), steelM, gx, 1.26, 0.45);
          });
          add(g, cyl(0.09, 0.09, 0.34, 10), glassM, 0.76, 1.24, 0.22);
          add(g, cyl(0.06, 0.06, 0.28, 10), idx % 2 === 0 ? amberGlow : greenGlow, 0.76, 1.24, 0.22);
        } else {
          // Equipamiento específico Banco Óptico: colimador interferométrico, riel láser y osciloscopio
          add(g, box(0.62, 0.34, 0.38), compositeM, -0.74, 1.24, 0.18);
          add(g, cyl(0.11, 0.11, 0.44, 12), steelM, -0.32, 1.24, 0.18).rotation.z = Math.PI / 2;
          add(g, torus(0.14, 0.025, 8, 20), cyanGlow, 0.22, 1.26, 0.18).rotation.y = Math.PI / 2;
          add(g, box(0.46, 0.38, 0.32), slateM, 0.76, 1.26, 0.18);
          const oscScr = add(g, box(0.38, 0.24, 0.02), scrMat, 0.76, 1.28, 0.01);
          oscScr.rotation.y = Math.PI;
        }
      });
      mountDeckPlacard(d3, 0, f + 2.55, zPlacard, rotPlacard, 'LAB', placardTitle, placardSub, placardHex);
    };
    buildLabArc('port', amberGlow, spherexLabMat, 'LABORATORIO SPHEREx', 'DETECTOR INFRARROJO Y CRIOSTATO', -14.8, 0, '#ffbe55');
    buildLabArc('starboard', cyanGlow, opticsLabMat, 'BANCO ÓPTICO LÁSER', 'ALINEACIÓN INTERFEROMÉTRICA', 14.8, Math.PI, '#45e8ff');
  }

  // ==================== CUBIERTA 4 · BODEGA, HANGAR, GRÚA Y MANTENIMIENTO (Y = -6.8) ====================
  {
    const d4 = deckContainers['deck-04'];
    const f = -6.8;

    // Contenedores modulares de carga con bastidores ISO, identificadores de misión y puntos de anclaje.
    const cargoManifests = [
      ['EVA-01', 'REPUESTOS EVA', 'SELLOS · JUNTAS', '#53d8f4'],
      ['FOOD-02', 'RACIONES', 'ALIMENTOS · 90 DÍAS', '#f0b85a'],
      ['TOOL-03', 'HERRAMIENTAS', 'KITS DE REPARACIÓN', '#ff9d55'],
      ['SCI-04', 'MATERIAL CIENTÍFICO', 'MUESTRAS · CRIO', '#8ab9ff'],
      ['MECH-05', 'REPUESTOS', 'BOMBAS · FILTROS', '#53d8f4'],
      ['O2-06', 'SOPORTE VITAL', 'CILINDROS · ECLS', '#6de0a6'],
      ['FOOD-07', 'RACIONES', 'ALIMENTOS · FRÍO', '#f0b85a'],
      ['TOOL-08', 'HERRAMIENTAS', 'EVA · MULTÍMETROS', '#ff9d55'],
      ['MECH-09', 'REPUESTOS', 'BOBINAS · ACOPLES', '#53d8f4'],
    ];
    C04_CARGO_CONTAINERS.forEach((b, cIdx) => {
      const cm = trackExtraMat(pbrSuite.makeCargoMat(b.color));
      const [cargoCode, cargoTitle, cargoSubtitle, cargoAccent] = cargoManifests[cIdx % cargoManifests.length];
      const manifestTexture = trackExtraTex(makeDeckSignTexture(cargoCode, cargoTitle, cargoSubtitle, cargoAccent));
      const manifestMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: manifestTexture, toneMapped: false }));
      const ax = -b.cz;
      const az = b.cx;
      const wX = b.hz * 2;
      const wZ = b.hx * 2;
      const placeContainer = (levelIdx) => {
        const cy = f + b.h * (0.5 + levelIdx);
        add(d4, box(wX, b.h - 0.04, wZ), cm, ax, cy, az, 'console');
        add(d4, box(wX + 0.06, 0.1, wZ + 0.06), slateM, ax, cy - b.h * 0.45, az);
        add(d4, box(wX + 0.06, 0.1, wZ + 0.06), steelM, ax, cy + b.h * 0.45, az);
        // Bastidor, cierres y placa de inventario en la cara de acceso del contenedor.
        [-1, 1].forEach((side) => {
          add(d4, box(0.09, b.h - 0.12, 0.09), steelM, ax + side * (wX * 0.46), cy, az + wZ * 0.46);
          add(d4, box(0.18, 0.08, 0.035), railAmberM, ax + side * (wX * 0.46), cy - 0.32, az + wZ * 0.5 + 0.025);
        });
        add(d4, box(wX * 0.78, 0.48, 0.045), manifestMat, ax, cy + 0.12, az + wZ * 0.5 + 0.03);
        add(d4, box(wX * 0.74, 0.055, 0.045), cIdx % 3 === 1 ? amberGlow : cyanGlow, ax, cy - 0.48, az + wZ * 0.5 + 0.03);
        add(d4, box(0.08, 0.16, 0.08), cIdx % 2 === 0 ? greenGlow : amberGlow, ax + wX * 0.46, cy + b.h * 0.28, az + wZ * 0.46);
      };
      placeContainer(0);
      if (b.double) placeContainer(1);

      // Cajas de acceso rápido y envases de ración sobre pallets sencillos, dentro de la huella del contenedor.
      if (!b.double && (cIdx === 1 || cIdx === 4 || cIdx === 6 || cIdx === 7)) {
        const topY = f + b.h;
        const packMats = cIdx === 1 || cIdx === 6 ? [warmHabM, amberGlow, compositeM] : [steelM, slateM, railAmberM];
        [-0.52, 0.52].forEach((side, packIdx) => {
          add(d4, box(0.72, 0.42, 0.68), packMats[packIdx], ax + side * 0.52, topY + 0.21, az);
          add(d4, box(0.76, 0.055, 0.72), steelM, ax + side * 0.52, topY + 0.44, az);
          add(d4, box(0.08, 0.46, 0.08), cargoAccent === '#f0b85a' ? amberGlow : cyanGlow, ax + side * 0.52, topY + 0.22, az + 0.28);
        });
        if (cIdx === 1 || cIdx === 6) {
          [-0.55, 0, 0.55].forEach((offset, canIdx) => {
            const can = add(d4, cyl(0.13, 0.13, 0.38, 12), canIdx % 2 ? greenGlow : amberGlow, ax + offset, topY + 0.64, az - 0.28);
          });
        }
      }
    });

    // Plataforma de apontaje y pórtico umbilical del Transbordador de Servicio en proa (Aurora +X = 11.5)
    add(d4, box(8.6, 0.03, 5.2), slateM, 11.5, f + 0.015, 0);
    [-2.45, 2.45].forEach((padZ) => {
      add(d4, box(8.2, 0.035, 0.14), hazardM, 11.5, f + 0.02, padZ);
      [-3.2, -1.0, 1.2, 3.4].forEach((padX) => {
        add(d4, box(0.32, 0.045, 0.08), padZ > 0 ? cyanGlow : amberGlow, 11.5 + padX, f + 0.025, padZ * 0.88);
      });
    });
    // Torre umbilical lateral de abastecimiento y telemetría del transbordador (x = 11.2, z = -2.35)
    add(d4, box(0.62, 2.55, 0.48), slateM, 11.2, f + 1.275, -2.35);
    add(d4, box(0.52, 0.14, 1.15), steelM, 11.2, f + 2.38, -1.85);
    add(d4, cyl(0.045, 0.045, 1.1, 8), goldM, 11.2, f + 2.25, -1.85).rotation.x = Math.PI / 2;

    // Transbordador de servicio con fuselaje aerodinámico, alas barridas y tren de aterrizaje.
    const shuttleM = pbrSuite.materials.shuttleCompositeMat || hullM;
    const sg = new THREE.Group();
    sg.name = 'ServiceShuttleHangar';
    sg.position.set(11.5, f, 0);
    d4.add(sg);
    const shuttleCore = add(sg, cyl(1.10, 1.28, 6.6, 28), shuttleM, 0, 1.38, 0, 'console');
    shuttleCore.rotation.z = -Math.PI / 2;
    const nose = add(sg, cyl(0.08, 1.12, 2.8, 24), shuttleM, 4.25, 1.38, 0);
    nose.rotation.z = -Math.PI / 2;
    const noseCollar = add(sg, torus(1.06, 0.055, 10, 36), goldM, 2.85, 1.38, 0);
    noseCollar.rotation.y = Math.PI / 2;

    const shuttleWingMat = trackExtraMat(finM.clone());
    shuttleWingMat.side = THREE.DoubleSide;
    [-1, 1].forEach((side) => {
      const wingShape = new THREE.Shape();
      const wingPoint = (x, z) => [x, -side * z];
      const [x0, z0] = wingPoint(-1.7, 0.78);
      wingShape.moveTo(x0, z0);
      wingShape.lineTo(...wingPoint(1.35, 0.82));
      wingShape.lineTo(...wingPoint(0.35, 3.25));
      wingShape.lineTo(...wingPoint(-2.7, 2.82));
      wingShape.closePath();
      const wing = add(sg, trackExtraGeo(new THREE.ShapeGeometry(wingShape)), shuttleWingMat, 0, 0.84, 0);
      wing.rotation.x = -Math.PI / 2;
      const wingStripe = add(sg, box(2.4, 0.045, 0.07), side > 0 ? cyanGlow : railAmberM, -0.68, 0.91, side * 2.05);
      wingStripe.rotation.y = side * 0.18;
      add(sg, box(0.52, 0.09, 0.28), steelM, -2.08, 0.9, side * 2.67);
    });

    // Canopia elevada con cristal tintado, travesaño y marcadores de orientación.
    const shuttleCanopyMat = trackExtraMat(new THREE.MeshPhysicalMaterial({
      color: 0x4a9fc4,
      transparent: true,
      opacity: 0.72,
      roughness: 0.14,
      metalness: 0.26,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    }));
    const canopy = add(sg, sphereGeo(0.9, 24, 16), shuttleCanopyMat, 1.82, 2.12, 0);
    canopy.scale.set(1.08, 0.5, 0.82);
    add(sg, box(0.12, 0.48, 1.45), steelM, 1.85, 2.22, 0);
    add(sg, box(3.3, 0.11, 0.36), darkM, -0.2, 2.43, 0);
    add(sg, box(2.7, 0.055, 0.13), goldM, -0.45, 2.37, 0);

    // Doble propulsor de plasma y tren de aterrizaje con ruedas visibles.
    [-1.1, 1.1].forEach((tz) => {
      const engine = add(sg, cyl(0.34, 0.40, 0.92, 18), copperM, -3.15, 1.38, tz);
      engine.rotation.z = -Math.PI / 2;
      const engineGlow = add(sg, cyl(0.29, 0.31, 0.09, 18), cyanGlow, -3.66, 1.38, tz);
      engineGlow.rotation.z = -Math.PI / 2;
      add(sg, torus(0.33, 0.045, 8, 20), steelM, -3.71, 1.38, tz).rotation.y = Math.PI / 2;
      const leg = add(sg, cyl(0.045, 0.07, 0.62, 10), steelM, -2.0, 0.53, tz * 0.82);
      leg.rotation.z = -0.18;
      const wheel = add(sg, torus(0.24, 0.075, 8, 20), darkM, -2.0, 0.26, tz * 0.94);
      wheel.rotation.x = Math.PI / 2;
      add(sg, box(0.5, 0.055, 0.38), railAmberM, -2.0, 0.06, tz * 0.94);
    });
    const tailThruster = add(sg, torus(0.88, 0.055, 10, 36), steelM, -3.42, 1.38, 0);
    tailThruster.rotation.y = Math.PI / 2;
    add(sg, box(1.0, 0.08, 0.12), railAmberM, -1.95, 1.95, 0);

    shuttleHatchPivot = new THREE.Group();
    shuttleHatchPivot.position.set(0.6, 1.45, 1.32);
    sg.add(shuttleHatchPivot);
    add(shuttleHatchPivot, box(1.52, 1.06, 0.06), steelM, 0, 0, 0.015);
    const shuttleHatchLeaf = add(shuttleHatchPivot, box(1.35, 0.9, 0.08), doorM, 0, 0, 0.06);
    add(shuttleHatchPivot, box(0.08, 0.48, 0.06), cyanGlow, 0.54, 0, 0.11);
    registerInteractMesh(shuttleHatchLeaf, 'hangar', 'direct');

    // Grúa puente superior animada sobre la pista del hangar
    add(d4, box(15.5, 0.14, 0.22), darkM, 5.2, f + 2.95, -3.2);
    add(d4, box(15.5, 0.14, 0.22), darkM, 5.2, f + 2.95, 3.2);
    craneTrolleyGroup = new THREE.Group();
    craneTrolleyGroup.position.set(7.5, f + 2.86, 0);
    d4.add(craneTrolleyGroup);
    add(craneTrolleyGroup, box(0.65, 0.22, 6.6), railAmberM, 0, 0, 0);
    add(craneTrolleyGroup, box(0.95, 0.28, 0.95), darkM, 0, -0.22, 0);
    add(craneTrolleyGroup, cyl(0.04, 0.04, 0.9, 8), steelM, 0, -0.68, 0);

    // Puesto de mantenimiento y brazo robótico (`maintenance-c04` en KRONOX (-7.8, -6.8, +4.8))
    const maintGroup = new THREE.Group();
    maintGroup.position.set(-4.8, f, -7.8);
    d4.add(maintGroup);
    add(maintGroup, box(1.65, 0.95, 2.15), slateM, 0, 0.475, 0, 'console');
    add(maintGroup, box(1.54, 0.08, 2.04), steelM, 0, 0.98, 0);
    // Panel portaherramientas trasero con iluminación de banco de trabajo
    add(maintGroup, box(0.14, 1.25, 2.08), slateM, -0.76, 1.62, 0);
    add(maintGroup, box(0.06, 0.95, 1.82), compositeM, -0.68, 1.58, 0);
    add(maintGroup, box(0.24, 0.06, 1.92), warmGlow, -0.62, 2.18, 0);
    maintArmPivot = new THREE.Group();
    maintArmPivot.position.set(-0.3, 1.02, -0.4);
    maintGroup.add(maintArmPivot);
    const maintArmPost = add(maintArmPivot, cyl(0.08, 0.12, 0.65, 10), railAmberM, 0, 0.32, 0);
    const maintArmBeam = add(maintArmPivot, box(0.75, 0.12, 0.12), steelM, 0.35, 0.62, 0);
    registerInteractMesh(maintArmPost, 'maintenance-c04', 'direct');
    registerInteractMesh(maintArmBeam, 'maintenance-c04', 'direct');
    maintDrawerPivot = new THREE.Group();
    maintDrawerPivot.position.set(0.84, 0.56, 0.4);
    maintGroup.add(maintDrawerPivot);
    const drawerBox = add(maintDrawerPivot, box(0.45, 0.22, 0.68), doorM, 0, 0, 0);
    const drawerHandle = add(maintDrawerPivot, cyl(0.04, 0.04, 0.36, 8), cyanGlow, 0.18, 0.04, 0);
    registerInteractMesh(drawerBox, 'maintenance-c04', 'direct');
    registerInteractMesh(drawerHandle, 'maintenance-c04', 'direct');

    // Pantalla de diagnóstico protegida y superficie de trabajo con marcas de uso.
    add(maintGroup, box(0.96, 0.66, 0.10), darkM, -0.42, 1.68, -0.97);
    add(maintGroup, box(0.82, 0.50, 0.035), cyanGlow, -0.42, 1.68, -0.91);
    add(maintGroup, box(0.32, 0.06, 0.20), steelM, -0.42, 1.32, -0.88);
    add(maintGroup, box(1.36, 0.025, 0.06), amberGlow, 0.08, 1.03, -0.84);
    [-0.52, 0.0, 0.52].forEach((x) => {
      add(maintGroup, cyl(0.045, 0.045, 0.05, 10), railAmberM, x, 1.03, -0.65);
    });

    // Bandeja deslizable con pequeñas piezas; al abrirse queda a mano sin invadir el pasillo.
    partsTrayPivot = new THREE.Group();
    partsTrayPivot.position.set(0.14, 1.04, -0.74);
    maintGroup.add(partsTrayPivot);
    const partsTray = add(partsTrayPivot, box(0.82, 0.065, 0.52), darkM, 0, 0, 0);
    add(partsTrayPivot, box(0.72, 0.035, 0.42), steelM, 0, 0.05, 0);
    add(partsTrayPivot, box(0.12, 0.10, 0.10), railAmberM, -0.22, 0.105, -0.08);
    add(partsTrayPivot, box(0.16, 0.08, 0.12), cyanGlow, 0.02, 0.095, -0.06);
    add(partsTrayPivot, cyl(0.075, 0.075, 0.18, 12), copperM, 0.25, 0.12, 0.06);
    const partsTrayHandle = add(partsTrayPivot, box(0.28, 0.045, 0.055), steelM, 0, 0.035, 0.27);
    registerInteractMesh(partsTray, 'parts-tray-c04', 'direct');
    registerInteractMesh(partsTrayHandle, 'parts-tray-c04', 'direct');

    // Lámpara articulada con interruptor físico y movimiento de enfoque.
    workLightPivot = new THREE.Group();
    workLightPivot.position.set(-0.55, 2.16, -0.32);
    maintGroup.add(workLightPivot);
    add(workLightPivot, cyl(0.055, 0.055, 0.62, 10), steelM, 0.22, -0.12, 0).rotation.z = -Math.PI / 2;
    add(workLightPivot, torus(0.105, 0.028, 8, 18), railAmberM, 0.46, -0.12, 0).rotation.y = Math.PI / 2;
    workLampMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0xffe4a3 }));
    const lampHead = add(workLightPivot, box(0.34, 0.16, 0.30), darkM, 0.58, -0.16, 0);
    const lampFace = add(workLightPivot, box(0.24, 0.045, 0.20), workLampMat, 0.60, -0.25, 0);
    const lightSwitch = add(maintGroup, box(0.18, 0.16, 0.06), workLampMat, -0.62, 1.35, -0.93);
    registerInteractMesh(lampFace, 'maintenance-light-c04', 'direct');
    registerInteractMesh(lightSwitch, 'maintenance-light-c04', 'direct');

    // Mordaza de banco móvil; el pomo gira y las garras se cierran sobre una pieza de calibración.
    const clampGroup = new THREE.Group();
    clampGroup.position.set(0.28, 1.08, 0.22);
    maintGroup.add(clampGroup);
    add(clampGroup, box(0.56, 0.075, 0.34), steelM, 0, 0, 0);
    const clampJawA = add(clampGroup, box(0.10, 0.22, 0.30), railAmberM, -0.20, 0.15, 0);
    const clampJawB = add(clampGroup, box(0.10, 0.22, 0.30), railAmberM, 0.20, 0.15, 0);
    const clampWorkpieceMat = trackExtraMat(new THREE.MeshStandardMaterial({ color: 0xc98249, roughness: 0.38, metalness: 0.68 }));
    const clampWorkpiece = add(clampGroup, box(0.18, 0.16, 0.22), clampWorkpieceMat, 0, 0.17, 0);
    const clampScrew = add(clampGroup, cyl(0.035, 0.035, 0.54, 10), steelM, 0, 0.30, 0.18);
    clampScrew.rotation.z = Math.PI / 2;
    const clampKnob = add(clampGroup, torus(0.12, 0.03, 8, 18), cyanGlow, 0.30, 0.30, 0.18);
    [clampJawA, clampJawB, clampScrew, clampKnob].forEach((part) => { part.userData.dynamicTransform = true; });
    registerInteractMesh(clampKnob, 'bench-clamp-c04', 'direct');
    clampJawParts = { clampJawA, clampJawB, clampWorkpiece, clampScrew, clampKnob };

    // Ventilador de extracción animado y tres herramientas colgadas sobre el panel ranurado.
    const fanGroup = new THREE.Group();
    fanGroup.position.set(-0.64, 2.40, 0.70);
    maintGroup.add(fanGroup);
    add(fanGroup, torus(0.25, 0.035, 8, 24), steelM, 0, 0, 0);
    maintenanceFanRotor = new THREE.Group();
    fanGroup.add(maintenanceFanRotor);
    for (let blade = 0; blade < 4; blade += 1) {
      const angle = (blade * Math.PI) / 2;
      const fin = add(maintenanceFanRotor, box(0.07, 0.30, 0.055), blade % 2 ? cyanGlow : steelM, Math.cos(angle) * 0.12, Math.sin(angle) * 0.12, 0);
      fin.rotation.z = angle;
    }
    add(maintenanceFanRotor, sphereGeo(0.075, 12, 8), railAmberM, 0, 0, 0);
    [-0.52, 0.05, 0.58].forEach((x, toolIndex) => {
      const tool = new THREE.Group();
      tool.position.set(x, 1.50, 1.06);
      maintGroup.add(tool);
      const handle = add(tool, cyl(0.035, 0.035, 0.42, 8), toolIndex === 1 ? copperM : railAmberM, 0, 0, 0);
      handle.rotation.z = Math.PI / 2;
      const head = add(tool, toolIndex === 1 ? torus(0.10, 0.025, 8, 16) : box(0.16, 0.06, 0.08), steelM, 0.22, 0, 0);
      if (toolIndex === 1) head.rotation.z = Math.PI / 2;
    });

    maintenanceDrone = new THREE.Group();
    maintenanceDrone.name = 'C04MaintenanceInspectionDrone';
    maintenanceDrone.position.set(-2.0, f + 2.18, -7.8);
    d4.add(maintenanceDrone);
    add(maintenanceDrone, sphereGeo(0.18, 16, 10), darkM, 0, 0, 0);
    add(maintenanceDrone, sphereGeo(0.10, 12, 8), cyanGlow, 0.02, -0.02, 0.16);
    [-1, 1].forEach((side) => {
      const rotor = add(maintenanceDrone, torus(0.22, 0.025, 6, 20), side > 0 ? cyanGlow : railAmberM, side * 0.34, 0.06, 0);
      rotor.userData.droneRotor = true;
      rotor.userData.dynamicTransform = true;
      maintenanceDroneRings.push(rotor);
      add(maintenanceDrone, box(0.44, 0.055, 0.06), steelM, side * 0.30, 0.07, 0);
    });
    const scanBeamMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x58e2ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    const scanBeam = add(maintenanceDrone, cyl(0.015, 0.32, 0.7, 16), scanBeamMat, 0, -0.45, 0.12);
    scanBeam.userData.dynamicTransform = true;
    add(d4, box(1.8, 0.05, 0.72), slateM, -2.0, f + 0.06, -7.8);
    add(d4, box(1.52, 0.04, 0.42), greenGlow, -2.0, f + 0.09, -7.8);

    // Multiherramienta EVA física recogible sobre bandeja magnética en C04
    pickupMultitoolGroup = new THREE.Group();
    pickupMultitoolGroup.name = 'PickupMultitoolProp';
    pickupMultitoolGroup.position.set(-0.42, 1.08, 0.72);
    maintGroup.add(pickupMultitoolGroup);
    const mtBodyProp = add(pickupMultitoolGroup, box(0.14, 0.08, 0.42), steelM, 0, 0.04, 0);
    const mtAccentProp = add(pickupMultitoolGroup, box(0.16, 0.05, 0.16), railAmberM, 0, 0.05, 0.12);
    const mtTipProp = add(pickupMultitoolGroup, box(0.08, 0.06, 0.18), cyanGlow, 0, 0.05, -0.24);
    registerInteractMesh(mtBodyProp, 'pickup-multitool', 'pickup');
    registerInteractMesh(mtAccentProp, 'pickup-multitool', 'pickup');
    registerInteractMesh(mtTipProp, 'pickup-multitool', 'pickup');

    // Señalización industrial, bandas de seguridad y estantería técnica del hangar
    add(d4, box(16, 0.02, 0.25), amberGlow, 5.0, f + 0.02, 0);
    [-3.6, 3.6].forEach((hzSide) => {
      add(d4, box(14.0, 0.02, 0.34), hazardM, 9.0, f + 0.015, hzSide);
    });
    add(d4, box(0.24, 2.2, 1.9), ventM, -5.85, f + 1.12, -7.8);
    mountDeckPlacard(d4, 15.2, f + 2.55, 0, -Math.PI / 2, 'C04', 'BODEGA Y HANGAR EVA', 'CARGA ISO · TRANSBORDADOR · GRÚA', '#58e2a4');
  }

  // Luz interior única con identidad cromática dinámica por cubierta (mantiene constante NUM_POINT_LIGHTS en WebGL)
  const deckPointLights = {};
  const deckLightConfigs = {
    'deck-01': { c: 0xffe8cc, intensity: 0.44, y: (levels[1] ?? 0) + 2.55 },
    'deck-02': { c: 0xffdfc2, intensity: 0.64, y: (levels[2] ?? 0) + 2.55 },
    'deck-03': { c: 0x9ce3ff, intensity: 0.62, y: (levels[3] ?? 0) + 2.55 },
    'deck-04': { c: 0xffe4b8, intensity: 0.64, y: (levels[4] ?? 0) + 2.55 },
  };
  let activeDeckPointLight = null;
  if (typeof THREE.PointLight === 'function') {
    activeDeckPointLight = new THREE.PointLight(
      deckLightConfigs['deck-01'].c,
      deckLightConfigs['deck-01'].intensity,
      36,
      1.15,
    );
    activeDeckPointLight.position.set(0, deckLightConfigs['deck-01'].y, 0);
    (auroraGroup || root).add(activeDeckPointLight);
    Object.keys(deckLightConfigs).forEach((deckId) => {
      deckPointLights[deckId] = activeDeckPointLight;
    });
  }

  // 4. Estaciones Interactivas Diegéticas con pantallas PBR específicas por rol + Banco Óptico animado
  const stationMeshes = [];
  let lastStationScreenUpdateAt = -Infinity;
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
    stGroup.userData.deckId = st.deckId;
    stGroup.position.set(px, py, pz);
    stGroup.rotation.y = Math.atan2(lx - px, lz - pz);
    (deckOverlayGroups[st.deckId] || root).add(stGroup);

    const accentStr = `#${st.colorHex.toString(16).padStart(6, '0')}`;
    const screenData = makeDiegeticScreenTexture(
      st.id,
      st.label.toUpperCase(),
      [`CUBIERTA ${st.deckId.toUpperCase()}`, `SISTEMA: ${st.tag}`, 'PULSA [E] PARA OPERAR'],
      accentStr,
      { powerRatio: 0.78 }
    );
    trackExtraTex(screenData.tex);

    const trimBarMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: st.colorHex }));
    const isC01Station = st.deckId === 'deck-01';
    const isC02Handled = st.deckId === 'deck-02' && deck02Result?.handledStationIds?.has(st.id);
    const beaconInner = isC01Station ? (st.id === 'missions' ? 1.78 : 0.56) : 0.68;
    const beaconOuter = isC01Station ? (st.id === 'missions' ? 1.88 : 0.66) : 0.82;
    const floorBeacon = !isC02Handled
      ? add(stGroup, ringGeo(beaconInner, beaconOuter, 36), trimBarMat, 0, isC01Station ? 0.068 : 0.04, 0)
      : null;
    if (floorBeacon) {
      floorBeacon.rotation.x = -Math.PI / 2;
      floorBeacon.userData.dynamicTransform = true;
    }
    const scrMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: screenData.tex }));

    let screenMesh;
    const integratedBridgeMesh =
      st.deckId === 'deck-01' ? bridgeCabina1Result?.stationScreenMeshes?.[st.id] : null;
    const integratedDeck02Mesh =
      st.deckId === 'deck-02' ? deck02Result?.stationScreenMeshes?.[st.id] : null;
    if (integratedBridgeMesh) {
      integratedBridgeMesh.material = scrMat;
      screenMesh = integratedBridgeMesh;
    } else if (integratedDeck02Mesh) {
      screenMesh = integratedDeck02Mesh;
    } else if (isC02Handled) {
      screenMesh = null;
    } else if (st.id === 'engineering') {
      add(stGroup, box(0.92, 0.84, 0.46), darkM, 1.35, 0.42, 0.65);
      add(stGroup, box(0.84, 0.04, 0.38), trimBarMat, 1.35, 0.86, 0.65);
      screenMesh = add(stGroup, box(0.82, 0.46, 0.05), scrMat, 1.35, 1.22, 0.54);
      screenMesh.rotation.y = Math.PI;
      screenMesh.rotation.x = 0.28;
    } else if (st.id === 'storage-c02' || st.id === 'maintenance-c04') {
      screenMesh = add(stGroup, box(0.76, 0.42, 0.05), scrMat, 0.72, 1.24, 0.92);
      screenMesh.rotation.x = -0.25;
    } else {
      const offsetScreenX = st.id === 'sensor-calibration' ? -1.35 : 0;
      add(stGroup, box(1.05, 0.88, 0.48), darkM, offsetScreenX, 0.44, 0.88);
      add(stGroup, box(0.95, 0.05, 0.4), trimBarMat, offsetScreenX, 0.9, 0.88);
      screenMesh = add(stGroup, box(0.92, 0.5, 0.05), scrMat, offsetScreenX, 1.26, 0.74);
      screenMesh.rotation.x = -0.32;
    }
    if (screenMesh) {
      screenMesh.userData.stationId = st.id;
      const isDirectStation =
        st.id.startsWith('bed-hab-') ||
        [
          'storage-c02',
          'bioponics',
          'galley',
          'galley-synth',
          'lounge-audio-c02',
          'airlock',
          'med-bay-c02',
          'gym-c02',
          'orrery-hab-02',
          'aurora-trophy-c02',
          'spec-samples-c02',
          'eva-rack-c02',
          'hangar',
          'maintenance-c04',
        ].includes(st.id);
      if (!isC02Handled) {
        registerInteractMesh(screenMesh, st.id, isDirectStation ? 'direct' : 'panel');
      }
    }

    if (st.id === 'sensor-calibration') {
      const benchGroup = new THREE.Group();
      benchGroup.name = 'OpticalCalibrationBenchAssembly';
      benchGroup.position.set(0.35, 0.92, 0.95);
      stGroup.add(benchGroup);

      add(benchGroup, box(2.2, 0.14, 1.15), darkM, 0, 0, 0);
      add(benchGroup, cyl(0.12, 0.16, 0.92, 12), steelM, -0.8, -0.46, 0);
      add(benchGroup, cyl(0.12, 0.16, 0.92, 12), steelM, 0.8, -0.46, 0);

      const mirrorRing = add(benchGroup, torus(0.34, 0.045, 10, 32), cyanGlow, -0.65, 0.48, 0);
      mirrorRing.userData.dynamicTransform = true;
      const lensCore = add(benchGroup, cyl(0.24, 0.24, 0.18, 20), goldM, 0.0, 0.48, 0);
      lensCore.rotation.z = Math.PI / 2;
      lensCore.userData.dynamicTransform = true;
      add(benchGroup, torus(0.32, 0.035, 10, 28), amberGlow, 0.65, 0.48, 0).rotation.y = Math.PI / 2;
      const beamMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x45e8ff, transparent: true, opacity: 0.78 }));
      const laserBeam = add(benchGroup, cyl(0.035, 0.035, 1.85, 12), beamMat, 0, 0.48, 0);
      laserBeam.rotation.z = Math.PI / 2;
      calibrationBenchParts = { benchGroup, mirrorRing, lensCore, laserBeam, beamMat };

      // Escáner IR portátil físico recogible en bandeja lateral del banco óptico (C03)
      pickupScannerGroup = new THREE.Group();
      pickupScannerGroup.name = 'PickupScannerProp';
      pickupScannerGroup.position.set(0.76, 0.12, 0.34);
      benchGroup.add(pickupScannerGroup);
      const scBody = add(pickupScannerGroup, box(0.2, 0.07, 0.32), darkM, 0, 0.03, 0);
      const scGlow = add(pickupScannerGroup, box(0.14, 0.02, 0.18), cyanGlow, 0, 0.075, 0.02);
      registerInteractMesh(scBody, 'pickup-scanner', 'pickup', st.deckId);
      registerInteractMesh(scGlow, 'pickup-scanner', 'pickup', st.deckId);
    }

    stationMeshes.push({
      id: st.id,
      deckId: st.deckId,
      group: stGroup,
      screenMesh,
      trimBarMat,
      floorBeacon,
      updateScreen: (title, lines, meta = {}) => {
        if (st.id.startsWith('bed-hab-')) return;
        const deck2Updater = st.deckId === 'deck-02' ? deck02Result?.screenUpdates?.[st.id] : null;
        if (deck2Updater) {
          deck2Updater(title, lines, meta);
        } else {
          screenData.redraw(title, lines, accentStr, meta);
        }
      },
    });
  });

  // 5. Pasamanos físicos EVA anclados a suelo o mamparo
  INTERIOR_GRAB_RAILS.forEach((rail) => {
    const railParent = deckOverlayGroups[rail.deckId] || root;
    if (rail.axis === 'y') {
      const len = Math.min(2.2, rail.span || 2.0);
      const railBar = add(railParent, cyl(0.035, 0.035, len, 10), railAmberM, rail.pos[0] * 1.15, rail.pos[1], rail.pos[2]);
      registerInteractMesh(railBar, rail.id, 'rail', rail.deckId);
    } else {
      const shortLen = 1.05;
      const rx = rail.pos[0];
      const ry = rail.pos[1] - 0.12;
      const rz = rail.pos[2];
      const barGeo = rail.axis === 'x' ? box(shortLen, 0.045, 0.045) : box(0.045, 0.045, shortLen);
      const railBar = add(railParent, barGeo, railAmberM, rx, ry, rz);
      registerInteractMesh(railBar, rail.id, 'rail', rail.deckId);
      [-shortLen * 0.42, shortLen * 0.42].forEach((off) => {
        const sx = rail.axis === 'x' ? rx + off : rx;
        const sz = rail.axis === 'z' ? rz + off : rz;
        add(railParent, cyl(0.025, 0.025, 0.98, 8), darkM, sx, ry - 0.49, sz);
      });
    }
  });

  // Congelar transformaciones estáticas de piezas interiores que nunca cambian localmente
  for (let i = 0; i < staticFreezeCandidates.length; i += 1) {
    const m = staticFreezeCandidates[i];
    if (m && !m.userData?.dynamicTransform) {
      m.updateMatrix();
      m.matrixAutoUpdate = false;
    }
  }

  let activeDeckVisibilityKey = 'all';
  const applyDeckLightSpec = (deckId) => {
    if (!activeDeckPointLight) return;
    const cfg = deckLightConfigs[deckId] || deckLightConfigs['deck-01'];
    if (cfg) {
      activeDeckPointLight.position.y = cfg.y;
      activeDeckPointLight.color?.setHex?.(cfg.c);
      activeDeckPointLight.intensity = cfg.intensity;
    }
  };
  function setActiveVisibleDeck(
    deckId = null,
    { elevatorActive = false, showAll = false } = {},
  ) {
    applyDeckLightSpec(deckId);
    if (showAll || !deckId) {
      if (activeDeckVisibilityKey === 'all') return;
      activeDeckVisibilityKey = 'all';
      Object.keys(deckContainers).forEach((id) => {
        deckContainers[id].visible = true;
        if (deckOverlayGroups[id]) deckOverlayGroups[id].visible = true;
      });
      return;
    }
    const visibleSet = new Set([deckId]);
    if (elevatorActive) {
      visibleSet.add(elevatorState.currentFloorId || deckId);
      visibleSet.add(elevatorState.targetFloorId || deckId);
      const idx = CABIN_DECKS.findIndex((d) => d.id === deckId);
      if (idx > 0) visibleSet.add(CABIN_DECKS[idx - 1].id);
      if (idx >= 0 && idx < CABIN_DECKS.length - 1) visibleSet.add(CABIN_DECKS[idx + 1].id);
    }
    const nextKey = Array.from(visibleSet).sort().join('|');
    if (nextKey === activeDeckVisibilityKey) return;
    activeDeckVisibilityKey = nextKey;
    Object.keys(deckContainers).forEach((id) => {
      const show = visibleSet.has(id);
      deckContainers[id].visible = show;
      if (deckOverlayGroups[id]) deckOverlayGroups[id].visible = show;
    });
  }

  const deckCollisionListCache = {};
  function getCollisionMeshesForDeck(deckId) {
    if (!deckId || !cameraCollisionMeshesByDeck[deckId]) {
      return cameraCollisionMeshes;
    }
    if (!deckCollisionListCache[deckId]) {
      deckCollisionListCache[deckId] = [
        ...cameraCollisionMeshesByDeck[deckId],
        ...cameraCollisionMeshesByDeck.global,
      ];
    }
    return deckCollisionListCache[deckId];
  }

  const deckInteractListCache = {};
  function getInteractMeshesForDeck(deckId) {
    if (!deckId || !interactRaycasterMeshesByDeck[deckId]) {
      return interactRaycasterMeshes;
    }
    if (!deckInteractListCache[deckId]) {
      deckInteractListCache[deckId] = [
        ...interactRaycasterMeshesByDeck[deckId],
        ...interactRaycasterMeshesByDeck.global,
      ];
    }
    return deckInteractListCache[deckId];
  }

  const bridgeHoloProjector = auroraGroup.getObjectByName('BridgeHoloProjector');
  const reactorAssembly = reactorPlasmaCore?.parent || null;

  // Baliza holográfica 3D para el tutorial progresivo en el mundo (guiado paso a paso)
  const tutorialWaypointShaderMat = trackExtraMat(
    createHolographicShaderMaterial({
      color: 0x38bdf8,
      accentColor: 0x34d399,
      opacity: 0.42,
      scanlineDensity: 28.0,
    }),
  );
  const tutorialWaypointRingMat = trackExtraMat(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  const tutorialWaypointGroup = new THREE.Group();
  tutorialWaypointGroup.name = 'KronoxTutorialWaypoint3D';
  tutorialWaypointGroup.visible = false;
  root.add(tutorialWaypointGroup);

  const wpOuterRing = add(tutorialWaypointGroup, torus(0.92, 0.032, 10, 40), tutorialWaypointRingMat, 0, 0.06, 0);
  wpOuterRing.rotation.x = Math.PI / 2;
  wpOuterRing.userData.dynamicTransform = true;

  const wpInnerRing = add(tutorialWaypointGroup, ringGeo(0.46, 0.62, 32), tutorialWaypointRingMat, 0, 0.05, 0);
  wpInnerRing.rotation.x = -Math.PI / 2;
  wpInnerRing.userData.dynamicTransform = true;

  const wpBeamGeo = trackExtraGeo(new THREE.CylinderGeometry(0.58, 0.76, 2.15, 24, 1, true));
  const wpLightColumn = add(tutorialWaypointGroup, wpBeamGeo, tutorialWaypointShaderMat, 0, 1.12, 0);
  wpLightColumn.userData.dynamicTransform = true;

  const wpChevronGeo = trackExtraGeo(new THREE.ConeGeometry(0.22, 0.38, 4));
  const wpChevron = add(tutorialWaypointGroup, wpChevronGeo, tutorialWaypointRingMat, 0, 2.28, 0);
  wpChevron.rotation.x = Math.PI;
  wpChevron.userData.dynamicTransform = true;

  function setTutorialWaypoint({ visible = false, position = null, colorHex = 0x38bdf8 } = {}) {
    tutorialWaypointGroup.visible = Boolean(visible && position);
    if (position) {
      const px = Array.isArray(position) ? position[0] : position.x;
      const py = Array.isArray(position) ? position[1] : position.y;
      const pz = Array.isArray(position) ? position[2] : position.z;
      tutorialWaypointGroup.position.set(Number(px) || 0, Number(py) || 0, Number(pz) || 0);
    }
    if (colorHex != null) {
      tutorialWaypointRingMat.color.setHex(colorHex);
      tutorialWaypointShaderMat.uniforms?.uColor?.value?.setHex?.(colorHex);
    }
  }

  const tutorialPathGroup = new THREE.Group();
  tutorialPathGroup.name = 'KronoxTutorialPath3D';
  tutorialPathGroup.visible = false;
  root.add(tutorialPathGroup);
  const tutorialPathMaterial = trackExtraMat(
    new THREE.LineDashedMaterial({
      color: 0x55eaff,
      transparent: true,
      opacity: 0.96,
      dashSize: 0.38,
      gapSize: 0.22,
      depthWrite: false,
    }),
  );
  const tutorialPathMarkerMaterial = trackExtraMat(
    new THREE.MeshBasicMaterial({ color: 0x9af5ff, transparent: true, opacity: 0.95 }),
  );
  function setTutorialPath({ visible = false, points = [], colorHex = 0x55eaff } = {}) {
    tutorialPathGroup.visible = Boolean(visible && points.length > 1);
    while (tutorialPathGroup.children.length) {
      const child = tutorialPathGroup.children[0];
      tutorialPathGroup.remove(child);
      child.geometry?.dispose?.();
    }
    if (!tutorialPathGroup.visible) return;
    const vectors = points.map((point) =>
      point?.isVector3 ? point.clone() : new THREE.Vector3(Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0),
    );
    vectors.forEach((point) => { point.y += 0.055; });
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(vectors);
    const routeLine = new THREE.Line(routeGeometry, tutorialPathMaterial);
    routeLine.computeLineDistances();
    tutorialPathGroup.add(routeLine);
    tutorialPathMaterial.color.setHex(colorHex);
    for (const point of vectors.slice(1, -1)) {
      const marker = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 18), tutorialPathMarkerMaterial);
      marker.rotation.x = Math.PI / 2;
      marker.position.copy(point);
      tutorialPathGroup.add(marker);
    }
  }

  function getStationScreenReadout(stationId, telemetry = {}, repairStage = 0) {
    const target = telemetry.target || null;
    const mechanisms = telemetry.mechanisms || {};
    const records = Array.isArray(target?.localRecords) ? target.localRecords : [];
    const bandCounts = records.reduce((counts, record) => {
      const band = String(record?.band || '').match(/D[1-6]$/)?.[0];
      if (band) counts[band] = (counts[band] || 0) + 1;
      return counts;
    }, {});
    const targetName = String(target?.name || telemetry.destination || 'Sistema Solar');
    const coords = target && Number.isFinite(target.ra) && Number.isFinite(target.dec)
      ? `RA ${target.ra.toFixed(3)}° DEC ${target.dec.toFixed(3)}°`
      : 'COORDENADAS: ICRS / J2000';
    const bandLabel = String(target?.preferredBand || 'SIN OBJETIVO');
    const recordLabel = `REGISTROS IRSA: ${records.length}`;
    const reactor = mechanisms.reactorMode === 'overclock'
      ? 'POTENCIA (SIM.)'
      : mechanisms.reactorMode === 'quiet'
        ? 'SILENCIOSO (SIM.)'
        : 'NOMINAL (SIM.)';
    const mode = String(telemetry.flightMode || 'ESPERA').toUpperCase();
    const systemMeta = {
      targetRa: target?.ra,
      targetDec: target?.dec,
      bandCounts,
      aiSpeaking: Boolean(telemetry.aiSpeaking),
      aiAudioLevel: telemetry.aiAudioLevel,
      hasActiveMission: Boolean(telemetry.hasActiveMission),
      navigationPhase: telemetry.navigationPhase || 'ESTACIONARIA',
      destination: targetName,
      speed: Number(telemetry.speed) || 0,
      heading: Number(telemetry.heading) || 0,
      pitch: Number(telemetry.pitch) || 0,
      tick: telemetry.elapsedTime || 0,
      observationRecords: records.slice(0, 96).map((record) => ({
        band: record?.band,
        date: Number(record?.date),
        id: record?.id,
      })),
      reactorMode: mechanisms.reactorMode || 'nominal',
      bioponicsActive: Boolean(mechanisms.bioponicsActive),
      hydrationDispensing: Boolean(mechanisms.hydrationDispensing),
      airlockPressurized: Boolean(mechanisms.airlockPressurized),
      storageC02Open: Boolean(mechanisms.storageC02Open),
      scannerCollected: Boolean(mechanisms.scannerCollected),
      multitoolCollected: Boolean(mechanisms.multitoolCollected),
      hangarCraneDeployed: Boolean(mechanisms.hangarCraneDeployed),
      maintDrawerOpen: Boolean(mechanisms.maintDrawerOpen),
      workLightActive: Boolean(mechanisms.workLightActive),
      benchClampLocked: Boolean(mechanisms.benchClampLocked),
      partsTrayOpen: Boolean(mechanisms.partsTrayOpen),
      elevatorProgress: telemetry.elevator?.progress,
    };

    switch (stationId) {
      case 'windows':
        return {
          title: 'OBSERVATORIO · CATÁLOGO ICRS',
          lines: [
            `${telemetry.hasActiveMission ? 'OBJETIVO' : 'REFERENCIA'}: ${targetName}`,
            coords,
            `ÉPOCA: Gaia DR3 ${target?.referenceEpoch || 2016}`,
            `DISTANCIA: ${Number.isFinite(target?.distanceLy) ? `${target.distanceLy.toFixed(2)} a.l.` : 'N/D'}`,
            target?.astrometry?.source || target?.identifier || 'SOLAR SYSTEM DATA',
          ],
          meta: systemMeta,
        };
      case 'nav':
        return {
          title: 'NAVEGACIÓN · TELEMETRÍA LOCAL',
          lines: [
            `MODO: ${mode}`,
            `DESTINO: ${targetName}`,
            `VELOCIDAD: ${(telemetry.speed || 0).toFixed(2)} u/s`,
            `RUMBO: ${(telemetry.heading || 0).toFixed(0)}° · PITCH ${(telemetry.pitch || 0).toFixed(0)}°`,
            `FASE: ${telemetry.navigationPhase || 'ESTACIONARIA'}`,
          ],
          meta: systemMeta,
        };
      case 'comms':
        return {
          title: 'ENLACE KRONOX · COMUNICACIONES',
          lines: [
            'NÚCLEO IA: ENLACE LOCAL',
            `CANAL VOZ: ${telemetry.aiSpeaking ? 'TRANSMITIENDO' : 'EN ESPERA'}`,
            `AUDIO: ${telemetry.voiceEnabled === false ? 'SILENCIADO' : 'HABILITADO'}`,
            `OBJETIVO: ${targetName}`,
            'ESTADO: TELEMETRÍA LOCAL',
          ],
          meta: systemMeta,
        };
      case 'missions':
        return {
          title: 'CENTRO DE MISIÓN · OPERACIONES',
          lines: [
            `ESTADO: ${telemetry.hasActiveMission ? 'MISIÓN ACTIVA' : 'EN ESPERA'}`,
            `OBJETIVO: ${targetName}`,
            `FASE: ${telemetry.navigationPhase || 'ESTACIONARIA'}`,
            `VELOCIDAD: ${(telemetry.speed || 0).toFixed(2)} u/s`,
            `RUMBO: ${(telemetry.heading || 0).toFixed(0)}° · PITCH ${(telemetry.pitch || 0).toFixed(0)}°`,
          ],
          meta: systemMeta,
        };
      case 'science':
        return {
          title: 'SPHEREx · ANÁLISIS ESPECTRAL',
          lines: [
            `OBJETO: ${targetName}`,
            `BANDA PREFERIDA: ${bandLabel}`,
            `PRODUCTOS CARGADOS: ${records.length}`,
            `COBERTURA D1-D6: ${Object.keys(bandCounts).length}/6 BANDAS`,
            records.length ? `ÚLTIMO PRODUCTO: ${records[0]?.id || 'QR2'}` : 'SIN PRODUCTOS PARA ANALIZAR',
          ],
          meta: systemMeta,
        };
      case 'archive':
        return {
          title: 'NASA/IPAC · ARCHIVO SPHEREx QR2',
          lines: [
            `CONSULTA: ${targetName}`,
            `CATÁLOGO: ${target?.identifier || 'CNS5 / GAIA DR3'}`,
            recordLabel,
            records.length ? `MÁS RECIENTE: ${records[0]?.id || 'PRODUCTO QR2'}` : 'SIN PRODUCTOS LOCALES',
            records.length ? `BANDA: ${records[0]?.band || bandLabel}` : coords,
          ],
          meta: systemMeta,
        };
      case 'galley':
        return {
          title: 'HABITABILIDAD · C02',
          lines: [
            `TRIPULACIÓN: ${telemetry.crewCount ?? 1} · SIMULACIÓN`,
            `HIDRATACIÓN: ${mechanisms.hydrationDispensing ? 'DISPENSANDO' : 'EN ESPERA'}`,
            'COMEDOR: DISPONIBLE',
            'ECLS: ESTADO NO INSTRUMENTADO',
            'LECTURAS: SIMULACIÓN DE NAVE',
          ],
          meta: systemMeta,
        };
      case 'bioponics':
        return {
          title: 'SOPORTE VITAL · C02',
          lines: [
            `MÓDULO: ${mechanisms.bioponicsActive ? 'ACTIVO' : 'PAUSADO'}`,
            'CICLO: BIOPÓNICA · SIMULACIÓN',
            'O₂ / H₂O: SIN SENSOR FÍSICO',
            `TRIPULACIÓN: ${telemetry.crewCount ?? 1}`,
            'ESTADO: TELEMETRÍA LOCAL',
          ],
          meta: systemMeta,
        };
      case 'storage-c02':
        return {
          title: 'ALMACÉN EVA · INVENTARIO',
          lines: [
            `COMPARTIMENTO: ${mechanisms.storageC02Open ? 'ABIERTO' : 'CERRADO'}`,
            `ESCÁNER EVA: ${mechanisms.scannerCollected ? 'ASIGNADO' : 'EN SOPORTE'}`,
            `MULTIHERRAMIENTA: ${mechanisms.multitoolCollected ? 'ASIGNADA' : 'EN SOPORTE'}`,
            'CUBIERTA: C02 · HABITACIONAL',
            'ESTADO: INVENTARIO DE PARTIDA',
          ],
          meta: systemMeta,
        };
      case 'airlock':
        return {
          title: 'ESCLUSA EVA · C02',
          lines: [
            `CÁMARA: ${mechanisms.airlockPressurized ? 'PRESURIZADA' : 'CICLO DESPRESURIZADO'}`,
            `INTERBLOQUEO: ${mechanisms.airlockPressurized ? 'BLOQUEADO' : 'CICLO EVA'}`,
            'PRESIÓN: LECTURA NO DISPONIBLE',
            'TRAJE EVA: REVISIÓN MANUAL',
            'ESTADO: MECANISMO SIMULADO',
          ],
          meta: systemMeta,
        };
      case 'galley-synth':
        return {
          title: 'SINTETIZADOR CULINARIO · C02',
          lines: [
            `PREPARACIÓN: ${mechanisms.galleyCoffeeBrewing ? 'SIRVIENDO CAFÉ / RACIÓN' : 'EN ESPERA'}`,
            `HIDRATACIÓN: ${mechanisms.hydrationDispensing ? 'ACTIVA' : 'LISTA'}`,
            'TEMPERATURA BEBIDA: 68.5°C',
          ],
          meta: systemMeta,
        };
      case 'lounge-audio-c02':
        return {
          title: 'LOUNGE AMBIENTAL · C02',
          lines: [
            `SONIDO CIRCADIANO: ${mechanisms.loungeMusicActive === false ? 'PAUSADO' : 'REPRODUCIENDO'}`,
            `ENERGÍA TRIPULACIÓN: ${Math.round(mechanisms.crewRestPct ?? 82)}%`,
            'PULSA [E] PARA ALTERNAR',
          ],
          meta: systemMeta,
        };
      case 'med-bay-c02':
        return {
          title: 'MED-BAY · ESCÁNER BIOMÉTRICO',
          lines: [
            `CHEQUEO: ${mechanisms.medScanActive ? 'ESCANEANDO SIGNOS' : 'EN ESPERA'}`,
            `ENERGÍA / DESCANSO: ${Math.round(mechanisms.crewRestPct ?? 82)}%`,
            'FC: 64 BPM · SpO₂: 99% · RAD NOMINAL',
          ],
          meta: systemMeta,
        };
      case 'gym-c02':
        return {
          title: 'CICLOERGÓMETRO ZERO-G · HAB-05',
          lines: [
            `ENTRENAMIENTO: ${mechanisms.gymWorkoutActive ? 'RUTINA ACTIVA (180W)' : 'EN REPOSO'}`,
            'RESISTENCIA MAGNÉTICA NOMINAL',
            'PULSA [E] PARA ACTIVAR',
          ],
          meta: systemMeta,
        };
      case 'sensor-calibration':
        return {
          title: 'BANCO ÓPTICO · CALIBRACIÓN',
          lines: [
            `REPARACIÓN: ${Math.max(0, Math.min(4, repairStage))}/4 PASOS`,
            `BANCO: ${repairStage >= 4 ? 'CALIBRADO' : 'EN PROCESO'}`,
            'SPHEREx: 102 BANDAS (MISIÓN)',
            'FUENTE: NASA · DOCUMENTACIÓN',
            'PSF: MEDICIÓN NO DISPONIBLE',
          ],
          meta: { ...systemMeta, repairStage },
        };
      case 'engineering':
        return {
          title: 'REACTOR AURORA · INGENIERÍA',
          lines: [
            `MODO: ${reactor}`,
            `VELOCIDAD NAVE: ${(telemetry.speed || 0).toFixed(2)} u/s`,
            `NAVEGACIÓN: ${mode}`,
            'FUSIÓN: MODELO NARRATIVO',
            'POTENCIA: SIN SENSOR FÍSICO',
          ],
          meta: systemMeta,
        };
      case 'hangar':
        return {
          title: 'HANGAR · TRANSBORDADOR',
          lines: [
            `GRÚA: ${mechanisms.hangarCraneDeployed ? 'DESPLEGADA' : 'REPLEGADA'}`,
            `COMPUERTA: ${mechanisms.hangarCraneDeployed ? 'CICLO ABIERTO' : 'CERRADA'}`,
            'TRANSBORDADOR: ESTACIONADO',
            `CUBIERTA: ${telemetry.deckCode || 'C04'}`,
            'ESTADO: MECANISMO SIMULADO',
          ],
          meta: systemMeta,
        };
      case 'maintenance-c04':
        return {
          title: 'MANTENIMIENTO · C04',
          lines: [
            `CAJÓN: ${mechanisms.maintDrawerOpen ? 'ABIERTO' : 'CERRADO'}`,
            `REPARACIÓN ÓPTICA: ${Math.max(0, Math.min(4, repairStage))}/4`,
            `LÁMPARA: ${mechanisms.workLightActive ? 'ENCENDIDA' : 'APAGADA'} · MORDAZA: ${mechanisms.benchClampLocked ? 'FIJA' : 'LIBRE'}`,
            `BANDEJA: ${mechanisms.partsTrayOpen ? 'EXTENDIDA' : 'REPLEGADA'} · ESCÁNER: ${mechanisms.scannerCollected ? 'ASIGNADO' : 'DISPONIBLE'}`,
            `MULTIHERRAMIENTA: ${mechanisms.multitoolCollected ? 'ASIGNADA' : 'DISPONIBLE'}`,
          ],
          meta: systemMeta,
        };
      default:
        return {
          title: 'KRONOX · ESTADO DE ESTACIÓN',
          lines: ['TELEMETRÍA LOCAL', `OBJETIVO: ${targetName}`, `MODO: ${mode}`],
          meta: systemMeta,
        };
    }
  }

  function updateStations(
    elapsedTime = 0,
    nearestId = null,
    activeId = null,
    focusedId = null,
    _freeHelm = false,
    _astronautPos = null,
    repairStage = 0,
    telemetry = null
  ) {
    if (elapsedTime - lastStationScreenUpdateAt >= 0.8) {
      lastStationScreenUpdateAt = elapsedTime;
      const liveTelemetry = { ...(telemetry || {}), elapsedTime };
      bridgeCabina1Result?.updateScreens?.(liveTelemetry);
      stationMeshes.forEach((station) => {
        const readout = getStationScreenReadout(station.id, liveTelemetry, repairStage);
        station.updateScreen?.(readout.title, readout.lines, readout.meta);
      });
      const habitat = getStationScreenReadout('galley', liveTelemetry, repairStage);
      liveStaticDisplays.hab?.redraw(
        'MÓDULO HABITACIONAL · ESTADO',
        habitat.lines,
        '#38d8ff',
        habitat.meta,
      );
      const science = getStationScreenReadout('science', liveTelemetry, repairStage);
      liveStaticDisplays.science?.redraw(science.title, science.lines, '#ffbe55', science.meta);
      const optical = getStationScreenReadout('sensor-calibration', liveTelemetry, repairStage);
      liveStaticDisplays.optical?.redraw(optical.title, optical.lines, '#45e8ff', optical.meta);
    }
    const pulse = 0.75 + 0.25 * Math.sin(elapsedTime * 3.2);
    for (let idx = 0; idx < stationMeshes.length; idx += 1) {
      const st = stationMeshes[idx];
      if (st.deckId && deckOverlayGroups[st.deckId] && !deckOverlayGroups[st.deckId].visible) {
        continue;
      }
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
    }

    if (bridgeHoloProjector && deckContainers['deck-01']?.visible !== false) {
      bridgeHoloProjector.rotation.y = elapsedTime * 0.65;
      bridgeHoloProjector.rotation.z = Math.sin(elapsedTime * 0.9) * 0.12;
      bridgeHoloProjector.position.y = 3.4 + 1.85 + Math.sin(elapsedTime * 1.9) * 0.085;
      const orbRing = bridgeHoloProjector.children?.[2] || bridgeHoloProjector.children?.[1];
      if (orbRing) {
        orbRing.rotation.z = elapsedTime * 1.25;
        orbRing.rotation.y = Math.cos(elapsedTime * 0.85) * 0.45;
      }
      const holoSphere = bridgeHoloProjector.children?.[1];
      if (holoSphere?.material?.uniforms?.uTime) {
        holoSphere.material.uniforms.uTime.value = elapsedTime;
      }
    }

    if (tutorialWaypointGroup.visible) {
      if (tutorialWaypointShaderMat.uniforms?.uTime) {
        tutorialWaypointShaderMat.uniforms.uTime.value = elapsedTime;
      }
      wpOuterRing.rotation.z = elapsedTime * 1.4;
      const wpPulse = 1.0 + 0.08 * Math.sin(elapsedTime * 3.8);
      wpInnerRing.scale.setScalar(wpPulse);
      wpChevron.position.y = 2.24 + 0.12 * Math.sin(elapsedTime * 3.2);
      wpChevron.rotation.y = elapsedTime * 2.1;
    }

    if (reactorPlasmaCore && reactorPlasmaMat && deckContainers['deck-03']?.visible !== false) {
      const isOver = interactiveMechanisms.reactorMode === 'overclock';
      const isQuiet = interactiveMechanisms.reactorMode === 'quiet';
      const freq = isOver ? 7.2 : isQuiet ? 2.1 : 4.4;

      // Animación del plasma toroidal principal
      const s = 0.94 + 0.09 * Math.sin(elapsedTime * freq);
      reactorPlasmaCore.scale.set(s, s, 1.0 + 0.03 * Math.cos(elapsedTime * (freq + 0.8)));
      reactorPlasmaCore.rotation.z = elapsedTime * (isOver ? 2.2 : isQuiet ? 0.5 : 1.1);
      reactorPlasmaMat.color.setHex(isOver ? 0xc084fc : isQuiet ? 0x2dd4bf : 0x7ce6ff);
      reactorPlasmaMat.opacity = 0.72 + 0.18 * Math.sin(elapsedTime * (freq * 0.7));

      if (reactorAssembly) {
        reactorAssembly.children.forEach((child, cIdx) => {
          // Animación de bobinas TF (giran individualmente)
          if (child !== reactorPlasmaCore && child.geometry?.type === 'TorusGeometry') {
            child.rotation.z = elapsedTime * (cIdx % 2 === 0 ? 0.55 : -0.65) * (isOver ? 1.7 : 1.0);
          }
          // Animación del plasma interno caliente
          if (child.name === 'InnerPlasmaHot') {
            child.rotation.z = -elapsedTime * (isOver ? 3.5 : isQuiet ? 0.8 : 1.8);
            child.scale.setScalar(0.96 + 0.06 * Math.sin(elapsedTime * (freq * 1.3 + 0.5)));
          }
          // Animación de anillos de campo de contención (pulsos ondulantes)
          if (child.name?.startsWith('ContainmentField_')) {
            const fIdx = parseInt(child.name.split('_')[1], 10);
            const wave = Math.sin(elapsedTime * 3.5 + fIdx * 1.2);
            child.scale.setScalar(1.0 + 0.04 * wave);
            if (child.material) {
              child.material.opacity = isOver ? 0.28 + 0.12 * wave : isQuiet ? 0.06 : 0.15 + 0.06 * wave;
            }
          }
          // Animación de barras de control (suben/bajan según modo)
          if (child.name?.startsWith('ControlRod_')) {
            const rodIdx = parseInt(child.name.split('_')[1], 10);
            const targetInsert = isOver ? -0.5 : isQuiet ? 0.35 : 0;
            const rodWobble = Math.sin(elapsedTime * 0.8 + rodIdx * 0.78) * (isOver ? 0.06 : 0.02);
            child.position.y += ((2.35 + targetInsert + rodWobble) - child.position.y) * 0.08;
          }
        });
      }

      // Luz ambiental del reactor cambia con el modo
      const reactorLight = deckContainers['deck-03'].getObjectByProperty('type', 'PointLight');
      if (reactorLight) {
        const targetColor = isOver ? 0xc084fc : isQuiet ? 0x2dd4bf : 0x6ce3ff;
        const targetIntensity = isOver ? 3.2 : isQuiet ? 0.6 : 1.6;
        reactorLight.color.setHex(targetColor);
        reactorLight.intensity += (targetIntensity - reactorLight.intensity) * 0.1;
      }
    }

    if (cryoValvePivot) {
      const targetAngle = interactiveMechanisms.reactorMode === 'overclock' ? Math.PI * 0.8 : interactiveMechanisms.reactorMode === 'quiet' ? -Math.PI * 0.6 : 0;
      cryoValvePivot.rotation.x += (targetAngle - cryoValvePivot.rotation.x) * 0.12;
    }

    deck02Result?.update?.(elapsedTime, interactiveMechanisms, _astronautPos);

    if (craneTrolleyGroup) {
      const targetX = interactiveMechanisms.hangarCraneDeployed ? 11.4 : 7.5;
      craneTrolleyGroup.position.x += (targetX - craneTrolleyGroup.position.x) * 0.08;
    }

    if (shuttleHatchPivot) {
      const targetHatch = interactiveMechanisms.hangarCraneDeployed ? -Math.PI * 0.42 : 0;
      shuttleHatchPivot.rotation.x += (targetHatch - shuttleHatchPivot.rotation.x) * 0.12;
    }

    if (maintArmPivot && maintDrawerPivot) {
      maintArmPivot.rotation.y = interactiveMechanisms.maintDrawerOpen ? Math.sin(elapsedTime * 2.2) * 0.45 : 0.2;
      const targetDrawerX = interactiveMechanisms.maintDrawerOpen ? 1.24 : 0.84;
      maintDrawerPivot.position.x += (targetDrawerX - maintDrawerPivot.position.x) * 0.14;
    }

    if (partsTrayPivot) {
      const targetTrayZ = interactiveMechanisms.partsTrayOpen ? 0.48 : 0;
      partsTrayPivot.position.z += (targetTrayZ - partsTrayPivot.position.z) * 0.16;
    }
    if (workLightPivot && workLampMat) {
      const lightOn = Boolean(interactiveMechanisms.workLightActive);
      const targetLampAngle = lightOn ? -0.34 : 0.48;
      workLightPivot.rotation.z += (targetLampAngle - workLightPivot.rotation.z) * 0.09;
      workLampMat.color.setHex(lightOn ? 0xffe4a3 : 0x354254);
    }
    if (clampJawParts) {
      const jawX = interactiveMechanisms.benchClampLocked ? 0.14 : 0.24;
      clampJawParts.clampJawA.position.x += (-jawX - clampJawParts.clampJawA.position.x) * 0.18;
      clampJawParts.clampJawB.position.x += (jawX - clampJawParts.clampJawB.position.x) * 0.18;
      clampJawParts.clampScrew.rotation.x = interactiveMechanisms.benchClampLocked ? elapsedTime * 0.35 : 0;
      const knobTarget = interactiveMechanisms.benchClampLocked ? Math.sin(elapsedTime * 1.8) * 0.12 : 0;
      clampJawParts.clampKnob.rotation.z += (knobTarget - clampJawParts.clampKnob.rotation.z) * 0.12;
      clampJawParts.clampWorkpiece.material.color.setHex(interactiveMechanisms.benchClampLocked ? 0x45e89e : 0xc98249);
    }
    if (maintenanceFanRotor) maintenanceFanRotor.rotation.z = elapsedTime * 1.7;
    if (maintenanceDrone) {
      maintenanceDrone.position.x = -2.0 + Math.sin(elapsedTime * 0.42) * 0.28;
      maintenanceDrone.position.y = -6.8 + 2.18 + Math.sin(elapsedTime * 1.65) * 0.08;
      maintenanceDrone.position.z = -7.8 + Math.cos(elapsedTime * 0.34) * 0.22;
      maintenanceDroneRings.forEach((rotor, index) => {
        rotor.rotation.z = elapsedTime * (index ? -4.8 : 4.8);
      });
    }

    if (pickupMultitoolGroup) {
      pickupMultitoolGroup.visible = !interactiveMechanisms.multitoolCollected;
      if (pickupMultitoolGroup.visible) {
        pickupMultitoolGroup.position.y = 1.08 + Math.sin(elapsedTime * 2.4) * 0.015;
      }
    }

    if (pickupScannerGroup) {
      pickupScannerGroup.visible = !interactiveMechanisms.scannerCollected;
      if (pickupScannerGroup.visible) {
        pickupScannerGroup.position.y = 0.12 + Math.cos(elapsedTime * 2.4) * 0.012;
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

  function triggerMechanism(actionId, value = null) {
    if (actionId === 'bioponics') {
      interactiveMechanisms.bioponicsActive = value != null ? Boolean(value) : !interactiveMechanisms.bioponicsActive;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'hydration' || actionId === 'galley') {
      interactiveMechanisms.hydrationDispensing = value != null ? Boolean(value) : !interactiveMechanisms.hydrationDispensing;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'galley-synth') {
      interactiveMechanisms.galleyCoffeeBrewing = value != null ? Boolean(value) : !interactiveMechanisms.galleyCoffeeBrewing;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'lounge-audio-c02') {
      interactiveMechanisms.loungeMusicActive = value != null ? Boolean(value) : !interactiveMechanisms.loungeMusicActive;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'med-bay-c02') {
      interactiveMechanisms.medScanActive = value != null ? Boolean(value) : !interactiveMechanisms.medScanActive;
      if (interactiveMechanisms.medScanActive) {
        interactiveMechanisms.crewRestPct = Math.min(100, Math.max(interactiveMechanisms.crewRestPct, 92));
      }
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'gym-c02') {
      interactiveMechanisms.gymWorkoutActive = value != null ? Boolean(value) : !interactiveMechanisms.gymWorkoutActive;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'orrery-hab-02') {
      interactiveMechanisms.orrerySpinFast = value != null ? Boolean(value) : !interactiveMechanisms.orrerySpinFast;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'aurora-trophy-c02') {
      interactiveMechanisms.auroraHoloActive = value != null ? Boolean(value) : !interactiveMechanisms.auroraHoloActive;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'spec-samples-c02') {
      interactiveMechanisms.specSamplesActive = value != null ? Boolean(value) : !interactiveMechanisms.specSamplesActive;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'eva-rack-c02') {
      interactiveMechanisms.evaCheckActive = value != null ? Boolean(value) : !interactiveMechanisms.evaCheckActive;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'rest-set') {
      const bayIdx = value && Number.isInteger(value.bayIndex) ? value.bayIndex : null;
      interactiveMechanisms.restingBayIndex = bayIdx;
      interactiveMechanisms.restingSleepActive = Boolean(value?.sleeping && bayIdx !== null);
      if (bayIdx !== null) {
        interactiveMechanisms.crewRestPct = Math.min(100, Math.max(interactiveMechanisms.crewRestPct, 88));
      }
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'rest-nap') {
      interactiveMechanisms.crewRestPct = 100;
      interactiveMechanisms.restCyclesCompleted += 1;
      interactiveMechanisms.restingSleepActive = Boolean(interactiveMechanisms.restingBayIndex !== null);
      return { ok: true, state: snapshotMechanisms() };
    }
    const doorSuite = C02_HAB_SUITES.find((s) => s.doorId === actionId);
    if (doorSuite) {
      const idx = doorSuite.bayIndex;
      interactiveMechanisms.cabinDoorsOpen[idx] =
        value != null ? Boolean(value) : !interactiveMechanisms.cabinDoorsOpen[idx];
      return { ok: true, suite: doorSuite, state: snapshotMechanisms() };
    }
    const lampSuite = C02_HAB_SUITES.find((s) => s.lampId === actionId);
    if (lampSuite) {
      const idx = lampSuite.bayIndex;
      const order = ['warm', 'night', 'off'];
      interactiveMechanisms.cabinLamps[idx] =
        typeof value === 'string' && order.includes(value)
          ? value
          : order[(order.indexOf(interactiveMechanisms.cabinLamps[idx]) + 1) % order.length];
      return { ok: true, suite: lampSuite, state: snapshotMechanisms() };
    }
    const lockerSuite = C02_HAB_SUITES.find((s) => s.lockerId === actionId);
    if (lockerSuite) {
      const idx = lockerSuite.bayIndex;
      interactiveMechanisms.cabinLockersOpen[idx] =
        value != null ? Boolean(value) : !interactiveMechanisms.cabinLockersOpen[idx];
      return { ok: true, suite: lockerSuite, state: snapshotMechanisms() };
    }
    const tabletSuite = C02_HAB_SUITES.find((s) => s.tabletId === actionId);
    if (tabletSuite) {
      const idx = tabletSuite.bayIndex;
      interactiveMechanisms.cabinTabletPages[idx] =
        Number.isFinite(Number(value)) && value !== null
          ? Number(value)
          : (interactiveMechanisms.cabinTabletPages[idx] + 1) % 2;
      return { ok: true, suite: tabletSuite, state: snapshotMechanisms() };
    }
    if (actionId === 'storage-c02') {
      interactiveMechanisms.storageC02Open = value != null ? Boolean(value) : !interactiveMechanisms.storageC02Open;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'airlock') {
      interactiveMechanisms.airlockPressurized = value != null ? Boolean(value) : !interactiveMechanisms.airlockPressurized;
      return { ok: true, state: snapshotMechanisms() };
    }
    if (actionId === 'engineering') {
      const order = ['nominal', 'overclock', 'quiet'];
      const normalized =
        value === 'overdrive' ? 'overclock' : value === 'silent' ? 'quiet' : value;
      interactiveMechanisms.reactorMode =
        typeof normalized === 'string' && order.includes(normalized)
          ? normalized
          : order[(order.indexOf(interactiveMechanisms.reactorMode) + 1) % order.length];
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'hangar') {
      interactiveMechanisms.hangarCraneDeployed = value != null ? Boolean(value) : !interactiveMechanisms.hangarCraneDeployed;
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'maintenance-c04') {
      interactiveMechanisms.maintDrawerOpen = value != null ? Boolean(value) : !interactiveMechanisms.maintDrawerOpen;
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'maintenance-light-c04') {
      interactiveMechanisms.workLightActive = value != null ? Boolean(value) : !interactiveMechanisms.workLightActive;
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'bench-clamp-c04') {
      interactiveMechanisms.benchClampLocked = value != null ? Boolean(value) : !interactiveMechanisms.benchClampLocked;
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'parts-tray-c04') {
      interactiveMechanisms.partsTrayOpen = value != null ? Boolean(value) : !interactiveMechanisms.partsTrayOpen;
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'pickup-multitool') {
      interactiveMechanisms.multitoolCollected = value != null ? Boolean(value) : true;
      return { ok: true, itemId: 'multitool', state: { ...interactiveMechanisms } };
    }
    if (actionId === 'pickup-scanner') {
      interactiveMechanisms.scannerCollected = value != null ? Boolean(value) : true;
      return { ok: true, itemId: 'scanner', state: { ...interactiveMechanisms } };
    }
    return { ok: false, state: { ...interactiveMechanisms } };
  }

  const dispose = () => {
    pbrSuite.dispose();
    disposableExtras.forEach((item) => item?.dispose?.());
  };

  return {
    root,
    cabinRoot: root,
    auroraGroup,
    decks: CABIN_DECKS,
    deckContainers,
    deckOverlayGroups,
    deckPointLights,
    zones: HULL_INTERIOR_ZONES,
    interactiveStations: SHIP_INTERIOR_STATIONS,
    elevatorStations: ELEVATOR_CALL_STATIONS,
    stationMeshes,
    grabRails: INTERIOR_GRAB_RAILS,
    cameraCollisionMeshes,
    interactRaycasterMeshes,
    getCollisionMeshesForDeck,
    getInteractMeshesForDeck,
    setActiveVisibleDeck,
    setAnisotropy: (v) => {
      pbrSuite.setAnisotropy(v);
      bridgeCabina1Result?.setAnisotropy?.(v);
    },
    elevatorSystem: {
      state: elevatorState,
      requestDeck: requestElevatorDeck,
      selectFloor: requestElevatorDeck,
      snapToDeck: snapElevatorToDeck,
      update: updateElevatorSystem,
    },
    mechanisms: {
      state: interactiveMechanisms,
      trigger: triggerMechanism,
    },
    clampAstronautPosition: (pos, radius, clearance, elevatorStateParam, options = null) =>
      clampAstronautPosition(pos, radius, clearance, elevatorStateParam, {
        mechanisms: interactiveMechanisms,
        ...(options || {}),
      }),
    findNearestInteractiveStation: (position, overrideRange = null, options = null) =>
      findNearestInteractiveStation(position, overrideRange, {
        mechanisms: interactiveMechanisms,
        ...(options || {}),
      }),
    resolveCurrentDeck,
    setTutorialWaypoint,
    setTutorialPath,
    tutorialWaypointGroup,
    updateStations,
    dispose,
  };
}
