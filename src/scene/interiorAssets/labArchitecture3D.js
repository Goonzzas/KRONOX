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
} from './aerospaceShapes.js';

/**
 * Hero Asset 1 (Port Pod): Horizontal Cantilevered SPHEREx Cryogenic IR Observatory &
 * Closed-Cycle Pulse-Tube Vacuum Dewar Bench.
 * Built with ConFlat bolted vacuum flanges, corrugated stainless steel cryogenic bellows,
 * copper cold-strap manifolds, and slotted thermal radiator fins.
 */
function buildSpherexCryostatAssembly(mats) {
  const cryostat = new THREE.Group();
  cryostat.name = 'Hero_SpherexCryostatAssembly';
  cryostat.position.set(-5.6, -1.55, -34.2);

  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  // 1. Heavy Cleanroom Vibration-Isolation Trunnion Pedestal
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.14, 1.85, 3, 0.025), frameMat);
  plinth.position.y = 0.07;
  cryostat.add(plinth);

  [-0.52, 0.52].forEach((tx, idx) => {
    const trunnionShape = new THREE.Shape();
    trunnionShape.moveTo(-0.32, 0.14);
    trunnionShape.lineTo(0.32, 0.14);
    trunnionShape.lineTo(0.18, 1.18);
    trunnionShape.lineTo(-0.18, 1.18);
    trunnionShape.closePath();

    const legGeo = new THREE.ExtrudeGeometry(trunnionShape, {
      depth: 0.11,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.014,
      bevelSegments: 2,
    });
    legGeo.translate(0, 0, -0.055);
    legGeo.rotateY(Math.PI / 2);

    const pillar = new THREE.Mesh(legGeo, frameMat);
    pillar.position.set(tx, 0, -0.04);
    pillar.name = `CryoTrunnionPillar_${idx}`;
    cryostat.add(pillar);
  });

  // 2. Cantilevered Horizontal Cryogenic Telescope Barrel & Dewar Assembly (tilted 20 deg upward)
  const otaPivot = new THREE.Group();
  otaPivot.name = 'SpherexCryoOpticalAssembly';
  otaPivot.position.set(0, 1.24, 0.02);
  otaPivot.rotation.x = 0.34;
  cryostat.add(otaPivot);

  // Outer cradle collar clamping telescope at balance center
  const cradleRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.048, 12, 28), frameMat);
  cradleRing.position.z = 0.0;
  otaPivot.add(cradleRing);

  // Gold Kapton MLI center vacuum cryostat jacket + signature SPHEREx V-groove nested photon shields
  const mliBody = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.92, 28), mats.goldFoil);
  mliBody.rotation.x = Math.PI / 2;
  mliBody.position.z = -0.04;
  otaPivot.add(mliBody);

  // Nested V-groove conical radiative sunshields (iconic NASA SPHEREx silhouette)
  [
    { rBot: 0.48, rTop: 0.72, h: 0.42, z: -0.45, mat: mats.chromePipe },
    { rBot: 0.54, rTop: 0.84, h: 0.44, z: -0.62, mat: mats.goldFoil },
  ].forEach((sh) => {
    const shieldCone = new THREE.Mesh(
      new THREE.CylinderGeometry(sh.rTop, sh.rBot, sh.h, 28, 1, true),
      sh.mat,
    );
    shieldCone.rotation.x = -Math.PI / 2;
    shieldCone.position.z = sh.z;
    otaPivot.add(shieldCone);
  });

  // Twin bolted stainless steel ConFlat vacuum flanges fore & aft of MLI chamber
  [-0.5, 0.42].forEach((fz, idx) => {
    const cf = buildVacuumFlangeCollar({
      innerR: 0.36,
      outerR: 0.49,
      thickness: 0.045,
      boltCount: 12,
      flangeMat: mats.chromePipe,
      boltMat: frameMat,
      name: `Spherex_ConFlatFlange_${idx}`,
    });
    cf.position.z = fz;
    otaPivot.add(cf);
  });

  // Forward Carbon-Black Optical Sunshade Baffle Hood & Cold IR Window
  const baffleTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.41, 0.56, 28, 1, true),
    mats.carbonFiber,
  );
  baffleTube.rotation.x = Math.PI / 2;
  baffleTube.position.z = -0.78;
  const baffleLip = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.022, 10, 28), frameMat);
  baffleLip.position.z = -1.06;
  const irLens = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 24), mats.accentEmerald);
  irLens.rotation.x = Math.PI / 2;
  irLens.position.z = -0.6;
  const spiderHub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), frameMat);
  spiderHub.rotation.x = Math.PI / 2;
  spiderHub.position.z = -0.88;
  [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((ang) => {
    const vane = new THREE.Mesh(new RoundedBoxGeometry(0.015, 0.41, 0.025, 1, 0.003), frameMat);
    vane.position.set(Math.cos(ang) * 0.21, Math.sin(ang) * 0.21, -0.82);
    vane.rotation.z = ang + Math.PI / 2;
    otaPivot.add(vane);
  });
  otaPivot.add(baffleTube, baffleLip, irLens, spiderHub);

  // Aft Detector Focal Plane Box & Stainless Corrugated Cryo Bellows + Flange Neck
  const fpaBox = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.62, 0.34, 3, 0.025), mats.labCeramic || mats.chromePipe);
  fpaBox.position.z = 0.62;
  const cryoBellows = buildCorrugatedBellows({
    radius: 0.14,
    length: 0.28,
    convolutions: 6,
    amplitude: 0.02,
    mat: mats.chromePipe,
    name: 'Cryostat_PulseTubeBellows',
  });
  cryoBellows.rotation.x = Math.PI / 2;
  cryoBellows.position.set(0, -0.06, 0.92);
  otaPivot.add(fpaBox, cryoBellows);

  // 3. Closed-Cycle Helium Cryocooler Compressor Skid, Turbo Pump & Slotted Heat Exchanger Fins
  const skid = new THREE.Group();
  skid.position.set(-1.05, 0.14, 0.44);
  const skidChassis = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.72, 0.78, 3, 0.025), mats.labCeramic || frameMat);
  skidChassis.position.y = 0.36;
  const radiator = buildHeatExchangerFins({
    width: 0.48,
    height: 0.56,
    depth: 0.18,
    finCount: 8,
    finMat: frameMat,
    frameMat: mats.chromePipe,
    name: 'CryoCompressorRadiator',
  });
  radiator.position.set(0, 0.36, 0.42);
  const turbopump = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.38, 18), mats.chromePipe);
  turbopump.position.set(0.08, 0.9, -0.08);
  const pumpCollar = buildVacuumFlangeCollar({
    innerR: 0.1,
    outerR: 0.17,
    thickness: 0.03,
    boltCount: 8,
    flangeMat: mats.chromePipe,
    boltMat: frameMat,
    name: 'TurboPumpFlange',
  });
  pumpCollar.rotation.x = Math.PI / 2;
  pumpCollar.position.set(0.08, 1.09, -0.08);
  skid.add(skidChassis, radiator, turbopump, pumpCollar);
  cryostat.add(skid);

  // Copper Cold-Strap Feed Loops & Stainless Vacuum Manifold
  cryostat.add(
    buildCableConduit(
      [
        [-0.95, 1.02, 0.36],
        [-0.58, 1.18, 0.55],
        [-0.22, 1.16, 0.72],
      ],
      0.026,
      mats.copperPipe,
      'CryoHeliumFeedLoop',
    ),
    buildCableConduit(
      [
        [-0.95, 0.82, 0.46],
        [-0.6, 0.94, 0.68],
        [-0.08, 1.08, 0.88],
      ],
      0.022,
      mats.chromePipe,
      'CryoVacuumLine',
    ),
  );

  return cryostat;
}

/**
 * Hero Asset 2 (Starboard Pod): Vibration-Isolated M6 Optical Calibration Bench.
 * Perforated optical breadboard slab, corrugated elastomeric isolators,
 * gimbaled Au-Be parabolic mirror yoke with micrometers, dichroic filter wheel turret,
 * fin-cooled laser alignment emitter, and portable docked spectral scanner.
 */
function buildOpticalCalibrationBench(mats) {
  const bench = new THREE.Group();
  bench.name = 'Hero_PrecisionOpticalBench';
  bench.position.set(5.6, -1.55, -31.65);

  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  // Lower vibration-isolated welded base frame + 4 pneumatic leg isolators with corrugated dampers
  const lowerFrame = new THREE.Mesh(
    new RoundedBoxGeometry(1.22, 0.08, 1.98, 2, 0.015),
    frameMat,
  );
  lowerFrame.position.y = 0.08;
  bench.add(lowerFrame);

  const legProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0),
    new THREE.Vector2(0.1, 0.14),
    new THREE.Vector2(0.085, 0.52),
    new THREE.Vector2(0.105, 0.62),
    new THREE.Vector2(0.07, 0.76),
    new THREE.Vector2(0, 0.76),
  ];
  const legGeo = new THREE.LatheGeometry(legProfile, 18);
  [-0.56, 0.56].forEach((lx, ix) => {
    [-0.86, 0.86].forEach((lz, iz) => {
      const isolator = new THREE.Mesh(legGeo, mats.chromePipe);
      isolator.position.set(lx, 0.06, lz);
      const bellows = buildCorrugatedBellows({
        radius: 0.105,
        length: 0.16,
        convolutions: 4,
        amplitude: 0.014,
        mat: mats.carbonFiber,
        name: `BenchIsolatorBellows_${ix}_${iz}`,
      });
      bellows.position.set(lx, 0.64, lz);
      bench.add(isolator, bellows);
    });
  });

  // Chamfered M6 Optical Breadboard Honeycomb Slab
  const opticalCore = new THREE.Mesh(
    new RoundedBoxGeometry(1.48, 0.12, 2.22, 3, 0.02),
    frameMat,
  );
  opticalCore.position.y = 0.88;
  const breadboardTop = new THREE.Mesh(
    new RoundedBoxGeometry(1.42, 0.03, 2.16, 2, 0.008),
    mats.opticalBreadboard,
  );
  breadboardTop.position.y = 0.945;
  bench.add(opticalCore, breadboardTop);

  // Sub-Stage 1: Sculpted 3-Axis Parabolic Au-Be Primary Mirror Gimbal Assembly
  const mirrorYoke = new THREE.Group();
  mirrorYoke.name = 'OpticalBench_FixedYoke';
  mirrorYoke.position.set(0, 1.38, -0.58);

  const yokeBase = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.06, 0.24, 2, 0.015), frameMat);
  yokeBase.position.y = -0.39;
  mirrorYoke.add(yokeBase);
  [-0.46, 0.46].forEach((yx) => {
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.48, 0.16, 2, 0.015), frameMat);
    arm.position.set(yx, -0.16, 0);
    const micrometer = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12), mats.chromePipe);
    micrometer.rotation.z = Math.PI / 2;
    micrometer.position.set(yx + Math.sign(yx) * 0.07, 0.02, 0);
    mirrorYoke.add(arm, micrometer);
  });

  const mirrorHousing = new THREE.Group();
  mirrorHousing.name = 'OpticalBench_MirrorGimbal';
  mirrorHousing.position.set(0, 1.38, -0.58);

  const mirrorBezel = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.042, 14, 32), frameMat);
  const mirrorBack = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.36, 0.11, 28), frameMat);
  mirrorBack.rotation.x = Math.PI / 2;
  mirrorBack.position.z = -0.055;

  const mirrorProfile = [
    new THREE.Vector2(0.0, -0.022),
    new THREE.Vector2(0.18, -0.008),
    new THREE.Vector2(0.32, 0.018),
    new THREE.Vector2(0.385, 0.048),
  ];
  const auBeMirrorMat = new THREE.MeshStandardMaterial({
    color: 0xd9a134,
    metalness: 0.94,
    roughness: 0.1,
    emissive: 0x221600,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
  });
  const mirrorDish = new THREE.Mesh(new THREE.LatheGeometry(mirrorProfile, 36), auBeMirrorMat);
  mirrorDish.rotation.x = Math.PI / 2;
  mirrorDish.position.z = 0.008;

  // Hexagonal beryllium lightweighting lattice rings etched across optical aperture rim
  const mirrorInnerRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 8, 6), frameMat);
  mirrorInnerRing.position.z = 0.022;
  mirrorHousing.add(mirrorInnerRing);

  const spiderHub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.035, 16), frameMat);
  spiderHub.rotation.x = Math.PI / 2;
  spiderHub.position.z = 0.085;
  [Math.PI * 0.5, -Math.PI / 6, (Math.PI * 7) / 6].forEach((ang) => {
    const strut = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.38, 0.018, 1, 0.003), frameMat);
    strut.position.set(Math.cos(ang) * 0.2, Math.sin(ang) * 0.2, 0.055);
    strut.rotation.z = ang + Math.PI / 2;
    mirrorHousing.add(strut);
  });
  mirrorHousing.add(mirrorBezel, mirrorBack, mirrorDish, spiderHub);

  // Sub-Stage 2: Motorized Spoked Dichroic Filter Wheel Turret (`filterWheel`)
  const wheelX = 0.32;
  const wheelY = 1.24;
  const wheelZ = 0.2;
  const turretMount = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.2, 0.16, 2, 0.015), frameMat);
  turretMount.position.set(wheelX, 1.06, wheelZ);
  const servoMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.16, 14), mats.carbonFiber);
  servoMotor.rotation.x = Math.PI / 2;
  servoMotor.position.set(wheelX + 0.18, 1.16, wheelZ);

  const filterWheel = new THREE.Group();
  filterWheel.name = 'OpticalBench_FilterWheel';
  filterWheel.position.set(wheelX, wheelY, wheelZ);
  const wheelOuterRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 12, 28), frameMat);
  const wheelTrim = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.012, 10, 28), mats.accentEmerald);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16), mats.chromePipe);
  wheelHub.rotation.x = Math.PI / 2;
  filterWheel.add(wheelOuterRim, wheelTrim, wheelHub);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const cellRing = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.008, 8, 16), frameMat);
    cellRing.position.set(Math.cos(ang) * 0.145, Math.sin(ang) * 0.145, 0);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.024, 14),
      i % 2 === 0 ? mats.viewportGlass : mats.accentCyan,
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(Math.cos(ang) * 0.145, Math.sin(ang) * 0.145, 0);
    filterWheel.add(cellRing, lens);
  }

  // Sub-Stage 3: Machined Cylindrical Tunable IR Reference Laser Cavity + Kinematic Fold Optics (`calibBeam`)
  const laserRailBase = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.045, 0.22, 2, 0.01), frameMat);
  laserRailBase.position.set(-0.34, 0.98, 0.68);
  const laserSource = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.095, 0.34, 22), frameMat);
  laserSource.rotation.z = Math.PI / 2;
  laserSource.position.set(-0.34, 1.24, 0.68);
  const laserMountCollar = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.018, 10, 20), mats.copperPipe);
  laserMountCollar.rotation.y = Math.PI / 2;
  laserMountCollar.position.set(-0.28, 1.24, 0.68);
  const laserStanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, 0.24, 12), mats.chromePipe);
  laserStanchion.position.set(-0.34, 1.09, 0.68);
  const laserHeatSink = buildHeatExchangerFins({
    width: 0.2,
    height: 0.09,
    depth: 0.22,
    finCount: 6,
    finMat: frameMat,
    frameMat: mats.chromePipe,
    name: 'LaserSourceHeatSink',
  });
  laserHeatSink.position.set(-0.36, 1.35, 0.68);
  const laserEmit = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.1, 16), mats.copperPipe);
  laserEmit.rotation.z = Math.PI / 2;
  laserEmit.position.set(-0.18, 1.24, 0.68);

  // Kinematic Fold Optic Ring Mount + Machined Beam Splitter Chamber (replaces chunky gray blocks!)
  const foldPost = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.042, 0.24, 14), frameMat);
  foldPost.position.set(wheelX, 1.08, 0.68);
  const foldRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 10, 20), frameMat);
  foldRing.position.set(wheelX, 1.24, 0.68);
  foldRing.rotation.y = Math.PI / 4;
  const beamSplitterCube = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.11, 0.11, 2, 0.01), mats.viewportGlass);
  beamSplitterCube.position.set(wheelX, 1.24, 0.68);

  // Cylindrical Cryo-Jacketed IR Photodiode Detector Barrel on dovetail post
  const detectorPost = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.042, 0.24, 14), frameMat);
  detectorPost.position.set(-0.18, 1.08, 0.2);
  const detectorBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.084, 0.24, 20), frameMat);
  detectorBlock.rotation.x = Math.PI / 2;
  detectorBlock.position.set(-0.18, 1.22, 0.24);
  const detectorAperture = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.04, 16), mats.accentCyan);
  detectorAperture.rotation.x = Math.PI / 2;
  detectorAperture.position.set(-0.18, 1.22, 0.11);
  bench.add(laserRailBase, laserMountCollar, laserStanchion, foldRing, detectorPost);

  const beamMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.72 });
  const pumpSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.52, 8), beamMat);
  pumpSeg.rotation.z = Math.PI / 2;
  pumpSeg.position.set(0.05, 1.24, 0.68);

  const pStart = new THREE.Vector3(wheelX, 1.24, 0.68);
  const pEnd = new THREE.Vector3(0.0, 1.38, -0.54);
  const pDir = new THREE.Vector3().subVectors(pEnd, pStart);
  const calibBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, pDir.length(), 10),
    beamMat,
  );
  calibBeam.position.copy(pStart).lerp(pEnd, 0.5);
  calibBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pDir.clone().normalize());

  const rEnd = new THREE.Vector3(-0.18, 1.22, 0.12);
  const rDir = new THREE.Vector3().subVectors(rEnd, pEnd);
  const returnSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, rDir.length(), 8), beamMat);
  returnSeg.position.copy(pEnd).lerp(rEnd, 0.5);
  returnSeg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rDir.clone().normalize());

  // Portable Handheld Spectral Scanner docked cleanly inside contoured bench cradle
  const scannerBody = new THREE.Group();
  scannerBody.name = 'DockedSpectralScanner';
  scannerBody.position.set(0.46, 0.96, 0.8);
  scannerBody.rotation.y = 0.25;
  const cradleBase = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.032, 0.22, 2, 0.01), mats.chromePipe);
  const scGrip = new THREE.Mesh(new RoundedBoxGeometry(0.092, 0.055, 0.16, 2, 0.016), mats.carbonFiber || frameMat);
  scGrip.position.set(0, 0.036, 0.01);
  const scBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.044, 0.14, 16), frameMat);
  scBarrel.rotation.x = Math.PI / 2;
  scBarrel.position.set(0, 0.046, -0.09);
  const scCollar = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 8, 16), mats.copperPipe);
  scCollar.position.set(0, 0.046, -0.06);
  const scOled = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.008, 0.09, 1, 0.003), mats.accentCyan);
  scOled.position.set(0, 0.066, 0.02);
  const scLens = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.018, 14), mats.accentCyan);
  scLens.rotation.x = Math.PI / 2;
  scLens.position.set(0, 0.046, -0.16);
  scannerBody.add(cradleBase, scGrip, scBarrel, scCollar, scOled, scLens);

  bench.add(
    buildCableConduit(
      [
        [wheelX + 0.22, 1.16, wheelZ],
        [0.58, 0.94, 0.32],
        [0.64, 0.45, 0.22],
        [0.56, 0.08, 0.14],
      ],
      0.016,
      mats.carbonFiber,
      'BenchFiberOpticLoom',
    ),
  );

  bench.add(
    turretMount,
    servoMotor,
    mirrorYoke,
    mirrorHousing,
    filterWheel,
    laserSource,
    laserHeatSink,
    laserEmit,
    foldPost,
    beamSplitterCube,
    detectorBlock,
    detectorAperture,
    pumpSeg,
    calibBeam,
    returnSeg,
    scannerBody,
  );
  return { bench, mirrorHousing, filterWheel, calibBeam };
}

/**
 * CUBIERTA 02: LABORATORIO CIENTÍFICO CLEANROOM SPHEREx, BANCO ÓPTICO Y CÚPULA DE ARCHIVO.
 */
export function buildScienceSectorPods3D(root, mats, registerConsole) {
  const g = new THREE.Group();
  g.name = 'Sector_SciencePods_Deck02';
  const podLen = 16.4; // Z: -37.2 .. -20.8
  const podCenterZ = -29.0;
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;
  const wallMat = mats.labCeramic || mats.workSurface;
  const vaultMat = mats.labAcoustic || mats.thermalQuilt;
  const floorMat = mats.labDeck || mats.floorDeck;

  [-1, 1].forEach((side) => {
    const cx = side * 5.6;
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(2.34, 2.34, podLen, 24, 1, true),
      vaultMat,
    );
    shell.rotation.x = Math.PI / 2;
    shell.position.set(cx, 0, podCenterZ);
    g.add(shell);

    // Bright composite ceramic laboratory bulkheads sealing port & starboard pods
    const endCapF = new THREE.Mesh(new THREE.CircleGeometry(2.34, 24), wallMat);
    endCapF.position.set(cx, 0, podCenterZ - podLen * 0.5);
    const endCapA = endCapF.clone();
    endCapA.position.z = podCenterZ + podLen * 0.5;
    g.add(endCapF, endCapA);

    // Cleanroom antistatic deck tiles + bolted side structural deck curbs
    const floor = new THREE.Mesh(
      new RoundedBoxGeometry(3.52, 0.16, podLen, 2, 0.02),
      floorMat,
    );
    floor.position.set(cx, -1.62, podCenterZ);
    const outerSkirt = new THREE.Mesh(
      new RoundedBoxGeometry(0.18, 0.42, podLen - 0.2, 2, 0.02),
      frameMat,
    );
    outerSkirt.position.set(cx + side * 1.66, -1.36, podCenterZ);
    g.add(floor, outerSkirt);

    // Overhead longitudinal HEPA laminar-flow cleanroom utility plenum spine
    const hepaTrunk = new THREE.Mesh(
      new RoundedBoxGeometry(0.95, 0.14, podLen - 0.8, 2, 0.02),
      frameMat,
    );
    hepaTrunk.position.set(cx, 2.22, podCenterZ);
    g.add(hepaTrunk);

    // Grounded Faceted Aerospace Cleanroom Bulkhead Ribs + Crown Diffusers (NO severed chrome torus hoops!)
    for (let rz = -35.8; rz <= -22.2; rz += 3.4) {
      const clearDoorway = Math.abs(rz + 29.0) < 2.2;
      const rib = buildCylindricalPortalRib({
        radius: 2.32,
        floorLocalY: -1.55,
        beamWidth: 0.14,
        beamDepth: 0.18,
        segments: 14,
        mats,
        frameMat,
        lightMat: mats.coolDiffuser,
        lightWidth: 1.05,
        skipSideFloorDrop: clearDoorway ? (side < 0 ? 'stbd' : 'port') : null,
        name: `ScienceRib_${side > 0 ? 'S' : 'P'}_${rz.toFixed(1)}`,
      });
      rib.position.set(cx, 0, rz);
      g.add(rib);
    }

    // Outer Lab Wall Cleanroom ISPR Rack Bays (bow & aft instrumentation bays)
    const outerSideX = cx + side * 1.72;
    const rackA = buildModularRackBay({
      width: 1.55,
      height: 1.85,
      depth: 0.42,
      label: side < 0 ? 'PROCESADOR FITS' : 'TELEMETRÍA ÓPTICA',
      accentHex: '#10b981',
      mats,
      frameMat,
      name: `ScienceOuterRack_${side > 0 ? 'S' : 'P'}`,
    });
    rackA.position.set(outerSideX - side * 0.16, -1.55, -24.5);
    rackA.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const rackB = buildModularRackBay({
      width: 1.45,
      height: 1.75,
      depth: 0.4,
      label: side < 0 ? 'CRIO-CONTROL He' : 'INTERFERÓMETRO',
      accentHex: '#38bdf8',
      mats,
      frameMat,
      name: `ScienceSideRackBow_${side > 0 ? 'S' : 'P'}`,
    });
    rackB.position.set(outerSideX - side * 0.16, -1.55, -33.2);
    rackB.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(rackA, rackB);

    g.add(
      buildCurvedGrabRail({
        start: [cx - side * 1.62, -0.35, -35.8],
        end: [cx - side * 1.62, -0.35, -22.2],
        standoffDir: [side * 0.08, 0, 0],
        radius: 0.022,
        mat: mats.grabRail,
        mountMat: frameMat,
        name: `ScienceGrabRail_${side > 0 ? 'S' : 'P'}`,
      }),
    );

    // Calibrated 4800K Neutral Cleanroom Key Light (1 per pod, paired with cove diffusers)
    const podKeyLight = new THREE.PointLight(side < 0 ? 0xe6f2fc : 0xeafaf4, 1.55, 16.5, 1.55);
    podKeyLight.position.set(cx, 1.75, podCenterZ);
    g.add(podKeyLight);
  });

  // 1. PORT POD: NASA SPHEREx Spectroscopy Lectern ('science') + Cantilevered Cryostat Dewar
  const sciDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'science');
  const sciConsole = buildSculptedStationConsole(sciDef, mats, {
    width: 1.48,
    accentHex: '#34d399',
    waveformMode: 'spectrum',
    style: 'lectern',
    withBeacon: false,
    frameMat,
    topMat: mats.workSurface,
  });
  registerConsole(sciConsole);
  g.add(sciConsole.group);

  const cryostat = buildSpherexCryostatAssembly(mats);
  g.add(cryostat);

  const portPlacard = buildSectorPlacard({
    code: 'C02-B',
    title: 'OBSERVATORIO SPHEREx · CRIOSTATO IR',
    accentHex: '#34d399',
    width: 1.8,
    height: 0.3,
    mats,
    name: 'Placard_PortScience',
  });
  portPlacard.position.set(-5.6, 1.55, -36.9);
  g.add(portPlacard);

  // 2. STARBOARD POD: Precision Optical Metrology Bench ('sensor-calibration') + Compact Lectern
  const benchDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'sensor-calibration');
  const benchConsole = buildSculptedStationConsole(benchDef, mats, {
    width: 1.32,
    accentHex: '#10b981',
    waveformMode: 'spectrum',
    style: 'lectern',
    withFootRestraint: false,
    withBeacon: false,
    frameMat,
    topMat: mats.workSurface,
  });
  benchConsole.group.position.set(4.48, benchDef.position.y, -29.85);
  benchConsole.group.rotation.y = Math.atan2(
    benchDef.position.x - 4.48,
    benchDef.position.z - -29.85,
  );
  benchConsole.group.scale.setScalar(0.86);
  registerConsole(benchConsole);
  g.add(benchConsole.group);

  const { bench, mirrorHousing, filterWheel, calibBeam } = buildOpticalCalibrationBench(mats);
  g.add(bench);

  const spareCabinet = buildModularRackBay({
    width: 1.85,
    height: 2.0,
    depth: 0.44,
    label: 'REPUESTOS ÓPTICOS Au-Be',
    accentHex: '#10b981',
    mats,
    frameMat,
    name: 'Starboard_OpticsToolCabinet',
  });
  spareCabinet.position.set(5.6, -1.55, -21.3);
  spareCabinet.rotation.y = Math.PI;
  g.add(spareCabinet);

  const stbdPlacard = buildSectorPlacard({
    code: 'C02-E',
    title: 'BANCO ÓPTICO DE CALIBRACIÓN · Au-Be',
    accentHex: '#10b981',
    width: 1.85,
    height: 0.3,
    mats,
    name: 'Placard_StarboardOptics',
  });
  stbdPlacard.position.set(5.6, 1.55, -36.9);
  g.add(stbdPlacard);

  // 3. DORSAL CUPOLA ARCHIVE BAY ('archive' at Y:+1.65, Z:-26.0)
  const archWallF = new THREE.Mesh(new RoundedBoxGeometry(2.34, 2.38, 0.16, 2, 0.02), wallMat);
  archWallF.position.set(0, 2.55, -27.25);
  const archWallA = archWallF.clone();
  archWallA.position.z = -24.75;
  const archWallL = new THREE.Mesh(new RoundedBoxGeometry(0.16, 2.38, 2.52, 2, 0.02), wallMat);
  archWallL.position.set(-1.15, 2.55, -26.0);
  const archWallR = archWallL.clone();
  archWallR.position.x = 1.15;

  const domeRim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.065, 10, 24), frameMat);
  domeRim.rotation.x = Math.PI / 2;
  domeRim.position.set(0, 3.68, -26.0);
  const archRoof = new THREE.Mesh(new THREE.CircleGeometry(1.08, 24), mats.viewportGlass);
  archRoof.rotation.x = Math.PI / 2;
  archRoof.position.set(0, 3.72, -26.0);

  const archiveBladeBay = buildModularRackBay({
    width: 1.05,
    height: 1.55,
    depth: 0.28,
    label: 'ARCHIVO ESTELAR',
    accentHex: '#60a5fa',
    mats,
    frameMat,
    name: 'ArchiveDataBlades',
  });
  archiveBladeBay.position.set(-0.92, 1.72, -26.0);
  archiveBladeBay.rotation.y = Math.PI / 2;

  const archDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'archive');
  const archConsole = buildSculptedStationConsole(archDef, mats, {
    width: 1.24,
    accentHex: '#60a5fa',
    waveformMode: 'orbit',
    style: 'wallPanel',
    withBeacon: false,
    frameMat,
    topMat: mats.workSurface,
  });
  registerConsole(archConsole);

  g.add(
    buildCurvedGrabRail({
      start: [0.95, 0.2, -25.1],
      end: [0.95, 3.1, -25.1],
      standoffDir: [-0.07, 0, 0],
      radius: 0.022,
      mat: mats.grabRail,
      mountMat: frameMat,
      name: 'DorsalCupolaClimbRail',
    }),
  );
  const cupolaLight = new THREE.PointLight(0xd8ecff, 1.15, 7.2, 1.7);
  cupolaLight.position.set(0, 3.35, -26.0);

  g.add(archWallF, archWallA, archWallL, archWallR, domeRim, archRoof, archiveBladeBay, archConsole.group, cupolaLight);

  root.add(g);
  return { mirrorHousing, filterWheel, calibBeam };
}
