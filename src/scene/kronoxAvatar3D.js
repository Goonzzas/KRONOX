import * as THREE from 'three';

/**
 * Valid animation states for the 3D Kronox Holographic AI Avatar.
 */
export const KRONOX_AVATAR_STATES = [
  'IDLE',
  'GREETING',
  'TALKING',
  'EXPLAINING',
  'POINTING',
  'NAVIGATING',
  'LISTENING',
  'SUCCESS',
  'FAREWELL',
];

/**
 * Builds the rigged 3D humanoid holographic avatar for Kronox IA.
 * Includes an explicit hierarchical skeleton (pelvis -> spine -> chest -> neck -> head/jaw/eyes,
 * left/right shoulders -> elbows -> hands, plus floating orbital telemetry rings and hologram pedestal)
 * and a full procedural state machine (`update(dt, options)`).
 */
export function buildKronoxAvatarMesh() {
  const root = new THREE.Group();
  root.name = 'KronoxAvatar3D';

  // Holographic materials with subtle fresnel/scanline aesthetics
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.78,
    metalness: 0.35,
    roughness: 0.2,
    transparent: true,
    opacity: 0.86,
  });

  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    metalness: 0.65,
    roughness: 0.18,
    transparent: true,
    opacity: 0.72,
  });

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xa5f3fc,
    wireframe: true,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const accentMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
  });

  const jawMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  });

  // Hologram Emitter Pedestal
  const pedestal = new THREE.Group();
  const baseDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 0.05, 32),
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.25,
      emissive: 0x0369a1,
      emissiveIntensity: 0.5,
    }),
  );
  baseDisc.position.y = -0.92;
  pedestal.add(baseDisc);

  const emitterRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.39, 0.014, 12, 48),
    accentMat.clone(),
  );
  emitterRing.rotation.x = Math.PI / 2;
  emitterRing.position.y = -0.89;
  pedestal.add(emitterRing);

  const beamCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.48, 1.85, 32, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beamCone.position.y = 0.02;
  beamCone.rotation.z = Math.PI;
  pedestal.add(beamCone);
  root.add(pedestal);

  // Skeleton Hierarchy
  const pelvis = new THREE.Group();
  pelvis.position.y = -0.18;
  root.add(pelvis);

  const spine = new THREE.Group();
  spine.position.y = 0.14;
  pelvis.add(spine);

  // Lower torso core
  const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.26, 16), coreMat);
  abdomen.position.y = 0.12;
  spine.add(abdomen);

  const chest = new THREE.Group();
  chest.position.y = 0.28;
  spine.add(chest);

  // Sculpted Upper Torso + Wireframe Overlay
  const chestGeo = new THREE.CylinderGeometry(0.22, 0.15, 0.36, 20);
  const chestMesh = new THREE.Mesh(chestGeo, armorMat);
  chestMesh.position.y = 0.14;
  chest.add(chestMesh);

  const chestWire = new THREE.Mesh(chestGeo, wireMat);
  chestWire.scale.setScalar(1.03);
  chestWire.position.y = 0.14;
  chest.add(chestWire);

  // Astral Core Reactor on Chest
  const coreStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 1), accentMat);
  coreStar.position.set(0, 0.16, 0.18);
  chest.add(coreStar);

  // Neck & Head
  const neck = new THREE.Group();
  neck.position.y = 0.36;
  chest.add(neck);

  const neckCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.1, 14), coreMat);
  neckCyl.position.y = 0.04;
  neck.add(neckCyl);

  const head = new THREE.Group();
  head.position.y = 0.11;
  neck.add(head);

  const craniumGeo = new THREE.SphereGeometry(0.165, 28, 24);
  const cranium = new THREE.Mesh(craniumGeo, armorMat);
  cranium.scale.set(0.92, 1.12, 0.98);
  cranium.position.y = 0.12;
  head.add(cranium);

  const craniumWire = new THREE.Mesh(craniumGeo, wireMat);
  craniumWire.scale.set(0.95, 1.15, 1.01);
  craniumWire.position.y = 0.12;
  head.add(craniumWire);

  // Visor & Eyes
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.055, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.92,
    }),
  );
  visor.position.set(0, 0.14, 0.13);
  head.add(visor);

  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), accentMat);
  leftEye.position.set(-0.05, 0.14, 0.172);
  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), accentMat);
  rightEye.position.set(0.05, 0.14, 0.172);
  head.add(leftEye, rightEye);

  // Articulated Holographic Jaw / Voice Aperture (for honest audio-level lip sync)
  const jawAperture = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.04), jawMat);
  jawAperture.position.set(0, 0.055, 0.152);
  head.add(jawAperture);

  // Halo Crown Ring behind head
  const crownRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.008, 10, 40),
    accentMat.clone(),
  );
  crownRing.position.set(0, 0.14, -0.04);
  head.add(crownRing);

  // Helper to build articulated arms (Shoulder -> UpperArm -> Elbow -> Forearm -> Hand)
  function createArm(side) {
    const dir = side === 'left' ? 1 : -1;
    const shoulder = new THREE.Group();
    shoulder.position.set(dir * 0.26, 0.27, 0);
    chest.add(shoulder);

    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 14), armorMat);
    shoulder.add(pauldron);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.036, 0.26, 12), coreMat);
    upperArm.position.y = -0.14;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);

    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), armorMat);
    elbow.add(elbowJoint);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.24, 12), armorMat);
    forearm.position.y = -0.12;
    elbow.add(forearm);

    const hand = new THREE.Group();
    hand.position.y = -0.25;
    elbow.add(hand);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), accentMat);
    hand.add(palm);

    // Pointing holographic laser/beacon at fingertip
    const pointerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.024, 0.45, 10),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    pointerBeam.position.y = -0.24;
    hand.add(pointerBeam);

    return { shoulder, elbow, hand, pointerBeam };
  }

  const leftArm = createArm('left');
  const rightArm = createArm('right');

  // Orbital Telemetry Rings around the torso
  const ringOuter = new THREE.Mesh(
    new THREE.TorusGeometry(0.46, 0.007, 10, 64),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    }),
  );
  ringOuter.rotation.x = Math.PI * 0.42;
  ringOuter.position.y = 0.16;
  root.add(ringOuter);

  const ringInner = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.006, 10, 56),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    }),
  );
  ringInner.rotation.y = Math.PI * 0.25;
  ringInner.position.y = 0.16;
  root.add(ringInner);

  let clockTime = 0;

  /**
   * Updates the rigged skeleton pose and holographic shaders according to the active state.
   * @param {number} dt - Delta time in seconds.
   * @param {object} params - { state, speaking, audioLevel, pointDirection }
   */
  function update(dt, params = {}) {
    clockTime += dt;
    const state = KRONOX_AVATAR_STATES.includes(params.state) ? params.state : 'IDLE';
    const speaking = Boolean(params.speaking);
    const audioLevel = Number.isFinite(params.audioLevel) ? params.audioLevel : speaking ? 0.45 : 0.05;
    const pointDir = params.pointDirection || 'right'; // 'left' | 'right' | 'forward' | 'up'

    // Subtle floating hover of the pelvis
    pelvis.position.y = -0.18 + Math.sin(clockTime * 2.2) * 0.025;
    ringOuter.rotation.z = clockTime * 0.55;
    ringInner.rotation.x = Math.PI * 0.35 + Math.sin(clockTime * 0.9) * 0.25;
    ringInner.rotation.y = clockTime * -0.75;
    coreStar.rotation.y = clockTime * 1.8;
    crownRing.rotation.z = -clockTime * 0.6;

    // Target joint angles (x, y, z)
    let spineRot = [0, 0, 0];
    let headRot = [0, Math.sin(clockTime * 0.8) * 0.08, 0];
    let lShoulder = [0.12, 0, 0.18];
    let lElbow = [-0.35, 0, 0];
    let rShoulder = [0.12, 0, -0.18];
    let rElbow = [-0.35, 0, 0];
    let rBeamOpacity = 0;

    switch (state) {
      case 'GREETING': {
        const wave = Math.sin(clockTime * 6.5) * 0.28;
        spineRot = [0.05, 0.12, 0];
        headRot = [0.06, 0.1, 0.04];
        rShoulder = [-0.85, -0.2, -0.55 + wave * 0.3];
        rElbow = [-1.15, 0, wave];
        lShoulder = [0.15, 0, 0.22];
        lElbow = [-0.45, 0, 0];
        break;
      }
      case 'TALKING': {
        const g1 = Math.sin(clockTime * 3.8);
        const g2 = Math.cos(clockTime * 3.1);
        spineRot = [0.03, g1 * 0.08, 0];
        headRot = [Math.sin(clockTime * 2.7) * 0.06, g2 * 0.12, 0];
        lShoulder = [-0.35 + g1 * 0.15, 0.15, 0.25];
        lElbow = [-0.85 + g2 * 0.2, 0, 0];
        rShoulder = [-0.4 - g2 * 0.15, -0.15, -0.25];
        rElbow = [-0.9 - g1 * 0.2, 0, 0];
        break;
      }
      case 'EXPLAINING': {
        const spread = Math.sin(clockTime * 2.6) * 0.18;
        spineRot = [0.04, Math.sin(clockTime * 1.5) * 0.12, 0];
        headRot = [0.05, Math.sin(clockTime * 2.0) * 0.14, 0.04];
        lShoulder = [-0.55, 0.25, 0.45 + spread];
        lElbow = [-0.75, 0.2, 0];
        rShoulder = [-0.55, -0.25, -0.45 - spread];
        rElbow = [-0.75, -0.2, 0];
        break;
      }
      case 'POINTING': {
        const yawOffset = pointDir === 'left' ? 0.45 : pointDir === 'up' ? 0.1 : -0.42;
        const pitchOffset = pointDir === 'up' ? -1.35 : -1.05;
        spineRot = [0, yawOffset * 0.5, 0];
        headRot = [-0.08, yawOffset * 0.85, 0];
        rShoulder = [pitchOffset, yawOffset * 0.6, -0.32];
        rElbow = [-0.15, 0, 0];
        lShoulder = [0.18, 0, 0.24];
        lElbow = [-0.55, 0, 0];
        rBeamOpacity = 0.62 + Math.sin(clockTime * 8) * 0.2;
        break;
      }
      case 'NAVIGATING': {
        spineRot = [0.08, Math.sin(clockTime * 2.2) * 0.1, 0];
        headRot = [-0.06, Math.sin(clockTime * 1.8) * 0.18, 0];
        lShoulder = [-0.68, 0.2, 0.18];
        lElbow = [-0.65, 0, 0];
        rShoulder = [-0.68, -0.2, -0.18];
        rElbow = [-0.65, 0, 0];
        break;
      }
      case 'LISTENING': {
        spineRot = [0.06, 0, 0.04];
        headRot = [0.08, 0.05, 0.12];
        rShoulder = [-0.45, -0.25, -0.15];
        rElbow = [-1.25, 0, 0];
        lShoulder = [0.12, 0, 0.2];
        lElbow = [-0.4, 0, 0];
        break;
      }
      case 'SUCCESS': {
        const pulse = Math.sin(clockTime * 5.0) * 0.12;
        spineRot = [-0.05, 0, 0];
        headRot = [-0.06, 0, 0];
        lShoulder = [-1.1 + pulse, 0.15, 0.45];
        lElbow = [-0.6, 0, 0];
        rShoulder = [-1.1 + pulse, -0.15, -0.45];
        rElbow = [-0.6, 0, 0];
        break;
      }
      case 'FAREWELL': {
        const slowWave = Math.sin(clockTime * 3.5) * 0.22;
        spineRot = [0.12, 0, 0];
        headRot = [0.14, 0, 0];
        rShoulder = [-0.75, -0.15, -0.4 + slowWave];
        rElbow = [-0.95, 0, slowWave];
        break;
      }
      case 'IDLE':
      default: {
        const breath = Math.sin(clockTime * 1.8) * 0.04;
        spineRot = [breath * 0.5, Math.sin(clockTime * 0.6) * 0.06, 0];
        headRot = [breath, Math.sin(clockTime * 0.7) * 0.09, 0];
        lShoulder = [0.1, 0, 0.18 + breath];
        lElbow = [-0.35, 0, 0];
        rShoulder = [0.1, 0, -0.18 - breath];
        rElbow = [-0.35, 0, 0];
        break;
      }
    }

    // Smoothly interpolate skeletal joints
    const lerpRate = Math.min(1, dt * 7.5);
    spine.rotation.x += (spineRot[0] - spine.rotation.x) * lerpRate;
    spine.rotation.y += (spineRot[1] - spine.rotation.y) * lerpRate;
    spine.rotation.z += (spineRot[2] - spine.rotation.z) * lerpRate;

    head.rotation.x += (headRot[0] - head.rotation.x) * lerpRate;
    head.rotation.y += (headRot[1] - head.rotation.y) * lerpRate;
    head.rotation.z += (headRot[2] - head.rotation.z) * lerpRate;

    leftArm.shoulder.rotation.x += (lShoulder[0] - leftArm.shoulder.rotation.x) * lerpRate;
    leftArm.shoulder.rotation.y += (lShoulder[1] - leftArm.shoulder.rotation.y) * lerpRate;
    leftArm.shoulder.rotation.z += (lShoulder[2] - leftArm.shoulder.rotation.z) * lerpRate;
    leftArm.elbow.rotation.x += (lElbow[0] - leftArm.elbow.rotation.x) * lerpRate;
    leftArm.elbow.rotation.y += (lElbow[1] - leftArm.elbow.rotation.y) * lerpRate;
    leftArm.elbow.rotation.z += (lElbow[2] - leftArm.elbow.rotation.z) * lerpRate;

    rightArm.shoulder.rotation.x += (rShoulder[0] - rightArm.shoulder.rotation.x) * lerpRate;
    rightArm.shoulder.rotation.y += (rShoulder[1] - rightArm.shoulder.rotation.y) * lerpRate;
    rightArm.shoulder.rotation.z += (rShoulder[2] - rightArm.shoulder.rotation.z) * lerpRate;
    rightArm.elbow.rotation.x += (rElbow[0] - rightArm.elbow.rotation.x) * lerpRate;
    rightArm.elbow.rotation.y += (rElbow[1] - rightArm.elbow.rotation.y) * lerpRate;
    rightArm.elbow.rotation.z += (rElbow[2] - rightArm.elbow.rotation.z) * lerpRate;

    rightArm.pointerBeam.material.opacity +=
      (rBeamOpacity - rightArm.pointerBeam.material.opacity) * lerpRate;

    // Audio-level synchronized vocal aperture & core glow
    const mouthScaleY = speaking
      ? 1 + Math.min(3.4, audioLevel * 3.8 + Math.abs(Math.sin(clockTime * 18)) * 1.4)
      : 1;
    jawAperture.scale.y = mouthScaleY;
    coreStar.scale.setScalar(speaking ? 1 + audioLevel * 0.45 : 1 + Math.sin(clockTime * 3) * 0.08);
    coreMat.emissiveIntensity = speaking ? 0.85 + audioLevel * 0.65 : 0.72;
  }

  return { root, update };
}

