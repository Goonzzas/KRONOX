import * as THREE from 'three';
import {
  AURORA_SPHERE_RADIUS,
  C02_BULKHEAD_ANGLES,
  C02_CABIN_BAYS,
  C02_DINING_ARCS,
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
  createShipPbrSuite,
  makeDeckSignTexture,
  makeDiegeticScreenTexture,
} from './shipPbrMaterials.js';

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
  const geoCache = new Map();
  const trackedGeos = new Set();
  const trackExtraGeo = (g) => {
    if (g && !trackedGeos.has(g)) {
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

    // Panelado perforado técnico de techo en los 4 niveles (cubre cara inferior de cada losa)
    if (idx < 4) {
      const ceilingParent = deckContainers[`deck-0${idx + 1}`];
      const ceilingR = idx === 0 ? Math.min(13.2, slabR - 0.25) : slabR - 0.28;
      const ceilingHoleR = idx === 0 ? 0.0 : ELEVATOR_SHAFT_RADIUS + 0.06;
      const ceilGeo = buildSlottedDeckSlab(ceilingR, 0.028, ceilingHoleR);
      add(ceilingParent, ceilGeo, ceilingM, 0, y - 0.308, 0);

      // Conductos de aireación y vigas radiales en techo
      for (let b = 0; b < 4; b++) {
        const ang = (b * Math.PI) / 2 + Math.PI / 4;
        const duct = add(ceilingParent, box(ceilingR * 1.45, 0.09, 0.26), ventM, 0, y - 0.36, 0);
        duct.rotation.y = ang;
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

  // Lote instanciado de luminarias empotradas, conductos radiales y pernos de cubierta (GPU-instanced)
  {
    const ceilFixtureMats = [];
    const ceilTrussMats = [];
    const dummy = new THREE.Object3D();
    [3.4, 0.0, -3.4, -6.8].forEach((floorY, dIdx) => {
      const ceilY = floorY + 3.04;
      const rings = dIdx === 0 ? [5.0, 9.0] : [4.8, 9.8, 14.2];
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
  // 2. ASCENSOR FÍSICO 3D (NÚCLEO VERTICAL, CABINA MÓVIL, PUERTAS Y BOTONERAS)
  // =========================================================================
  const shaftGroup = new THREE.Group();
  shaftGroup.name = 'CentralElevatorShaftCore';
  auroraGroup.add(shaftGroup);

  // Paredes laterales (±Z Aurora / ±X KRONOX) y rieles de acero cepillado
  [1, -1].forEach((side) => {
    add(shaftGroup, box(1.24, 13.4, 0.16), darkM, 0, 0, side * 1.42, 'wall');
    add(shaftGroup, box(0.24, 13.4, 0.24), wallM, -0.64, 0, side * 1.38, 'wall');
    add(shaftGroup, box(0.24, 13.4, 0.24), wallM, 0.64, 0, side * 1.38, 'wall');
    add(shaftGroup, box(0.08, 13.4, 0.12), steelM, -1.16, 0, side * 1.24);
    add(shaftGroup, box(0.08, 13.4, 0.12), steelM, 1.16, 0, side * 1.24);
    add(shaftGroup, box(0.05, 13.1, 0.05), cyanGlow, 0, 0, side * 1.32);
  });

  // Anillos estructurales del hueco entre cubiertas
  [6.7, 3.44, 0.04, -3.36, -6.76].forEach((ringY) => {
    const t = add(shaftGroup, new THREE.TorusGeometry(ELEVATOR_SHAFT_RADIUS + 0.1, 0.045, 8, 32), cyanGlow, 0, ringY, 0);
    t.rotation.x = Math.PI / 2;
  });

  // Puertas de rellano en las 4 cubiertas + paneles exteriores de llamada + indicadores luminosos
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
    const signTex = trackExtraTex(makeDeckSignTexture(deck.code, deck.name.toUpperCase(), 'ASCENSOR CENTRAL', `#${deck.accentHex.toString(16).padStart(6, '0')}`));
    const signMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: signTex }));

    [1, -1].forEach((endDir) => {
      // Marco superior de puerta de ascensor (+1 = Bow / -1 = Aft en Aurora X) + umbral de seguridad
      const doorX = endDir * 1.34;
      add(shaftGroup, box(0.18, 0.42, 2.55), darkM, doorX, f + 2.48, 0, 'wall');
      add(shaftGroup, box(0.32, 0.025, 1.56), hazardM, doorX + endDir * 0.18, f + 0.015, 0);
      add(shaftGroup, box(0.24, 2.32, 0.18), ventM, doorX, f + 1.16, -0.84, 'wall');
      add(shaftGroup, box(0.24, 2.32, 0.18), ventM, doorX, f + 1.16, 0.84, 'wall');
      add(shaftGroup, box(0.04, 0.28, 1.35), signMat, doorX + endDir * 0.09, f + 2.52, 0);
      add(shaftGroup, box(0.1, 0.07, 0.65), beaconMat, doorX + endDir * 0.09, f + 2.26, 0);

      // Hojas correderas dobles (bipartitas) sincronizadas con la apertura real
      const leftLeaf = add(shaftGroup, box(0.09, 2.24, 0.68), doorM, doorX, f + 1.13, -0.34, 'door');
      const rightLeaf = add(shaftGroup, box(0.09, 2.24, 0.68), doorM, doorX, f + 1.13, 0.34, 'door');
      leftLeaf.userData.dynamicTransform = true;
      rightLeaf.userData.dynamicTransform = true;
      add(leftLeaf, box(0.11, 1.18, 0.34), glassM, 0, 0.25, -0.02);
      add(rightLeaf, box(0.11, 1.18, 0.34), glassM, 0, 0.25, 0.02);
      add(leftLeaf, box(0.1, 1.9, 0.04), cyanGlow, 0, 0, 0.31);
      add(rightLeaf, box(0.1, 1.9, 0.04), cyanGlow, 0, 0, -0.31);
      doors.push({ leftLeaf, rightLeaf, doorX });

      // Pedestal exterior de llamada ([E]) junto a cada puerta
      const sideSign = endDir > 0 ? 1 : -1;
      const callId = `elevator-call-${deck.id}-${endDir > 0 ? 'bow' : 'aft'}`;
      const callPedestal = add(shaftGroup, box(0.18, 1.42, 0.22), darkM, doorX + endDir * 0.08, f + 0.71, sideSign * 0.85);
      const callBtn = add(shaftGroup, box(0.08, 0.22, 0.14), beaconMat, doorX + endDir * 0.16, f + 1.28, sideSign * 0.85);
      registerInteractMesh(callPedestal, callId, 'elevator-call', deck.id);
      registerInteractMesh(callBtn, callId, 'elevator-call', deck.id);
    });

    landingDoorsByDeck[deck.id] = doors;
    callPanelLights[deck.id] = beaconMat;
  });

  // Cabina física móvil del ascensor 3D dentro del pozo central
  const elevatorCab = new THREE.Group();
  elevatorCab.name = 'ElevatorCabAssembly';
  elevatorCab.position.set(0, 3.4, 0);
  auroraGroup.add(elevatorCab);

  // Plataforma antideslizante, chasis, techo luminoso y pasamanos interiores
  add(elevatorCab, box(1.94, 0.14, 1.94), floorM, 0, -0.05, 0, 'floor');
  const cabFloorRim = add(elevatorCab, torus(1.06, 0.035, 8, 28), cyanGlow, 0, 0.03, 0);
  cabFloorRim.rotation.x = Math.PI / 2;
  add(elevatorCab, box(1.94, 0.14, 1.94), darkM, 0, 2.38, 0);
  add(elevatorCab, box(1.2, 0.04, 1.2), warmGlow, 0, 2.29, 0);

  // Esquinas estructurales + paredes acristaladas de la cabina
  [
    [-0.92, -0.92],
    [-0.92, 0.92],
    [0.92, -0.92],
    [0.92, 0.92],
  ].forEach(([cx, cz]) => {
    add(elevatorCab, box(0.11, 2.36, 0.11), steelM, cx, 1.18, cz);
  });
  [-1, 1].forEach((sz) => {
    add(elevatorCab, box(1.74, 2.2, 0.04), glassM, 0, 1.15, sz * 0.95);
    add(elevatorCab, box(1.4, 0.04, 0.04), railAmberM, 0, 1.0, sz * 0.88);
  });

  // Puertas sincronizadas de la propia cabina
  const cabDoorLeaves = [];
  [1, -1].forEach((endDir) => {
    const cx = endDir * 1.02;
    const cLeft = add(elevatorCab, box(0.06, 2.18, 0.62), steelM, cx, 1.12, -0.31);
    const cRight = add(elevatorCab, box(0.06, 2.18, 0.62), steelM, cx, 1.12, 0.31);
    cLeft.userData.dynamicTransform = true;
    cRight.userData.dynamicTransform = true;
    add(cLeft, box(0.07, 1.15, 0.22), glassM, 0, 0.25, 0);
    add(cRight, box(0.07, 1.15, 0.22), glassM, 0, 0.25, 0);
    cabDoorLeaves.push({ leftLeaf: cLeft, rightLeaf: cRight });
  });

  // Panel interior de control C01..C04 dentro de la cabina con display vivo de planta
  const cabScreen = makeDiegeticScreenTexture(
    'elevator',
    'ASCENSOR CENTRAL KRONOX',
    ['PLANTA ACTUAL: C01 PUENTE', 'PUERTAS: ABIERTAS', 'PULSA [E] PARA VIAJAR', 'SELECCIONA: C01 - C04'],
    '#38d8ff',
    { currentFloor: 0 }
  );
  trackExtraTex(cabScreen.tex);
  add(elevatorCab, box(0.45, 1.05, 0.08), darkM, 0, 1.32, 0.87);
  add(elevatorCab, box(0.38, 0.34, 0.02), trackExtraMat(new THREE.MeshBasicMaterial({ map: cabScreen.tex })), 0, 1.62, 0.82);

  const cabButtonsByDeck = {};
  CABIN_DECKS.forEach((d, idx) => {
    const btnMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: idx === 0 ? 0x45e89e : 0x38d8ff }));
    add(elevatorCab, box(0.32, 0.11, 0.02), steelM, 0, 1.34 - idx * 0.13, 0.835);
    const btn = add(elevatorCab, box(0.28, 0.095, 0.045), btnMat, 0, 1.34 - idx * 0.13, 0.815);
    btn.userData.elevatorFloorButton = d.id;
    registerInteractMesh(btn, `elevator-floor-${d.id}`, 'elevator-floor');
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
            ? 0x58ff9c
            : d.id === currentDeck.id
              ? 0xffe066
              : 0x2fd6ff
        );
      }
    });

    const cabSlide = Math.max(0, Math.min(1, activeCabDoorOpen)) * 0.72;
    cabDoorLeaves.forEach(({ leftLeaf, rightLeaf }) => {
      leftLeaf.position.z = -0.31 - cabSlide;
      rightLeaf.position.z = 0.31 + cabSlide;
    });
  }

  function redrawCabScreen() {
    const floorIdx = Math.max(0, CABIN_DECKS.findIndex((d) => d.id === elevatorState.currentDeckId));
    const curDeck = CABIN_DECKS[floorIdx] || CABIN_DECKS[0];
    const targetDeck = CABIN_DECKS.find((d) => d.id === elevatorState.targetDeckId) || curDeck;
    const doorStatus =
      elevatorState.phase === 'moving'
        ? `EN TRÁNSITO A ${targetDeck.code}`
        : elevatorState.phase === 'door-closing'
          ? 'CERRANDO COMPUERTAS'
          : elevatorState.phase === 'door-opening'
            ? 'ABRIENDO COMPUERTAS'
            : (doorStateByDeck[curDeck.id] ?? 0) > 0.7
              ? 'PUERTAS: ABIERTAS'
              : 'PUERTAS: CERRADAS';
    cabScreen.redraw(
      `ASCENSOR · ${curDeck.code}`,
      [
        `CUBIERTA: ${curDeck.shortName.toUpperCase()}`,
        doorStatus,
        `DESTINO: ${targetDeck.code}`,
        'PULSA [E] PARA ELEGIR PISO',
      ],
      '#38d8ff',
      { currentFloor: floorIdx }
    );
  }

  function requestElevatorDeck(targetDeckId, passengerInside = false) {
    const targetDeck = CABIN_DECKS.find((d) => d.id === targetDeckId);
    if (!targetDeck) return false;
    // Mantener estado de pasajero si ya viaja o acaba de activar dentro de la cabina
    elevatorState.passengerRiding = Boolean(passengerInside || elevatorState.passengerRiding);
    if (
      Math.abs(elevatorState.cabY - targetDeck.elevationY) < 0.08 &&
      elevatorState.phase === 'idle'
    ) {
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
      const a = (i / 16) * Math.PI * 2;
      const rMid = (rTop + rBot) * 0.5 - 0.15;
      const rib = new THREE.Group();
      rib.position.set(rMid * Math.cos(a), midY, rMid * Math.sin(a));
      rib.rotation.y = -a + Math.PI / 2;
      dParent.add(rib);
      add(rib, box(0.28, 3.12, 0.28), darkM, 0, 0, 0);
      add(rib, box(0.12, 3.1, 0.08), steelM, 0.14, 0, 0);
      if (i % 2 === 0) {
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
    add(g, cyl(0.32, 0.32, 0.06, 12), steelM, 0, 0.03, 0);
    add(g, box(0.84, 0.16, 0.82), bedM, 0, 0.54, 0);
    add(g, box(0.84, 0.88, 0.14), bedM, 0, 1.02, -0.38);
    add(g, box(0.1, 0.18, 0.62), steelM, -0.44, 0.68, -0.05);
    add(g, box(0.1, 0.18, 0.62), steelM, 0.44, 0.68, -0.05);
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

  // ==================== CUBIERTA 1 · PUENTE DE MANDO (Y = +3.4) ====================
  {
    const d1 = deckContainers['deck-01'];
    const f = 3.4;
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

    const sh = new THREE.Shape();
    P.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
    sh.closePath();
    const bridgeDeckMat = trackExtraMat(
      new THREE.MeshStandardMaterial({
        color: 0x1a283d,
        map: pbrSuite.textures.floorColorTex,
        normalMap: pbrSuite.textures.floorNormalTex,
        normalScale: new THREE.Vector2(0.5, 0.5),
        metalness: 0.32,
        roughness: 0.65,
      })
    );
    const bridgeFloor = add(d1, new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }), bridgeDeckMat, 0, f, 0);
    bridgeFloor.rotation.x = -Math.PI / 2;

    const bridgeScreenTex = makeDiegeticScreenTexture('nav', 'NAVEGACIÓN DE PROA', ['ÓRBITA: SOL-L2', 'VECTOR ACTIVO: -Z', 'TELEMETRÍA NOMINAL'], '#38d8ff');
    trackExtraTex(bridgeScreenTex.tex);
    const bridgeScrMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: bridgeScreenTex.tex }));

    const bowFacets = new Set([5, 6, 0, 1]);
    E.forEach((e, i) => {
      const g = new THREE.Group();
      g.position.set(e.mx, f, e.mz);
      g.rotation.y = e.rot;
      d1.add(g);
      if (i === 3) {
        [-1, 1].forEach((k) => add(g, box(e.l / 2 - 1.2, 2.9, 0.22), wallM, k * (e.l / 4 + 0.6), 1.45, 0, 'wall'));
      } else if (bowFacets.has(i)) {
        add(g, box(e.l + 0.04, 0.78, 0.26), wallM, 0, 0.39, 0, 'wall');
        add(g, box(e.l + 0.04, 0.08, 0.3), steelM, 0, 0.8, 0);
        add(g, box(e.l + 0.04, 2.1, 0.05), glassM, 0, 1.85, 0);
      } else {
        add(g, box(e.l, 2.9, 0.22), wallM, 0, 1.45, 0, 'wall');
        add(g, box(e.l * 0.55, 1.24, 0.08), darkM, 0, 1.8, -0.13);
        add(g, box(e.l * 0.51, 1.12, 0.03), bridgeScrMat, 0, 1.8, -0.17);
      }
      add(g, box(e.l, 0.22, 0.34), darkM, 0, 2.95, 0);
    });
    P.forEach((p, idx) => {
      if (idx === 0) {
        add(d1, box(0.32, 0.82, 0.32), darkM, p[0], f + 0.41, p[1], 'wall');
      } else {
        add(d1, box(0.34, 2.9, 0.34), darkM, p[0], f + 1.45, p[1], 'wall');
        add(d1, box(0.14, 2.9, 0.38), steelM, p[0], f + 1.45, p[1]);
      }
    });

    // Consolas en chevrón con mandos físicos, pantallas diegéticas e iluminarias de mando
    [[5, 3], [6, 1], [0, 1], [1, 3]].forEach(([i, n]) => {
      const e = E[i];
      const h = new THREE.Group();
      h.position.set(e.mx * 0.72, f + 0.1, e.mz * 0.72);
      h.rotation.y = e.rot;
      d1.add(h);
      add(h, box(e.l * 0.72, 0.025, 0.14), cyanGlow, 0, 0, 0);
      for (let k = 0; k < n; k++) {
        const [x, z] = e.at((k + 0.5) / n);
        const g = new THREE.Group();
        g.position.set(x * 0.72, f, z * 0.72);
        g.rotation.y = e.rot;
        d1.add(g);
        add(g, box(2.15, 1.05, 1.32), darkM, 0, 0.525, 0, 'console');
        add(g, box(1.96, 0.08, 1.05), steelM, 0, 1.05, 0);
        add(g, box(1.85, 0.04, 0.9), k % 2 ? amberGlow : cyanGlow, 0, 1.1, 0);
        // Palanca de mando + interruptores físicos
        add(g, cyl(0.03, 0.045, 0.18, 8), darkM, -0.58, 1.2, 0.15);
        add(g, box(0.16, 0.06, 0.22), railAmberM, 0.52, 1.15, 0.12);
        const scr = add(g, box(1.85, 0.8, 0.05), bridgeScrMat, 0, 1.48, 0.52);
        scr.rotation.x = -0.45;
        chair(d1, x * 0.72 - e.nx * 1.9, z * 0.72 - e.nz * 1.9, f, e.rot);
      }
    });

    // Puestos tácticos laterales
    [2, 4].forEach((i) => {
      const e = E[i];
      for (let k = 0; k < 4; k++) {
        const [x, z] = e.at(0.18 + k * 0.21);
        const g = new THREE.Group();
        g.position.set(x - e.nx * 1.1, f, z - e.nz * 1.1);
        g.rotation.y = e.rot + Math.PI;
        d1.add(g);
        add(g, box(2.2, 1.1, 0.92), darkM, 0, 0.55, 0, 'console');
        add(g, box(1.92, 0.05, 0.62), k % 2 ? cyanGlow : amberGlow, 0, 1.12, 0);
        add(g, box(1.72, 0.55, 0.04), bridgeScrMat, 0, 1.42, 0.3);
      }
    });

    // Estrado hexagonal del capitán y mesa holográfica trasera con detalle arquitectónico
    add(d1, cyl(3.1, 3.25, 0.18, 6), wallM, 5.5, f + 0.09, 0);
    add(d1, cyl(2.6, 2.75, 0.38, 6), darkM, 5.5, f + 0.2, 0, 'console');
    add(d1, cyl(2.75, 2.75, 0.05, 6), cyanGlow, 5.5, f + 0.36, 0);
    add(d1, cyl(2.58, 2.66, 0.03, 6), steelM, 5.5, f + 0.4, 0);
    chair(d1, 5.5, 0, f + 0.4, Math.PI / 2);
    [-1, 1].forEach((k) => {
      add(d1, box(1.0, 0.12, 0.22), darkM, 5.6, f + 1.22, k * 0.58);
      add(d1, box(0.5, 0.03, 0.16), bridgeScrMat, 5.75, f + 1.29, k * 0.58);
    });
    // Franja guía de piso desde la mesa táctica hacia el ascensor central
    add(d1, box(3.6, 0.015, 0.42), steelM, -2.9, f + 0.05, 0);
    add(d1, box(3.4, 0.02, 0.08), cyanGlow, -2.9, f + 0.06, -0.18);
    add(d1, box(3.4, 0.02, 0.08), cyanGlow, -2.9, f + 0.06, 0.18);
    // Paneles acústicos / ventilación laterales del puente en popa
    [-1, 1].forEach((k) => {
      add(d1, box(0.14, 1.35, 3.8), ventM, -11.78, f + 0.72, k * 6.0);
    });

    add(d1, cyl(1.5, 1.7, 0.9, 6), darkM, -6, f + 0.45, 0, 'console');
    add(d1, cyl(1.4, 1.4, 0.05, 6), cyanGlow, -6, f + 0.93, 0);
    const wfMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x9be7ff, wireframe: true }));
    const holoTableOrb = new THREE.Group();
    holoTableOrb.name = 'BridgeHoloProjector';
    holoTableOrb.position.set(-6, f + 1.85, 0);
    d1.add(holoTableOrb);
    add(holoTableOrb, cachedGeo('ico:0.68:1', () => new THREE.IcosahedronGeometry(0.68, 1)), wfMat, 0, 0, 0);
    const holoOrbit = add(holoTableOrb, torus(0.95, 0.025, 6, 40), cyanGlow, 0, 0, 0);
    holoOrbit.rotation.x = 1.2;
    holoOrbit.userData.dynamicTransform = true;
    const baseRing = add(d1, torus(1.95, 0.04, 4, 6), cyanGlow, -6, f + 1.08, 0);
    baseRing.rotation.x = Math.PI / 2;

    // Mamparo trasero de popa con señalización del puente
    [-1, 1].forEach((k) => {
      add(d1, box(0.08, 1.5, 6.2), bridgeScrMat, -11.82, f + 1.7, k * 5.85);
      add(d1, box(0.4, 3.0, 0.3), darkM, -12, f + 1.5, k * 1.25);
    });
    add(d1, box(0.4, 0.3, 2.8), darkM, -12, f + 2.9, 0);
    add(d1, box(0.06, 2.5, 2.1), amberGlow, -12.1, f + 1.3, 0);
    mountDeckPlacard(d1, -11.75, f + 2.55, 0, Math.PI / 2, 'C01', 'PUENTE DE MANDO', 'CONTROL Y NAVEGACIÓN DE PROA', '#38d8ff');

    add(d1, box(26, 0.2, 0.35), darkM, 0, f + 2.88, 0);
    [[-9, 21], [-4, 22], [1, 23], [6, 17], [11, 11]].forEach(([x, w]) => add(d1, box(0.3, 0.18, w), darkM, x, f + 2.88, 0));
  }

  // ==================== CUBIERTA 2 · HABITACIONAL, BIOPÓNICA Y ESCLUSA (Y = 0.0) ====================
  const interactiveMechanisms = {
    bioponicsActive: true,
    hydrationDispensing: false,
    airlockPressurized: true,
    storageC02Open: false,
    reactorMode: 'nominal', // 'nominal' | 'overclock' | 'quiet'
    hangarCraneDeployed: false,
    maintDrawerOpen: false,
    multitoolCollected: false,
    scannerCollected: false,
  };
  let storageDoorPivot = null;
  let bioponicLightMat = uvVioletGlow;
  let hydrationStreamMesh = null;
  let airlockValvePivot = null;
  let airlockBeaconMat = greenGlow;
  let reactorPlasmaCore = null;
  let reactorPlasmaMat = null;
  let cryoValvePivot = null;
  let craneTrolleyGroup = null;
  let maintArmPivot = null;
  let maintDrawerPivot = null;
  let shuttleHatchPivot = null;
  let pickupMultitoolGroup = null;
  let pickupScannerGroup = null;

  {
    const d2 = deckContainers['deck-02'];
    const f = 0.0;

    // 8 mamparos radiales alineados 1:1 con C02_BULKHEAD_ANGLES (acolchado textil + zócalo técnico)
    C02_BULKHEAD_ANGLES.forEach((a) => {
      const g = new THREE.Group();
      g.rotation.y = -a;
      d2.add(g);
      // Muro sólido desde r = 6.95 hasta la piel esférica interior
      add(g, box(10.65, 2.95, 0.22), wallM, 12.25, f + 1.475, 0, 'wall');
      add(g, box(8.8, 1.85, 0.24), quiltedM, 12.4, f + 1.48, 0);
      add(g, box(10.65, 0.18, 0.28), darkM, 12.25, f + 0.09, 0);
      add(g, box(10.65, 0.22, 0.28), steelM, 12.25, f + 2.85, 0);
      add(g, box(0.32, 2.95, 0.34), steelM, 6.95, f + 1.475, 0, 'wall');
      add(g, box(0.14, 1.65, 0.38), ventM, 8.2, f + 1.4, 0);
    });

    // 6 camarotes laterales con litera, almohada, baúl, escritorio y armario (exacto a C02_CABIN_BAYS)
    C02_CABIN_BAYS.forEach((bay) => {
      const c = new THREE.Group();
      c.rotation.y = -bay.angleRad;
      d2.add(c);
      add(c, box(2.45, 0.44, 1.15), bedM, 14.1, f + 0.46, 0, 'console');
      add(c, box(0.46, 0.14, 0.78), pbrSuite.materials.shuttleCompositeMat || steelM, 15.0, f + 0.72, 0);
      add(c, box(1.9, 0.28, 0.92), darkM, 14.1, f + 0.14, 0);
      add(c, box(2.52, 0.12, 1.2), steelM, 14.1, f + 0.26, 0);
      add(c, box(0.52, 0.16, 0.85), finM, 13.0, f + 0.74, 0);
      add(c, box(0.36, 0.22, 0.04), cyanGlow, 12.95, f + 0.98, 0.18);
      add(c, box(0.64, 2.15, 1.5), darkM, 16.6, f + 1.075, 0, 'wall');
      add(c, box(0.05, 1.85, 0.55), cyanGlow, 16.26, f + 1.08, -0.35);
      add(c, box(2.2, 0.06, 0.3), warmGlow, 12.8, f + 2.82, 0);
    });

    // Comedor circular en arcos huecos ±X (r en [2.38, 3.36]) manteniendo pasillos ±Z totalmente libres
    const barBodyGeo = buildHollowArcCounterGeo(C02_DINING_ARCS.rInner, C02_DINING_ARCS.rOuter, C02_DINING_ARCS.halfAngleRad, 0.78, 22);
    const barTopGeo = buildHollowArcCounterGeo(C02_DINING_ARCS.rInner - 0.04, C02_DINING_ARCS.rOuter + 0.04, C02_DINING_ARCS.halfAngleRad, 0.045, 22);
    const barFootGeo = buildHollowArcCounterGeo(C02_DINING_ARCS.rOuter + 0.12, C02_DINING_ARCS.rOuter + 0.22, C02_DINING_ARCS.halfAngleRad * 0.95, 0.05, 20);
    [-Math.PI / 2, Math.PI / 2].forEach((rotY) => {
      const barGroup = new THREE.Group();
      barGroup.rotation.y = rotY;
      d2.add(barGroup);
      add(barGroup, barBodyGeo, darkM, 0, f, 0, 'console');
      add(barGroup, barTopGeo, steelM, 0, f + 0.78, 0);
      add(barGroup, barFootGeo, railAmberM, 0, f + 0.14, 0);
      add(barGroup, box(0.88, 0.03, 0.06), amberGlow, (C02_DINING_ARCS.rInner + C02_DINING_ARCS.rOuter) * 0.5, f + 0.79, 0);
    });
    // Taburetes alineados exclusivamente frente a las barras ±X (sin obstruir accesos ±Z al ascensor)
    [1, -1].forEach((sideX) => {
      C02_DINING_ARCS.stoolAnglesFromX.forEach((ang) => {
        const kx = sideX * C02_DINING_ARCS.stoolRadius * Math.cos(ang);
        const kz = C02_DINING_ARCS.stoolRadius * Math.sin(ang);
        const ax = -kz;
        const az = kx;
        add(d2, cyl(0.32, 0.34, 0.46, 14), bedM, ax, f + 0.29, az);
        add(d2, cyl(0.14, 0.22, 0.12, 12), steelM, ax, f + 0.06, az);
      });
    });

    // Módulo físico de Hidratación sobre la barra de comedor (en estación `galley` KRONOX (+3.2, 0, -1.6))
    const hydGroup = new THREE.Group();
    hydGroup.position.set(1.5, f + 0.82, 2.95);
    d2.add(hydGroup);
    const hydBody = add(hydGroup, box(0.45, 0.72, 0.45), steelM, 0, 0.36, 0);
    const hydSpout = add(hydGroup, cyl(0.09, 0.09, 0.22, 12), cyanGlow, 0, 0.16, 0);
    registerInteractMesh(hydBody, 'galley', 'direct');
    registerInteractMesh(hydSpout, 'galley', 'direct');
    hydrationStreamMesh = add(hydGroup, cyl(0.025, 0.025, 0.22, 8), trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 })), 0, 0.42, 0);
    hydrationStreamMesh.visible = false;

    // Bahía Biopónica y de Soporte Vital en popa (KRONOX +Z -> Aurora -X)
    const bioBay = new THREE.Group();
    bioBay.name = 'BioponicsBayAssembly';
    d2.add(bioBay);
    bioponicLightMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x7effb2 }));
    [-2.55, 2.55].forEach((bz) => {
      const bioCab = add(bioBay, box(4.2, 2.25, 0.95), darkM, -11.4, f + 1.125, bz, 'console');
      add(bioBay, box(3.9, 0.14, 0.75), steelM, -11.4, f + 2.28, bz);
      const bioLamp = add(bioBay, box(3.7, 0.08, 0.45), bioponicLightMat, -11.4, f + 2.18, bz);
      add(bioBay, box(3.7, 1.4, 0.56), trackExtraMat(new THREE.MeshStandardMaterial({ color: 0x1b6b45, roughness: 0.7 })), -11.4, f + 1.15, bz);
      const bioGlass = add(bioBay, box(3.76, 1.46, 0.66), glassM, -11.4, f + 1.15, bz);
      registerInteractMesh(bioCab, 'bioponics', 'direct');
      registerInteractMesh(bioLamp, 'bioponics', 'direct');
      registerInteractMesh(bioGlass, 'bioponics', 'direct');
    });
    mountDeckPlacard(d2, -13.8, f + 2.48, 0, Math.PI / 2, 'BIO', 'MÓDULO BIOPÓNICO', 'HIDROPONÍA Y RECICLADO H2O/O2', '#45e89e');

    // Esclusa EVA a proa (Aurora +X = +15.8 -> KRONOX Z = -15.8)
    airlockBeaconMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
    const airlockDoor = add(d2, box(0.45, 2.65, 2.75), doorM, 16.0, f + 1.325, 0, 'door');
    const airlockBeacon = add(d2, box(0.1, 2.12, 1.82), airlockBeaconMat, 15.72, f + 1.25, 0);
    registerInteractMesh(airlockDoor, 'airlock', 'direct');
    registerInteractMesh(airlockBeacon, 'airlock', 'direct');
    airlockValvePivot = new THREE.Group();
    airlockValvePivot.position.set(15.65, f + 1.35, -0.58);
    d2.add(airlockValvePivot);
    const wheel = add(airlockValvePivot, torus(0.18, 0.032, 8, 20), railAmberM, 0, 0, 0);
    wheel.rotation.y = Math.PI / 2;
    registerInteractMesh(wheel, 'airlock', 'direct');
    mountDeckPlacard(d2, 15.5, f + 2.62, 0, -Math.PI / 2, 'EVA', 'ESCLUSA RADIAL EVA', 'PRESURIZACIÓN Y TRAJES', '#5be3aa');

    // Compartimento abrible 3D en camarote babor-proa (`storage-c02` KRONOX (-5.95, 0, -5.95))
    const storageGroup = new THREE.Group();
    storageGroup.name = 'StorageLockerC02';
    storageGroup.position.set(-5.95, f, -5.95);
    storageGroup.rotation.y = Math.PI / 4;
    deckOverlayGroups['deck-02'].add(storageGroup);
    add(storageGroup, box(1.28, 2.02, 0.72), darkM, 0, 1.01, -0.1, 'console');
    add(storageGroup, box(1.12, 1.78, 0.56), steelM, 0, 1.02, -0.06);
    add(storageGroup, box(1.06, 0.04, 0.48), darkM, 0, 1.12, -0.02);
    // Suministros EVA visibles en el interior al abrirse la puerta
    add(storageGroup, cyl(0.12, 0.12, 0.75, 12), railAmberM, -0.28, 0.65, 0.05);
    add(storageGroup, cyl(0.12, 0.12, 0.75, 12), cyanGlow, 0.02, 0.65, 0.05);
    add(storageGroup, box(0.36, 0.28, 0.34), greenGlow, 0.28, 1.38, 0.02);
    storageDoorPivot = new THREE.Group();
    storageDoorPivot.position.set(-0.56, 1.01, 0.25);
    storageGroup.add(storageDoorPivot);
    const storageLeaf = add(storageDoorPivot, box(1.12, 1.82, 0.08), doorM, 0.56, 0, 0);
    const storageHandle = add(storageDoorPivot, box(0.18, 0.42, 0.12), cyanGlow, 0.96, 0.08, 0.02);
    registerInteractMesh(storageLeaf, 'storage-c02', 'direct');
    registerInteractMesh(storageHandle, 'storage-c02', 'direct');
  }

  // ==================== CUBIERTA 3 · INGENIERÍA, REACTOR Y SPHEREx (Y = -3.4) ====================
  {
    const d3 = deckContainers['deck-03'];
    const f = -3.4;

    // Reactor principal en popa (KRONOX (0, -3.4, +9.0)) con bobinas en cobre y colectores en techo
    const rg = new THREE.Group();
    rg.position.set(-9, f, 0);
    d3.add(rg);
    add(rg, cyl(2.45, 2.55, 0.68, 32), darkM, 0, 0.34, 0, 'console');
    add(rg, cyl(2.45, 2.55, 0.68, 32), darkM, 0, 2.58, 0, 'console');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.25;
      add(rg, cyl(0.15, 0.15, 2.8, 12), steelM, 2.2 * Math.cos(a), 1.46, 2.2 * Math.sin(a));
      const coil = add(rg, torus(0.38, 0.09, 8, 18), copperM, 2.02 * Math.cos(a), 1.46, 2.02 * Math.sin(a));
      coil.rotation.y = -a;
    }
    reactorPlasmaMat = trackExtraMat(new THREE.MeshBasicMaterial({ color: 0x7ce6ff }));
    reactorPlasmaCore = add(rg, cyl(1.05, 1.05, 2.85, 24), reactorPlasmaMat, 0, 1.48, 0);
    reactorPlasmaCore.name = 'ReactorPlasmaCore';
    reactorPlasmaCore.userData.dynamicTransform = true;
    [0.68, 1.45, 2.22].forEach((ty) => {
      const t = add(rg, torus(2.46, 0.12, 8, 32), goldM, 0, ty, 0);
      t.rotation.x = Math.PI / 2;
      t.userData.dynamicTransform = true;
    });
    [-4, 4].forEach((cz) => add(d3, cyl(0.26, 0.26, 3.05, 12), steelM, -9, f + 1.52, cz, 'console'));
    // Conductos criogénicos en techo, colectores de refrigeración y canaleta de seguridad en piso
    [-3.2, 3.2].forEach((pz) => {
      add(d3, cyl(0.18, 0.18, 18.0, 12), steelM, 0, f + 2.75, pz).rotation.z = Math.PI / 2;
      add(d3, cyl(0.22, 0.22, 1.2, 12), goldM, -4.5, f + 2.75, pz).rotation.z = Math.PI / 2;
      add(d3, cyl(0.22, 0.22, 1.2, 12), goldM, 4.5, f + 2.75, pz).rotation.z = Math.PI / 2;
      add(d3, box(14.0, 0.025, 0.32), hazardM, 0, f + 0.015, pz);
    });
    add(d3, box(0.24, 2.2, 4.6), ventM, -12.8, f + 1.15, 0);

    cryoValvePivot = new THREE.Group();
    cryoValvePivot.position.set(-6.0, f + 1.1, 0);
    d3.add(cryoValvePivot);
    const rv = add(cryoValvePivot, torus(0.22, 0.04, 8, 20), railAmberM, 0, 0, 0);
    rv.rotation.y = Math.PI / 2;
    mountDeckPlacard(d3, -6.4, f + 2.68, 0, Math.PI / 2, 'C03', 'NÚCLEO DEL REACTOR AURORA', 'CONFINAMIENTO MAGNÉTICO Y CRIOGENIA', '#6ce0ff');

    // Tanques criogénicos dorados MLI a proa con cunas estructurales y domos
    [-6, 6].forEach((cz) => {
      add(d3, cyl(1.32, 1.32, 2.35, 24), goldM, 9, f + 1.38, cz, 'console');
      add(d3, sphereGeo(1.3, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), steelM, 9, f + 2.52, cz);
      add(d3, cyl(1.42, 1.42, 0.26, 24), darkM, 9, f + 0.16, cz);
      add(d3, cyl(1.38, 1.38, 0.14, 24), copperM, 9, f + 1.8, cz);
    });

    // Arcos curvos de laboratorio SPHEREx (babor) y Banco Óptico (estribor) sincronizados con C03_LAB_ARCS
    const labScrTex = makeDiegeticScreenTexture('science', 'ESPECTROMETRÍA IR SPHEREx', ['BANDAS 0.75-5.0 µm', 'CRIOSTATO: 42 K', 'BARRIDO ÓPTICO LISTO'], '#ffbe55');
    trackExtraTex(labScrTex.tex);
    const labScrMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: labScrTex.tex }));

    const buildLabArc = (sideName, accentMat, placardTitle, placardSub, zPlacard, rotPlacard, placardHex) => {
      C03_LAB_ARCS.filter((item) => item.side === sideName).forEach((item) => {
        const g = new THREE.Group();
        g.position.set(15.2 * Math.sin(item.t), f, 15.2 * Math.cos(item.t));
        g.rotation.y = item.t;
        d3.add(g);
        add(g, box(2.35, 1.02, 1.28), darkM, 0, 0.51, 0, 'console');
        add(g, box(2.05, 0.05, 0.88), accentMat, 0, 1.05, 0);
        add(g, box(1.88, 0.28, 0.12), ventM, 0, 0.22, -0.62);
        add(g, box(1.68, 0.58, 0.05), labScrMat, 0, 1.48, -0.35);
      });
      mountDeckPlacard(d3, 0, f + 2.55, zPlacard, rotPlacard, 'LAB', placardTitle, placardSub, placardHex);
    };
    buildLabArc('port', amberGlow, 'LABORATORIO SPHEREx', 'DETECTOR INFRARROJO Y CRIOSTATO', -14.8, 0, '#ffbe55');
    buildLabArc('starboard', cyanGlow, 'BANCO ÓPTICO LÁSER', 'ALINEACIÓN INTERFEROMÉTRICA', 14.8, Math.PI, '#45e8ff');
  }

  // ==================== CUBIERTA 4 · BODEGA, HANGAR, GRÚA Y MANTENIMIENTO (Y = -6.8) ====================
  {
    const d4 = deckContainers['deck-04'];
    const f = -6.8;

    // Contenedores modulares corrugados deterministas (exactamente sincronizados con C04_CARGO_CONTAINERS)
    C04_CARGO_CONTAINERS.forEach((b) => {
      const cm = trackExtraMat(pbrSuite.makeCargoMat(b.color));
      const ax = -b.cz;
      const az = b.cx;
      const wX = b.hz * 2;
      const wZ = b.hx * 2;
      const placeContainer = (levelIdx) => {
        const cy = f + b.h * (0.5 + levelIdx);
        add(d4, box(wX, b.h - 0.04, wZ), cm, ax, cy, az, 'console');
        add(d4, box(wX + 0.06, 0.1, wZ + 0.06), darkM, ax, cy - b.h * 0.45, az);
        add(d4, box(wX + 0.06, 0.1, wZ + 0.06), steelM, ax, cy + b.h * 0.45, az);
      };
      placeContainer(0);
      if (b.double) placeContainer(1);
    });

    // Transbordador de servicio esculpido con compuerta lateral de mantenimiento abrible
    const shuttleM = pbrSuite.materials.shuttleCompositeMat || hullM;
    const sg = new THREE.Group();
    sg.name = 'ServiceShuttleHangar';
    sg.position.set(11.5, f, 0);
    d4.add(sg);
    add(sg, box(6.0, 1.8, 2.6), shuttleM, 0, 1.4, 0, 'console');
    add(sg, box(5.4, 0.14, 2.7), darkM, -0.1, 1.45, 0);
    add(sg, box(3.6, 0.12, 2.68), goldM, 0.4, 1.15, 0);
    const nose = add(sg, cyl(0.45, 1.32, 2.8, 16), shuttleM, 4.3, 1.4, 0);
    nose.rotation.z = -Math.PI / 2;
    add(sg, box(2.4, 0.15, 7.0), finM, -0.5, 1.2, 0, 'console');
    [-1.1, 1.1].forEach((tz) => {
      add(sg, cyl(0.32, 0.36, 0.95, 16), copperM, -2.65, 1.55, tz).rotation.z = Math.PI / 2;
    });
    add(sg, box(1.5, 0.55, 1.9), darkM, 2.55, 2.15, 0);
    add(sg, box(1.25, 0.36, 1.68), cyanGlow, 2.68, 2.22, 0);
    [[-2, -1], [-2, 1], [2, 0]].forEach(([sx, sz]) => add(sg, cyl(0.11, 0.11, 0.6, 8), steelM, sx, 0.3, sz * 1.2));

    shuttleHatchPivot = new THREE.Group();
    shuttleHatchPivot.position.set(0.6, 1.45, 1.32);
    sg.add(shuttleHatchPivot);
    const shuttleHatchLeaf = add(shuttleHatchPivot, box(1.35, 0.9, 0.08), doorM, 0, 0, 0);
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
    add(maintGroup, box(1.65, 0.95, 2.15), darkM, 0, 0.475, 0, 'console');
    add(maintGroup, box(1.5, 0.08, 2.0), steelM, 0, 0.98, 0);
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

    // Multiherramienta EVA física recogible sobre bandeja magnética en C04
    pickupMultitoolGroup = new THREE.Group();
    pickupMultitoolGroup.name = 'PickupMultitoolProp';
    pickupMultitoolGroup.position.set(0.18, 1.08, 0.48);
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
    'deck-01': { c: 0xcbe8ff, intensity: 0.68, y: (levels[1] ?? 0) + 2.55 },
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
    const floorBeacon = add(stGroup, ringGeo(0.68, 0.82, 32), trimBarMat, 0, 0.04, 0);
    floorBeacon.rotation.x = -Math.PI / 2;
    floorBeacon.userData.dynamicTransform = true;
    const scrMat = trackExtraMat(new THREE.MeshBasicMaterial({ map: screenData.tex }));

    let screenMesh;
    if (st.id === 'windows') {
      add(stGroup, box(0.95, 0.82, 0.42), darkM, -1.35, 0.41, 0.65);
      screenMesh = add(stGroup, box(0.84, 0.44, 0.05), scrMat, -1.35, 1.05, 0.65);
      screenMesh.rotation.x = -0.45;
    } else if (st.id === 'missions') {
      screenMesh = add(stGroup, box(1.15, 0.62, 0.06), scrMat, 0, 1.32, -1.15);
      screenMesh.rotation.x = -0.35;
    } else if (st.id === 'engineering') {
      add(stGroup, box(0.92, 0.84, 0.46), darkM, 1.35, 0.42, 0.65);
      add(stGroup, box(0.84, 0.04, 0.38), trimBarMat, 1.35, 0.86, 0.65);
      screenMesh = add(stGroup, box(0.82, 0.46, 0.05), scrMat, 1.35, 1.22, 0.54);
      screenMesh.rotation.x = -0.32;
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
    screenMesh.userData.stationId = st.id;
    const isDirectStation = ['storage-c02', 'bioponics', 'galley', 'airlock', 'hangar', 'maintenance-c04'].includes(st.id);
    registerInteractMesh(screenMesh, st.id, isDirectStation ? 'direct' : 'panel');

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
      updateScreen: (title, lines, meta = {}) => screenData.redraw(title, lines, accentStr, meta),
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
      const orbRing = bridgeHoloProjector.children?.[1];
      if (orbRing) {
        orbRing.rotation.z = elapsedTime * 1.25;
        orbRing.rotation.y = Math.cos(elapsedTime * 0.85) * 0.45;
      }
    }

    if (reactorPlasmaCore && reactorPlasmaMat && deckContainers['deck-03']?.visible !== false) {
      const isOver = interactiveMechanisms.reactorMode === 'overclock';
      const isQuiet = interactiveMechanisms.reactorMode === 'quiet';
      const freq = isOver ? 7.2 : isQuiet ? 2.1 : 4.4;
      const s = 0.94 + 0.09 * Math.sin(elapsedTime * freq);
      reactorPlasmaCore.scale.set(s, 1.0 + 0.03 * Math.cos(elapsedTime * (freq + 0.8)), s);
      reactorPlasmaCore.rotation.y = elapsedTime * (isOver ? 2.2 : isQuiet ? 0.5 : 1.1);
      reactorPlasmaMat.color.setHex(isOver ? 0xc084fc : isQuiet ? 0x2dd4bf : 0x7ce6ff);
      if (reactorAssembly) {
        reactorAssembly.children.forEach((child, cIdx) => {
          if (child !== reactorPlasmaCore && child.geometry?.type === 'TorusGeometry') {
            child.rotation.z = elapsedTime * (cIdx % 2 === 0 ? 0.55 : -0.65) * (isOver ? 1.7 : 1.0);
          }
        });
      }
    }

    if (cryoValvePivot) {
      const targetAngle = interactiveMechanisms.reactorMode === 'overclock' ? Math.PI * 0.8 : interactiveMechanisms.reactorMode === 'quiet' ? -Math.PI * 0.6 : 0;
      cryoValvePivot.rotation.x += (targetAngle - cryoValvePivot.rotation.x) * 0.12;
    }

    if (storageDoorPivot) {
      const targetOpen = interactiveMechanisms.storageC02Open ? -Math.PI * 0.58 : 0;
      storageDoorPivot.rotation.y += (targetOpen - storageDoorPivot.rotation.y) * 0.14;
    }

    if (hydrationStreamMesh) {
      hydrationStreamMesh.visible = Boolean(interactiveMechanisms.hydrationDispensing);
    }

    if (bioponicLightMat) {
      bioponicLightMat.color.setHex(interactiveMechanisms.bioponicsActive ? 0x7effb2 : 0xa855f7);
    }

    if (airlockValvePivot && airlockBeaconMat) {
      const targetVal = interactiveMechanisms.airlockPressurized ? 0 : Math.PI * 1.4;
      airlockValvePivot.rotation.x += (targetVal - airlockValvePivot.rotation.x) * 0.12;
      airlockBeaconMat.color.setHex(interactiveMechanisms.airlockPressurized ? 0x45e89e : 0xf59e0b);
    }

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
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'hydration' || actionId === 'galley') {
      interactiveMechanisms.hydrationDispensing = value != null ? Boolean(value) : !interactiveMechanisms.hydrationDispensing;
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'storage-c02') {
      interactiveMechanisms.storageC02Open = value != null ? Boolean(value) : !interactiveMechanisms.storageC02Open;
      return { ok: true, state: { ...interactiveMechanisms } };
    }
    if (actionId === 'airlock') {
      interactiveMechanisms.airlockPressurized = value != null ? Boolean(value) : !interactiveMechanisms.airlockPressurized;
      return { ok: true, state: { ...interactiveMechanisms } };
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
    setAnisotropy: (v) => pbrSuite.setAnisotropy(v),
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
    clampAstronautPosition,
    findNearestInteractiveStation,
    resolveCurrentDeck,
    updateStations,
    dispose,
  };
}
