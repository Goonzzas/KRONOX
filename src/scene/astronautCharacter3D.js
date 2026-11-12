import * as THREE from 'three';

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
      color: 0xeaf0f6,
      roughness: 0.42,
      metalness: 0.14,
    }),
    suitCrease: new THREE.MeshStandardMaterial({
      color: 0xc2ccd8,
      roughness: 0.68,
      metalness: 0.1,
    }),
    armorPlate: new THREE.MeshStandardMaterial({
      color: 0xd6dee8,
      roughness: 0.28,
      metalness: 0.48,
    }),
    jointDark: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.58,
      metalness: 0.42,
    }),
    missionAccent: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.55,
    }),
    cyanTrim: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.7,
      roughness: 0.25,
    }),
    visorGold: new THREE.MeshPhysicalMaterial({
      color: 0xf6c453,
      metalness: 0.78,
      roughness: 0.12,
      transparent: true,
      opacity: 0.84,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    }),
    helmetLamp: new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
    rcsPlumeMat: new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    chromeHardware: new THREE.MeshStandardMaterial({
      color: 0xb0c4de,
      metalness: 0.88,
      roughness: 0.2,
    }),
  };
}

function buildSegmentedLimb(mats, upperR, upperL, lowerR, lowerL, endType = 'glove', side = -1) {
  const hipOrShoulder = new THREE.Group();

  // Joint bearing ring + corrugated bellows sleeve
  const socketRing = new THREE.Mesh(new THREE.TorusGeometry(upperR * 1.12, 0.016, 8, 18), mats.chromeHardware);
  socketRing.rotation.x = Math.PI / 2;
  hipOrShoulder.add(socketRing);

  const upperSeg = new THREE.Mesh(
    new THREE.CylinderGeometry(upperR, upperR * 0.88, upperL, 14),
    mats.suitOuter,
  );
  upperSeg.position.y = -upperL * 0.5;
  hipOrShoulder.add(upperSeg);

  // Bellows flex joint at elbow / knee
  const midJoint = new THREE.Group();
  midJoint.position.y = -upperL;
  const flexBall = new THREE.Mesh(new THREE.SphereGeometry(upperR * 0.92, 12, 10), mats.jointDark);
  midJoint.add(flexBall);

  for (let i = -1; i <= 1; i++) {
    const bellows = new THREE.Mesh(new THREE.TorusGeometry(lowerR * 1.04, 0.012, 6, 14), mats.suitCrease);
    bellows.rotation.x = Math.PI / 2;
    bellows.position.y = i * 0.024;
    midJoint.add(bellows);
  }

  const lowerSeg = new THREE.Mesh(
    new THREE.CylinderGeometry(lowerR, lowerR * 0.82, lowerL, 14),
    endType === 'boot' ? mats.suitCrease : mats.suitOuter,
  );
  lowerSeg.position.y = -lowerL * 0.5;
  midJoint.add(lowerSeg);

  if (endType === 'glove') {
    // Forearm tactical wrist display on left arm + articulated armored EVA gauntlet glove
    if (side < 0) {
      const wristPad = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.095, 0.026), mats.jointDark);
      wristPad.position.set(-0.048, -lowerL * 0.45, 0.02);
      const wristScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.068), mats.cyanTrim);
      wristScreen.position.set(-0.063, -lowerL * 0.45, 0.02);
      wristScreen.rotation.y = -Math.PI / 2;
      midJoint.add(wristPad, wristScreen);
    }
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(lowerR * 0.95, lowerR * 0.88, 0.04, 12), mats.chromeHardware);
    cuff.position.y = -lowerL;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.09, 0.048), mats.jointDark);
    palm.position.y = -lowerL - 0.055;
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.014, 0.048, 8), mats.missionAccent);
    thumb.position.set(-side * 0.036, -lowerL - 0.045, 0.018);
    thumb.rotation.z = side * 0.55;
    midJoint.add(cuff, palm, thumb);
  } else {
    // Magnetic EVA Boot Assembly
    const ankleCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.055, 14), mats.chromeHardware);
    ankleCollar.position.y = -lowerL;
    const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.095, 0.21), mats.armorPlate);
    bootUpper.position.set(0, -lowerL - 0.05, -0.035);
    const magSole = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.032, 0.235), mats.jointDark);
    magSole.position.set(0, -lowerL - 0.105, -0.035);
    const magStripe = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.014, 0.08), mats.missionAccent);
    magStripe.position.set(0, -lowerL - 0.085, -0.05);
    midJoint.add(ankleCollar, bootUpper, magSole, magStripe);
  }

  hipOrShoulder.add(midJoint);
  return { root: hipOrShoulder, midJoint, upperSeg, lowerSeg };
}

/**
 * Builds an articulated, anatomically proportioned 1.75m 3D EVA astronaut with:
 * - Sculpted Hard Upper Torso (HUT) + Chest DCM Control Unit
 * - Portable Life Support System (PLSS) with O2 tanks & 4 animated cold-gas RCS plumes
 * - Translucent Multilayer Gold Visor Dome over inner helmet cavity + twin LED headlamps
 * - Two-segment articulated arms (with forearm wrist tablet) & legs (with magnetic EVA boots)
 */
export function createAstronautCharacter3D() {
  const root = new THREE.Group();
  root.name = 'KronoxArticulatedAstronaut175cm';
  const mats = createAstronautMaterials();

  // Hip pelvis root at y = 0.90m (exact 1.75m total standing stature from sole y=0 to crown y=1.75m)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.9, 0);
  const pelvisShell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.145, 0.18, 16), mats.suitCrease);
  pelvisShell.scale.set(1.08, 1.0, 0.78);
  const waistBearing = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.018, 8, 22), mats.missionAccent);
  waistBearing.rotation.x = Math.PI / 2;
  waistBearing.scale.set(1.05, 0.76, 1.0);
  waistBearing.position.y = 0.08;
  pelvis.add(pelvisShell, waistBearing);
  root.add(pelvis);

  // HARD UPPER TORSO (HUT): y = 0.96 .. 1.44m
  const torso = new THREE.Group();
  torso.position.set(0, 0.24, 0);
  pelvis.add(torso);

  const chestShell = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.165, 0.42, 18), mats.armorPlate);
  chestShell.scale.set(1.08, 1.0, 0.74);
  torso.add(chestShell);

  const shoulderYoke = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.24), mats.armorPlate);
  shoulderYoke.position.y = 0.17;
  torso.add(shoulderYoke);

  // Display & Control Module (DCM) mounted cleanly on chest
  const dcmBox = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.095), mats.jointDark);
  dcmBox.position.set(0, 0.05, -0.17);
  const dcmScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.075), mats.cyanTrim);
  dcmScreen.position.set(-0.02, 0.06, -0.219);
  dcmScreen.rotation.y = Math.PI;
  const dcmKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), mats.missionAccent);
  dcmKnob.rotation.x = Math.PI / 2;
  dcmKnob.position.set(0.062, 0.04, -0.22);
  torso.add(dcmBox, dcmScreen, dcmKnob);

  // PORTABLE LIFE SUPPORT SYSTEM (PLSS) BACKPACK + COLD-GAS RCS THRUSTERS
  const backpack = new THREE.Group();
  backpack.position.set(0, 0.05, 0.215);
  const plssBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.48, 0.17), mats.armorPlate);
  const plssTopHood = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.15), mats.jointDark);
  plssTopHood.position.y = 0.26;
  [-0.085, 0.085].forEach((ox) => {
    const o2Bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.34, 12), mats.chromeHardware);
    o2Bottle.position.set(ox, -0.02, 0.095);
    backpack.add(o2Bottle);
  });
  const antennaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.009, 0.26, 8), mats.chromeHardware);
  antennaMast.position.set(-0.12, 0.38, 0.04);
  backpack.add(plssBody, plssTopHood, antennaMast);

  const rcsPlumes = [];
  [
    [-0.17, 0.2, 0.04],
    [0.17, 0.2, 0.04],
    [-0.17, -0.18, 0.04],
    [0.17, -0.18, 0.04],
  ].forEach(([qx, qy, qz]) => {
    const quad = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.055), mats.jointDark);
    quad.position.set(qx, qy, qz);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.26, 10), mats.rcsPlumeMat.clone());
    plume.rotation.x = Math.PI / 2;
    plume.position.set(qx, qy, qz + 0.15);
    backpack.add(quad, plume);
    rcsPlumes.push(plume);
  });
  torso.add(backpack);

  // HELMET & MULTILAYER GOLD VISOR ASSEMBLY (center around y = 1.56m, top dome y = 1.75m)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.29, 0);
  const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 10, 22), mats.missionAccent);
  neckRing.rotation.x = Math.PI / 2;
  headGroup.add(neckRing);

  const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.165, 22, 18), mats.suitOuter);
  helmetMesh.position.y = 0.14;
  helmetMesh.scale.set(0.95, 1.06, 1.02);
  headGroup.add(helmetMesh);

  // Inner visible crew silhouette behind dome visor
  const innerHead = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), mats.jointDark);
  innerHead.position.set(0, 0.14, -0.02);
  headGroup.add(innerHead);

  const visorMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.162, 20, 16, Math.PI * 1.15, Math.PI * 0.7, Math.PI * 0.18, Math.PI * 0.56),
    mats.visorGold,
  );
  visorMesh.position.set(0, 0.145, -0.018);
  headGroup.add(visorMesh);

  // Helmet side camera / dual LED work lamps
  [-0.165, 0.165].forEach((lx) => {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.075), mats.jointDark);
    pod.position.set(lx, 0.16, -0.02);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), mats.helmetLamp);
    lens.position.set(lx, 0.16, -0.059);
    lens.rotation.y = Math.PI;
    headGroup.add(pod, lens);
  });
  torso.add(headGroup);

  // ARTICULATED ARMS & LEGS
  const leftArmRig = buildSegmentedLimb(mats, 0.058, 0.27, 0.048, 0.25, 'glove', -1);
  leftArmRig.root.position.set(-0.24, 0.15, 0);
  const rightArmRig = buildSegmentedLimb(mats, 0.058, 0.27, 0.048, 0.25, 'glove', 1);
  rightArmRig.root.position.set(0.24, 0.15, 0);
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
        rcsOpacity = 0.28;
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
      pl.material.opacity = rcsOpacity * (0.75 + 0.25 * Math.sin(clockT * 18 + i));
      pl.scale.y = 0.7 + rcsOpacity * 0.9;
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
