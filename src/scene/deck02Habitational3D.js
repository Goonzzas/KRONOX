import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  C02_BULKHEAD_ANGLES,
  C02_CABIN_BAYS,
  C02_DINING_ARCS,
  C02_HAB_SUITES,
} from './kronoxInteriorSpatialModel.js';
import { makeDeckSignTexture, makeDiegeticScreenTexture } from './shipPbrMaterials.js';

/**
 * Construye el Nivel 2 completo (`deck-02` · Cubierta Habitacional, Y = 0.0) directamente
 * en coordenadas mundiales KRONOX (-Z = Proa Esclusa EVA, +Z = Popa Biopónica, ±X = Comedores)
 * con mapeo geométrico y de colisión exacto 1:1 para las 6 suites habitables (`HAB-01..HAB-06`),
 * camas descansables, puertas corredizas, lámparas circadianas, armarios y módulos interactivos.
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
} = {}) {
  const f = floorY;
  const gDeck = new THREE.Group();
  gDeck.name = 'Deck02HabitationalArchitecture';
  gDeck.userData.deckId = 'deck-02';
  parentGroup.add(gDeck);

  const extraDisposables = [];
  const trackGeo = (g) => {
    extraDisposables.push(g);
    return g;
  };
  const trackMat = (m) => {
    extraDisposables.push(m);
    return m;
  };
  const trackTex = (t) => {
    if (t) extraDisposables.push(t);
    return t;
  };

  const geoCache = new Map();
  const cached = (key, factory) => {
    if (!geoCache.has(key)) {
      geoCache.set(key, trackGeo(factory()));
    }
    return geoCache.get(key);
  };

  const box = (w, h, d) =>
    cached(`b:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d));
  const rbox = (w, h, d, r = 0.032, segs = 2) =>
    cached(
      `rb:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}:${segs}`,
      () => new RoundedBoxGeometry(w, h, d, segs, r)
    );
  const cyl = (rt, rb, h, s = 18) =>
    cached(`cy:${rt.toFixed(3)}:${rb.toFixed(3)}:${h.toFixed(3)}:${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
  const torus = (r, t, rs = 8, ts = 28) =>
    cached(`to:${r.toFixed(3)}:${t.toFixed(3)}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));
  const sph = (r, ws = 16, hs = 12) =>
    cached(`sp:${r.toFixed(3)}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));

  const place = (target, geo, mat, x = 0, y = 0, z = 0, colliderKind = null, isDynamic = false) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (isDynamic) m.userData.dynamicTransform = true;
    target.add(m);
    if (colliderKind && registerColliderMesh) {
      registerColliderMesh(m, colliderKind, 'deck-02');
    }
    if (staticFreezeCandidates && !isDynamic) {
      staticFreezeCandidates.push(m);
    }
    return m;
  };

  const regInteract = (mesh, id, kind = 'direct') => {
    if (registerInteractMesh && mesh && id) {
      registerInteractMesh(mesh, id, kind, 'deck-02');
    }
    return mesh;
  };

  // Materiales compartidos con respaldo seguro
  const wallM = materials.wallM;
  const darkM = materials.darkM;
  const steelM = materials.steelM;
  const slateM = materials.slateM || darkM;
  const goldM = materials.goldM || steelM;
  const copperM = materials.copperM || steelM;
  const doorM = materials.doorM || slateM;
  const bedM = materials.bedM || slateM;
  const compositeM = materials.compositeM || wallM;
  const warmHabM = materials.warmHabM || slateM;
  const glassM = materials.glassM;
  const quiltedM = materials.quiltedM || wallM;
  const railAmberM = materials.railAmberM || steelM;
  const cyanGlow = materials.cyanGlow;
  const amberGlow = materials.amberGlow;
  const greenGlow = materials.greenGlow;
  const warmGlow = materials.warmGlow;
  const uvVioletGlow = materials.uvVioletGlow || cyanGlow;

  // Materiales cálidos habitacionales propios de C02
  const oakWoodM = trackMat(new THREE.MeshStandardMaterial({ color: 0x745036, metalness: 0.08, roughness: 0.56 }));
  const walnutM = trackMat(new THREE.MeshStandardMaterial({ color: 0x452d1d, metalness: 0.1, roughness: 0.62 }));
  const carpetM = trackMat(new THREE.MeshStandardMaterial({ color: 0x202b3d, metalness: 0.04, roughness: 0.92 }));
  const cushionCreamM = trackMat(new THREE.MeshStandardMaterial({ color: 0xd6d9e2, metalness: 0.04, roughness: 0.78 }));
  const whiteCeramicM = trackMat(new THREE.MeshStandardMaterial({ color: 0xe6edf5, metalness: 0.05, roughness: 0.34 }));
  const darkScreenFrameM = trackMat(new THREE.MeshStandardMaterial({ color: 0x0c1320, metalness: 0.6, roughness: 0.3 }));
  const frostedDoorM = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xa5d8ff,
      metalness: 0.14,
      roughness: 0.22,
      transparent: true,
      opacity: 0.58,
      reflectivity: 0.75,
    })
  );
  const foliageMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 }));
  const vegRedMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.72 }));
  const foodPouchMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.24 }));

  // Luces puntuales compartidas de suite (2 luces dinámicas enfocadas en las suites cercanas / descansando para mantener presupuesto shader óptimo)
  const bayAccentLightA = new THREE.PointLight(0xffcf87, 0.9, 10.5, 1.5);
  bayAccentLightA.position.set(10, f + 2.35, -10);
  gDeck.add(bayAccentLightA);

  const bayAccentLightB = new THREE.PointLight(0x8ae8ff, 0.65, 11.5, 1.5);
  bayAccentLightB.position.set(-10, f + 2.35, 10);
  gDeck.add(bayAccentLightB);

  const handledStationIds = new Set();
  const stationScreenMeshes = {};
  const screenUpdates = {};

  // =========================================================================
  // 1. ANILLOS GUÍA DEL PASILLO HABITACIONAL (r = 6.65 / 6.85)
  // =========================================================================
  const corrFloorRing = place(gDeck, torus(6.65, 0.028, 6, 72), warmGlow, 0, f + 0.018, 0);
  corrFloorRing.rotation.x = Math.PI / 2;
  const corrInnerRing = place(gDeck, torus(4.22, 0.022, 6, 64), cyanGlow, 0, f + 0.014, 0);
  corrInnerRing.rotation.x = Math.PI / 2;
  const corrCeilHalo = place(gDeck, torus(6.85, 0.075, 8, 72), slateM, 0, f + 2.9, 0);
  corrCeilHalo.rotation.x = Math.PI / 2;

  // =========================================================================
  // 2. LOS 8 MAMPAROS RADIALES SÓLIDOS (desfasados 22.5°, r ∈ [6.85, 17.8])
  // Rotation.y = -angleRad -> -Z local apunta en dirección radial (sin a, -cos a)
  // =========================================================================
  C02_BULKHEAD_ANGLES.forEach((a) => {
    const g = new THREE.Group();
    g.rotation.y = -a;
    gDeck.add(g);
    place(g, box(0.24, 2.96, 10.95), wallM, 0, f + 1.48, -12.325, 'wall');
    place(g, box(0.27, 1.92, 9.2), quiltedM, 0, f + 1.48, -12.45);
    place(g, box(0.28, 0.16, 10.95), darkM, 0, f + 0.08, -12.325);
    place(g, box(0.29, 0.055, 9.2), warmGlow, 0, f + 2.74, -12.45);
  });

  // =========================================================================
  // 3. COMEDOR CIRCULAR EN ±X (1:1 con C02_DINING_ARCS) + GALLEY + LOUNGE
  // =========================================================================
  [1, -1].forEach((sideSign) => {
    const barGroup = new THREE.Group();
    barGroup.name = sideSign === 1 ? 'DiningBarStarboard' : 'DiningBarPort';
    barGroup.rotation.y = sideSign === 1 ? 0 : Math.PI;
    gDeck.add(barGroup);

    const arcSteps = 12;
    const rMid = (C02_DINING_ARCS.rInner + C02_DINING_ARCS.rOuter) * 0.5;
    const widthBar = C02_DINING_ARCS.rOuter - C02_DINING_ARCS.rInner;
    for (let s = 0; s < arcSteps; s++) {
      const a0 = -C02_DINING_ARCS.halfAngleRad + (s / arcSteps) * (C02_DINING_ARCS.halfAngleRad * 2);
      const a1 = -C02_DINING_ARCS.halfAngleRad + ((s + 1) / arcSteps) * (C02_DINING_ARCS.halfAngleRad * 2);
      const am = (a0 + a1) * 0.5;
      const segLen = rMid * (a1 - a0) + 0.04;
      const px = rMid * Math.cos(am);
      const pz = rMid * Math.sin(am);

      const ped = place(barGroup, box(widthBar * 0.72, 0.76, segLen), slateM, px, f + 0.38, pz, 'console');
      ped.rotation.y = -am;
      const top = place(barGroup, box(widthBar + 0.12, 0.07, segLen + 0.03), warmHabM, px, f + 0.795, pz, 'console');
      top.rotation.y = -am;
      const strip = place(barGroup, box(0.04, 0.03, segLen), warmGlow, (C02_DINING_ARCS.rOuter + 0.03) * Math.cos(am), f + 0.75, (C02_DINING_ARCS.rOuter + 0.03) * Math.sin(am));
      strip.rotation.y = -am;
    }

    // 3 taburetes ergonómicos por barra exactamente sobre C02_DINING_ARCS.stoolRadius (3.92)
    C02_DINING_ARCS.stoolAnglesFromX.forEach((ang) => {
      const sx = sideSign * C02_DINING_ARCS.stoolRadius * Math.cos(ang);
      const sz = C02_DINING_ARCS.stoolRadius * Math.sin(ang);
      place(gDeck, cyl(0.06, 0.14, 0.48, 12), steelM, sx, f + 0.24, sz, 'console');
      place(gDeck, torus(0.18, 0.016, 6, 16), steelM, sx, f + 0.18, sz).rotation.x = Math.PI / 2;
      place(gDeck, cyl(0.24, 0.22, 0.09, 16), bedM, sx, f + 0.51, sz, 'console');
    });
  });

  // Dispensador Hidratación H2O ('galley') en extremo proa de la barra Estribor (+X, -Z)
  const galleyGroup = new THREE.Group();
  galleyGroup.position.set(2.68, f + 0.83, -1.52);
  galleyGroup.rotation.y = -0.52;
  gDeck.add(galleyGroup);
  const hydBody = place(galleyGroup, rbox(0.46, 0.62, 0.42, 0.03), slateM, 0, 0.31, 0);
  place(galleyGroup, box(0.32, 0.28, 0.06), darkM, 0, 0.26, -0.19);
  const spoutA = place(galleyGroup, cyl(0.025, 0.025, 0.09, 8), steelM, -0.07, 0.44, -0.2);
  const spoutB = place(galleyGroup, cyl(0.025, 0.025, 0.09, 8), cyanGlow, 0.07, 0.44, -0.2);
  place(galleyGroup, cyl(0.055, 0.045, 0.13, 12), whiteCeramicM, 0.07, 0.17, -0.2);
  const hydrationStreamMesh = place(
    galleyGroup,
    cyl(0.018, 0.018, 0.2, 8),
    trackMat(new THREE.MeshBasicMaterial({ color: 0x38bdf8 })),
    0.07,
    0.31,
    -0.2,
    null,
    true
  );
  hydrationStreamMesh.visible = false;
  const galleyScreenTex = makeDiegeticScreenTexture('galley', 'COMEDOR Y H₂O · C02', ['DISPENSADOR MINERAL', 'AGUA FRÍA / CALIENTE', 'PULSA [E] PARA DISPENSAR'], '#ffc66d');
  trackTex(galleyScreenTex.tex);
  const galleyScrMat = trackMat(new THREE.MeshBasicMaterial({ map: galleyScreenTex.tex }));
  const galleyScrMesh = place(galleyGroup, box(0.38, 0.2, 0.03), galleyScrMat, 0, 0.56, -0.215);
  galleyScrMesh.rotation.x = 0.2;
  regInteract(hydBody, 'galley', 'direct');
  regInteract(spoutA, 'galley', 'direct');
  regInteract(spoutB, 'galley', 'direct');
  regInteract(galleyScrMesh, 'galley', 'direct');
  handledStationIds.add('galley');
  stationScreenMeshes.galley = galleyScrMesh;
  screenUpdates.galley = (t, l, m) => galleyScreenTex.redraw(t, l, '#ffc66d', m);

  // Sintetizador de Café y Raciones ('galley-synth') en extremo popa de la barra Estribor (+X, +Z)
  const synthGroup = new THREE.Group();
  synthGroup.position.set(2.68, f + 0.83, 1.52);
  synthGroup.rotation.y = 0.52;
  gDeck.add(synthGroup);
  const synthBody = place(synthGroup, rbox(0.52, 0.58, 0.44, 0.03), darkM, 0, 0.29, 0);
  const synthLedMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x64748b }));
  const synthLed = place(synthGroup, box(0.32, 0.05, 0.04), synthLedMat, 0, 0.5, -0.22);
  const synthCup = place(synthGroup, cyl(0.055, 0.048, 0.12, 12), copperM, -0.08, 0.16, -0.19);
  place(synthGroup, box(0.18, 0.04, 0.16), foodPouchMat, 0.12, 0.12, -0.19);
  const synthTex = makeDiegeticScreenTexture('galley-synth', 'SINTETIZADOR CULINARIO', ['CAFÉ ESPACIAL & RACIONES', 'LISTO EN C02', 'PULSA [E] PARA PREPARAR'], '#fbbf24');
  trackTex(synthTex.tex);
  const synthScr = place(synthGroup, box(0.42, 0.2, 0.03), trackMat(new THREE.MeshBasicMaterial({ map: synthTex.tex })), 0, 0.36, -0.225);
  regInteract(synthBody, 'galley-synth', 'direct');
  regInteract(synthCup, 'galley-synth', 'direct');
  regInteract(synthLed, 'galley-synth', 'direct');
  regInteract(synthScr, 'galley-synth', 'direct');
  handledStationIds.add('galley-synth');
  stationScreenMeshes['galley-synth'] = synthScr;
  screenUpdates['galley-synth'] = (t, l, m) => synthTex.redraw(t, l, '#fbbf24', m);

  // Consola Ambiental y Lounge Holográfico en barra Babor (-X)
  const loungeGroup = new THREE.Group();
  loungeGroup.position.set(-2.85, f + 0.83, 0.0);
  gDeck.add(loungeGroup);
  const loungeBase = place(loungeGroup, rbox(0.48, 0.12, 0.82, 0.03), darkScreenFrameM, 0, 0.06, 0);
  const loungeEqualizerMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xa78bfa }));
  const loungeBars = [-0.22, -0.11, 0.0, 0.11, 0.22].map((bz, idx) =>
    place(loungeGroup, box(0.05, 0.14 + (idx % 3) * 0.05, 0.05), loungeEqualizerMat, 0.14, 0.16, bz, null, true)
  );
  const loungeTex = makeDiegeticScreenTexture('lounge-audio-c02', 'LOUNGE AMBIENTAL C02', ['ACÚSTICA CIRCADIANA', 'ARMONÍA ORBITAL', 'PULSA [E] PARA ALTERNAR'], '#a78bfa');
  trackTex(loungeTex.tex);
  const loungeScr = place(loungeGroup, box(0.04, 0.28, 0.56), trackMat(new THREE.MeshBasicMaterial({ map: loungeTex.tex })), -0.06, 0.26, 0);
  loungeScr.rotation.z = -0.34;
  regInteract(loungeBase, 'lounge-audio-c02', 'direct');
  regInteract(loungeScr, 'lounge-audio-c02', 'direct');
  loungeBars.forEach((b) => regInteract(b, 'lounge-audio-c02', 'direct'));
  handledStationIds.add('lounge-audio-c02');
  stationScreenMeshes['lounge-audio-c02'] = loungeScr;
  screenUpdates['lounge-audio-c02'] = (t, l, m) => loungeTex.redraw(t, l, '#a78bfa', m);

  // =========================================================================
  // 4. INVERNADERO BIOPÓNICO A POPA (+Z · Sector k=4)
  // Bastidores altos exactamente en x = ±2.55, z = +11.4
  // =========================================================================
  const bioBay = new THREE.Group();
  bioBay.name = 'BioponicsBayAssembly';
  gDeck.add(bioBay);
  const bioponicLightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x7effb2 }));

  [-2.55, 2.55].forEach((bx) => {
    place(bioBay, box(0.86, 2.58, 4.18), slateM, bx, f + 1.29, 11.4, 'wall');
    place(bioBay, cyl(0.14, 0.14, 2.38, 12), copperM, bx + (bx > 0 ? 0.34 : -0.34), f + 1.19, 13.3);
    [0.54, 1.28, 2.02].forEach((tierY, tierIdx) => {
      place(bioBay, box(0.74, 0.08, 3.88), darkM, bx, f + tierY, 11.4);
      const lamp = place(bioBay, box(0.56, 0.045, 3.68), bioponicLightMat, bx, f + tierY + 0.36, 11.4);
      regInteract(lamp, 'bioponics', 'direct');
      for (let p = -1.52; p <= 1.54; p += 0.44) {
        place(
          bioBay,
          sph(0.155, 9, 7),
          (tierIdx + Math.round(p * 3)) % 2 === 0 ? foliageMat : vegRedMat,
          bx + (bx > 0 ? -0.14 : 0.14),
          f + tierY + 0.15,
          11.4 + p
        );
      }
    });
    const bioGlass = place(bioBay, box(0.04, 2.15, 3.92), glassM, bx + (bx > 0 ? -0.45 : 0.45), f + 1.26, 11.4);
    regInteract(bioGlass, 'bioponics', 'direct');
  });

  // Pedestal central de telemetría botánica en (0, 0, +12.85)
  const bioConsoleBase = place(bioBay, rbox(0.76, 0.96, 0.72, 0.04), darkM, 0, f + 0.48, 12.85, 'console');
  const bioScreenTex = makeDiegeticScreenTexture('bioponics', 'INVERNADERO BIOPÓNICO', ['CULTIVOS HIDROPÓNICOS C02', 'ESPECTRO 445nm', 'PULSA [E] PARA ALTERNAR'], '#45e89e');
  trackTex(bioScreenTex.tex);
  const bioScreenMesh = place(bioBay, box(0.68, 0.42, 0.05), trackMat(new THREE.MeshBasicMaterial({ map: bioScreenTex.tex })), 0, f + 1.24, 12.64);
  bioScreenMesh.rotation.x = 0.32;
  regInteract(bioConsoleBase, 'bioponics', 'direct');
  regInteract(bioScreenMesh, 'bioponics', 'direct');
  handledStationIds.add('bioponics');
  stationScreenMeshes.bioponics = bioScreenMesh;
  screenUpdates.bioponics = (t, l, m) => bioScreenTex.redraw(t, l, '#45e89e', m);
  mountDeckPlacard?.(gDeck, 0, f + 2.66, 13.75, Math.PI, 'BIO', 'INVERNADERO BIOPÓNICO', 'SOPORTE VITAL HIDROPÓNICO', '#45e89e');

  // =========================================================================
  // 5. ESCLUSA EVA A PROA (-Z · Sector k=0)
  // Escotilla en z = -15.96 + Trajes en vitrinas (±2.35, 0, -15.35)
  // =========================================================================
  const airlockBeaconMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
  const airlockRing = place(gDeck, torus(1.22, 0.14, 12, 32), darkM, 0, f + 1.46, -15.96, 'wall');
  const airlockHatch = place(gDeck, cyl(1.12, 1.12, 0.16, 28), doorM, 0, f + 1.46, -16.02, 'wall');
  airlockHatch.rotation.x = Math.PI / 2;
  place(gDeck, box(2.85, 2.75, 0.22), wallM, 0, f + 1.38, -16.12, 'wall');
  place(gDeck, box(0.14, 0.56, 0.08), airlockBeaconMat, 1.34, f + 1.72, -15.9);
  place(gDeck, box(0.14, 0.56, 0.08), airlockBeaconMat, -1.34, f + 1.72, -15.9);

  // Dos vitrinas iluminadas de trajes EVA en (±2.35, 0, -15.35)
  [-2.35, 2.35].forEach((sx) => {
    place(gDeck, rbox(0.84, 2.32, 0.8, 0.03), slateM, sx, f + 1.16, -15.35, 'console');
    place(gDeck, sph(0.21, 14, 10), goldM, sx, f + 1.66, -15.22);
    place(gDeck, box(0.44, 0.54, 0.28), cushionCreamM, sx, f + 1.2, -15.24);
    place(gDeck, box(0.32, 0.44, 0.22), copperM, sx, f + 1.24, -15.4);
    place(gDeck, box(0.76, 1.98, 0.04), glassM, sx, f + 1.18, -14.94);
  });

  const airlockValvePivot = new THREE.Group();
  airlockValvePivot.position.set(-0.62, f + 1.36, -15.86);
  gDeck.add(airlockValvePivot);
  const airlockWheel = place(airlockValvePivot, torus(0.19, 0.032, 8, 22), railAmberM, 0, 0, 0, null, true);
  regInteract(airlockWheel, 'airlock', 'direct');
  regInteract(airlockHatch, 'airlock', 'direct');
  regInteract(airlockRing, 'airlock', 'direct');

  const airlockScrTex = makeDiegeticScreenTexture('airlock', 'ESCLUSA RADIAL EVA · PROA', ['PRESIÓN: 101.3 kPa', 'INTERBLOQUEO ACTIVO', 'PULSA [E] PARA CICLAR'], '#5be3aa');
  trackTex(airlockScrTex.tex);
  const airlockScrMesh = place(gDeck, box(0.68, 0.42, 0.04), trackMat(new THREE.MeshBasicMaterial({ map: airlockScrTex.tex })), 0.85, f + 1.44, -15.86);
  regInteract(airlockScrMesh, 'airlock', 'direct');
  handledStationIds.add('airlock');
  stationScreenMeshes.airlock = airlockScrMesh;
  screenUpdates.airlock = (t, l, m) => airlockScrTex.redraw(t, l, '#5be3aa', m);
  mountDeckPlacard?.(gDeck, 0, f + 2.68, -15.82, 0, 'EVA', 'ESCLUSA RADIAL DE PROA', 'PRESURIZACIÓN Y TRAJES', '#5be3aa');

  // =========================================================================
  // 6. TAQUILLA ESTANCA EVA EN PASILLO PROA-BABOR (`storage-c02`)
  // En bahía 5 (k=7): radial = 6.62, tangent = -2.05 (despeja puerta HAB-06)
  // =========================================================================
  const bay5 = C02_CABIN_BAYS[5];
  const storageGroup = new THREE.Group();
  storageGroup.name = 'StorageLockerC02';
  storageGroup.position.set(bay5.ux * 6.62 + bay5.px * -2.05, f, bay5.uz * 6.62 + bay5.pz * -2.05);
  storageGroup.rotation.y = -bay5.angleRad; // +Z local mira hacia el centro del pasillo
  gDeck.add(storageGroup);

  place(storageGroup, rbox(1.12, 2.02, 0.56, 0.03), slateM, 0, 1.01, -0.04, 'console');
  place(storageGroup, box(0.98, 1.76, 0.44), darkM, 0, 1.02, 0.02);
  place(storageGroup, box(0.94, 0.04, 0.4), steelM, 0, 1.1, 0.04);
  place(storageGroup, cyl(0.11, 0.11, 0.68, 12), railAmberM, -0.26, 0.62, 0.1);
  place(storageGroup, cyl(0.11, 0.11, 0.68, 12), cyanGlow, 0.02, 0.62, 0.1);
  place(storageGroup, rbox(0.34, 0.26, 0.28, 0.02), greenGlow, 0.24, 1.38, 0.08);
  place(storageGroup, rbox(0.28, 0.16, 0.2, 0.02), foodPouchMat, 0.24, 0.68, 0.08);

  const storageDoorPivot = new THREE.Group();
  storageDoorPivot.position.set(-0.5, 1.01, 0.24);
  storageDoorPivot.userData.dynamicTransform = true;
  storageGroup.add(storageDoorPivot);
  const storageLeaf = place(storageDoorPivot, rbox(1.0, 1.8, 0.07, 0.02), doorM, 0.5, 0, 0, null, true);
  const storageHandle = place(storageDoorPivot, box(0.14, 0.36, 0.1), cyanGlow, 0.88, 0.06, 0.02, null, true);
  regInteract(storageLeaf, 'storage-c02', 'direct');
  regInteract(storageHandle, 'storage-c02', 'direct');

  const storageScrTex = makeDiegeticScreenTexture('storage-c02', 'ALMACÉN EVA · C02', ['TAQUILLA ESTANCA', 'BOTIQUÍN Y CÉLULA O₂', 'PULSA [E] PARA ABRIR'], '#67e8f9');
  trackTex(storageScrTex.tex);
  const storageScr = place(storageGroup, box(0.56, 0.34, 0.03), trackMat(new THREE.MeshBasicMaterial({ map: storageScrTex.tex })), 0, 1.62, 0.29);
  regInteract(storageScr, 'storage-c02', 'direct');
  handledStationIds.add('storage-c02');
  stationScreenMeshes['storage-c02'] = storageScr;
  screenUpdates['storage-c02'] = (t, l, m) => storageScrTex.redraw(t, l, '#67e8f9', m);

  // =========================================================================
  // 7. LAS 6 HABITACIONES / SUITES HABITABLES (`HAB-01` .. `HAB-06`)
  // rotation.y = -bay.angleRad -> +X local = tangente (p), -Z local = radial (r)
  // =========================================================================
  const suiteControllers = [];

  C02_HAB_SUITES.forEach((suite, idx) => {
    const bay = C02_CABIN_BAYS[suite.bayIndex];
    const gBay = new THREE.Group();
    gBay.name = `HabitacionalSuite_${suite.code}`;
    gBay.rotation.y = -bay.angleRad;
    gDeck.add(gBay);

    const accentMat = trackMat(new THREE.MeshBasicMaterial({ color: suite.accentHex }));
    const accentHexStr = `#${suite.accentHex.toString(16).padStart(6, '0')}`;
    const blanketMat = trackMat(new THREE.MeshStandardMaterial({ color: suite.blanketHex, roughness: 0.84 }));
    const pillowMat = trackMat(new THREE.MeshStandardMaterial({ color: suite.pillowHex, roughness: 0.78 }));

    // A) Alfombra textil de la habitación y umbral de portal (r = 7.0 m, apertura libre [-1.18, +1.18])
    place(gBay, box(4.6, 0.015, 7.6), carpetM, 0, f + 0.008, -11.95);
    place(gBay, box(2.42, 0.02, 0.14), accentMat, 0, f + 0.015, -7.0);

    // Muros frontales izquierdo y derecho sellados hasta mamparos radiales (±2.92 m)
    place(gBay, box(1.78, 2.98, 0.24), wallM, -2.06, f + 1.49, -7.0, 'wall');
    place(gBay, box(1.78, 2.98, 0.24), wallM, 2.06, f + 1.49, -7.0, 'wall');
    place(gBay, box(2.56, 0.58, 0.26), darkM, 0, f + 2.69, -7.0);
    // Jambas metálicas del portal amplio (2.36 m ancho × 2.40 m alto)
    [-1.22, 1.22].forEach((jx) => {
      place(gBay, rbox(0.12, 2.42, 0.28, 0.02), slateM, jx, f + 1.21, -7.0);
    });

    // Placa identificativa iluminada sobre el dintel exterior (hacia el pasillo)
    const signTex = trackTex(makeDeckSignTexture(suite.code, suite.name.toUpperCase(), suite.crewRole, accentHexStr));
    const signMat = trackMat(new THREE.MeshBasicMaterial({ map: signTex }));
    const doorSign = place(gBay, box(1.86, 0.36, 0.04), signMat, 0, f + 2.64, -6.85);
    regInteract(doorSign, suite.doorId, 'direct');

    // Paneles táctiles exteriores e interiores de puerta corrediza privada (`door-hab-01..06`)
    const doorPadOuter = place(gBay, rbox(0.2, 0.34, 0.05, 0.015), darkScreenFrameM, 1.38, f + 1.28, -6.86);
    const doorLedOuterMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
    const doorLedOuter = place(gBay, box(0.11, 0.18, 0.02), doorLedOuterMat, 1.38, f + 1.28, -6.83);
    const doorPadInner = place(gBay, rbox(0.2, 0.34, 0.05, 0.015), darkScreenFrameM, -1.38, f + 1.28, -7.14);
    const doorLedInner = place(gBay, box(0.11, 0.18, 0.02), doorLedOuterMat, -1.38, f + 1.28, -7.17);
    regInteract(doorPadOuter, suite.doorId, 'direct');
    regInteract(doorLedOuter, suite.doorId, 'direct');
    regInteract(doorPadInner, suite.doorId, 'direct');
    regInteract(doorLedInner, suite.doorId, 'direct');

    // Hojas corredizas translúcidas de puerta privada (abren en ±1.72, cierran en ±0.59)
    const doorLeft = new THREE.Group();
    doorLeft.position.set(-1.72, f + 1.2, -7.0);
    doorLeft.userData.dynamicTransform = true;
    gBay.add(doorLeft);
    const dLeafL = place(doorLeft, rbox(1.16, 2.34, 0.07, 0.02), frostedDoorM, 0, 0, 0, null, true);
    place(doorLeft, box(0.08, 2.34, 0.085), darkM, 0.54, 0, 0, null, true);

    const doorRight = new THREE.Group();
    doorRight.position.set(1.72, f + 1.2, -7.0);
    doorRight.userData.dynamicTransform = true;
    gBay.add(doorRight);
    const dLeafR = place(doorRight, rbox(1.16, 2.34, 0.07, 0.02), frostedDoorM, 0, 0, 0, null, true);
    place(doorRight, box(0.08, 2.34, 0.085), darkM, -0.54, 0, 0, null, true);
    regInteract(dLeafL, suite.doorId, 'direct');
    regInteract(dLeafR, suite.doorId, 'direct');

    // B) Techo luminoso circadiano del camarote + Ventanal panorámico exterior (r = 17.35) + Credenza (r = 16.75)
    const ceilHalo = place(gBay, torus(1.9, 0.04, 6, 32), warmGlow, 0, f + 2.86, -13.6);
    ceilHalo.rotation.x = Math.PI / 2;

    // Ventanal exterior curvo de habitación mirando al cosmos
    place(gBay, rbox(2.55, 0.16, 0.36, 0.03), darkM, 0, f + 1.0, -17.3);
    place(gBay, rbox(2.55, 0.16, 0.36, 0.03), darkM, 0, f + 2.32, -17.3);
    [-1.24, 0, 1.24].forEach((mx) => place(gBay, box(0.1, 1.32, 0.28), darkM, mx, f + 1.66, -17.32));
    place(gBay, box(2.42, 1.18, 0.03), glassM, 0, f + 1.66, -17.34);

    // Credenza baja bajo ventanal exterior (r = 16.75, p = 0, sólida según collider 0.28×1.05)
    place(gBay, rbox(2.02, 0.72, 0.52, 0.03), walnutM, 0, f + 0.36, -16.75, 'console');
    place(gBay, rbox(2.08, 0.06, 0.56, 0.02), oakWoodM, 0, f + 0.74, -16.75);
    place(gBay, cyl(0.11, 0.09, 0.22, 10), foliageMat, 0.65, f + 0.89, -16.75);

    // C) LITERA / CAMA DE DESCANSO INTERACTIVA (`bed-hab-01..06`) en centro radial (r = 14.1, p = 0)
    const bedGroup = new THREE.Group();
    bedGroup.position.set(0, f, -14.1);
    gBay.add(bedGroup);

    const bedFrame = place(bedGroup, rbox(1.16, 0.34, 2.42, 0.04), oakWoodM, 0, 0.17, 0, 'console');
    const underBedGlowMat = trackMat(new THREE.MeshBasicMaterial({ color: suite.accentHex }));
    place(bedGroup, box(1.06, 0.025, 2.24), underBedGlowMat, 0, 0.04, 0);
    const mattress = place(bedGroup, rbox(1.06, 0.19, 2.28, 0.06), cushionCreamM, 0, 0.43, 0, 'console');
    const blanket = place(bedGroup, rbox(1.09, 0.09, 1.62, 0.04), blanketMat, 0, 0.53, 0.31);
    const pillow = place(bedGroup, rbox(0.76, 0.13, 0.4, 0.05), pillowMat, 0, 0.56, -0.82);
    const headboard = place(bedGroup, rbox(1.24, 1.05, 0.14, 0.04), slateM, 0, 0.62, -1.16, 'console');
    place(bedGroup, rbox(1.12, 0.58, 0.08, 0.03), quiltedM, 0, 0.76, -1.08);
    // Cinta de sujeción EVA en microgravedad (a media manta)
    place(bedGroup, box(1.12, 0.025, 0.11), darkM, 0, 0.578, 0.22);

    const bedScreenTex = makeDiegeticScreenTexture(
      suite.bedId,
      `${suite.code} · LITERA DE DESCANSO`,
      ['CONFORT CIRCADIANO: 100%', 'ESTADO: DISPONIBLE', 'PULSA [E] PARA ACOSTARSE'],
      accentHexStr
    );
    trackTex(bedScreenTex.tex);
    const bedHeadMonitor = place(
      bedGroup,
      box(0.54, 0.22, 0.03),
      trackMat(new THREE.MeshBasicMaterial({ map: bedScreenTex.tex })),
      0,
      1.18,
      -1.08
    );

    [bedFrame, mattress, blanket, pillow, headboard, bedHeadMonitor].forEach((m) =>
      regInteract(m, suite.bedId, 'direct')
    );
    handledStationIds.add(suite.bedId);
    stationScreenMeshes[suite.bedId] = bedHeadMonitor;
    screenUpdates[suite.bedId] = (t, l, m) => bedScreenTex.redraw(t, l, accentHexStr, m);

    // D) MESITA DE NOCHE + LÁMPARA CIRCADIANA INTERACTIVA (`lamp-hab-01..06`, r = 14.85, p = +0.96)
    const lampGroup = new THREE.Group();
    lampGroup.position.set(0.94, f, -14.85);
    gBay.add(lampGroup);
    place(lampGroup, rbox(0.46, 0.48, 0.44, 0.03), walnutM, 0, 0.24, 0);
    place(lampGroup, cyl(0.09, 0.11, 0.05, 14), steelM, 0, 0.5, 0);
    place(lampGroup, cyl(0.022, 0.022, 0.28, 10), steelM, 0, 0.64, 0);
    const lampShadeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffdfad,
        emissive: 0xffc66d,
        emissiveIntensity: 0.92,
        roughness: 0.4,
      })
    );
    const lampShade = place(lampGroup, cyl(0.11, 0.16, 0.19, 16), lampShadeMat, 0, 0.82, 0);
    const lampSwitch = place(lampGroup, box(0.14, 0.04, 0.14), accentMat, -0.14, 0.495, 0.12);
    regInteract(lampShade, suite.lampId, 'direct');
    regInteract(lampSwitch, suite.lampId, 'direct');

    // E) ARMARIO / VESTIDOR PERSONAL ABRIBLE (`locker-hab-01..06`, r = 15.2, p = -2.45)
    const wardrobe = new THREE.Group();
    wardrobe.position.set(-2.45, f, -15.2);
    wardrobe.rotation.y = 0.28;
    gBay.add(wardrobe);
    place(wardrobe, rbox(1.18, 2.24, 0.84, 0.03), slateM, 0, 1.12, -0.05, 'wall');
    place(wardrobe, box(1.04, 2.02, 0.72), darkM, 0, 1.12, 0.02);
    // Ropa / mono orbital colgado en barra interior
    place(wardrobe, cyl(0.02, 0.02, 0.96, 8), steelM, 0, 1.92, 0.04).rotation.z = Math.PI / 2;
    place(wardrobe, rbox(0.28, 0.72, 0.2, 0.03), blanketMat, -0.22, 1.46, 0.04);
    place(wardrobe, rbox(0.28, 0.72, 0.2, 0.03), pillowMat, 0.14, 1.46, 0.04);
    place(wardrobe, sph(0.15, 10, 8), whiteCeramicM, 0.22, 0.74, 0.06);

    const lockerPivot = new THREE.Group();
    lockerPivot.position.set(-0.54, 1.12, 0.37);
    lockerPivot.userData.dynamicTransform = true;
    wardrobe.add(lockerPivot);
    const lockerDoorMesh = place(lockerPivot, rbox(1.08, 2.06, 0.06, 0.02), oakWoodM, 0.54, 0, 0, null, true);
    const lockerHandleMesh = place(lockerPivot, box(0.06, 0.38, 0.08), accentMat, 0.96, 0, 0.035, null, true);
    regInteract(lockerDoorMesh, suite.lockerId, 'direct');
    regInteract(lockerHandleMesh, suite.lockerId, 'direct');

    // F) ESCRITORIO DE CAMAROTE + TABLETA / BITÁCORA DIEGÉTICA (`tablet-hab-01..06`, r = 12.2, p = +2.35)
    const deskGroup = new THREE.Group();
    deskGroup.position.set(2.35, f, -12.2);
    deskGroup.rotation.y = -Math.PI * 0.42;
    gBay.add(deskGroup);
    place(deskGroup, rbox(1.48, 0.07, 0.84, 0.025), oakWoodM, 0, 0.76, 0, 'console');
    place(deskGroup, box(0.08, 0.75, 0.76), darkM, -0.66, 0.375, 0, 'console');
    place(deskGroup, box(0.08, 0.75, 0.76), darkM, 0.66, 0.375, 0, 'console');
    // Silla giratoria de escritorio
    place(deskGroup, cyl(0.22, 0.22, 0.07, 14), slateM, 0, 0.48, 0.58);
    place(deskGroup, cyl(0.045, 0.14, 0.45, 10), steelM, 0, 0.23, 0.58);
    place(deskGroup, rbox(0.42, 0.44, 0.06, 0.02), quiltedM, 0, 0.74, 0.78);
    // Cuadro orbital Tierra en pared sobre el escritorio
    if (earthPhotoMat && idx % 2 === 0) {
      place(deskGroup, box(0.76, 0.76, 0.04), walnutM, -0.15, 1.56, -0.34);
      place(deskGroup, box(0.66, 0.66, 0.02), earthPhotoMat, -0.15, 1.56, -0.315);
    }

    const tabletTex = makeDiegeticScreenTexture(
      suite.tabletId,
      `BITÁCORA · ${suite.code}`,
      [`OCUPANTE: ${suite.occupant.toUpperCase()}`, 'TEMP: 21.4°C · 101.3 kPa', 'PULSA [E] PARA VER BITÁCORA'],
      accentHexStr
    );
    trackTex(tabletTex.tex);
    const tabletFrame = place(deskGroup, rbox(0.56, 0.36, 0.04, 0.015), darkScreenFrameM, 0, 0.98, -0.18);
    tabletFrame.rotation.x = -0.28;
    const tabletScr = place(deskGroup, box(0.5, 0.3, 0.02), trackMat(new THREE.MeshBasicMaterial({ map: tabletTex.tex })), 0, 0.985, -0.16);
    tabletScr.rotation.x = -0.28;
    regInteract(tabletFrame, suite.tabletId, 'direct');
    regInteract(tabletScr, suite.tabletId, 'direct');

    // G) NICHO ESPECIALIZADO ÚNICO EN ZONA IZQUIERDA (r = 12.2, p = -2.35)
    const alcoveGroup = new THREE.Group();
    alcoveGroup.position.set(-2.35, f, -12.2);
    alcoveGroup.rotation.y = Math.PI * 0.42;
    gBay.add(alcoveGroup);

    const specParts = { kind: suite.specialtyId };
    if (suite.specialtyId === 'aurora-trophy-c02') {
      const ped = place(alcoveGroup, rbox(0.86, 0.92, 0.86, 0.04), slateM, 0, 0.46, 0, 'console');
      const holoMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x38d8ff, wireframe: true, transparent: true, opacity: 0.78 }));
      const modelGroup = new THREE.Group();
      modelGroup.position.set(0, 1.24, 0);
      modelGroup.userData.dynamicTransform = true;
      alcoveGroup.add(modelGroup);
      place(modelGroup, torus(0.32, 0.04, 8, 24), holoMat, 0, 0, 0, null, true).rotation.x = Math.PI / 2;
      place(modelGroup, sph(0.16, 12, 8), holoMat, 0, 0, 0, null, true);
      place(modelGroup, box(0.14, 0.08, 0.48), holoMat, 0, 0, 0.15, null, true);
      regInteract(ped, suite.specialtyId, 'direct');
      modelGroup.children.forEach((c) => regInteract(c, suite.specialtyId, 'direct'));
      specParts.holoModel = modelGroup;
      specParts.holoMat = holoMat;
    } else if (suite.specialtyId === 'orrery-hab-02') {
      const ped = place(alcoveGroup, cyl(0.46, 0.54, 0.88, 20), walnutM, 0, 0.44, 0, 'console');
      const orreryGroup = new THREE.Group();
      orreryGroup.position.set(0, 1.26, 0);
      orreryGroup.userData.dynamicTransform = true;
      alcoveGroup.add(orreryGroup);
      const starCore = place(orreryGroup, sph(0.11, 14, 10), amberGlow, 0, 0, 0, null, true);
      const ringA = place(orreryGroup, torus(0.24, 0.015, 6, 24), goldM, 0, 0, 0, null, true);
      const ringB = place(orreryGroup, torus(0.36, 0.015, 6, 28), cyanGlow, 0, 0, 0, null, true);
      ringA.rotation.x = 0.6;
      ringB.rotation.x = -0.7;
      regInteract(ped, suite.specialtyId, 'direct');
      [starCore, ringA, ringB].forEach((m) => regInteract(m, suite.specialtyId, 'direct'));
      specParts.orreryGroup = orreryGroup;
    } else if (suite.specialtyId === 'med-bay-c02') {
      const medCabinet = place(alcoveGroup, rbox(1.18, 1.48, 0.72, 0.04), whiteCeramicM, 0, 0.74, 0, 'console');
      const medArcMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x45e89e }));
      const scanRing = place(alcoveGroup, torus(0.38, 0.04, 8, 28), medArcMat, 0, 1.62, 0.06, null, true);
      const medTex = makeDiegeticScreenTexture('med-bay-c02', 'MED-BAY · BIOMETRÍA', ['RITMO: 64 BPM · O₂ 99%', 'DOSIMETRÍA NOMINAL', 'PULSA [E] PARA ESCANEAR'], '#45e89e');
      trackTex(medTex.tex);
      const medScr = place(alcoveGroup, box(0.74, 0.44, 0.04), trackMat(new THREE.MeshBasicMaterial({ map: medTex.tex })), 0, 1.24, 0.37);
      regInteract(medCabinet, suite.specialtyId, 'direct');
      regInteract(scanRing, suite.specialtyId, 'direct');
      regInteract(medScr, suite.specialtyId, 'direct');
      handledStationIds.add(suite.specialtyId);
      stationScreenMeshes[suite.specialtyId] = medScr;
      screenUpdates[suite.specialtyId] = (t, l, m) => medTex.redraw(t, l, '#45e89e', m);
      specParts.scanRing = scanRing;
      specParts.medArcMat = medArcMat;
    } else if (suite.specialtyId === 'spec-samples-c02') {
      const caseBase = place(alcoveGroup, rbox(1.14, 0.92, 0.68, 0.03), darkM, 0, 0.46, 0, 'console');
      const vitrine = place(alcoveGroup, box(0.96, 0.68, 0.52), glassM, 0, 1.26, 0);
      const emitterMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xb788ff }));
      const specimen = place(alcoveGroup, sph(0.14, 10, 8), emitterMat, 0, 1.18, 0, null, true);
      regInteract(caseBase, suite.specialtyId, 'direct');
      regInteract(vitrine, suite.specialtyId, 'direct');
      regInteract(specimen, suite.specialtyId, 'direct');
      specParts.specimen = specimen;
      specParts.emitterMat = emitterMat;
    } else if (suite.specialtyId === 'gym-c02') {
      // Cicloergómetro Zero-G con volante giratorio e indicador RPM
      const frame = place(alcoveGroup, rbox(0.56, 0.16, 1.24, 0.03), slateM, 0, 0.08, 0, 'console');
      place(alcoveGroup, box(0.12, 0.82, 0.16), darkM, 0, 0.48, -0.34);
      place(alcoveGroup, box(0.56, 0.08, 0.12), steelM, 0, 1.02, -0.34);
      place(alcoveGroup, box(0.1, 0.72, 0.12), darkM, 0, 0.44, 0.34);
      place(alcoveGroup, rbox(0.28, 0.09, 0.32, 0.03), cushionCreamM, 0, 0.84, 0.36);
      const flywheel = place(alcoveGroup, cyl(0.29, 0.29, 0.1, 20), copperM, 0, 0.46, -0.38, null, true);
      flywheel.rotation.z = Math.PI / 2;
      const gymTex = makeDiegeticScreenTexture('gym-c02', 'CICLOERGÓMETRO ZERO-G', ['CARGA MAGNÉTICA: 180W', 'ESTADO: EN ESPERA', 'PULSA [E] PARA ENTRENAR'], '#ffb347');
      trackTex(gymTex.tex);
      const gymScr = place(alcoveGroup, box(0.38, 0.24, 0.04), trackMat(new THREE.MeshBasicMaterial({ map: gymTex.tex })), 0, 1.16, -0.32);
      gymScr.rotation.x = -0.35;
      regInteract(frame, suite.specialtyId, 'direct');
      regInteract(flywheel, suite.specialtyId, 'direct');
      regInteract(gymScr, suite.specialtyId, 'direct');
      handledStationIds.add(suite.specialtyId);
      stationScreenMeshes[suite.specialtyId] = gymScr;
      screenUpdates[suite.specialtyId] = (t, l, m) => gymTex.redraw(t, l, '#ffb347', m);
      specParts.flywheel = flywheel;
    } else if (suite.specialtyId === 'eva-rack-c02') {
      const bench = place(alcoveGroup, rbox(1.16, 0.88, 0.68, 0.03), slateM, 0, 0.44, 0, 'console');
      const helmet = place(alcoveGroup, sph(0.21, 16, 12), whiteCeramicM, -0.22, 1.09, 0);
      const visor = place(alcoveGroup, sph(0.19, 14, 10), goldM, -0.22, 1.09, 0.06);
      const evaLightMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf97316 }));
      const evaBeacon = place(alcoveGroup, cyl(0.08, 0.08, 0.28, 12), evaLightMat, 0.26, 1.04, 0);
      regInteract(bench, suite.specialtyId, 'direct');
      regInteract(helmet, suite.specialtyId, 'direct');
      regInteract(visor, suite.specialtyId, 'direct');
      regInteract(evaBeacon, suite.specialtyId, 'direct');
      specParts.evaLightMat = evaLightMat;
    }

    suiteControllers.push({
      idx,
      suite,
      bay,
      doorLeft,
      doorRight,
      doorLedOuterMat,
      lockerPivot,
      lampShadeMat,
      underBedGlowMat,
      tabletTex,
      bedScreenTex,
      specParts,
      lastTabletHash: '',
      lastBedHash: '',
    });
  });

  // =========================================================================
  // 8. ACTUALIZACIÓN ANIMADA Y TELEMETRÍA EN VIVO
  // =========================================================================
  let lastTabletRefreshAt = -Infinity;

  function update(elapsedTime, mech = {}, astronautPos = null) {
    // Puerta de taquilla EVA corridor (`storage-c02`)
    const targetStorage = mech.storageC02Open ? -Math.PI * 0.58 : 0;
    storageDoorPivot.rotation.y += (targetStorage - storageDoorPivot.rotation.y) * 0.14;

    // Hidratación / Síntesis de café / Biopónica / Esclusa / Lounge
    hydrationStreamMesh.visible = Boolean(mech.hydrationDispensing);
    synthLedMat.color.setHex(mech.galleyCoffeeBrewing ? 0xf59e0b : 0x334155);
    bioponicLightMat.color.setHex(mech.bioponicsActive === false ? 0xa855f7 : 0x7effb2);

    const targetValve = mech.airlockPressurized === false ? Math.PI * 1.35 : 0;
    airlockValvePivot.rotation.z += (targetValve - airlockValvePivot.rotation.z) * 0.12;
    airlockBeaconMat.color.setHex(mech.airlockPressurized === false ? 0xf59e0b : 0x45e89e);

    const loungeActive = mech.loungeMusicActive !== false;
    loungeEqualizerMat.color.setHex(loungeActive ? 0xa78bfa : 0x334155);
    loungeBars.forEach((bar, bIdx) => {
      const targetScaleY = loungeActive
        ? 0.55 + 0.55 * Math.abs(Math.sin(elapsedTime * (2.6 + bIdx * 0.6) + bIdx))
        : 0.25;
      bar.scale.y += (targetScaleY - bar.scale.y) * 0.2;
    });

    // Iluminación compartida cálida dinámica enfocada en la suite más cercana o en descanso
    const activeRestBay = Number.isInteger(mech.restingBayIndex) ? mech.restingBayIndex : -1;
    let lightBayA = activeRestBay >= 0 ? activeRestBay : 0;
    if (activeRestBay < 0 && astronautPos && Math.hypot(astronautPos.x, astronautPos.z) > 6.4) {
      let bestD = Infinity;
      C02_CABIN_BAYS.forEach((b, bi) => {
        const d = Math.hypot(astronautPos.x - b.ux * 12.2, astronautPos.z - b.uz * 12.2);
        if (d < bestD) {
          bestD = d;
          lightBayA = bi;
        }
      });
    }
    const ctrlA = suiteControllers[lightBayA];
    if (ctrlA) {
      const modeA = mech.cabinLamps?.[lightBayA] || 'warm';
      bayAccentLightA.position.set(ctrlA.bay.ux * 12.6, f + 2.35, ctrlA.bay.uz * 12.6);
      if (mech.restingSleepActive) {
        bayAccentLightA.color.setHex(0x60a5fa);
        bayAccentLightA.intensity = 0.38;
      } else if (modeA === 'off') {
        bayAccentLightA.intensity = 0.08;
      } else if (modeA === 'night') {
        bayAccentLightA.color.setHex(0x60a5fa);
        bayAccentLightA.intensity = 0.52;
      } else {
        bayAccentLightA.color.setHex(0xffd28a);
        bayAccentLightA.intensity = 1.15;
      }
    }

    const shouldRefreshTexts = elapsedTime - lastTabletRefreshAt >= 0.75;
    if (shouldRefreshTexts) lastTabletRefreshAt = elapsedTime;

    for (let i = 0; i < suiteControllers.length; i++) {
      const c = suiteControllers[i];
      const doorOpen = mech.cabinDoorsOpen?.[i] !== false;
      const targetDoorOffset = doorOpen ? 1.72 : 0.59;
      c.doorLeft.position.x += (-targetDoorOffset - c.doorLeft.position.x) * 0.16;
      c.doorRight.position.x += (targetDoorOffset - c.doorRight.position.x) * 0.16;
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
      } else if (isNight) {
        c.lampShadeMat.color.setHex(0x93c5fd);
        c.lampShadeMat.emissive.setHex(0x3b82f6);
        c.lampShadeMat.emissiveIntensity = 0.45;
        c.underBedGlowMat.color.setHex(0x3b82f6);
      } else {
        c.lampShadeMat.color.setHex(0xffdfad);
        c.lampShadeMat.emissive.setHex(0xffc66d);
        c.lampShadeMat.emissiveIntensity = 0.95;
        c.underBedGlowMat.color.setHex(c.suite.accentHex);
      }

      // Animaciones únicas por módulo
      const sp = c.specParts;
      if (sp.holoModel) {
        sp.holoModel.visible = mech.auroraHoloActive !== false;
        sp.holoModel.rotation.y = elapsedTime * 0.7;
        sp.holoModel.position.y = 1.24 + Math.sin(elapsedTime * 1.8) * 0.04;
      }
      if (sp.orreryGroup) {
        const rate = mech.orrerySpinFast ? 2.4 : 0.55;
        sp.orreryGroup.rotation.y = elapsedTime * rate;
        sp.orreryGroup.children[2].rotation.z = elapsedTime * rate * 0.7;
      }
      if (sp.scanRing) {
        const scanning = Boolean(mech.medScanActive);
        sp.scanRing.rotation.z = elapsedTime * (scanning ? 2.2 : 0.35);
        sp.scanRing.position.y = 1.62 + (scanning ? Math.sin(elapsedTime * 3.8) * 0.1 : 0);
        sp.medArcMat.color.setHex(scanning ? 0x38d8ff : 0x45e89e);
      }
      if (sp.specimen) {
        const active = Boolean(mech.specSamplesActive);
        sp.specimen.rotation.y = elapsedTime * (active ? 2.5 : 0.5);
        sp.specimen.position.y = 1.18 + Math.sin(elapsedTime * 2.2) * (active ? 0.07 : 0.02);
        sp.emitterMat.color.setHex(active ? 0xe879f9 : 0xb788ff);
      }
      if (sp.flywheel) {
        if (mech.gymWorkoutActive) {
          sp.flywheel.rotation.x += 0.14;
        }
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
            page % 2 === 0
              ? [
                  `${c.suite.name.toUpperCase()}`,
                  `PUERTA: ${doorOpen ? 'ABIERTA' : 'CERRADA'} · LUZ: ${lampMode.toUpperCase()}`,
                  `ARMARIO: ${lockerOpen ? 'ABIERTO' : 'CERRADO'} · ENERGÍA: ${restPct}%`,
                ]
              : [
                  `BITÁCORA: ${c.suite.occupant.toUpperCase()}`,
                  `SECTOR: ${c.suite.specialtyTag} · KRONOX`,
                  `CICLOS DESCANSO: ${Number(mech.restCyclesCompleted || 0)}`,
                ];
          c.tabletTex.redraw(`SUITE ${c.suite.code}`, lines, acc, { tick: elapsedTime });
        }

        const bHash = `${activeRestBay === i}|${mech.restingSleepActive}|${restPct}`;
        if (bHash !== c.lastBedHash) {
          c.lastBedHash = bHash;
          const acc = `#${c.suite.accentHex.toString(16).padStart(6, '0')}`;
          c.bedScreenTex.redraw(
            `${c.suite.code} · LITERA DE DESCANSO`,
            [
              `ENERGÍA TRIPULACIÓN: ${restPct}%`,
              activeRestBay === i ? 'MODO: EN REPOSO CIRCADIANO' : 'ESTADO: LISTA PARA DESCANSAR',
              activeRestBay === i ? 'PULSA [E] PARA LEVANTARSE' : 'PULSA [E] PARA ACOSTARSE',
            ],
            acc,
            { tick: elapsedTime }
          );
        }
      }
    }
  }

  return {
    root: gDeck,
    handledStationIds,
    stationScreenMeshes,
    screenUpdates,
    update,
    dispose: () => {
      extraDisposables.forEach((item) => item?.dispose?.());
    },
  };
}
