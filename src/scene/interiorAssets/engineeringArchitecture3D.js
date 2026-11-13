import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SHIP_INTERIOR_STATIONS } from '../kronoxInteriorSpatialModel.js';
import {
  buildCurvedGrabRail,
  buildCableConduit,
  buildCylindricalPortalRib,
  buildModularRackBay,
  buildSculptedStationConsole,
  buildSectorPlacard,
} from './architecturalKit.js';
import {
  buildVacuumFlangeCollar,
  buildCorrugatedBellows,
  buildHeatExchangerFins,
  buildCantileveredWorkbench,
} from './aerospaceShapes.js';

/**
 * Hero Centerpiece (Deck 04): Grounded Horizontal D-He3 Toroidal Confinement Tokamak Reactor.
 * Mounted on heavy cantilevered trunnion piers anchored directly into deck collars & cooling
 * louvers, eliminating intrusive central vertical shafts while framing multi-layered plasma torus.
 */
function buildShieldedTokamakAssembly(mats) {
  const reactorBay = new THREE.Group();
  reactorBay.name = 'Hero_ToroidalTokamakReactor';

  const coilMat = mats.darkTitaniumCoil || mats.anodizedGunmetal || mats.darkFrame;
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;
  const shieldMat = mats.engShield || mats.bulkhead;

  // Heavy Floor-Anchored Trunnion Piers & Cryo Cradle Pedestal (-0.25 .. +1.6m)
  [-2.58, 2.58].forEach((px, idx) => {
    const pierShape = new THREE.Shape();
    pierShape.moveTo(-1.35, -0.25);
    pierShape.lineTo(1.35, -0.25);
    pierShape.lineTo(1.05, 1.35);
    pierShape.lineTo(-1.05, 1.35);
    pierShape.closePath();

    const pierGeo = new THREE.ExtrudeGeometry(pierShape, {
      depth: 0.48,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 2,
    });
    pierGeo.translate(0, 0, -0.24);
    pierGeo.rotateY(Math.PI / 2);

    const pier = new THREE.Mesh(pierGeo, coilMat);
    pier.position.set(px, 0, 25.5);
    pier.name = `TokamakAnchorPier_${idx}`;
    reactorBay.add(pier);

    // Side heat-exchanger cooling fins bolted onto trunnion pier outboard wall
    const hx = buildHeatExchangerFins({
      width: 1.15,
      height: 0.85,
      depth: 0.24,
      finCount: 9,
      finMat: frameMat,
      frameMat: mats.chromePipe,
      name: `TokamakPierCooling_${idx}`,
    });
    hx.rotation.y = Math.PI / 2;
    hx.position.set(px + Math.sign(px) * 0.34, 0.55, 25.5);
    reactorBay.add(hx);
  });

  // Grounded Lower Reactor Plinth Saddle + Deck Tie-Down Struts beneath torus belly (replaces floating hoops)
  const lowerSaddle = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.38, 0.42, 16),
    coilMat,
  );
  lowerSaddle.position.set(0, -0.08, 25.5);
  reactorBay.add(lowerSaddle);

  // Stationary Outer D-Shaped Superconducting Field Coils (8 smooth forged titanium D-casings)
  const coilShape = new THREE.Shape();
  coilShape.moveTo(0.68, -1.04);
  coilShape.lineTo(1.78, -0.98);
  coilShape.quadraticCurveTo(2.44, -0.56, 2.44, 0.0);
  coilShape.quadraticCurveTo(2.44, 0.56, 1.78, 0.98);
  coilShape.lineTo(0.68, 1.04);
  coilShape.lineTo(0.68, 0.76);
  coilShape.lineTo(1.62, 0.7);
  coilShape.quadraticCurveTo(2.12, 0.4, 2.12, 0.0);
  coilShape.quadraticCurveTo(2.12, -0.4, 1.62, -0.7);
  coilShape.lineTo(0.68, -0.76);
  coilShape.closePath();

  const coilGeo = new THREE.ExtrudeGeometry(coilShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.022,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  coilGeo.translate(0, 0, -0.08);

  const staticMagnetHousing = new THREE.Group();
  staticMagnetHousing.name = 'TokamakMagnetCasings';
  staticMagnetHousing.position.set(0, 1.25, 25.5);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const casing = new THREE.Mesh(coilGeo, coilMat);
    casing.rotation.y = ang;
    casing.name = `TokamakDCoil_${i}`;
    staticMagnetHousing.add(casing);

    // Armored Inter-Coil Shear Tie Beams connecting adjacent D-Coils into a rigid toroidal cage
    const midAng = ang + Math.PI / 8;
    [-0.58, 0.58].forEach((sy) => {
      const tie = new THREE.Mesh(
        new RoundedBoxGeometry(0.14, 0.12, 0.88, 2, 0.015),
        frameMat,
      );
      tie.position.set(Math.cos(midAng) * 2.28, sy, Math.sin(midAng) * 2.28);
      tie.rotation.y = -midAng;
      staticMagnetHousing.add(tie);
    });
  }

  // Segmented Tungsten First-Wall Divertor Tiles + Flush Copper Equator Busbar Conduit
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tile = new THREE.Mesh(
      new RoundedBoxGeometry(0.28, 0.14, 0.46, 2, 0.015),
      shieldMat,
    );
    tile.position.set(Math.cos(a) * 1.15, -0.62, Math.sin(a) * 1.15);
    tile.rotation.y = -a + Math.PI / 2;
    staticMagnetHousing.add(tile);
  }

  // Dual Top/Bottom Superconducting Cryostat Collector Manifolds (keeps equatorial tokamak viewport unobstructed)
  [-0.86, 0.86].forEach((by, idx) => {
    const busRing = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.042, 10, 40), mats.copperPipe);
    busRing.rotation.x = Math.PI / 2;
    busRing.position.y = by;
    busRing.name = `TokamakPoloidalCollector_${idx}`;
    staticMagnetHousing.add(busRing);
  });

  // Low-profile superconducting divertor collector rings at top/bottom throat ONLY
  const throatCollarTop = buildVacuumFlangeCollar({
    innerR: 0.42,
    outerR: 0.68,
    thickness: 0.08,
    boltCount: 12,
    flangeMat: mats.chromePipe,
    boltMat: coilMat,
    name: 'TokamakInnerThroatTop',
  });
  throatCollarTop.rotation.x = Math.PI / 2;
  throatCollarTop.position.y = 0.94;
  const throatCollarBot = throatCollarTop.clone();
  throatCollarBot.position.y = -0.94;
  const centralPinchRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.04, 14, 36),
    mats.accentCyan,
  );
  centralPinchRing.rotation.x = Math.PI / 2;
  staticMagnetHousing.add(throatCollarTop, throatCollarBot, centralPinchRing);

  // Twin Deck-Mounted ConFlat Flange Manifolds WITH Continuous Cryo Bellows Risers into Tokamak Saddle
  [-1.95, 1.95].forEach((fx, idx) => {
    const flange = buildVacuumFlangeCollar({
      innerR: 0.09,
      outerR: 0.22,
      thickness: 0.055,
      boltCount: 8,
      flangeMat: mats.chromePipe,
      boltMat: coilMat,
      name: `TokamakDeckCryoFlange_${idx}`,
    });
    flange.rotation.x = Math.PI / 2;
    flange.position.set(fx, -0.22, 23.6);
    const riserBellows = buildCorrugatedBellows({
      radius: 0.075,
      length: 0.34,
      convolutions: 6,
      amplitude: 0.015,
      mat: mats.copperPipe,
      name: `TokamakDeckCryoBellows_${idx}`,
    });
    riserBellows.position.set(fx, -0.04, 23.6);
    const feedElbow = buildCableConduit(
      [
        [fx, 0.12, 23.6],
        [fx * 0.92, 0.34, 24.05],
        [fx * 0.84, 0.32, 24.42],
      ],
      0.055,
      mats.copperPipe,
      `TokamakDeckFeedElbow_${idx}`,
    );
    // Grounded Valve Manifold Junction Block tying copper cryo elbow cleanly into lower saddle shoulder
    const manifoldPod = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.44, 0.36, 2, 0.02),
      frameMat,
    );
    manifoldPod.position.set(fx * 0.84, 0.16, 24.48);
    manifoldPod.name = `TokamakCryoManifoldPod_${idx}`;
    reactorBay.add(flange, riserBellows, feedElbow, manifoldPod);
  });

  // Rotating Confinement Plasma Core & Poloidal Diagnostic Ring (`tokamakGroup` & `plasmaCore` API preserved!)
  const tokamakGroup = new THREE.Group();
  tokamakGroup.name = 'TokamakConfinementCore';
  tokamakGroup.position.set(0, 1.25, 25.5);

  const tokRingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x2563eb,
    emissiveIntensity: 0.85,
    roughness: 0.16,
    metalness: 0.1,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const plasmaCore = new THREE.Mesh(
    new THREE.TorusGeometry(1.62, 0.26, 20, 56),
    tokRingMat,
  );
  plasmaCore.rotation.x = Math.PI / 2;
  const innerPlasmaMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.92,
  });
  const innerPlasmaFilament = new THREE.Mesh(
    new THREE.TorusGeometry(1.62, 0.08, 16, 56),
    innerPlasmaMat,
  );
  const violetHaloMat = new THREE.MeshBasicMaterial({
    color: 0xc084fc,
    transparent: true,
    opacity: 0.28,
  });
  const violetHalo = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.34, 14, 48), violetHaloMat);
  plasmaCore.add(innerPlasmaFilament, violetHalo);

  const fluxBand = new THREE.Mesh(
    new THREE.TorusGeometry(1.88, 0.028, 10, 40),
    mats.accentCyan,
  );
  fluxBand.rotation.x = Math.PI / 2;
  fluxBand.rotation.y = 0.2;
  tokamakGroup.add(plasmaCore, fluxBand);

  reactorBay.add(staticMagnetHousing, tokamakGroup);
  return { reactorBay, tokamakGroup, plasmaCore };
}

/**
 * High-Voltage Fluted Ceramic Insulator Discharge Tower for aft capacitor banks.
 */
function buildHVInsulatorStack(mats, name = 'HVInsulator') {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.18, 0),
    new THREE.Vector2(0.16, 0.12),
    new THREE.Vector2(0.1, 0.16),
    new THREE.Vector2(0.15, 0.24),
    new THREE.Vector2(0.1, 0.32),
    new THREE.Vector2(0.15, 0.4),
    new THREE.Vector2(0.09, 0.48),
    new THREE.Vector2(0.13, 0.58),
    new THREE.Vector2(0, 0.58),
  ];
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mats.labCeramic || mats.chromePipe);
  mesh.name = name;
  return mesh;
}

/**
 * Spare MPD Thruster Nozzle & Diagnostic Service Bench along starboard engineering bay.
 */
function buildSpareThrusterServiceStation(mats) {
  const station = new THREE.Group();
  station.name = 'Eng_SpareThrusterServiceBench';
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  const bench = buildCantileveredWorkbench({
    width: 1.75,
    depth: 0.72,
    height: 0.84,
    frameMat,
    topMat: mats.workSurface,
    trimMat: mats.accentAmber,
    name: 'EngRepairWorkbench',
  });
  station.add(bench);

  // Spare Magnetic Plasma Nozzle Resting on Cushioned Chocks on Benchtop
  const nozzleProfile = [
    new THREE.Vector2(0.14, -0.35),
    new THREE.Vector2(0.16, -0.18),
    new THREE.Vector2(0.12, -0.05),
    new THREE.Vector2(0.24, 0.26),
    new THREE.Vector2(0.26, 0.32),
    new THREE.Vector2(0.21, 0.32),
    new THREE.Vector2(0.1, -0.04),
    new THREE.Vector2(0.11, -0.35),
  ];
  const spareNozzle = new THREE.Mesh(
    new THREE.LatheGeometry(nozzleProfile, 24),
    mats.chromePipe,
  );
  spareNozzle.rotation.z = Math.PI / 2;
  spareNozzle.position.set(-0.22, 1.09, 0.02);

  const spareCoil = buildCorrugatedBellows({
    radius: 0.13,
    length: 0.22,
    convolutions: 5,
    amplitude: 0.018,
    mat: mats.copperPipe,
    name: 'SpareThrusterBellows',
  });
  spareCoil.rotation.z = Math.PI / 2;
  spareCoil.position.set(0.32, 1.05, 0.02);

  station.add(spareNozzle, spareCoil);
  return station;
}

/**
 * CUBIERTA 04: INGENIERÍA INDUSTRIAL — REACTOR TOKAMAK D-He3, CAPACITORES HV, CRIOGENIA E IMPULSO MPD.
 */
export function buildEngineeringSector3D(root, mats, registerConsole) {
  const g = new THREE.Group();
  g.name = 'Sector_Engineering_Deck04';
  const engLen = 27.5; // Z: +12.5 .. +40.0
  const engZ = 26.25;

  const hullMat = mats.engShield || mats.bulkhead;
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;
  const coilMat = mats.darkTitaniumCoil || frameMat;

  // Heavy industrial radiation-shielded matte composite hull cladding (zero UV brick stretch!)
  const cylShell = new THREE.Mesh(
    new THREE.CylinderGeometry(4.55, 4.55, engLen, 26, 1, true),
    hullMat,
  );
  cylShell.rotation.x = Math.PI / 2;
  cylShell.position.set(0, 0.0, engZ);
  g.add(cylShell);

  // Heavy Grounded Industrial Chamfered Portal Frames + Overhead Reactor Crane Gantry Rails (NO floating hoops!)
  for (let rz = 14.5; rz <= 38.0; rz += 3.9) {
    const portalRib = buildCylindricalPortalRib({
      radius: 4.52,
      floorLocalY: -0.25,
      beamWidth: 0.22,
      beamDepth: 0.26,
      segments: 16,
      mats,
      frameMat: coilMat,
      lightMat: mats.amberServiceDiffuser || mats.warmDiffuser,
      lightWidth: 1.65,
      skipSideFloorDrop: rz < 19.0 ? 'both' : null,
      name: `EngPortalRib_${rz.toFixed(1)}`,
    });
    portalRib.position.set(0, 0, rz);
    g.add(portalRib);
  }

  // Twin Overhead Service Crane Gantry I-Beams & Reactor Maintenance Trolley (Z: 15 .. 37)
  [-2.35, 2.35].forEach((gx) => {
    const gantryRail = new THREE.Mesh(
      new RoundedBoxGeometry(0.18, 0.24, 22.8, 2, 0.015),
      frameMat,
    );
    gantryRail.position.set(gx, 3.35, 26.0);
    g.add(gantryRail);
  });
  const gantryBridge = new THREE.Mesh(new RoundedBoxGeometry(5.1, 0.2, 0.36, 2, 0.02), mats.hazardTrim);
  gantryBridge.position.set(0, 3.48, 25.5);
  const craneHoist = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.34, 0.56, 2, 0.02), frameMat);
  craneHoist.position.set(0, 3.24, 25.5);
  g.add(gantryBridge, craneHoist);

  // Stern MPD Propulsion Injector Manifold Bulkhead (Z = 40.0)
  const aftBulkhead = new THREE.Mesh(new THREE.CircleGeometry(4.55, 26), hullMat);
  aftBulkhead.position.set(0, 0, 40.0);
  g.add(aftBulkhead);

  [-1.85, 0, 1.85].forEach((mx, idx) => {
    const flange = buildVacuumFlangeCollar({
      innerR: idx === 1 ? 0.68 : 0.4,
      outerR: idx === 1 ? 1.02 : 0.66,
      thickness: 0.1,
      boltCount: 14,
      flangeMat: frameMat,
      boltMat: mats.chromePipe,
      name: `MPDInjectorFlange_${idx}`,
    });
    flange.position.set(mx, 0.85, 39.88);
    const thrusterFeedRing = new THREE.Mesh(
      new THREE.TorusGeometry(idx === 1 ? 0.82 : 0.5, 0.075, 12, 24),
      mats.copperPipe,
    );
    thrusterFeedRing.position.set(mx, 0.85, 39.72);
    const collectorCore = new THREE.Mesh(
      new THREE.CylinderGeometry(idx === 1 ? 0.45 : 0.3, idx === 1 ? 0.55 : 0.38, 0.65, 18),
      mats.chromePipe,
    );
    collectorCore.rotation.x = Math.PI / 2;
    collectorCore.position.set(mx, 0.85, 39.55);
    g.add(flange, thrusterFeedRing, collectorCore);
  });

  // Upper Catwalk Deck (Y = -0.25m, split around vertical shaft well at Z: 15.0..18.2)
  const upperFore = new THREE.Mesh(new RoundedBoxGeometry(7.2, 0.16, 2.8, 2, 0.02), mats.floorDeck);
  upperFore.position.set(0, -0.33, 13.8);
  const upperAft = new THREE.Mesh(new RoundedBoxGeometry(8.6, 0.16, 21.5, 2, 0.02), mats.floorDeck);
  upperAft.position.set(0, -0.33, 29.0);
  g.add(upperFore, upperAft);

  [-2.6, 2.6].forEach((cx) => {
    const wingDeck = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.16, 3.2, 2, 0.02), mats.floorDeck);
    wingDeck.position.set(cx, -0.33, 16.6);
    g.add(wingDeck);
  });

  // Safety hazard curb around Vertical Shaft hatch
  [
    { pos: [0, -0.22, 15.1], size: [2.6, 0.07, 0.16] },
    { pos: [0, -0.22, 18.15], size: [2.6, 0.07, 0.16] },
  ].forEach(({ pos, size }) => {
    const curb = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 2, 0.01), mats.hazardTrim);
    curb.position.set(...pos);
    g.add(curb);
  });

  [-1.25, 1.25].forEach((gx, idx) => {
    g.add(
      buildCurvedGrabRail({
        start: [gx, -3.15, 16.5],
        end: [gx, 0.88, 16.5],
        standoffDir: [-Math.sign(gx) * 0.05, 0, 0],
        radius: 0.026,
        mat: mats.grabRail,
        mountMat: frameMat,
        name: `EngShaftVerticalRail_${idx}`,
      }),
    );
  });
  [-1, 1].forEach((side) => {
    g.add(
      buildCurvedGrabRail({
        start: [side * 3.8, 0.55, 19.0],
        end: [side * 3.8, 0.55, 34.0],
        standoffDir: [-side * 0.08, 0, 0],
        radius: 0.024,
        mat: mats.grabRail,
        mountMat: frameMat,
        name: `EngCatwalkRail_${side > 0 ? 'S' : 'P'}`,
      }),
    );
  });

  // Hero Grounded Toroidal Tokamak Reactor
  const { reactorBay, tokamakGroup, plasmaCore } = buildShieldedTokamakAssembly(mats);
  g.add(reactorBay);

  // Engineering Reactor Shielded Control Pulpit ('engineering') integrated into safety balustrade
  const engDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'engineering');
  const engConsole = buildSculptedStationConsole(engDef, mats, {
    width: 1.95,
    accentHex: '#fb7185',
    waveformMode: 'tokamak',
    style: 'pulpit',
    withBeacon: false,
    frameMat,
    topMat: mats.workSurface,
    extraLines: [
      'TOROIDE D-He3 · CAMPO: 12.4 TESLA',
      'CRIOSTATO He-II: 1.9 K · POTENCIA NOMINAL',
      'PULSA [E] PARA DIAGNÓSTICO DEL REACTOR',
    ],
  });
  registerConsole(engConsole);
  g.add(engConsole.group);

  // High-Voltage Pulse Capacitor Discharge Switchgear & Ceramic Insulator Stacks
  [-3.55, 3.55].forEach((rx, idx) => {
    const hvRack = buildModularRackBay({
      width: 2.15,
      height: 2.1,
      depth: 0.46,
      label: idx === 0 ? 'BUS ALTA TENSIÓN MPD' : 'CONTROL MAGNÉTICO TOROIDAL',
      accentHex: '#fb7185',
      mats,
      frameMat,
      name: `EngSwitchgearBay_${idx}`,
    });
    hvRack.position.set(rx, -0.25, 29.8);
    hvRack.rotation.y = rx < 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(hvRack);

    const insA = buildHVInsulatorStack(mats, `HVStack_${idx}_A`);
    insA.position.set(rx - Math.sign(rx) * 0.35, -0.25, 32.0);
    g.add(insA);
  });

  // Starboard Aft Spare MPD Thruster & Maintenance Workbench
  const serviceStation = buildSpareThrusterServiceStation(mats);
  serviceStation.position.set(3.15, -0.25, 35.0);
  serviceStation.rotation.y = -Math.PI / 2;
  g.add(serviceStation);

  const engSign = buildSectorPlacard({
    code: 'C04',
    title: 'NÚCLEO TOKAMAK D-He3 Y PROPULSIÓN MPD',
    accentHex: '#fb7185',
    width: 2.1,
    height: 0.34,
    mats,
    name: 'Placard_Engineering',
  });
  engSign.position.set(0, 2.35, 12.85);
  g.add(engSign);

  // Lower Cryo & Coolant Machinery Bay (Y = -3.25m, Z: 13..31m)
  const lowerFloor = new THREE.Mesh(new RoundedBoxGeometry(5.8, 0.16, 18.2, 2, 0.02), mats.floorDeck);
  lowerFloor.position.set(0, -3.33, 22.0);
  g.add(lowerFloor);

  const dewarProfile = [
    new THREE.Vector2(0.0, -3.05),
    new THREE.Vector2(0.45, -2.98),
    new THREE.Vector2(0.82, -2.55),
    new THREE.Vector2(0.86, 2.55),
    new THREE.Vector2(0.45, 2.98),
    new THREE.Vector2(0.0, 3.05),
  ];
  const dewarGeo = new THREE.LatheGeometry(dewarProfile, 24);
  dewarGeo.rotateX(Math.PI / 2);

  [-2.15, 2.15].forEach((dx, idx) => {
    const tank = new THREE.Mesh(dewarGeo, mats.chromePipe);
    tank.position.set(dx, -2.08, 24.0);
    tank.name = `LowerBay_HeIIDewar_${idx}`;
    g.add(tank);

    [21.8, 26.2].forEach((sz) => {
      const saddle = new THREE.Mesh(new RoundedBoxGeometry(1.58, 1.15, 0.28, 2, 0.02), coilMat);
      saddle.position.set(dx, -2.75, sz);
      g.add(saddle);
    });

    g.add(
      buildCableConduit(
        [
          [dx, -1.25, 22.2],
          [dx * 1.02, -0.75, 23.0],
          [dx * 0.91, -0.22, 23.6],
        ],
        0.045,
        mats.copperPipe,
        `CryoHeliumRiser_${idx}`,
      ),
    );
  });

  const pumpSkid = buildModularRackBay({
    width: 1.55,
    height: 1.55,
    depth: 0.56,
    label: 'BOMBA CRIOGÉNICA PRIMARIA',
    accentHex: '#38bdf8',
    mats,
    frameMat,
    name: 'LowerBay_CryoPumpSkid',
  });
  pumpSkid.position.set(0, -3.25, 28.6);
  pumpSkid.rotation.y = Math.PI;
  g.add(pumpSkid);

  // Industrial Chiaroscuro Lighting (3 balanced key lights: Tokamak Cherenkov core + Fore/Aft Amber Catwalk + Lower Cryo)
  const tokLight = new THREE.PointLight(0x38bdf8, 1.95, 19.0, 1.48);
  tokLight.position.set(0, 1.65, 25.4);
  const serviceAmberFore = new THREE.PointLight(0xffa94d, 1.35, 16.0, 1.5);
  serviceAmberFore.position.set(0, 2.55, 20.5);
  const lowerLight = new THREE.PointLight(0xff9f45, 1.25, 16.5, 1.55);
  lowerLight.position.set(0, -1.65, 23.0);
  g.add(tokLight, serviceAmberFore, lowerLight);

  root.add(g);
  return { tokamakGroup, plasmaCore };
}
