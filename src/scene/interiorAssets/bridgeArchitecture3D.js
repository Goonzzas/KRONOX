import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { HULL_INTERIOR_ZONES, SHIP_INTERIOR_STATIONS } from '../kronoxInteriorSpatialModel.js';
import { createDiegeticScreenDisplay } from '../shipInteriorTextures.js';
import {
  buildCurvedGrabRail,
  buildCableConduit,
  buildFootRestraintPlate,
  buildStructuralArchRib,
  buildModularRackBay,
  buildMicroGCommandSeat,
} from './architecturalKit.js';
import {
  buildMachinedWallCFrame,
  buildCantileveredWorkbench,
} from './aerospaceShapes.js';

/**
 * Helper: Creates a curved recessed OLED screen inset cleanly into any sculpted console chassis.
 */
function buildRecessedOledWing({
  width = 0.85,
  height = 0.42,
  title,
  subtitle,
  lines,
  accentHex = '#38bdf8',
  waveformMode = 'orbit',
  mats,
  name = 'RecessedOledWing',
}) {
  const holder = new THREE.Group();
  holder.name = name;
  const bezelMat = mats.anodizedGunmetal || mats.darkFrame;

  const casing = new THREE.Mesh(
    new RoundedBoxGeometry(width + 0.075, height + 0.075, 0.048, 3, 0.015),
    bezelMat,
  );
  holder.add(casing);

  const disp = createDiegeticScreenDisplay({
    title,
    subtitle,
    lines,
    accent: accentHex,
    waveformMode,
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: disp.texture, toneMapped: false });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), screenMat);
  screenMesh.position.z = 0.028;
  screenMesh.name = `${name}_Display`;
  holder.add(screenMesh);

  return { holder, screenMesh, disp };
}

/**
 * Miniature translucent 3D Astrometrics Orbital Hologram hovering cleanly over the Helm emitter
 * without blocking the panoramic forward bow viewport.
 */
function buildBridgeAstrometricsHologram(mats) {
  const holo = new THREE.Group();
  holo.name = 'Bridge_HelmAstrometricsHolo';

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.65,
    wireframe: true,
  });
  const starMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.9,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });

  const centralStar = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 16), starMat);
  holo.add(centralStar);

  [0.09, 0.145, 0.2].forEach((r, idx) => {
    const orbit = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.005, 40), ringMat);
    orbit.rotation.x = Math.PI / 2 + (idx - 1) * 0.14;
    orbit.rotation.y = idx * 0.42;
    holo.add(orbit);

    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 10), coreMat);
    marker.position.set(Math.cos(idx * 2.1) * r, 0, Math.sin(idx * 2.1) * r);
    orbit.add(marker);
  });

  const gridDisc = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.22, 32, 3), coreMat);
  gridDisc.rotation.x = Math.PI / 2;
  gridDisc.material.opacity = 0.14;
  holo.add(gridDisc);

  return holo;
}

/**
 * Wrap-around Ergonomic Flight Deck Helm Arc ('nav').
 * Anodized titanium stanchions, cantilevered crescent desk, twin 3-axis HOTAS sticks,
 * compact 3D orbital holomap emitter, and unobstructed bow viewport horizon.
 */
function buildSculptedHelmArcConsole(stationDef, mats) {
  const group = new THREE.Group();
  group.name = 'Bridge_HelmCommandArc_Station_nav';
  group.userData = { stationId: stationDef.id, deckLevel: stationDef.deckLevel };
  group.position.set(stationDef.consolePos.x, stationDef.position.y, stationDef.consolePos.z);

  const frameMat = mats.anodizedGunmetal || mats.darkFrame;
  const trimBarMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.42,
    roughness: 0.3,
  });

  // 1. Anchored Cockpit Base Plinth & Dual Cantilevered Avionics Pods (eliminates tabletop-on-sticks look)
  const centerSpine = new THREE.Mesh(
    new RoundedBoxGeometry(1.18, 0.78, 0.56, 3, 0.03),
    frameMat,
  );
  centerSpine.position.set(0, 0.39, -0.18);
  group.add(centerSpine);

  [-0.92, 0.92].forEach((px, idx) => {
    const stanchionShape = new THREE.Shape();
    stanchionShape.moveTo(-0.24, 0);
    stanchionShape.lineTo(0.22, 0);
    stanchionShape.lineTo(0.18, 0.78);
    stanchionShape.lineTo(-0.32, 0.78);
    stanchionShape.closePath();

    const stanchionGeo = new THREE.ExtrudeGeometry(stanchionShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.016,
      bevelSegments: 2,
    });
    stanchionGeo.translate(0, 0, -0.08);
    stanchionGeo.rotateY(Math.PI / 2);

    const leg = new THREE.Mesh(stanchionGeo, frameMat);
    leg.position.set(px, 0, -0.05);
    leg.name = `HelmStanchion_${idx}`;

    // Recessed forward wing equipment module connecting legs into one unified hull coaming
    const wingLocker = new THREE.Mesh(
      new RoundedBoxGeometry(0.68, 0.64, 0.42, 3, 0.025),
      mats.bulkhead,
    );
    wingLocker.position.set(px * 0.72, 0.34, -0.14);
    wingLocker.rotation.y = px < 0 ? 0.32 : -0.32;
    group.add(leg, wingLocker);
  });

  // 2. Sculpted Cockpit Crescent Instrument Coaming Deck + Protective Brow Glare Shield
  const arcShape = new THREE.Shape();
  arcShape.moveTo(-1.42, 0.24);
  arcShape.quadraticCurveTo(-1.14, -0.36, 0, -0.41);
  arcShape.quadraticCurveTo(1.14, -0.36, 1.42, 0.24);
  arcShape.lineTo(1.06, 0.43);
  arcShape.quadraticCurveTo(0.84, 0.02, 0, -0.02);
  arcShape.quadraticCurveTo(-0.84, 0.02, -1.06, 0.43);
  arcShape.closePath();

  const arcGeo = new THREE.ExtrudeGeometry(arcShape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.02,
    bevelSegments: 3,
  });
  arcGeo.rotateX(Math.PI / 2);
  const chassisDeck = new THREE.Mesh(arcGeo, mats.workSurface);
  chassisDeck.position.set(0, 0.85, 0.08);
  chassisDeck.name = 'HelmCrescentDeck';
  group.add(chassisDeck);

  // Unified cockpit glare-shield hood wrapping above all three displays (binds them into the dash!)
  const browShape = new THREE.Shape();
  browShape.moveTo(-1.26, 0.14);
  browShape.quadraticCurveTo(-0.98, -0.32, 0, -0.36);
  browShape.quadraticCurveTo(0.98, -0.32, 1.26, 0.14);
  browShape.lineTo(1.08, 0.24);
  browShape.quadraticCurveTo(0.82, -0.14, 0, -0.18);
  browShape.quadraticCurveTo(-0.82, -0.14, -1.08, 0.24);
  browShape.closePath();
  const browGeo = new THREE.ExtrudeGeometry(browShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  browGeo.rotateX(Math.PI / 2);
  const browHood = new THREE.Mesh(browGeo, frameMat);
  browHood.position.set(0, 1.15, 0.02);
  group.add(browHood);

  // Integrated capacitive thruster switch strip along center edge
  const trimStrip = new THREE.Mesh(new RoundedBoxGeometry(1.75, 0.016, 0.028, 2, 0.007), trimBarMat);
  trimStrip.position.set(0, 0.77, 0.08);
  const centerKeypad = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.018, 0.14, 2, 0.005), mats.carbonFiber);
  centerKeypad.position.set(0, 0.858, 0.22);
  group.add(trimStrip, centerKeypad);

  // 3. Recessed Integrated Flight Avionics Displays nestled securely beneath glare hood
  const centerWing = buildRecessedOledWing({
    width: 0.88,
    height: 0.3,
    title: 'TIMÓN ORBITAL · KRONOX',
    subtitle: 'EN LÍNEA · PULSA [E] PARA PILOTAJE',
    lines: [
      'MODO: ÓRBITA TERRESTRE J2000.0',
      'PROPULSIÓN MPD: LISTA · BUS 1.00 m',
      'NAVEGACIÓN LIBRE [W/A/S/D] · FRENO [X]',
    ],
    accentHex: '#6ff0ff',
    waveformMode: 'orbit',
    mats,
    name: 'HelmCenterAvionicsDisplay',
  });
  centerWing.holder.position.set(0, 0.97, -0.19);
  centerWing.holder.rotation.x = -0.5;
  group.add(centerWing.holder);

  const portWing = buildRecessedOledWing({
    width: 0.54,
    height: 0.27,
    title: 'VECTOR & RCS',
    subtitle: 'ESTABILIDAD NOMINAL',
    lines: ['ΔV RES: 48.2 km/s', 'ACTITUD: 0.00°'],
    accentHex: '#38bdf8',
    waveformMode: 'spectrum',
    mats,
    name: 'HelmPortTelemetryWing',
  });
  portWing.holder.position.set(-0.88, 0.95, 0.01);
  portWing.holder.rotation.set(-0.46, 0.44, 0, 'YXZ');
  group.add(portWing.holder);

  const stbdWing = buildRecessedOledWing({
    width: 0.54,
    height: 0.27,
    title: 'ESPECTROMETRÍA & RADAR',
    subtitle: 'SENSORES ACTIVO',
    lines: ['PROA LIDAR: CLEAR', 'ENLACE IA: ACTIVO'],
    accentHex: '#fbbf24',
    waveformMode: 'orbit',
    mats,
    name: 'HelmStarboardTelemetryWing',
  });
  stbdWing.holder.position.set(0.88, 0.95, 0.01);
  stbdWing.holder.rotation.set(-0.46, -0.44, 0, 'YXZ');
  group.add(stbdWing.holder);

  // Twin Articulated 3-Axis Flight Hand Controllers
  [-0.5, 0.5].forEach((sx, idx) => {
    const stickBase = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.045, 0.19, 2, 0.016), frameMat);
    stickBase.position.set(sx, 0.875, 0.14);
    const bootCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.042, 0.045, 14), mats.carbonFiber);
    bootCollar.position.set(sx, 0.92, 0.14);

    const gripCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 0.93, 0.14),
      new THREE.Vector3(sx, 1.0, 0.16),
      new THREE.Vector3(sx * 0.94, 1.08, 0.12),
    ]);
    const grip = new THREE.Mesh(new THREE.TubeGeometry(gripCurve, 12, 0.017, 10, false), mats.darkSeat);
    const triggerHead = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.03, 0.048, 2, 0.01), mats.grabRail);
    triggerHead.position.set(sx * 0.94, 1.08, 0.11);
    grip.name = `HelmFlightController_${idx}`;
    group.add(stickBase, bootCollar, grip, triggerHead);
  });

  // Compact Centered Astrometric Holoprojector Emitter (restrained scale so it sits cleanly inside bezel)
  const emitterProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.16, 0.0),
    new THREE.Vector2(0.14, 0.032),
    new THREE.Vector2(0.095, 0.052),
    new THREE.Vector2(0.085, 0.038),
    new THREE.Vector2(0.0, 0.038),
  ];
  const emitterBody = new THREE.Mesh(new THREE.LatheGeometry(emitterProfile, 24), frameMat);
  emitterBody.position.set(0, 0.85, 0.04);
  const emitterLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.012, 24),
    mats.accentCyan,
  );
  emitterLens.position.set(0, 0.892, 0.04);
  const holoMapGroup = buildBridgeAstrometricsHologram(mats);
  holoMapGroup.scale.setScalar(0.68);
  holoMapGroup.position.set(0, 0.99, 0.04);
  group.add(emitterBody, emitterLens, holoMapGroup);

  // Subfloor umbilical conduits
  [-0.86, 0.86].forEach((ux, idx) => {
    group.add(
      buildCableConduit(
        [
          [ux, 0.72, -0.05],
          [ux * 0.92, 0.35, -0.18],
          [ux * 0.8, 0.03, -0.26],
        ],
        0.02,
        mats.carbonFiber,
        `HelmUmbilical_${idx}`,
      ),
    );
  });

  // Zero-G foot restraint stirrups
  const footRest = buildFootRestraintPlate(mats, 'HelmFootRestraint');
  footRest.position.set(0, 0, 1.05);
  group.add(footRest);

  return {
    id: stationDef.id,
    deckLevel: stationDef.deckLevel,
    definition: stationDef,
    group,
    screenMesh: centerWing.screenMesh,
    trimBarMat,
    floorBeacon: null,
    holoMapGroup,
    updateScreen(subtitle, lines, phase = 0) {
      centerWing.disp.redraw('TIMÓN ORBITAL · KRONOX', subtitle, lines, phase);
      portWing.disp.redraw('VECTOR & RCS', 'ESTABILIDAD NOMINAL', ['ΔV RES: 48.2 km/s', 'ACTITUD: 0.00°'], phase);
    },
  };
}

/**
 * Wall-integrated Wing Operations Console for Port Quantum Comms ('comms') & Starboard Tactical Missions ('missions').
 * Built cleanly on sculpted cantilevered stanchions flush against bulkhead rack alcoves.
 */
function buildBridgeSideWingConsole(stationDef, sideSign, mats, { accentHex, waveformMode }) {
  const group = new THREE.Group();
  group.name = `Bridge_SideStation_${stationDef.id}`;
  group.userData = { stationId: stationDef.id, deckLevel: stationDef.deckLevel };
  const yaw = Math.atan2(stationDef.position.x - stationDef.consolePos.x, stationDef.position.z - stationDef.consolePos.z);
  group.position.set(stationDef.consolePos.x, stationDef.position.y, stationDef.consolePos.z);
  group.rotation.y = yaw;

  const frameMat = mats.anodizedGunmetal || mats.darkFrame;
  const accentColor = accentHex || '#38bdf8';
  const trimBarMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });

  // Cantilevered sculpted workbench integrated flush against lower avionics locker bay
  const desk = buildCantileveredWorkbench({
    width: 1.72,
    depth: 0.64,
    height: 0.82,
    frameMat,
    topMat: mats.workSurface,
    trimMat: trimBarMat,
    name: `${stationDef.id}_CantileverDesk`,
  });
  desk.position.set(0, 0, 0.02);
  group.add(desk);

  // Enclosed under-console equipment drawer module (stops desk from looking open/floaty)
  const lowerCabinet = new THREE.Mesh(
    new RoundedBoxGeometry(1.18, 0.62, 0.4, 2, 0.02),
    mats.bulkhead,
  );
  lowerCabinet.position.set(0, 0.34, -0.06);
  group.add(lowerCabinet);

  // Recessed slanted OLED display inside armored cowl hood (not a free-standing TV monitor)
  const hood = buildRecessedOledWing({
    width: 1.28,
    height: 0.42,
    title: stationDef.label.toUpperCase(),
    subtitle: 'EN LÍNEA · PULSA [E]',
    lines: [
      `SECTOR: ${stationDef.zoneLabel.slice(0, 32)}`,
      `ESTADO: OPERATIVO · MICRO-G`,
      `SISTEMA: KRONOX IA / CAMPAÑA`,
    ],
    accentHex: accentColor,
    waveformMode,
    mats,
    name: `${stationDef.id}_PrimaryOled`,
  });
  hood.holder.position.set(0, 1.07, -0.14);
  hood.holder.rotation.x = -0.34;
  const cowlLip = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.04, 0.16, 2, 0.01), frameMat);
  cowlLip.position.set(0, 1.27, -0.09);
  group.add(hood.holder, cowlLip);

  // Integrated capacitive touch console strip flush on console deck (zero loose grey keyboard box/dial)
  const touchStrip = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.016, 0.2, 2, 0.006), mats.carbonFiber);
  touchStrip.position.set(0, 0.858, 0.14);
  const trackPadTrim = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.018, 0.025, 1, 0.005), trimBarMat);
  trackPadTrim.position.set(0, 0.86, 0.06);
  group.add(touchStrip, trackPadTrim);

  // Upper integrated avionics rack mounted cleanly above console
  const upperBay = buildModularRackBay({
    width: 1.66,
    height: 1.04,
    depth: 0.36,
    label: stationDef.id === 'comms' ? 'ENLACE CUÁNTICO IA' : 'TELEMETRÍA MISIÓN',
    accentHex: accentColor,
    mats,
    frameMat,
    name: `${stationDef.id}_OverheadRack`,
  });
  upperBay.position.set(0, 1.44, -0.26);
  group.add(upperBay);

  // Flush bulkhead side column node for Quantum Comms / Data Archive
  const bladeRack = buildModularRackBay({
    width: 0.56,
    height: 0.82,
    depth: 0.42,
    label: stationDef.id === 'comms' ? 'NODO QU-ENLACE' : 'ARCHIVO SPHEREx',
    accentHex: accentColor,
    mats,
    frameMat,
    name: `${stationDef.id}_SubRack`,
  });
  bladeRack.position.set(sideSign < 0 ? 0.68 : -0.68, 0, -0.06);
  group.add(bladeRack);

  // Zero-G foot restraint & umbilical conduit
  const footRest = buildFootRestraintPlate(mats, `${stationDef.id}_FootRestraint`);
  footRest.position.set(0, 0, 0.85);
  group.add(footRest);

  group.add(
    buildCableConduit(
      [
        [sideSign * 0.65, 1.48, -0.25],
        [sideSign * 0.78, 0.9, -0.28],
        [sideSign * 0.65, 0.04, -0.22],
      ],
      0.02,
      mats.copperPipe,
      `${stationDef.id}_CryoFeed`,
    ),
  );

  return {
    id: stationDef.id,
    deckLevel: stationDef.deckLevel,
    definition: stationDef,
    group,
    screenMesh: hood.screenMesh,
    trimBarMat,
    floorBeacon: null,
    updateScreen(subtitle, lines, phase = 0) {
      hood.disp.redraw(stationDef.label.toUpperCase(), subtitle, lines, phase);
    },
  };
}

/**
 * Architectural Command Bridge (Cubierta 01, Z: -51.4m .. -42.0m).
 * Fits cleanly inside CommandModule (modularShipHull3D.js) with zero exterior hull protrusion.
 */
export function buildCommandBridgeSector3D(root, mats, registerConsole) {
  const g = new THREE.Group();
  g.name = 'Sector_Bridge_Deck01';
  const b = HULL_INTERIOR_ZONES.bridgeMain;
  const bridgeLen = b.maxZ - b.minZ; // Z: -48.6 .. -42.0
  const bridgeW = b.maxX - b.minX; // 8.5 m
  const floorY = b.minY; // -1.60 m
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  // 1. Slotted matte anti-static bridge deck + recessed glass/conduit floor channels
  const mainFloor = new THREE.Mesh(new RoundedBoxGeometry(bridgeW, 0.16, bridgeLen + 0.4, 2, 0.02), mats.floorDeck);
  mainFloor.position.set(0, floorY - 0.08, (b.minZ + b.maxZ) * 0.5);
  g.add(mainFloor);

  [-0.95, 0.95].forEach((tx, idx) => {
    const channelRail = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.026, bridgeLen - 0.8, 2, 0.008), frameMat);
    channelRail.position.set(tx, floorY + 0.005, -45.5);
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, bridgeLen - 1.2, 8), idx === 0 ? mats.copperPipe : mats.chromePipe);
    conduit.rotation.x = Math.PI / 2;
    conduit.position.set(tx, floorY + 0.014, -45.5);
    g.add(channelRail, conduit);
  });

  // Tapered Prow Observation Deck fitting strictly inside hull prowCone (Z: -51.4 .. -48.4)
  const prowPts = [
    new THREE.Vector2(-4.32, 0),
    new THREE.Vector2(-2.12, -3.05),
    new THREE.Vector2(2.12, -3.05),
    new THREE.Vector2(4.32, 0),
  ];
  const prowShape = new THREE.Shape(prowPts);
  const prowFloorGeo = new THREE.ExtrudeGeometry(prowShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
  });
  prowFloorGeo.rotateX(Math.PI / 2);
  const prowFloor = new THREE.Mesh(prowFloorGeo, mats.floorDeck);
  prowFloor.position.set(0, floorY, -48.4);
  g.add(prowFloor);

  // 2. Sculpted bow instrument coaming below viewport horizon + corner optical sensor bays
  const prowCoaming = new THREE.Mesh(new RoundedBoxGeometry(4.28, 0.44, 0.46, 3, 0.04), frameMat);
  prowCoaming.position.set(0, floorY + 0.22, -51.1);
  const coamingPad = new THREE.Mesh(new RoundedBoxGeometry(4.12, 0.09, 0.34, 3, 0.03), mats.workSurface);
  coamingPad.position.set(0, floorY + 0.46, -51.02);
  g.add(prowCoaming, coamingPad);

  const bowHandrail = buildCurvedGrabRail({
    start: [-1.55, floorY + 0.62, -50.76],
    end: [1.55, floorY + 0.62, -50.76],
    standoffDir: [0, 0.03, 0.07],
    radius: 0.018,
    mat: mats.grabRail,
    mountMat: frameMat,
    name: 'Bridge_ProwObservationRail',
  });
  g.add(bowHandrail);
  [-1.48, 0, 1.48].forEach((sx, idx) => {
    const stanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.2, 10), frameMat);
    stanchion.position.set(sx, floorY + 0.54, -50.76);
    stanchion.name = `ProwRailStanchion_${idx}`;
    g.add(stanchion);
  });

  // Bow corner star-tracker optical avionics bollards integrating prow sill seamlessly to side walls
  [-1.95, 1.95].forEach((px, idx) => {
    const trackerBay = buildModularRackBay({
      width: 0.54,
      height: 0.78,
      depth: 0.44,
      label: idx === 0 ? 'LIDAR PROA' : 'RASTREADOR EST.',
      accentHex: idx === 0 ? '#38bdf8' : '#fbbf24',
      mats,
      frameMat,
      name: `Bridge_ProwSensorPod_${idx}`,
    });
    trackerBay.position.set(px, floorY, -50.45);
    trackerBay.rotation.y = px < 0 ? 0.42 : -0.42;
    g.add(trackerBay);
  });

  // 3. Port & Starboard Architectural Bulkhead Panels + Machined Wall C-Frames
  [-1, 1].forEach((side) => {
    const sideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 4.7, bridgeLen + 0.4),
      mats.bulkhead,
    );
    sideWall.position.set(side * (b.maxX + 0.1), 0.75, (b.minZ + b.maxZ) * 0.5);
    g.add(sideWall);

    // Acoustic dark upper frieze panels recessed slightly between ribs
    const upperFrieze = new THREE.Mesh(
      new RoundedBoxGeometry(0.1, 1.05, bridgeLen - 0.5, 2, 0.02),
      mats.thermalQuilt,
    );
    upperFrieze.position.set(side * (b.maxX - 0.04), 2.15, -45.3);
    g.add(upperFrieze);

    // Machined wall C-frame structural ribs creating true aerospace depth relief
    [-48.0, -46.6, -45.2, -43.8, -42.5].forEach((rz, idx) => {
      const cFrame = buildMachinedWallCFrame({
        height: 4.5,
        depth: 0.24,
        thickness: 0.11,
        lip: 0.16,
        mat: frameMat,
        name: `Bridge_WallCFrame_${side > 0 ? 'Stbd' : 'Port'}_${idx}`,
      });
      cFrame.position.set(side * (b.maxX - 0.01), 0.72, rz);
      cFrame.rotation.y = side < 0 ? 0 : Math.PI;
      g.add(cFrame);
    });

    // Tapered Prow Cheek Walls sealed smoothly from main wall to canopy frame
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 4.9, 3.82),
      mats.bulkhead,
    );
    cheek.position.set(side * 3.16, 0.75, -50.0);
    cheek.rotation.y = side * 0.6548;
    g.add(cheek);

    const cornerPost = new THREE.Mesh(new RoundedBoxGeometry(0.24, 4.8, 0.24, 2, 0.03), frameMat);
    cornerPost.position.set(side * 4.18, 0.75, -48.55);
    g.add(cornerPost);

    // Machined structural canopy mullions grounded down into the bow bulkhead sill
    const mullion = new THREE.Mesh(new RoundedBoxGeometry(0.22, 3.68, 0.28, 3, 0.03), frameMat);
    mullion.position.set(side * 2.02, 0.56, -51.26);
    mullion.rotation.z = side * 0.06;
    mullion.rotation.x = -0.14;
    g.add(mullion);

    // Curved continuous side grab rails
    g.add(
      buildCurvedGrabRail({
        start: [side * 4.08, -0.45, -48.1],
        end: [side * 4.08, -0.45, -42.5],
        standoffDir: [-side * 0.08, 0, 0],
        radius: 0.022,
        mat: mats.grabRail,
        mountMat: frameMat,
        name: `Bridge_SideGrabRail_${side > 0 ? 'Stbd' : 'Port'}`,
      }),
    );
  });

  // 4. Vaulted Ceiling Arch Ribs, Recessed Uplight Coves & Sloped Canopy
  [-48.2, -46.2, -44.2, -42.4].forEach((rz, idx) => {
    const rib = buildStructuralArchRib({
      width: 8.48,
      height: 4.72,
      beamDepth: 0.24,
      beamThick: 0.19,
      mats,
      frameMat,
      lightMat: idx < 3 ? mats.coolDiffuser : mats.warmDiffuser,
      name: `Bridge_ArchRib_${idx}`,
    });
    rib.position.set(0, floorY, rz);
    g.add(rib);
  });

  const ceilingCladding = new THREE.Mesh(new THREE.BoxGeometry(8.56, 0.16, bridgeLen + 0.5), mats.bulkhead);
  ceilingCladding.position.set(0, 3.18, (b.minZ + b.maxZ) * 0.5);
  g.add(ceilingCladding);

  // Acoustic dark ceiling cassettes suspended gently between ribs
  [-47.2, -45.2, -43.3].forEach((cz, idx) => {
    const baffle = new THREE.Mesh(
      new RoundedBoxGeometry(5.6, 0.06, 1.45, 2, 0.02),
      mats.thermalQuilt,
    );
    baffle.position.set(0, 3.04, cz);
    baffle.name = `Bridge_CeilingAcousticBaffle_${idx}`;
    g.add(baffle);
  });

  // Enclosed Prow Ceiling Canopy Shell
  const prowRoofShape = new THREE.Shape([
    new THREE.Vector2(-4.32, 0),
    new THREE.Vector2(-2.12, -3.08),
    new THREE.Vector2(2.12, -3.08),
    new THREE.Vector2(4.32, 0),
  ]);
  const prowRoofGeo = new THREE.ExtrudeGeometry(prowRoofShape, {
    depth: 0.18,
    bevelEnabled: false,
  });
  prowRoofGeo.rotateX(Math.PI / 2);
  const prowRoof = new THREE.Mesh(prowRoofGeo, frameMat);
  prowRoof.position.set(0, 2.56, -48.35);
  prowRoof.name = 'Bridge_ProwCanopyRoof';
  const prowHeaderBeam = new THREE.Mesh(new RoundedBoxGeometry(4.42, 0.6, 0.34, 3, 0.03), frameMat);
  prowHeaderBeam.position.set(0, 2.32, -51.24);
  const prowBulkheadFrieze = new THREE.Mesh(new RoundedBoxGeometry(8.35, 0.85, 0.22, 2, 0.02), mats.bulkhead);
  prowBulkheadFrieze.position.set(0, 2.75, -48.48);
  g.add(prowRoof, prowHeaderBeam, prowBulkheadFrieze);

  // Sloped Overhead Avionics Canopy Switchboard
  const overheadConsole = new THREE.Mesh(
    new RoundedBoxGeometry(2.6, 0.24, 1.32, 3, 0.04),
    frameMat,
  );
  overheadConsole.position.set(0, 2.35, -47.1);
  overheadConsole.rotation.x = 0.26;
  const overheadGlow = buildRecessedOledWing({
    width: 1.5,
    height: 0.26,
    title: 'AVIÓNICA SUPERIOR · KRONOX',
    subtitle: 'BUS CRIOGÉNICO Y ESCUDOS NOMINALES',
    lines: ['COMPUERTAS: SELLADAS · PRESIÓN: 101.3 kPa'],
    accentHex: '#38bdf8',
    waveformMode: 'spectrum',
    mats,
    name: 'Bridge_OverheadAvionicsPanel',
  });
  overheadGlow.holder.position.set(0, 2.21, -46.92);
  overheadGlow.holder.rotation.x = Math.PI / 2 - 0.28;
  g.add(overheadConsole, overheadGlow.holder);

  const upperGlaze = new THREE.Mesh(new THREE.PlaneGeometry(4.15, 2.72), mats.viewportGlass);
  upperGlaze.position.set(0, 0.82, -51.36);
  g.add(upperGlaze);

  // 5. Aft Bulkhead Framing Spine Doorway + Integrated Wall Racks
  [-1, 1].forEach((side, idx) => {
    const aftWall = new THREE.Mesh(new RoundedBoxGeometry(2.85, 4.85, 0.24, 2, 0.03), mats.bulkhead);
    aftWall.position.set(side * 2.95, 0.78, -42.05);
    g.add(aftWall);

    const aftRack = buildModularRackBay({
      width: 1.32,
      height: 2.18,
      depth: 0.4,
      label: side < 0 ? 'BUS ENERGÍA PROA' : 'SOPORTE VITAL PUENTE',
      accentHex: side < 0 ? '#38bdf8' : '#f59e0b',
      mats,
      frameMat,
      name: `Bridge_AftRack_${idx}`,
    });
    aftRack.position.set(side * 2.8, floorY, -42.36);
    aftRack.rotation.y = Math.PI;
    g.add(aftRack);
  });

  // 6. Hero Bridge Workstations: Helm Arc + Pilot Seat + Port AI Wing + Starboard Mission Wing
  const navDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'nav');
  const helmConsole = buildSculptedHelmArcConsole(navDef, mats);
  registerConsole(helmConsole);
  g.add(helmConsole.group);

  const pilotSeat = buildMicroGCommandSeat(mats, 'Bridge_PilotMicroGSeat');
  pilotSeat.position.set(0, floorY, -45.98);
  g.add(pilotSeat);

  const commsDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'comms');
  const commsConsole = buildBridgeSideWingConsole(commsDef, -1, mats, {
    accentHex: '#38bdf8',
    waveformMode: 'orbit',
  });
  registerConsole(commsConsole);
  g.add(commsConsole.group);

  const missionsDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'missions');
  const missionsConsole = buildBridgeSideWingConsole(missionsDef, 1, mats, {
    accentHex: '#fbbf24',
    waveformMode: 'spectrum',
  });
  registerConsole(missionsConsole);
  g.add(missionsConsole.group);

  // Subtle floor beacon-free Bow Observation metadata anchor
  const winDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'windows');
  const winPedestal = new THREE.Group();
  winPedestal.name = 'Station_windows';
  winPedestal.userData = { stationId: 'windows', deckLevel: 1 };
  const winDisp = createDiegeticScreenDisplay({
    title: 'MIRADOR DE PROA',
    subtitle: 'OBSERVACIÓN ÓPTICA 1:1',
    lines: ['APUNTA AL COSMOS CON RETÍCULA', '[T] TELESCOPIO ÓPTICO · [E] FIJAR BLANCO'],
    accent: '#38bdf8',
  });
  registerConsole({
    id: 'windows',
    deckLevel: 1,
    definition: winDef,
    group: winPedestal,
    trimBarMat: mats.accentCyan,
    floorBeacon: null,
    updateScreen(sub, lns, p) {
      winDisp.redraw('MIRADOR DE PROA', sub, lns, p);
    },
  });
  g.add(winPedestal);

  // 7. Calibrated Bridge Key Lighting (2 controlled sources so bow cosmos stays crisp & materials gleam)
  const overheadWorkSpot = new THREE.PointLight(0xdceeff, 1.45, 13.0, 1.65);
  overheadWorkSpot.position.set(0, 2.15, -45.2);
  const helmWarmFill = new THREE.PointLight(0xd2e8ff, 0.72, 7.5, 1.75);
  helmWarmFill.position.set(0, 1.3, -47.6);
  g.add(overheadWorkSpot, helmWarmFill);

  root.add(g);
  return { holoMapGroup: helmConsole.holoMapGroup };
}
