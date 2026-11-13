import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Eight required procedural microgravity EVA astronaut animation states.
 */
export const ASTRONAUT_ANIMATION_STATES = Object.freeze({
  IDLE_FLOAT: 'IDLE_FLOAT',
  HAND_PUSH: 'HAND_PUSH',
  THRUSTER_BURST: 'THRUSTER_BURST',
  GRAB_RAIL: 'GRAB_RAIL',
  STABILIZE: 'STABILIZE',
  CONSOLE_WORK: 'CONSOLE_WORK',
  REPAIR_INTERACT: 'REPAIR_INTERACT',
  CORRIDOR_SWIM: 'CORRIDOR_SWIM',
});

function createAstronautMaterials() {
  return {
    suitOuter: new THREE.MeshStandardMaterial({
      color: 0xd8e0ea,
      roughness: 0.62,
      metalness: 0.08,
    }),
    suitCrease: new THREE.MeshStandardMaterial({
      color: 0x5c687a,
      roughness: 0.74,
      metalness: 0.16,
    }),
    armorPlate: new THREE.MeshStandardMaterial({
      color: 0xc2ccd8,
      roughness: 0.36,
      metalness: 0.44,
    }),
    jointDark: new THREE.MeshStandardMaterial({
      color: 0x1b222c,
      roughness: 0.58,
      metalness: 0.38,
    }),
    harnessWeb: new THREE.MeshStandardMaterial({
      color: 0x2a3340,
      roughness: 0.78,
      metalness: 0.12,
    }),
    missionAccent: new THREE.MeshStandardMaterial({
      color: 0xd96b27,
      roughness: 0.4,
      metalness: 0.28,
    }),
    cyanTrim: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65,
      roughness: 0.28,
    }),
    visorGold: new THREE.MeshPhysicalMaterial({
      color: 0xc98a22,
      metalness: 0.9,
      roughness: 0.12,
      transparent: true,
      opacity: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    }),
    visorInnerTint: new THREE.MeshStandardMaterial({
      color: 0x141b24,
      metalness: 0.3,
      roughness: 0.2,
    }),
    helmetLamp: new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
    rcsPlumeMat: new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
    chromeHardware: new THREE.MeshStandardMaterial({
      color: 0x9aa8ba,
      metalness: 0.86,
      roughness: 0.24,
    }),
  };
}

function buildSculptedSegmentProfile(topR, midR, botR, length) {
  const pts = [
    new THREE.Vector2(topR * 0.84, 0),
    new THREE.Vector2(topR, -length * 0.14),
    new THREE.Vector2(midR, -length * 0.48),
    new THREE.Vector2(botR * 1.04, -length * 0.82),
    new THREE.Vector2(botR * 0.88, -length),
  ];
  return new THREE.LatheGeometry(pts, 18);
}

function addPleatedBellows(parent, radius, yCenter, rings, mats) {
  for (let i = 0; i < rings; i++) {
    const offset = (i - (rings - 1) * 0.5) * 0.02;
    const pleat = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.011, 8, 16),
      i % 2 === 0 ? mats.jointDark : mats.suitCrease,
    );
    pleat.rotation.x = Math.PI / 2;
    pleat.position.y = yCenter + offset;
    parent.add(pleat);
  }
}

function buildSegmentedLimb(mats, upperR, upperL, lowerR, lowerL, endType = 'glove', side = -1) {
  const hipOrShoulder = new THREE.Group();

  // Machined scye / hip bearing rotary ring + contoured cap
  const socketRing = new THREE.Mesh(new THREE.TorusGeometry(upperR * 1.12, 0.015, 10, 20), mats.chromeHardware);
  socketRing.rotation.x = Math.PI / 2;
  hipOrShoulder.add(socketRing);

  if (endType === 'glove') {
    const pauldron = new THREE.Mesh(
      new RoundedBoxGeometry(upperR * 2.25, upperL * 0.34, upperR * 2.1, 3, 0.025),
      mats.armorPlate,
    );
    pauldron.position.set(side * 0.008, -upperL * 0.14, 0);
    const band = new THREE.Mesh(
      new RoundedBoxGeometry(upperR * 2.32, 0.026, upperR * 1.9, 2, 0.008),
      mats.missionAccent,
    );
    band.position.set(side * 0.008, -upperL * 0.25, 0);
    hipOrShoulder.add(pauldron, band);
  }

  const upperSeg = new THREE.Mesh(
    buildSculptedSegmentProfile(upperR * 1.02, upperR * 1.08, upperR * 0.88, upperL),
    mats.suitOuter,
  );
  hipOrShoulder.add(upperSeg);

  // Articulated ribbed bellows joint at elbow / knee
  const midJoint = new THREE.Group();
  midJoint.position.y = -upperL;
  const flexCore = new THREE.Mesh(new THREE.SphereGeometry(upperR * 0.9, 14, 12), mats.jointDark);
  midJoint.add(flexCore);
  addPleatedBellows(midJoint, lowerR * 1.05, 0, 4, mats);

  if (endType === 'boot') {
    // Contoured knee armor pad on legs
    const kneePad = new THREE.Mesh(
      new RoundedBoxGeometry(lowerR * 1.9, 0.1, 0.055, 3, 0.02),
      mats.armorPlate,
    );
    kneePad.position.set(0, 0, -lowerR * 0.96);
    midJoint.add(kneePad);
  }

  const lowerSeg = new THREE.Mesh(
    buildSculptedSegmentProfile(lowerR * 0.98, lowerR * 1.05, lowerR * 0.84, lowerL),
    endType === 'boot' ? mats.suitOuter : mats.suitOuter,
  );
  if (endType === 'boot') {
    // Protective gaiter calf shell & webbing strap on legs
    const gaiter = new THREE.Mesh(
      new RoundedBoxGeometry(lowerR * 2.08, lowerL * 0.42, lowerR * 2.05, 3, 0.025),
      mats.suitCrease,
    );
    gaiter.position.y = -lowerL * 0.72;
    const calfStrap = new THREE.Mesh(
      new RoundedBoxGeometry(lowerR * 2.15, 0.026, lowerR * 2.12, 2, 0.008),
      mats.harnessWeb,
    );
    calfStrap.position.y = -lowerL * 0.56;
    midJoint.add(gaiter, calfStrap);
  } else {
    // Protective forearm cuff band
    const armBand = new THREE.Mesh(
      new THREE.TorusGeometry(lowerR * 0.98, 0.01, 8, 16),
      mats.harnessWeb,
    );
    armBand.rotation.x = Math.PI / 2;
    armBand.position.y = -lowerL * 0.55;
    midJoint.add(armBand);
  }
  midJoint.add(lowerSeg);

  if (endType === 'glove') {
    // Forearm tactical wrist telemetry pad on port sleeve + sculpted EVA gauntlet glove
    if (side < 0) {
      const wristPad = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.095, 0.028, 2, 0.008), mats.jointDark);
      wristPad.position.set(-0.048, -lowerL * 0.48, 0.01);
      const wristScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.068), mats.cyanTrim);
      wristScreen.position.set(-0.064, -lowerL * 0.48, 0.01);
      wristScreen.rotation.y = -Math.PI / 2;
      midJoint.add(wristPad, wristScreen);
    }
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(lowerR * 0.96, lowerR * 0.88, 0.042, 16), mats.chromeHardware);
    cuff.position.y = -lowerL;
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.075, 0.046, 3, 0.014), mats.armorPlate);
    palm.position.y = -lowerL - 0.048;
    const fingers = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.042, 0.036, 3, 0.012), mats.jointDark);
    fingers.position.set(0, -lowerL - 0.092, -0.008);
    fingers.rotation.x = -0.24;
    const thumb = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.046, 0.022, 2, 0.008), mats.missionAccent);
    thumb.position.set(-side * 0.036, -lowerL - 0.048, -0.018);
    thumb.rotation.z = side * 0.52;
    midJoint.add(cuff, palm, fingers, thumb);
  } else {
    // Sculpted Magnetic EVA Pressure Boot
    const ankleCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.052, 16), mats.chromeHardware);
    ankleCollar.position.y = -lowerL;
    const bootUpper = new THREE.Mesh(new RoundedBoxGeometry(0.118, 0.088, 0.2, 3, 0.026), mats.armorPlate);
    bootUpper.position.set(0, -lowerL - 0.048, -0.03);
    const toeCap = new THREE.Mesh(new RoundedBoxGeometry(0.112, 0.068, 0.085, 3, 0.024), mats.suitCrease);
    toeCap.position.set(0, -lowerL - 0.06, -0.105);
    const magSole = new THREE.Mesh(new RoundedBoxGeometry(0.126, 0.034, 0.232, 2, 0.01), mats.jointDark);
    magSole.position.set(0, -lowerL - 0.102, -0.034);
    const magStripe = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.012, 0.09, 1, 0.004), mats.missionAccent);
    magStripe.position.set(0, -lowerL - 0.082, -0.048);
    midJoint.add(ankleCollar, bootUpper, toeCap, magSole, magStripe);
  }

  hipOrShoulder.add(midJoint);
  return { root: hipOrShoulder, midJoint, upperSeg, lowerSeg };
}

/**
 * Builds an articulated, anatomically proportioned 1.75m 3D EVA astronaut with:
 * - Sculpted Hard Upper Torso (HUT) + Chest DCM Control Unit & harness webbing
 * - Molded Portable Life Support System (PLSS) with recessed O2 bays, radiator louvers & micro-RCS nozzles
 * - Contoured Helmet Assembly with brow sunshield, neck lock disconnect collar & gold metallic visor
 * - Articulated pleated bellows arms (forearm wrist pad + gauntlet gloves) & legs (knee pads + EVA boots)
 */
export function createAstronautCharacter3D() {
  const root = new THREE.Group();
  root.name = 'KronoxArticulatedAstronaut175cm';
  const mats = createAstronautMaterials();

  // Hip pelvis root at y = 0.90m (exact 1.75m total standing stature from sole y=0 to crown y=1.75m)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.9, 0);
  const pelvisShell = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.18, 0.24, 3, 0.055), mats.suitCrease);
  const beltBuckle = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.055, 0.035, 2, 0.01), mats.chromeHardware);
  beltBuckle.position.set(0, 0.055, -0.118);
  const waistBearing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 10, 24), mats.missionAccent);
  waistBearing.rotation.x = Math.PI / 2;
  waistBearing.scale.set(1.06, 0.78, 1.0);
  waistBearing.position.y = 0.075;
  pelvis.add(pelvisShell, beltBuckle, waistBearing);
  root.add(pelvis);

  // HARD UPPER TORSO (HUT): y = 0.96 .. 1.44m
  const torso = new THREE.Group();
  torso.position.set(0, 0.24, 0);
  pelvis.add(torso);

  const chestShell = new THREE.Mesh(new RoundedBoxGeometry(0.37, 0.42, 0.26, 4, 0.065), mats.armorPlate);
  torso.add(chestShell);

  const shoulderYoke = new THREE.Mesh(new RoundedBoxGeometry(0.43, 0.13, 0.25, 4, 0.048), mats.armorPlate);
  shoulderYoke.position.y = 0.155;
  torso.add(shoulderYoke);

  // Torso load-bearing harness webbing straps over shoulders & waist
  [-0.105, 0.105].forEach((sx) => {
    const chestStrap = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.42, 0.275, 2, 0.01), mats.harnessWeb);
    chestStrap.position.set(sx, 0.02, 0);
    const buckle = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.032, 0.282, 1, 0.005), mats.chromeHardware);
    buckle.position.set(sx, 0.09, 0);
    torso.add(chestStrap, buckle);
  });

  // Display & Control Module (DCM) mounted cleanly on chest
  const dcmBox = new THREE.Mesh(new RoundedBoxGeometry(0.185, 0.145, 0.088, 3, 0.02), mats.jointDark);
  dcmBox.position.set(0, 0.05, -0.158);
  const dcmScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.068), mats.cyanTrim);
  dcmScreen.position.set(-0.022, 0.06, -0.204);
  dcmScreen.rotation.y = Math.PI;
  const dcmKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.028, 12), mats.missionAccent);
  dcmKnob.rotation.x = Math.PI / 2;
  dcmKnob.position.set(0.06, 0.04, -0.205);
  torso.add(dcmBox, dcmScreen, dcmKnob);

  // MOLDED PORTABLE LIFE SUPPORT SYSTEM (PLSS) BACKPACK + INTEGRATED MICRO-RCS THRUSTER NOZZLES
  const backpack = new THREE.Group();
  backpack.position.set(0, 0.05, 0.205);
  const plssBody = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.47, 0.17, 4, 0.042), mats.armorPlate);
  const plssTopHood = new THREE.Mesh(new RoundedBoxGeometry(0.29, 0.085, 0.16, 3, 0.028), mats.jointDark);
  plssTopHood.position.y = 0.245;

  // Molded side rail frame & dorsal amber EVA recovery grab handle
  [-0.145, 0.145].forEach((rx) => {
    const rail = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.46, 0.185, 2, 0.01), mats.harnessWeb);
    rail.position.x = rx;
    backpack.add(rail);
  });
  const topGrabHandle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 16, Math.PI), mats.missionAccent);
  topGrabHandle.position.set(0, 0.285, 0.035);
  backpack.add(topGrabHandle);

  // Recessed O2 composite bottle bay + cooling radiator louvers (no crude pipes glued onto box)
  const backBayRecess = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.36, 0.04, 2, 0.012), mats.jointDark);
  backBayRecess.position.set(0, -0.02, 0.075);
  backpack.add(backBayRecess);
  [-0.062, 0.062].forEach((ox) => {
    const o2Bottle = new THREE.Mesh(
      buildSculptedSegmentProfile(0.032, 0.034, 0.032, 0.28),
      mats.chromeHardware,
    );
    o2Bottle.position.set(ox, 0.125, 0.08);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.006, 6, 12), mats.missionAccent);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(ox, 0.035, 0.08);
    backpack.add(o2Bottle, collar);
  });
  for (let ly = -0.14; ly <= 0.1; ly += 0.045) {
    const fin = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.012, 0.024, 1, 0.003), mats.suitCrease);
    fin.position.set(0, ly, 0.086);
    backpack.add(fin);
  }

  const antennaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.24, 8), mats.chromeHardware);
  antennaMast.position.set(-0.125, 0.36, 0.035);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), mats.missionAccent);
  antennaTip.position.set(-0.125, 0.48, 0.035);
  backpack.add(plssBody, plssTopHood, antennaMast, antennaTip);

  // Compact corner RCS nozzle thrusters (plumes remain hidden unless firing in THRUSTER_BURST / STABILIZE)
  const rcsPlumes = [];
  [
    [-0.165, 0.19, 0.055],
    [0.165, 0.19, 0.055],
    [-0.165, -0.18, 0.055],
    [0.165, -0.18, 0.055],
  ].forEach(([qx, qy, qz]) => {
    const quad = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.052, 0.058, 2, 0.012), mats.jointDark);
    quad.position.set(qx, qy, qz);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.028, 10), mats.chromeHardware);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(qx, qy, qz + 0.034);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.11, 10), mats.rcsPlumeMat.clone());
    plume.rotation.x = Math.PI / 2;
    plume.position.set(qx, qy, qz + 0.095);
    plume.visible = false;
    backpack.add(quad, bell, plume);
    rcsPlumes.push(plume);
  });
  torso.add(backpack);

  // CONTOURED HELMET ASSEMBLY & GOLD SOLAR VISOR (crown y = 1.75m)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.29, 0);
  const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 12, 24), mats.chromeHardware);
  neckRing.rotation.x = Math.PI / 2;
  const neckSeal = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.011, 8, 20), mats.missionAccent);
  neckSeal.rotation.x = Math.PI / 2;
  neckSeal.position.y = 0.016;
  headGroup.add(neckRing, neckSeal);

  const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.164, 24, 20), mats.suitOuter);
  helmetMesh.position.y = 0.14;
  helmetMesh.scale.set(0.95, 1.06, 1.04);
  headGroup.add(helmetMesh);

  // Sunvisor protective cowling hood & rear neck bumper ring (reads distinctly from rear & 3/4 angles!)
  const sunHood = new THREE.Mesh(
    new THREE.CylinderGeometry(0.172, 0.175, 0.09, 20, 1, false, -Math.PI * 0.65, Math.PI * 1.3),
    mats.armorPlate,
  );
  sunHood.position.set(0, 0.195, -0.01);
  sunHood.rotation.x = 0.16;
  const rearPatch = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.06, 0.04, 2, 0.012), mats.jointDark);
  rearPatch.position.set(0, 0.11, 0.155);
  const rearStripe = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.016, 0.044, 1, 0.004), mats.missionAccent);
  rearStripe.position.set(0, 0.185, 0.148);
  headGroup.add(sunHood, rearPatch, rearStripe);

  // Dark inner tinted pressure dome + reflective gold outer solar visor
  const innerHead = new THREE.Mesh(new THREE.SphereGeometry(0.148, 18, 14), mats.visorInnerTint);
  innerHead.position.set(0, 0.142, -0.024);
  headGroup.add(innerHead);

  const visorMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 22, 18, Math.PI * 1.06, Math.PI * 0.88, Math.PI * 0.16, Math.PI * 0.58),
    mats.visorGold,
  );
  visorMesh.position.set(0, 0.144, -0.022);
  headGroup.add(visorMesh);

  // Visor bezel seal & dual helmet LED work headlamp nacelles
  [-0.162, 0.162].forEach((lx) => {
    const pod = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.044, 0.09, 2, 0.012), mats.jointDark);
    pod.position.set(lx, 0.155, -0.012);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.013, 12), mats.helmetLamp);
    lens.position.set(lx, 0.155, -0.058);
    lens.rotation.y = Math.PI;
    headGroup.add(pod, lens);
  });
  torso.add(headGroup);

  // ARTICULATED ARMS & LEGS
  const leftArmRig = buildSegmentedLimb(mats, 0.058, 0.27, 0.048, 0.25, 'glove', -1);
  leftArmRig.root.position.set(-0.235, 0.15, 0);
  const rightArmRig = buildSegmentedLimb(mats, 0.058, 0.27, 0.048, 0.25, 'glove', 1);
  rightArmRig.root.position.set(0.235, 0.15, 0);
  torso.add(leftArmRig.root, rightArmRig.root);

  const leftLegRig = buildSegmentedLimb(mats, 0.088, 0.42, 0.074, 0.4, 'boot', -1);
  leftLegRig.root.position.set(-0.105, -0.05, 0);
  const rightLegRig = buildSegmentedLimb(mats, 0.088, 0.42, 0.074, 0.4, 'boot', 1);
  rightLegRig.root.position.set(0.105, -0.05, 0);
  pelvis.add(leftLegRig.root, rightLegRig.root);

  let currentState = ASTRONAUT_ANIMATION_STATES.IDLE_FLOAT;
  let clockT = 0;

  function setState(nextState) {
    if (Object.values(ASTRONAUT_ANIMATION_STATES).includes(nextState)) {
      currentState = nextState;
    }
  }

  function updateAnimation(dt = 0.016, stateOverride = null) {
    if (stateOverride) setState(stateOverride);
    clockT += dt;

    // Reset targets per pose then blend smoothly
    let bobY = Math.sin(clockT * 1.45) * 0.035;
    let bodyPitch = 0.06 * Math.sin(clockT * 1.1);
    let laX = 0.18,
      laZ = 0.14,
      leX = -0.35;
    let raX = 0.18,
      raZ = -0.14,
      reX = -0.35;
    let llX = -0.12,
      lkX = 0.24;
    let rlX = 0.08,
      rkX = 0.18;
    let rcsOpacity = 0.0;

    switch (currentState) {
      case ASTRONAUT_ANIMATION_STATES.IDLE_FLOAT: {
        laX = 0.22 + Math.sin(clockT * 1.3) * 0.08;
        raX = 0.18 + Math.cos(clockT * 1.2) * 0.08;
        leX = -0.45;
        reX = -0.42;
        llX = -0.15 + Math.sin(clockT * 1.1) * 0.06;
        rlX = 0.12 - Math.sin(clockT * 1.1) * 0.06;
        break;
      }
      case ASTRONAUT_ANIMATION_STATES.HAND_PUSH: {
        const s = Math.sin(clockT * 5.2);
        bobY = Math.abs(s) * 0.025;
        bodyPitch = 0.16;
        laX = 0.45 + s * 0.35;
        raX = 0.45 - s * 0.35;
        leX = -0.55;
        reX = -0.55;
        llX = -0.25 + s * 0.25;
        rlX = -0.25 - s * 0.25;
        lkX = 0.45;
        rkX = 0.45;
        break;
      }
      case ASTRONAUT_ANIMATION_STATES.THRUSTER_BURST: {
        bodyPitch = 0.24;
        bobY = Math.sin(clockT * 7.5) * 0.018;
        laX = -0.15;
        laZ = 0.32;
        raX = -0.15;
        raZ = -0.32;
        llX = 0.18;
        rlX = 0.26;
        lkX = 0.32;
        rkX = 0.42;
        rcsOpacity = 0.65 + 0.25 * Math.sin(clockT * 24);
        break;
      }
      case ASTRONAUT_ANIMATION_STATES.GRAB_RAIL: {
        bobY = 0;
        bodyPitch = 0.08;
        raX = 1.28;
        raZ = 0.08;
        reX = -0.45;
        laX = 0.32;
        leX = -0.35;
        llX = -0.1;
        rlX = 0.12;
        break;
      }
      case ASTRONAUT_ANIMATION_STATES.STABILIZE: {
        bodyPitch = 0.02;
        laZ = 0.72;
        raZ = -0.72;
        laX = 0.28;
        raX = 0.28;
        llX = -0.22;
        rlX = -0.22;
        lkX = 0.42;
        rkX = 0.42;
        rcsOpacity = 0.48 + 0.22 * Math.cos(clockT * 20);
        break;
      }
      case ASTRONAUT_ANIMATION_STATES.CONSOLE_WORK: {
        bodyPitch = 0.04;
        laX = 0.85 + Math.sin(clockT * 4.2) * 0.08;
        raX = 0.88 + Math.cos(clockT * 4.8) * 0.08;
        laZ = -0.12;
        raZ = 0.12;
        leX = -0.75;
        reX = -0.75;
        break;
      }
      case ASTRONAUT_ANIMATION_STATES.REPAIR_INTERACT: {
        bodyPitch = 0.12;
        raX = 1.05 + Math.sin(clockT * 6.5) * 0.14;
        reX = -0.62 + Math.cos(clockT * 6.5) * 0.12;
        laX = 0.78;
        leX = -0.82;
        break;
      }
      case ASTRONAUT_ANIMATION_STATES.CORRIDOR_SWIM: {
        const sw = Math.sin(clockT * 6.2);
        bodyPitch = 0.58;
        bobY = 0.04 + sw * 0.03;
        laX = 1.25 + sw * 0.28;
        raX = 1.25 - sw * 0.28;
        leX = -0.35;
        reX = -0.35;
        llX = 0.32 - sw * 0.25;
        rlX = 0.32 + sw * 0.25;
        lkX = 0.22;
        rkX = 0.22;
        rcsOpacity = 0.0;
        break;
      }
    }

    const k = Math.min(1, Math.max(0.08, dt * 10));
    pelvis.position.y += (0.9 + bobY - pelvis.position.y) * k;
    pelvis.rotation.x += (bodyPitch - pelvis.rotation.x) * k;
    headGroup.rotation.x += (-bodyPitch * 0.65 - headGroup.rotation.x) * k;

    leftArmRig.root.rotation.x += (laX - leftArmRig.root.rotation.x) * k;
    leftArmRig.root.rotation.z += (laZ - leftArmRig.root.rotation.z) * k;
    leftArmRig.midJoint.rotation.x += (leX - leftArmRig.midJoint.rotation.x) * k;

    rightArmRig.root.rotation.x += (raX - rightArmRig.root.rotation.x) * k;
    rightArmRig.root.rotation.z += (raZ - rightArmRig.root.rotation.z) * k;
    rightArmRig.midJoint.rotation.x += (reX - rightArmRig.midJoint.rotation.x) * k;

    leftLegRig.root.rotation.x += (llX - leftLegRig.root.rotation.x) * k;
    leftLegRig.midJoint.rotation.x += (lkX - leftLegRig.midJoint.rotation.x) * k;

    rightLegRig.root.rotation.x += (rlX - rightLegRig.root.rotation.x) * k;
    rightLegRig.midJoint.rotation.x += (rkX - rightLegRig.midJoint.rotation.x) * k;

    rcsPlumes.forEach((pl, i) => {
      const nextOp = Math.min(0.45, rcsOpacity * (0.62 + 0.18 * Math.sin(clockT * 18 + i)));
      pl.material.opacity = nextOp;
      pl.visible = nextOp > 0.02;
      pl.scale.y = 0.55 + rcsOpacity * 0.6;
    });
  }

  return {
    root,
    torso,
    headGroup,
    helmetMesh,
    visorMesh,
    backpack,
    leftArm: leftArmRig.root,
    rightArm: rightArmRig.root,
    leftLeg: leftLegRig.root,
    rightLeg: rightLegRig.root,
    rcsPlumes,
    eyePosition: new THREE.Vector3(0, 1.65, -0.04),
    getState: () => currentState,
    setState,
    updateAnimation,
  };
}
