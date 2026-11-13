import * as THREE from 'three';
import { clampAstronautPosition } from './kronoxInteriorSpatialModel.js';

export const KRONOX_AI_STATES = Object.freeze([
  'Acompañamiento',
  'Explicación',
  'Comunicación',
  'Señalización',
  'Desplazamiento',
  'Celebración',
]);

const STATE_PALETTES = {
  Acompañamiento: { core: 0xe0f2fe, ring: 0x38bdf8, speed: 1.0, lightIntensity: 0.75 },
  Explicación: { core: 0xfef3c7, ring: 0xf59e0b, speed: 1.8, lightIntensity: 1.0 },
  Comunicación: { core: 0xdbeafe, ring: 0x60a5fa, speed: 2.3, lightIntensity: 1.15 },
  Señalización: { core: 0xd1fae5, ring: 0x34d399, speed: 2.1, lightIntensity: 1.1 },
  Desplazamiento: { core: 0xe0f2fe, ring: 0x6ff0ff, speed: 2.8, lightIntensity: 0.9 },
  Celebración: { core: 0xfde68a, ring: 0xfbbf24, speed: 3.1, lightIntensity: 1.3 },
};

function createGlowSpriteTexture() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.28, 'rgba(111,240,255,0.55)');
  g.addColorStop(0.65, 'rgba(56,189,248,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Refined 3D luminous spherical KRONOX IA companion entity with multi-layered plasma core,
 * filigree gyroscopic rings, volumetric corona halo, hull-aware flight navigation across all 4 decks,
 * and laser-thin 3D pointing vector toward consoles or cosmos targets.
 */
export function createKronoxCompanionEntity3D({
  initialPosition = new THREE.Vector3(1.15, 0.15, -45.5),
} = {}) {
  const group = new THREE.Group();
  group.name = 'KronoxIA_LuminousEntity';
  group.position.copy(initialPosition);

  const entityGroup = new THREE.Group();
  group.add(entityGroup);

  // Compact precision holographic AI core (~35 cm total span, non-blinding translucent cyan-sapphire)
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x0284c7,
    emissiveIntensity: 0.72,
    metalness: 0.18,
    roughness: 0.2,
    transparent: true,
    opacity: 0.88,
  });
  const coreSphere = new THREE.Mesh(new THREE.SphereGeometry(0.054, 22, 18), coreMat);
  entityGroup.add(coreSphere);

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0369a1,
    emissiveIntensity: 0.45,
    metalness: 0.88,
    roughness: 0.18,
    wireframe: true,
    transparent: true,
    opacity: 0.34,
  });
  const photonicShell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.088, 1), shellMat);
  entityGroup.add(photonicShell);

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.58,
    metalness: 0.92,
    roughness: 0.14,
  });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.0046, 10, 36), ringMat);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.0038, 10, 40), ringMat);
  ringB.rotation.x = Math.PI / 2.6;
  const ringC = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.0032, 8, 44), ringMat);
  ringC.rotation.y = Math.PI / 3;
  entityGroup.add(ringA, ringB, ringC);

  const glowTex = createGlowSpriteTexture();
  const corona = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  corona.scale.set(0.42, 0.42, 1);
  entityGroup.add(corona);

  const companionLight = new THREE.PointLight(0x38bdf8, 0.48, 3.6, 1.8);
  entityGroup.add(companionLight);

  // Subtle spatial wake trail (parented to scene origin via update)
  const wakeMaxPts = 28;
  const wakePositions = new Float32Array(wakeMaxPts * 3);
  for (let i = 0; i < wakeMaxPts; i++) {
    wakePositions[i * 3] = initialPosition.x;
    wakePositions[i * 3 + 1] = initialPosition.y;
    wakePositions[i * 3 + 2] = initialPosition.z;
  }
  const wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePositions, 3));
  const trailLine = new THREE.Line(
    wakeGeo,
    new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
    }),
  );
  trailLine.frustumCulled = false;

  // Pointing beam line (entity -> station console or celestial direction)
  const beamPositions = new Float32Array(6);
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute('position', new THREE.BufferAttribute(beamPositions, 3));
  const pointingBeam = new THREE.Line(
    beamGeo,
    new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
    }),
  );
  pointingBeam.visible = false;
  pointingBeam.frustumCulled = false;

  function resetWake(pos) {
    const px = Number(pos?.x ?? group.position.x);
    const py = Number(pos?.y ?? group.position.y);
    const pz = Number(pos?.z ?? group.position.z);
    for (let i = 0; i < wakeMaxPts; i++) {
      wakePositions[i * 3] = px;
      wakePositions[i * 3 + 1] = py;
      wakePositions[i * 3 + 2] = pz;
    }
    wakeGeo.attributes.position.needsUpdate = true;
  }

  let currentState = 'Acompañamiento';
  const targetPos = initialPosition.clone();
  const pointedTarget = new THREE.Vector3();
  let isPointing = false;
  let clock = 0;

  function setState(nextState) {
    if (KRONOX_AI_STATES.includes(nextState)) {
      currentState = nextState;
    }
  }

  function setTargetPosition(pos, stateName = null) {
    if (pos) {
      targetPos.set(Number(pos.x || 0), Number(pos.y || 0), Number(pos.z || 0));
      clampAstronautPosition(targetPos, 0.35, 0.25);
    }
    if (stateName) setState(stateName);
  }

  function pointAtWorldPosition(pos, visible = true) {
    if (!pos || !visible) {
      isPointing = false;
      pointingBeam.visible = false;
      return;
    }
    pointedTarget.set(Number(pos.x || 0), Number(pos.y || 0), Number(pos.z || 0));
    isPointing = true;
    pointingBeam.visible = true;
  }

  function update(dt = 0.016, elapsed = 0, speaking = false, audioLevel = 0.08) {
    const safeDt = Math.max(0.001, Math.min(0.1, dt));
    clock = elapsed || clock + safeDt;
    const pal = STATE_PALETTES[currentState] || STATE_PALETTES['Acompañamiento'];

    coreMat.color.setHex(pal.core);
    ringMat.color.setHex(pal.ring);
    ringMat.emissive.setHex(pal.ring);
    shellMat.emissive.setHex(pal.ring);
    companionLight.color.setHex(pal.ring);

    // Smooth flight displacement toward target; clamp cross-deck teleports cleanly without wake streaks
    const prevX = group.position.x;
    const prevY = group.position.y;
    const prevZ = group.position.z;
    const spring = Math.min(1, safeDt * 4.4);
    group.position.lerp(targetPos, spring);
    clampAstronautPosition(group.position, 0.35, 0.25);
    const frameStepDist = Math.hypot(group.position.x - prevX, group.position.y - prevY, group.position.z - prevZ);
    if (frameStepDist > 1.8) {
      resetWake(group.position);
    }

    const bob = Math.sin(clock * 2.2) * 0.045;
    entityGroup.position.y = bob;

    const pulseScale = 1 + (speaking ? Math.min(0.2, audioLevel * 0.3) + Math.sin(clock * 14) * 0.04 : Math.sin(clock * 3) * 0.025);
    coreSphere.scale.setScalar(pulseScale);
    corona.scale.setScalar(0.42 * pulseScale + (speaking ? 0.08 : 0));
    companionLight.intensity = 0.45 + (speaking ? 0.25 : 0);
    coreMat.emissive.setHex(pal.ring);

    const spin = safeDt * pal.speed;
    ringA.rotation.x += spin * 1.1;
    ringA.rotation.y += spin * 0.7;
    ringB.rotation.y -= spin * 1.4;
    ringB.rotation.z += spin * 0.6;
    ringC.rotation.z -= spin * 0.9;
    photonicShell.rotation.y += spin * 0.5;

    // Shift wake points cleanly
    const arr = wakeGeo.attributes.position.array;
    for (let i = wakeMaxPts - 1; i > 0; i--) {
      arr[i * 3] = arr[(i - 1) * 3];
      arr[i * 3 + 1] = arr[(i - 1) * 3 + 1];
      arr[i * 3 + 2] = arr[(i - 1) * 3 + 2];
    }
    arr[0] = group.position.x;
    arr[1] = group.position.y + bob;
    arr[2] = group.position.z;
    wakeGeo.attributes.position.needsUpdate = true;

    if (isPointing) {
      const bArr = beamGeo.attributes.position.array;
      bArr[0] = group.position.x;
      bArr[1] = group.position.y + bob;
      bArr[2] = group.position.z;
      bArr[3] = pointedTarget.x;
      bArr[4] = pointedTarget.y;
      bArr[5] = pointedTarget.z;
      beamGeo.attributes.position.needsUpdate = true;
    }
  }

  return {
    group,
    trailLine,
    pointingBeam,
    getState: () => currentState,
    setState,
    setTargetPosition,
    pointAtWorldPosition,
    resetWake,
    getPosition: () => group.position.clone(),
    getPointedTarget: () => (isPointing ? pointedTarget.clone() : null),
    update,
  };
}

