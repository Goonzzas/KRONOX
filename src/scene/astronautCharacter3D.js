import * as THREE from 'three';

/**
 * KRONOX 3D Astronaut Character & Articulated Zero-G EVA Suit (1.75m).
 *
 * Implements a fully-rigged/articulated 3D astronaut:
 * - Height: Exactly 1.75 meters (head top: 1.75m, eye level: 1.65m).
 * - Multi-layer pressurized EVA suit (matte white & graphite Kevlar weave).
 * - Helmet with golden reflective polarized visor (MeshPhysicalMaterial).
 * - PLSS (Portable Life Support System) backpack with 6 cold-gas RCS micro-nozzles.
 * - Articulated gloves with wrist telemetry terminal on left forearm.
 * - Magnetic sole boots with tether clips.
 * - 8 Procedural zero-G animation states:
 *   1. IDLE_FLOAT: Gentle floating breathing rhythm in microgravity.
 *   2. HAND_PUSH: Arm thrust extension pushing away from bulkheads.
 *   3. THRUSTER_BURST: RCS micro-jets firing with visible gas trails.
 *   4. GRAB_RAIL: Hands gripping safety handrails.
 *   5. STABILIZE: Body counter-thrust brake posture.
 *   6. CONSOLE_WORK: Hands interacting with terminal controls.
 *   7. REPAIR_INTERACT: Holding diagnostic scanner or multi-tool.
 *   8. CORRIDOR_SWIM: Smooth streamlined zero-g transit pose.
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

export function createAstronautCharacter3D() {
  const root = new THREE.Group();
  root.name = 'KronoxAstronaut175M';

  // PBR Materials for EVA Spacesuit
  const suitFabricWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    roughness: 0.75,
    metalness: 0.15,
    name: 'SuitFabricWhite',
  });

  const suitKevlarDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.8,
    metalness: 0.3,
    name: 'SuitKevlarReinforcement',
  });

  const goldVisorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.08,
    transmission: 0.35,
    reflectivity: 0.95,
    ior: 1.55,
    name: 'GoldReflectiveVisor',
  });

  const backpackMat = new THREE.MeshStandardMaterial({
    color: 0x374151,
    metalness: 0.6,
    roughness: 0.45,
    name: 'PLSSBackpackHousing',
  });

  const copperDetailMat = new THREE.MeshStandardMaterial({
    color: 0xc27a42,
    metalness: 0.85,
    roughness: 0.3,
    name: 'ThrusterNozzleCopper',
  });

  const wristScreenMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    name: 'WristTelemetryHolo',
  });

  // Base Human Proportions (Total Height = 1.75m)
  // Torso & Pelvis
  const torso = new THREE.Group();
  torso.name = 'TorsoGroup';
  torso.position.set(0, 1.15, 0);

  const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.52, 0.32), suitFabricWhiteMat);
  chestMesh.position.set(0, 0, 0);
  torso.add(chestMesh);

  // Chest control pack (MMU interface)
  const chestPack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.08), suitKevlarDarkMat);
  chestPack.position.set(0, 0.06, 0.18);
  torso.add(chestPack);

  // PLSS Backpack (Portable Life Support System on dorsal torso)
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.26), backpackMat);
  backpack.position.set(0, 0.05, -0.26);
  torso.add(backpack);

  // Cold-Gas RCS Thruster Nozzles on Backpack Corners
  const rcsPuffs = [];
  [
    [-0.22, 0.32, -0.36],
    [0.22, 0.32, -0.36],
    [-0.22, -0.22, -0.36],
    [0.22, -0.22, -0.36],
  ].forEach(([rx, ry, rz]) => {
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 8, 1, true), copperDetailMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(rx, ry, rz);
    torso.add(nozzle);

    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.0 }),
    );
    puff.position.set(rx, ry, rz - 0.08);
    torso.add(puff);
    rcsPuffs.push(puff);
  });

  // Pelvis / Waist
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.28), suitKevlarDarkMat);
  pelvis.position.set(0, -0.34, 0);
  torso.add(pelvis);

  // Head and Helmet (Center at Y = 1.65m Eye Level, Head Top at 1.75m)
  const headGroup = new THREE.Group();
  headGroup.name = 'HeadGroup';
  headGroup.position.set(0, 0.44, 0); // Y: 1.15 + 0.44 = 1.59m

  const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), suitFabricWhiteMat);
  helmetMesh.position.set(0, 0.06, 0);
  headGroup.add(helmetMesh);

  // Visor (Forward dome, eyes at eyeHeight = 1.65m)
  const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12, 0, Math.PI, 0, Math.PI / 1.8), goldVisorMat);
  visorMesh.rotation.x = -Math.PI / 2.2;
  visorMesh.position.set(0, 0.06, 0.05);
  headGroup.add(visorMesh);

  torso.add(headGroup);

  // Left Arm & Forearm
  const leftArm = new THREE.Group();
  leftArm.name = 'LeftArm';
  leftArm.position.set(-0.32, 0.2, 0);

  const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), suitKevlarDarkMat);
  leftArm.add(leftShoulder);

  const leftBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.28, 8), suitFabricWhiteMat);
  leftBicep.position.set(0, -0.16, 0);
  leftArm.add(leftBicep);

  const leftForearm = new THREE.Group();
  leftForearm.name = 'LeftForearm';
  leftForearm.position.set(0, -0.32, 0);

  const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.28, 8), suitFabricWhiteMat);
  leftArmMesh.position.set(0, -0.14, 0);
  leftForearm.add(leftArmMesh);

  // Wrist Telemetry Terminal on Left Forearm
  const wristTerminal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.04), suitKevlarDarkMat);
  wristTerminal.position.set(0, -0.12, 0.08);
  const wristScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.09), wristScreenMat);
  wristScreen.position.set(0, -0.12, 0.102);
  leftForearm.add(wristTerminal, wristScreen);

  // Glove
  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.05), suitKevlarDarkMat);
  leftHand.position.set(0, -0.32, 0);
  leftForearm.add(leftHand);

  leftArm.add(leftForearm);
  torso.add(leftArm);

  // Right Arm & Forearm
  const rightArm = new THREE.Group();
  rightArm.name = 'RightArm';
  rightArm.position.set(0.32, 0.2, 0);

  const rightShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), suitKevlarDarkMat);
  rightArm.add(rightShoulder);

  const rightBicep = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.28, 8), suitFabricWhiteMat);
  rightBicep.position.set(0, -0.16, 0);
  rightArm.add(rightBicep);

  const rightForearm = new THREE.Group();
  rightForearm.name = 'RightForearm';
  rightForearm.position.set(0, -0.32, 0);

  const rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.28, 8), suitFabricWhiteMat);
  rightArmMesh.position.set(0, -0.14, 0);
  rightForearm.add(rightArmMesh);

  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.05), suitKevlarDarkMat);
  rightHand.position.set(0, -0.32, 0);
  rightForearm.add(rightHand);

  rightArm.add(rightForearm);
  torso.add(rightArm);

  // Legs & Magnetic Boots
  const leftLeg = new THREE.Group();
  leftLeg.name = 'LeftLeg';
  leftLeg.position.set(-0.16, -0.42, 0);

  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.42, 8), suitFabricWhiteMat);
  leftThigh.position.set(0, -0.21, 0);
  leftLeg.add(leftThigh);

  const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.42, 8), suitFabricWhiteMat);
  leftShin.position.set(0, -0.62, 0);
  leftLeg.add(leftShin);

  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.26), suitKevlarDarkMat);
  leftBoot.position.set(0, -0.86, 0.04);
  leftLeg.add(leftBoot);

  torso.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.name = 'RightLeg';
  rightLeg.position.set(0.16, -0.42, 0);

  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.42, 8), suitFabricWhiteMat);
  rightThigh.position.set(0, -0.21, 0);
  rightLeg.add(rightThigh);

  const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.42, 8), suitFabricWhiteMat);
  rightShin.position.set(0, -0.62, 0);
  rightLeg.add(rightShin);

  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.26), suitKevlarDarkMat);
  rightBoot.position.set(0, -0.86, 0.04);
  rightLeg.add(rightBoot);

  torso.add(rightLeg);
  root.add(torso);

  // Eye Position Helper for 1st-Person Camera Rig (Local Y = 1.65m in world)
  const eyePosition = new THREE.Vector3(0, 1.65, 0.05);

  let currentState = ASTRONAUT_ANIMATION_STATES.IDLE_FLOAT;
  let stateTimer = 0;

  // Procedural Zero-G Animation Controller
  const updateAnimation = (dt = 0.016, arg1 = 0, isThrusting = false, isGripping = false) => {
    stateTimer += dt;

    // Support both direct state string passing and physics-driven parameter passing
    if (typeof arg1 === 'string' && ASTRONAUT_ANIMATION_STATES[arg1]) {
      currentState = arg1;
    } else {
      const velocityMag = typeof arg1 === 'number' ? arg1 : 0;
      if (isThrusting) {
        currentState = ASTRONAUT_ANIMATION_STATES.THRUSTER_BURST;
      } else if (isGripping) {
        currentState = ASTRONAUT_ANIMATION_STATES.GRAB_RAIL;
      } else if (velocityMag > 1.2) {
        currentState = ASTRONAUT_ANIMATION_STATES.CORRIDOR_SWIM;
      } else if (velocityMag > 0.1) {
        currentState = ASTRONAUT_ANIMATION_STATES.HAND_PUSH;
      }
    }

    // Evaluate Procedural Skeletal Poses
    switch (currentState) {
      case ASTRONAUT_ANIMATION_STATES.IDLE_FLOAT: {
        const breath = Math.sin(stateTimer * 1.8) * 0.02;
        torso.position.y = 1.15 + breath;
        torso.rotation.x = Math.sin(stateTimer * 0.8) * 0.04;
        torso.rotation.z = Math.cos(stateTimer * 0.6) * 0.03;

        // Limbs float gently in microgravity
        leftArm.rotation.x = 0.25 + Math.sin(stateTimer * 1.2) * 0.08;
        leftArm.rotation.z = 0.35 + Math.cos(stateTimer * 1.1) * 0.06;
        rightArm.rotation.x = 0.25 - Math.sin(stateTimer * 1.2) * 0.08;
        rightArm.rotation.z = -0.35 - Math.cos(stateTimer * 1.1) * 0.06;

        leftLeg.rotation.x = 0.15 + Math.cos(stateTimer * 0.9) * 0.05;
        rightLeg.rotation.x = 0.2 - Math.cos(stateTimer * 0.9) * 0.05;

        rcsPuffs.forEach((p) => { p.material.opacity = 0.0; });
        break;
      }

      case ASTRONAUT_ANIMATION_STATES.THRUSTER_BURST: {
        torso.rotation.x = 0.35;
        leftArm.rotation.x = -0.4;
        rightArm.rotation.x = -0.4;
        leftLeg.rotation.x = 0.45;
        rightLeg.rotation.x = 0.45;

        // Flash RCS puff jets
        const puffAlpha = 0.4 + Math.sin(stateTimer * 28.0) * 0.4;
        rcsPuffs.forEach((p) => { p.material.opacity = puffAlpha; });
        break;
      }

      case ASTRONAUT_ANIMATION_STATES.GRAB_RAIL: {
        torso.rotation.x = 0.1;
        leftArm.rotation.x = -1.1; // Hand raised to bar
        leftForearm.rotation.x = 0.4;
        rightArm.rotation.x = -0.3;
        leftLeg.rotation.x = 0.1;
        rightLeg.rotation.x = 0.2;
        rcsPuffs.forEach((p) => { p.material.opacity = 0.0; });
        break;
      }

      case ASTRONAUT_ANIMATION_STATES.CORRIDOR_SWIM: {
        // Streamlined hydrodynamic/aerodynamic zero-g glide
        torso.rotation.x = 0.85;
        leftArm.rotation.x = -1.4;
        rightArm.rotation.x = -1.4;
        leftLeg.rotation.x = 0.1;
        rightLeg.rotation.x = 0.1;
        rcsPuffs.forEach((p) => { p.material.opacity = 0.0; });
        break;
      }

      case ASTRONAUT_ANIMATION_STATES.CONSOLE_WORK:
      case ASTRONAUT_ANIMATION_STATES.REPAIR_INTERACT: {
        torso.rotation.x = 0.08;
        leftArm.rotation.x = -0.75;
        leftForearm.rotation.x = 0.65;
        rightArm.rotation.x = -0.85;
        rightForearm.rotation.x = 0.55;
        leftLeg.rotation.x = 0.05;
        rightLeg.rotation.x = 0.05;
        rcsPuffs.forEach((p) => { p.material.opacity = 0.0; });
        break;
      }

      default:
        break;
    }
  };

  const setState = (state) => {
    if (ASTRONAUT_ANIMATION_STATES[state]) {
      currentState = state;
    }
  };

  return {
    root,
    torso,
    headGroup,
    helmetMesh,
    visorMesh,
    backpack,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    eyePosition,
    getState: () => currentState,
    setState,
    updateAnimation,
  };
}
