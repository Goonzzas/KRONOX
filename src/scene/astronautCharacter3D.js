import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Vectorial / DataURI asset representation for Astral Sentinels branding (100% Node ESM safe)
const ASTRAL_SENTINELS_LOGO_SRC =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAIAAgADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7KoNFFABRRRQAUUUUAFFFJQAtFFFABRRRQAUUUUAFFFFABRQaKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoFJS0AFFFFABz7UUUfSgAooooAKKKKACiiigAooooAKKKKACiiigAooo5oAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKADmiiigAooooAKKKKACiiigAooooAKKKKACiiigAo7UUUAFFFFABRRRQAUcelFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUGgAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKDRQAUUUUAFFFFABRRRQAUUUUAFFFFABzRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUdqKACjtRRQAUGiigAooooAKKKKACiiigAooooAKKSloAKKKKACj1oooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKBQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRSUALRRRQAGiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKADn0ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigApKWigAooooAKKKKACiiigAooooAKKKKACiiigAqK5nitreS4mYJHEhd2PZQMk1LXA/HbXV0fwBdQpJtudQP2SLB5w33z+Cg/mK1o0nVqRprqzmxmJjhaE60tops7m2mjuLeOeFt0ciB0b1BGQalrhfgfrY1jwBYq0m+exH2SYZ5+T7p/Fdtd1SrUnSqSg+jHhMRHE0IVo7SSYUUUVmdAUUUUAFFFFABRRRQAUUUUAFFFBoAKKKKAEpaKKACiiigAooooAKKKKACiiigAoooFABRRRQAUUUdqACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooASloooAKKKKACiiigAooooAKKKKACiiigAorjPiD4r1zw9bu2m+ENQ1RQM/aEdTGvuVXL/oPrV06cqklGO5jXxEKEHOey7Jv8jrL26t7K1kurueOCCJS0kkjBVUDuSa+WfjF4yXxd4nL2jk6bZgxWuQRvz958dskDHsBWd4y8beJPFUpGr3hFurZS0iXZEh916k+7ZNcwc55r6vLcq+rP2lR3l+R+acQcR/X4+woq0Ot93/APAvwv4yXwl4mYXkrDS71RHc9/LI+7Jj2yQfY+1fUVndQXdulzbTRzQyAMkiNuVh6g96+IQcHg10/gnxt4j8LXIXTL4/ZmbLWko3xOfYdQfdcUZllX1l+1pu0vzDIOJPqEPYVleHS26/zR9fUVxnw98V654ihVtT8I3+lrtz9odgIn+ith/0P1rsq+UqU5U5cst/vP0vD14YiCqQ2fdNfmLRRRUGwUUdqKACiiigAooooAKKSloAKKKKACiiigAoo/CigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACj8KKKACiig0AFFFFAAelIRmlooA4zx/8OtB8W2ztNCtnqGPkvIVAfPbcOjj68+hFfMXivQ73w3rtzo+oqBcQHqv3XU/dZfYj/PFfaFePftJ+HY7jQrbxJDH+/smEMxA5aJzxn6Nj/vo17eUY+dOoqU37r/A+O4pyWlVw8sTSjacdXbqup4j4S0G+8S69b6Np6jz5ifmb7sajqx9gP6DvX014A+HHh/wpbxyRwLe6iB895MoLZ/2B0QfTn1Ncp+zT4bS10C48STx/6RfsYoSRyIUPb6tn/vkV6+KM2x851XSg/dX4sfDGS0qOHjiasbzlqr9F0t5gBgYpaSlrxD7AKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigANFFHbNABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRR2ooAKKKKACiiigAooooAKKSloAKKKKACiiigAooooAKyfGHiHS/Cnhq/8Q6zOYbCxhMszAZbA4AA7kkgAdyRWtXyR+3b4/Z7jT/h3p03Cbb7U9p78+TGf1c/8ArSlT9pNRIqT5I3P/2Q==';

let cachedAstralTexture = null;
let cachedNasaTexture = null;
let cachedCarbonTexture = null;
let cachedHoseBumpTexture = null;

function createCapsuleGeometry(r, len, radial = 8, cap = 6) {
  if (typeof THREE.CapsuleGeometry === 'function') {
    return new THREE.CapsuleGeometry(r, len, cap, radial);
  }
  return new THREE.CylinderGeometry(r, r, len + r * 1.2, radial);
}

/**
 * Super-ellipsoid geometry generator for high-definition aerodynamic helmet shell & visor.
 */
function createSuperEllipsoidGeometry(r, e, wS = 36, hS = 24, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) {
  const g = new THREE.SphereGeometry(r, wS, hS, ps, pl, ts, tl);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const f = (a) => Math.sign(a) * Math.pow(Math.abs(a), e);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const l = v.length();
    if (l > 1e-6) {
      v.divideScalar(l);
      p.setXYZ(i, f(v.x) * l, f(v.y) * l, f(v.z) * l);
    }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Procedural 2x2 carbon fiber weave texture for suit fabric.
 */
function getCarbonFiberTexture() {
  if (cachedCarbonTexture) return cachedCarbonTexture;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    cachedCarbonTexture = new THREE.Texture();
    return cachedCarbonTexture;
  }
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    if (g && typeof g.fillRect === 'function') {
      for (let j = 0; j < 16; j++) {
        for (let i = 0; i < 16; i++) {
          const x = i * 16;
          const y = j * 16;
          const h = ((i + j) % 4) < 2;
          const gr = h ? g.createLinearGradient(x, y, x, y + 16) : g.createLinearGradient(x, y, x + 16, y);
          gr.addColorStop(0, '#26292e');
          gr.addColorStop(0.5, '#4e5560');
          gr.addColorStop(1, '#26292e');
          g.fillStyle = gr;
          g.fillRect(x, y, 16, 16);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 4);
      t.anisotropy = 4;
      cachedCarbonTexture = t;
      return t;
    }
  } catch {
    // fallback in headless harness
  }
  cachedCarbonTexture = new THREE.Texture();
  return cachedCarbonTexture;
}

/**
 * Ribbed life-support oxygen conduit bump texture.
 */
function getHoseBumpTexture() {
  if (cachedHoseBumpTexture) return cachedHoseBumpTexture;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  try {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 4;
    const g = c.getContext('2d');
    if (g && typeof g.fillRect === 'function') {
      const gr = g.createLinearGradient(0, 0, 32, 0);
      gr.addColorStop(0, '#000000');
      gr.addColorStop(0.5, '#ffffff');
      gr.addColorStop(1, '#000000');
      g.fillStyle = gr;
      g.fillRect(0, 0, 32, 4);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(48, 1);
      cachedHoseBumpTexture = t;
      return t;
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Official Astral Sentinels institutional patch texture.
 */
function getAstralSentinelsTexture() {
  if (cachedAstralTexture) return cachedAstralTexture;
  let baseTex = null;

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx && typeof ctx.fillRect === 'function') {
        ctx.fillStyle = '#080d1a';
        ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 8;
        ctx.strokeRect(12, 12, 232, 232);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ASTRAL', 128, 110);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('SENTINELS', 128, 146);
        baseTex = new THREE.CanvasTexture(canvas);
        baseTex.encoding = THREE.sRGBEncoding;
      }
    } catch {
      // ignore in test runners
    }
  }

  if (!baseTex) {
    baseTex = new THREE.Texture();
  }

  try {
    if (
      typeof window !== 'undefined' &&
      typeof document !== 'undefined' &&
      typeof document.createElementNS === 'function' &&
      ASTRAL_SENTINELS_LOGO_SRC
    ) {
      const loader = new THREE.TextureLoader();
      loader.load(
        ASTRAL_SENTINELS_LOGO_SRC,
        (loaded) => {
          loaded.encoding = THREE.sRGBEncoding;
          loaded.anisotropy = 4;
          baseTex.image = loaded.image;
          baseTex.needsUpdate = true;
        },
        undefined,
        () => {}
      );
    }
  } catch {
    // headless fallback
  }

  cachedAstralTexture = baseTex;
  return cachedAstralTexture;
}

/**
 * Procedural circular NASA meatball mission insignia patch.
 */
function getNasaInsigniaTexture() {
  if (cachedNasaTexture) return cachedNasaTexture;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    cachedNasaTexture = new THREE.Texture();
    return cachedNasaTexture;
  }
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    if (g && typeof g.arc === 'function') {
      g.beginPath();
      g.arc(128, 128, 124, 0, Math.PI * 2);
      g.fillStyle = '#0b3d91';
      g.fill();
      // Stars
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2 + Math.sin(i * 3.7);
        const r = Math.sqrt((i + 1) / 50) * 105;
        g.fillStyle = '#ffffff';
        g.fillRect(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 2.5, 2.5);
      }
      // Vector orbit ring
      g.strokeStyle = '#ffffff';
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(128, 134, 110, 34, -0.42, 0, Math.PI * 2);
      g.stroke();
      // Red chevron
      g.fillStyle = '#fc3d21';
      g.beginPath();
      g.moveTo(38, 188);
      g.lineTo(120, 84);
      g.lineTo(138, 128);
      g.lineTo(222, 62);
      g.lineTo(165, 176);
      g.lineTo(140, 142);
      g.lineTo(94, 202);
      g.closePath();
      g.fill();
      // NASA typography
      g.fillStyle = '#ffffff';
      g.font = 'italic bold 74px Arial, Helvetica, sans-serif';
      g.textAlign = 'center';
      g.fillText('NASA', 128, 156);
      // Outer border
      g.lineWidth = 6;
      g.strokeStyle = '#ffffff';
      g.beginPath();
      g.arc(128, 128, 122, 0, Math.PI * 2);
      g.stroke();
      const t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      cachedNasaTexture = t;
      return t;
    }
  } catch {
    // headless fallback
  }
  cachedNasaTexture = new THREE.Texture();
  return cachedNasaTexture;
}

/**
 * Animation states for full astronaut locomotion, console ops and EVA maneuvers.
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
  SEATED_COMMAND: 'SEATED_COMMAND',
  RESTING_BED: 'RESTING_BED',
});

/**
 * Creates coordinated procedural materials based on the Astral Sentinels technical palette.
 */
function createAstronautMaterials() {
  const carbonTex = getCarbonFiberTexture();
  const hoseBump = getHoseBumpTexture();
  const hasCarbon = Boolean(carbonTex && carbonTex.image);
  const hasHoseBump = Boolean(hoseBump && hoseBump.image);

  return {
    suitOuter: new THREE.MeshStandardMaterial({
      // Match the reference astronaut: orange carbon-fiber pressure suit.
      color: 0xc94b0d,
      roughness: 0.48,
      metalness: 0.16,
      ...(hasCarbon ? { bumpMap: carbonTex, bumpScale: 0.055 } : {}),
    }),
    suitCrease: new THREE.MeshStandardMaterial({
      color: 0xa83b09,
      roughness: 0.62,
      metalness: 0.12,
    }),
    armorPlate: new THREE.MeshStandardMaterial({
      color: 0xe96a18,
      roughness: 0.34,
      metalness: 0.2,
    }),
    jointDark: new THREE.MeshStandardMaterial({
      color: 0x0f1115,
      roughness: 0.65,
      metalness: 0.35,
    }),
    harnessWeb: new THREE.MeshStandardMaterial({
      color: 0x111214,
      roughness: 0.58,
      metalness: 0.12,
    }),
    missionAccent: new THREE.MeshStandardMaterial({
      color: 0x686d72,
      roughness: 0.42,
      metalness: 0.34,
    }),
    tealLED: new THREE.MeshStandardMaterial({
      color: 0x19c9d0,
      emissive: 0x19e0e8,
      emissiveIntensity: 1.8,
      roughness: 0.22,
    }),
    tealTrim: new THREE.MeshStandardMaterial({
      color: 0x19c9d0,
      emissive: 0x0aa8b0,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    }),
    redBeacon: new THREE.MeshStandardMaterial({
      color: 0xc02020,
      roughness: 0.35,
      metalness: 0.1,
    }),
    helmetShell: new THREE.MeshPhysicalMaterial({
      color: 0xf4f5f7,
      roughness: 0.26,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    }),
    visorGold: new THREE.MeshPhysicalMaterial({
      color: 0x0b0905,
      roughness: 0.03,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.2,
      emissive: 0xd49b28,
      emissiveIntensity: 0.14,
    }),
    visorInnerTint: new THREE.MeshStandardMaterial({
      color: 0x07090e,
      roughness: 0.22,
      metalness: 0.4,
    }),
    chromeHardware: new THREE.MeshStandardMaterial({
      color: 0x8a8e93,
      roughness: 0.38,
      metalness: 0.55,
    }),
    gloveMat: new THREE.MeshStandardMaterial({
      color: 0x1a1b1e,
      roughness: 0.55,
    }),
    bootMat: new THREE.MeshStandardMaterial({
      color: 0x1d1e21,
      roughness: 0.48,
    }),
    hoseMat: new THREE.MeshStandardMaterial({
      color: 0x26282d,
      roughness: 0.52,
      ...(hasHoseBump ? { bumpMap: hoseBump, bumpScale: 0.12 } : {}),
    }),
    astralPatch: new THREE.MeshStandardMaterial({
      map: getAstralSentinelsTexture(),
      roughness: 0.4,
      metalness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    nasaPatch: new THREE.MeshStandardMaterial({
      map: getNasaInsigniaTexture(),
      roughness: 0.4,
      metalness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
    rcsPlumeMat: new THREE.MeshBasicMaterial({
      color: 0xb8e2f8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  };
}

/**
 * Builds the articulated 5-finger tactical EVA glove with capsule joints.
 */
function buildArticulatedHand(mats, sideSign) {
  const g = new THREE.Group();
  g.scale.set(sideSign, 1, 1);

  // Palm base
  const palm = new THREE.Mesh(createSuperEllipsoidGeometry(1, 0.6, 20, 14), mats.gloveMat);
  palm.scale.set(0.024, 0.058, 0.048);
  palm.position.set(0, -0.062, 0);
  palm.castShadow = true;
  g.add(palm);

  // Knuckle pad
  const knucklePad = new THREE.Mesh(createSuperEllipsoidGeometry(1, 0.55, 16, 10), mats.jointDark);
  knucklePad.scale.set(0.01, 0.04, 0.036);
  knucklePad.position.set(0.02, -0.058, 0);
  knucklePad.castShadow = true;
  g.add(knucklePad);

  // 4 fingers with 3 articulated phalanges each
  const fingerZOffsets = [0.032, 0.011, -0.011, -0.032];
  const fingerScales = [1.0, 1.07, 1.0, 0.82];
  fingerZOffsets.forEach((fz, i) => {
    const L = fingerScales[i];
    let parentNode = g;
    let localPos = [0, -0.115, fz];
    const segs = [
      [0.036 * L, 0.0125, -0.2],
      [0.027 * L, 0.0115, -0.55],
      [0.02 * L, 0.0105, -0.55],
    ];
    segs.forEach(([len, r, c]) => {
      const joint = new THREE.Group();
      joint.position.set(...localPos);
      joint.rotation.z = c;
      parentNode.add(joint);
      const cap = new THREE.Mesh(createCapsuleGeometry(r, len, 8, 6), mats.gloveMat);
      cap.position.y = -len * 0.5 - r * 0.5;
      cap.castShadow = true;
      joint.add(cap);
      parentNode = joint;
      localPos = [0, -len - r * 0.6, 0];
    });
  });

  // Opposed thumb
  const thumbNode = new THREE.Group();
  thumbNode.position.set(-0.012, -0.04, 0.04);
  thumbNode.rotation.set(-0.9, 0, -0.25);
  g.add(thumbNode);

  let thumbParent = thumbNode;
  let thumbPos = [0, 0, 0];
  [
    [0.03, 0.015, -0.1],
    [0.024, 0.013, -0.45],
  ].forEach(([len, r, c]) => {
    const j = new THREE.Group();
    j.position.set(...thumbPos);
    j.rotation.z = c;
    thumbParent.add(j);
    const cap = new THREE.Mesh(createCapsuleGeometry(r, len, 8, 6), mats.missionAccent);
    cap.position.y = -len * 0.5 - r * 0.5;
    cap.castShadow = true;
    j.add(cap);
    thumbParent = j;
    thumbPos = [0, -len - r * 0.6, 0];
  });

  return g;
}

/**
 * Builds the high-detail magnetic pressure boot with lathe calf collar, instep, toe cap, and tread sole.
 */
function buildArticulatedBoot(mats) {
  const g = new THREE.Group();
  const ellGeo = () => createSuperEllipsoidGeometry(1, 0.6, 24, 16);

  // Contoured calf collar
  const lathePts = [
    [0, 0.46],
    [0.092, 0.46],
    [0.104, 0.455],
    [0.106, 0.43],
    [0.099, 0.4],
    [0.09, 0.26],
    [0.086, 0.15],
    [0.09, 0.09],
    [0, 0.09],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const collar = new THREE.Mesh(new THREE.LatheGeometry(lathePts, 32), mats.bootMat);
  collar.castShadow = true;
  g.add(collar);

  // Instep upper
  const instep = new THREE.Mesh(ellGeo(), mats.bootMat);
  instep.position.set(0, 0.075, 0.065);
  instep.scale.set(0.096, 0.064, 0.2);
  instep.castShadow = true;
  g.add(instep);

  // Protective toe cap
  const toeCap = new THREE.Mesh(ellGeo(), mats.jointDark);
  toeCap.position.set(0, 0.062, 0.2);
  toeCap.scale.set(0.09, 0.052, 0.085);
  toeCap.castShadow = true;
  g.add(toeCap);

  // Heel cup
  const heel = new THREE.Mesh(ellGeo(), mats.jointDark);
  heel.position.set(0, 0.12, -0.07);
  heel.scale.set(0.075, 0.07, 0.045);
  heel.castShadow = true;
  g.add(heel);

  // White shock midsole
  const midSole = new THREE.Mesh(ellGeo(), mats.armorPlate);
  midSole.position.set(0, 0.027, 0.06);
  midSole.scale.set(0.108, 0.03, 0.215);
  midSole.castShadow = true;
  g.add(midSole);

  // Black magnetic tread outsole
  const outSole = new THREE.Mesh(ellGeo(), mats.jointDark);
  outSole.position.set(0, 0.008, 0.06);
  outSole.scale.set(0.11, 0.012, 0.22);
  outSole.castShadow = true;
  g.add(outSole);

  // Shin armor plate and buckle hardware
  const shinArmor = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.17, 0.012, 2, 0.003), mats.jointDark);
  shinArmor.position.set(0, 0.27, 0.098);
  shinArmor.rotation.x = -0.12;
  const tealBuckle = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.03, 0.02, 1, 0.003), mats.tealTrim);
  tealBuckle.position.set(0, 0.2, 0.1);
  const grayBuckle = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.03, 0.02, 1, 0.003), mats.chromeHardware);
  grayBuckle.position.set(0, 0.32, 0.106);
  g.add(shinArmor, tealBuckle, grayBuckle);

  return g;
}

/**
 * Builds an articulated limb (arm or leg) with joints and end effector.
 */
function buildArticulatedLimb(mats, upperR, upperL, lowerR, lowerL, limbType = 'glove', sideSign = -1) {
  const hipOrShoulder = new THREE.Group();

  // Socket bearing ring
  const socketRing = new THREE.Mesh(new THREE.TorusGeometry(upperR * 1.15, 0.015, 8, 20), mats.chromeHardware);
  socketRing.rotation.x = Math.PI / 2;
  hipOrShoulder.add(socketRing);

  // Upper segment mesh
  const upperGeo = new THREE.CylinderGeometry(upperR * 0.94, upperR * 1.08, upperL, 18);
  const upperMesh = new THREE.Mesh(upperGeo, mats.suitOuter);
  upperMesh.position.y = -upperL * 0.5;
  upperMesh.castShadow = true;
  hipOrShoulder.add(upperMesh);

  // Arm/shoulder specifics
  if (limbType === 'glove') {
    // Shoulder pauldron
    const pauldron = new THREE.Mesh(
      new RoundedBoxGeometry(upperR * 2.3, upperL * 0.36, upperR * 2.1, 2, 0.02),
      mats.armorPlate
    );
    pauldron.position.set(sideSign * 0.01, -upperL * 0.16, 0);
    hipOrShoulder.add(pauldron);

    // Colombian flag stripe on left shoulder/arm
    if (sideSign < 0) {
      const flagGroup = new THREE.Group();
      flagGroup.position.set(sideSign * (upperR * 1.12 + 0.008), -upperL * 0.22, 0);
      flagGroup.rotation.y = -Math.PI / 2;
      const fYellow = new THREE.Mesh(
        new THREE.PlaneGeometry(0.05, 0.024),
        new THREE.MeshStandardMaterial({ color: 0xf8bf12, roughness: 0.5 })
      );
      fYellow.position.y = 0.012;
      const fBlue = new THREE.Mesh(
        new THREE.PlaneGeometry(0.05, 0.012),
        new THREE.MeshStandardMaterial({ color: 0x0c2577, roughness: 0.5 })
      );
      fBlue.position.y = -0.006;
      const fRed = new THREE.Mesh(
        new THREE.PlaneGeometry(0.05, 0.012),
        new THREE.MeshStandardMaterial({ color: 0xcd191e, roughness: 0.5 })
      );
      fRed.position.y = -0.018;
      flagGroup.add(fYellow, fBlue, fRed);
      hipOrShoulder.add(flagGroup);
    }
  }

  // Mid joint (Elbow or Knee)
  const midJoint = new THREE.Group();
  midJoint.position.y = -upperL;
  const jointCore = new THREE.Mesh(new THREE.SphereGeometry(upperR * 0.92, 14, 12), mats.jointDark);
  jointCore.castShadow = true;
  midJoint.add(jointCore);

  if (limbType === 'boot') {
    // Thigh cargo utility pocket on upper segment
    const cargoPocket = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.11, 0.03, 2, 0.008), mats.jointDark);
    cargoPocket.position.set(sideSign * 0.14, -upperL * 0.45, 0.06);
    cargoPocket.rotation.y = sideSign * 0.4;
    const pocketTrim = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.012, 0.034, 1, 0.003), mats.tealTrim);
    pocketTrim.position.set(sideSign * 0.14, -upperL * 0.42, 0.06);
    pocketTrim.rotation.y = sideSign * 0.4;
    hipOrShoulder.add(cargoPocket, pocketTrim);

    // Contoured knee armor pad
    const kneePad = new THREE.Mesh(new RoundedBoxGeometry(lowerR * 1.9, 0.11, 0.06, 2, 0.015), mats.armorPlate);
    kneePad.position.set(0, 0, -lowerR * 0.95);
    kneePad.castShadow = true;
    midJoint.add(kneePad);
  }

  // Lower segment mesh
  const lowerGeo = new THREE.CylinderGeometry(lowerR * 1.02, lowerR * 0.88, lowerL, 18);
  const lowerMesh = new THREE.Mesh(lowerGeo, mats.suitOuter);
  lowerMesh.position.y = -lowerL * 0.5;
  lowerMesh.castShadow = true;
  midJoint.add(lowerMesh);

  // Outer LED light strip
  const stripGeo = new THREE.BoxGeometry(0.01, lowerL * 0.85, 0.014);
  const ledStrip = new THREE.Mesh(stripGeo, mats.tealLED);
  ledStrip.position.set(sideSign * (lowerR * 0.98 + 0.004), -lowerL * 0.5, 0);
  midJoint.add(ledStrip);

  // End effector
  if (limbType === 'glove') {
    const hand = buildArticulatedHand(mats, sideSign);
    hand.position.set(0, -lowerL - 0.02, 0);
    midJoint.add(hand);
  } else {
    const boot = buildArticulatedBoot(mats);
    boot.position.set(0, -lowerL - 0.38, -0.05);
    midJoint.add(boot);
  }

  hipOrShoulder.add(midJoint);
  return { root: hipOrShoulder, midJoint, upperMesh, lowerMesh };
}

/**
 * Creates the high-definition articulated 3D astronaut character (1.75 m stature).
 */
export function createAstronautCharacter3D() {
  const root = new THREE.Group();
  root.name = 'KronoxAstronautHighDetail';
  const mats = createAstronautMaterials();

  // Root Pelvis at y = 0.90 m
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.9, 0);
  root.add(pelvis);

  const pelvisShell = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.22, 0.24, 3, 0.05), mats.suitCrease);
  pelvisShell.castShadow = true;
  pelvis.add(pelvisShell);

  // Utility belt with front buckle
  const beltBuckle = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.045, 0.03, 2, 0.006), mats.tealTrim);
  beltBuckle.position.set(0, 0.07, -0.125);
  pelvis.add(beltBuckle);

  // HARD UPPER TORSO (HUT)
  const torso = new THREE.Group();
  torso.position.set(0, 0.24, 0);
  pelvis.add(torso);

  const chestShell = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.44, 0.28, 4, 0.06), mats.armorPlate);
  chestShell.castShadow = true;
  torso.add(chestShell);

  // Crossed X-harness with teal buckles
  [-1, 1].forEach((s) => {
    const strap = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.46, 0.295, 2, 0.008), mats.harnessWeb);
    strap.position.set(s * 0.1, 0.02, 0);
    const buckle = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.035, 0.305, 1, 0.005), mats.tealTrim);
    buckle.position.set(s * 0.1, 0.09, 0);
    torso.add(strap, buckle);
  });

  // Chest central glowing core (energy ring)
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 12, 32), mats.tealLED);
  coreRing.position.set(0, 0.14, -0.145);
  const coreDisk = new THREE.Mesh(new THREE.CircleGeometry(0.028, 24), mats.tealLED);
  coreDisk.position.set(0, 0.14, -0.144);
  coreDisk.rotation.y = Math.PI;
  torso.add(coreRing, coreDisk);

  // Chest telemetry control panel
  const chestDcm = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.055, 0.02, 2, 0.004), mats.jointDark);
  chestDcm.position.set(-0.06, 0.04, -0.146);
  const dcmScreen = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.012, 0.022, 1, 0.002), mats.tealTrim);
  dcmScreen.position.set(-0.06, 0.04, -0.152);
  torso.add(chestDcm, dcmScreen);

  // PORTABLE LIFE SUPPORT SYSTEM (PLSS) BACKPACK
  const backpack = new THREE.Group();
  backpack.position.set(0, 0.06, 0.21);
  const plssBody = new THREE.Mesh(new RoundedBoxGeometry(0.33, 0.48, 0.18, 3, 0.035), mats.armorPlate);
  plssBody.castShadow = true;
  backpack.add(plssBody);

  const plssHood = new THREE.Mesh(new RoundedBoxGeometry(0.29, 0.09, 0.16, 2, 0.02), mats.jointDark);
  plssHood.position.y = 0.25;
  backpack.add(plssHood);

  // Astral Sentinels emblem mounting on backpack
  const astralFrame = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.2, 0.016, 2, 0.004), mats.armorPlate);
  astralFrame.position.set(0, 0.08, 0.095);
  const astralPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), mats.astralPatch);
  astralPlane.position.set(0, 0.08, 0.104);
  astralPlane.rotation.y = Math.PI;
  backpack.add(astralFrame, astralPlane);

  // NASA circular patch mounting on backpack
  const nasaRim = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.016, 28), mats.armorPlate);
  nasaRim.rotation.x = Math.PI / 2;
  nasaRim.position.set(0, -0.11, 0.095);
  const nasaPlane = new THREE.Mesh(new THREE.CircleGeometry(0.048, 28), mats.nasaPatch);
  nasaPlane.position.set(0, -0.11, 0.104);
  nasaPlane.rotation.y = Math.PI;
  backpack.add(nasaRim, nasaPlane);

  // Antenna mast with red sphere tip
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.16, 8), mats.chromeHardware);
  antenna.position.set(-0.13, 0.32, 0.03);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), mats.redBeacon);
  antennaTip.position.set(-0.13, 0.41, 0.03);
  backpack.add(antenna, antennaTip);

  // Oxygen port connectors with teal torus rings
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.025, 20), mats.chromeHardware);
  port.position.set(0.1, 0.18, 0.095);
  port.rotation.x = Math.PI / 2;
  const portRing = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 8, 20), mats.tealTrim);
  portRing.position.set(0.1, 0.18, 0.108);
  backpack.add(port, portRing);

  // Ribbed life-support oxygen conduit hose looping from chest to backpack over right shoulder
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.11, 0.06, -0.14),
    new THREE.Vector3(0.19, 0.16, -0.1),
    new THREE.Vector3(0.23, 0.26, -0.02),
    new THREE.Vector3(0.22, 0.28, 0.08),
    new THREE.Vector3(0.16, 0.25, 0.18),
    new THREE.Vector3(0.1, 0.18, 0.18),
  ]);
  const hoseMesh = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 36, 0.02, 10, false), mats.hoseMat);
  hoseMesh.castShadow = true;
  torso.add(hoseMesh);

  // Micro-RCS thrusters
  const rcsPlumes = [];
  [
    [-0.17, 0.18, 0.07],
    [0.17, 0.18, 0.07],
    [-0.17, -0.17, 0.07],
    [0.17, -0.17, 0.07],
  ].forEach(([qx, qy, qz]) => {
    const quad = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.045, 0.05, 1, 0.008), mats.jointDark);
    quad.position.set(qx, qy, qz);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.1, 10), mats.rcsPlumeMat.clone());
    plume.rotation.x = Math.PI / 2;
    plume.position.set(qx, qy, qz + 0.08);
    plume.visible = false;
    backpack.add(quad, plume);
    rcsPlumes.push(plume);
  });
  torso.add(backpack);

  // SUPER-ELLIPSOID AERODYNAMIC HELMET
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.3, 0);

  const helm = new THREE.Group();
  helm.position.set(0, 0.15, 0);

  const helmetShellMesh = new THREE.Mesh(
    createSuperEllipsoidGeometry(0.16, 0.92, 36, 28, 0, Math.PI * 2, 0, Math.PI),
    mats.helmetShell
  );
  helmetShellMesh.castShadow = true;
  helm.add(helmetShellMesh);

  const visorMesh = new THREE.Mesh(
    // The chest and astronaut forward axis point toward -Z; mirror the visor there too.
    createSuperEllipsoidGeometry(0.1635, 0.92, 36, 28, Math.PI + Math.PI / 2 - 1.2, 2.4, 0.45, 1.85),
    mats.visorGold
  );
  visorMesh.castShadow = true;
  helm.add(visorMesh);

  // Neck collar ring
  const neckRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 12, 36), mats.helmetShell);
  neckRing.position.y = -0.13;
  neckRing.rotation.x = Math.PI / 2;
  helm.add(neckRing);

  // Side ear communication cylinders with cyan LED lights
  [-1, 1].forEach((s) => {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 24), mats.helmetShell);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.165, 0, -0.01);
    const earLed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), mats.tealLED);
    earLed.position.set(s * 0.182, 0, -0.01);
    helm.add(ear, earLed);
  });

  // Top aerodynamic crest
  const crest = new THREE.Mesh(createSuperEllipsoidGeometry(1, 0.6, 20, 14), mats.chromeHardware);
  crest.scale.set(0.02, 0.02, 0.12);
  crest.position.set(0, 0.158, -0.02);
  helm.add(crest);

  headGroup.add(helm);
  torso.add(headGroup);

  // ARTICULATED ARMS AND LEGS
  const leftArmRig = buildArticulatedLimb(mats, 0.06, 0.28, 0.05, 0.26, 'glove', -1);
  leftArmRig.root.position.set(-0.25, 0.17, 0);
  const rightArmRig = buildArticulatedLimb(mats, 0.06, 0.28, 0.05, 0.26, 'glove', 1);
  rightArmRig.root.position.set(0.25, 0.17, 0);
  torso.add(leftArmRig.root, rightArmRig.root);

  const leftLegRig = buildArticulatedLimb(mats, 0.09, 0.42, 0.076, 0.4, 'boot', -1);
  leftLegRig.root.position.set(-0.11, -0.06, 0);
  const rightLegRig = buildArticulatedLimb(mats, 0.09, 0.42, 0.076, 0.4, 'boot', 1);
  rightLegRig.root.position.set(0.11, -0.06, 0);
  pelvis.add(leftLegRig.root, rightLegRig.root);

  let currentState = ASTRONAUT_ANIMATION_STATES.IDLE_FLOAT;
  let clockT = 0;
  let walkPhase = 0;
  const torsoRestY = torso.position.y;

  function setState(nextState) {
    if (Object.values(ASTRONAUT_ANIMATION_STATES).includes(nextState)) {
      currentState = nextState;
    }
  }

  /**
   * Refined locomotion and posture animation:
   * Provides clean, straight, controlled walking with proper leg strides and grounded foot placement.
   */
  function updateAnimation(dt = 0.016, stateOverride = null, motionMeta = null) {
    if (stateOverride) setState(stateOverride);
    const safeDt = Math.max(0.001, Math.min(0.08, Number(dt) || 0.016));
    clockT += safeDt;

    const speed = Math.max(0, Number(motionMeta?.speed ?? 0));
    const speedRatio = Math.min(1.4, speed / 2.8);
    const isWalking = speed > 0.08;
    const isSeatedCommand =
      Boolean(motionMeta?.isSeatedCommand) || currentState === ASTRONAUT_ANIMATION_STATES.SEATED_COMMAND;
    const isRestingBed =
      Boolean(motionMeta?.isRestingBed) || currentState === ASTRONAUT_ANIMATION_STATES.RESTING_BED;
    const isElevatorRide = Boolean(motionMeta?.isElevatorRide);
    const bankRoll = Math.max(-0.15, Math.min(0.15, Number(motionMeta?.bankRoll ?? 0)));
    const headPitch = Math.max(-0.4, Math.min(0.4, Number(motionMeta?.headPitch ?? 0)));

    let bobY = 0;
    let bodyPitch = 0.02;
    let bodyYaw = 0;
    let pelvisSway = 0;
    let torsoPitch = 0;
    let torsoRoll = 0;
    let headRoll = 0;
    let headYaw = 0;
    let laX = 0.14,
      laZ = 0.12,
      leX = 0.16;
    let raX = 0.14,
      raZ = -0.12,
      reX = 0.16;
    let llX = 0,
      lkX = 0.06;
    let rlX = 0,
      rkX = 0.06;
    let rcsOpacity = 0.0;

    if (isRestingBed) {
      // Pose supina relajada sobre la litera de Cubierta 02 (respiración tranquila)
      const breath = Math.sin(clockT * 1.15);
      bobY = -0.34 + breath * 0.004;
      bodyPitch = Math.PI * 0.43;
      torsoPitch = -0.06 + breath * 0.015;
      laX = 0.08 + breath * 0.02;
      raX = 0.08 - breath * 0.02;
      laZ = 0.14;
      raZ = -0.14;
      leX = 0.22;
      reX = 0.22;
      llX = 0.08;
      rlX = 0.06;
      lkX = -0.16;
      rkX = -0.14;
    } else if (isSeatedCommand) {
      // Ergonomic bridge seated pose
      bobY = -0.34;
      bodyPitch = -0.04;
      laX = 0.38;
      raX = 0.42;
      laZ = 0.16;
      raZ = -0.16;
      leX = 0.92;
      reX = 0.96;
      llX = 1.38;
      rlX = 1.38;
      lkX = -1.32;
      rkX = -1.32;
    } else if (isElevatorRide) {
      bobY = 0.005 * Math.sin(clockT * 2.0);
      raX = 0.42;
      raZ = -0.2;
      reX = 0.36;
      laX = 0.14;
    } else if (isWalking) {
      // Relaxed EVA gait: slower cadence, weight transfer, and offset upper-body follow-through.
      walkPhase += safeDt * (5.0 + speedRatio * 2.4);
      const strideAngle = Math.min(0.56, 0.28 + speedRatio * 0.26);
      const armSwing = Math.min(0.4, 0.17 + speedRatio * 0.2);
      const step = Math.sin(walkPhase);
      const oppositeStep = Math.sin(walkPhase + Math.PI);

      // Legs stride in alternating opposition
      llX = step * strideAngle;
      rlX = oppositeStep * strideAngle;

      // Knees flex mostly while each foot swings forward.
      lkX = Math.max(0, -Math.sin(walkPhase + 0.22)) * 0.52;
      rkX = Math.max(0, Math.sin(walkPhase + 0.22)) * 0.52;

      // Arms counter-swing with slight asymmetry and relaxed elbow flex.
      laX = -step * armSwing + 0.1;
      raX = oppositeStep * (armSwing * 0.92) + 0.12;
      laZ = 0.11 + Math.sin(walkPhase + 0.65) * 0.025;
      raZ = -0.1 + Math.sin(walkPhase + 2.1) * 0.028;
      leX = 0.14 + Math.max(0, step) * 0.18;
      reX = 0.14 + Math.max(0, oppositeStep) * 0.17;

      // Transfer weight through hips, torso, and head instead of moving as one rigid block.
      bobY = Math.abs(step) * 0.014;
      pelvisSway = Math.sin(walkPhase + Math.PI / 2) * 0.014;
      bodyPitch = 0.015 + speedRatio * 0.018;
      torsoPitch = 0.012 + Math.sin(walkPhase - 0.45) * 0.018;
      torsoRoll = Math.sin(walkPhase + Math.PI / 2) * 0.026;
      headRoll = -torsoRoll * 0.45;
      bodyYaw = Math.sin(walkPhase - 0.35) * 0.014;
      headYaw = -bodyYaw * 0.8 + Math.sin(walkPhase * 0.5) * 0.012;
    } else {
      switch (currentState) {
        case ASTRONAUT_ANIMATION_STATES.THRUSTER_BURST: {
          bodyPitch = 0.16;
          torsoPitch = 0.035;
          laX = -0.12;
          laZ = 0.28;
          raX = -0.12;
          raZ = -0.28;
          llX = 0.16;
          rlX = 0.22;
          lkX = 0.28;
          rkX = 0.36;
          rcsOpacity = 0.45;
          break;
        }
        case ASTRONAUT_ANIMATION_STATES.CONSOLE_WORK: {
          bodyPitch = 0.04;
          torsoPitch = 0.025 + Math.sin(clockT * 1.7) * 0.012;
          torsoRoll = Math.sin(clockT * 1.1) * 0.012;
          laX = 0.82 + Math.sin(clockT * 4.0) * 0.06;
          raX = 0.86 + Math.cos(clockT * 4.5) * 0.06;
          leX = 0.56;
          reX = 0.56;
          break;
        }
        case ASTRONAUT_ANIMATION_STATES.REPAIR_INTERACT: {
          bodyPitch = 0.1;
          torsoPitch = 0.045 + Math.sin(clockT * 1.5) * 0.012;
          torsoRoll = Math.sin(clockT * 1.2) * 0.014;
          raX = 1.02 + Math.sin(clockT * 6.0) * 0.12;
          reX = 0.5;
          laX = 0.74;
          leX = 0.58;
          break;
        }
        case ASTRONAUT_ANIMATION_STATES.GRAB_RAIL: {
          raX = 1.2;
          raZ = 0.08;
          reX = 0.38;
          break;
        }
        case ASTRONAUT_ANIMATION_STATES.STABILIZE: {
          bodyPitch = 0.02;
          laZ = 0.65;
          raZ = -0.65;
          rcsOpacity = 0.35;
          break;
        }
        case ASTRONAUT_ANIMATION_STATES.CORRIDOR_SWIM: {
          const sw = Math.sin(clockT * 5.0);
          bodyPitch = 0.18;
          laX = 0.8 + sw * 0.25;
          raX = 0.8 - sw * 0.25;
          llX = 0.2 - sw * 0.2;
          rlX = 0.2 + sw * 0.2;
          break;
        }
        default: {
          // Quiet breathing, small balance corrections, and non-mirrored arm drift.
          bobY = Math.sin(clockT * 1.15) * 0.004;
          pelvisSway = Math.sin(clockT * 0.72) * 0.014;
          torsoPitch = Math.sin(clockT * 1.15 + 0.5) * 0.009;
          torsoRoll = Math.sin(clockT * 0.72 + 0.9) * 0.02;
          headRoll = -torsoRoll * 0.4;
          headYaw = Math.sin(clockT * 0.42) * 0.055;
          laX = 0.1 + Math.sin(clockT * 0.9) * 0.045;
          raX = 0.12 + Math.sin(clockT * 0.9 + 1.1) * 0.038;
          laZ = 0.1 + Math.sin(clockT * 0.65) * 0.022;
          raZ = -0.1 + Math.sin(clockT * 0.65 + 1.3) * 0.022;
          leX = 0.16;
          reX = 0.16;
          llX = -0.02;
          rlX = 0.02;
          lkX = 0.06;
          rkX = 0.06;
          break;
        }
      }
    }

    const k = Math.min(1, Math.max(0.1, safeDt * 10));
    pelvis.position.y += (0.9 + bobY - pelvis.position.y) * k;
    pelvis.position.x += (pelvisSway - pelvis.position.x) * k;
    pelvis.rotation.x += (bodyPitch - pelvis.rotation.x) * k;
    pelvis.rotation.y += (bodyYaw - pelvis.rotation.y) * k;
    pelvis.rotation.z += (bankRoll - pelvis.rotation.z) * k;
    torso.rotation.x += (torsoPitch - torso.rotation.x) * k;
    torso.rotation.z += (torsoRoll - torso.rotation.z) * k;
    torso.position.y += (torsoRestY + Math.sin(clockT * 1.8) * 0.0018 - torso.position.y) * k;
    headGroup.rotation.x += (-bodyPitch * 0.32 - torsoPitch * 0.45 + headPitch * 0.45 - headGroup.rotation.x) * k;
    headGroup.rotation.y += (headYaw - headGroup.rotation.y) * k;
    headGroup.rotation.z += (headRoll - headGroup.rotation.z) * k;

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
      const op = Math.min(0.28, rcsOpacity * (0.6 + 0.2 * Math.sin(clockT * 18 + i)));
      pl.material.opacity = op;
      pl.visible = op > 0.02;
    });
  }

  return {
    root,
    torso,
    headGroup,
    helmetMesh: helmetShellMesh,
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

/**
 * First-person spacesuit forearms and dockable handheld 3D tools.
 */
export function createFirstPersonHandsRig() {
  const mats = createAstronautMaterials();
  const root = new THREE.Group();
  root.name = 'FirstPersonSuitHands';

  const makeArmSide = (sideSign) => {
    const arm = new THREE.Group();
    arm.position.set(sideSign * 0.22, -0.205, -0.22);
    arm.rotation.set(0.22, sideSign * 0.2, sideSign * -0.14);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.24, 16), mats.suitOuter);
    forearm.rotation.x = Math.PI * 0.5;
    arm.add(forearm);

    const cuffCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.041, 0.026, 18),
      mats.chromeHardware
    );
    cuffCollar.rotation.x = Math.PI * 0.5;
    cuffCollar.position.set(0, 0, -0.215);
    arm.add(cuffCollar);

    const wristLed = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.008, 0.02, 2, 0.003), mats.tealLED);
    wristLed.position.set(sideSign * -0.014, 0.036, -0.215);
    arm.add(wristLed);

    const gauntlet = new THREE.Group();
    gauntlet.position.set(0, 0.004, -0.255);

    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.036, 0.072, 2, 0.01), mats.armorPlate);
    gauntlet.add(palm);

    const knuckle = new THREE.Mesh(new RoundedBoxGeometry(0.054, 0.016, 0.026, 2, 0.006), mats.missionAccent);
    knuckle.position.set(0, 0.015, -0.02);
    gauntlet.add(knuckle);

    const fingers = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.024, 0.048, 2, 0.008), mats.jointDark);
    fingers.position.set(0, -0.006, -0.048);
    fingers.rotation.x = 0.28;
    gauntlet.add(fingers);

    const thumb = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.02, 0.036, 2, 0.006), mats.jointDark);
    thumb.position.set(sideSign * -0.028, 0.002, -0.018);
    thumb.rotation.y = sideSign * 0.35;
    gauntlet.add(thumb);

    arm.add(gauntlet);
    return { arm, gauntlet, wristLed };
  };

  const leftSide = makeArmSide(-1);
  const rightSide = makeArmSide(1);
  root.add(leftSide.arm, rightSide.arm);

  const toolSocket = new THREE.Group();
  toolSocket.position.set(-0.012, 0.022, -0.046);
  rightSide.gauntlet.add(toolSocket);

  const multitoolMesh = new THREE.Group();
  const mtBody = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.028, 0.145, 2, 0.005), mats.armorPlate);
  const mtTip = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.055, 10), mats.tealTrim);
  mtTip.rotation.x = Math.PI * 0.5;
  mtTip.position.set(0, 0.004, -0.092);
  multitoolMesh.add(mtBody, mtTip);
  multitoolMesh.visible = false;

  const scannerMesh = new THREE.Group();
  const scCase = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.018, 0.105, 2, 0.005), mats.jointDark);
  const scScreen = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.004, 0.054, 1, 0.001), mats.tealTrim);
  scScreen.position.set(0, 0.01, 0.008);
  scannerMesh.add(scCase, scScreen);
  scannerMesh.visible = false;

  const couplerMesh = new THREE.Group();
  const cpRing = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 18), mats.visorGold);
  const cpCore = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 12), mats.tealTrim);
  cpCore.rotation.x = Math.PI * 0.5;
  couplerMesh.add(cpRing, cpCore);
  couplerMesh.visible = false;

  toolSocket.add(multitoolMesh, scannerMesh, couplerMesh);

  let clockT = 0;
  let reachWeight = 0;
  let anchorWeight = 0;

  function update({
    dt = 0.016,
    speed = 0,
    isMoving = false,
    interactionPulse = 0,
    isAnchored = false,
    heldToolId = null,
    thrusterActive = false,
  } = {}) {
    const safeDt = Math.max(0.001, Math.min(0.06, Number(dt) || 0.016));
    clockT += safeDt;

    const targetReach = Math.max(0, Math.min(1, Number(interactionPulse) || 0));
    const targetAnchor = isAnchored ? 1 : 0;
    const k = Math.min(1, safeDt * 12);
    reachWeight += (targetReach - reachWeight) * k;
    anchorWeight += (targetAnchor - anchorWeight) * k;

    const bobFreq = isMoving ? 4.2 + Math.min(3.0, speed * 1.5) : 1.5;
    const bobAmp = isMoving ? Math.min(0.012, 0.004 + speed * 0.004) : 0.0025;
    const bobY = Math.sin(clockT * bobFreq) * bobAmp;
    const swayX = Math.cos(clockT * bobFreq * 0.5) * bobAmp * 0.8;

    multitoolMesh.visible = heldToolId === 'multitool';
    scannerMesh.visible = heldToolId === 'scanner';
    couplerMesh.visible = heldToolId === 'optical-coupler';

    const leftFwd = anchorWeight * 0.09 + (thrusterActive ? 0.02 : 0);
    const rightFwd = Math.max(anchorWeight * 0.09, reachWeight * 0.16);
    const toolLift = heldToolId ? 0.026 : 0;

    leftSide.arm.position.set(-0.22 + swayX, -0.205 + bobY + anchorWeight * 0.035, -0.22 - leftFwd);
    leftSide.arm.rotation.set(0.22 - anchorWeight * 0.14, -0.2 - anchorWeight * 0.06, 0.14);

    rightSide.arm.position.set(
      0.22 - swayX - reachWeight * 0.045,
      -0.205 + bobY + toolLift + reachWeight * 0.05 + anchorWeight * 0.03,
      -0.22 - rightFwd
    );
    rightSide.arm.rotation.set(
      0.22 - reachWeight * 0.24 - (heldToolId ? 0.06 : 0),
      0.2 + reachWeight * 0.1,
      -0.14 + reachWeight * 0.06
    );
  }

  return {
    root,
    leftArm: leftSide.arm,
    rightArm: rightSide.arm,
    toolSocket,
    update,
  };
}
