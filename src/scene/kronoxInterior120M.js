import * as THREE from 'three';
import {
  CABIN_DECKS,
  HULL_INTERIOR_ZONES,
  SHIP_INTERIOR_STATIONS,
  INTERIOR_GRAB_RAILS,
  clampAstronautPosition,
  findNearestInteractiveStation,
  resolveCurrentDeck,
} from './kronoxInteriorSpatialModel.js';
import {
  createHullPanelTextureSet,
  createDeckGratingTextureSet,
  createThermalQuiltTextureSet,
  createHazardStripeTexture,
  createDiegeticScreenDisplay,
} from './shipInteriorTextures.js';

function createMaterialPalette() {
  const hullTex = createHullPanelTextureSet({ repeatX: 3, repeatY: 2 });
  const darkHullTex = createHullPanelTextureSet({
    baseColor: '#171f2b',
    seamColor: '#0c111a',
    accentColor: '#f59e0b',
    repeatX: 2,
    repeatY: 2,
  });
  const floorTex = createDeckGratingTextureSet({ repeatX: 3, repeatY: 6 });
  const quiltTex = createThermalQuiltTextureSet({ repeatX: 4, repeatY: 2 });
  const hazardTex = createHazardStripeTexture(6);

  return {
    bulkhead: new THREE.MeshStandardMaterial({
      map: hullTex.map,
      bumpMap: hullTex.bumpMap,
      bumpScale: 0.02,
      roughnessMap: hullTex.roughnessMap,
      color: 0xd9e4f2,
      metalness: 0.52,
      roughness: 0.42,
      side: THREE.DoubleSide,
    }),
    darkFrame: new THREE.MeshStandardMaterial({
      map: darkHullTex.map,
      bumpMap: darkHullTex.bumpMap,
      bumpScale: 0.025,
      color: 0x3b485e,
      metalness: 0.72,
      roughness: 0.34,
      side: THREE.DoubleSide,
    }),
    floorDeck: new THREE.MeshStandardMaterial({
      map: floorTex.map,
      bumpMap: floorTex.bumpMap,
      bumpScale: 0.03,
      color: 0xc2d0e2,
      metalness: 0.65,
      roughness: 0.48,
      side: THREE.DoubleSide,
    }),
    thermalQuilt: new THREE.MeshStandardMaterial({
      map: quiltTex.map,
      bumpMap: quiltTex.bumpMap,
      bumpScale: 0.035,
      color: 0xdfe7f2,
      metalness: 0.08,
      roughness: 0.84,
      side: THREE.DoubleSide,
    }),
    hazardTrim: new THREE.MeshStandardMaterial({
      map: hazardTex,
      metalness: 0.3,
      roughness: 0.55,
      side: THREE.DoubleSide,
    }),
    grabRail: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.65,
      roughness: 0.25,
      emissive: 0x451a03,
      emissiveIntensity: 0.25,
    }),
    chromePipe: new THREE.MeshStandardMaterial({
      color: 0xc8d8eb,
      metalness: 0.88,
      roughness: 0.18,
    }),
    copperPipe: new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.82,
      roughness: 0.26,
    }),
    goldFoil: new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.92,
      roughness: 0.22,
    }),
    viewportGlass: new THREE.MeshPhysicalMaterial({
      color: 0x99d9ff,
      transparent: true,
      opacity: 0.11,
      roughness: 0.06,
      metalness: 0.12,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    darkSeat: new THREE.MeshStandardMaterial({
      color: 0x161d29,
      metalness: 0.22,
      roughness: 0.72,
    }),
    accentCyan: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    }),
    accentEmerald: new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
      roughness: 0.25,
    }),
  };
}

function addGrabRail(parent, start, end, radius, mat) {
  const s = new THREE.Vector3(...start);
  const e = new THREE.Vector3(...end);
  const dir = new THREE.Vector3().subVectors(e, s);
  const len = dir.length();
  if (len < 0.05) return null;
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), mat);
  bar.position.copy(s).addScaledVector(dir, 0.5);
  bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.add(bar);

  [0.08, 0.92].forEach((t) => {
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.6, radius * 1.6, 0.06, 10), mat);
    bracket.position.copy(s).addScaledVector(dir, t);
    bracket.quaternion.copy(bar.quaternion);
    g.add(bracket);
  });
  parent.add(g);
  return g;
}

function createMountedConsole(stationDef, mats, options = {}) {
  const { width = 1.65, angleTilt = -0.35, accentHex = 0x38bdf8, waveformMode = 'orbit' } = options;
  const group = new THREE.Group();
  group.name = `Station_${stationDef.id}`;
  group.userData = { stationId: stationDef.id, deckLevel: stationDef.deckLevel };

  const dx = stationDef.position.x - stationDef.consolePos.x;
  const dz = stationDef.position.z - stationDef.consolePos.z;
  const yaw = Math.atan2(dx, dz);
  group.position.set(stationDef.consolePos.x, stationDef.position.y, stationDef.consolePos.z);
  group.rotation.y = yaw;

  // Heavy bolted structural plinth
  const basePlate = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.08, 0.68), mats.darkFrame);
  basePlate.position.y = 0.04;
  group.add(basePlate);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.88, 0.44), mats.darkFrame);
  legL.position.set(-width * 0.34, 0.48, 0);
  legL.rotation.x = 0.14;
  const legR = legL.clone();
  legR.position.x = width * 0.34;
  group.add(legL, legR);

  // Sloped console table & integrated bevelled bezel
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, 0.94, 0.04);
  const deckSlab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.64), mats.bulkhead);
  deskGroup.add(deckSlab);

  const trimBarMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.65,
    roughness: 0.28,
  });
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.03, 0.04), trimBarMat);
  frontLip.position.set(0, 0.02, 0.31);
  deskGroup.add(frontLip);

  // Tactile mechanical control keys / dual mini-throttles on table
  [-width * 0.28, width * 0.28].forEach((kx) => {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.18), mats.darkSeat);
    pad.position.set(kx, 0.055, 0.12);
    deskGroup.add(pad);
  });

  // Monitor housing solidly recessed into desk superstructure (NEVER clipping inside bezel)
  const monitorHolder = new THREE.Group();
  monitorHolder.position.set(0, 0.34, -0.14);
  monitorHolder.rotation.x = angleTilt;

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.56, 0.08), mats.darkFrame);
  monitorHolder.add(bezel);

  const screenDisp = createDiegeticScreenDisplay({
    title: stationDef.label.toUpperCase(),
    subtitle: 'EN LÍNEA · PULSA [E]',
    lines: [
      `SECTOR: ${stationDef.zoneLabel.slice(0, 32)}`,
      `ESTADO: OPERATIVO · MICRO-G`,
      `SISTEMA: KRONOX BUS MÉTRICO`,
    ],
    accent: stationDef.accent || '#38bdf8',
    waveformMode,
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: screenDisp.texture, toneMapped: false });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.76, 0.46), screenMat);
  screenMesh.position.set(0, 0, 0.044);
  monitorHolder.add(screenMesh);

  deskGroup.add(monitorHolder);

  group.add(deskGroup);

  // Overhead holographic proximity halo pedestal ring
  const floorBeacon = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.51, 32),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    }),
  );
  floorBeacon.rotation.x = -Math.PI / 2;
  floorBeacon.position.set(0, 0.02, 1.35);
  group.add(floorBeacon);

  return {
    id: stationDef.id,
    deckLevel: stationDef.deckLevel,
    definition: stationDef,
    group,
    screenMesh,
    trimBarMat,
    floorBeacon,
    updateScreen(subtitle, lines, phase = 0) {
      screenDisp.redraw(stationDef.label.toUpperCase(), subtitle, lines, phase);
    },
  };
}

function buildErgonomicPilotChair(mats) {
  const chair = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.22, 0.46, 16), mats.darkFrame);
  ped.position.y = 0.23;
  chair.add(ped);

  const pan = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.1, 0.52), mats.darkSeat);
  pan.position.set(0, 0.48, 0);
  chair.add(pan);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.74, 0.1), mats.darkSeat);
  back.position.set(0, 0.86, 0.24);
  back.rotation.x = -0.14;
  chair.add(back);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.11), mats.darkFrame);
  head.position.set(0, 1.29, 0.28);
  chair.add(head);

  [-0.31, 0.31].forEach((ax) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.44), mats.darkFrame);
    arm.position.set(ax, 0.66, 0.04);
    chair.add(arm);
  });
  return chair;
}

function buildAirlockBulkhead(zPos, mats, doorsList, width = 3.2, height = 2.9, labelHex = 0x38bdf8) {
  const frame = new THREE.Group();
  frame.position.set(0, 0, zPos);

  const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.32, height, 0.42), mats.darkFrame);
  leftJamb.position.set(-width * 0.5 - 0.14, 0, 0);
  const rightJamb = leftJamb.clone();
  rightJamb.position.x = width * 0.5 + 0.14;
  const topHeader = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.36, 0.42), mats.darkFrame);
  topHeader.position.set(0, height * 0.5, 0);
  const botSill = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.16, 0.48), mats.hazardTrim);
  botSill.position.set(0, -height * 0.5 + 0.05, 0);
  frame.add(leftJamb, rightJamb, topHeader, botSill);

  const statusMat = new THREE.MeshStandardMaterial({
    color: labelHex,
    emissive: labelHex,
    emissiveIntensity: 0.75,
  });
  const statusStrip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.045, 0.46), statusMat);
  statusStrip.position.set(0, height * 0.5 - 0.16, 0);
  frame.add(statusStrip);

  const leafW = width * 0.5;
  const leafL = new THREE.Mesh(new THREE.BoxGeometry(leafW, height - 0.24, 0.12), mats.bulkhead);
  leafL.position.set(-leafW * 0.5, 0, 0);
  const leafR = new THREE.Mesh(new THREE.BoxGeometry(leafW, height - 0.24, 0.12), mats.bulkhead);
  leafR.position.set(leafW * 0.5, 0, 0);
  frame.add(leafL, leafR);

  doorsList.push({
    z: zPos,
    x: 0,
    y: 0,
    leafL,
    leafR,
    halfW: leafW,
    openProgress: 0,
    statusMat,
  });
  return frame;
}

function buildCommandBridgeSector(root, mats, registerConsole) {
  const g = new THREE.Group();
  g.name = 'Sector_Bridge_Deck01';
  const b = HULL_INTERIOR_ZONES.bridgeMain;
  const bridgeLen = b.maxZ - b.minZ; // 6.6m (Z: -48.6 .. -42.0)
  const bridgeW = b.maxX - b.minX; // 8.5m
  const floorY = b.minY; // -1.60m

  // Main deck floor + raised forward prow observation deck
  const mainFloor = new THREE.Mesh(new THREE.BoxGeometry(bridgeW, 0.14, bridgeLen + 0.4), mats.floorDeck);
  mainFloor.position.set(0, floorY - 0.07, (b.minZ + b.maxZ) * 0.5);
  g.add(mainFloor);

  // Tapered Prow Observation Deck (Z: -51.4 .. -48.4) fitting inside hull prowCone
  const prowPts = [
    new THREE.Vector2(-3.8, 0),
    new THREE.Vector2(-2.1, -3.0),
    new THREE.Vector2(2.1, -3.0),
    new THREE.Vector2(3.8, 0),
  ];
  const prowShape = new THREE.Shape(prowPts);
  const prowFloorGeo = new THREE.ExtrudeGeometry(prowShape, { depth: 0.14, bevelEnabled: false });
  prowFloorGeo.rotateX(-Math.PI / 2);
  const prowFloor = new THREE.Mesh(prowFloorGeo, mats.floorDeck);
  prowFloor.position.set(0, floorY - 0.14, -48.4);
  g.add(prowFloor);

  // Lower prow sill / bow instrument coaming (below window line so cosmos view is totally unobstructed!)
  const prowCoaming = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.72, 0.42), mats.darkFrame);
  prowCoaming.position.set(0, floorY + 0.36, -51.3);
  g.add(prowCoaming);

  // Angled Panoramic Bow Framing Ribs (left/right struts converging forward, zero central block!)
  [-1, 1].forEach((side) => {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.7, bridgeLen + 0.4), mats.bulkhead);
    sideWall.position.set(side * (b.maxX + 0.09), 0.75, (b.minZ + b.maxZ) * 0.5);
    g.add(sideWall);

    // Prow tapered angled cheek walls closing cleanly around open central viewport
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.1, 3.35), mats.bulkhead);
    cheek.position.set(side * 3.05, 0.45, -49.85);
    cheek.rotation.y = side * -0.51;
    g.add(cheek);

    // Heavy structural canopy mullion frames flanking panoramic bow window (NOT in center!)
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.1, 0.22), mats.darkFrame);
    mullion.position.set(side * 1.92, 0.85, -51.25);
    mullion.rotation.z = side * 0.12;
    mullion.rotation.x = -0.22;
    g.add(mullion);

    // Architectural indirect light cove bars along upper side bulkheads
    const cove = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, bridgeLen - 0.8), mats.accentCyan);
    cove.position.set(side * (b.maxX - 0.18), 2.35, (b.minZ + b.maxZ) * 0.5);
    g.add(cove);

    addGrabRail(g, [side * 4.05, -0.35, -48.0], [side * 4.05, -0.35, -42.5], 0.028, mats.grabRail);
  });

  // Upper panoramic canopy glaze (translucent sapphire spaceport glass, clear middle aperture!)
  const upperGlaze = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.7), mats.viewportGlass);
  upperGlaze.position.set(0, 0.78, -51.38);
  g.add(upperGlaze);

  // Vaulted ceiling structural arches & overhead cupola bay
  for (let z = -48.2; z <= -42.5; z += 1.9) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8.55, 0.22, 0.28), mats.darkFrame);
    beam.position.set(0, 3.15, z);
    g.add(beam);
  }
  const ceilingPanel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.14, bridgeLen + 0.5), mats.bulkhead);
  ceilingPanel.position.set(0, 3.25, (b.minZ + b.maxZ) * 0.5);
  g.add(ceilingPanel);

  // Aft bulkhead sealing bridge except for central spine doorway
  [-1, 1].forEach((side) => {
    const aftWall = new THREE.Mesh(new THREE.BoxGeometry(2.85, 4.85, 0.24), mats.bulkhead);
    aftWall.position.set(side * 2.95, 0.78, -42.05);
    g.add(aftWall);
  });

  // Curved Pilot Helm Station + Integrated Hologram Emitter + Ergonomic Pilot Chair
  const navDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'nav');
  const navConsole = createMountedConsole(navDef, mats, { width: 2.35, accentHex: 0x6ff0ff, waveformMode: 'orbit' });
  const helmYokeL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.24, 10), mats.darkSeat);
  helmYokeL.position.set(-0.48, 1.08, 0.18);
  helmYokeL.rotation.x = 0.25;
  const helmYokeR = helmYokeL.clone();
  helmYokeR.position.x = 0.48;
  navConsole.group.add(helmYokeL, helmYokeR);

  // Central integrated glass holoprojector dish on helm table
  const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 10, 28), mats.accentCyan);
  holoRing.rotation.x = Math.PI / 2;
  holoRing.position.set(0, 1.0, 0.08);
  navConsole.group.add(holoRing);
  registerConsole(navConsole);
  g.add(navConsole.group);

  const pilotChair = buildErgonomicPilotChair(mats);
  pilotChair.position.set(0.0, floorY, -45.65);
  g.add(pilotChair);

  // Port KRONOX IA Quantum Communications Pedestal & Starboard Tactical Missions Console
  const commsDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'comms');
  const commsConsole = createMountedConsole(commsDef, mats, { width: 1.75, accentHex: 0x38bdf8, waveformMode: 'orbit' });
  const quantRing = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.08, 24), mats.darkFrame);
  quantRing.position.set(0.15, 0.04, 1.05);
  const quantGlow = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.018, 10, 32), mats.accentCyan);
  quantGlow.rotation.x = Math.PI / 2;
  quantGlow.position.set(0.15, 0.09, 1.05);
  commsConsole.group.add(quantRing, quantGlow);
  registerConsole(commsConsole);
  g.add(commsConsole.group);

  const missionsDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'missions');
  const missionsConsole = createMountedConsole(missionsDef, mats, { width: 1.75, accentHex: 0xfbbf24, waveformMode: 'spectrum' });
  registerConsole(missionsConsole);
  g.add(missionsConsole.group);

  // Bow window interaction pedestal (low unobtrusive rail & targeting telemetry strip)
  const winDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'windows');
  const winPedestal = new THREE.Group();
  winPedestal.userData = { stationId: 'windows', deckLevel: 1 };
  const railMesh = addGrabRail(winPedestal, [-1.45, floorY + 0.92, -50.6], [1.45, floorY + 0.92, -50.6], 0.028, mats.grabRail);
  if (railMesh) winPedestal.add(railMesh);
  const winScreenDisp = createDiegeticScreenDisplay({
    title: 'MIRADOR DE PROA',
    subtitle: 'VENTANA ESPACIAL 1:1',
    lines: ['APUNTA CON LA RETÍCULA HACIA EL COSMOS', 'TECLA [T]: TELESCOPIO ÓPTICO'],
    accent: '#38bdf8',
  });
  const winConsole = {
    id: 'windows',
    deckLevel: 1,
    definition: winDef,
    group: winPedestal,
    trimBarMat: mats.accentCyan,
    floorBeacon: new THREE.Mesh(new THREE.RingGeometry(0.4, 0.45, 24), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25, side: THREE.DoubleSide })),
    updateScreen(sub, lns, p) {
      winScreenDisp.redraw('MIRADOR DE PROA', sub, lns, p);
    },
  };
  winConsole.floorBeacon.rotation.x = -Math.PI / 2;
  winConsole.floorBeacon.position.set(0, floorY + 0.02, -49.1);
  winPedestal.add(winConsole.floorBeacon);
  registerConsole(winConsole);
  g.add(winPedestal);

  // Balanced interior lighting inside Bridge (no blown highlights)
  const bridgeLight = new THREE.PointLight(0xd8eeff, 1.45, 16, 1.5);
  bridgeLight.position.set(0, 2.35, -45.8);
  const prowFill = new THREE.PointLight(0x7dd3fc, 0.75, 12, 1.6);
  prowFill.position.set(0, 1.4, -49.5);
  g.add(bridgeLight, prowFill);

  root.add(g);
}

function buildCentralSpineCorridor(root, mats, doorsList) {
  const g = new THREE.Group();
  g.name = 'Sector_CentralSpine';
  const spineLen = 54.4; // Z: -42.0 .. +12.4
  const spineCenterZ = -14.8;

  // Octagonal pressurized spine segments inside r=2.2m outer structural tube
  const tunnelGeo = new THREE.CylinderGeometry(1.78, 1.78, spineLen, 8, 1, true);
  tunnelGeo.rotateX(Math.PI / 2);
  const tunnelShell = new THREE.Mesh(tunnelGeo, mats.bulkhead);
  tunnelShell.position.set(0, 0.0, spineCenterZ);
  g.add(tunnelShell);

  // Continuous grated floor deck along spine (open around ventral airlock hatch Z: -7.5..-4.5 and ramp up to Engineering Z: 9.8..12.6)
  const spineFloorA = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 34.4), mats.floorDeck);
  spineFloorA.position.set(0, -1.52, -24.8); // Z: -42.0 .. -7.6
  const spineFloorB = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 14.3), mats.floorDeck);
  spineFloorB.position.set(0, -1.52, 2.75); // Z: -4.4 .. +9.9
  const spineEngRamp = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 3.1), mats.floorDeck);
  spineEngRamp.position.set(0, -0.92, 11.2);
  spineEngRamp.rotation.x = 0.42;
  g.add(spineFloorA, spineFloorB, spineEngRamp);

  // Under-floor cryo coolant conduits visible along spine edges
  [-0.98, 0.98].forEach((px) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, spineLen, 10), px < 0 ? mats.chromePipe : mats.copperPipe);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(px, -1.35, spineCenterZ);
    g.add(pipe);
  });

  // Structural pressure ribs & indirect LED strip rings every 4m (skipping lateral junction Z=-29, -6, +2.5)
  for (let z = -40; z <= 10; z += 4.0) {
    const isJunction = Math.abs(z - -29) < 2.2 || Math.abs(z - -6) < 2.2 || Math.abs(z - 2.5) < 2.0;
    if (isJunction) continue;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.085, 8, 8), mats.darkFrame);
    rib.position.set(0, 0, z);
    rib.rotation.z = Math.PI / 8;
    g.add(rib);
  }

  // Continuous micro-G anodized yellow grab rails along Port & Starboard
  addGrabRail(g, [-1.34, -0.08, -41.5], [-1.34, -0.08, -30.5], 0.028, mats.grabRail);
  addGrabRail(g, [1.34, -0.08, -41.5], [1.34, -0.08, -30.5], 0.028, mats.grabRail);
  addGrabRail(g, [-1.34, -0.08, -27.5], [-1.34, -0.08, -7.5], 0.028, mats.grabRail);
  addGrabRail(g, [1.34, -0.08, -27.5], [1.34, -0.08, -7.5], 0.028, mats.grabRail);
  addGrabRail(g, [-1.34, -0.08, -4.5], [-1.34, -0.08, 12.0], 0.028, mats.grabRail);
  addGrabRail(g, [1.34, -0.08, -4.5], [1.34, -0.08, 12.0], 0.028, mats.grabRail);

  // Sector Airlock Bulkhead Iris Doors
  [-42.0, -34.0, -21.0, 12.3].forEach((az) => {
    const bh = buildAirlockBulkhead(az, mats, doorsList, 2.2, 2.55, az > 0 ? 0xfb7185 : 0x38bdf8);
    bh.position.y = az > 0 ? 0.92 : -0.15;
    g.add(bh);
  });

  // Lateral Pressurized Transfer Collars (Z = -29 science, Z = -6 & Z = +2.5 habitat)
  [
    { z: -29.0, halfSpan: 3.8, floorY: -1.55, hex: 0x34d399 },
    { z: -6.0, halfSpan: 3.4, floorY: -1.7, hex: 0xf59e0b },
    { z: 2.5, halfSpan: 3.4, floorY: -1.7, hex: 0xf59e0b },
  ].forEach(({ z, halfSpan, floorY, hex }) => {
    const collarFloor = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2, 0.12, 2.4), mats.floorDeck);
    collarFloor.position.set(0, floorY, z);
    const collarRoof = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2, 0.14, 2.5), mats.bulkhead);
    collarRoof.position.set(0, 1.38, z);
    const ringMat = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.5 });
    const collarBand = new THREE.Mesh(new THREE.BoxGeometry(halfSpan * 2 - 0.4, 0.05, 0.08), ringMat);
    collarBand.position.set(0, 1.25, z - 1.15);
    g.add(collarFloor, collarRoof, collarBand);
  });

  // Spine interior lights spaced evenly every 13m
  [-35, -22, -9, 4].forEach((lz) => {
    const pl = new THREE.PointLight(0xdbeafe, 1.15, 16, 1.6);
    pl.position.set(0, 1.18, lz);
    g.add(pl);
  });

  root.add(g);
}

function buildScienceSectorPods(root, mats, registerConsole) {
  const g = new THREE.Group();
  g.name = 'Sector_SciencePods_Deck02';
  const podLen = 16.4; // Z: -37.2 .. -20.8
  const podCenterZ = -29.0;

  [-1, 1].forEach((side) => {
    const cx = side * 5.6;
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(2.34, 2.34, podLen, 20, 1, true),
      mats.thermalQuilt,
    );
    shell.rotation.x = Math.PI / 2;
    shell.position.set(cx, 0, podCenterZ);
    g.add(shell);

    const endCapF = new THREE.Mesh(new THREE.CircleGeometry(2.34, 20), mats.darkFrame);
    endCapF.position.set(cx, 0, podCenterZ - podLen * 0.5);
    const endCapA = endCapF.clone();
    endCapA.position.z = podCenterZ + podLen * 0.5;
    g.add(endCapF, endCapA);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.14, podLen), mats.floorDeck);
    floor.position.set(cx, -1.62, podCenterZ);
    g.add(floor);

    for (let rz = -35.5; rz <= -22.5; rz += 3.25) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.075, 8, 20, Math.PI * 1.15), mats.darkFrame);
      arch.position.set(cx, -0.1, rz);
      arch.rotation.z = -Math.PI * 0.075;
      g.add(arch);
    }

    addGrabRail(g, [cx - side * 1.65, -0.35, -35.8], [cx - side * 1.65, -0.35, -22.2], 0.026, mats.grabRail);
    const podLight = new THREE.PointLight(side < 0 ? 0xa5f3fc : 0xd1fae5, 1.35, 16, 1.5);
    podLight.position.set(cx, 1.45, podCenterZ);
    g.add(podLight);
  });

  // PORT POD: NASA SPHEREx Spectroscopy Cryostat & Observatory Station ('science')
  const sciDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'science');
  const sciConsole = createMountedConsole(sciDef, mats, { width: 1.8, accentHex: 0x34d399, waveformMode: 'spectrum' });
  registerConsole(sciConsole);
  g.add(sciConsole.group);

  // Detailed multi-stage radiative V-groove sunshield & Cryostat tower in Port Science Pod
  const cryostat = new THREE.Group();
  cryostat.position.set(-5.6, -1.55, -34.2);
  const cryoPed = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.78, 18), mats.darkFrame);
  cryoPed.position.y = 0.39;
  const cryoBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.25, 18), mats.chromePipe);
  cryoBody.position.y = 1.35;
  const baffleCone = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.45, 0.55, 18, 1, true), mats.goldFoil);
  baffleCone.position.y = 2.05;
  const dichroicRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 10, 28), mats.accentEmerald);
  dichroicRing.rotation.x = Math.PI / 2;
  dichroicRing.position.y = 1.65;
  cryostat.add(cryoPed, cryoBody, baffleCone, dichroicRing);
  g.add(cryostat);

  // STARBOARD POD: Articulated Optical Calibration & 4-Stage Repair Bench ('sensor-calibration')
  const benchDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'sensor-calibration');
  const benchConsole = createMountedConsole(benchDef, mats, { width: 1.45, accentHex: 0x10b981, waveformMode: 'spectrum' });
  // Desplazar consola lateralmente hacia babor dentro de la vaina para dejar despejado el banco óptico frontal
  benchConsole.group.position.set(4.38, benchDef.position.y, -29.95);
  benchConsole.group.rotation.y = Math.atan2(
    benchDef.position.x - 4.38,
    benchDef.position.z - (-29.95),
  );
  benchConsole.group.scale.setScalar(0.84);
  registerConsole(benchConsole);
  g.add(benchConsole.group);

  const opticalBenchGroup = new THREE.Group();
  opticalBenchGroup.position.set(5.6, -1.55, -31.65);
  const pneumaticTable = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.14, 2.2), mats.darkFrame);
  pneumaticTable.position.y = 0.88;
  [-0.55, 0.55].forEach((lx) => {
    [-0.85, 0.85].forEach((lz) => {
      const isolator = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 12), mats.chromePipe);
      isolator.position.set(lx, 0.42, lz);
      opticalBenchGroup.add(isolator);
    });
  });

  // Animated Primary Mirror Gimbal & Dichroic Filter Actuator (responds visually to 4 repair phases!)
  const mirrorHousing = new THREE.Group();
  mirrorHousing.position.set(0, 1.32, -0.35);
  const mirrorMount = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.14, 24), mats.darkFrame);
  mirrorMount.rotation.x = Math.PI / 2;
  const mirrorDish = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 24), mats.goldFoil);
  mirrorDish.rotation.x = Math.PI / 2;
  mirrorDish.position.z = 0.07;
  mirrorHousing.add(mirrorMount, mirrorDish);

  const filterWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 18), mats.accentEmerald);
  filterWheel.rotation.x = Math.PI / 2;
  filterWheel.position.set(0, 1.25, 0.55);

  const calibBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.9, 8),
    new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.55 }),
  );
  calibBeam.rotation.x = Math.PI / 2;
  calibBeam.position.set(0, 1.28, 0.1);

  opticalBenchGroup.add(pneumaticTable, mirrorHousing, filterWheel, calibBeam);
  g.add(opticalBenchGroup);

  // DORSAL CUPOLA ARCHIVE BAY ('archive' at Y:+1.65, Z:-26.0) — open shaft bottom for upward zero-G transit!
  const archWallF = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.35, 0.14), mats.darkFrame);
  archWallF.position.set(0, 2.55, -27.25);
  const archWallA = archWallF.clone();
  archWallA.position.z = -24.75;
  const archWallL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.35, 2.5), mats.darkFrame);
  archWallL.position.set(-1.15, 2.55, -26.0);
  const archWallR = archWallL.clone();
  archWallR.position.x = 1.15;
  const archRoof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 2.6), mats.viewportGlass);
  archRoof.position.set(0, 3.72, -26.0);
  const archDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'archive');
  const archConsole = createMountedConsole(archDef, mats, { width: 1.4, accentHex: 0x60a5fa, waveformMode: 'orbit' });
  registerConsole(archConsole);
  addGrabRail(g, [0.95, 0.2, -25.1], [0.95, 3.1, -25.1], 0.025, mats.grabRail);
  g.add(archWallF, archWallA, archWallL, archWallR, archRoof, archConsole.group);

  root.add(g);
  return { mirrorHousing, filterWheel, calibBeam };
}

function buildHabitatDrums(root, mats, registerConsole) {
  const g = new THREE.Group();
  g.name = 'Sector_HabitatDrums_Deck03';
  const drumLen = 20.4; // Z: -13.2 .. +7.2
  const drumZ = -3.0;
  const portholeZ = [-10.0, -7.2, -4.4, -1.6, 1.2, 4.0];

  [-1, 1].forEach((side) => {
    const cx = side * 6.2;
    // Leave a crisp porthole viewport band centered at outer Y=+0.8m (theta ≈ ±1.78 rad) open!
    const portholeGapRad = 0.44;
    const outerPortholeTheta = side > 0 ? 1.78 : Math.PI * 2 - 1.78;
    const roofGeo = new THREE.CylinderGeometry(
      3.78,
      3.78,
      drumLen,
      24,
      1,
      true,
      outerPortholeTheta + portholeGapRad * 0.5,
      Math.PI * 2 - portholeGapRad,
    );
    roofGeo.rotateX(Math.PI / 2);
    const roofArc = new THREE.Mesh(roofGeo, mats.thermalQuilt);
    roofArc.position.set(cx, 0, drumZ);
    g.add(roofArc);

    const floor = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.16, drumLen), mats.floorDeck);
    floor.position.set(cx, -1.83, drumZ);
    g.add(floor);

    const bulkheadBow = new THREE.Mesh(new THREE.CircleGeometry(3.78, 24), mats.bulkhead);
    bulkheadBow.position.set(cx, 0, drumZ - drumLen * 0.5);
    const bulkheadAft = bulkheadBow.clone();
    bulkheadAft.position.z = drumZ + drumLen * 0.5;
    g.add(bulkheadBow, bulkheadAft);

    // 6 Chamfered Porthole Viewing Apertures strictly aligned with exterior HabitatModule portholes + wall mullions!
    const outerX = cx + side * 3.68;
    const spacerZ = [-11.8, -8.6, -5.8, -3.0, -0.2, 2.6, 5.7];
    spacerZ.forEach((sz, idx) => {
      const len = idx === 0 || idx === spacerZ.length - 1 ? 2.6 : 1.78;
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.35, len), mats.bulkhead);
      mullion.position.set(outerX, 0.8, sz);
      g.add(mullion);
    });
    portholeZ.forEach((pz) => {
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.08, 12, 24), mats.darkFrame);
      bezel.rotation.y = Math.PI / 2;
      bezel.position.set(outerX, 0.8, pz);
      const pane = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), mats.viewportGlass);
      pane.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      pane.position.set(outerX, 0.8, pz);
      g.add(bezel, pane);
    });

    const habLight = new THREE.PointLight(0xfef3c7, 1.25, 20, 1.45);
    habLight.position.set(cx, 1.8, drumZ);
    g.add(habLight);
  });

  // PORT HABITAT WING: Zero-G Crew Berths + Galley & Hydration Console ('galley')
  for (let bz = -10.5; bz <= 4.5; bz += 5.0) {
    const berth = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 2.2), mats.darkFrame);
    berth.position.set(-8.2, -1.25, bz);
    const bunkPad = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 1.95), mats.thermalQuilt);
    bunkPad.position.set(-8.2, -0.82, bz);
    g.add(berth, bunkPad);
  }
  const galleyDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'galley');
  const galleyConsole = createMountedConsole(galleyDef, mats, { width: 1.7, accentHex: 0xf59e0b, waveformMode: 'orbit' });
  registerConsole(galleyConsole);
  g.add(galleyConsole.group);

  // STARBOARD HABITAT WING: Aeroponic Botanical Cylinders & Medical Bay Table
  const hydroponicRack = new THREE.Group();
  hydroponicRack.position.set(6.5, -1.75, 1.5);
  const hydroFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.5, 16, 1, true), mats.darkFrame);
  hydroFrame.position.y = 1.25;
  const hydroGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 2.1, 14),
    new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.7 }),
  );
  hydroGlow.position.y = 1.25;
  hydroponicRack.add(hydroFrame, hydroGlow);
  g.add(hydroponicRack);

  const loungeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.35, 0.85, 18), mats.bulkhead);
  loungeTable.position.set(7.8, -1.32, -5.8);
  g.add(loungeTable);

  // VENTRAL EVA AIRLOCK & SUIT BAY ('airlock', Y:-4.25..-1.5, Z:-6.0) — open top shaft!
  const alWallF = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.75, 0.14), mats.darkFrame);
  alWallF.position.set(0, -2.9, -7.55);
  const alWallA = alWallF.clone();
  alWallA.position.z = -4.45;
  const alWallL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.75, 3.1), mats.darkFrame);
  alWallL.position.set(-1.35, -2.9, -6.0);
  const alWallR = alWallL.clone();
  alWallR.position.x = 1.35;
  const airlockFloor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 3.05), mats.floorDeck);
  airlockFloor.position.set(0, -4.26, -6.0);
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 12, 24), mats.hazardTrim);
  hatchRing.rotation.x = Math.PI / 2;
  hatchRing.position.set(0, -4.18, -6.0);
  const airlockLight = new THREE.PointLight(0xfca5a5, 1.1, 8, 1.5);
  airlockLight.position.set(0, -2.1, -6.0);
  addGrabRail(g, [1.05, -3.9, -5.1], [1.05, -1.35, -5.1], 0.028, mats.grabRail);

  const airlockDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'airlock');
  const airlockConsole = createMountedConsole(airlockDef, mats, { width: 1.35, accentHex: 0xef4444, waveformMode: 'orbit' });
  registerConsole(airlockConsole);
  g.add(alWallF, alWallA, alWallL, alWallR, airlockFloor, hatchRing, airlockLight, airlockConsole.group);

  root.add(g);
}

function buildEngineeringSector(root, mats, registerConsole) {
  const g = new THREE.Group();
  g.name = 'Sector_Engineering_Deck04';
  const engLen = 27.5; // Z: +12.5 .. +40.0
  const engZ = 26.25;

  const cylShell = new THREE.Mesh(
    new THREE.CylinderGeometry(4.55, 4.55, engLen, 24, 1, true),
    mats.darkFrame,
  );
  cylShell.rotation.x = Math.PI / 2;
  cylShell.position.set(0, 0.0, engZ);
  g.add(cylShell);

  const aftCap = new THREE.Mesh(new THREE.CircleGeometry(4.55, 24), mats.darkFrame);
  aftCap.position.set(0, 0, 40.0);
  g.add(aftCap);

  // Upper Catwalk Floor (split around open vertical ladder well at Z: 15..18)
  const upperFore = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.16, 2.8), mats.floorDeck);
  upperFore.position.set(0, -0.33, 13.8);
  const upperAft = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.16, 21.5), mats.floorDeck);
  upperAft.position.set(0, -0.33, 29.0);
  const lowerFloor = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.16, 18.0), mats.floorDeck);
  lowerFloor.position.set(0, -3.33, 22.0);
  g.add(upperFore, upperAft, lowerFloor);

  // Vertical shaft guard rails + climb ladder rungs between Upper & Lower tiers
  addGrabRail(g, [1.15, -3.15, 16.5], [1.15, 0.85, 16.5], 0.032, mats.grabRail);
  addGrabRail(g, [-1.15, -3.15, 16.5], [-1.15, 0.85, 16.5], 0.032, mats.grabRail);

  // Engineering Tokamak Control Console ('engineering')
  const engDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'engineering');
  const engConsole = createMountedConsole(engDef, mats, { width: 2.1, accentHex: 0xfb7185, waveformMode: 'tokamak' });
  registerConsole(engConsole);
  g.add(engConsole.group);

  // Interior Tokamak Confinement Viewport Assembly (aligned strictly with exterior Tokamak Torus at Z = +24.0m!)
  const tokamakGroup = new THREE.Group();
  tokamakGroup.position.set(0, 1.35, 25.5);
  const tokRingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  const plasmaCore = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.28, 16, 48), tokRingMat);
  plasmaCore.rotation.x = Math.PI / 2;
  const fieldCoilA = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.12, 10, 36), mats.copperPipe);
  const fieldCoilB = fieldCoilA.clone();
  fieldCoilB.rotation.y = Math.PI / 2;
  tokamakGroup.add(plasmaCore, fieldCoilA, fieldCoilB);
  g.add(tokamakGroup);

  // Lower Bay Twin Cryogenic Helium Drums & MPD Busbars
  [-2.2, 2.2].forEach((dx) => {
    const cryoTank = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 6.2, 16), mats.chromePipe);
    cryoTank.rotation.x = Math.PI / 2;
    cryoTank.position.set(dx, -2.1, 24.0);
    g.add(cryoTank);
  });

  const tokLight = new THREE.PointLight(0x38bdf8, 1.8, 22, 1.4);
  tokLight.position.set(0, 1.8, 25.0);
  const lowerLight = new THREE.PointLight(0xfda4af, 1.25, 18, 1.5);
  lowerLight.position.set(0, -1.5, 22.0);
  g.add(tokLight, lowerLight);

  root.add(g);
  return { tokamakGroup, plasmaCore };
}

/**
 * Builds the unified, hull-conforming 120m interior of KRONOX (`1 unit = 1 meter`).
 * Every room, corridor, porthole, and reactor chamber sits strictly inside KronoxExteriorShip120m.
 */
export function buildKronoxInterior120M() {
  const root = new THREE.Group();
  root.name = 'KronoxUnifiedInterior120M';

  const mats = createMaterialPalette();
  const consoles = [];
  const stationMeshes = [];
  const airlockDoors = [];

  const registerConsole = (entry) => {
    consoles.push(entry);
    stationMeshes.push(entry);
  };

  buildCommandBridgeSector(root, mats, registerConsole);
  buildCentralSpineCorridor(root, mats, airlockDoors);
  const scienceParts = buildScienceSectorPods(root, mats, registerConsole);
  buildHabitatDrums(root, mats, registerConsole);
  const engParts = buildEngineeringSector(root, mats, registerConsole);

  const deckContainers = {
    'deck-01': root.getObjectByName('Sector_Bridge_Deck01'),
    'deck-02': root.getObjectByName('Sector_SciencePods_Deck02'),
    'deck-03': root.getObjectByName('Sector_HabitatDrums_Deck03'),
    'deck-04': root.getObjectByName('Sector_Engineering_Deck04'),
  };

  let lastRepairStage = 0;

  function updateStations(
    elapsedTime = 0,
    nearestOrActiveId = null,
    activeStationId = null,
    focusedId = null,
    freeHelm = false,
    astronautPos = null,
    repairStage = null,
  ) {
    if (typeof repairStage === 'number') lastRepairStage = repairStage;

    // 1. Update console highlight/screen states
    for (const c of consoles) {
      const isActive = c.id === activeStationId || c.id === nearestOrActiveId;
      const isFocused = c.id === focusedId;
      const pulse = 0.65 + 0.35 * Math.sin(elapsedTime * 3.5);
      if (c.trimBarMat) {
        c.trimBarMat.emissiveIntensity = isActive ? 1.55 : isFocused ? 1.2 * pulse : 0.65;
      }
      if (c.floorBeacon?.material) {
        c.floorBeacon.material.opacity = isActive ? 0.55 : isFocused ? 0.42 * pulse : 0.16;
      }
      if (c.id === 'engineering') {
        c.updateScreen(
          'TOKAMAK ESTABLE · 98.4% FLUJO',
          ['ANILLO Z = +24.0 m · CONFINAMIENTO ACTIVO', 'CRIOGENIA He-II: 1.9 K NOMINAL', 'IMPULSO MPD: LISTO PARA TRÁNSITO'],
          elapsedTime,
        );
      } else if (c.id === 'science') {
        c.updateScreen(
          'ESPECTRÓMETRO SPHEREx ACTIVO',
          ['BANDAS 1–6: 0.75–5.0 μm SINCRONIZADAS', 'FUENTES: FITS IRSA CALIBRADOS', 'PULSA [E] PARA ABRIR LABORATORIO'],
          elapsedTime,
        );
      } else if (c.id === 'sensor-calibration') {
        c.updateScreen(
          `BANCO ÓPTICO · FASE REPARACIÓN ${lastRepairStage}/4`,
          ['ESPEJO PRIMARIO Au-Be EN ALINEACIÓN', 'RUEDA DICROICA IR OPERATIVA', 'PULSA [E] PARA INTERACTUAR EN VIVO'],
          elapsedTime,
        );
      } else if (c.id === 'nav' && freeHelm) {
        c.updateScreen(
          'TIMÓN LIBRE DE NAVEGACIÓN ACTIVO',
          ['CONTROL DIRECTO EN PROA (-Z)', 'EMPUJE WASD + ORIENTACIÓN', 'ESC PARA LIBERAR TIMÓN'],
          elapsedTime,
        );
      }
    }

    // 2. Animate Starboard Optical Calibration Bench according to repair stage (0..4)
    if (scienceParts?.mirrorHousing && scienceParts?.filterWheel && scienceParts?.calibBeam) {
      const stageFrac = Math.max(0, Math.min(4, lastRepairStage));
      scienceParts.filterWheel.rotation.z = elapsedTime * (stageFrac >= 3 ? 1.8 : 0.35);
      scienceParts.mirrorHousing.rotation.x = stageFrac >= 2 && stageFrac < 4 ? -0.38 : Math.sin(elapsedTime * 0.5) * 0.04;
      scienceParts.calibBeam.material.opacity = stageFrac === 4 ? 0.92 : stageFrac >= 1 ? 0.48 : 0.18;
    }

    // 3. Animate Tokamak Plasma Torus & Magnetic Coils in Engineering (Deck 04)
    if (engParts?.tokamakGroup && engParts?.plasmaCore) {
      engParts.tokamakGroup.rotation.y = elapsedTime * 0.32;
      engParts.plasmaCore.rotation.z = elapsedTime * 1.1;
    }

    // 4. Proximity-driven animated iris bulkhead airlock doors along Central Spine
    const az = astronautPos?.z ?? -45.3;
    const ax = astronautPos?.x ?? 0;
    for (const door of airlockDoors) {
      const nearDoor = Math.abs(az - door.z) < 3.4 && Math.abs(ax - door.x) < 2.1;
      const target = nearDoor ? 1.0 : 0.0;
      door.openProgress += (target - door.openProgress) * 0.18;
      const slide = door.openProgress * door.halfW * 0.92;
      door.leafL.position.x = -door.halfW * 0.5 - slide;
      door.leafR.position.x = door.halfW * 0.5 + slide;
      door.statusMat.emissiveIntensity = nearDoor ? 1.4 : 0.45;
    }
  }

  return {
    root,
    cabinRoot: root,
    decks: CABIN_DECKS,
    deckContainers,
    interactiveStations: SHIP_INTERIOR_STATIONS,
    stationMeshes,
    grabRails: INTERIOR_GRAB_RAILS,
    zones: HULL_INTERIOR_ZONES,
    clampAstronautPosition,
    findNearestInteractiveStation,
    resolveCurrentDeck,
    updateStations,
  };
}
