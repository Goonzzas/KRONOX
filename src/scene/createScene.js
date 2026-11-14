import { createJumpSequence, advanceJump, JUMP_DURATIONS } from './jumpSequence.js';
import { createHyperspaceEffect } from './hyperspaceEffect.js';
import { buildStellarAtlas } from './navigationAtlas.js';
import { makeAtlasGalaxy } from './galaxyVisuals.js';
import { galaxyMapPosition, galaxySymbolRadii, fitAtlasCamera, placeAtlasLabels, makeLabelLeader } from './mapLayout.js';
import { createSceneLabel as lab } from './sceneLabels.js';
import { heliocentricMapPosition, SOLAR_GALACTIC_ANCHOR } from './astronomicalPositions.js';
import { disposeSceneResources } from './disposeResources.js';
import { scaleContext, scaleForTarget, macroGalacticVisible } from './navigationScale.js';
import { renderWithOriginRebase } from './originRebase.js';
import { integrateFlightVelocity } from './flightDynamics.js';
import { createDestinationResources, summarizeFrameTimes } from './destinationVisuals.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { P, D2R, TAU, T0, kep, pos } from '../data/planetData.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { NEARBY_GALAXIES } from '../data/nearbyGalaxies.js';
import {
  SHIP_WORLD_UNITS,
  PHYSICAL_CABIN_STATIONS,
  buildHabitableCabin3D,
  createAstronautModel3D,
  createKronoxLuminousEntity3D,
} from './habitableShipWorld.js';
import {
  KRONOX_SCENE_EVENTS,
  KRONOX_CONTROL_MODES,
  buildCabinMachineSystems3D,
  createKronoxSceneDirector,
} from './kronoxSceneDirector.js';
import { createSpherexObservatory3D, SPHEREX_ORBIT_SPEC } from './spherexObservatory3D.js';
import {
  COSMIC_HIERARCHY,
  CANONICAL_STARS_BY_ID,
  CANONICAL_GALAXIES_BY_ID,
  GALAXY_MORPHOLOGY_METADATA,
  ASTRONOMICAL_PROVENANCE_MANIFEST,
  getObjectProvenance,
  getCanonicalStar,
  getCanonicalGalaxy,
  upgradeSceneGalaxiesWithMorphology,
} from './astronomicalUniverse.js';
import {
  createObserverAwareFirmament,
  updateCrossScaleContinuity,
} from './observerSkyAndUnification.js';
import { createAstronomicalHologramSystem } from './astronomicalHologram.js';
import {
  ASTRONOMICAL_REFERENCE_EPOCH,
  PHYSICAL_CONSTANTS,
  WORLD_COORDINATE_SYSTEMS,
  OBSERVATION_MODES,
  PLANETARY_PHYSICAL_CATALOG,
  CATALOG_DOCUMENTATION_NOTES,
  OPTICAL_MAGNIFICATION_STEPS,
  physicalPlanetSceneRadius,
  physicalOrbitSceneDistance,
  schematicPlanetSceneRadius,
  schematicOrbitSceneDistance,
  computeTelescopeFieldOfView,
  computeDoublePrecisionRelativeVector,
  verifyFloatingOriginPrecision,
  computeBodyObservationalMetrics,
  computeSafeOrbitalClearance,
  enforcePlanetaryCollisionBoundary,
  createPlanetaryPointBeaconTexture,
} from './astronomicalScaleEngine.js';
import { buildModularShip120M } from './modularShipHull3D.js';
import {
  buildFourDecksInterior3D,
  SHIP_INTERIOR_STATIONS,
  resolveCurrentDeck,
} from './fourDecksInterior3D.js';
import { createAstronautCharacter3D, ASTRONAUT_ANIMATION_STATES } from './astronautCharacter3D.js';
import { createMicrogravityPhysicsController, MICROGRAVITY_MODES } from './microgravityPhysicsController.js';
import { createKronoxCompanionEntity3D } from './kronoxCompanion3D.js';
import { createAsteroidBeltVisuals } from './asteroidBeltVisuals.js';
import { createNaturalGalaxySky } from './naturalGalaxySky.js';

const PLANET_TEXTURE_FILES = {
  Mercurio: '2k_mercury.jpg',
  Venus: '2k_venus.jpg',
  Tierra: '2k_earth_daymap.jpg',
  Luna: '2k_moon.jpg',
  Marte: '2k_mars.jpg',
  Júpiter: '2k_jupiter.jpg',
  Saturno: '2k_saturn.jpg',
  Urano: '2k_uranus.jpg',
  Neptuno: '2k_neptune.jpg',
};
// El modelo geométrico base del casco abarca 2.61 unidades desde el cono de proa (z = -1.20)
// hasta las toberas principales de popa (z = +1.41). En el Mundo Local (`localShipScene`, 1 u = 1 m),
// se escala por `SHIP_METRIC_SCALE = 120.0 / 2.61` para conservar exactamente 120.0 metros físicos.
const SHIP_LENGTH_METERS = PHYSICAL_CONSTANTS.SHIP_LENGTH_METERS;
const SHIP_RAW_HULL_LENGTH = 2.61;
const SHIP_MODEL_LENGTH = SHIP_RAW_HULL_LENGTH;
const SHIP_METRIC_SCALE = SHIP_LENGTH_METERS / SHIP_RAW_HULL_LENGTH;
// Satellite paths are illustrative; slow only their visual animation so the
// accelerated day clock does not make them race around the Earth.
const SATELLITE_VISUAL_TIME_SCALE = 0.0001;


const hs = (a, b, Q) => {
  const s = Math.sin((((a % Q) + Q) % Q) * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function vn(x, y, Q) {
  const i = Math.floor(x),
    j = Math.floor(y),
    fx = x - i,
    fy = y - j,
    sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy),
    a = hs(i, j, Q),
    b = hs(i + 1, j, Q),
    c = hs(i, j + 1, Q),
    d = hs(i + 1, j + 1, Q);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(u, v, f) {
  let s = 0,
    a = 0.5,
    k = f;
  for (let o = 0; o < 5; o++) {
    s += a * vn(u * k, (v * k) / 2, k);
    k *= 2;
    a /= 2;
  }
  return s / 0.97;
}
const mix = (a, b, t) => a.map((q, i) => q + (b[i] - q) * t);
function sunTexture(p) {
  const W = 512,
    H = 256,
    cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d'),
    im = g.createImageData(W, H),
    d = im.data;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const u = i / W,
        v = j / H;
      let c;
      const n = fbm(u, v, 10);
      // Luz integrada del Sol (estrella G2V, Teff ≈ 5772 K) en el espacio exterior:
      // prácticamente blanca (#fffaf2) con granulación fotosférica cálida sutil, evitando una esfera naranja artificial.
      c = [255, Math.min(255, Math.round(244 + n * 11)), Math.min(255, Math.round(226 + n * 28))];
      const o = (j * W + i) * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  g.putImageData(im, 0, 0);
  return new THREE.CanvasTexture(cv);
}
const gs = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
let sharedPointMap = null;
function pts(pos, col, size, op) {
  const G = new THREE.BufferGeometry();
  G.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  G.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  return new THREE.Points(
    G,
    new THREE.PointsMaterial({
      size,
      map: sharedPointMap, alphaTest: 0.01,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

function makeDeepGalaxyTexture({ seed = 1, color = '#8ecbff', arms = 4, edgeOn = false } = {}) {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  context.save();
  context.translate(256, 192);
  context.rotate(seed * 0.37);
  context.scale(1, edgeOn ? 0.19 : 0.68);
  const halo = context.createRadialGradient(0, 0, 4, 0, 0, 178);
  halo.addColorStop(0, '#fff8e8');
  halo.addColorStop(0.08, color);
  halo.addColorStop(0.3, `${color}a8`);
  halo.addColorStop(0.68, `${color}26`);
  halo.addColorStop(1, `${color}00`);
  context.fillStyle = halo;
  context.beginPath();
  context.arc(0, 0, 178, 0, TAU);
  context.fill();

  context.globalCompositeOperation = 'lighter';
  for (let arm = 0; arm < arms; arm++) {
    for (let i = 0; i < 420; i++) {
      const progress = 0.04 + random() * 0.96;
      const angle = (arm / arms) * TAU + progress * 5.3 + (random() - 0.5) * 0.38;
      const radius = 15 + progress * 158;
      const scatter = (random() + random() - 1) * (4 + progress * 13);
      const x = Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * scatter;
      const y = Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * scatter;
      const size = random() > 0.965 ? 2.8 : 0.7 + random() * 1.6;
      context.globalAlpha = 0.2 + random() * 0.65;
      context.fillStyle = random() > 0.9 ? '#ffe6c4' : color;
      context.beginPath();
      context.arc(x, y, size, 0, TAU);
      context.fill();
    }
  }
  // A handful of bright star-forming knots give each distant silhouette depth.
  for (let i = 0; i < 90; i++) {
    const angle = random() * TAU;
    const radius = 18 + Math.pow(random(), 0.7) * 145;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const glow = context.createRadialGradient(x, y, 0, x, y, 5 + random() * 10);
    glow.addColorStop(0, 'rgba(255,244,218,.9)');
    glow.addColorStop(1, 'rgba(255,244,218,0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 14, 0, TAU);
    context.fill();
  }
  context.restore();
  context.globalAlpha = 1;
  return new THREE.CanvasTexture(canvas);
}

function makeGalaxyCoreGlow(color = '#8fcaff', size = 10) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(64, 64, 1, 64, 64, 63);
  glow.addColorStop(0, 'rgba(255,250,237,1)');
  glow.addColorStop(0.06, color);
  glow.addColorStop(0.22, `${color}b8`);
  glow.addColorStop(0.55, `${color}38`);
  glow.addColorStop(1, `${color}00`);
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      opacity: 0.76,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sprite.scale.set(size, size, 1);
  sprite.renderOrder = 3;
  return sprite;
}

function makeNebulaBackdropTexture({ seed = 1, color = '#a88cff' } = {}) {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  context.save();
  context.translate(256, 256);
  context.rotate(seed * 0.21);
  context.scale(1, 0.62 + random() * 0.2);
  context.globalCompositeOperation = 'screen';
  for (let i = 0; i < 15; i++) {
    const x = (random() - 0.5) * 320;
    const y = (random() - 0.5) * 250;
    const radius = 55 + random() * 115;
    const alpha = 0.08 + random() * 0.07;
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, `rgba(${rgb.join(',')},${alpha})`);
    cloud.addColorStop(0.4, `rgba(${rgb.join(',')},${alpha * 0.42})`);
    cloud.addColorStop(1, `rgba(${rgb.join(',')},0)`);
    context.fillStyle = cloud;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }
  context.restore();
  return new THREE.CanvasTexture(canvas);
}

export function setupScene(el, S) {
  const destinationResources = createDestinationResources();
  sharedPointMap = destinationResources.softMap;
  let qualityMode = S.quality || 'auto';
  const isMobileDevice = () =>
    window.matchMedia?.('(max-width: 760px), (pointer: coarse)')?.matches;
  const pixelRatioFor = (mode) => {
    if (mode === 'performance') return 1;
    if (mode === 'quality') return Math.min(2, devicePixelRatio || 1);
    return Math.min(isMobileDevice() ? 1.25 : 1.75, devicePixelRatio || 1);
  };
  const R = new THREE.WebGLRenderer({
    antialias: qualityMode !== 'performance' && !isMobileDevice(),
    logarithmicDepthBuffer: true,
  });
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 0.94;
  R.outputEncoding = THREE.sRGBEncoding;
  R.setPixelRatio(pixelRatioFor(qualityMode));
  R.setSize(innerWidth, innerHeight);
  el.appendChild(R.domElement);
  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (file, colorMap = true, planetName = '') => {
    const texture = textureLoader.load(
      `${import.meta.env.BASE_URL}textures/planets/${file}`,
      (loaded) => {
        if (planetName !== 'Urano' && planetName !== 'Neptuno') return;
        const source = loaded.image;
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext('2d');
        if (planetName === 'Neptuno') {
          // The source already contains cloud bands and a storm; lift their
          // contrast gently so the detail survives the planet's shading.
          context.filter = 'contrast(1.4) saturate(0.92)';
          context.drawImage(source, 0, 0);
        } else {
          context.drawImage(source, 0, 0);
          // The source Uranus map is almost featureless. Add restrained,
          // soft latitude bands and a few high cloud streaks for depth.
          const banding = context.createLinearGradient(0, 0, 0, canvas.height);
          banding.addColorStop(0, 'rgba(72, 158, 174, 0.12)');
          banding.addColorStop(0.12, 'rgba(231, 255, 255, 0.08)');
          banding.addColorStop(0.27, 'rgba(64, 154, 171, 0.13)');
          banding.addColorStop(0.43, 'rgba(235, 255, 255, 0.07)');
          banding.addColorStop(0.57, 'rgba(58, 143, 163, 0.14)');
          banding.addColorStop(0.72, 'rgba(226, 255, 255, 0.08)');
          banding.addColorStop(0.88, 'rgba(72, 158, 174, 0.12)');
          banding.addColorStop(1, 'rgba(220, 250, 255, 0.08)');
          context.fillStyle = banding;
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.filter = 'blur(5px)';
          context.fillStyle = 'rgba(246, 255, 255, 0.22)';
          [
            [0.22, 0.29, 0.04],
            [0.63, 0.39, 0.06],
            [0.81, 0.61, 0.045],
            [0.4, 0.72, 0.035],
          ].forEach(([x, y, width]) => {
            context.beginPath();
            context.ellipse(
              canvas.width * x,
              canvas.height * y,
              canvas.width * width,
              canvas.height * 0.006,
              0,
              0,
              Math.PI * 2,
            );
            context.fill();
          });
        }
        loaded.image = canvas;
        loaded.needsUpdate = true;
      },
    );
    if (colorMap) texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
    return texture;
  };
  const sc = new THREE.Scene(),
    cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.0005, 4e5),
    ct = new OrbitControls(cam, R.domElement);
  sc.name = 'KronoxAstronomicalWorld';
  sc.userData = {
    worldId: WORLD_COORDINATE_SYSTEMS.ASTRONOMICAL_PHYSICAL_WORLD.id,
    unitKm: PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_KM,
    unitMeters: PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_METERS,
  };
  // Mundo local métrico independiente (`1 unidad local = 1.00 metro`) para la nave de 120 m y la cabina de 24 m:
  const localShipScene = new THREE.Scene(),
    localCam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 6000);
  localShipScene.name = 'KronoxLocalMetricWorld';
  localShipScene.userData = {
    worldId: WORLD_COORDINATE_SYSTEMS.LOCAL_METRIC_WORLD.id,
    unitMeters: 1.0,
    shipLengthMeters: SHIP_LENGTH_METERS,
    cabinLengthMeters: PHYSICAL_CONSTANTS.CABIN_LENGTH_METERS,
    astronautHeightMeters: PHYSICAL_CONSTANTS.ASTRONAUT_HEIGHT_METERS,
    astronautEyeHeightMeters: PHYSICAL_CONSTANTS.ASTRONAUT_EYE_HEIGHT_METERS,
  };
  localCam.name = 'KronoxLocalMetricCamera';
  const localShipAmbient = new THREE.AmbientLight(0x9eb4d0, 0.26);
  const localShipHemi = new THREE.HemisphereLight(0xd2e1f4, 0x131822, 0.30);
  const localShipSunLight = new THREE.DirectionalLight(0xfff6e5, 2.35);
  localShipSunLight.position.set(-320, 120, -240);
  const localShipRimLight = new THREE.DirectionalLight(0x70b8ff, 0.55);
  localShipRimLight.position.set(240, -80, 310);
  localShipScene.add(localShipAmbient, localShipHemi, localShipSunLight, localShipRimLight);
  let localShipPmremGenerator = null;
  let localShipEnvRenderTarget = null;
  if (typeof R.getContext === 'function' && R.getContext()) {
    try {
      const pmremRoom = new RoomEnvironment();
      localShipPmremGenerator = new THREE.PMREMGenerator(R);
      localShipPmremGenerator.compileEquirectangularShader?.();
      localShipEnvRenderTarget = localShipPmremGenerator.fromScene(pmremRoom, 0.04);
      localShipScene.environment = localShipEnvRenderTarget.texture;
      disposeSceneResources(pmremRoom);
    } catch {
      localShipPmremGenerator = null;
      localShipEnvRenderTarget = null;
    }
  }
  let rafId = 0,
    disposed = false,
    lastNavigationPublish = -1,
    lastNavigationHadNav = false;
  ct.enableDamping = true;
  ct.dampingFactor = 0.07;
  ct.maxDistance = 3e5;
  ct.minDistance = 0.0005;
  sc.add(new THREE.AmbientLight(0xffffff, 0.055));
  sc.add(new THREE.PointLight(0xfff7ec, 1.85, 0, 0));
  const planetaryBeaconMap = createPlanetaryPointBeaconTexture(globalThis.document);
  // estrellas
  let a = [],
    c = [];
  for (let i = 0; i < 12000; i++) {
    const v = new THREE.Vector3(gs(), gs(), gs()).normalize().multiplyScalar(2e5),
      t = Math.random();
    a.push(v.x, v.y, v.z);
    const b = 0.5 + 0.5 * Math.random();
    c.push(b * (0.8 + 0.2 * t), b * 0.9, b * (1 - 0.2 * t));
  }
  sc.add(pts(a, c, 1.5, 0.9));
  // polvo estelar cercano (moderado para conservar la oscuridad y profundidad del espacio)
  a = [];
  c = [];
  for (let i = 0; i < 9000; i++) {
    const v = new THREE.Vector3(gs(), gs() * 0.5, gs()).multiplyScalar(900);
    a.push(v.x, v.y, v.z);
    c.push(0.5 + Math.random() * 0.4, 0.55 + Math.random() * 0.2, 0.8);
  }
  sc.add(pts(a, c, 0.9, 0.14));
  const naturalGalaxySky = createNaturalGalaxySky();
  sc.add(naturalGalaxySky.root);
  // Decorative deep-sky galaxies sit far beyond the Milky Way starfield.
  // They fade in as the camera pulls back to explore galactic scales and stay
  // subtle near planets, where they would otherwise distract from navigation.
  const deepGalaxyBackdrop = new THREE.Group();
  deepGalaxyBackdrop.name = 'Deep galaxy backdrop';
  const deepGalaxyMaterials = [];
  const deepSkyNebulaMaterials = [];
  const deepGalaxyMotion = [];
  const distantGalaxies = [
    {
      direction: [0.08, 0.13, -1],
      distance: 142000,
      size: 22000,
      seed: 71,
      color: '#8fcaff',
      arms: 2,
    },
    {
      direction: [-0.48, 0.2, -0.86],
      distance: 190000,
      size: 9800,
      seed: 113,
      color: '#e2b2ff',
      arms: 3,
    },
    {
      direction: [0.72, -0.08, 0.69],
      distance: 185000,
      size: 10500,
      seed: 149,
      color: '#ffd29b',
      arms: 2,
      edgeOn: true,
    },
    {
      direction: [-0.94, 0.17, 0.3],
      distance: 168000,
      size: 8200,
      seed: 193,
      color: '#9ce8dd',
      arms: 5,
    },
    {
      direction: [0.24, 0.86, 0.45],
      distance: 198000,
      size: 9800,
      seed: 229,
      color: '#ffaed1',
      arms: 4,
    },
    {
      direction: [0.55, -0.73, -0.4],
      distance: 172000,
      size: 7600,
      seed: 271,
      color: '#b8c6ff',
      arms: 3,
      edgeOn: true,
    },
  ];
  distantGalaxies.forEach((entry) => {
    const material = new THREE.SpriteMaterial({
      map: makeDeepGalaxyTexture(entry),
      transparent: true,
      opacity: 0,
      // Keep nearby planets and the spacecraft in front of the distant art.
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    deepGalaxyMaterials.push(material);
    const sprite = new THREE.Sprite(material);
    sprite.position.fromArray(entry.direction).normalize().multiplyScalar(entry.distance);
    // Show Andromeda as a prominent spiral and keep the other distant
    // galaxies large enough to read clearly against the starfield.
    sprite.scale.set(entry.size * 3.6, entry.size * 2.66, 1);
    sprite.renderOrder = -2;
    deepGalaxyBackdrop.add(sprite);
    const direction = new THREE.Vector3().fromArray(entry.direction).normalize();
    const orbitAxis = new THREE.Vector3(
      Math.sin(entry.seed * 0.17),
      0.8 + Math.cos(entry.seed * 0.11) * 0.2,
      Math.cos(entry.seed * 0.23),
    ).normalize();
    deepGalaxyMotion.push({
      sprite,
      material,
      initialPosition: direction.multiplyScalar(entry.distance),
      orbitAxis,
      orbitSpeed: 0.0012 + (entry.seed % 5) * 0.00025,
      spinSpeed: 0.006 + (entry.seed % 7) * 0.001,
    });
  });
  // Very soft colored dust clouds add depth to the empty intergalactic
  // background without obscuring the galaxies or nearby planets.
  [
    { direction: [-0.28, 0.34, -0.9], distance: 156000, size: 76000, seed: 301, color: '#9b72ff' },
    { direction: [0.68, 0.46, -0.56], distance: 187000, size: 69000, seed: 317, color: '#ff779e' },
    {
      direction: [-0.74, -0.24, -0.63],
      distance: 174000,
      size: 82000,
      seed: 337,
      color: '#55d8c4',
    },
    { direction: [0.14, -0.78, 0.61], distance: 196000, size: 73000, seed: 353, color: '#ffb45e' },
    { direction: [0.86, -0.16, 0.48], distance: 164000, size: 66000, seed: 379, color: '#7186ff' },
  ].forEach((entry) => {
    const material = new THREE.SpriteMaterial({
      map: makeNebulaBackdropTexture(entry),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    deepSkyNebulaMaterials.push(material);
    const sprite = new THREE.Sprite(material);
    sprite.position.fromArray(entry.direction).normalize().multiplyScalar(entry.distance);
    sprite.scale.set(entry.size, entry.size * 0.68, 1);
    sprite.renderOrder = -3;
    deepGalaxyBackdrop.add(sprite);
  });
  sc.add(deepGalaxyBackdrop);
  const LB = [];
  const macroGalacticGroup = new THREE.Group(); macroGalacticGroup.name = 'Milky Way macro structure including Orion spur';
  const gal = new THREE.Group(),
    RG = 22500,
    GU = {
      uT: { value: 0 },
      uP: { value: 0 },
      uH: { value: (innerHeight * R.getPixelRatio()) / 1.04 },
    };
  const VS = `#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uT,uP,uH,uS;attribute vec3 col;attribute float aR,aZ;varying vec3 vC;
void main(){float w=uP+uT*(22500./max(aR,6000.)-1.);float c=cos(w),s=sin(w);vec3 p=vec3(position.x*c-position.z*s,position.y,position.x*s+position.z*c);vC=col;
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aZ>0.?min(aZ*uH/max(-mv.z,1.),420.):uS;
#include <logdepthbuf_vertex>
}`,
    FS = `#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uO;varying vec3 vC;
void main(){
#include <logdepthbuf_fragment>
float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(vC,pow(1.-d,2.)*uO);}`;
  const gp = (P, C, Rr, Z, s, o) => {
    const G = new THREE.BufferGeometry();
    G.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    G.setAttribute('col', new THREE.Float32BufferAttribute(C, 3));
    G.setAttribute('aR', new THREE.Float32BufferAttribute(Rr, 1));
    G.setAttribute('aZ', new THREE.Float32BufferAttribute(Z, 1));
    const m = new THREE.Points(
      G,
      new THREE.ShaderMaterial({
        uniforms: { uT: GU.uT, uP: GU.uP, uH: GU.uH, uS: { value: s }, uO: { value: o } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: VS,
        fragmentShader: FS,
        extensions: { fragDepth: true },
      }),
    );
    m.frustumCulled = false;
    return m;
  };
  // brazos espirales logarítmicos (pitch ~17°), trailing, saliendo de los extremos de la barra
  const arm = (r, k) => 0.739 + (k * TAU) / 4 - Math.log(r / 9000) / 0.3;
  // A deliberately generous scale height keeps the camera immersed in a
  // three-dimensional stellar volume instead of seeing the galaxy as an edge-on line.
  const diskHeight = (r) => 950 + 2600 * Math.exp(-r / 14000);
  a = [];
  c = [];
  let Rr = [],
    Z = [];
  for (let i = 0; i < 60000; i++) {
    let x,
      y,
      z,
      col,
      rr = RG;
    if (i < 9000) {
      const u = gs() * (i % 3 ? 9000 : 5000),
        w = gs() * (i % 3 ? 1800 : 5000);
      x = u * 0.89 - w * 0.45;
      z = u * 0.45 + w * 0.89;
      y = gs() * (i % 3 ? 2500 : 6200);
      col = [1, 0.85, 0.6];
    } else if (i < 16000) {
      const r = 3000 + Math.random() * 10000,
        an = Math.random() * TAU;
      x = Math.cos(an) * r;
      z = Math.sin(an) * r;
      y = gs() * (1100 + 3300 * Math.exp(-r / 7000));
      rr = r;
      col = [1, 0.82, 0.58];
    } else {
      const r = 9000 + Math.pow(Math.random(), 0.8) * 36000,
        k = i % 4,
        an = arm(r, k) + gs() * (0.34 + 0.1 * (k % 2)),
        t = r / 45000;
      x = Math.cos(an) * r + gs() * 2800;
      z = Math.sin(an) * r + gs() * 2800;
      y = gs() * diskHeight(r);
      rr = Math.hypot(x, z);
      col = Math.random() < 0.05 ? [1, 0.45, 0.7] : mix([1, 0.8, 0.6], [0.45, 0.6, 1], t);
    }
    a.push(x, y, z);
    const b = 0.35 + 0.65 * Math.random();
    c.push(col[0] * b, col[1] * b, col[2] * b);
    Rr.push(rr);
    Z.push(0);
  }
  macroGalacticGroup.add(gp(a, c, Rr, Z, 2.2, 1));
  // nebulosas: nubes de gas (rosa/azul/violeta/ámbar) a lo largo de los brazos, spur de Orión y brillo del núcleo
  a = [];
  c = [];
  Rr = [];
  Z = [];
  const NC = [
    [1, 0.35, 0.6],
    [0.35, 0.55, 1],
    [0.7, 0.4, 0.95],
    [1, 0.65, 0.35],
  ],
    nc = () => NC[(Math.random() * 4) | 0];
  for (let i = 0; i < 2600; i++) {
    const r = 9000 + Math.random() * 36000,
      an = arm(r, i % 4) + gs() * 0.38,
      cl = nc(),
      x = Math.cos(an) * r + gs() * 3500,
      z = Math.sin(an) * r + gs() * 3500;
    a.push(x, gs() * diskHeight(r), z);
    c.push(...cl);
    Rr.push(Math.hypot(x, z));
    Z.push(1500 + Math.random() * 3500);
  }
  for (let i = 0; i < 220; i++) {
    const q = gs() * 5000;
    a.push(RG + q * 0.25 + gs() * 1500, gs() * 2400, q + gs() * 1500);
    c.push(...nc());
    Rr.push(RG);
    Z.push(200 + Math.random() * 700);
  }
  for (let i = 0; i < 60; i++) {
    const r = Math.random() * 4500,
      an = Math.random() * TAU;
    a.push(Math.cos(an) * r, gs() * 3200, Math.sin(an) * r);
    c.push(1, 0.7, 0.4);
    Rr.push(RG);
    Z.push(3000 + Math.random() * 5000);
  }
  macroGalacticGroup.add(gp(a, c, Rr, Z, 0, 0.08));
  a = [];
  c = [];
  Rr = [];
  Z = [];
  for (let i = 0; i < 30000; i++) {
    const r = 3000 + Math.pow(Math.random(), 0.75) * 43000,
      an = Math.random() * TAU,
      t = r / 46000,
      b = 0.15 + 0.4 * Math.random(),
      cl = mix([1, 0.8, 0.6], [0.5, 0.65, 1], t);
    a.push(Math.cos(an) * r, gs() * diskHeight(r), Math.sin(an) * r);
    c.push(cl[0] * b, cl[1] * b, cl[2] * b);
    Rr.push(r);
    Z.push(0);
  }
  macroGalacticGroup.add(gp(a, c, Rr, Z, 1.6, 0.9));
  a = [];
  c = [];
  Rr = [];
  Z = [];
  for (let i = 0; i < 1400; i++) {
    const r = 4000 + Math.random() * 41000,
      an = Math.random() * TAU,
      cl = nc(),
      x = Math.cos(an) * r,
      z = Math.sin(an) * r;
    a.push(x, gs() * diskHeight(r), z);
    c.push(cl[0] * 0.6, cl[1] * 0.6, cl[2] * 0.7);
    Rr.push(r);
    Z.push(2500 + Math.random() * 4000);
  }
  macroGalacticGroup.add(gp(a, c, Rr, Z, 0, 0.05));
  a = [];
  c = [];
  Rr = [];
  Z = [];
  for (let i = 0; i < 900; i++) {
    const q = gs() * 4500;
    a.push(RG + q * 0.25 + gs() * 250, gs() * 1800, q + gs() * 250);
    c.push(0.4, 0.9, 1);
    Rr.push(RG);
    Z.push(0);
  }
  macroGalacticGroup.add(gp(a, c, Rr, Z, 3, 1));
  {
    const q = [];
    for (let i = 0; i < 256; i++)
      q.push(Math.cos((i / 256) * TAU) * 22500, 0, -Math.sin((i / 256) * TAU) * 22500);
    macroGalacticGroup.add(
      new THREE.LineLoop(
        new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(q, 3)),
        new THREE.LineBasicMaterial({ color: 0xf2b45a, transparent: true, opacity: 0.6 }),
      ),
    );
  }
  {
    const q = (t, x, z) => {
      const l = lab(t);
      l.position.set(x, 0, z);
      macroGalacticGroup.add(l);
      LB.push(l);
    };
    q('Centro galáctico (barra)', 0, 0);
    q('Brazo de Orión · Sol', 24500, -3500);
    q('Órbita aproximada del Sol', 0, -23500);
  }
  gal.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0.0642, 0.0976, -0.9929),
      new THREE.Vector3(-0.868, 0.497, 0),
      new THREE.Vector3(0.4935, 0.8618, 0.1166),
    ),
  );
  gal.add(macroGalacticGroup);
  gal.quaternion.normalize();
  sc.add(gal);
  // Separate, schematic overview layer. It is shown only while the nearby-
  // galaxies map is active and never participates in astronomical navigation.
  const nearbyGalaxyGroup = new THREE.Group(); nearbyGalaxyGroup.name = 'Catalog galaxies with compressed distances'; nearbyGalaxyGroup.visible = false;
  const atlasRadii = galaxySymbolRadii(NEARBY_GALAXIES), atlasCamera = fitAtlasCamera(NEARBY_GALAXIES, innerWidth / innerHeight), nearbyGalaxyMarkers = new Map(), galaxyLabelEntries = [];
  const nearbyMarkerGeometry = new THREE.SphereGeometry(1, 10, 8), atlasPickMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  let galacticMapDisk;
  NEARBY_GALAXIES.forEach(entry => {
    const group = new THREE.Group(); group.userData.nearbyGalaxyKey = entry.key; const radius = atlasRadii.get(entry.key) || 4, color = entry.key === 'milky-way' ? '#82bfff' : entry.key === 'm31' ? '#e5cba8' : '#b1d4e8';
    if (entry.kind !== 'group') { const model = makeAtlasGalaxy({ key: entry.key, type: entry.type?.en || entry.type?.es, radius, color, softMap: sharedPointMap }); group.add(model); if (entry.key === 'milky-way') galacticMapDisk = model; }
    else { const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => new THREE.Vector3(Math.cos(i / 64 * TAU) * 18, 0, Math.sin(i / 64 * TAU) * 18))), new THREE.LineBasicMaterial({ color: 0x7eafc4, transparent: true, opacity: .35 })); group.add(ring); }
    const pick = new THREE.Mesh(nearbyMarkerGeometry, atlasPickMaterial); pick.scale.setScalar(Math.max(radius, 4)); group.add(pick);
    const label = lab(entry.name.es + (entry.distanceMly ? ' · ' + entry.distanceMly + ' Mly' : entry.kind === 'group' ? ' · grupo' : ''), .24, 30), leader = makeLabelLeader(); group.add(label, leader); group.userData.label = label; group.userData.symbolRadius = radius;
    let position = galaxyMapPosition(entry); if (entry.anchorKey) { const anchor = NEARBY_GALAXIES.find(e => e.key === entry.anchorKey); if (anchor) position = galaxyMapPosition(anchor); } group.position.copy(position); group.traverse(n => n.userData.nearbyGalaxyKey = entry.key); nearbyGalaxyGroup.add(group); nearbyGalaxyMarkers.set(entry.key, group); galaxyLabelEntries.push({ key: entry.key, marker: group, label, leader });
  });
  const solarSystemMapMarker = new THREE.Group(); solarSystemMapMarker.position.x = (atlasRadii.get('milky-way') || 22) * .56; galacticMapDisk.add(solarSystemMapMarker);
  const solarMapSun = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffdc93 })); solarSystemMapMarker.add(solarMapSun);
  const solarMapPlanets = []; const solarSystemLabel = lab('Sistema Solar · Sol', .24, 30); solarSystemMapMarker.add(solarSystemLabel); const solarLeader = makeLabelLeader(); solarSystemMapMarker.add(solarLeader); galaxyLabelEntries.push({ key: 'solar-location', marker: solarSystemMapMarker, label: solarSystemLabel, leader: solarLeader });
  sc.add(nearbyGalaxyGroup);
  const stellarAtlas = buildStellarAtlas('stellar', { softMap: sharedPointMap, missionTargets: SPHEREX_TARGETS, orientation: gal.quaternion }), regionalAtlas = buildStellarAtlas('regional', { softMap: sharedPointMap, missionTargets: SPHEREX_TARGETS, orientation: gal.quaternion }); sc.add(stellarAtlas.group, regionalAtlas.group);

  const missionDestinationGroup = new THREE.Group(); missionDestinationGroup.name = 'ICRS destinations relative to Solar origin'; missionDestinationGroup.quaternion.copy(gal.quaternion); sc.add(missionDestinationGroup);
  const missionMarkers = new Map();
  const missionMarkerEffects = [];
  SPHEREX_TARGETS.forEach(target => {
    const effect = destinationResources.build(target), marker = effect.marker;
    marker.position.fromArray(heliocentricMapPosition(target));
    const label = lab(target.name, target.type === 'galaxia' ? 5 : 1.2, 22);
    label.position.set(0, effect.radius * 1.3, 0); label.visible = false; marker.add(label); LB.push(label);
    marker.traverse(child => { child.userData.spherexTargetKey = target.key; });
    missionDestinationGroup.add(marker); missionMarkers.set(target.key, { target, marker, label }); missionMarkerEffects.push(effect);
  });
  upgradeSceneGalaxiesWithMorphology({
    nearbyGalaxyMarkers,
    missionMarkers,
    missionMarkerEffects,
    stellarAtlas,
    regionalAtlas,
    macroGalacticGroup,
    atlasRadii,
    glowTexture: sharedPointMap,
  });
  const observerFirmament = createObserverAwareFirmament({
    scene: sc,
    galaxyOrientationQuat: gal.quaternion,
    glowTexture: sharedPointMap,
  });
  let observerPosPc = { x: 0, y: 0, z: 0 };
  let observerHostGalaxyKey = 'milky-way';
  let crossScaleState = {
    solarRevealBlend: 1,
    showDetailedSolarSystem: true,
    milkyWayInternalBlend: 0,
    cameraDistanceToOrigin: 0,
  };
  function syncObserverFirmament({ extragalacticMap = !!nearbyMapState } = {}) {
    return observerFirmament.rebuildSkyForObserver(observerPosPc, {
      hostGalaxyKey: observerHostGalaxyKey,
      extragalacticMap,
    });
  }
  // cuerpos
  const B = [];
  let earth;
  const satelliteBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9e4ed,
    metalness: 0.72,
    roughness: 0.3,
  });
  const satellitePanelMaterial = new THREE.MeshStandardMaterial({
    color: 0x315e89,
    metalness: 0.42,
    roughness: 0.38,
  });
  const goldSatelliteMaterial = new THREE.MeshStandardMaterial({
    color: 0xc89d58,
    metalness: 0.58,
    roughness: 0.38,
  });
  const satelliteBodyGeometry = new THREE.BoxGeometry(0.055, 0.052, 0.07);
  const satellitePanelGeometry = new THREE.BoxGeometry(0.12, 0.012, 0.06);
  const makeSatellite = (size = 0.04, station = false) => {
    const object = new THREE.Group();
    if (station) {
      // Compact ISS silhouette: pressurised modules along a central truss,
      // paired solar wings, radiator panels, and a small docking port.
      const truss = new THREE.Mesh(
        new THREE.BoxGeometry(1.14, 0.035, 0.035),
        goldSatelliteMaterial,
      );
      object.add(truss);
      const module = (geometry, position, material = satelliteBodyMaterial) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        object.add(mesh);
      };
      module(
        new THREE.CylinderGeometry(0.067, 0.067, 0.44, 10),
        [0, 0, -0.03],
        satelliteBodyMaterial,
      );
      module(
        new THREE.CylinderGeometry(0.055, 0.055, 0.27, 10),
        [0, 0.018, 0.32],
        goldSatelliteMaterial,
      );
      module(
        new THREE.CylinderGeometry(0.052, 0.052, 0.26, 10),
        [0, 0.018, -0.34],
        goldSatelliteMaterial,
      );
      module(new THREE.BoxGeometry(0.19, 0.065, 0.11), [0, 0.025, -0.02], satelliteBodyMaterial);
      [-1, 1].forEach((side) => {
        [-1, 1].forEach((pair) => {
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.012, 0.12),
            satellitePanelMaterial,
          );
          panel.position.set(side * 0.42, 0.018, pair * 0.14);
          object.add(panel);
          const fineLines = new THREE.Mesh(
            new THREE.BoxGeometry(0.27, 0.004, 0.006),
            satelliteBodyMaterial,
          );
          fineLines.position.set(side * 0.42, 0.026, pair * 0.14);
          object.add(fineLines);
        });
      });
      module(new THREE.CylinderGeometry(0.026, 0.035, 0.11, 8), [0, 0, 0.5], satelliteBodyMaterial);
    } else {
      object.add(new THREE.Mesh(satelliteBodyGeometry, satelliteBodyMaterial));
      [-1, 1].forEach((side) => {
        const panel = new THREE.Mesh(satellitePanelGeometry, satellitePanelMaterial);
        panel.position.x = side * 0.105;
        object.add(panel);
      });
    }
    object.scale.setScalar(size);
    return object;
  };
  const makeOrbitTrack = (radius, color, opacity = 0.38) => {
    const points = [];
    for (let step = 0; step < 128; step++) {
      const angle = (step / 128) * TAU;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    );
  };
  const makeMoonTexture = (moon) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = moon.base;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shading = context.createLinearGradient(0, 0, 0, canvas.height);
    shading.addColorStop(0, 'rgba(255,255,255,.18)');
    shading.addColorStop(0.5, 'rgba(255,255,255,0)');
    shading.addColorStop(1, 'rgba(0,0,0,.24)');
    context.fillStyle = shading;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Stable, deterministic surface marks keep the procedural maps consistent
    // between visits while giving each moon a distinct visual character.
    let seed = moon.seed;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (moon.name === 'Europa') {
      for (let i = 0; i < 46; i++) {
        const x = random() * canvas.width;
        const y = random() * canvas.height;
        context.beginPath();
        context.moveTo(x, y);
        context.bezierCurveTo(
          x + (random() - 0.5) * 80,
          y + 20,
          x + (random() - 0.5) * 100,
          y - 20,
          x + (random() - 0.5) * 110,
          y + (random() - 0.5) * 70,
        );
        context.strokeStyle = i % 4 === 0 ? 'rgba(151,83,67,.5)' : 'rgba(190,112,84,.3)';
        context.lineWidth = 1 + random() * 2.5;
        context.stroke();
      }
    } else {
      const count = moon.name === 'Ío' ? 55 : 95;
      for (let i = 0; i < count; i++) {
        const x = random() * canvas.width;
        const y = random() * canvas.height;
        const radius = 2 + random() * (moon.name === 'Ío' ? 10 : 15);
        const colors = moon.craterColors;
        context.beginPath();
        context.ellipse(x, y, radius * 1.4, radius, random() * Math.PI, 0, Math.PI * 2);
        context.fillStyle = colors[Math.floor(random() * colors.length)];
        context.fill();
        context.beginPath();
        context.ellipse(
          x - radius * 0.18,
          y - radius * 0.2,
          radius * 0.78,
          radius * 0.55,
          0,
          0,
          Math.PI * 2,
        );
        context.fillStyle = 'rgba(255,235,195,.12)';
        context.fill();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
    return texture;
  };
  const makeDwarfTexture = (planet) => {
    const width = 1024;
    const height = 512;
    const sampleWidth = 512;
    const sampleHeight = 256;
    const canvas = document.createElement('canvas');
    const reliefCanvas = document.createElement('canvas');
    const baseCanvas = document.createElement('canvas');
    const baseReliefCanvas = document.createElement('canvas');
    canvas.width = reliefCanvas.width = width;
    canvas.height = reliefCanvas.height = height;
    const context = canvas.getContext('2d');
    const reliefContext = reliefCanvas.getContext('2d');
    baseCanvas.width = baseReliefCanvas.width = sampleWidth;
    baseCanvas.height = baseReliefCanvas.height = sampleHeight;
    const baseContext = baseCanvas.getContext('2d');
    const baseReliefContext = baseReliefCanvas.getContext('2d');
    const image = baseContext.createImageData(sampleWidth, sampleHeight);
    const relief = baseReliefContext.createImageData(sampleWidth, sampleHeight);
    const palettes = {
      Ceres: [
        [43, 42, 40],
        [91, 87, 80],
        [142, 136, 126],
        [184, 178, 163],
      ],
      Plutón: [
        [76, 48, 42],
        [132, 83, 66],
        [184, 132, 105],
        [225, 194, 158],
      ],
      Haumea: [
        [72, 76, 74],
        [132, 139, 136],
        [195, 201, 195],
        [233, 233, 222],
      ],
      Makemake: [
        [76, 40, 34],
        [130, 66, 51],
        [181, 108, 82],
        [221, 169, 129],
      ],
      Eris: [
        [102, 105, 103],
        [151, 154, 151],
        [198, 200, 195],
        [232, 231, 222],
      ],
    };
    const palette = palettes[planet.n] || [
      [planet.c[0] * 0.45, planet.c[1] * 0.45, planet.c[2] * 0.45],
      planet.c,
      [planet.c[0] * 1.18, planet.c[1] * 1.18, planet.c[2] * 1.18],
      [230, 220, 205],
    ];
    let seed = planet.seed;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const seedOffset = planet.seed * 0.013;
    const interpolate = (a, b, amount) => a + (b - a) * amount;
    for (let y = 0; y < sampleHeight; y++) {
      const v = y / sampleHeight;
      for (let x = 0; x < sampleWidth; x++) {
        const u = x / sampleWidth;
        const broad = fbm(u + seedOffset, v + seedOffset * 0.31, 4.5);
        const detail = fbm(u + seedOffset * 0.7, v + seedOffset * 0.9, 27);
        const latitude = planet.n === 'Eris' ? Math.abs(v - 0.5) * 0.2 : 0;
        let tone = THREE.MathUtils.clamp(
          0.5 + (broad - 0.5) * 2.1 + (detail - 0.5) * 1.1 + latitude,
          0,
          0.999,
        );
        const band = Math.min(2, Math.floor(tone * 3));
        const blend = tone * 3 - band;
        const color = palette[3].map((channel, index) =>
          interpolate(palette[band][index], palette[band + 1][index], blend),
        );
        const pixel = (y * sampleWidth + x) * 4;
        image.data[pixel] = color[0];
        image.data[pixel + 1] = color[1];
        image.data[pixel + 2] = color[2];
        image.data[pixel + 3] = 255;
        const heightValue = THREE.MathUtils.clamp(
          110 + (broad - 0.5) * 110 + (detail - 0.5) * 54,
          0,
          255,
        );
        relief.data[pixel] = relief.data[pixel + 1] = relief.data[pixel + 2] = heightValue;
        relief.data[pixel + 3] = 255;
      }
    }
    baseContext.putImageData(image, 0, 0);
    baseReliefContext.putImageData(relief, 0, 0);
    context.drawImage(baseCanvas, 0, 0, width, height);
    reliefContext.drawImage(baseReliefCanvas, 0, 0, width, height);

    const craterCount =
      { Ceres: 205, Plutón: 170, Haumea: 110, Makemake: 150, Eris: 185 }[planet.n] || 140;
    for (let index = 0; index < craterCount; index++) {
      const x = random() * width;
      const y = random() * height;
      const radius = 2 + Math.pow(random(), 2.1) * 37;
      const flatten = 0.65 + random() * 0.65;
      const rotation = random() * Math.PI;
      const shadow = context.createRadialGradient(
        x - radius * 0.18,
        y - radius * 0.2,
        radius * 0.12,
        x,
        y,
        radius,
      );
      shadow.addColorStop(0, 'rgba(18,18,20,.48)');
      shadow.addColorStop(0.48, 'rgba(28,25,24,.22)');
      shadow.addColorStop(0.74, 'rgba(245,235,218,.35)');
      shadow.addColorStop(1, 'rgba(20,18,18,0)');
      context.beginPath();
      context.ellipse(x, y, radius, radius * flatten, rotation, 0, TAU);
      context.fillStyle = shadow;
      context.fill();

      const reliefGradient = reliefContext.createRadialGradient(x, y, radius * 0.28, x, y, radius);
      reliefGradient.addColorStop(0, 'rgba(32,32,32,.7)');
      reliefGradient.addColorStop(0.68, 'rgba(72,72,72,.3)');
      reliefGradient.addColorStop(0.84, 'rgba(238,238,238,.62)');
      reliefGradient.addColorStop(1, 'rgba(128,128,128,0)');
      reliefContext.beginPath();
      reliefContext.ellipse(x, y, radius, radius * flatten, rotation, 0, TAU);
      reliefContext.fillStyle = reliefGradient;
      reliefContext.fill();
    }
    if (planet.n === 'Plutón') {
      // Broad, irregular bright ice plains inspired by Tombaugh Regio.
      context.beginPath();
      context.moveTo(570, 192);
      context.bezierCurveTo(618, 111, 700, 121, 735, 170);
      context.bezierCurveTo(793, 115, 872, 151, 855, 205);
      context.bezierCurveTo(838, 259, 745, 285, 694, 258);
      context.bezierCurveTo(633, 293, 556, 256, 570, 192);
      context.fillStyle = 'rgba(255,230,194,.54)';
      context.fill();
      context.strokeStyle = 'rgba(246,214,180,.3)';
      context.lineWidth = 10;
      context.stroke();
      const ice = context.createRadialGradient(713, 204, 14, 713, 204, 150);
      ice.addColorStop(0, 'rgba(255,241,211,.28)');
      ice.addColorStop(1, 'rgba(255,241,211,0)');
      context.fillStyle = ice;
      context.fillRect(548, 94, 332, 230);
    } else if (planet.n === 'Ceres') {
      [
        [488, 232, 22],
        [493, 229, 11],
        [211, 326, 8],
        [793, 117, 6],
      ].forEach(([x, y, radius]) => {
        const salt = context.createRadialGradient(x, y, 1, x, y, radius * 2.8);
        salt.addColorStop(0, 'rgba(255,255,244,.96)');
        salt.addColorStop(0.3, 'rgba(251,249,232,.78)');
        salt.addColorStop(1, 'rgba(245,241,224,0)');
        context.fillStyle = salt;
        context.fillRect(x - radius * 3, y - radius * 3, radius * 6, radius * 6);
      });
    } else if (planet.n === 'Haumea') {
      context.save();
      context.translate(562, 246);
      context.rotate(-0.22);
      const dark = context.createRadialGradient(0, 0, 14, 0, 0, 146);
      dark.addColorStop(0, 'rgba(108,52,43,.55)');
      dark.addColorStop(1, 'rgba(108,52,43,0)');
      context.fillStyle = dark;
      context.fillRect(-160, -75, 320, 150);
      context.restore();
      context.strokeStyle = 'rgba(255,255,245,.25)';
      context.lineWidth = 2;
      for (let groove = 0; groove < 24; groove++) {
        const y = random() * height;
        const x = random() * width;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(
          x + 18 + random() * 70,
          y - 8 + random() * 16,
          x + 48 + random() * 95,
          y + random() * 14,
        );
        context.stroke();
      }
    } else if (planet.n === 'Makemake') {
      for (let patch = 0; patch < 34; patch++) {
        const x = random() * width;
        const y = random() * height;
        const radius = 18 + random() * 74;
        const frost = context.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        frost.addColorStop(0, random() > 0.5 ? 'rgba(242,213,171,.3)' : 'rgba(72,35,31,.24)');
        frost.addColorStop(1, 'rgba(100,50,40,0)');
        context.fillStyle = frost;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    const bumpTexture = new THREE.CanvasTexture(reliefCanvas);
    texture.encoding = THREE.sRGBEncoding;
    const anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
    texture.anisotropy = bumpTexture.anisotropy = anisotropy;
    return { map: texture, bumpMap: bumpTexture };
  };
  P.forEach((p) => {
    const dwarfSurface = p.dwarf ? makeDwarfTexture(p) : null;
    const pivot = new THREE.Group(),
      tilt = new THREE.Group(),
      mat = p.sun
        ? new THREE.MeshBasicMaterial({ map: sunTexture(p) })
        : new THREE.MeshStandardMaterial({
          map: dwarfSurface
            ? dwarfSurface.map
            : loadTexture(PLANET_TEXTURE_FILES[p.n], true, p.n),
          roughness: p.n === 'Venus' ? 0.88 : 0.96,
          metalness: 0,
          ...(dwarfSurface ? { bumpMap: dwarfSurface.bumpMap, bumpScale: 0.022 } : {}),
          ...(p.n === 'Tierra'
            ? {
              normalMap: loadTexture('2k_earth_normal_map.jpg', false),
              normalScale: new THREE.Vector2(0.11, 0.11),
            }
            : {}),
        }),
      spin = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), mat);
    if (p.shape) spin.scale.y = p.shape;
    tilt.rotation.z = ((p.tilt || 0) * Math.PI) / 180;
    tilt.add(spin);
    if (p.n === 'Tierra' || p.n === 'Venus') {
      const isEarth = p.n === 'Tierra';
      const atmosphericMap = loadTexture(
        isEarth ? '2k_earth_clouds.jpg' : '2k_venus_atmosphere.jpg',
      );
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.009, 64, 48),
        new THREE.MeshStandardMaterial({
          map: atmosphericMap,
          alphaMap: isEarth ? atmosphericMap : null,
          color: isEarth ? 0xffffff : 0xffe5c2,
          transparent: true,
          opacity: isEarth ? 0.76 : 0.52,
          roughness: 1,
          metalness: 0,
          depthWrite: false,
          side: THREE.FrontSide,
        }),
      );
      spin.add(atmosphere);
    }
    if (p.n === 'Urano' || p.n === 'Neptuno') {
      // Thin limb haze gives the ice giants depth without turning their
      // atmospheres into a bright, opaque blue shell.
      const atmosphereColor = p.n === 'Urano' ? 0x8fe8ed : 0x4e9dff;
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.035, 64, 48),
        new THREE.ShaderMaterial({
          uniforms: { glowColor: { value: new THREE.Color(atmosphereColor) } },
          vertexShader: `varying vec3 vNormal; varying vec3 vViewDirection;
            void main() {
              vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vViewDirection = normalize(-viewPosition.xyz);
              gl_Position = projectionMatrix * viewPosition;
            }`,
          fragmentShader: `uniform vec3 glowColor; varying vec3 vNormal; varying vec3 vViewDirection;
            void main() {
              float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0), 3.0);
              gl_FragColor = vec4(glowColor, rim * 0.34);
            }`,
          transparent: true,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      spin.add(atmosphere);
    }
    pivot.add(tilt);
    sc.add(pivot);
    const b = { p, pivot, tilt, spin };
    if (p.n === 'Tierra') {
      // Illustrative, visually compressed orbital planes: the satellites are
      // intentionally small and are not positional/ephemeris data.
      const system = new THREE.Group();
      pivot.add(system);
      b.satelliteSystem = system;
      b.satellites = [];
      const constellation = [
        {
          name: 'STARLINK',
          count: 28,
          radius: 1.18,
          inclination: 0.28,
          period: 0.0667,
          color: 0x68caff,
        },
        {
          name: 'STARLINK',
          count: 26,
          radius: 1.38,
          inclination: 0.72,
          period: 0.071,
          color: 0x68caff,
        },
        {
          name: 'STARLINK',
          count: 24,
          radius: 1.6,
          inclination: 1.02,
          period: 0.076,
          color: 0x68caff,
        },
        {
          name: 'STARLINK',
          count: 20,
          radius: 1.82,
          inclination: 1.31,
          period: 0.079,
          color: 0x68caff,
        },
        {
          name: 'ISS · Estación Espacial Internacional',
          count: 1,
          radius: 1.9,
          inclination: 0.9,
          period: 0.0646,
          color: 0xffc979,
          station: true,
          size: 0.055,
        },
        {
          name: 'Hubble · NASA/ESA',
          count: 1,
          radius: 2.16,
          inclination: 0.35,
          period: 0.066,
          color: 0xe6efff,
          size: 0.055,
        },
      ];
      constellation.forEach((orbit, orbitIndex) => {
        const plane = new THREE.Group();
        plane.rotation.set(orbit.inclination, 0, orbitIndex * 0.71);
        system.add(plane);
        const objects = [];
        for (let index = 0; index < orbit.count; index++) {
          const satellite = makeSatellite(orbit.size || 0.04, orbit.station);
          plane.add(satellite);
          objects.push({ object: satellite, phase: (index / orbit.count) * TAU });
        }
        if (orbit.name !== 'STARLINK' || orbitIndex === 0) {
          const label = lab(orbit.name === 'STARLINK' ? 'STARLINK' : orbit.name, 0.15, 18);
          label.position.set(0, orbit.radius + 0.16, 0);
          label.visible = false;
          plane.add(label);
          LB.push(label);
        }
        b.satellites.push({ ...orbit, plane, objects });
      });

      // Observatorio Espacial SPHEREx (NASA/JPL) reconstruido en 3D en órbita polar heliosíncrona (~650 km, ~98 min)
      const spherex = createSpherexObservatory3D();
      spherex.root.scale.setScalar(0.052);
      const spherexLabel = lab('SPHEREx · NASA (Órbita polar ~650 km)', 0.16, 18);
      spherexLabel.position.set(0, 2.35, 0);
      spherexLabel.visible = false;
      spherex.root.add(spherexLabel);
      LB.push(spherexLabel);
      system.add(spherex.root);
      spherex.update({ simDays: 0, elapsedTime: 0, earthRadius: 1, orbitRadius: 1.95, scanning: false });
      b.spherex = spherex;
    }
    if (p.n === 'Júpiter') {
      const system = new THREE.Group();
      pivot.add(system);
      b.moonSystem = system;
      const jupRadiusKm = p.km || 69911;
      b.jupiterMoons = [
        {
          name: 'Ío',
          radiusKm: 1821.6,
          semiMajorAxisKm: 421700,
          physicalOrbitRatio: 421700 / jupRadiusKm,
          physicalSizeRatio: 1821.6 / jupRadiusKm,
          schematicOrbitRatio: 2.05,
          schematicSizeRatio: 0.15,
          radius: 421700 / jupRadiusKm,
          size: 0.15,
          period: 1.769,
          inclination: 0.0035,
          base: '#bd8c42',
          seed: 17,
          craterColors: ['rgba(255,216,98,.42)', 'rgba(187,82,36,.32)', 'rgba(88,53,35,.25)'],
          phase: 0.4,
        },
        {
          name: 'Europa',
          radiusKm: 1560.8,
          semiMajorAxisKm: 671034,
          physicalOrbitRatio: 671034 / jupRadiusKm,
          physicalSizeRatio: 1560.8 / jupRadiusKm,
          schematicOrbitRatio: 2.75,
          schematicSizeRatio: 0.13,
          radius: 671034 / jupRadiusKm,
          size: 0.13,
          period: 3.551,
          inclination: 0.0082,
          base: '#c9c3ad',
          seed: 31,
          phase: 2.1,
        },
        {
          name: 'Ganímedes',
          radiusKm: 2634.1,
          semiMajorAxisKm: 1070412,
          physicalOrbitRatio: 1070412 / jupRadiusKm,
          physicalSizeRatio: 2634.1 / jupRadiusKm,
          schematicOrbitRatio: 3.65,
          schematicSizeRatio: 0.22,
          radius: 1070412 / jupRadiusKm,
          size: 0.22,
          period: 7.155,
          inclination: 0.0041,
          base: '#817a6e',
          seed: 47,
          craterColors: ['rgba(47,48,46,.35)', 'rgba(183,164,133,.3)', 'rgba(107,88,67,.3)'],
          phase: 3.8,
        },
        {
          name: 'Calisto',
          radiusKm: 2410.3,
          semiMajorAxisKm: 1882709,
          physicalOrbitRatio: 1882709 / jupRadiusKm,
          physicalSizeRatio: 2410.3 / jupRadiusKm,
          schematicOrbitRatio: 4.75,
          schematicSizeRatio: 0.19,
          radius: 1882709 / jupRadiusKm,
          size: 0.19,
          period: 16.689,
          inclination: 0.0087,
          base: '#514b43',
          seed: 63,
          craterColors: ['rgba(21,22,22,.45)', 'rgba(158,145,126,.25)', 'rgba(86,74,62,.4)'],
          phase: 5.1,
        },
      ].map((moon) => {
        const moonPivot = new THREE.Group();
        moonPivot.rotation.x = moon.inclination;
        system.add(moonPivot);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(moon.size, 20, 14),
          new THREE.MeshStandardMaterial({
            map: makeMoonTexture(moon),
            roughness: 0.88,
            metalness: 0,
          }),
        );
        moonPivot.add(mesh);
        const label = lab(moon.name, 0.12, 16);
        label.position.set(0, moon.size * 2.4, 0);
        label.visible = false;
        moonPivot.add(label);
        LB.push(label);
        return { ...moon, moonPivot, mesh };
      });
    }
    if (p.ring) {
      const cv = document.createElement('canvas');
      cv.width = 256;
      cv.height = 1;
      const g = cv.getContext('2d');
      for (let i = 0; i < 256; i++) {
        const k = 0.5 + 0.5 * Math.sin(i * 0.35) * Math.sin(i * 0.09);
        g.fillStyle = `rgba(215,195,150,${(i > 20 && i < 230 ? 0.35 + 0.5 * k : 0) * (i > 110 && i < 122 ? 0.1 : 1)})`;
        g.fillRect(i, 0, 1, 1);
      }
      const rg = new THREE.RingGeometry(1.25, 2.4, 128),
        uv = rg.attributes.uv,
        ps = rg.attributes.position;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, (Math.hypot(ps.getX(i), ps.getY(i)) - 1.25) / 1.15, 0.5);
      const rm = new THREE.Mesh(
        rg,
        new THREE.MeshStandardMaterial({
          map: new THREE.CanvasTexture(cv),
          roughness: 0.9,
          metalness: 0.0,
          transparent: true,
          alphaTest: 0.02,
          side: THREE.DoubleSide,
          depthWrite: true,
        }),
      );
      rm.rotation.x = Math.PI / 2;
      tilt.add(rm);
      b.ringMesh = rm;
    }
    if (!p.sun && !p.moon) {
      const catColor = PLANETARY_PHYSICAL_CATALOG[p.n]?.colorHex || 0xfff4dc;
      const pointBeacon = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: planetaryBeaconMap,
          color: catColor,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      pointBeacon.visible = false;
      pointBeacon.userData.planetName = p.n;
      pivot.add(pointBeacon);
      b.pointBeacon = pointBeacon;
    }
    if (p.au) {
      const pp = [];
      for (let k = 0; k < 256; k++) {
        const v = kep(p, (k / 256) * TAU);
        pp.push(v.x, v.y, v.z);
      }
      const G = new THREE.BufferGeometry();
      G.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
      b.orbit = new THREE.LineLoop(
        G,
        new THREE.LineBasicMaterial({
          color: p.dwarf ? 0xa58ad7 : 0x5a7090,
          transparent: true,
          opacity: 0.5,
        }),
      );
      sc.add(b.orbit);
    }
    if (p.sun) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const g = cv.getContext('2d'),
        gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,250,242,1)');
      gr.addColorStop(0.28, 'rgba(255,235,200,.44)');
      gr.addColorStop(1, 'rgba(255,195,125,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      b.glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(cv),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      sc.add(b.glow);
    }
    b.lab = lab(p.n);
    pivot.add(b.lab);
    LB.push(b.lab);
    b.ax = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -2, 0),
        new THREE.Vector3(0, 2, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0xff5577 }),
    );
    tilt.add(b.ax);
    if (p.au || p.moon) {
      b.ar = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, 0x55ff99);
      pivot.add(b.ar);
    }
    pivot.userData.planetName = p.n;
    pivot.traverse((child) => {
      child.userData.planetName = p.n;
    });
    if (p.n == 'Tierra') earth = b;
    B.push(b);
  });
  // Belt made from instanced, irregular 3D bodies instead of point sprites.
  const belt = new THREE.Group();
  const asteroidMeshes = [];
  const asteroidRecords = [];
  const asteroidPalette = [0x887c70, 0x9c8d7a, 0x6e6c68, 0xa09382, 0x776454, 0xaaa196];
  const asteroidVariantCount = 8;
  const asteroidCountPerVariant = 110;
  let asteroidSeed = 92071;
  const asteroidRandom = () => {
    asteroidSeed = (asteroidSeed * 1664525 + 1013904223) >>> 0;
    return asteroidSeed / 4294967296;
  };
  for (let variant = 0; variant < asteroidVariantCount; variant++) {
    const geometries = [
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.DodecahedronGeometry(1, 1),
      new THREE.OctahedronGeometry(1, 1),
      new THREE.IcosahedronGeometry(1, 2),
    ];
    const geometry = geometries[variant % geometries.length];
    const positions = geometry.attributes.position;
    const vertexSeed = 1789 + variant * 7919;
    let vertexState = vertexSeed;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      vertexState = (vertexState * 1664525 + 1013904223) >>> 0;
      const roughness = 0.78 + (vertexState / 4294967296) * 0.42;
      positions.setXYZ(
        vertex,
        positions.getX(vertex) * roughness,
        positions.getY(vertex) * roughness,
        positions.getZ(vertex) * roughness,
      );
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.94,
      metalness: 0.035,
      vertexColors: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, asteroidCountPerVariant);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    belt.add(mesh);
    asteroidMeshes.push(mesh);
    for (let index = 0; index < asteroidCountPerVariant; index++) {
      const au = 2.05 + asteroidRandom() * 1.25;
      const radiusKm = 0.5 + Math.pow(asteroidRandom(), 2.1) * 469;
      const visualRadius = 0.009 + Math.pow(radiusKm / 469, 0.58) * 0.066;
      const color = new THREE.Color(
        asteroidPalette[Math.floor(asteroidRandom() * asteroidPalette.length)],
      );
      color.multiplyScalar(0.82 + asteroidRandom() * 0.34);
      mesh.setColorAt(index, color);
      asteroidRecords.push({
        mesh,
        index,
        au,
        radiusKm,
        visualRadius,
        phase: asteroidRandom() * TAU,
        inclination: (asteroidRandom() - 0.5) * 0.13,
        period: 365.25 * Math.pow(au, 1.5),
        spin: asteroidRandom() * TAU,
        spinRate: (asteroidRandom() - 0.5) * 0.9,
        shape: new THREE.Vector3(
          0.78 + asteroidRandom() * 0.42,
          0.72 + asteroidRandom() * 0.52,
          0.78 + asteroidRandom() * 0.42,
        ),
      });
    }
  }
  sc.add(belt);
  const realisticAsteroidBelt = createAsteroidBeltVisuals({
    scene: sc,
    auScaleFn: (au) => Dd(au),
  });
  const asteroidDummy = new THREE.Object3D();
  const clk = new THREE.Clock(),
    keys = {},
    V = THREE.Vector3;
  let real = false,
    sim = T0(),
    free = false,
    spectator = false,
    simulationPaused = false,
    launchSequence = null,
    launchCameraBlend = null,
    shipZoom = 1,
    fy = 0,
    fp = 0,
    fs = 60,
    shipSz = SHIP_METRIC_SCALE,
    fovBase = 55,
    drag = 0,
    ti = 9,
    bk = 0,
    pv = 3,
    th = 0,
    ac = 0,
    yw = 0,
    yp = 0,
    O = { tr: 1, in: 0, au: 0 };
  const sp = new V(),
    vel = new V(),
    pvl = new V(),
    dom = R.domElement,
    ship = new THREE.Group();
  let foc = null,
    tw = null,
    nav = null,
    hyperspace = null,
    jumpDurations = { ...JUMP_DURATIONS, ...S.jumpDurations },
    lastJump = null,
    arrivalTarget = null,
    nearKey = null,
    activeMissionKey = null,
    nearbyMapState = null,
    exteriorCameraMode = false,
    exteriorCameraSavedState = null,
    exteriorCameraTransition = null,
    exteriorLastShipPosition = new THREE.Vector3(),
    nearbySelectedKey = 'milky-way',
    nearbyMapRotation = 0,
    navigationContext = scaleContext('solar'),
    originRebaseState = { rebased: false, origin: [0, 0, 0], precisionBits: 64 },
    contextOverview = false,
    selectedContextStar = null;

  // Determina si el motor debe usar estrictamente la escala física astronómica (`1 u = 1.000.000 km`).
  // Solo el Modo 3 (`SOLAR_NAVIGATION`, cuando `!free && !real && !exteriorCameraMode && !spectator`)
  // usa la escala esquemática comprimida identificada como `VISTA ESQUEMÁTICA · ESCALA COMPRIMIDA`.
  const isPhysicalObservationActive = () =>
    Boolean(free || real || exteriorCameraMode || spectator);

  const metersToAstroSceneUnits = () =>
    isPhysicalObservationActive()
      ? PHYSICAL_CONSTANTS.METERS_TO_ASTRO_SCENE_UNITS
      : 0.015 / SHIP_LENGTH_METERS;

  function updateAsteroids(day) {
    if (realisticAsteroidBelt) realisticAsteroidBelt.update(day, (au) => Dd(au));
    const physical = isPhysicalObservationActive();
    const beltScale = Dd(2.7);
    asteroidRecords.forEach((asteroid) => {
      const angle = asteroid.phase + (day / asteroid.period) * TAU;
      const radius = asteroid.au / 2.7;
      asteroidDummy.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * Math.sin(asteroid.inclination),
        Math.sin(angle) * radius,
      );
      asteroidDummy.rotation.set(
        asteroid.spin + day * asteroid.spinRate * 0.0008,
        asteroid.phase,
        asteroid.inclination,
      );
      const size = physical
        ? asteroid.radiusKm / 1e6 / beltScale
        : asteroid.visualRadius / beltScale;
      asteroidDummy.scale.set(
        size * asteroid.shape.x,
        size * asteroid.shape.y,
        size * asteroid.shape.z,
      );
      asteroidDummy.updateMatrix();
      asteroid.mesh.setMatrixAt(asteroid.index, asteroidDummy.matrix);
    });
    asteroidMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  const Rd = (p) =>
    isPhysicalObservationActive()
      ? physicalPlanetSceneRadius(p)
      : schematicPlanetSceneRadius(p),
    Dd = (au) =>
      isPhysicalObservationActive()
        ? physicalOrbitSceneDistance(au)
        : schematicOrbitSceneDistance(au),
    Dm = () => (isPhysicalObservationActive() ? 0.3844 : 1.3),
    // En el Mundo Local (`localShipScene`, 1 u = 1 m), la nave conserva siempre 120.0 metros exactos:
    shipScale = () => SHIP_METRIC_SCALE,
    shipCameraDistanceMeters = () => SHIP_LENGTH_METERS * 1.38 * shipZoom,
    shipCameraDistance = () => shipCameraDistanceMeters() * metersToAstroSceneUnits(),
    shipOffset = () => shipCameraDistance();

  function syncSolarPositions(day = sim) {
    const physical = isPhysicalObservationActive();
    B.forEach((b) => {
      const p = b.p;
      if (!b.heliocentricScene64) b.heliocentricScene64 = new Float64Array(3);
      if (p.sun) {
        b.heliocentricAu = { x: 0, y: 0, z: 0 };
        b.heliocentricScene64[0] = 0;
        b.heliocentricScene64[1] = 0;
        b.heliocentricScene64[2] = 0;
        b.pivot.position.set(0, 0, 0);
      } else if (p.au) {
        const v = pos(p, day);
        b.heliocentricAu = { x: v.x, y: v.y, z: v.z };
        const scaleFactor = Dd(p.au) / p.au;
        b.heliocentricScene64[0] = v.x * scaleFactor;
        b.heliocentricScene64[1] = v.y * scaleFactor;
        b.heliocentricScene64[2] = v.z * scaleFactor;
        b.pivot.position.set(
          b.heliocentricScene64[0],
          b.heliocentricScene64[1],
          b.heliocentricScene64[2],
        );
        b.au = v.length();
        if (b.ar) {
          b.ar.setDirection(
            pos(p, day + 0.01)
              .sub(v)
              .normalize(),
          );
        }
      } else if (p.moon && earth) {
        const an = (day / p.per) * TAU,
          e64 = earth.heliocentricScene64 || [
            earth.pivot.position.x,
            earth.pivot.position.y,
            earth.pivot.position.z,
          ],
          d = Dm();
        b.heliocentricScene64[0] = e64[0] + Math.cos(an) * d;
        b.heliocentricScene64[1] = e64[1];
        b.heliocentricScene64[2] = e64[2] - Math.sin(an) * d;
        b.pivot.position.set(
          b.heliocentricScene64[0],
          b.heliocentricScene64[1],
          b.heliocentricScene64[2],
        );
        const earthAu = earth?.heliocentricAu || { x: 1, y: 0, z: 0 };
        const moonDistAu = 384400 / PHYSICAL_CONSTANTS.AU_KM;
        b.heliocentricAu = {
          x: earthAu.x + Math.cos(an) * moonDistAu,
          y: earthAu.y,
          z: earthAu.z - Math.sin(an) * moonDistAu,
        };
        b.spin.rotation.y = an + Math.PI / 2;
        if (b.ar) {
          b.ar.setDirection(new THREE.Vector3(-Math.sin(an), 0, -Math.cos(an)));
        }
      }
      if (b.jupiterMoons) {
        b.jupiterMoons.forEach((moon) => {
          moon.radius = physical ? moon.physicalOrbitRatio : moon.schematicOrbitRatio;
          const targetSizeRatio = physical ? moon.physicalSizeRatio : moon.schematicSizeRatio;
          moon.mesh.scale.setScalar(targetSizeRatio / moon.size);
        });
      }
    });
  }

  function layout() {
    const physical = isPhysicalObservationActive();
    B.forEach((b) => {
      const r = Rd(b.p);
      b.tilt.scale.setScalar(r);
      b.r = r;
      if (b.orbit) b.orbit.scale.setScalar(Dd(b.p.au) / b.p.au);
      if (b.glow) b.glow.scale.setScalar(r * (physical ? 18 : 6));
      if (b.satelliteSystem) b.satelliteSystem.scale.setScalar(r);
      if (b.moonSystem) b.moonSystem.scale.setScalar(r);
    });
    syncSolarPositions(sim);
    belt.scale.setScalar(Dd(2.7));
    updateAsteroids(sim);
    ct.minDistance = 0.0005;
  }
  function publishScale(id, target = null) {
    navigationContext = scaleContext(id, target);
    S.onNavigationScale?.(navigationContext);
  }
  function setNavigationScale(id) {
    if (realTimeIntro || launchSequence || launchCameraBlend || cabinReentryBlend || nav)
      return false;
    releaseInputs();
    vel.set(0, 0, 0);
    nav = null;
    activeMissionKey = null;
    selectedContextStar = null;
    S.onObjectSelect?.(null);
    if (id === 'extragalactic') {
      nearbyMap();
      return true;
    }
    if (nearbyMapState) returnFromNearbyMap();
    contextOverview = id === 'stellar' || id === 'regional';
    if (id === 'solar') {
      observerPosPc = { x: 0, y: 0, z: 0 };
      observerHostGalaxyKey = 'milky-way';
    }
    syncObserverFirmament({ extragalacticMap: false });
    if (contextOverview) {
      if (free) {
        setFree(false);
        S.fr(false);
      }
      localCabinWorld.visible = false;
      ship.visible = false;
      sceneDirector.skipActiveSequence();
      foc = null;
      ct.enabled = true;
      ct.minDistance = 1;
      ct.maxDistance = 90000;
      fly(id === 'stellar' ? [14000, 11000, 24000] : [19000, 16000, 33000]);
    } else if (id === 'solar') {
      localCabinWorld.visible = false;
      ship.visible = false;
      lvl(1);
    } else if (id === 'milkyway') {
      localCabinWorld.visible = false;
      ship.visible = false;
      lvl(3);
    } else return false;
    publishScale(id);
    S.onObservationModeChange?.(getObservationMode());
    return true;
  }
  function focusContextStar(key) { const atlas = navigationContext.id === 'stellar' ? stellarAtlas : regionalAtlas, entry = atlas.markers.get(key); if (!entry) return false; selectedContextStar = key; const canonical = getCanonicalStar(key); if (canonical) { observerPosPc = { ...canonical.positionPc }; observerHostGalaxyKey = 'milky-way'; syncObserverFirmament({ extragalacticMap: false }); } const position = entry.marker.getWorldPosition(new V()), direction = cam.position.clone().sub(ct.target).normalize(); if (!direction.lengthSq()) direction.set(.3, .3, 1).normalize(); ct.minDistance = entry.radius * 1.5; ct.maxDistance = 90000; tw = { p0: cam.position.clone(), t0: ct.target.clone(), p1: position.clone().addScaledVector(direction, entry.radius * 7), t1: position, k: 0 }; publishScale(navigationContext.id, entry.target); S.onObjectSelect?.(key === 'sun' ? { kind: 'planet', key: 'Sol' } : entry.target.missionKey ? { kind: 'spherex', key: entry.target.missionKey } : { kind: 'catalog-star', key }); return true; }
  const nearbyRaycaster = new THREE.Raycaster();
  const nearbyPointer = new THREE.Vector2();
  const nearbyMarkerWorld = new THREE.Vector3();
  let nearbyPointerStart = null;

  function collectExteriorShipBounds() {
    const prevPos = ship.position.clone();
    const prevQuat = ship.quaternion.clone();
    const prevScale = ship.scale.clone();

    ship.scale.setScalar(SHIP_METRIC_SCALE);
    ship.updateWorldMatrix(true, true);

    const boundsRoot = new THREE.Group();
    const targetRoot = modularShip?.root || ship;
    const ignored = new Set((FL || []).flatMap(({ c, k, g }) => [c, k, g]));
    ignored.add(fl2);

    targetRoot.traverse((object) => {
      if (!object.isMesh || !object.geometry || ignored.has(object)) return;
      if (object.userData?.isPlume || object.userData?.isWarpBubble) return;
      const proxy = object.clone(false);
      proxy.matrixAutoUpdate = false;
      proxy.matrix.copy(object.matrixWorld);
      boundsRoot.add(proxy);
    });
    boundsRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(boundsRoot);
    if (box.isEmpty()) box.setFromObject(ship);

    // Mide tamaño exacto desrotado en metros reales de nave (proa en -Z, popa en +Z)
    ship.position.set(0, 0, 0);
    ship.quaternion.identity();
    ship.scale.setScalar(SHIP_METRIC_SCALE);
    ship.updateWorldMatrix(true, true);
    const unrotatedRoot = new THREE.Group();
    targetRoot.traverse((object) => {
      if (!object.isMesh || !object.geometry || ignored.has(object)) return;
      if (object.userData?.isPlume || object.userData?.isWarpBubble) return;
      const proxy = object.clone(false);
      proxy.matrixAutoUpdate = false;
      proxy.matrix.copy(object.matrixWorld);
      unrotatedRoot.add(proxy);
    });
    unrotatedRoot.updateMatrixWorld(true);
    const unrotatedBox = new THREE.Box3().setFromObject(unrotatedRoot);
    const unrotatedSize = unrotatedBox.getSize(new THREE.Vector3());

    ship.position.copy(prevPos);
    ship.quaternion.copy(prevQuat);
    ship.scale.copy(prevScale);
    ship.updateWorldMatrix(true, true);

    const sphere = box.getBoundingSphere(new THREE.Sphere());
    return {
      box,
      sphere,
      size: box.getSize(new THREE.Vector3()),
      center: box.getCenter(new THREE.Vector3()),
      hullDimensionsMeters: {
        widthMeters: Number(unrotatedSize.x.toFixed(2)),
        heightMeters: Number(unrotatedSize.y.toFixed(2)),
        lengthMeters: Number(unrotatedSize.z.toFixed(2)),
      },
    };
  }

  function exteriorCameraPose() {
    const { box, sphere, size, center, hullDimensionsMeters } = collectExteriorShipBounds();
    const aspect = Math.max(0.1, localCam.aspect || innerWidth / innerHeight);
    const fovV = THREE.MathUtils.degToRad(localCam.fov || cam.fov);
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
    const azimuths = [64, 114, 248, 296, 48, 82, ...Array.from({ length: 24 }, (_, i) => i * 15)];
    const elevations = [18, 18, 18, 18, 18, 18, ...Array(24).fill(18)];
    azimuths.push(...Array.from({ length: 24 }, (_, i) => i * 15));
    elevations.push(...Array(24).fill(32));
    for (let index = 0; index < azimuths.length; index++) {
      const az = THREE.MathUtils.degToRad(azimuths[index]);
      const el = THREE.MathUtils.degToRad(elevations[index]);
      const outward = new THREE.Vector3(
        Math.cos(el) * Math.sin(az),
        Math.sin(el),
        Math.cos(el) * Math.cos(az),
      )
        .applyQuaternion(ship.quaternion)
        .normalize();
      const right = new THREE.Vector3()
        .crossVectors(new THREE.Vector3(0, 1, 0), outward)
        .normalize();
      const up = new THREE.Vector3().crossVectors(outward, right).normalize();
      const projectedWidth =
        (Math.abs(right.x) * size.x + Math.abs(right.y) * size.y + Math.abs(right.z) * size.z) / 2;
      const projectedHeight =
        (Math.abs(up.x) * size.x + Math.abs(up.y) * size.y + Math.abs(up.z) * size.z) / 2;
      const projectedDepth =
        (Math.abs(outward.x) * size.x +
          Math.abs(outward.y) * size.y +
          Math.abs(outward.z) * size.z) /
        2;
      const distance =
        Math.max(
          projectedHeight / Math.tan(fovV / 2) + projectedDepth,
          projectedWidth / Math.tan(fovH / 2) + projectedDepth,
          sphere.radius / Math.sin(Math.min(fovV, fovH) / 2),
        ) * 1.28;
      const localPosition = center.clone().addScaledVector(outward, distance);
      const astroPosition = sp
        .clone()
        .addScaledVector(localPosition, metersToAstroSceneUnits());
      const cameraInsidePlanet = B.some((body) => {
        const planetCenter = body.pivot.getWorldPosition(new THREE.Vector3());
        return astroPosition.distanceTo(planetCenter) < (body.r || 0) * 1.05;
      });
      if (cameraInsidePlanet) continue;
      return {
        position: sp.clone().add(localPosition),
        target: sp.clone().add(center),
        localPosition,
        localTarget: center,
        distance,
        sphere,
        box,
        hullDimensionsMeters,
      };
    }
    const fallbackDirection = new THREE.Vector3(0.64, 0.31, 0.7)
      .normalize()
      .applyQuaternion(ship.quaternion);
    const distance = Math.max(sphere.radius * 2.4, 155);
    const localPosition = center.clone().addScaledVector(fallbackDirection, distance);
    return {
      position: sp.clone().add(localPosition),
      target: sp.clone().add(center),
      localPosition,
      localTarget: center,
      distance,
      sphere,
      box,
      hullDimensionsMeters,
    };
  }

  function resetExteriorCamera(immediate = false) {
    if (!exteriorCameraMode) return;
    const pose = exteriorCameraPose();
    if (immediate) {
      exteriorCameraTransition = null;
      cam.position.copy(pose.position);
      ct.target.copy(pose.target);
      cam.lookAt(ct.target);
      localCam.position.copy(pose.localPosition);
      localCam.lookAt(pose.localTarget);
      ct.enabled = true;
    } else {
      exteriorCameraTransition = {
        fromPosition: cam.position.clone(),
        fromTarget: ct.target.clone(),
        toPosition: pose.position,
        toTarget: pose.target,
        elapsed: 0,
        duration: 0.65,
      };
      ct.enabled = false;
    }
    localCam.near = 0.25;
    localCam.far = Math.max(6000, pose.distance * 25);
    localCam.updateProjectionMatrix();
    cam.near = 0.0005;
    cam.far = Math.max(4e5, pose.distance * 25);
    cam.updateProjectionMatrix();
    // Anti-penetración estricta: la distancia mínima de órbita queda siempre fuera de la esfera envolvente de 120 m
    ct.minDistance = Math.max(72, pose.sphere.radius * 1.25);
    ct.maxDistance = Math.max(ct.minDistance * 4, pose.sphere.radius * 10);
    ct.minPolarAngle = 0.12;
    ct.maxPolarAngle = Math.PI - 0.12;
    if (immediate) ct.update();
  }

  function leaveExteriorCamera(restorePose = true) {
    if (!exteriorCameraMode) return;
    exteriorCameraMode = false;
    exteriorCameraTransition = null;
    const saved = exteriorCameraSavedState;
    exteriorCameraSavedState = null;
    if (!saved) return;
    cam.near = saved.near;
    cam.far = saved.far;
    cam.fov = saved.fov;
    cam.updateProjectionMatrix();
    localCam.fov = saved.fov;
    localCam.updateProjectionMatrix();
    ct.minDistance = saved.minDistance;
    ct.maxDistance = saved.maxDistance;
    ct.minPolarAngle = saved.minPolarAngle;
    ct.maxPolarAngle = saved.maxPolarAngle;
    if (restorePose) {
      cam.position.copy(saved.position);
      cam.quaternion.copy(saved.quaternion);
      ct.target.copy(saved.target);
    }
    ct.enabled = saved.controlsEnabled;
  }

  function userCameraAvailable() { return !(realTimeIntro || mainMenuOrbitActive || launchSequence || launchCameraBlend || cabinReentryBlend || nav); }
  function enterExteriorCamera() {
    if (!userCameraAvailable()) return false;
    const alreadyExterior = exteriorCameraMode;
    if (!alreadyExterior) {
      exteriorCameraMode = true;
      exteriorCameraSavedState = {
        position: cam.position.clone(), quaternion: cam.quaternion.clone(), target: ct.target.clone(),
        near: cam.near, far: cam.far, fov: cam.fov, minDistance: ct.minDistance, maxDistance: ct.maxDistance,
        minPolarAngle: ct.minPolarAngle, maxPolarAngle: ct.maxPolarAngle, controlsEnabled: ct.enabled,
      };
      exteriorLastShipPosition.copy(sp);
    }
    layout();
    localCabinWorld.visible = false;
    ship.visible = true;
    ship.position.set(0, 0, 0);
    ship.scale.setScalar(SHIP_METRIC_SCALE);
    if (!alreadyExterior) {
      resetExteriorCamera(true);
    }
    return true;
  }
  function nearbyMap() {
    if (!userCameraAvailable()) return false;
    if (nearbyMapState) return;
    const previousScale = navigationContext.id, previousContext = contextOverview; contextOverview = false; publishScale('extragalactic'); S.onObjectSelect?.(null); S.onNearbyMapChange?.(true);
    nearbyMapState = {
      scale: previousScale, contextOverview: previousContext,
      camera: cam.position.clone(),
      target: ct.target.clone(),
      enabled: ct.enabled,
      free,
      spectator,
      visibility: sc.children.map((child) => [child, child.visible]),
      minDistance: ct.minDistance,
      maxDistance: ct.maxDistance,
    };
    nav = null;
    tw = null;
    free = false;
    spectator = false;
    localCabinWorld.visible = false;
    ship.visible = false;
    ct.enabled = true;
    S.fr(false);
    S.intro(false);
    S.f(null);
    nearbyMapState.visibility.forEach(([child]) => {
      child.visible = false;
    });
    nearbyGalaxyGroup.visible = true;
    nearbyGalaxyGroup.position.set(0, 0, 0);
    nearbyGalaxyGroup.quaternion.identity();
    syncObserverFirmament({ extragalacticMap: true });
    ct.minDistance = 2;
    ct.maxDistance = 6000;
    const center = new THREE.Vector3();
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: new THREE.Vector3(...atlasCamera.position),
      t1: center,
      k: 0,
    };
    S.onObservationModeChange?.(getObservationMode());
  }
  function returnFromNearbyMap() {
    if (!nearbyMapState) return;
    const saved = nearbyMapState; contextOverview = !!saved.contextOverview; publishScale(saved.scale || 'stellar'); S.onNearbyMapChange?.(false);
    nearbyMapState = null;
    syncObserverFirmament({ extragalacticMap: false });
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: saved.camera,
      t1: saved.target,
      k: 0,
    };
    saved.visibility.forEach(([child, visible]) => {
      child.visible = visible;
    });
    ct.enabled = saved.enabled;
    ct.minDistance = saved.minDistance;
    ct.maxDistance = saved.maxDistance;
    free = saved.free;
    spectator = saved.spectator;
    layout();
    S.fr(saved.free || saved.spectator);
    S.intro(saved.free);
    S.onObservationModeChange?.(getObservationMode());
  }
  function focusNearbyGalaxy(key) {
    if (!nearbyMapState) nearbyMap();
    const marker = nearbyGalaxyMarkers.get(key);
    if (!marker) return;
    nearbySelectedKey = key;
    const target = marker.getWorldPosition(new THREE.Vector3());
    const direction = cam.position.clone().sub(ct.target);
    if (direction.lengthSq() < 1e-8) direction.set(0.18, 0.32, 1);
    direction.normalize();
    const distance = Math.max(25, (marker.userData.symbolRadius || 12) * 5);
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: target.clone().addScaledVector(direction, distance),
      t1: target,
      k: 0,
    };
  }
  function focusSolarSystemMap() { return setNavigationScale('solar'); }
  function cabinOccludes(target) {
    if (!target || !localCabinWorld.visible) return false;
    localCabinWorld.updateMatrixWorld(true);
    localCam.updateMatrixWorld(true);
    const direction = target.clone().sub(cam.position);
    if (direction.lengthSq() < 1e-12) return false;
    const ray = new THREE.Raycaster(localCam.position, direction.normalize(), localCam.near, PHYSICAL_CONSTANTS.CABIN_LENGTH_METERS * 2);
    const meshes = [];
    if (fourDecksInterior?.root) {
      fourDecksInterior.root.traverse((object) => {
        if (object.isMesh) meshes.push(object);
      });
    } else if (cabinSystem?.cabinRoot) {
      cabinSystem.cabinRoot.traverse((object) => {
        if (object.isMesh) meshes.push(object);
      });
    } else {
      localCabinWorld.traverse((object) => {
        if (object.isMesh) meshes.push(object);
      });
    }
    return ray.intersectObjects(meshes, false).some(hit => { let object = hit.object; while (object) { if (!object.visible) return false; object = object.parent; } const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex || 0] : hit.object.material; return material && material.visible !== false && (!material.transparent || (!material.isShaderMaterial && material.opacity >= .6)); });
  }
  function disposeTravelEffect() { hyperspace?.dispose(); hyperspace = null; }
  function cancelTravel() {
    if (nav) { const e = new THREE.Euler().setFromQuaternion(nav.currentQuaternion, 'YXZ'); fy = e.y; fp = e.x; }
    nav = null; disposeTravelEffect(); vel.set(0, 0, 0); releaseInputs(); S.onNavigation?.(null);
  }
  function tripTo(target, clearance, name, b, onArrive, respectSpeed = false, arrivedTarget = null) {
    if (nav || realTimeIntro || launchSequence || launchCameraBlend || cabinReentryBlend) return false;
    if (exteriorCameraMode) leaveExteriorCamera(true);
    sceneDirector.skipActiveSequence(); releaseInputs(); tw = null; vel.set(0, 0, 0); bk = 0; ti = 9;
    activeCabinStation = null; freeHelmMode = false; S.onFreeHelmChange?.(false); arrivalTarget = null;
    astronomicalHologram?.clearHologram();
    const distance = sp.distanceTo(target), long = distance > Math.max(clearance * 3, 0.08);
    const startLocalMeters = localCam.position.lengthSq() > 1e-6
      ? localCam.position.clone().applyQuaternion(ship.quaternion.clone().invert())
      : (pv === 1 ? new V(astronautPos.x, SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS, astronautPos.z) : new V(0.28, 0.16, 1.0).multiplyScalar(shipCameraDistanceMeters()));
    nav = { ...createJumpSequence({ from: sp, target, startQuaternion: ship.quaternion, clearance, durations: jumpDurations, reducedMotion: !!S.reducedMotion?.(), long }), b, name, onArrive, respectSpeed, oldFs: fs, objectKey: activeMissionKey, arrivedTarget: arrivedTarget || (b ? { name, key: b.p?.n || name, type: b.p?.sun ? 'estrella' : 'planeta' } : null), cabinStart: astronautPos.clone(), cabinLookout: new V(0.0, 3.4, -12.6), cameraStartPosition: cam.position.clone(), cameraStartQuaternion: cam.quaternion.clone(), cameraStartLocalOffset: startLocalMeters, cameraStartLocalQuaternion: ship.quaternion.clone().invert().multiply(cam.quaternion) };
    if (long) { disposeTravelEffect(); hyperspace = createHyperspaceEffect({ count: qualityMode === 'performance' ? 440 : 720 }); sc.add(hyperspace.group); }
    S.f(name); S.onNavigation?.({ phase: nav.phase, progress: 0, label: name }); return true;
  }
  function focus(n, k) {
    if (!userCameraAvailable()) return false;
    publishScale('solar');
    tw = null;
    const b = B.find((x) => x.p.n == n);
    if (free) {
      if (!b) {
        nav = null;
        S.f(null);
        return;
      }
      foc = null;
      layout();
      tripTo(
        b.pivot.position.clone(),
        computeSafeOrbitalClearance(b, {
          isCabinActive: pv === 1,
          realScale: isPhysicalObservationActive(),
          physicalScale: isPhysicalObservationActive(),
        }),
        n,
        b,
      );
      return;
    }
    foc = b;
    if (!b) {
      S.f(null);
      return;
    }
    const dir = cam.position.clone().sub(ct.target);
    if (dir.lengthSq() < 1e-12) dir.set(0, 0.3, 1);
    dir.normalize();
    ct.target.copy(b.pivot.position);
    cam.position.copy(b.pivot.position).addScaledVector(dir, b.r * (b.p.sun ? 3 : k || 5));
    ct.minDistance = b.r * 1.3;
    S.f(n);
  }
  function mode(m) {
    if (!userCameraAvailable()) return false;
    if (free) {
      setFree(false);
      S.fr(false);
    }
    localCabinWorld.visible = false;
    ship.visible = false;
    real = m;
    layout();
    ct.target.set(0, 0, 0);
    if (m) {
      cam.position.set(0, 2, 6);
      focus('Tierra');
    } else {
      foc = null;
      S.f(null);
      cam.position.set(0, 90, 230);
    }
    S.onObservationModeChange?.(getObservationMode());
  }
  function fly(p, t = new THREE.Vector3()) {
    tw = {
      p0: cam.position.clone(),
      t0: ct.target.clone(),
      p1: new THREE.Vector3(...p),
      t1: t instanceof THREE.Vector3 ? t.clone() : new THREE.Vector3(...t),
      k: 0,
    };
  }
  function quick(k) {
    if (!userCameraAvailable()) return false;
    if (!free) {
      setFree(true);
      S.fr(true);
      ti = 9;
      S.intro(false);
    }
    if (k === 'orion') {
      publishScale('milkyway');
      gal.updateMatrixWorld(true);
      tripTo(gal.localToWorld(new V(24500, 0, -3500)), 4000, 'Brazo de Orión');
    } else if (k === 'core') {
      publishScale('milkyway');
      tripTo(gal.position.clone(), 6000, 'Centro galáctico');
    } else if (k === 'sunOrbit') {
      tripTo(
        B[0].pivot.position.clone(),
        Math.max(B[0].r * 2.15, isPhysicalObservationActive() ? 1.5 : 9),
        'Órbita próxima al Sol',
      );
    } else if (k === 'asteroids') {
      tripTo(new V(0, 0, Dd(2.7)), Math.max(0.3, isPhysicalObservationActive() ? 2 : 1.2), 'Cinturón de asteroides');
    } else if (k === 'sun') {
      focus('Sol');
    }
  }
  function missionTarget(key, onArrive) {
    if (realTimeIntro || launchSequence || launchCameraBlend || nav) return false;
    if (nearbyMapState) returnFromNearbyMap();
    contextOverview = false; selectedContextStar = null;
    const found = missionMarkers.get(key);
    if (!found) return;
    if (!free) {
      setFree(true);
      S.fr(true);
      ti = 9;
      S.intro(false);
    }
    gal.updateMatrixWorld(true);
    const destination = found.marker.getWorldPosition(new V());
    activeMissionKey = key; publishScale(scaleForTarget(found.target), found.target);
    const canonicalStar = getCanonicalStar(key);
    if (canonicalStar) {
      observerPosPc = { ...canonicalStar.positionPc };
      observerHostGalaxyKey = 'milky-way';
      syncObserverFirmament({ extragalacticMap: false });
    } else if (GALAXY_MORPHOLOGY_METADATA[key]) {
      observerHostGalaxyKey = key;
      syncObserverFirmament({ extragalacticMap: false });
    }
    const isGalaxy = found.target?.type === 'galaxia';
    const travelClearance = Math.max(found.marker.userData.inspectionClearance || 16, isGalaxy ? 24 : 18);
    tripTo(
      destination,
      travelClearance,
      found.target.name,
      null,
      () => {
        found.label.visible = true;
        vel.set(0, 0, 0); fs = 1.0; S.fv(fs);
        if (onArrive) onArrive();
      },
      true,
      found.target,
    );
  }
  function lvl(k) {
    cabinReentryBlend = null;
    if (!userCameraAvailable()) return false;
    publishScale(k >= 3 ? 'milkyway' : k === 2 ? 'stellar' : 'solar');
    ct.maxDistance = 4e5;
    if (free) {
      setFree(false);
      S.fr(false);
    }
    localCabinWorld.visible = false;
    ship.visible = false;
    real = false;
    layout();
    ct.minDistance = 0.0005;
    if (k == 0) {
      focus('Tierra', 9);
      return;
    }
    foc = null;
    S.f(null);
    if (k === 3) {
      const galCenter = new V().fromArray(SOLAR_GALACTIC_ANCHOR).applyQuaternion(gal.quaternion).negate();
      const galCamPos = galCenter.clone().add(new V(0, 62000, 34000).applyQuaternion(gal.quaternion));
      fly(galCamPos.toArray(), galCenter);
      return;
    }
    fly(
      [
        [0, 90, 230],
        [0, 3500, 6000],
        [0, 25000, 50000],
      ][k - 1],
    );
  }
  layout();
  cam.position.set(0, 90, 230);
  const sm = new THREE.MeshStandardMaterial({
    color: 0xcbd9e8,
    metalness: 0.68,
    roughness: 0.28,
    emissive: 0x182c40,
  }),
    em = new THREE.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff6622 }),
    cm = new THREE.MeshStandardMaterial({
      color: 0x70d8ff,
      metalness: 0.36,
      roughness: 0.16,
      emissive: 0x164566,
    }),
    wingMat = new THREE.MeshStandardMaterial({
      color: 0x526a82,
      metalness: 0.7,
      roughness: 0.34,
      emissive: 0x101d2a,
      side: THREE.DoubleSide,
    }),
    sa = (g, m, x, y, z, rx) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, y, z);
      o.rotation.x = rx || 0;
      o.visible = false;
      ship.add(o);
    };
  sa(new THREE.ConeGeometry(0.3, 1, 24), sm, 0, 0, -0.7, -Math.PI / 2);
  sa(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 24), sm, 0, 0, 0.4, Math.PI / 2);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0.08, -0.22);
  wingShape.lineTo(0.3, -0.02);
  wingShape.lineTo(1.13, 0.45);
  wingShape.lineTo(1.06, 0.68);
  wingShape.lineTo(0.34, 0.43);
  wingShape.lineTo(0.27, 0.94);
  wingShape.lineTo(0.06, 0.8);
  wingShape.closePath();
  const wingGeometry = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.065,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.022,
    bevelThickness: 0.018,
  });
  [-1, 1].forEach((direction) => {
    const wing = new THREE.Mesh(wingGeometry, wingMat);
    wing.scale.x = direction;
    wing.rotation.x = Math.PI / 2;
    wing.position.set(0, -0.055, 0.32);
    wing.visible = false;
    ship.add(wing);
  });
  sa(new THREE.BoxGeometry(0.035, 0.022, 0.48), em, -0.76, -0.045, 0.74);
  sa(new THREE.BoxGeometry(0.035, 0.022, 0.48), em, 0.76, -0.045, 0.74);
  sa(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 16), em, -0.4, 0, 1, Math.PI / 2);
  sa(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 16), em, 0.4, 0, 1, Math.PI / 2);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), cm);
  cockpit.scale.set(0.21, 0.17, 0.34);
  cockpit.position.set(0, 0.17, -0.29);
  cockpit.visible = false;
  ship.add(cockpit);
  const cockpitFrame = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.025, 8, 32), sm);
  cockpitFrame.scale.set(1, 0.82, 1.48);
  cockpitFrame.position.set(0, 0.17, -0.29);
  ship.add(cockpitFrame);
  const fl2 = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: B[0].glow.material.map,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const gc = document.createElement('canvas');
  gc.width = gc.height = 64;
  {
    const gg = gc.getContext('2d'),
      gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(120,190,255,.6)');
    gr.addColorStop(1, 'rgba(40,100,255,0)');
    gg.fillStyle = gr;
    gg.fillRect(0, 0, 64, 64);
  }
  const gt = new THREE.CanvasTexture(gc),
    dm = new THREE.MeshStandardMaterial({
      color: 0x2a3140,
      metalness: 0.7,
      roughness: 0.4,
      emissive: 0x151a26,
    }),
    am = new THREE.MeshStandardMaterial({ color: 0xe05a2b, emissive: 0x5a1f0a }),
    FL = [],
    NL = [],
    bm = (c, o) =>
      new THREE.MeshBasicMaterial({
        color: c,
        transparent: true,
        opacity: o,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
  fl2.material.map = gt;
  fl2.position.set(0, 0, 1.5);
  ship.add(fl2);
  sa(new THREE.BoxGeometry(2.24, 0.05, 0.12), am, 0, -0.045, 0.35);
  sa(new THREE.BoxGeometry(0.04, 0.36, 0.3), dm, -1.1, 0.12, 0.62);
  sa(new THREE.BoxGeometry(0.04, 0.36, 0.3), dm, 1.1, 0.12, 0.62);
  sa(new THREE.CylinderGeometry(0.16, 0.24, 0.4, 24, 1, true), dm, 0, -0.02, 1.03, Math.PI / 2);
  const mainEngineRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.035, 8, 32),
    new THREE.MeshStandardMaterial({
      color: 0x87dfff,
      emissive: 0x1d83bc,
      metalness: 0.5,
      roughness: 0.24,
    }),
  );
  mainEngineRim.position.set(0, -0.02, 1.25);
  ship.add(mainEngineRim);
  sa(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), dm, 0, 0.36, 0.45, Math.PI / 2);
  [
    [-0.4, 1.2],
    [0.4, 1.2],
    [0, 1.3],
  ].forEach(([x, z]) => {
    sa(new THREE.CylinderGeometry(0.15, 0.2, 0.22, 16, 1, true), dm, x, 0, z, Math.PI / 2);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1, 16, 1, true), bm(0x4aa8ff, 0.55)),
      k = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1, 12, 1, true), bm(0xffffff, 0.9)),
      g = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
    c.rotation.x = k.rotation.x = Math.PI / 2;
    c.position.set(x, 0, z);
    k.position.set(x, 0, z);
    g.position.set(x, 0, z + 0.05);
    ship.add(c, k, g);
    FL.push({ c, k, g, z });
  });
  [
    [-1.1, 0xff2222],
    [1.1, 0x22ff55],
  ].forEach(([x, c]) => {
    const n = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: c }),
    );
    n.position.set(x, 0.02, 0.55);
    ship.add(n);
    NL.push(n);
  });
  const WN = 480,
    warpStars = Array.from({ length: WN }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.2 + Math.random() * 0.8,
      p: Math.random(),
    }));
  const TRN = 1100,
    tr = pts(new Array(TRN * 3).fill(0), new Array(TRN * 3).fill(0), 3.1, 1),
    TP = tr.geometry.attributes.position.array,
    TC = tr.geometry.attributes.color.array,
    TB = new Float32Array(TRN).fill(-99),
    TS = { i: 0 };
  tr.frustumCulled = false;
  tr.visible = false;
  sc.add(tr);
  ship.name = 'KronoxExteriorShip120m';
  ship.position.set(0, 0, 0);
  ship.scale.setScalar(SHIP_METRIC_SCALE);
  const modularShip = buildModularShip120M();
  modularShip.root.scale.setScalar(2.61 / 120.0);
  ship.add(modularShip.root);
  ship.visible = false;
  // La nave de 120 m vive exclusivamente en el Mundo Local Métrico (`localShipScene`, 1 u = 1 m):
  localShipScene.add(ship);

  // =========================================================================
  // HABITABLE 3D CABIN WORLD (`1 unit = 1 meter`), 1.75m ASTRONAUT & LUMINOUS AI
  // =========================================================================
  const localCabinWorld = new THREE.Group();
  localCabinWorld.name = 'LocalHabitableShipWorld';
  localCabinWorld.position.set(0, 0, 0);
  localCabinWorld.scale.set(1, 1, 1);
  localCabinWorld.visible = false;
  // La cabina de 24 m vive exclusivamente en el Mundo Local Métrico (`localShipScene`, 1 u = 1 m):
  localShipScene.add(localCabinWorld);

  const BRIDGE_SPAWN_POS = new THREE.Vector3(0.0, 3.4, -10.4);
  let activeRepairStage = 0;

  // Cabina y 4 cubiertas unificadas estrictamente dentro del casco de 120m (cero cajas superpuestas):
  const cabinSystem = buildHabitableCabin3D(); // mantenido sin montar para compatibilidad de referencias heredadas
  const fourDecksInterior = buildFourDecksInterior3D();
  localCabinWorld.add(fourDecksInterior.root);

  const toStationVec3 = (pt, fallback = { x: 0, y: 0, z: 0 }) =>
    pt && typeof pt.clone === 'function'
      ? pt.clone()
      : new V(
          Number(pt?.x ?? fallback.x) || 0,
          Number(pt?.y ?? fallback.y) || 0,
          Number(pt?.z ?? fallback.z) || 0,
        );
  const normalizeStationDef = (st) => {
    if (!st) return null;
    const posVec = toStationVec3(st.position);
    return {
      ...st,
      position: posVec,
      consolePos: st.consolePos ? toStationVec3(st.consolePos, posVec) : posVec.clone(),
      aiHoverPos: st.aiHoverPos ? toStationVec3(st.aiHoverPos, posVec) : posVec.clone(),
    };
  };
  const getStationDef = (stationId) => {
    const found =
      SHIP_INTERIOR_STATIONS.find((s) => s.id === stationId) ||
      PHYSICAL_CABIN_STATIONS.find((s) => s.id === stationId) ||
      null;
    return normalizeStationDef(found);
  };

  const astronomicalHologram = createAstronomicalHologramSystem({
    cabinRoot: fourDecksInterior.root,
  });

  const astronaut3D = createAstronautModel3D();
  astronaut3D.root.visible = false;
  astronaut3D.firstPersonHands.visible = false;

  const articulatedAstronaut = createAstronautCharacter3D();
  articulatedAstronaut.root.visible = false;
  localCabinWorld.add(articulatedAstronaut.root);

  const microgravityController = createMicrogravityPhysicsController({
    initialPosition: BRIDGE_SPAWN_POS.clone(),
    mode: MICROGRAVITY_MODES.ASSISTED,
    clampPositionFn: (pos) => fourDecksInterior.clampAstronautPosition(pos),
  });

  const luminousAI = createKronoxCompanionEntity3D({
    initialPosition: new THREE.Vector3(1.55, 5.05, -10.8),
  });
  localCabinWorld.add(luminousAI.group);
  localCabinWorld.add(luminousAI.trailLine);
  localCabinWorld.add(luminousAI.pointingBeam);

  // Machine-Driven 3D Holograms realigned strictly inside the hull Bridge (Z: -51..-42m)
  const machineSystems = buildCabinMachineSystems3D();
  machineSystems.navHoloGroup.position.set(0, 4.45, -8.8);
  machineSystems.aiProjectorGroup.position.set(-2.4, 3.42, -9.8);
  machineSystems.bowReticleGroup.position.set(0, 5.05, -14.8);
  if (machineSystems.sensorSweepGroup) {
    machineSystems.sensorSweepGroup.visible = false;
    machineSystems.sensorSweepGroup.clear();
  }
  localCabinWorld.add(machineSystems.systemsRoot);

  // Thin adapter translating legacy director calls onto the Aurora-120 4-deck interior
  const translateDirectorPoint = (pos) => {
    if (!pos) return null;
    if (pos.z > -15) {
      if (Math.abs(pos.z + 11.5) < 0.8) return new THREE.Vector3(0, 5.05, -12.6);
      if (Math.abs(pos.z + 6.2) < 0.8) return new THREE.Vector3(0, 4.95, -9.2);
      if (pos.x < -3.0) return new THREE.Vector3(-12.2, -1.7, 0.0);
      if (pos.x > 3.0) return new THREE.Vector3(0.0, 5.1, 6.0);
      return new THREE.Vector3(1.55, 5.05, -10.8);
    }
    return pos;
  };
  const directorAiAdapter = {
    ...luminousAI,
    setTargetPosition: (p, st) => luminousAI.setTargetPosition(translateDirectorPoint(p), st),
    pointAtWorldPosition: (p, vis) => luminousAI.pointAtWorldPosition(translateDirectorPoint(p), vis),
  };
  const directorCabinAdapter = {
    ...fourDecksInterior,
    stationMeshes: fourDecksInterior.stationMeshes.map((m) => ({
      ...m,
      updateScreen: (txt) => m.updateScreen?.(txt, [txt], 0),
    })),
  };

  let suppressDirectorNarrative = false;
  const sceneDirector = createKronoxSceneDirector({
    cabinSystem: directorCabinAdapter,
    machineSystems,
    luminousAI: directorAiAdapter,
    onEventCallback: (eventName, payload, directorState) => {
      S.onSceneDirectorEvent?.(eventName, payload, directorState);
    },
    onNarrativeCallback: (text, aiState, stationId, directorState) => {
      if (suppressDirectorNarrative) return;
      S.onAiTourNarrative?.(text, aiState, stationId, directorState);
    },
    onControlModeChange: (controlMode, directorState) => {
      S.onControlModeChange?.(controlMode, directorState);
    },
  });

  // Walkable Astronaut State in Local Meters (`1 unit = 1 m`)
  const astronautPos = BRIDGE_SPAWN_POS.clone();
  const astronautVel = new V(0, 0, 0); // Velocidad 6-DOF sincronizada con microgravityController
  let astronautYaw = 0;
  let astronautPitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let cabinFirstPerson = true; // Exclusivamente en 1ª persona (altura ocular 1.65 m)
  let activeCabinStation = null;
  let shipPoseKnown = false,
    cabinReentryBlend = null;
  let freeHelmMode = false;
  let freeHelmBlend = 0;
  let nearestCabinStation = null;
  let lastNearestStationId = null;
  let lastContextualDeckId = 'deck-01';
  const DECK_SPAWNS = {
    'deck-01': { pos: new V(0.0, 3.4, -10.4), yaw: 0 },
    'deck-02': { pos: new V(0.0, 0.0, -5.2), yaw: Math.PI * 0.85 },
    'deck-03': { pos: new V(0.0, -3.4, 3.2), yaw: Math.PI },
    'deck-04': { pos: new V(2.8, -6.8, -5.0), yaw: 0.35 },
  };
  let deckTransitState = null;

  function buildDeckTransitWaypoints(fromPos, targetDeckId, yawOverride = null) {
    const dest = DECK_SPAWNS[targetDeckId] || DECK_SPAWNS['deck-01'];
    const targetYawFinal = Number.isFinite(yawOverride) ? yawOverride : dest.yaw;
    const pts = [];
    const curY = fromPos.y;
    const curZ = fromPos.z;
    const curDeck = fourDecksInterior?.resolveCurrentDeck?.(fromPos)?.elevationY ?? curY;

    if (Math.abs(curDeck - dest.pos.y) > 1.2) {
      if (curDeck > 2.0 && curZ < -2.2) {
        pts.push(new V(fromPos.x >= 0 ? 3.8 : -3.8, 3.4, -4.0), new V(0, 3.4, -1.9));
      } else if (Math.abs(curDeck) < 0.8 && Math.hypot(fromPos.x, fromPos.z) > 3.6) {
        pts.push(new V(0, 0.0, curZ >= 0 ? 4.2 : -4.2), new V(0, 0.0, curZ >= 0 ? 2.1 : -2.1));
      } else if (curDeck < -5.0 && curZ < -7.0) {
        pts.push(new V(3.0, -6.8, -4.5), new V(0, -6.8, -2.1));
      } else {
        pts.push(new V(0, curDeck, curZ >= 0 ? 2.1 : -2.1));
      }

      pts.push(new V(0, curDeck, 0), new V(0, dest.pos.y, 0));

      if (targetDeckId === 'deck-01') {
        pts.push(new V(0, 3.4, -1.9), new V(3.8, 3.4, -4.0), dest.pos.clone());
      } else if (targetDeckId === 'deck-02') {
        pts.push(new V(0, 0.0, -2.1), new V(0, 0.0, -4.3), dest.pos.clone());
      } else if (targetDeckId === 'deck-04') {
        pts.push(new V(0, -6.8, -2.1), dest.pos.clone());
      } else {
        pts.push(new V(0, dest.pos.y, dest.pos.z >= 0 ? 2.1 : -2.1), dest.pos.clone());
      }
    } else {
      pts.push(dest.pos.clone());
    }

    const filtered = [];
    for (const p of pts) {
      const prev = filtered[filtered.length - 1] || fromPos;
      if (prev.distanceTo(p) > 0.12) filtered.push(p);
    }
    if (filtered.length === 0) filtered.push(dest.pos.clone());
    return {
      active: true,
      targetDeckId,
      targetYaw: targetYawFinal,
      waypoints: filtered,
      index: 0,
      speed: 9.5,
    };
  }
  const DECK_CONTEXT_BRIEFINGS = {
    'deck-01': {
      stationId: 'nav',
      text: 'Cubierta 01 — Puente de Mando. Desde este recinto en punta de flecha gobiernas los ventanales panorámicos, el chevrón de navegación y la mesa holográfica.',
    },
    'deck-02': {
      stationId: 'galley',
      text: 'Cubierta 02 — Habitacional y Esclusa EVA. Ocho camarotes radiales, comedor circular alrededor del núcleo central y esclusa de proa.',
    },
    'deck-03': {
      stationId: 'science',
      text: 'Cubierta 03 — Ingeniería y Laboratorio SPHEREx. Aquí operan el reactor principal, tanques criogénicos, estación SPHEREx y el banco óptico de calibración.',
    },
    'deck-04': {
      stationId: 'hangar',
      text: 'Cubierta 04 — Bodega y Hangar. Contenedores modulares presurizados y el transbordador auxiliar de servicio en proa.',
    },
  };
  function announceDeckContextIfChanged(deckId, immediate = false) {
    if (!deckId || deckId === lastContextualDeckId) return;
    lastContextualDeckId = deckId;
    const entry = DECK_CONTEXT_BRIEFINGS[deckId];
    if (!entry) return;
    if (deckId !== 'deck-01' && guidedTourState) {
      endGuidedCabinTour();
    }
    if (!guidedTourState && !realTimeIntro && !launchSequence) {
      S.onAiTourNarrative?.(entry.text, 'Orientación', entry.stationId, {
        id: `deck-ctx-${deckId}`,
        priority: 8,
        replace: true,
        once: false,
      });
      const targetSt = getStationDef(entry.stationId);
      const interiorSt = fourDecksInterior?.interactiveStations?.find((s) => s.id === entry.stationId);
      const hoverVec = targetSt?.aiHoverPos
        ? targetSt.aiHoverPos.clone()
        : interiorSt
          ? new V(interiorSt.position.x, interiorSt.position.y + 1.65, interiorSt.position.z)
          : null;
      if (hoverVec) {
        if (luminousAI.group?.position?.distanceTo(hoverVec) > 12) {
          luminousAI.group.position.copy(hoverVec);
          luminousAI.resetWake?.(hoverVec);
        }
        luminousAI.setTargetPosition(hoverVec, 'Explicación');
        luminousAI.pointAtWorldPosition(null, false);
      }
    }
  }
  let aiFollowAstronaut = true;
  let aiSpeakingState = false;
  let aiAudioLevelState = 0.08;
  let lastScreenProjectionTime = 0;
  let lastWarpAmount = 0;
  let opticalTelescopeState = {
    enabled: false,
    magnification: 1,
    targetName: null,
  };

  function setOpticalTelescope(arg1 = {}, arg2, arg3) {
    const options =
      typeof arg1 === 'boolean'
        ? { enabled: arg1, magnification: arg2, targetName: arg3 }
        : arg1 || {};
    const nextEnabled =
      options.enabled !== undefined ? Boolean(options.enabled) : !opticalTelescopeState.enabled;
    const requestedMag = Number(options.magnification);
    const nextMag = nextEnabled
      ? Number.isFinite(requestedMag) && requestedMag > 1
        ? requestedMag
        : opticalTelescopeState.magnification > 1
          ? opticalTelescopeState.magnification
          : 50
      : 1;
    const nextTarget =
      options.targetName !== undefined ? options.targetName : opticalTelescopeState.targetName;
    opticalTelescopeState = {
      enabled: nextEnabled && nextMag > 1,
      magnification: nextEnabled ? nextMag : 1,
      targetName: nextTarget || null,
    };
    if (opticalTelescopeState.enabled && opticalTelescopeState.targetName) {
      const targetBody = B.find((x) => x.p.n === opticalTelescopeState.targetName);
      if (targetBody?.pivot && free && !nav) {
        const toTarget = targetBody.pivot.position.clone().sub(sp);
        if (toTarget.lengthSq() > 1e-12) {
          toTarget.normalize();
          if (pv === 1) {
            const localDir = toTarget.clone().applyQuaternion(ship.quaternion.clone().invert());
            targetYaw = astronautYaw = Math.atan2(-localDir.x, -localDir.z);
            targetPitch = astronautPitch = Math.asin(Math.max(-0.95, Math.min(0.95, localDir.y)));
          } else {
            fy = Math.atan2(-toTarget.x, -toTarget.z);
            fp = Math.asin(Math.max(-0.95, Math.min(0.95, toTarget.y)));
          }
        }
      }
    }
    const baseFov = pv === 1 ? Math.min(fovBase, 42) : fovBase;
    // Aumento óptico instrumental puro: modifica el campo visual (FOV) de la cámara astronómica
    // según FOV(M) = 2·arctan(tan(FOV_0/2)/M), sin inflar jamás la malla 3D del planeta:
    const nextFov = opticalTelescopeState.enabled
      ? computeTelescopeFieldOfView(baseFov, opticalTelescopeState.magnification)
      : baseFov;
    cam.fov = nextFov;
    cam.updateProjectionMatrix();
    // La cámara local de la cabina mantiene el FOV humano para el marco físico del puente
    localCam.fov = baseFov;
    localCam.updateProjectionMatrix();
    S.onObservationModeChange?.(getObservationMode());
    return getObservationMode();
  }

  let explicitCloseInspection = false;

  function getObservationMode() {
    let modeDescriptor = OBSERVATION_MODES.NAKED_EYE;
    if (nearbyMapState || contextOverview || (navigationContext.id !== 'solar' && !free)) {
      modeDescriptor = OBSERVATION_MODES.ASTRONOMICAL_MAP;
    } else if (!free && !exteriorCameraMode && !spectator) {
      modeDescriptor = OBSERVATION_MODES.SOLAR_NAVIGATION;
    } else if (opticalTelescopeState.enabled && opticalTelescopeState.magnification > 1) {
      modeDescriptor = OBSERVATION_MODES.OPTICAL_INSTRUMENT;
    } else if (
      explicitCloseInspection ||
      (nearKey && (nearKey !== 'Tierra' || Boolean(arrivalTarget) || exteriorCameraMode || spectator))
    ) {
      modeDescriptor = OBSERVATION_MODES.CLOSE_INSPECTION;
    }
    const targetTelemetry = opticalTelescopeState.targetName
      ? getPlanetaryObservationalTelemetry(opticalTelescopeState.targetName)
      : nearKey
        ? getPlanetaryObservationalTelemetry(nearKey)
        : null;
    return {
      ...modeDescriptor,
      label: modeDescriptor.shortLabel,
      mode: {
        ...modeDescriptor,
        label: modeDescriptor.shortLabel,
      },
      opticalMagnification: opticalTelescopeState.enabled ? opticalTelescopeState.magnification : 1,
      opticalTargetName: opticalTelescopeState.targetName,
      opticalTargetBody: opticalTelescopeState.targetName,
      opticalFieldOfViewDeg: Number(cam.fov.toFixed(4)),
      targetTelemetry,
      realScaleActive: isPhysicalObservationActive(),
      isPhysicalScale: isPhysicalObservationActive(),
      schematicBanner: modeDescriptor.schematicBanner || null,
      travelCompressionActive: Boolean(nav && nav.long),
      travelCompressionBanner:
        nav && nav.long ? OBSERVATION_MODES.CLOSE_INSPECTION.travelCompressionBanner : null,
      epoch: ASTRONOMICAL_REFERENCE_EPOCH,
      shipLengthMeters: SHIP_LENGTH_METERS,
      nearBodyName: nearKey || null,
    };
  }

  function setObservationMode(modeId, options = {}) {
    const normalized = String(modeId || '').toLowerCase();
    if (normalized === 'naked-eye' || normalized === '1' || normalized === 'a') {
      explicitCloseInspection = false;
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      setOpticalTelescope({ enabled: false, magnification: 1 });
      return getObservationMode();
    }
    if (normalized === 'optical-instrument' || normalized === '2' || normalized === 'b') {
      explicitCloseInspection = false;
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      const mag = Number(options.magnification) > 1 ? Number(options.magnification) : 150;
      return setOpticalTelescope({
        enabled: true,
        magnification: mag,
        targetName: options.targetName || opticalTelescopeState.targetName || 'Júpiter',
      });
    }
    if (normalized === 'solar-navigation' || normalized === '3' || normalized === 'c') {
      explicitCloseInspection = false;
      cabinReentryBlend = null;
      setOpticalTelescope({ enabled: false, magnification: 1 });
      setNavigationScale('solar');
      return getObservationMode();
    }
    if (normalized === 'astronomical-map' || normalized === '4' || normalized === 'd') {
      explicitCloseInspection = false;
      cabinReentryBlend = null;
      setOpticalTelescope({ enabled: false, magnification: 1 });
      setNavigationScale(options.scaleId || 'stellar');
      return getObservationMode();
    }
    if (normalized === 'close-inspection' || normalized === '5' || normalized === 'e') {
      explicitCloseInspection = true;
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      setOpticalTelescope({ enabled: false, magnification: 1 });
      if (options.targetName) {
        focus(options.targetName);
      }
      S.onObservationModeChange?.(getObservationMode());
      return getObservationMode();
    }
    return getObservationMode();
  }

  function getPlanetaryObservationalTelemetry(planetName = null) {
    if (planetName) {
      const found = B.find((x) => x.p.n === planetName);
      if (!found) return null;
      return {
        ...found.observationalMetrics,
        sceneRadiusUnits: found.r,
        meshScaleUnits: found.tilt?.scale?.x ?? found.r,
        heliocentricScenePosition: found.pivot?.position?.toArray() || [0, 0, 0],
        heliocentricScene64: found.heliocentricScene64
          ? Array.from(found.heliocentricScene64)
          : null,
      };
    }
    const result = {};
    B.forEach((b) => {
      if (b.observationalMetrics) {
        result[b.p.n] = {
          ...b.observationalMetrics,
          sceneRadiusUnits: b.r,
          meshScaleUnits: b.tilt?.scale?.x ?? b.r,
        };
      }
    });
    return result;
  }

  function getShipPhysicalSpecs() {
    const bounds = collectExteriorShipBounds();
    return {
      lengthMeters: SHIP_LENGTH_METERS,
      cabinLengthMeters: PHYSICAL_CONSTANTS.CABIN_LENGTH_METERS,
      cabinWidthMeters: PHYSICAL_CONSTANTS.CABIN_WIDTH_METERS,
      cabinHeightMeters: PHYSICAL_CONSTANTS.CABIN_HEIGHT_METERS,
      astronautHeightMeters: PHYSICAL_CONSTANTS.ASTRONAUT_HEIGHT_METERS,
      astronautEyeHeightMeters: PHYSICAL_CONSTANTS.ASTRONAUT_EYE_HEIGHT_METERS,
      modelUnits: SHIP_MODEL_LENGTH,
      sceneScale: SHIP_METRIC_SCALE,
      localMetricScale: SHIP_METRIC_SCALE,
      hullDimensionsMeters: bounds.hullDimensionsMeters,
      boundingSphereRadiusMeters: Number(bounds.sphere.radius.toFixed(2)),
      shipVisible: ship.visible,
      cabinVisible: localCabinWorld.visible,
      exteriorCameraMode,
      localWorldName: localShipScene.name,
      astronomicalWorldName: sc.name,
      shipParentScene: ship.parent?.name || null,
      cabinParentScene: localCabinWorld.parent?.name || null,
      epoch: ASTRONOMICAL_REFERENCE_EPOCH,
    };
  }

  function getDualWorldArchitectureState() {
    const shipBounds = collectExteriorShipBounds();
    const cabinBox = new THREE.Box3().setFromObject(fourDecksInterior?.root || cabinSystem.cabinRoot);
    const cabinSize = cabinBox.getSize(new THREE.Vector3());
    return {
      worlds: WORLD_COORDINATE_SYSTEMS,
      localWorld: {
        sceneName: localShipScene.name,
        unitMeters: 1.0,
        shipInLocalScene: ship.parent === localShipScene,
        cabinInLocalScene: localCabinWorld.parent === localShipScene,
        shipInAstronomicalScene: ship.parent === sc,
        cabinInAstronomicalScene: localCabinWorld.parent === sc,
        shipPositionLocalMeters: ship.position.toArray(),
        cabinPositionLocalMeters: localCabinWorld.position.toArray(),
        shipHullDimensionsMeters: shipBounds.hullDimensionsMeters,
        cabinBoundingSizeMeters: {
          widthMeters: Number(cabinSize.x.toFixed(2)),
          heightMeters: Number(cabinSize.y.toFixed(2)),
          lengthMeters: Number(cabinSize.z.toFixed(2)),
        },
        localCameraPositionMeters: localCam.position.toArray(),
        localCameraNearMeters: localCam.near,
        localCameraFarMeters: localCam.far,
      },
      astronomicalWorld: {
        sceneName: sc.name,
        isPhysicalScale: isPhysicalObservationActive(),
        unitKm: isPhysicalObservationActive() ? PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_KM : null,
        unitMeters: isPhysicalObservationActive()
          ? PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_METERS
          : null,
        shipHeliocentricScenePosition: sp.toArray(),
        astroCameraPosition: cam.position.toArray(),
        astroCameraNear: cam.near,
        astroCameraFar: cam.far,
        originRebase: originRebaseState,
      },
      catalogNotes: CATALOG_DOCUMENTATION_NOTES,
    };
  }

  /**
   * Alinea de forma coherente la posición y orientación de la nave exterior (120 m)
   * y de la cabina interior en primera persona en el plano orbital horizontal de la Tierra.
   * Garantiza fp = 0 (horizonte nivelado sin inclinación de 90°) y dirección frontal (-Z) idéntica.
   */
  function alignShipInEarthOrbit() {
    layout();
    shipSz = shipScale();
    const earthPos = earth?.pivot ? earth.pivot.position.clone() : new V(Dd(1), 0, 0);
    const radial = new V(earthPos.x, 0, earthPos.z);
    if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
    else radial.normalize();
    const tangent = new V(-radial.z, 0, radial.x).normalize();
    // En el Mundo Astronómico Físico (`1 u = 10^6 km`, `earth.r = 0.006371 u = 6,371 km`),
    // estacionamos la nave en órbita física segura (`2.35 * R_Tierra ≈ 14,972 km` del centro terrestre,
    // es decir ~8,601 km de altitud sobre la superficie), donde la Tierra subtiende ~46° en el mirador
    // sin invadir jamás la cabina de 24 m ni el casco de 120 m:
    const standOff = isPhysicalObservationActive()
      ? earth
        ? earth.r * 2.35
        : 0.015
      : earth
        ? Math.max(earth.r * 3.5 + 28, Dm() * 1.35)
        : 36;

    sp.copy(earthPos)
      .addScaledVector(radial, standOff * 0.85)
      .addScaledVector(tangent, -standOff * 0.72);
    sp.y = earthPos.y;

    const forward = earthPos
      .clone()
      .addScaledVector(radial, standOff * 0.22)
      .addScaledVector(tangent, standOff * 0.95)
      .sub(sp);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    else forward.normalize();

    fy = Math.atan2(-forward.x, -forward.z);
    fp = 0;
    bk = 0;

    const qLevel = new THREE.Quaternion().setFromEuler(new THREE.Euler(fp, fy, 0, 'YXZ'));
    ship.position.set(0, 0, 0);
    ship.scale.setScalar(SHIP_METRIC_SCALE);
    ship.quaternion.copy(qLevel);
    localCabinWorld.position.set(0, 0, 0);
    localCabinWorld.scale.set(1, 1, 1);
    localCabinWorld.quaternion.copy(qLevel);

    astronautPos.copy(BRIDGE_SPAWN_POS);
    astronautVel.set(0, 0, 0);
    microgravityController.setPosition(astronautPos);
    astronautYaw = 0;
    astronautPitch = 0;
    targetYaw = 0;
    targetPitch = 0;
    cabinFirstPerson = true;
    astronaut3D.root.visible = false;
    astronaut3D.firstPersonHands.visible = false;
    articulatedAstronaut.root.visible = false;
    shipPoseKnown = true;
    return qLevel;
  }

  function occupyNavigationSeat() {
    const station = getStationDef('nav');
    if (!station) return;
    if (!free) {
      setFree(true, false);
      S.fr?.(true);
    }
    pv = 1;
    cabinFirstPerson = true;
    astronaut3D.root.visible = false;
    astronaut3D.firstPersonHands.visible = false;
    articulatedAstronaut.root.visible = false;
    luminousAI.pointAtWorldPosition(null, false);
    ship.visible = false;
    localCabinWorld.visible = true;
    astronautPos.copy(station.position);
    astronautVel.set(0, 0, 0);
    microgravityController.setPosition(astronautPos);
    const dx = station.consolePos.x - station.position.x;
    const dz = station.consolePos.z - station.position.z;
    astronautYaw = Math.atan2(-dx, -dz);
    targetYaw = astronautYaw;
    astronautPitch = -0.04;
    targetPitch = -0.04;
    activeCabinStation = 'nav';
  }

  // Real-time 3D Cinematic Intro Spline State (Section 2)
  let realTimeIntro = null;
  let realTimeIntroPaused = false;
  let mainMenuOrbitActive = false;
  let mainMenuOrbitAngle = 0.62;
  let introCompletedNaturally = false;
  const _introTmpVec = new V();
  const _introTmpLook = new V();
  const _introTmpUp = new V(0, 1, 0);
  const _introTmpMat = new THREE.Matrix4();
  const _introOrigin = new V(0, 0, 0);

  function setShipOrientationFromForward(targetQuat, fwdDir, bankRad = 0) {
    const dir = fwdDir.clone();
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
    else dir.normalize();
    _introTmpMat.lookAt(_introOrigin, dir, _introTmpUp);
    targetQuat.setFromRotationMatrix(_introTmpMat);
    const eul = new THREE.Euler().setFromQuaternion(targetQuat, 'YXZ');
    fy = eul.y;
    fp = eul.x;
    bk = bankRad;
  }

  function snapCompanionTo(x, y, z, mood, aimAt = null) {
    const pos = new V(x, y, z);
    luminousAI.group.position.copy(pos);
    luminousAI.setTargetPosition(pos, mood);
    luminousAI.resetWake(pos);
    luminousAI.pointAtWorldPosition(aimAt, Boolean(aimAt));
  }

  function buildIntroCurve(pts) {
    return new THREE.CatmullRomCurve3(
      pts.map(([x, y, z]) => new V(x, y, z)),
      false,
      'catmullrom',
      0.35,
    );
  }

  const INTRO_CURVES = {
    extPos: buildIntroCurve([
      [122, 32, -96],
      [132, 16, 22],
      [92, 28, 114],
      [-86, 22, 92],
      [6.2, 5.3, -24.5],
    ]),
    extLook: buildIntroCurve([
      [0, 1.5, -8],
      [0, 0.5, 4],
      [0, 1.0, 6],
      [0, 1.5, -6],
      [0, 4.85, -14.2],
    ]),
    bridgePos: buildIntroCurve([
      [4.8, 5.68, -5.8],
      [3.6, 5.65, -11.4],
      [-3.4, 5.65, -11.6],
      [-4.6, 5.68, -5.8],
    ]),
    bridgeLook: buildIntroCurve([
      [0.2, 4.45, -10.2],
      [0.2, 4.45, -9.8],
      [0.2, 4.45, -9.8],
      [0.2, 4.5, -10.2],
    ]),
    spherexPos: buildIntroCurve([
      [-9.6, -1.5, -2.6],
      [-6.8, -1.45, -5.4],
      [0.0, -1.4, -5.8],
      [6.8, -1.45, -5.2],
      [9.6, -1.5, -2.6],
    ]),
    spherexLook: buildIntroCurve([
      [-13.4, -2.15, 0.0],
      [-13.4, -2.15, 0.0],
      [0.0, -2.0, 6.0],
      [13.6, -1.95, 0.0],
      [14.0, -1.95, 0.0],
    ]),
    habitatPos: buildIntroCurve([
      [6.6, 1.95, -3.2],
      [3.8, 1.95, -5.4],
      [-3.6, 1.95, -5.6],
      [-6.4, 1.95, -3.0],
    ]),
    habitatLook: buildIntroCurve([
      [1.8, 0.72, -3.0],
      [0.6, 0.75, -3.6],
      [-0.6, 0.75, -3.8],
      [-1.8, 0.72, -3.2],
    ]),
    engPos: buildIntroCurve([
      [5.2, -1.45, 2.0],
      [3.2, -1.4, 3.1],
      [-3.2, -1.4, 3.1],
      [-5.2, -1.45, 2.0],
      [0.0, -1.55, 2.4],
    ]),
    engLook: buildIntroCurve([
      [0.0, -2.05, 6.2],
      [0.0, -1.95, 6.8],
      [0.0, -1.95, 6.8],
      [0.0, -2.05, 6.2],
      [0.0, -1.95, 6.6],
    ]),
  };
  // Guided In-World Tour State (Section 6)
  let guidedTourState = null;
  const tourNarratives = {
    nav: 'Esta es la consola de navegación. Desde aquí podemos seleccionar los destinos de nuestra exploración.',
    science: 'Aquí comienza la investigación SPHEREx. Explora una observación real y compara sus épocas infrarrojas.',
    missions: 'En la consola de misiones puedes revisar y elegir objetivos para la expedición.',
    comms: 'Esta consola abre el canal de comunicaciones de la nave.',
    windows: 'El mirador panorámico permite observar el sistema desde la nave.',
  };

  function setTourStep(step, stationId = null) {
    if (!guidedTourState || guidedTourState.step === 'free') return;
    guidedTourState.step = step;
    guidedTourState.focus = stationId;
    guidedTourState.proximityAnnounced = false;
    S.onGuideStateChange?.({ step, stationId, active: true });
    const objectives = {
      bridge: 'OBJETIVO: Explora el puente de mando. Muévete libremente con WASD.',
      nav: 'OBJETIVO: Acércate a la consola de navegación y úsala con E.',
      science: 'OBJETIVO: En SPHEREx, abre una observación y cambia de etapa o registra un hallazgo.',
      missions: 'OBJETIVO: Interactúa con la consola de misiones.',
      comms: 'OBJETIVO: Interactúa con la consola de comunicaciones.',
      windows: 'OBJETIVO: Acércate al mirador o interactúa con él.',
    };
    if (objectives[step]) S.onGuideObjective?.(objectives[step]);
    if (stationId) {
      const station = getStationDef(stationId);
      if (station) {
        luminousAI.setTargetPosition(station.aiHoverPos, 'Señalización');
        luminousAI.pointAtWorldPosition(station.consolePos, true);
      }
    }
  }

  function onGuidedStationInteraction(stationId) {
    if (!guidedTourState || guidedTourState.step === 'free' || !stationId) return;
    const expected = guidedTourState.focus;
    if (stationId !== expected) return;
    if (stationId === 'nav') {
      S.onAiTourNarrative?.('Perfecto. Ahora seleccionemos nuestro primer destino.', 'Confirmación', 'nav');
      setTourStep('science', 'science');
    } else if (stationId === 'science') {
      // The scientific step completes only after the mission UI reports a real user action.
      guidedTourState.scienceInteracted = true;
    } else if (stationId === 'missions') {
      setTourStep('comms', 'comms');
    } else if (stationId === 'comms') {
      setTourStep('windows', 'windows');
    } else if (stationId === 'windows') {
      S.onAiTourNarrative?.('Recorrido completado. La cabina queda en modo de exploración libre.', 'Acompañamiento', 'windows');
      guidedTourState.step = 'free';
      guidedTourState.focus = null;
      aiFollowAstronaut = true;
      luminousAI.pointAtWorldPosition(null, false);
      S.onGuideStateChange?.({ step: 'free', stationId: null, active: false });
    }
  }

  function onGuidedScienceAction() {
    if (guidedTourState?.step !== 'science' || !guidedTourState.scienceInteracted) return;
    setTourStep('missions', 'missions');
  }

  function endGuidedCabinTour() {
    if (!guidedTourState) return;
    guidedTourState = null;
    aiFollowAstronaut = true;
    luminousAI.pointAtWorldPosition(null, false);
    S.onGuideStateChange?.({ step: 'free', stationId: null, active: false });
  }

  function startRealTimeIntroSequence(onCompleteCallback) {
    cancelTravel(); if (nearbyMapState) returnFromNearbyMap(); contextOverview = false;
    publishScale('solar');
    // Cancel any incompatible active sequences so two sequences never run simultaneously (Section 4)
    sceneDirector.skipActiveSequence();
    nav = null;
    launchSequence = null;
    launchCameraBlend = null;
    guidedTourState = null;
    introCompletedNaturally = false;

    releaseInputs(); vel.set(0, 0, 0); activeCabinStation = null; freeHelmMode = false;
    spectator = false;
    free = true;
    ct.enabled = false;
    foc = null;
    S.f?.(null);
    tw = null;
    alignShipInEarthOrbit();
    fs = Math.max(0.05, earth ? earth.r * 0.45 : 0.2);
    S.fv?.(fs);
    S.fr?.(true);
    S.intro?.(true);
    ti = 9;
    TB.fill(-99);
    tr.visible = false;

    pv = 3;
    cabinFirstPerson = true;
    astronaut3D.root.visible = false;
    astronaut3D.firstPersonHands.visible = false;
    ship.visible = false;
    localCabinWorld.visible = false;
    cam.near = 0.0005;
    cam.fov = fovBase;
    cam.updateProjectionMatrix();
    localCam.near = 0.05;
    localCam.fov = fovBase;
    localCam.updateProjectionMatrix();

    cabinReentryBlend = null;
    mainMenuOrbitActive = false;
    realTimeIntroPaused = false;
    const isReduced = Boolean(S.reducedMotion?.());
    const isTestHarness = Boolean(globalThis.__KRONOX_SCENE_HARNESS__);
    realTimeIntro = {
      phase: 'opening',
      openingDuration: isReduced ? 0.6 : isTestHarness ? 3.2 : 6.0,
      elapsed: 0,
      stageElapsed: 0,
      duration: isReduced ? 1.8 : isTestHarness ? 23.0 : 44.0,
      stageNotified: 0,
      cameraHandoff: null,
      boardingFrom: null,
      boardingQuaternion: null,
      onComplete: onCompleteCallback,
    };
    S.onIntroStageChange?.(
      'opening',
      'Durante siglos, contemplamos el universo desde un pequeño mundo azul, buscando respuestas sobre nuestro origen entre millones de estrellas.',
    );
  }

  function skipRealTimeIntroSequence() {
    cancelTravel();
    const wasInIntro = Boolean(realTimeIntro);
    const cb = realTimeIntro?.onComplete;
    releaseInputs(); vel.set(0, 0, 0); activeCabinStation = null; freeHelmMode = false;
    realTimeIntro = null;
    realTimeIntroPaused = false;
    mainMenuOrbitActive = false;
    launchSequence = null;
    launchCameraBlend = null;
    sceneDirector.skipActiveSequence();
    if (earth?.spherex) {
      earth.spherex.spectralScanGroup.visible = false;
      earth.spherex.root.scale.setScalar(0.052);
    }
    if (!free) {
      setFree(true, false);
      S.fr?.(true);
    } else {
      layout();
    }
    if (wasInIntro || !shipPoseKnown || Math.abs(fp) > 1.15) {
      alignShipInEarthOrbit();
    } else {
      astronautPos.copy(BRIDGE_SPAWN_POS);
      astronautVel.set(0, 0, 0);
      microgravityController.setPosition(astronautPos);
      astronautYaw = 0;
      astronautPitch = 0;
      targetYaw = 0;
      targetPitch = 0;
    }
    pv = 1;
    cabinFirstPerson = true;
    astronaut3D.root.visible = false;
    astronaut3D.firstPersonHands.visible = false;
    articulatedAstronaut.root.visible = false;
    luminousAI.pointAtWorldPosition(null, false);
    ship.visible = false;
    localCabinWorld.visible = true;
    const cabinBaseFov = Math.min(fovBase, 42);
    cam.near = 0.0005;
    cam.fov = opticalTelescopeState.enabled
      ? computeTelescopeFieldOfView(cabinBaseFov, opticalTelescopeState.magnification)
      : cabinBaseFov;
    cam.updateProjectionMatrix();
    localCam.near = 0.05;
    localCam.far = 4000;
    localCam.fov = cabinBaseFov;
    localCam.updateProjectionMatrix();

    const qNow = new THREE.Quaternion().setFromEuler(new THREE.Euler(fp, fy, 0, 'YXZ'));
    ship.position.set(0, 0, 0);
    ship.scale.setScalar(SHIP_METRIC_SCALE);
    ship.quaternion.copy(qNow);
    localCabinWorld.position.set(0, 0, 0);
    localCabinWorld.scale.set(1, 1, 1);
    localCabinWorld.quaternion.copy(qNow);
    const localEye = new V(
      astronautPos.x,
      astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS,
      astronautPos.z,
    ).applyQuaternion(qNow);
    localCam.position.copy(localEye);
    localCam.quaternion.copy(qNow);
    cam.position.copy(sp).addScaledVector(localEye, metersToAstroSceneUnits());
    cam.quaternion.copy(qNow);

    suppressDirectorNarrative = true;
    sceneDirector.dispatchEvent('CABIN_ENTERED', {});
    sceneDirector.dispatchEvent('AI_ACTIVATED', {});
    suppressDirectorNarrative = false;
    if (cb) cb();
    introCompletedNaturally = true;
    startGuidedCabinTour();
    S.onObservationModeChange?.(getObservationMode());
  }

  function startGuidedCabinTour() {
    guidedTourState = {
      step: 'bridge',
      focus: null,
      proximityAnnounced: false,
      scienceInteracted: false,
    };
    aiFollowAstronaut = true;
    lastContextualDeckId = 'deck-01';
    S.onGuideStateChange?.({ step: 'bridge', stationId: null, active: true });
    S.onGuideObjective?.('OBJETIVO: Explora el puente de mando (WASD). Usa [E] en cada consola o avanza por la espina a C02-C04.');
    S.onAiTourNarrative?.(
      DECK_CONTEXT_BRIEFINGS['deck-01'].text,
      'Orientación',
      'nav',
      { id: 'deck-ctx-deck-01', priority: 8, replace: true },
    );
  }

  function onGuidedNarrativeComplete(messageId) {
    if (guidedTourState?.step === 'welcome' && messageId === guidedTourState.welcomeMessageId) {
      setTourStep('bridge', null);
      S.onGuideObjective?.('OBJETIVO: Explora el puente de mando. Muévete libremente con WASD.');
    }
  }
  function setFree(on, launchFromEarth = false) {
    if (!on && exteriorCameraMode) leaveExteriorCamera(true);
    spectator = false;
    free = on;
    layout();
    ct.enabled = !on && !exteriorCameraMode;
    if (on) {
      foc = null;
      S.f(null);
      tw = null;
      launchSequence = null;
      launchCameraBlend = null;
      if (launchFromEarth) nav = null;
      if (launchFromEarth && earth) {
        const qLevel = alignShipInEarthOrbit();
        const chaseMeters = new V(0.28, 0.16, 1.0)
          .multiplyScalar(shipCameraDistanceMeters())
          .applyQuaternion(qLevel);
        localCam.position.copy(chaseMeters);
        localCam.quaternion.copy(qLevel);
        cam.position.copy(sp).addScaledVector(chaseMeters, metersToAstroSceneUnits());
        cam.quaternion.copy(qLevel);
      } else if (earth && (!shipPoseKnown || cam.position.length() > Dd(earth.p.au) * 2.5)) {
        const qLevel = alignShipInEarthOrbit();
        const chaseMeters = new V(0.28, 0.16, 1.0)
          .multiplyScalar(shipCameraDistanceMeters())
          .applyQuaternion(qLevel);
        localCam.position.copy(chaseMeters);
        localCam.quaternion.copy(qLevel);
        cam.position.copy(sp).addScaledVector(chaseMeters, metersToAstroSceneUnits());
        cam.quaternion.copy(qLevel);
      } else if (!shipPoseKnown) {
        sp.copy(cam.position);
        const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
        fy = e.y;
        fp = e.x;
      }
      shipPoseKnown = true;
      shipSz = shipScale();
      fs = launchFromEarth
        ? Math.max(0.05, earth ? earth.r * 0.45 : 0.2)
        : Math.max(0.01, Math.min(5e4, cam.position.distanceTo(ct.target) * 0.4));
      S.fv(fs);
      ti = 9; // Eliminar el temporizador artificial ti < 2.6 que ocultaba la nave exterior
      vel.set(0, 0, 0);
      TB.fill(-99);
      tr.visible = true;
      S.intro(true);
    } else {
      launchSequence = null;
      launchCameraBlend = null;
      localCabinWorld.visible = false;
      ship.visible = false;
      tr.visible = false;
      S.intro(false);
      const f = new V();
      cam.getWorldDirection(f);
      ct.target.copy(cam.position).addScaledVector(f, Math.max(1, cam.position.length() * 0.1));
    }
    S.onObservationModeChange?.(getObservationMode());
  }
  function spectate() {
    if (!userCameraAvailable()) return false;
    leaveExteriorCamera(false);
    let q;
    if (free) q = ship.quaternion.clone();
    else {
      setFree(true);
      q = cam.quaternion.clone();
    }
    spectator = true;
    free = false;
    layout();
    ct.enabled = true;
    foc = null;
    tw = null;
    nav = null;
    vel.set(0, 0, 0);
    S.f(null);
    S.fr(false);
    S.intro(false);
    localCabinWorld.visible = false;
    tr.visible = false;
    ship.position.set(0, 0, 0);
    ship.scale.setScalar(SHIP_METRIC_SCALE);
    ship.quaternion.copy(q);
    ship.visible = true;
    const dMeters = shipCameraDistanceMeters(),
      offsetMeters = new V(1, 0.55, 2).normalize().applyQuaternion(q).multiplyScalar(dMeters);
    ct.target.copy(sp);
    cam.position.copy(sp).add(offsetMeters);
    cam.lookAt(sp);
    localCam.position.copy(offsetMeters);
    localCam.lookAt(0, 0, 0);
    ct.update();
  }
  function board() {
    if (!spectator) return;
    spectator = false;
    free = true;
    layout();
    ct.enabled = false;
    foc = null;
    tw = null;
    nav = null;
    S.f(null);
    S.fr(true);
    S.intro(false);
    vel.set(0, 0, 0);
    const q = ship.quaternion.clone(),
      e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    fy = e.y;
    fp = e.x;
    ti = 9;
    tr.visible = true;
    ship.visible = pv == 3;
    localCabinWorld.visible = pv == 1;
    const localOffMeters =
      pv == 3
        ? new V(0.28, 0.16, 1.0).multiplyScalar(shipCameraDistanceMeters()).applyQuaternion(q)
        : new V(astronautPos.x, astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS, astronautPos.z).applyQuaternion(q);
    localCam.position.copy(localOffMeters);
    localCam.quaternion.copy(q);
    cam.quaternion.copy(q);
    cam.position.copy(sp).addScaledVector(localOffMeters, metersToAstroSceneUnits());
  }
  function exitSpectator() {
    if (!spectator) return;
    spectator = false;
    free = false;
    layout();
    localCabinWorld.visible = false;
    ship.visible = false;
    ct.enabled = true;
    ct.target.copy(sp);
    tr.visible = false;
    S.fr(false);
    S.intro(false);
    S.f(null);
  }
  function jump(k) {
    if (exteriorCameraMode) leaveExteriorCamera(true);
    if (!free) {
      setFree(true);
      S.fr(true);
    }
    tw = null;
    foc = null;
    S.f(null);
    const o = [
      [0, 9e4, 4e4],
      [0, 2500, 14000],
      [0, 0, 0],
    ][k],
      g = gal.position;
    if (k == 2) cam.position.set(0, 4, 14);
    else cam.position.copy(new V(...o).applyQuaternion(gal.quaternion).add(g));
    cam.lookAt(k == 2 ? new V() : g);
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ');
    fy = e.y;
    fp = e.x;
    sp.copy(cam.position);
    shipSz = shipScale();
    fs = [3000, 300, 30][k];
    S.fv(fs);
  }
  function inspectExterior() {
    if (!userCameraAvailable()) return false;
    if (!free) {
      setFree(true, false);
      S.fr(true);
    }
    pv = 3;
    ti = 9;
    enterExteriorCamera();
    resetExteriorCamera(true);
    return true;
  }
  let speedNoticeTimer;
  let pointerClickStart = null;
  const onPointerDown = (e) => {
    pointerClickStart = { x: e.clientX, y: e.clientY };
    if (nearbyMapState) nearbyPointerStart = { x: e.clientX, y: e.clientY };
    if (free && !exteriorCameraMode) {
      drag = 1;
      dom.setPointerCapture(e.pointerId);
    }
  };
  const onPointerUp = (e) => {
    drag = 0;
    const clickMoved = pointerClickStart
      ? Math.hypot(e.clientX - pointerClickStart.x, e.clientY - pointerClickStart.y)
      : 999;
    pointerClickStart = null;
    if (nearbyMapState && nearbyPointerStart) {
      const moved = Math.hypot(e.clientX - nearbyPointerStart.x, e.clientY - nearbyPointerStart.y);
      nearbyPointerStart = null;
      if (moved < 6) {
        const rect = dom.getBoundingClientRect();
        nearbyPointer.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        nearbyRaycaster.setFromCamera(nearbyPointer, cam);
        const hits = nearbyRaycaster.intersectObjects(
          [...nearbyGalaxyMarkers.values()].flatMap((g) => g.children),
          true,
        );
        const key = hits
          .map((hit) => {
            let node = hit.object;
            while (node && !node.userData.nearbyGalaxyKey) node = node.parent;
            return node?.userData.nearbyGalaxyKey;
          })
          .find(Boolean);
        if (key) {
          focusNearbyGalaxy(key);
          S.onNearbyGalaxySelect?.(key);
        }
      }
      return;
    }
    if (contextOverview && clickMoved < 6) { const rect = dom.getBoundingClientRect(); nearbyPointer.set((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2); nearbyRaycaster.setFromCamera(nearbyPointer, cam); const atlas = navigationContext.id === 'stellar' ? stellarAtlas : regionalAtlas; const hit = nearbyRaycaster.intersectObjects([...atlas.markers.values()].map(e => e.marker), true).find(h => h.object.userData.catalogStarKey); if (hit) focusContextStar(hit.object.userData.catalogStarKey); return; }
    // Interacción con consolas físicas 3D dentro de la cabina habitable en el Mundo Local (`localCam`, 1 u = 1 m)
    if (clickMoved < 6 && !nearbyMapState && free && pv == 1 && !realTimeIntro) {
      const rect = dom.getBoundingClientRect();
      nearbyPointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      localCabinWorld.updateMatrixWorld(true);
      localCam.updateMatrixWorld(true);
      nearbyRaycaster.setFromCamera(nearbyPointer, localCam);
      const stationNodes = fourDecksInterior.stationMeshes.map((s) => s.group);
      const stHits = nearbyRaycaster.intersectObjects(stationNodes, true);
      if (stHits.length > 0) {
        let node = stHits[0].object;
        while (node && !node.userData?.stationId) node = node.parent;
        if (node?.userData?.stationId) {
          const stId = node.userData.stationId;
          if (stId === 'nav') occupyNavigationSeat();
          else activeCabinStation = stId;
          const stObj = getStationDef(stId);
          if (stObj) {
            aiFollowAstronaut = false;
            luminousAI.setTargetPosition(stObj.aiHoverPos, 'Explicación');
            luminousAI.pointAtWorldPosition(stObj.consolePos, true);
          }
          if (stId === 'nav') sceneDirector.dispatchEvent('NAVIGATION_SELECTED', {});
          else if (stId === 'science') sceneDirector.dispatchEvent('SCIENTIFIC_SCAN_STARTED', {});
          else if (stId === 'missions') sceneDirector.dispatchEvent('MISSION_ACTIVATED', {});
          else if (stId === 'comms') sceneDirector.dispatchEvent('AI_ACTIVATED', {});
          else if (stId === 'sensor-calibration') {
            activeRepairStage = Math.max(1, activeRepairStage);
            sceneDirector.dispatchEvent('MISSION_ACTIVATED', {});
          }
          S.onStationInteract?.(stId);
          return;
        }
      }
    }
    // Bloque 3: Selección interactiva de objetos astronómicos en el universo 3D
    if (clickMoved < 6 && !nearbyMapState) {
      const rect = dom.getBoundingClientRect();
      nearbyPointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      nearbyRaycaster.setFromCamera(nearbyPointer, cam);
      const starNodes = [...missionMarkers.values()].map((m) => m.marker);
      const planetNodes = B.map((b) => b.pivot);
      const hits = nearbyRaycaster.intersectObjects([...starNodes, ...planetNodes], true);
      for (const hit of hits) {
        let node = hit.object;
        while (node) {
          if (node.userData?.spherexTargetKey) {
            const key = node.userData.spherexTargetKey;
            const found = missionMarkers.get(key);
            if (found) found.label.visible = true;
            S.onObjectSelect?.({ kind: 'spherex', key });
            return;
          }
          if (node.userData?.planetName) {
            const name = node.userData.planetName;
            S.onObjectSelect?.({ kind: 'planet', key: name });
            return;
          }
          node = node.parent;
        }
      }
    }
  };
  const onPointerMove = (e) => {
    if (free && !nav && !exteriorCameraMode && drag && !launchSequence && !launchCameraBlend && !realTimeIntro) {
      if (pv == 1) {
        // Suavizado cinemático de rotación de cabeza/casco de astronauta
        targetYaw -= e.movementX * 0.0024;
        targetPitch = Math.max(-1.18, Math.min(1.18, targetPitch - e.movementY * 0.0022));
      } else {
        fy -= e.movementX * 0.003;
        fp = Math.max(-1.55, Math.min(1.55, fp - e.movementY * 0.003));
        yw = Math.max(-80, Math.min(80, yw + e.movementX));
        yp = Math.max(-80, Math.min(80, yp + e.movementY));
      }
    }
  };
  const onWheel = (e) => {
    if (free && !exteriorCameraMode) {
      e.preventDefault();
      if (pv == 3) {
        shipZoom = Math.max(0.55, Math.min(8, shipZoom * (e.deltaY < 0 ? 0.85 : 1.18)));
      } else {
        fs = Math.max(0.01, Math.min(5e4, fs * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
        S.fv(fs);
        clearTimeout(speedNoticeTimer);
        speedNoticeTimer = setTimeout(() => S.speedNotice(fs), 700);
      }
    }
  };
  const releaseInputs = () => { for (const k of Object.keys(keys)) delete keys[k]; drag = 0; };
  let backgroundIntroTimer = null;
  const onVisibilityChange = () => {
    if (document.hidden) {
      releaseInputs();
      // Si el usuario cambia de pestaña durante el prólogo, mantener la cinemática
      // y la voz de KRONOX IA avanzando en tiempo real al son de la música.
      if (realTimeIntro && !backgroundIntroTimer) {
        backgroundIntroTimer = setInterval(() => {
          if (!realTimeIntro || disposed) {
            if (backgroundIntroTimer) clearInterval(backgroundIntroTimer);
            backgroundIntroTimer = null;
            return;
          }
          if (document.hidden) {
            tick();
          }
        }, 100);
      }
    } else {
      if (backgroundIntroTimer) {
        clearInterval(backgroundIntroTimer);
        backgroundIntroTimer = null;
      }
    }
  };
  const onInputFocus = e => { if (e.target?.matches?.('input,textarea,select,[contenteditable="true"]')) releaseInputs(); };
  const onKeyDown = (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'escape' && freeHelmMode) {
      freeHelmMode = false;
      S.onFreeHelmChange?.(false);
      e.preventDefault();
      return;
    }
    keys[k] = 1;
    // Tecla contextual [C] para alternar el modo de cámara (Cabina 1P <-> Exterior 120 m)
    if (k === 'c' && free && !realTimeIntro && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (pv === 1) view(3);
      else view(1);
      S.onViewChange?.(pv);
      return;
    }
    // Tecla contextual [V] para alternar cámara 1P (ojos) y 3P (astronauta 3D EVA en cabina)
    if (k === 'v' && free && pv === 1 && !realTimeIntro && !e.ctrlKey && !e.metaKey && !e.altKey) {
      cabinFirstPerson = !cabinFirstPerson;
      S.onCabinFirstPersonChange?.(cabinFirstPerson);
      return;
    }
    // Tecla [M] para alternar física de microgravedad Asistida vs Libre (6-DOF newtoniana)
    if (k === 'm' && free && pv === 1 && !realTimeIntro && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const nextMode =
        microgravityController.getMode() === MICROGRAVITY_MODES.ASSISTED
          ? MICROGRAVITY_MODES.FREE
          : MICROGRAVITY_MODES.ASSISTED;
      microgravityController.setMode(nextMode);
      S.onMicrogravityStateChange?.({
        mode: nextMode,
        anchored: microgravityController.isAnchored(),
        speed: microgravityController.getSpeed(),
      });
      return;
    }
    // Tecla [H] para sujetarse / anclarse a los pasamanos EVA en microgravedad
    if (k === 'h' && free && pv === 1 && !realTimeIntro && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const nearRail = fourDecksInterior.grabRails.find((rail) => {
        const dx = astronautPos.x - rail.pos[0];
        const dy = astronautPos.y + 1.0 - rail.pos[1];
        const dz = astronautPos.z - rail.pos[2];
        return Math.hypot(dx, dy) < 2.2 && Math.abs(dz) < (rail.span || 4) * 0.65;
      });
      if (nearRail || microgravityController.isAnchored()) {
        microgravityController.toggleAnchor(nearRail?.id || 'rail-local');
        S.onMicrogravityStateChange?.({
          mode: microgravityController.getMode(),
          anchored: microgravityController.isAnchored(),
          anchoredRailId: microgravityController.getAnchoredRailId(),
          speed: microgravityController.getSpeed(),
        });
      }
      return;
    }
    // Tecla contextual [T] para alternar el Telescopio Óptico de a bordo (1× -> 10× -> 50× -> 150× -> 300× -> 500× -> 1×)
    if (k === 't' && free && !realTimeIntro && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const steps = OPTICAL_MAGNIFICATION_STEPS;
      const cur = opticalTelescopeState.enabled ? opticalTelescopeState.magnification : 1;
      const idx = steps.indexOf(cur);
      const nextMag = steps[(idx + 1) % steps.length];
      setOpticalTelescope({ enabled: nextMag > 1, magnification: nextMag });
      return;
    }
    // Tecla [R] en vista exterior para restablecer el encuadre orbital de la nave de 120 m
    if (k === 'r' && free && pv == 3 && !realTimeIntro && !e.ctrlKey && !e.metaKey) {
      if (!exteriorCameraMode) enterExteriorCamera();
      resetExteriorCamera(false);
      return;
    }
    // Tecla contextual [E] para operar la consola física más cercana en cabina 3D
    if (k === 'e' && free && pv == 1 && !realTimeIntro && nearestCabinStation && activeCabinStation !== 'nav') {
      const stId = nearestCabinStation.station.id;
      if (stId === 'nav') occupyNavigationSeat();
      else activeCabinStation = stId;
      const stObj = nearestCabinStation.station;
      aiFollowAstronaut = false;
      luminousAI.setTargetPosition(stObj.aiHoverPos, 'Explicación');
      luminousAI.pointAtWorldPosition(stObj.consolePos, true);
      if (stId === 'nav') sceneDirector.dispatchEvent('NAVIGATION_SELECTED', {});
      else if (stId === 'science') sceneDirector.dispatchEvent('SCIENTIFIC_SCAN_STARTED', {});
      else if (stId === 'missions') sceneDirector.dispatchEvent('MISSION_ACTIVATED', {});
      else if (stId === 'comms') sceneDirector.dispatchEvent('AI_ACTIVATED', {});
      else if (stId === 'sensor-calibration') {
        activeRepairStage = Math.max(1, activeRepairStage);
        sceneDirector.dispatchEvent('MISSION_ACTIVATED', {});
      }
      S.onStationInteract?.(stId);
    } else if (k === 'e' && free && pv == 1 && !realTimeIntro && !nearestCabinStation) {
      const nearRail = fourDecksInterior.grabRails.find((rail) => {
        const dx = astronautPos.x - rail.pos[0];
        const dz = astronautPos.z - rail.pos[2];
        return Math.abs(dx) < 2.2 && Math.abs(dz) < (rail.span || 4) * 0.65;
      });
      if (nearRail || microgravityController.isAnchored()) {
        microgravityController.toggleAnchor(nearRail?.id || 'rail-local');
      }
    }
  };
  const onKeyUp = (e) => {
    delete keys[e.key.toLowerCase()];
  };
  const onResize = () => {
    R.setPixelRatio(pixelRatioFor(qualityMode));
    R.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
    localCam.aspect = innerWidth / innerHeight;
    localCam.updateProjectionMatrix();
    GU.uH.value = (innerHeight * R.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    if (exteriorCameraMode) resetExteriorCamera();
  };
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur',releaseInputs); document.addEventListener('visibilitychange', onVisibilityChange); document.addEventListener('focusin', onInputFocus); dom.addEventListener('pointercancel', releaseInputs);
  addEventListener('resize', onResize);
  const frameTiming = { active: false, last: null, values: [], metadata: null };
  function tick() {
    const introOwnedThisFrame = !!realTimeIntro;
    const frameNow = performance.now();
    if (frameTiming.active && frameTiming.last !== null) { frameTiming.values.push(frameNow - frameTiming.last); if (frameTiming.values.length >= 600) frameTiming.active = false; }
    frameTiming.last = frameNow;
    if (disposed) return;
    rafId = requestAnimationFrame(tick);
    const rawDelta = clk.getDelta();
    if (simulationPaused) {
      releaseInputs();
      vel.set(0, 0, 0);
      astronautVel.set(0, 0, 0);
    }
    const dt = simulationPaused ? 0 : Math.min(rawDelta, 0.1),
      spd = (simulationPaused || S.pause.current) ? 0 : S.speed.current;
    const deepSkyVisibility =
      0.55 + 0.45 * THREE.MathUtils.smoothstep(cam.position.length(), 1800, 10000);
    deepGalaxyMaterials.forEach((material) => {
      material.opacity = deepSkyVisibility * 0.68;
    });
    deepSkyNebulaMaterials.forEach((material) => {
      material.opacity = 0; // Evitar manchas o parches de color artificiales en la bóveda estelar
    });
    deepGalaxyMotion.forEach(
      ({ sprite, material, initialPosition, orbitAxis, orbitSpeed, spinSpeed }) => {
        sprite.position
          .copy(initialPosition)
          .applyAxisAngle(orbitAxis, clk.elapsedTime * orbitSpeed);
        material.rotation += dt * spinSpeed;
      },
    );
    // En modos físicos (1 segundo = 1 segundo en el mundo local de la nave), la nave co-orbita con su planeta anfitrión
    let orbitalHostBody = null;
    let orbitalHostPrevPos = null;
    if ((free || spectator || realTimeIntro) && spd > 0 && !nav) {
      let bestRatio = Infinity;
      for (const b of B) {
        if (b.p.sun || !b.pivot) continue;
        const d = sp.distanceTo(b.pivot.position);
        const soiLimit = isPhysicalObservationActive()
          ? Math.max(b.r * 80, b.p.moon ? 0.025 : 0.45)
          : Math.max(b.r * 12, 48);
        if (d < soiLimit) {
          const ratio = d / Math.max(1e-6, b.r);
          if (ratio < bestRatio) {
            bestRatio = ratio;
            orbitalHostBody = b;
          }
        }
      }
      if (orbitalHostBody) {
        orbitalHostPrevPos = orbitalHostBody.pivot.position.clone();
      }
    }
    const effectiveSpd = nav
      ? 0
      : isPhysicalObservationActive()
        ? spd > 0
          ? 1 / 86400
          : 0
        : spd;
    sim += dt * effectiveSpd;
    S.day(sim);
    updateAsteroids(sim);
    if (S.onNavigation && clk.elapsedTime - lastNavigationPublish > 0.18) {
      lastNavigationPublish = clk.elapsedTime;
      if (!nav && lastNavigationHadNav) {
        lastNavigationHadNav = false;
        S.onNavigation(null);
      } else if (nav) {
        lastNavigationHadNav = true;
        const progress = nav.progress;
        S.onNavigation({ phase: nav.phase, progress, label: nav.name });
      }
    }
    const fl = S.fl.current,
      inCinematicVisualMode = Boolean(
        realTimeIntro || mainMenuOrbitActive || launchSequence || launchCameraBlend || sceneDirector.getState().activeSequence,
      ),
      inFirstPersonCabinVisualMode = Boolean(free && pv == 1 && !inCinematicVisualMode),
      allowReferenceGuides = !contextOverview && !nearbyMapState && !inCinematicVisualMode && !inFirstPersonCabinVisualMode,
      solarOrbitVisibility =
        allowReferenceGuides && fl.orb
          ? 1 - THREE.MathUtils.smoothstep(cam.position.length(), 150, 1800)
          : 0;
    const isCabinActive = pv == 1 && !realTimeIntro && !mainMenuOrbitActive;
    const inPhysicalShipObservation = Boolean(
      free && !realTimeIntro && !mainMenuOrbitActive && !contextOverview && !nearbyMapState,
    );
    // Actualizar posiciones heliocéntricas J2000.0 + sim en doble precisión (`Float64Array`)
    syncSolarPositions(sim);
    if (!nav && orbitalHostBody && orbitalHostPrevPos) {
      const hostDelta = orbitalHostBody.pivot.position.clone().sub(orbitalHostPrevPos);
      if (hostDelta.lengthSq() > 0) {
        sp.add(hostDelta);
        if (arrivalTarget) arrivalTarget.add(hostDelta);
        if (exteriorCameraMode || spectator) {
          cam.position.add(hostDelta);
          ct.target.add(hostDelta);
          exteriorLastShipPosition.add(hostDelta);
        }
      }
    }
    // Determinar posición heliocéntrica del observador en UA (precisión doble IEEE 754)
    let observerHeliocentricAu = { x: 1, y: 0, z: 0 };
    if (earth?.heliocentricAu) {
      observerHeliocentricAu = { ...earth.heliocentricAu };
    }
    if (free || spectator) {
      if (isPhysicalObservationActive() && shipPoseKnown && sp.length() < 8000) {
        observerHeliocentricAu = {
          x: sp.x / PHYSICAL_CONSTANTS.AU_ASTRO_SCENE_UNITS,
          y: sp.y / PHYSICAL_CONSTANTS.AU_ASTRO_SCENE_UNITS,
          z: sp.z / PHYSICAL_CONSTANTS.AU_ASTRO_SCENE_UNITS,
        };
      } else {
        let closestHost = null;
        let closestDist = Infinity;
        for (const b of B) {
          if (!b.p.au) continue;
          const d = sp.distanceTo(b.pivot.position);
          if (d < closestDist) {
            closestDist = d;
            closestHost = b;
          }
        }
        if (closestHost && closestDist < Math.max(45, closestHost.r * 12) && closestHost.heliocentricAu) {
          const offsetScene = sp.clone().sub(closestHost.pivot.position);
          const kmPerUnit = Math.max(100, closestHost.p.km / Math.max(1e-6, closestHost.r));
          const offsetAu = offsetScene.multiplyScalar(kmPerUnit / PHYSICAL_CONSTANTS.AU_KM);
          observerHeliocentricAu = {
            x: closestHost.heliocentricAu.x + offsetAu.x,
            y: closestHost.heliocentricAu.y + offsetAu.y,
            z: closestHost.heliocentricAu.z + offsetAu.z,
          };
        }
      }
    }
    const activeOpticalMag = opticalTelescopeState.enabled ? opticalTelescopeState.magnification : 1;
    B.forEach((b) => {
      const p = b.p;
      b.observationalMetrics = computeBodyObservationalMetrics({
        bodyName: p.n,
        radiusKm: p.km,
        bodyHeliocentricAu: b.heliocentricAu,
        observerHeliocentricAu,
        opticalMagnification: activeOpticalMag,
      });
      if (b.pivot) {
        const distToShip = b.pivot.position.distanceTo(sp);
        const minSafeDist = isPhysicalObservationActive()
          ? computeSafeOrbitalClearance(b, { isCabinActive: pv === 1, physicalScale: true })
          : 2.2;
        b.pivot.visible = !(isCabinActive && distToShip < minSafeDist * 0.45);
        const distToCam = Math.max(1e-5, cam.position.distanceTo(b.pivot.position));
        const isLocalOrbitedBody = isPhysicalObservationActive()
          ? distToShip < Math.max(b.r * 65, 0.04) ||
          (p.moon && earth && earth.pivot.position.distanceTo(sp) < 0.65)
          : distToShip < Math.max(45, b.r * 10.5) ||
          (p.moon && earth && earth.pivot.position.distanceTo(sp) < 45);
        // El radio 3D del planeta (`b.tilt.scale`) conserva SIEMPRE su valor físico `b.r` (`p.km / 1e6`)
        // sin ser inflado jamás por el aumento del telescopio óptico (que actúa estrechando `cam.fov`):
        b.tilt.scale.setScalar(b.r);
        if (b.moonSystem) {
          b.moonSystem.visible = !inPhysicalShipObservation || activeOpticalMag >= 10 || isLocalOrbitedBody;
          b.moonSystem.scale.setScalar(b.r);
        }
        if (b.pointBeacon) {
          if (inPhysicalShipObservation && !isLocalOrbitedBody && !p.sun) {
            const showPointBeacon = !b.observationalMetrics.resolvedWithInstrument;
            b.pointBeacon.visible = showPointBeacon;
            if (showPointBeacon) {
              const fovTan = Math.tan(THREE.MathUtils.degToRad(Math.max(0.05, cam.fov) * 0.5));
              const magBoost = Math.max(
                0.65,
                Math.min(1.85, 1.25 - b.observationalMetrics.apparentMagnitudeV * 0.14),
              );
              b.pointBeacon.scale.setScalar(distToCam * fovTan * 0.022 * magBoost);
            }
          } else {
            b.pointBeacon.visible = false;
          }
        }
      }
      if (b.satellites) {
        b.satellites.forEach((plane) => {
          plane.plane.visible = !realTimeIntro && !mainMenuOrbitActive;
          const orbitAngle = ((sim * SATELLITE_VISUAL_TIME_SCALE + clk.elapsedTime * 0.002) / plane.period) * TAU;
          plane.objects.forEach(({ object, phase }) => {
            const angle = orbitAngle + phase;
            object.position.set(Math.cos(angle) * plane.radius, 0, Math.sin(angle) * plane.radius);
            object.rotation.y = -angle;
          });
        });
      }
      if (b.spherex && !realTimeIntro) {
        b.spherex.update({
          simDays: sim,
          elapsedTime: clk.elapsedTime,
          earthRadius: 1,
          orbitRadius: 1.95,
          scanning: false,
        });
      }
      if (b.jupiterMoons) {
        b.jupiterMoons.forEach((moon) => {
          const angle = (sim / moon.period) * TAU + moon.phase;
          moon.moonPivot.position.set(
            Math.cos(angle) * moon.radius,
            0,
            Math.sin(angle) * moon.radius,
          );
          // The Galilean moons are tidally locked: one axial turn per orbit.
          moon.mesh.rotation.y = -angle;
        });
      }
      if (!p.moon) {
        const rate = ((TAU * 24) / p.rot) * effectiveSpd;
        b.spin.rotation.y += rate * dt;
      }
      b.lab.visible = allowReferenceGuides && !!fl.lab;
      b.ax.visible = allowReferenceGuides && !!fl.ax;
      if (b.orbit) {
        b.orbit.material.opacity = 0.5 * solarOrbitVisibility;
        b.orbit.visible = solarOrbitVisibility > 0.01;
      }
      if (b.ar) {
        b.ar.visible = allowReferenceGuides && !!fl.vel;
        const L = cam.position.distanceTo(b.pivot.position) * 0.12;
        b.ar.setLength(L, L * 0.25, L * 0.12);
      }
    });
    if (free) {
      let candidate = null,
        held = null,
        best = Infinity;
      for (const b of B) {
        if (!b.p.au && !b.p.moon) continue;
        const d = sp.distanceTo(b.pivot.position),
          limit = isPhysicalObservationActive()
            ? Math.max(b.r * 12, 0.025)
            : Math.max(b.r * 2.6, real ? 0.025 : 0.08);
        if (b.p.n === nearKey && d < limit * 1.75) held = b;
        if (d < limit && d < best) {
          candidate = b;
          best = d;
        }
      }
      if (held) candidate = held;
      const key = (candidate && candidate.p.n) || null;
      if (key !== nearKey) {
        nearKey = key;
        S.near(key);
        S.onObservationModeChange?.(getObservationMode());
      }
    } else if (nearKey) {
      nearKey = null;
      S.near(null);
      S.onObservationModeChange?.(getObservationMode());
    }
    if (foc) {
      const dl = foc.pivot.position.clone().sub(ct.target);
      ct.target.add(dl);
      cam.position.add(dl);
    }
    const mv = new V(
      (keys.w ? 1 : 0) - (keys.s ? 1 : 0),
      (keys.e ? 1 : 0) - (keys.q ? 1 : 0),
      (keys.d ? 1 : 0) - (keys.a ? 0 : 0) - (keys.a ? 1 : 0),
    );
    if (free) {
      ti += dt;
      if (ti > 3.6 && ti - dt <= 3.6) S.intro(false);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(fp, fy, 0, 'YXZ'));
      const routeForFrame = nav;
      const inHabitableCabin = pv == 1 && !realTimeIntro && !launchSequence && !launchCameraBlend;
      const pilotingFromCabin = inHabitableCabin && activeCabinStation === 'nav';
      freeHelmBlend += ((freeHelmMode ? 1 : 0) - freeHelmBlend) * Math.min(1, dt * 3.2);
      if (pilotingFromCabin && !nav) {
        fy += ((keys.d ? 1 : 0) - (keys.a ? 1 : 0)) * dt * 0.72;
        q.setFromEuler(new THREE.Euler(fp, fy, 0, 'YXZ'));
      }
      const ok = !nav && ti >= 5 && (!inHabitableCabin || pilotingFromCabin),
        mx = ok && !exteriorCameraMode ? mv.x || (O.au ? 1 : 0) : 0,
        f = new V(0, 0, -1).applyQuaternion(q),
        r = new V(1, 0, 0).applyQuaternion(q),
        bs = fs * (keys.shift ? 5 : 1);
      pvl.copy(vel);
      if (nav) { vel.set(0, 0, 0); }
      else if (realTimeIntro || mainMenuOrbitActive) { vel.set(0, 0, 0); }
      else if (launchSequence) {
        const launch = launchSequence;
        launch.elapsed = Math.min(launch.duration, launch.elapsed + dt);
        const progress = launch.elapsed / launch.duration,
          eased = progress * progress * (3 - 2 * progress),
          previous = sp.clone(),
          radius = launch.startRadius + (launch.endRadius - launch.startRadius) * eased;
        sp.copy(earth.pivot.position).addScaledVector(launch.radial, radius);
        vel.copy(sp).sub(previous).divideScalar(Math.max(dt, 1e-4));
        if (progress >= 1) {
          launchSequence = null;
          vel.set(0, 0, 0);
          ti = 9;
          S.intro(false);
        }
      } else if ((!inHabitableCabin || pilotingFromCabin) && !exteriorCameraMode) {
        const inputTarget = f.multiplyScalar(mx * bs).addScaledVector(cam.up, (ok ? mv.y : 0) * bs).addScaledVector(r, (ok && !pilotingFromCabin ? mv.z : 0) * bs);
        if (inputTarget.length() > Math.abs(bs)) inputTarget.setLength(Math.abs(bs));
        const step = integrateFlightVelocity(vel.toArray(), inputTarget.toArray(), dt, { inertia: !!O.in, automatic: !!O.au, activeInput: ok && mv.lengthSq() > 0, speed: bs });
        vel.fromArray(step.velocity); sp.add(new V().fromArray(step.displacement));
        enforcePlanetaryCollisionBoundary(sp, B, {
          isCabinActive: pv === 1,
          physicalScale: isPhysicalObservationActive(),
        });
      } else if (exteriorCameraMode && !nav) {
        vel.multiplyScalar(Math.exp(-dt * 8));
      } else if (!nav) {
        vel.multiplyScalar(Math.exp(-dt * 8));
      }
      ac += (vel.distanceTo(pvl) / Math.max(dt, 1e-4) - ac) * Math.min(1, dt * 8);
      if (nav) {
        const previous = sp.clone(), oldPhase = nav.phase; advanceJump(nav, dt); sp.copy(nav.position); q.copy(nav.currentQuaternion);
        vel.copy(sp).sub(previous).divideScalar(Math.max(dt, 1e-4));
        const heading = new THREE.Euler().setFromQuaternion(q, 'YXZ'); fy = heading.y; fp = heading.x; bk = 0;
        if (oldPhase !== nav.phase && nav.phase === 'HYPERSPACE_ENTRY') sceneDirector.dispatchEvent('JUMP_INITIATED', { targetName: nav.name });
        if (nav.done) {
          const completed = nav; arrivalTarget = completed.target.clone(); lastJump = { name: completed.name, objectKey: completed.objectKey, target: completed.target.toArray(), position: completed.to.toArray(), quaternion: completed.q.toArray(), phases: [...completed.history] };
          nav = null; disposeTravelEffect(); vel.set(0, 0, 0); releaseInputs();
          sceneDirector.dispatchEvent('ARRIVAL_DETECTED', { targetName: completed.name });
          if (machineSystems.sensorSweepGroup) machineSystems.sensorSweepGroup.clear();
          if (completed.arrivedTarget) {
            astronomicalHologram.setArrivedTarget(completed.arrivedTarget);
          }
          if (!completed.respectSpeed) S.fv(completed.oldFs);
          if (completed.onArrive) completed.onArrive();
        }
      }
      const sz = SHIP_LENGTH_METERS * metersToAstroSceneUnits(),
        kk = 1,
        e = 1;
      bk += (-(!nav && ti >= 5 && !inHabitableCabin ? mv.z : 0) * 0.5 - bk) * Math.min(1, dt * 5);

      if (mainMenuOrbitActive && !realTimeIntro && !nav) {
        // =========================================================================
        // PORTADA DE MENÚ PRINCIPAL: Órbita viva y dinámica alrededor de KRONOX 120 m
        // =========================================================================
        ship.visible = true;
        localCabinWorld.visible = false;
        if (articulatedAstronaut) articulatedAstronaut.root.visible = false;
        mainMenuOrbitAngle += dt * 0.14;
        const heroAzimuth = 0.72 + 0.56 * Math.sin(mainMenuOrbitAngle);
        const radiusM = 122 + 16 * Math.cos(mainMenuOrbitAngle * 0.75);
        const elevM = 14.5 + 11.5 * Math.sin(mainMenuOrbitAngle * 0.62);
        const localHeroPos = new V(
          Math.sin(heroAzimuth) * radiusM,
          elevM,
          -Math.cos(heroAzimuth) * radiusM,
        ).applyQuaternion(q);
        // Encuadre dinámico mostrando anillos dorados, propulsores encendidos y ventanal iluminado
        const localHeroLook = new V(
          -12 + 4.5 * Math.cos(mainMenuOrbitAngle * 0.5),
          1.0 + 1.8 * Math.sin(mainMenuOrbitAngle * 0.4),
          2.0 - 5.0 * Math.sin(mainMenuOrbitAngle * 0.6),
        ).applyQuaternion(q);
        localCam.near = 0.25;
        localCam.far = 6000;
        localCam.fov = Math.min(fovBase, 46);
        localCam.updateProjectionMatrix();
        localCam.position.copy(localHeroPos);
        localCam.lookAt(localHeroLook);
        cam.near = 0.0005;
        cam.fov = localCam.fov;
        cam.updateProjectionMatrix();
        cam.position.copy(sp).addScaledVector(localHeroPos, metersToAstroSceneUnits());
        cam.quaternion.copy(localCam.quaternion);
      } else if (realTimeIntro?.phase === 'opening') {
        // =========================================================================
        // ACTO I · ESCENA 1 — EL UNIVERSO Y LA TIERRA (`opening`)
        // Campo estelar profundo con transición gradual hacia la Tierra iluminada
        // =========================================================================
        const introDt = (realTimeIntroPaused || simulationPaused)
          ? 0
          : Math.min(rawDelta, 0.35);
        realTimeIntro.elapsed += introDt;
        realTimeIntro.stageElapsed = (realTimeIntro.stageElapsed || 0) + introDt;
        ship.visible = false;
        localCabinWorld.visible = false;
        if (articulatedAstronaut) articulatedAstronaut.root.visible = false;

        const earthPos = earth?.pivot ? earth.pivot.position.clone() : new V(Dd(1), 0, 0);
        const er = earth?.r || 0.35;
        const t1 = Math.min(1, realTimeIntro.elapsed / Math.max(0.1, realTimeIntro.openingDuration));
        const ease1 = t1 * t1 * (3 - 2 * t1);

        const radial = new V(earthPos.x, 0, earthPos.z);
        if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
        else radial.normalize();
        const tangent = new V(-radial.z, 0, radial.x).normalize();

        const startPos = earthPos
          .clone()
          .addScaledVector(radial, -er * 5.6)
          .addScaledVector(tangent, er * 4.8)
          .add(new V(0, er * 2.1, 0));
        const endPos = earthPos
          .clone()
          .addScaledVector(radial, -er * 2.15)
          .addScaledVector(tangent, er * 1.9)
          .add(new V(0, er * 0.72, 0));
        cam.near = 0.0005;
        cam.fov = fovBase;
        cam.updateProjectionMatrix();
        cam.position.lerpVectors(startPos, endPos, ease1);

        const deepStarLook = earthPos
          .clone()
          .addScaledVector(tangent, -er * 3.8)
          .add(new V(0, er * 1.6, 0));
        const earthLimbLook = earthPos.clone().add(new V(0, er * 0.12, 0));
        cam.lookAt(deepStarLook.lerp(earthLimbLook, ease1));

        if (realTimeIntro.elapsed >= realTimeIntro.openingDuration) {
          if (S.reducedMotion?.()) {
            skipRealTimeIntroSequence();
          } else if (S.shouldHoldIntroStage?.('opening', realTimeIntro.stageElapsed)) {
            realTimeIntro.elapsed = realTimeIntro.openingDuration - 0.01;
          } else {
            realTimeIntro.phase = 'cinematic';
            realTimeIntro.elapsed = 0;
            realTimeIntro.stageElapsed = 0;
            realTimeIntro.stageNotified = 0;
          }
        }
      } else if (realTimeIntro && realTimeIntro.phase !== 'launch') {
        // =========================================================================
        // SECUENCIA UNIFICADA EN 2 ACTOS (LORE CÓSMICO + TRAVESÍA PLANETARIA + 4 CUBIERTAS)
        // =========================================================================
        const introDt = (realTimeIntroPaused || simulationPaused)
          ? 0
          : Math.min(rawDelta, 0.35);
        realTimeIntro.elapsed += introDt;
        realTimeIntro.stageElapsed = (realTimeIntro.stageElapsed || 0) + introDt;
        let u = Math.min(1, realTimeIntro.elapsed / Math.max(0.1, realTimeIntro.duration));
        const earthPos = earth?.pivot ? earth.pivot.position.clone() : new V(Dd(1), 0, 0);
        const er = earth?.r || 0.35;

        const nextStage =
          u < 0.12 ? 1
          : u < 0.23 ? 2
          : u < 0.35 ? 3
          : u < 0.48 ? 4
          : u < 0.59 ? 5
          : u < 0.71 ? 6
          : u < 0.81 ? 7
          : u < 0.90 ? 8
          : 9;
        if (nextStage !== realTimeIntro.stageNotified) {
          // Suavizar la transición opening -> escena2_spherex alrededor de la Tierra; cortes limpios entre capítulos planetarios
          if (nextStage === 1) {
            realTimeIntro.cameraHandoff = {
              fromPosition: cam.position.clone(),
              fromQuaternion: cam.quaternion.clone(),
              elapsed: 0,
              duration: 0.85,
            };
          } else {
            realTimeIntro.cameraHandoff = null;
          }
        }

        if (u < 0.12) {
          // ACTO I · ESCENA 2 — EL OBSERVADOR NASA SPHEREx (`escena2_spherex`)
          if (realTimeIntro.stageNotified < 1) {
            realTimeIntro.stageNotified = 1;
            realTimeIntro.stageElapsed = 0;
            S.onIntroStageChange?.(
              'escena2_spherex',
              'Misiones reales como el telescopio espacial NASA SPHEREx abrieron una nueva ventana infrarroja al cosmos, revelando luces ocultas al ojo humano.',
            );
          }
          if (u >= 0.114 && S.shouldHoldIntroStage?.('escena2_spherex', realTimeIntro.stageElapsed)) {
            realTimeIntro.elapsed = 0.114 * realTimeIntro.duration;
            u = 0.114;
          }
          ship.visible = false;
          localCabinWorld.visible = false;
          if (articulatedAstronaut) articulatedAstronaut.root.visible = false;
          cam.near = 0.0005;
          cam.fov = fovBase;
          cam.updateProjectionMatrix();

          const t2 = Math.min(1, u / 0.12);
          const ease2 = t2 * t2 * (3 - 2 * t2);
          if (earth?.spherex) {
            earth.spherex.root.scale.setScalar(0.068);
            earth.spherex.update({
              simDays: sim,
              elapsedTime: clk.elapsedTime,
              earthRadius: 1,
              orbitRadius: 1.95,
              scanning: true,
              cinematicAngleOverride: 0.72 + ease2 * 0.28 + realTimeIntro.stageElapsed * 0.025,
            });
            earth.pivot.updateMatrixWorld(true);
            const spherexPos = earth.spherex.root.getWorldPosition(new V());
            const spherexQuat = earth.spherex.root.getWorldQuaternion(new THREE.Quaternion());
            const orbitSweep = -0.85 + ease2 * 1.95 + realTimeIntro.stageElapsed * 0.08;
            const camDist = er * THREE.MathUtils.lerp(0.46, 0.23, ease2);
            const localOff = new V(
              Math.cos(orbitSweep) * camDist,
              er * THREE.MathUtils.lerp(0.15, 0.05, ease2),
              Math.sin(orbitSweep) * camDist,
            ).applyQuaternion(spherexQuat);
            cam.position.copy(spherexPos).add(localOff);
            const lookTarget = spherexPos
              .clone()
              .add(new V(0, er * 0.02, 0).applyQuaternion(spherexQuat));
            cam.lookAt(lookTarget);
          } else {
            cam.position.copy(earthPos).add(new V(er * 2.1, er * 1.1, er * 1.8));
            cam.lookAt(earthPos);
          }
        } else if (u < 0.23) {
          // ACTO I · ESCENA 3 — TRAVESÍA POR JÚPITER, LUNAS Y UNIVERSO INFRARROJO (`escena3_conocimiento`)
          if (realTimeIntro.stageNotified < 2) {
            realTimeIntro.stageNotified = 2;
            realTimeIntro.stageElapsed = 0;
            if (earth?.spherex) {
              earth.spherex.spectralScanGroup.visible = false;
              earth.spherex.root.scale.setScalar(0.052);
            }
            S.onIntroStageChange?.(
              'escena3_conocimiento',
              'En cada longitud de onda infrarroja detectamos hielos primordiales, viveros de estrellas y enigmas gravitacionales más allá de los gigantes gaseosos.',
            );
          }
          if (u >= 0.224 && S.shouldHoldIntroStage?.('escena3_conocimiento', realTimeIntro.stageElapsed)) {
            realTimeIntro.elapsed = 0.224 * realTimeIntro.duration;
            u = 0.224;
          }
          const t3 = Math.min(1, (u - 0.12) / 0.11);
          const ease3 = t3 * t3 * (3 - 2 * t3);
          const jupBody = B.find((b) => b.p?.n === 'Júpiter') || earth;
          jupBody?.pivot?.updateMatrixWorld?.(true);
          const jPos = jupBody?.pivot ? jupBody.pivot.getWorldPosition(new V()) : earthPos.clone();
          const jr = Math.max(0.35, jupBody?.r || 1.15);
          const sunDir = jPos.lengthSq() > 1e-6 ? jPos.clone().negate().normalize() : new V(0.7, 0.2, 0.7).normalize();
          const upRef = new V(0, 1, 0);
          const sideDir = new V().crossVectors(upRef, sunDir).normalize();

          const flyAng = THREE.MathUtils.lerp(-0.82, 0.48, ease3);
          const flyDist = jr * THREE.MathUtils.lerp(2.65, 2.15, ease3);
          const flyElev = jr * THREE.MathUtils.lerp(0.28, -0.1, ease3);
          const shipWorldPos = (ang) =>
            jPos
              .clone()
              .addScaledVector(sunDir, Math.cos(ang) * flyDist)
              .addScaledVector(sideDir, Math.sin(ang) * flyDist)
              .addScaledVector(upRef, flyElev);

          sp.copy(shipWorldPos(flyAng));
          const fwdVec = shipWorldPos(flyAng + 0.05).sub(sp).normalize();
          setShipOrientationFromForward(q, fwdVec, 0.16 * Math.sin(ease3 * Math.PI));

          ship.visible = true;
          localCabinWorld.visible = false;
          if (articulatedAstronaut) articulatedAstronaut.root.visible = false;

          const toJupiter = jPos.clone().sub(sp).normalize();
          const latDir = new V().crossVectors(toJupiter, upRef).normalize();
          const heroRange = THREE.MathUtils.lerp(168, 138, ease3);
          // Amplia separación angular (~47° entre KRONOX a la izquierda y Júpiter completamente libre a la derecha)
          const camLocal = toJupiter
            .clone()
            .multiplyScalar(-heroRange * 0.72)
            .addScaledVector(latDir, heroRange * 0.72)
            .addScaledVector(upRef, THREE.MathUtils.lerp(20, 6, ease3));
          const lookLocal = toJupiter
            .clone()
            .multiplyScalar(heroRange * 0.46)
            .addScaledVector(latDir, heroRange * 0.24)
            .addScaledVector(upRef, 4);

          localCam.near = 0.25;
          localCam.far = 6000;
          localCam.fov = Math.min(fovBase, 48);
          localCam.updateProjectionMatrix();
          localCam.position.copy(camLocal);
          localCam.lookAt(lookLocal);

          cam.near = 0.0005;
          cam.fov = localCam.fov;
          cam.updateProjectionMatrix();
          cam.position.copy(sp).addScaledVector(localCam.position, metersToAstroSceneUnits());
          cam.quaternion.copy(localCam.quaternion);
        } else if (u < 0.35) {
          // ACTO I · ESCENA 4 — ANILLOS DE SATURNO, VÍA LÁCTEA Y PROYECTO HORIZONTE (`escena4_galaxia`)
          if (realTimeIntro.stageNotified < 3) {
            realTimeIntro.stageNotified = 3;
            realTimeIntro.stageElapsed = 0;
            if (earth?.spherex) {
              earth.spherex.spectralScanGroup.visible = false;
              earth.spherex.root.scale.setScalar(0.052);
            }
            S.onIntroStageChange?.(
              'escena4_galaxia',
              'Para descifrar esa historia escrita entre anillos planetarios y brazos galácticos, la humanidad puso en marcha el Proyecto Horizonte.',
            );
          }
          if (u >= 0.344 && S.shouldHoldIntroStage?.('escena4_galaxia', realTimeIntro.stageElapsed)) {
            realTimeIntro.elapsed = 0.344 * realTimeIntro.duration;
            u = 0.344;
          }
          const tGal = Math.min(1, (u - 0.23) / 0.12);
          const easeGal = tGal * tGal * (3 - 2 * tGal);
          const satBody = B.find((b) => b.p?.n === 'Saturno') || B.find((b) => b.p?.n === 'Júpiter') || earth;
          satBody?.pivot?.updateMatrixWorld?.(true);
          const sPos = satBody?.pivot ? satBody.pivot.getWorldPosition(new V()) : earthPos.clone();
          const sr = Math.max(0.35, satBody?.r || 0.95);
          const sunDir = sPos.lengthSq() > 1e-6 ? sPos.clone().negate().normalize() : new V(0.65, 0.25, 0.7).normalize();
          const upRef = new V(0, 1, 0);
          const sideDir = new V().crossVectors(upRef, sunDir).normalize();

          const satAng = THREE.MathUtils.lerp(-0.95, 0.45, easeGal);
          const satDist = sr * THREE.MathUtils.lerp(2.55, 2.95, easeGal);
          const satElev = sr * THREE.MathUtils.lerp(1.05, 1.45, easeGal);
          const shipSatPos = (ang) =>
            sPos
              .clone()
              .addScaledVector(sunDir, Math.cos(ang) * satDist)
              .addScaledVector(sideDir, Math.sin(ang) * satDist)
              .addScaledVector(upRef, satElev);

          sp.copy(shipSatPos(satAng));
          const fwdVec = shipSatPos(satAng + 0.05).sub(sp).normalize();
          setShipOrientationFromForward(q, fwdVec, -0.16 * Math.sin(easeGal * Math.PI));

          ship.visible = true;
          localCabinWorld.visible = false;
          if (articulatedAstronaut) articulatedAstronaut.root.visible = false;

          const toSaturn = sPos.clone().sub(sp).normalize();
          const latDir = new V().crossVectors(toSaturn, upRef).normalize();
          const galCenterDir = new V().fromArray(SOLAR_GALACTIC_ANCHOR).applyQuaternion(gal.quaternion).negate().normalize();
          const heroRange = THREE.MathUtils.lerp(166, 152, easeGal);
          // Amplia separación lateral (~47°) para mostrar Aurora-120 a la izquierda y Saturno con sus anillos libre a la derecha
          const camLocalRing = toSaturn
            .clone()
            .multiplyScalar(-heroRange * 0.72)
            .addScaledVector(latDir, heroRange * 0.72)
            .addScaledVector(upRef, THREE.MathUtils.lerp(22, -10, easeGal));
          const lookRing = toSaturn
            .clone()
            .multiplyScalar(heroRange * 0.46)
            .addScaledVector(latDir, heroRange * 0.24)
            .addScaledVector(upRef, -1)
            .lerp(galCenterDir.clone().multiplyScalar(56), Math.max(0, (tGal - 0.72) / 0.28) * 0.26);

          localCam.near = 0.25;
          localCam.far = 6000;
          localCam.fov = Math.min(fovBase, 48);
          localCam.updateProjectionMatrix();
          localCam.position.copy(camLocalRing);
          localCam.lookAt(lookRing);

          cam.near = 0.0005;
          cam.fov = localCam.fov;
          cam.updateProjectionMatrix();
          cam.position.copy(sp).addScaledVector(localCam.position, metersToAstroSceneUnits());
          cam.quaternion.copy(localCam.quaternion);
        } else if (u < 0.48) {
          // ACTO II · ESCENA 5 — KRONOX AURORA-120 EN ÓRBITA TERRESTRE (EXTERIOR 120 m, `escena5_nave`)
          if (realTimeIntro.stageNotified < 4) {
            realTimeIntro.stageNotified = 4;
            realTimeIntro.stageElapsed = 0;
            if (earth?.spherex) {
              earth.spherex.spectralScanGroup.visible = false;
              earth.spherex.root.scale.setScalar(0.052);
            }
            alignShipInEarthOrbit();
            S.onIntroStageChange?.(
              'escena5_nave',
              'El Proyecto Horizonte construyó KRONOX Aurora-120: un crucero científico modular de ciento veinte metros diseñado para explorar desde la órbita hasta el espacio profundo.',
            );
          }
          if (u >= 0.472 && S.shouldHoldIntroStage?.('escena5_nave', realTimeIntro.stageElapsed)) {
            realTimeIntro.elapsed = 0.472 * realTimeIntro.duration;
            u = 0.472;
          }
          ship.visible = true;
          localCabinWorld.visible = false;
          if (articulatedAstronaut) articulatedAstronaut.root.visible = false;
          const t5 = Math.min(1, (u - 0.35) / 0.13);
          const ease5 = t5 * t5 * (3 - 2 * t5);

          const localPos = INTRO_CURVES.extPos.getPoint(ease5, _introTmpVec).clone().applyQuaternion(q);
          const localLook = INTRO_CURVES.extLook.getPoint(ease5, _introTmpLook).clone().applyQuaternion(q);
          localCam.near = 0.25;
          localCam.far = 6000;
          localCam.fov = Math.min(fovBase, 48);
          localCam.updateProjectionMatrix();
          localCam.position.copy(localPos);
          localCam.lookAt(localLook);

          cam.near = 0.0005;
          cam.fov = localCam.fov;
          cam.updateProjectionMatrix();
          cam.position.copy(sp).addScaledVector(localCam.position, metersToAstroSceneUnits());
          cam.quaternion.copy(localCam.quaternion);
        } else {
          // ACTO II · ESCENAS 6..10 — INTERIOR VIVO DE LAS 4 CUBIERTAS + TRIPULACIÓN + KRONOX IA
          ship.visible = false;
          localCabinWorld.visible = true;
          localCabinWorld.position.set(0, 0, 0);
          localCabinWorld.scale.set(1, 1, 1);
          localCabinWorld.quaternion.copy(q);

          if (u < 0.59) {
            // ESCENA 6 — PUENTE DE MANDO (`escena6_puente`, Cubierta 01)
            if (realTimeIntro.stageNotified < 5) {
              realTimeIntro.stageNotified = 5;
              realTimeIntro.stageElapsed = 0;
              snapCompanionTo(1.45, 5.15, -10.2, 'Señalización', new V(0.0, 4.75, -10.1));
              S.onIntroStageChange?.(
                'escena6_puente',
                'En el puente de mando coordinamos la astrometría J2000, el rumbo interestelar y los sistemas de observación de toda la expedición.',
              );
            }
            if (u >= 0.584 && S.shouldHoldIntroStage?.('escena6_puente', realTimeIntro.stageElapsed)) {
              realTimeIntro.elapsed = 0.584 * realTimeIntro.duration;
              u = 0.584;
            }
            const t6 = Math.min(1, (u - 0.48) / 0.11);
            const ease6 = t6 * t6 * (3 - 2 * t6);
            if (articulatedAstronaut) {
              articulatedAstronaut.root.visible = true;
              articulatedAstronaut.root.position.set(0.0, 3.4, -9.2);
              articulatedAstronaut.root.rotation.y = 0;
              articulatedAstronaut.updateAnimation(dt, ASTRONAUT_ANIMATION_STATES.CONSOLE_WORK);
            }
            localCam.position.copy(INTRO_CURVES.bridgePos.getPoint(ease6, _introTmpVec).clone().applyQuaternion(q));
            localCam.lookAt(INTRO_CURVES.bridgeLook.getPoint(ease6, _introTmpLook).clone().applyQuaternion(q));
          } else if (u < 0.71) {
            // ESCENA 7 — LABORATORIO SPHEREx Y BANCO ÓPTICO (`escena7_spherex`, Cubierta 03)
            if (realTimeIntro.stageNotified < 6) {
              realTimeIntro.stageNotified = 6;
              realTimeIntro.stageElapsed = 0;
              snapCompanionTo(11.6, -1.55, -0.85, 'Señalización', new V(14.5, -1.95, 0.0));
              S.onIntroStageChange?.(
                'escena7_spherex',
                'La cubierta científica combina espectroscopía inspirada en NASA SPHEREx y bancos ópticos de calibración para investigar cada archivo real sin conjeturas.',
              );
            }
            if (u >= 0.704 && S.shouldHoldIntroStage?.('escena7_spherex', realTimeIntro.stageElapsed)) {
              realTimeIntro.elapsed = 0.704 * realTimeIntro.duration;
              u = 0.704;
            }
            const t7 = Math.min(1, (u - 0.59) / 0.12);
            const ease7 = t7 * t7 * (3 - 2 * t7);
            if (articulatedAstronaut) {
              articulatedAstronaut.root.visible = true;
              articulatedAstronaut.root.position.set(-13.4, -3.4, 0.0);
              articulatedAstronaut.root.rotation.y = Math.PI / 2;
              articulatedAstronaut.updateAnimation(dt, ASTRONAUT_ANIMATION_STATES.CONSOLE_WORK);
            }
            localCam.position.copy(INTRO_CURVES.spherexPos.getPoint(ease7, _introTmpVec).clone().applyQuaternion(q));
            localCam.lookAt(INTRO_CURVES.spherexLook.getPoint(ease7, _introTmpLook).clone().applyQuaternion(q));
          } else if (u < 0.81) {
            // ESCENA 8 — MÓDULO DE HABITABILIDAD EN MICROGRAVEDAD (`escena8_habitabilidad`, Cubierta 02)
            if (realTimeIntro.stageNotified < 7) {
              realTimeIntro.stageNotified = 7;
              realTimeIntro.stageElapsed = 0;
              snapCompanionTo(2.4, 1.55, -3.9, 'Acompañamiento');
              S.onIntroStageChange?.(
                'escena8_habitabilidad',
                'El módulo de habitabilidad mantiene a la tripulación en microgravedad durante largas travesías con soporte vital de ciclo cerrado y gravedad anular asistida.',
              );
            }
            if (u >= 0.804 && S.shouldHoldIntroStage?.('escena8_habitabilidad', realTimeIntro.stageElapsed)) {
              realTimeIntro.elapsed = 0.804 * realTimeIntro.duration;
              u = 0.804;
            }
            const t8 = Math.min(1, (u - 0.71) / 0.10);
            const ease8 = t8 * t8 * (3 - 2 * t8);
            const swimX = THREE.MathUtils.lerp(3.4, -2.6, ease8);
            const swimZ = -2.8 - Math.sin(ease8 * Math.PI) * 1.4;
            const swimY = 0.18 + Math.sin(ease8 * Math.PI) * 0.28;
            if (articulatedAstronaut) {
              articulatedAstronaut.root.visible = true;
              articulatedAstronaut.root.position.set(swimX, swimY, swimZ);
              articulatedAstronaut.root.rotation.y = Math.atan2(3.5, Math.cos(ease8 * Math.PI) * 2.2) + Math.PI * 0.25;
              articulatedAstronaut.updateAnimation(dt, ASTRONAUT_ANIMATION_STATES.CORRIDOR_SWIM);
            }
            luminousAI.setTargetPosition(new V(swimX - 1.1, swimY + 1.35, swimZ - 0.85), 'Acompañamiento');
            localCam.position.copy(INTRO_CURVES.habitatPos.getPoint(ease8, _introTmpVec).clone().applyQuaternion(q));
            localCam.lookAt(INTRO_CURVES.habitatLook.getPoint(ease8, _introTmpLook).clone().applyQuaternion(q));
          } else if (u < 0.90) {
            // ESCENA 9 — INGENIERÍA Y REACTOR TOKAMAK (`escena9_ingenieria`, Cubierta 03)
            if (realTimeIntro.stageNotified < 8) {
              realTimeIntro.stageNotified = 8;
              realTimeIntro.stageElapsed = 0;
              snapCompanionTo(1.65, -1.6, 5.2, 'Análisis', new V(0.0, -1.8, 9.0));
              S.onIntroStageChange?.(
                'escena9_ingenieria',
                'En ingeniería, el reactor toroidal de fusión y sus propulsores magnetoplasmadinámicos suministran la energía limpia que impulsa a KRONOX entre mundos.',
              );
            }
            if (u >= 0.894 && S.shouldHoldIntroStage?.('escena9_ingenieria', realTimeIntro.stageElapsed)) {
              realTimeIntro.elapsed = 0.894 * realTimeIntro.duration;
              u = 0.894;
            }
            const t9 = Math.min(1, (u - 0.81) / 0.09);
            const ease9 = t9 * t9 * (3 - 2 * t9);
            if (articulatedAstronaut) {
              articulatedAstronaut.root.visible = true;
              articulatedAstronaut.root.position.set(0.0, -3.4, 4.7);
              articulatedAstronaut.root.rotation.y = Math.PI;
              articulatedAstronaut.updateAnimation(dt, ASTRONAUT_ANIMATION_STATES.REPAIR_INTERACT);
            }
            localCam.position.copy(INTRO_CURVES.engPos.getPoint(ease9, _introTmpVec).clone().applyQuaternion(q));
            localCam.lookAt(INTRO_CURVES.engLook.getPoint(ease9, _introTmpLook).clone().applyQuaternion(q));
          } else {
            // ESCENA 10 — COMIENZO DE LA PARTIDA (`escena10_inicio`, Astronauta 3D + KRONOX IA -> Control jugador)
            if (realTimeIntro.stageNotified < 9) {
              realTimeIntro.stageNotified = 9;
              realTimeIntro.stageElapsed = 0;
              snapCompanionTo(1.55, 5.05, -10.8, 'Bienvenida');
              S.onIntroStageChange?.(
                'escena10_inicio',
                'Soy KRONOX IA, tu inteligencia de a bordo. El puente es tuyo, comandante: calibra tus instrumentos y comienza tu primera investigación espacial.',
              );
            }
            if (u >= 0.992 && S.shouldHoldIntroStage?.('escena10_inicio', realTimeIntro.stageElapsed)) {
              realTimeIntro.elapsed = 0.992 * realTimeIntro.duration;
              u = 0.992;
            }
            const t10 = Math.min(1, (u - 0.90) / 0.10);
            astronautPos.copy(BRIDGE_SPAWN_POS);
            astronautVel.set(0, 0, 0);
            microgravityController.setPosition(astronautPos);
            astronautYaw = 0;
            astronautPitch = 0;
            targetYaw = 0;
            targetPitch = 0;

            if (articulatedAstronaut) {
              articulatedAstronaut.root.position.copy(BRIDGE_SPAWN_POS);
              articulatedAstronaut.root.rotation.y = 0;
              articulatedAstronaut.root.visible = t10 < 0.9;
              articulatedAstronaut.updateAnimation(dt, ASTRONAUT_ANIMATION_STATES.IDLE_FLOAT);
            }

            const pilotEyeLocal = new V(
              BRIDGE_SPAWN_POS.x,
              BRIDGE_SPAWN_POS.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS,
              BRIDGE_SPAWN_POS.z,
            );
            const posEngExit = new V(0.0, 4.9, -1.8);
            const posSpineEntry = new V(-3.4, 5.05, -5.2);
            const posHeroRevealA = new V(-2.0, 5.15, -12.6);
            const posHeroRevealB = new V(1.25, 5.18, -12.2);

            const lookForwardSpine = new V(0.0, 4.95, -9.8);
            const lookHeroPair = new V(0.45, 4.75, -10.4);
            const lookBowHorizon = new V(0.0, pilotEyeLocal.y, -24.0);

            let camLocalTarget = new V();
            let lookLocalTarget = new V();
            if (t10 < 0.32) {
              const s = t10 / 0.32;
              const e = s * s * (3 - 2 * s);
              camLocalTarget.lerpVectors(posEngExit, posSpineEntry, e);
              lookLocalTarget.copy(lookForwardSpine);
            } else if (t10 < 0.78) {
              const s = (t10 - 0.32) / 0.46;
              if (s < 0.25) {
                const ss = s / 0.25;
                camLocalTarget.lerpVectors(posSpineEntry, posHeroRevealA, ss * ss * (3 - 2 * ss));
                lookLocalTarget.lerpVectors(lookForwardSpine, lookHeroPair, ss);
              } else {
                const ss = (s - 0.25) / 0.75;
                camLocalTarget.lerpVectors(posHeroRevealA, posHeroRevealB, ss * ss * (3 - 2 * ss));
                lookLocalTarget.copy(lookHeroPair);
              }
            } else {
              const s = (t10 - 0.78) / 0.22;
              const e = s * s * (3 - 2 * s);
              camLocalTarget.lerpVectors(posHeroRevealB, pilotEyeLocal, e);
              lookLocalTarget.lerpVectors(lookHeroPair, lookBowHorizon, e);
            }

            localCam.position.copy(camLocalTarget.applyQuaternion(q));
            localCam.lookAt(lookLocalTarget.applyQuaternion(q));
          }

          const targetFov = u >= 0.90 ? Math.min(fovBase, 44) : Math.min(fovBase, 48);
          localCam.fov = targetFov;
          localCam.near = 0.05;
          localCam.far = 4000;
          localCam.updateProjectionMatrix();

          cam.position.copy(sp).addScaledVector(localCam.position, metersToAstroSceneUnits());
          cam.quaternion.copy(localCam.quaternion);
          cam.fov = localCam.fov;
          cam.near = isPhysicalObservationActive() ? 1e-5 : 0.05;
          cam.updateProjectionMatrix();
        }

        if (u < 0.35 && realTimeIntro.cameraHandoff) {
          const handoff = realTimeIntro.cameraHandoff;
          handoff.elapsed = Math.min(handoff.duration, handoff.elapsed + introDt);
          const blend = THREE.MathUtils.smoothstep(handoff.elapsed / handoff.duration, 0, 1);
          const desiredPosition = cam.position.clone();
          const desiredQuaternion = cam.quaternion.clone();
          cam.position.lerpVectors(handoff.fromPosition, desiredPosition, blend);
          cam.quaternion.copy(handoff.fromQuaternion).slerp(desiredQuaternion, blend);
          if (handoff.elapsed >= handoff.duration) realTimeIntro.cameraHandoff = null;
        } else if (u >= 0.35) {
          realTimeIntro.cameraHandoff = null;
        }

        luminousAI.update(dt, clk.elapsedTime, aiSpeakingState, aiAudioLevelState);
        fourDecksInterior?.updateStations?.(
          clk.elapsedTime,
          null,
          null,
          null,
          false,
          astronautPos,
          activeRepairStage,
        );

        if (u >= 1) {
          const cb = realTimeIntro.onComplete;
          realTimeIntro = null;
          realTimeIntroPaused = false;
          if (earth?.spherex) {
            earth.spherex.spectralScanGroup.visible = false;
            earth.spherex.root.scale.setScalar(0.052);
          }
          releaseInputs(); vel.set(0, 0, 0); activeCabinStation = null; freeHelmMode = false;
          pv = 1;
          cabinFirstPerson = true;
          astronaut3D.root.visible = false;
          astronaut3D.firstPersonHands.visible = false;
          if (articulatedAstronaut) articulatedAstronaut.root.visible = false;
          ship.visible = false;
          localCabinWorld.visible = true;
          const cabinFov = Math.min(fovBase, 42);
          localCam.near = 0.05;
          localCam.far = 4000;
          localCam.fov = cabinFov;
          localCam.updateProjectionMatrix();
          cam.near = isPhysicalObservationActive() ? 1e-5 : 0.05;
          cam.fov = cabinFov;
          cam.updateProjectionMatrix();

          const pilotEyeLocal = new V(
            astronautPos.x,
            astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS,
            astronautPos.z,
          ).applyQuaternion(q);
          localCam.position.copy(pilotEyeLocal);
          localCam.quaternion.copy(q);
          cam.position.copy(sp).addScaledVector(pilotEyeLocal, metersToAstroSceneUnits());
          cam.quaternion.copy(q);

          suppressDirectorNarrative = true;
          sceneDirector.dispatchEvent('CABIN_ENTERED', {});
          sceneDirector.dispatchEvent('AI_ACTIVATED', {});
          suppressDirectorNarrative = false;
          if (cb) cb();
          introCompletedNaturally = true;
          startGuidedCabinTour();
        }
      } else {
        // Actualizar KronoxSceneDirector y secuencias dirigidas por los sistemas de la nave (Secciones 2, 3 y 4)
        const directorSeq = sceneDirector.update(dt, clk.elapsedTime);

        if (directorSeq && directorSeq.type === 'PROPULSION_AND_DEPARTURE' && !directorSeq.finished) {
          // Secuencia cinematográfica en tiempo real dirigida por el Sistema de Propulsión (Sección 4):
          // 1. La cámara se desplaza hacia atrás mostrando la nave de 120m mientras los motores se encienden
          // 2. Toma exterior amplia acompañando la aceleración real del modelo en el cosmos
          // 3. Regreso fluido a la cabina habitable 3D donde Kronox IA continúa la conversación
          const u = directorSeq.progress;
          ship.visible = directorSeq.showExteriorShip;
          localCabinWorld.visible = directorSeq.showInteriorCabin;
          localCabinWorld.position.set(0, 0, 0);
          localCabinWorld.scale.set(1, 1, 1);
          localCabinWorld.quaternion.copy(q);

          if (u < 0.36) {
            const t = u / 0.36;
            const ease = t * t * (3 - 2 * t);
            const camOffMeters = new V(
              THREE.MathUtils.lerp(0, SHIP_LENGTH_METERS * 0.7, ease),
              THREE.MathUtils.lerp(SHIP_LENGTH_METERS * 0.12, SHIP_LENGTH_METERS * 0.42, ease),
              THREE.MathUtils.lerp(SHIP_LENGTH_METERS * 0.45, SHIP_LENGTH_METERS * 1.3, ease),
            ).applyQuaternion(q);
            localCam.near = 0.25;
            localCam.far = 6000;
            localCam.position.copy(camOffMeters);
            localCam.lookAt(new V(0, 0, -SHIP_LENGTH_METERS * 0.3).applyQuaternion(q));
            cam.position.copy(sp).addScaledVector(camOffMeters, metersToAstroSceneUnits());
            cam.quaternion.copy(localCam.quaternion);
          } else if (u < 0.78) {
            const t = (u - 0.36) / 0.42;
            const ease = t * t * (3 - 2 * t);
            const camOffMeters = new V(
              THREE.MathUtils.lerp(SHIP_LENGTH_METERS * 0.7, -SHIP_LENGTH_METERS * 1.1, ease),
              THREE.MathUtils.lerp(SHIP_LENGTH_METERS * 0.42, SHIP_LENGTH_METERS * 0.6, ease),
              THREE.MathUtils.lerp(SHIP_LENGTH_METERS * 1.3, SHIP_LENGTH_METERS * 1.7, ease),
            ).applyQuaternion(q);
            localCam.near = 0.25;
            localCam.far = 6000;
            localCam.position.copy(camOffMeters);
            localCam.lookAt(
              new V(0, SHIP_LENGTH_METERS * 0.05, -SHIP_LENGTH_METERS * 0.55).applyQuaternion(q),
            );
            cam.position.copy(sp).addScaledVector(camOffMeters, metersToAstroSceneUnits());
            cam.quaternion.copy(localCam.quaternion);
          } else {
            const t = (u - 0.78) / 0.22;
            const ease = t * t * (3 - 2 * t);
            const localCamPos = new V(
              THREE.MathUtils.lerp(0, astronautPos.x, ease),
              THREE.MathUtils.lerp(4.95, astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS, ease),
              THREE.MathUtils.lerp(-14.0, astronautPos.z, ease),
            ).applyQuaternion(q);
            const lookTargetLocal = new V(
              0,
              astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS,
              -24.0,
            ).applyQuaternion(q);
            localCam.near = 0.05;
            localCam.far = 4000;
            localCam.position.copy(localCamPos);
            localCam.lookAt(lookTargetLocal);
            cam.position.copy(sp).addScaledVector(localCamPos, metersToAstroSceneUnits());
            cam.quaternion.copy(localCam.quaternion);
          }
          luminousAI.update(dt, clk.elapsedTime, aiSpeakingState, aiAudioLevelState);
        } else if (inHabitableCabin) {
          // =========================================================================
          // SECCIÓN 3, 4 y 5: NAVE HABITABLE DE 120 m (`1 u = 1 m`), MICROGRAVEDAD Y KRONOX IA 3D
          // =========================================================================
          localCabinWorld.visible = true;
          localCabinWorld.position.set(0, 0, 0);
          localCabinWorld.scale.set(1, 1, 1);
          localCabinWorld.quaternion.copy(q);

          // 1. Interpolación suave de giro de vista del astronauta en 1P / 3P
          astronautYaw += (targetYaw - astronautYaw) * Math.min(1, dt * 14);
          astronautPitch += (targetPitch - astronautPitch) * Math.min(1, dt * 14);

          const localLookQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(astronautPitch, astronautYaw, 0, 'YXZ'),
          );

          // 2. Motor físico 6-DOF real de microgravedad o tránsito físico animado por espina central
          const hasManualThrustInput = Boolean(
            keys.w ||
            keys.s ||
            keys.a ||
            keys.d ||
            keys.arrowup ||
            keys.arrowdown ||
            keys.arrowleft ||
            keys.arrowright ||
            keys[' '] ||
            keys.space ||
            keys.control ||
            keys.ctrl ||
            keys.q,
          );
          if (deckTransitState?.active && hasManualThrustInput) {
            deckTransitState = null;
          }

          let mgResult;
          if (deckTransitState?.active) {
            const wp = deckTransitState.waypoints[deckTransitState.index];
            const toWp = new V().subVectors(wp, astronautPos);
            const distToWp = toWp.length();
            const stepDist = deckTransitState.speed * Math.max(0.008, Math.min(0.05, dt));
            if (distToWp <= stepDist + 0.04) {
              astronautPos.copy(wp);
              deckTransitState.index += 1;
              if (deckTransitState.index >= deckTransitState.waypoints.length) {
                targetYaw = deckTransitState.targetYaw;
                astronautYaw = deckTransitState.targetYaw;
                targetPitch = -0.05;
                astronautPitch = -0.05;
                deckTransitState = null;
                astronautVel.set(0, 0, 0);
              }
            } else {
              toWp.normalize();
              astronautPos.addScaledVector(toWp, stepDist);
              astronautVel.copy(toWp).multiplyScalar(deckTransitState.speed);
              if (Math.hypot(toWp.x, toWp.z) > 0.25) {
                targetYaw = Math.atan2(-toWp.x, -toWp.z);
              }
            }
            fourDecksInterior.clampAstronautPosition(astronautPos);
            microgravityController.setPosition(astronautPos);
            mgResult = {
              position: astronautPos.clone(),
              velocity: astronautVel.clone(),
              speed: deckTransitState ? deckTransitState.speed : 0,
              mode: microgravityController.getMode(),
              anchoredRailId: null,
              isStabilizing: false,
              isBoosting: Boolean(deckTransitState),
            };
          } else if (activeCabinStation === 'nav' && !freeHelmMode) {
            astronautVel.set(0, 0, 0);
            microgravityController.setPosition(astronautPos);
            mgResult = {
              position: astronautPos.clone(),
              velocity: astronautVel.clone(),
              speed: 0,
              mode: microgravityController.getMode(),
              anchoredRailId: microgravityController.getAnchoredRailId(),
              isStabilizing: false,
              isBoosting: false,
            };
          } else {
            mgResult = microgravityController.update(dt, keys, localLookQuat);
            astronautPos.copy(mgResult.position);
            astronautVel.copy(mgResult.velocity);
          }

          const currentSpeed = mgResult.speed;
          const isWalking = currentSpeed > 0.06;

          // Actualización de avatar EVA 3D de 1.75 m articulado
          astronaut3D.root.visible = false;
          astronaut3D.firstPersonHands.visible = false;

          if (articulatedAstronaut) {
            let animState = ASTRONAUT_ANIMATION_STATES.IDLE_FLOAT;
            if (mgResult.anchoredRailId) {
              animState = ASTRONAUT_ANIMATION_STATES.GRAB_RAIL;
            } else if (mgResult.isStabilizing) {
              animState = ASTRONAUT_ANIMATION_STATES.STABILIZE;
            } else if (mgResult.isBoosting && isWalking) {
              animState = ASTRONAUT_ANIMATION_STATES.THRUSTER_BURST;
            } else if (activeCabinStation === 'sensor-calibration') {
              animState = ASTRONAUT_ANIMATION_STATES.REPAIR_INTERACT;
            } else if (activeCabinStation) {
              animState = ASTRONAUT_ANIMATION_STATES.CONSOLE_WORK;
            } else if (isWalking && currentSpeed > 2.0) {
              animState = ASTRONAUT_ANIMATION_STATES.CORRIDOR_SWIM;
            } else if (isWalking) {
              animState = ASTRONAUT_ANIMATION_STATES.HAND_PUSH;
            }
            articulatedAstronaut.root.position.copy(astronautPos);
            articulatedAstronaut.root.rotation.y = astronautYaw;
            articulatedAstronaut.root.visible = !cabinFirstPerson || (pv === 3 || exteriorCameraMode);
            articulatedAstronaut.updateAnimation(dt, animState);
          }

          // 3. Cámara interior 1P (ojos 1.65 m) o 3P (cuerpo completo EVA 1.75 m dentro del casco)
          let localCamPos;
          if (cabinFirstPerson) {
            const headBob = isWalking ? Math.sin(clk.elapsedTime * (keys.shift ? 11.5 : 8.2)) * (0.01 * Math.min(1.2, currentSpeed / 1.4)) : 0;
            localCamPos = new V(
              astronautPos.x,
              astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS + headBob + freeHelmBlend * 0.18,
              astronautPos.z + (-13.2 - astronautPos.z) * freeHelmBlend,
            );
            fourDecksInterior.clampAstronautPosition(localCamPos, 0.25, 0.24);
          } else {
            const distBehind = 2.38;
            const shoulderBias = 0.56;
            const camBack = new V(
              Math.sin(astronautYaw) * distBehind * Math.cos(astronautPitch) + Math.cos(astronautYaw) * shoulderBias,
              -Math.sin(astronautPitch) * distBehind,
              Math.cos(astronautYaw) * distBehind * Math.cos(astronautPitch) - Math.sin(astronautYaw) * shoulderBias,
            );
            localCamPos = new V(
              astronautPos.x + camBack.x,
              astronautPos.y + 1.18 + camBack.y,
              astronautPos.z + camBack.z,
            );
            // Brazo elástico 3P: evita que una silla, mamparo o consola tape al astronauta (excluye sprites y hologramas)
            if (fourDecksInterior?.root && typeof THREE.Raycaster === 'function') {
              const pivotOrigin = new V(astronautPos.x, astronautPos.y + 1.32, astronautPos.z);
              const armVec = localCamPos.clone().sub(pivotOrigin);
              const armLen = armVec.length();
              if (armLen > 0.2) {
                localCabinWorld.updateMatrixWorld(true);
                localCam.updateMatrixWorld(true);
                const armRay = new THREE.Raycaster(pivotOrigin, armVec.clone().divideScalar(armLen), 0.15, armLen);
                armRay.camera = localCam;
                const armMeshes = [];
                fourDecksInterior.root.traverse((obj) => {
                  if (obj.isMesh && obj.visible) armMeshes.push(obj);
                });
                const armHits = armRay.intersectObjects(armMeshes, false);
                const blocking = armHits.find((h) => {
                  const m = h.object?.material;
                  if (!m) return false;
                  if (m.transparent && !m.isShaderMaterial && m.opacity < 0.6) return false;
                  return h.distance > 0.25 && h.distance < armLen - 0.12;
                });
                if (blocking) {
                  const safeDist = Math.max(0.85, blocking.distance - 0.28);
                  localCamPos.copy(pivotOrigin).addScaledVector(armVec.normalize(), safeDist);
                }
              }
            }
            fourDecksInterior.clampAstronautPosition(localCamPos, 0.24, 0.24);
          }
          const localEyeOffsetMeters = localCamPos.clone().applyQuaternion(q);
          const baseCabinFov = cabinFirstPerson ? Math.min(fovBase, 42) : Math.min(fovBase, 48);

          localCam.position.copy(localEyeOffsetMeters);
          localCam.quaternion.copy(q).multiply(localLookQuat);
          localCam.near = 0.05;
          localCam.far = 4000;
          localCam.fov = baseCabinFov;
          localCam.updateProjectionMatrix();

          cam.position.copy(sp).addScaledVector(localEyeOffsetMeters, metersToAstroSceneUnits());
          cam.quaternion.copy(localCam.quaternion);
          cam.near = isPhysicalObservationActive() ? 1e-5 : 0.05;
          cam.fov =
            activeOpticalMag > 1
              ? computeTelescopeFieldOfView(baseCabinFov, activeOpticalMag)
              : baseCabinFov;
          cam.updateProjectionMatrix();

          // Si el astronauta se aleja de una consola activa (> 3.0 m), cerrar automáticamente la interfaz
          if (activeCabinStation) {
            const activeStObj = getStationDef(activeCabinStation);
            if (activeStObj) {
              const distFromActive = Math.hypot(
                astronautPos.x - activeStObj.position.x,
                (astronautPos.y - activeStObj.position.y) * 0.65,
                astronautPos.z - activeStObj.position.z,
              );
              if (distFromActive > 3.0) {
                activeCabinStation = null;
                aiFollowAstronaut = true;
                luminousAI.pointAtWorldPosition(null, false);
                S.onStationInteract?.(null);
              }
            }
          }

          nearestCabinStation = fourDecksInterior.findNearestInteractiveStation(astronautPos, 2.15);

          // Detección contextual inteligente de aproximación de KRONOX IA a la consola más cercana
          if (nearestCabinStation && !activeCabinStation && !guidedTourState) {
            if (nearestCabinStation.distance < 2.15 && luminousAI.getState() !== 'Señalización') {
              luminousAI.setTargetPosition(nearestCabinStation.station.aiHoverPos, 'Explicación');
              luminousAI.pointAtWorldPosition(null, false);
            }
          } else if (!guidedTourState && luminousAI.getPointedTarget()) {
            luminousAI.pointAtWorldPosition(null, false);
          }

          const nearId = nearestCabinStation ? nearestCabinStation.station.id : null;
          const activeDeck = resolveCurrentDeck(astronautPos);
          announceDeckContextIfChanged(activeDeck?.id, false);
          if (nearId !== lastNearestStationId) {
            lastNearestStationId = nearId;
            S.onNearestStationChange?.(
              nearestCabinStation
                ? {
                  ...nearestCabinStation.station,
                  distance: Number(nearestCabinStation.distance.toFixed(2)),
                }
                : null,
            );
          }
          if (guidedTourState && guidedTourState.step === 'bridge' && nearId === 'nav') {
            setTourStep('nav', 'nav');
            S.onGuideObjective?.('OBJETIVO: Acércate a la consola de navegación y úsala con E.');
          }
          if (guidedTourState?.focus && nearId === guidedTourState.focus && !guidedTourState.proximityAnnounced) {
            guidedTourState.proximityAnnounced = true;
            S.onAiTourNarrative?.(tourNarratives[guidedTourState.focus], 'Explicación', guidedTourState.focus);
          }

          fourDecksInterior.updateStations(
            clk.elapsedTime,
            guidedTourState?.focus ? (nearId === guidedTourState.focus ? nearId : null) : nearId,
            guidedTourState?.focus ? (activeCabinStation === guidedTourState.focus ? activeCabinStation : null) : activeCabinStation,
            guidedTourState?.focus || null,
            freeHelmMode,
            astronautPos,
            activeRepairStage,
          );

          if (guidedTourState?.step === 'free') {
            guidedTourState = null;
          }
          if (!guidedTourState && aiFollowAstronaut) {
            const companionSide = Math.sin(clk.elapsedTime * 0.15) > 0 ? 0.95 : -0.95;
            const companionOffset = new V(
              companionSide,
              1.48 + Math.sin(clk.elapsedTime * 1.6) * 0.06,
              -1.45,
            ).applyAxisAngle(new V(0, 1, 0), astronautYaw);
            const companionTarget = astronautPos.clone().add(companionOffset);
            fourDecksInterior.clampAstronautPosition(companionTarget, 0.35, 0.25);
            luminousAI.setTargetPosition(
              companionTarget,
              isWalking ? 'Acompañamiento' : aiSpeakingState ? 'Comunicación' : 'Acompañamiento',
            );
          }

          luminousAI.update(dt, clk.elapsedTime, aiSpeakingState, aiAudioLevelState);

          if (clk.elapsedTime - lastScreenProjectionTime > 0.04) {
            lastScreenProjectionTime = clk.elapsedTime;
            localCabinWorld.updateMatrixWorld(true);
            localCam.updateMatrixWorld(true);
            const aiWorldPos = luminousAI.group.getWorldPosition(new V());
            const projected = aiWorldPos.clone().project(localCam);
            const inFront = projected.z >= -1 && projected.z <= 1;
            const sx = (projected.x * 0.5 + 0.5) * innerWidth;
            const sy = (-projected.y * 0.5 + 0.5) * innerHeight;
            const currentDeck = resolveCurrentDeck(astronautPos);
            if (S.onAiScreenProjection) {
              S.onAiScreenProjection({
                visible: inFront && sx >= -100 && sx <= innerWidth + 100 && sy >= -100 && sy <= innerHeight + 100,
                x: Math.round(sx),
                y: Math.round(sy),
                state: luminousAI.getState(),
                astronautX: Number(astronautPos.x.toFixed(2)),
                astronautY: Number(astronautPos.y.toFixed(2)),
                astronautZ: Number(astronautPos.z.toFixed(2)),
                deckId: currentDeck.id,
                deckName: currentDeck.name,
                microgravityMode: mgResult.mode,
                microgravitySpeed: mgResult.speed,
                anchoredRailId: mgResult.anchoredRailId,
                cabinFirstPerson,
              });
            }

            if (activeCabinStation && S.onConsoleScreenProjection) {
              const stObj = getStationDef(activeCabinStation);
              const stEntry = fourDecksInterior.stationMeshes.find((m) => m.id === activeCabinStation);
              if (stObj && stEntry && stEntry.screenMesh) {
                const screenWorldPos = stEntry.screenMesh.getWorldPosition(new V());
                const pScreen = screenWorldPos.clone().project(localCam);
                const screenInFront = pScreen.z >= -1 && pScreen.z <= 1;
                const scX = (pScreen.x * 0.5 + 0.5) * innerWidth;
                const scY = (-pScreen.y * 0.5 + 0.5) * innerHeight;
                const distToCam = localCam.position.distanceTo(screenWorldPos);

                const scaleFactor = Math.max(0.65, Math.min(1.25, 2.6 / Math.max(1.2, distToCam)));
                S.onConsoleScreenProjection({
                  activeStationId: activeCabinStation,
                  visible: screenInFront && distToCam < 4.8,
                  x: Math.round(scX),
                  y: Math.round(scY),
                  scale: Number(scaleFactor.toFixed(3)),
                  distMeters: Number(distToCam.toFixed(2)),
                  speed: Number(vel.length().toFixed(2)),
                  inertia: Number(ac.toFixed(3)),
                  heading: Math.round((((vel.lengthSq() > 1e-8 ? Math.atan2(vel.x, -vel.z) * 57.2958 : -fy * 57.2958) % 360) + 360) % 360),
                  pitch: Math.round(vel.lengthSq() > 1e-8 ? Math.atan2(vel.y, Math.hypot(vel.x, vel.z)) * 57.2958 : -fp * 57.2958),
                  flightMode: nav ? 'AUTOPILOTO' : activeCabinStation === 'nav' ? 'MANUAL' : 'ESPERA',
                });
              }
            } else if (S.onConsoleScreenProjection) {
              S.onConsoleScreenProjection(null);
            }
          }
        } else {
          localCabinWorld.visible = false;
          if (exteriorCameraMode) {
            const shipDelta = sp.clone().sub(exteriorLastShipPosition);
            if (shipDelta.lengthSq() > 0) {
              cam.position.add(shipDelta);
              ct.target.add(shipDelta);
              if (exteriorCameraTransition) {
                exteriorCameraTransition.fromPosition.add(shipDelta);
                exteriorCameraTransition.fromTarget.add(shipDelta);
                exteriorCameraTransition.toPosition.add(shipDelta);
                exteriorCameraTransition.toTarget.add(shipDelta);
              }
              exteriorLastShipPosition.copy(sp);
            }
            if (exteriorCameraTransition) {
              const transition = exteriorCameraTransition;
              transition.elapsed = Math.min(transition.duration, transition.elapsed + dt);
              const amount = transition.elapsed / transition.duration;
              const eased = amount * amount * (3 - 2 * amount);
              cam.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
              ct.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
              cam.lookAt(ct.target);
              if (amount >= 1) {
                exteriorCameraTransition = null;
                ct.enabled = true;
              }
            }
            const metricOffset = cam.position.clone().sub(sp);
            localCam.position.copy(metricOffset);
            localCam.quaternion.copy(cam.quaternion);
            localCam.near = 0.25;
            localCam.far = Math.max(6000, metricOffset.length() * 25);
            localCam.fov = fovBase;
            localCam.updateProjectionMatrix();
          } else {
            const chaseMeters = new V(0.28, 0.16, 1.0)
              .multiplyScalar(shipCameraDistanceMeters() * (pv == 3 ? 1 : 0))
              .applyQuaternion(q);
            localCam.position.copy(chaseMeters);
            localCam.quaternion.copy(q);
            localCam.near = 0.25;
            localCam.far = 6000;
            localCam.fov = fovBase;
            localCam.updateProjectionMatrix();

            cam.quaternion.copy(q);
            const pilotQuaternion = cam.quaternion.clone(),
              pilotPosition = sp
                .clone()
                .addScaledVector(chaseMeters, metersToAstroSceneUnits());
            if (launchSequence) {
              cam.position.copy(sp).add(launchSequence.cameraOffset);
              cam.lookAt(sp);
              localCam.quaternion.copy(cam.quaternion);
            } else if (launchCameraBlend) {
              const blend = launchCameraBlend;
              blend.elapsed = Math.min(blend.duration, blend.elapsed + dt);
              const amount = blend.elapsed / blend.duration,
                eased = amount * amount * (3 - 2 * amount);
              cam.position.lerpVectors(blend.fromPosition, pilotPosition, eased);
              cam.quaternion.copy(blend.fromQuaternion).slerp(pilotQuaternion, eased);
              localCam.quaternion.copy(cam.quaternion);
              if (amount >= 1) launchCameraBlend = null;
            } else {
              cam.position.copy(pilotPosition);
            }
            cam.fov =
              activeOpticalMag > 1
                ? computeTelescopeFieldOfView(fovBase, activeOpticalMag)
                : fovBase;
            cam.near = isPhysicalObservationActive() ? 1e-5 : 0.05;
            cam.updateProjectionMatrix();
          }
        }
      }
      // Navigation owns this pose until the last arriving frame; ordinary controls inherit the same heading.
      if (routeForFrame) {
        const route = routeForFrame, u = THREE.MathUtils.smoothstep(route.phaseProgress, 0, 1);
        let activeLocalOffsetMeters;
        if (pv === 1) {
          if (route.phase === 'PREPARING') { astronautPos.lerpVectors(route.cabinStart, route.cabinLookout, u); astronautPos.x -= Math.sin(u * Math.PI) * 1.2; astronautVel.set(0, 0, 0); }
          else { astronautPos.copy(route.cabinLookout); astronautVel.set(0, 0, 0); }
          microgravityController.setPosition(astronautPos);
          localCabinWorld.visible = true; localCabinWorld.position.set(0, 0, 0); localCabinWorld.scale.set(1, 1, 1); localCabinWorld.quaternion.copy(q);
          activeLocalOffsetMeters = new V(astronautPos.x, astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS, astronautPos.z).applyQuaternion(q);
        } else {
          localCabinWorld.visible = false;
          activeLocalOffsetMeters = new V(0.28, 0.16, 1.0).multiplyScalar(shipCameraDistanceMeters()).applyQuaternion(q);
        }
        localCam.position.copy(activeLocalOffsetMeters);
        cam.position.copy(sp).addScaledVector(activeLocalOffsetMeters, metersToAstroSceneUnits());
        cam.lookAt(route.target);
        localCam.quaternion.copy(cam.quaternion);
        if (pv === 1 && !cabinFirstPerson) {
          // Converge the same over-shoulder pose used by ordinary cabin controls.
          // This keeps third-person arrivals continuous when camera ownership returns.
          for (let i = 0; i < 6; i++) {
            const localLook = q.clone().invert().multiply(cam.quaternion),
              offset = new V(0, 0, -1).applyQuaternion(localLook).multiplyScalar(-1.85).add(new V(0, .32, 0)).add(new V(1, 0, 0).applyQuaternion(localLook).multiplyScalar(.55)),
              eye = new V(astronautPos.x, astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS, astronautPos.z).add(offset);
            fourDecksInterior.clampAstronautPosition(eye, 0.25, 0.24);
            const eyeWorldMeters = eye.applyQuaternion(q);
            localCam.position.copy(eyeWorldMeters);
            cam.position.copy(sp).addScaledVector(eyeWorldMeters, metersToAstroSceneUnits());
            cam.lookAt(route.target);
            localCam.quaternion.copy(cam.quaternion);
          }
        }
        if (route.phase === 'PREPARING') {
          const targetLocalMeters = pv === 1 ? new V(astronautPos.x, astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS, astronautPos.z) : new V(0.28, 0.16, 1.0).multiplyScalar(shipCameraDistanceMeters());
          const blendedLocalMeters = new V().lerpVectors(route.cameraStartLocalOffset, targetLocalMeters, u).applyQuaternion(q);
          localCam.position.copy(blendedLocalMeters);
          cam.position.copy(sp).addScaledVector(blendedLocalMeters, metersToAstroSceneUnits());
          const localLook = route.cameraStartLocalQuaternion.clone().slerp(new THREE.Quaternion(), u);
          localCam.quaternion.copy(q).multiply(localLook);
          cam.quaternion.copy(localCam.quaternion);
        }
        if (pv === 1) { const head = new THREE.Euler().setFromQuaternion(q.clone().invert().multiply(cam.quaternion), 'YXZ'); astronautYaw = targetYaw = head.y; astronautPitch = targetPitch = head.x; }
      }
      const inDeepCruiseShowcase = Boolean(
        realTimeIntro &&
          realTimeIntro.phase !== 'opening' &&
          realTimeIntro.stageNotified >= 2 &&
          realTimeIntro.stageNotified <= 4 &&
          ship.visible,
      );
      const tt = mainMenuOrbitActive
        ? 0.36 + 0.08 * Math.sin(ti * 2.1)
        : inDeepCruiseShowcase
          ? 0.94 + 0.14 * Math.sin(ti * 4.8)
          : realTimeIntro
            ? 0.08
            : ti < 5
              ? 1.2 * (1 - Math.min(1, Math.max(0, (ti - 3.2) / 1.8))) + 0.3
              : Math.min(1.6, vel.length() / fs) + 0.15;
      th += (tt - th) * Math.min(1, dt * 6);
      if (!realTimeIntro && !sceneDirector.getState().activeSequence) {
        ship.visible =
          !!launchSequence ||
          (!!launchCameraBlend && pv == 1) ||
          pv == 3;
      }
      // En el Mundo Local Métrico (`localShipScene`, 1 u = 1 m), la nave está anclada en (0,0,0) con sus 120.0 m:
      ship.position.set(0, 0, 0);
      ship.scale.setScalar(SHIP_METRIC_SCALE);
      ship.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), bk));
      const hideOversizedLegacyPlumes = Boolean(mainMenuOrbitActive || realTimeIntro);
      fl2.visible = !hideOversizedLegacyPlumes;
      fl2.scale.setScalar(0.6 + 1.2 * th);
      if (modularShip) modularShip.update(dt, th, inDeepCruiseShowcase ? 0.88 : lastWarpAmount);
      FL.forEach((o, i) => {
        o.c.visible = !hideOversizedLegacyPlumes;
        o.k.visible = !hideOversizedLegacyPlumes;
        o.g.visible = !hideOversizedLegacyPlumes;
        const L = (0.3 + 1.7 * th) * (1 + 0.1 * Math.sin(ti * 45 + i * 2));
        o.c.scale.set(1 + 0.3 * th, L, 1 + 0.3 * th);
        o.c.position.z = o.z + 0.5 * L;
        o.k.scale.set(1, L * 0.55, 1);
        o.k.position.z = o.z + 0.27 * L;
        o.g.scale.setScalar(0.35 + 0.5 * th);
      });
      NL.forEach((n, i) => (n.visible = Math.sin(ti * 4 + i * 3) > -0.2));
      if (O.tr && pv == 3 && kk > 0.9 && th > 0.3) {
        const tp = new V(0, 0, 1.3 * sz).applyQuaternion(q).add(sp);
        for (let j = 0; j < 4; j++) {
          TS.i = (TS.i + 1) % TRN;
          const o = TS.i * 3;
          TP[o] = tp.x + gs() * sz * 0.08;
          TP[o + 1] = tp.y + gs() * sz * 0.08;
          TP[o + 2] = tp.z + gs() * sz * 0.08;
          TB[TS.i] = ti;
        }
      }
      for (let j = 0; j < TRN; j++) {
        const b = Math.max(0, Math.min(1, 1 - (ti - TB[j]) / 2.6)) * Math.min(1, th);
        TC[j * 3] = 0.4 * b;
        TC[j * 3 + 1] = 0.7 * b;
        TC[j * 3 + 2] = b;
      }
      tr.geometry.attributes.position.needsUpdate = tr.geometry.attributes.color.needsUpdate = true;
      yw *= Math.exp(-dt * 5);
      yp *= Math.exp(-dt * 5);
      const navActive = Boolean(nav && nav.long && (
        nav.phase === 'HYPERSPACE_ENTRY' ||
        nav.phase === 'HYPERSPACE_CRUISE' ||
        nav.phase === 'HYPERSPACE_EXIT'
      ));
      const navWarpAmount = navActive ? (
        nav.phase === 'HYPERSPACE_CRUISE' ? 0.55 :
          nav.phase === 'HYPERSPACE_ENTRY' ? (0.15 + 0.4 * THREE.MathUtils.smoothstep(nav.phaseProgress, 0, 1)) :
            nav.phase === 'HYPERSPACE_EXIT' ? (0.55 - 0.4 * THREE.MathUtils.smoothstep(nav.phaseProgress, 0, 1)) :
              0
      ) : 0;
      lastWarpAmount = navWarpAmount;
      const wc = document.getElementById('warp'),
        wg = wc && wc.getContext('2d');
      if (wg) {
        const targetWidth = Math.round(innerWidth * R.getPixelRatio()), targetHeight = Math.round(innerHeight * R.getPixelRatio());
        if (wc.width !== targetWidth) wc.width = targetWidth; if (wc.height !== targetHeight) wc.height = targetHeight;
        const w = wc.width,
          h = wc.height,
          cx = w * 0.5,
          cy = h * 0.5;
        const amount = navWarpAmount;
        wg.clearRect(0, 0, w, h);
        wc.style.opacity = amount.toFixed(2);
        if (amount > 0.01) {
          for (let si = 0; si < warpStars.length; si++) {
            const s = warpStars[si];
            s.p += dt * (0.35 + amount * 3.8);
            if (s.p > 1) {
              s.p = 0;
              s.x = Math.random();
              s.y = Math.random();
            }
            const x = s.x * w,
              y = s.y * h,
              dx = x - cx,
              dy = y - cy,
              d = Math.hypot(dx, dy) || 1,
              len = (24 + amount * 360) * s.r * amount;
            wg.beginPath();
            wg.moveTo(x, y);
            wg.lineTo(x + (dx / d) * len, y + (dy / d) * len);
            const colorTone = si % 8 === 0 ? 'rgba(255,255,255,' : si % 5 === 0 ? 'rgba(251,146,60,' : si % 3 === 0 ? 'rgba(56,189,248,' : 'rgba(0,240,255,';
            wg.strokeStyle = colorTone + ((0.42 + amount * 0.58) * s.r).toFixed(3) + ')';
            wg.lineWidth = (1.1 + amount * 2.8) * s.r * R.getPixelRatio();
            wg.stroke();
          }
        }
        if (nav && nav.long && (nav.phase === 'HYPERSPACE_ENTRY' || nav.phase === 'HYPERSPACE_EXIT')) {
          const pulse = Math.sin(Math.PI * nav.phaseProgress);
          const gr = wg.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
          gr.addColorStop(0, 'rgba(255,255,255,' + (0.95 * pulse).toFixed(3) + ')');
          gr.addColorStop(0.08, 'rgba(165,243,252,' + (0.85 * pulse).toFixed(3) + ')');
          gr.addColorStop(0.35, 'rgba(14,165,233,' + (0.45 * pulse).toFixed(3) + ')');
          gr.addColorStop(0.7, 'rgba(2,132,199,' + (0.15 * pulse).toFixed(3) + ')');
          gr.addColorStop(1, 'rgba(10,35,100,0)');
          wg.fillStyle = gr;
          wg.fillRect(0, 0, w, h);
        }
      }
      if (pv == 1) {
        const y = document.getElementById('yk'),
          t = document.getElementById('tb');
        if (y)
          y.style.transform =
            'translateY(' +
            Math.max(-40, Math.min(40, -yp * 0.8)) +
            'px) rotate(' +
            Math.max(-60, Math.min(60, -bk * 80 + yw * 0.6)) +
            'deg)';
        if (t) t.style.transform = 'scaleX(' + Math.min(1, th / 1.2) + ')';
        const g = (i) => document.getElementById(i),
          sp2 = vel.length(),
          lvn =
            fs < 5
              ? [1, 'PLANETA']
              : fs < 300
                ? [2, 'SISTEMA']
                : fs < 8000
                  ? [3, 'GALAXIA']
                  : [4, 'HIPER'],
          tx = (i, v) => {
            const o = g(i);
            if (o) o.textContent = v;
          },
          nf = (v) => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
        tx('lv', 'NIVEL ' + lvn[0] + '/4 · ' + lvn[1]);
        for (let stage = 1; stage <= 4; stage++) {
          const point = g('speedStage' + stage);
          if (point) point.classList.toggle('active', stage === lvn[0]);
        }
        tx(
          'ls',
          'AJUSTE ' + nf(fs) + ' u/s' + (keys.shift ? ' · BOOST ×5' : '') + (O.au ? ' · AUTO' : ''),
        );
        const speedRatio = Math.max(0, Math.min(1, sp2 / (fs * (keys.shift ? 5 : 1))));
        const inertiaRatio = Math.max(0, Math.min(1, ac / (fs * (O.in ? 1.5 : 15))));
        const heading = (((-fy * 57.2958) % 360) + 360) % 360;
        const needle = (id, degrees) => {
          const dialNeedle = g(id);
          if (dialNeedle) dialNeedle.style.transform = `rotate(${degrees}deg)`;
        };
        needle('needleSpeed', -135 + speedRatio * 270);
        needle('needleInertia', -135 + inertiaRatio * 270);
        needle('needleHeading', heading);
        tx('gaugeSpeedValue', nf(sp2));
        tx('gaugeInertiaValue', nf(ac));
        tx('gaugeHeadingValue', Math.round(heading) + '°');
      }
    } else {
      lastWarpAmount = 0;
      localCabinWorld.visible = false;
      if (!spectator && !realTimeIntro) {
        ship.visible = false;
      }
      if (mv.lengthSq()) {
        const f = new V();
        cam.getWorldDirection(f);
        const r = new V().crossVectors(f, cam.up).normalize(),
          st = cam.position.distanceTo(ct.target) * 0.02,
          w = f
            .multiplyScalar(mv.x)
            .addScaledVector(cam.up, mv.y)
            .addScaledVector(r, mv.z)
            .multiplyScalar(st);
        cam.position.add(w);
        ct.target.add(w);
        if (foc) {
          foc = null;
          S.f(null);
        }
      }
    }
    {
      const ph = fl.gal ? (sim / (365.25 * 230)) * TAU : 0;
      GU.uP.value = ph;
      if (fl.gal && navigationContext.id === 'milkyway') GU.uT.value += dt * 0.004;
      gal.position.fromArray(SOLAR_GALACTIC_ANCHOR).applyAxisAngle(new V(0, 1, 0), -ph).applyQuaternion(gal.quaternion).negate();
      LB.forEach((l) => (l.visible = (l.parent === macroGalacticGroup || !!fl.lab) && !nav && !realTimeIntro && !contextOverview && !nearbyMapState));
      missionMarkerEffects.forEach(effect => effect.update(cam));
      // Preservar la visibilidad de la reconstrucción morfológica 3D de las galaxias al observarlas desde la nave
      missionMarkers.forEach(({ target, marker }) => {
        if (target?.type === 'galaxia') {
          const detail = marker.children.find(ch => ch.isGroup && !ch.userData?.isMorphologyLayer);
          if (detail && cam.position.distanceTo(marker.position) < 4500) {
            detail.visible = true;
          }
        }
      });

      const activeMissionMarker = activeMissionKey && missionMarkers.get(activeMissionKey);
      if (activeMissionMarker) activeMissionMarker.label.visible = !nav && !realTimeIntro && !contextOverview && !nearbyMapState;
      B[0].glow.scale.setScalar(Math.max(B[0].r * (real ? 40 : 6), cam.position.length() * 0.012));
      if (foc && S.d) S.d(foc.au || 0);
    }
    if (nearbyMapState) {
      nearbyGalaxyGroup.position.set(0, 0, 0);
      nearbyGalaxyGroup.quaternion.identity();
      const solarGalacticRadius = Math.hypot(24500, 3500);
      // Keep the solar-system marker on the same visible disk rotation as the
      // Milky Way. The additional map-only phase makes that schematic motion
      // perceptible without changing the physical simulation clock.
      galacticMapDisk.rotation.y = -(
        GU.uP.value +
        GU.uT.value * (RG / Math.max(solarGalacticRadius, 6000) - 1) +
        nearbyMapRotation
      );
      if (fl.gal) nearbyMapRotation = (nearbyMapRotation + dt * 0.12) % TAU;
      solarSystemLabel.visible =
        nearbySelectedKey === 'milky-way' ||
        cam.position.distanceTo(solarSystemMapMarker.getWorldPosition(nearbyMarkerWorld)) < 170;
      solarMapPlanets.forEach(({ planet, marker, visualOrbitRadius }) => {
        const orbitalPosition = pos(planet, sim);
        marker.position.set(
          (orbitalPosition.x / planet.au) * visualOrbitRadius,
          0,
          (orbitalPosition.z / planet.au) * visualOrbitRadius,
        );
      });
      nearbyGalaxyMarkers.forEach((marker, key) => {
        marker.userData.label.visible =
          key === nearbySelectedKey ||
          cam.position.distanceTo(marker.getWorldPosition(nearbyMarkerWorld)) < 280;
      });
    }
    if (tw && !introOwnedThisFrame && !realTimeIntro && !cabinReentryBlend) {
      tw.k = Math.min(1, tw.k + dt / 1.6);
      const e = tw.k * tw.k * (3 - 2 * tw.k);
      cam.position.lerpVectors(tw.p0, tw.p1, e);
      ct.target.lerpVectors(tw.t0, tw.t1, e);
      if (tw.k >= 1) tw = null;
    }
    if ((!free || exteriorCameraMode) && !introOwnedThisFrame && !realTimeIntro && !mainMenuOrbitActive && !cabinReentryBlend) {
      ct.update();
      if (exteriorCameraMode || spectator) {
        const metricOffset = cam.position.clone().sub(sp);
        localCam.position.copy(metricOffset);
        localCam.quaternion.copy(cam.quaternion);
        localCam.near = 0.25;
        localCam.far = Math.max(6000, metricOffset.length() * 25);
        localCam.updateProjectionMatrix();
      }
    }
    if (cabinReentryBlend && !realTimeIntro) { const blend = cabinReentryBlend; blend.elapsed = Math.min(1.1, blend.elapsed + dt); const u = blend.elapsed / 1.1, e = u * u * (3 - 2 * u), toPosition = cam.position.clone(), toQuaternion = cam.quaternion.clone(); cam.position.lerpVectors(blend.position, toPosition, e); cam.quaternion.copy(blend.quaternion).slerp(toQuaternion, e); if (u >= 1) cabinReentryBlend = null; }
    const inIntroGalaxyScene = Boolean(
      realTimeIntro &&
      realTimeIntro.phase === 'cinematic' &&
      realTimeIntro.stageNotified === 3,
    );
    macroGalacticGroup.visible =
      inIntroGalaxyScene ||
      macroGalacticVisible(navigationContext.id, {
        cinematic: !!realTimeIntro,
        nearbyMap: !!nearbyMapState,
      });
    if (!free || contextOverview || nearbyMapState || spectator || exteriorCameraMode || mainMenuOrbitActive) {
      localCabinWorld.visible = false;
    }
    if ((!free && !spectator && !realTimeIntro && !mainMenuOrbitActive) || contextOverview || nearbyMapState) {
      ship.visible = false;
    }
    deepGalaxyBackdrop.visible = false;
    const showNearbyGalaxies = Boolean(nearbyMapState || navigationContext.id === 'extragalactic' || activeMissionKey === 'm31' || activeMissionKey === 'm82');
    nearbyGalaxyGroup.visible = showNearbyGalaxies;
    if (showNearbyGalaxies) {
      nearbyGalaxyMarkers.forEach((grp) => {
        const morph = grp.getObjectByName(`kronox-galaxy-morphology-${grp.userData?.nearbyGalaxyKey}`);
        if (morph) {
          morph.rotation.z += dt * 0.008;
        }
      });
    }
    if (isCabinActive) {
      missionMarkers.forEach(({ marker }) => {
        if (marker) {
          marker.visible = true;
        }
      });
    }
    const inStellarAtlas = contextOverview && !nearbyMapState && navigationContext.id === 'stellar', inRegionalAtlas = contextOverview && !nearbyMapState && navigationContext.id === 'regional';
    stellarAtlas.group.visible = inStellarAtlas; regionalAtlas.group.visible = inRegionalAtlas; missionDestinationGroup.visible = !contextOverview && !nearbyMapState;
    for (const b of B) { if (b.orbit) b.orbit.visible = solarOrbitVisibility > 0.01; }
    crossScaleState = updateCrossScaleContinuity({
      navigationContextId: navigationContext.id,
      contextOverview,
      nearbyMapState: !!nearbyMapState,
      cameraPosition: cam.position,
      solarBodies: B,
      asteroidBelt: belt,
      stellarAtlas,
      regionalAtlas,
      macroGalacticGroup,
      nearbyGalaxyMarkers,
    });
    observerFirmament.syncDomeToCamera(cam.position);
    if (nearbyMapState) placeAtlasLabels(galaxyLabelEntries.slice().sort((a, b) => (b.key === nearbySelectedKey) - (a.key === nearbySelectedKey)), cam, { width: innerWidth, height: innerHeight, left: innerWidth > 1100 ? 325 : 12, right: innerWidth > 800 ? 350 : 12 });
    if (inStellarAtlas || inRegionalAtlas) { const atlas = inStellarAtlas ? stellarAtlas : regionalAtlas; placeAtlasLabels(atlas.update(cam, selectedContextStar), cam, { width: innerWidth, height: innerHeight, left: innerWidth > 1100 ? 325 : 12, right: innerWidth > 800 ? 320 : 12 }); }
    if (hyperspace) hyperspace.update(nav, cam, dt);
    astronomicalHologram.update(dt, clk.elapsedTime, isCabinActive && localCabinWorld.visible);

    // Sincronizar la dirección de la luz solar en el Mundo Local Métrico (`localShipScene`)
    const toSunDir =
      sp.lengthSq() > 1e-12
        ? sp.clone().negate().normalize()
        : new V(0.6, 0.35, 0.7).normalize();
    localShipSunLight.position.copy(toSunDir).multiplyScalar(450);

    // PASO 1 DE RENDERIZADO: Mundo Astronómico (`sc`) con Floating Origin en doble precisión
    let savedExteriorCamPos = null;
    if (exteriorCameraMode || spectator) {
      const metricOffset = cam.position.clone().sub(sp);
      savedExteriorCamPos = cam.position.clone();
      cam.position.copy(sp).addScaledVector(metricOffset, metersToAstroSceneUnits());
    }
    originRebaseState = renderWithOriginRebase(R, sc, cam, {
      threshold: isPhysicalObservationActive() ? 0.001 : 10000,
      cellSize: isPhysicalObservationActive() ? 0 : 1024,
      highPrecisionBodies: isPhysicalObservationActive() ? B : null,
    });
    if (savedExteriorCamPos) {
      cam.position.copy(savedExteriorCamPos);
    }

    // PASO 2 DE RENDERIZADO: Mundo Local Métrico (`localShipScene`, `1 u = 1 m`) con limpieza de profundidad
    if (localCabinWorld.visible || ship.visible) {
      const inInteriorLighting = Boolean(localCabinWorld.visible && !exteriorCameraMode && !spectator);
      localShipAmbient.intensity = inInteriorLighting ? 0.17 : 0.52;
      localShipHemi.intensity = inInteriorLighting ? 0.22 : 0.45;
      localShipSunLight.intensity = inInteriorLighting ? 0.68 : 2.35;
      const prevAutoClear = R.autoClear;
      R.autoClear = false;
      R.clearDepth?.();
      R.render(localShipScene, localCam);
      R.autoClear = prevAutoClear;
      R.scene = sc;
      R.camera = cam;
      R.localScene = localShipScene;
      R.localCamera = localCam;
    }
  }
  function applyCameraView(v) {
    if (!userCameraAvailable()) return false;
    const wasExteriorInspection = exteriorCameraMode;
    if (wasExteriorInspection) leaveExteriorCamera(true);
    pv = v;
    if (v == 1) {
      cabinFirstPerson = true;
      astronaut3D.root.visible = false;
      astronaut3D.firstPersonHands.visible = false;
      if (articulatedAstronaut) articulatedAstronaut.root.visible = false;
      if (!nav && !arrivalTarget) {
        astronautYaw = 0;
        targetYaw = 0;
        astronautPitch = 0;
        targetPitch = 0;
      }
    } else if (articulatedAstronaut) {
      articulatedAstronaut.root.visible = false;
    }
    const baseFov = v == 1 ? Math.min(fovBase, 42) : fovBase;
    const activeMag = opticalTelescopeState.enabled ? opticalTelescopeState.magnification : 1;
    cam.near = isPhysicalObservationActive() ? 1e-5 : 0.05;
    cam.fov = activeMag > 1 ? computeTelescopeFieldOfView(baseFov, activeMag) : baseFov;
    cam.updateProjectionMatrix();
    localCam.near = v == 3 ? 0.25 : 0.05;
    localCam.far = v == 3 ? 6000 : 4000;
    localCam.fov = baseFov;
    localCam.updateProjectionMatrix();
    GU.uH.value = (innerHeight * R.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    if (free && !wasExteriorInspection) {
      ship.visible = v == 3;
      localCabinWorld.visible = v == 1;
      const q = ship.quaternion.clone();
      if (v == 1) {
        const localLookQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(astronautPitch, astronautYaw, 0, 'YXZ'),
        );
        const localEye = new V(
          astronautPos.x,
          astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS,
          astronautPos.z,
        ).applyQuaternion(q);
        localCam.position.copy(localEye);
        localCam.quaternion.copy(q).multiply(localLookQuat);
        cam.position.copy(sp).addScaledVector(localEye, metersToAstroSceneUnits());
        cam.quaternion.copy(localCam.quaternion);
      } else {
        const chaseMeters = new V(0.28, 0.16, 1.0)
          .multiplyScalar(shipCameraDistanceMeters())
          .applyQuaternion(q);
        localCam.position.copy(chaseMeters);
        localCam.quaternion.copy(q);
        cam.quaternion.copy(q);
        cam.position.copy(sp).addScaledVector(chaseMeters, metersToAstroSceneUnits());
      }
    }
    S.onObservationModeChange?.(getObservationMode());
    return true;
  }
  tick();
  return {
    setNavigationScale,
    focusContextStar,
    atlasSnapshot: () => ({ stellarSystems: stellarAtlas.entries.length, regionalSystems: regionalAtlas.entries.length, contextOverview, selectedContextStar, galaxyRadii: Object.fromEntries(atlasRadii) }),
    navigationScale: () => navigationContext,
    getCosmicHierarchy: () => COSMIC_HIERARCHY,
    getCanonicalStar: (key) => getCanonicalStar(key),
    getCanonicalGalaxy: (key) => getCanonicalGalaxy(key),
    getObjectProvenance: (key) => getObjectProvenance(key),
    getProvenanceManifest: () => ASTRONOMICAL_PROVENANCE_MANIFEST,
    getObserverSkyState: () => observerFirmament.getSnapshot(),
    setObserverPositionPc: (posPc, options = {}) => {
      if (posPc && typeof posPc === 'object') {
        observerPosPc = { x: Number(posPc.x || 0), y: Number(posPc.y || 0), z: Number(posPc.z || 0) };
      }
      if (options.hostGalaxyKey !== undefined) observerHostGalaxyKey = options.hostGalaxyKey;
      return observerFirmament.rebuildSkyForObserver(observerPosPc, {
        hostGalaxyKey: observerHostGalaxyKey,
        extragalacticMap: Boolean(options.extragalacticMap ?? nearbyMapState),
        visualProfile: options.visualProfile,
      });
    },
    setVisualProfile: (profile) => observerFirmament.setVisualProfile(profile),
    getVisualProfile: () => observerFirmament.getVisualProfile(),
    getScaleUnificationState: () => crossScaleState,
    startPerformanceCapture: () => { frameTiming.active = true; frameTiming.last = null; frameTiming.values = []; frameTiming.metadata = { quality: qualityMode, pixelRatio: R.getPixelRatio(), viewport: [innerWidth, innerHeight], target: activeMissionKey, scale: navigationContext.id }; },
    performanceSnapshot: () => ({ ...summarizeFrameTimes(frameTiming.values), metadata: frameTiming.metadata, originRebase: originRebaseState, navigationScale: navigationContext, renderer: { calls: R.info.render.calls, triangles: R.info.render.triangles, points: R.info.render.points, textures: R.info.memory.textures, geometries: R.info.memory.geometries } }),
    reenterCabin: () => {
      cancelTravel();
      const savedPosition = sp.clone(),
        savedYaw = fy,
        savedPitch = fp,
        hadKnownPose = shipPoseKnown;
      if (nearbyMapState) returnFromNearbyMap();
      contextOverview = false;
      const position = cam.position.clone(),
        quaternion = cam.quaternion.clone();
      nav = null;
      tw = null;
      skipRealTimeIntroSequence();
      if (hadKnownPose) {
        sp.copy(savedPosition);
        fy = savedYaw;
        fp = savedPitch;
        const qRestored = new THREE.Quaternion().setFromEuler(new THREE.Euler(fp, fy, 0, 'YXZ'));
        ship.quaternion.copy(qRestored);
        localCabinWorld.quaternion.copy(qRestored);
        const localEye = new V(
          astronautPos.x,
          astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS,
          astronautPos.z,
        ).applyQuaternion(qRestored);
        localCam.position.copy(localEye);
        localCam.quaternion.copy(qRestored);
        cam.position.copy(sp).addScaledVector(localEye, metersToAstroSceneUnits());
        cam.quaternion.copy(qRestored);
      }
      cabinReentryBlend = { position, quaternion, elapsed: 0 };
      S.fr(true);
      S.onObservationModeChange?.(getObservationMode());
    },
    releaseInputs,
    setSimulationPaused: (paused) => {
      simulationPaused = Boolean(paused);
      if (simulationPaused) {
        releaseInputs();
        vel.set(0, 0, 0);
        astronautVel.set(0, 0, 0);
      } else {
        clk.getDelta();
        releaseInputs();
      }
      return simulationPaused;
    },
    isSimulationPaused: () => simulationPaused,
    cycleCameraMode: () => {
      if (pv === 1) view(3);
      else view(1);
      S.onViewChange?.(pv);
      return pv;
    },
    stopAndInspect:()=>{if(realTimeIntro || launchSequence || launchCameraBlend) return false; cancelTravel(); tw = null; vel.set(0, 0, 0); for (const key of Object.keys(keys)) delete keys[key]; ac = 0; th = 0; S.onNavigation?.(null); leaveExteriorCamera(false); free = false; spectator = false; freeHelmMode = false; localCabinWorld.visible = false; ship.visible = false; tr.visible = false; S.fr(false); ct.enabled = true; const found = missionMarkers.get(activeMissionKey); if (found) ct.target.copy(found.marker.getWorldPosition(new V())); else { const direction = new V(); cam.getWorldDirection(direction); ct.target.copy(cam.position).addScaledVector(direction, 2); } ct.minDistance = .05; ct.maxDistance = 200; cam.lookAt(ct.target); ct.update(); },
    returnToStarMap: () => setNavigationScale('stellar'),
    nearbyMap,
    returnFromNearbyMap,
    focusNearbyGalaxy,
    focusSolarSystemMap,
    navigationActive: () => !!nav,
    configureTravelDurations: (durations) => { if (nav) return false; for (const [key, value] of Object.entries(durations)) { if (!(key in JUMP_DURATIONS) || !Number.isFinite(value) || value <= 0) return false; } jumpDurations = { ...jumpDurations, ...durations }; return true; },
    navigationSnapshot: () => {
      cam.updateMatrixWorld(true);
      localCam.updateMatrixWorld(true);
      ship.updateMatrixWorld(true);
      const target = nav?.target || arrivalTarget,
        ndc = target?.clone().project(cam),
        forward = new V(0, 0, -1).applyQuaternion(ship.quaternion),
        shipNdc = (
          pv === 3 || ship.visible
            ? ship.position.clone().project(localCam)
            : sp.clone().project(cam)
        ).toArray();
      return {
        state: nav?.phase || 'IDLE',
        phaseProgress: nav?.phaseProgress || 0,
        progress: nav?.progress || 0,
        shipVisible: ship.visible,
        cabinVisible: localCabinWorld.visible,
        view: pv,
        shipPosition: sp.toArray(),
        shipQuaternion: ship.quaternion.toArray(),
        cameraPosition: cam.position.toArray(),
        cameraQuaternion: cam.quaternion.toArray(),
        localCameraPosition: localCam.position.toArray(),
        localCameraNear: localCam.near,
        localCameraFar: localCam.far,
        target: target?.toArray() || null,
        targetNdc: ndc?.toArray() || null,
        cabinOccluded: cabinOccludes(target),
        shipNdc,
        cameraNear: cam.near,
        cameraFar: cam.far,
        forwardDot: target ? forward.dot(target.clone().sub(sp).normalize()) : null,
        effect: hyperspace?.snapshot() || null,
        lastJump,
      };
    },
    introSnapshot: () => ({
      active: !!realTimeIntro,
      paused: Boolean(realTimeIntro && realTimeIntroPaused),
      mainMenuOrbitActive,
      phase: realTimeIntro?.phase || 'IDLE',
      stageNotified: realTimeIntro?.stageNotified ?? -1,
      elapsed: Number((realTimeIntro?.elapsed || 0).toFixed(2)),
      stageElapsed: Number((realTimeIntro?.stageElapsed || 0).toFixed(2)),
      shipVisible: ship.visible,
      cabinVisible: localCabinWorld.visible,
    }),
    getOrbitLinesVisible: () => B.some((b) => Boolean(b.orbit?.visible)),
    getSpherexObservatoryState: () => ({
      present: Boolean(earth?.spherex?.root),
      visible: Boolean(earth?.spherex?.root?.visible),
      scanning: Boolean(earth?.spherex?.spectralScanGroup?.visible),
      worldPosition: earth?.spherex?.root ? earth.spherex.root.getWorldPosition(new V()).toArray() : null,
      altitudeKm: SPHEREX_ORBIT_SPEC.nominalAltitudeKm,
      periodMinutes: SPHEREX_ORBIT_SPEC.orbitalPeriodMinutes,
      inclinationDeg: SPHEREX_ORBIT_SPEC.inclinationDeg,
      orbitSpec: SPHEREX_ORBIT_SPEC,
    }),
    shipScale: () => shipSz,
    shipDimensionsMeters: () => SHIP_LENGTH_METERS,
    selectAstronomicalObject: (kind, key) => {
      if (kind === 'spherex') {
        const found = missionMarkers.get(key);
        if (found) found.label.visible = true;
      }
      S.onObjectSelect?.({ kind, key });
    },
    setCameraPose: (posArr, lookArr, fovVal) => {
      if (!userCameraAvailable()) return false;
      if (Array.isArray(posArr) && posArr.length === 3) {
        cam.position.set(posArr[0], posArr[1], posArr[2]);
      }
      if (Array.isArray(lookArr) && lookArr.length === 3) {
        cam.lookAt(lookArr[0], lookArr[1], lookArr[2]);
        ct.target.set(lookArr[0], lookArr[1], lookArr[2]);
      }
      if (Number.isFinite(fovVal)) {
        cam.fov = fovVal;
        cam.updateProjectionMatrix();
      }
    },
    getShipPosition: () => [sp.x, sp.y, sp.z],
    getShipScale: () => shipSz,
    startRealTimeIntro: startRealTimeIntroSequence,
    skipRealTimeIntro: skipRealTimeIntroSequence,
    pauseRealTimeIntro: (paused = true) => {
      if (!realTimeIntro) return false;
      realTimeIntroPaused = Boolean(paused);
      return realTimeIntroPaused;
    },
    isRealTimeIntroPaused: () => Boolean(realTimeIntro && realTimeIntroPaused),
    setMainMenuOrbit: (active = true) => {
      mainMenuOrbitActive = Boolean(active);
      if (mainMenuOrbitActive) {
        realTimeIntro = null;
        realTimeIntroPaused = false;
        sceneDirector.skipActiveSequence();
        cancelTravel();
        free = true;
        spectator = false;
        exteriorCameraMode = false;
        ct.enabled = false;
        pv = 3;
        alignShipInEarthOrbit();
        ship.visible = true;
        localCabinWorld.visible = false;
        for (const b of B) {
          if (b.orbit) b.orbit.visible = false;
          if (b.lab) b.lab.visible = false;
          if (b.ax) b.ax.visible = false;
          if (b.ar) b.ar.visible = false;
        }
        S.fr?.(true);
      }
      return mainMenuOrbitActive;
    },
    restoreSavedGameState: (snapshot = {}) => {
      mainMenuOrbitActive = false;
      realTimeIntro = null;
      realTimeIntroPaused = false;
      sceneDirector.skipActiveSequence();
      cancelTravel();
      releaseInputs();
      vel.set(0, 0, 0);
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      const targetBodyName = snapshot?.currentBody;
      const bodyEntry = targetBodyName
        ? B.find((b) => b.p?.n?.toLowerCase() === String(targetBodyName).toLowerCase())
        : null;
      if (bodyEntry && bodyEntry.pivot) {
        const bp = bodyEntry.pivot.position;
        const radial = bp.lengthSq() > 1e-6 ? bp.clone().normalize() : new V(1, 0, 0);
        const tangent = new V(-radial.z, 0, radial.x).normalize();
        const safeDist = computeSafeOrbitalClearance(bodyEntry, {
          isCabinActive: true,
          physicalScale: isPhysicalObservationActive(),
        });
        sp.copy(bp).addScaledVector(radial, safeDist * 1.15).addScaledVector(tangent, safeDist * 0.45);
        const lookQuat = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(sp, bp, new V(0, 1, 0)),
        );
        const eul = new THREE.Euler().setFromQuaternion(lookQuat, 'YXZ');
        fy = eul.y;
        fp = Math.max(-0.5, Math.min(0.5, eul.x));
        const qRestored = new THREE.Quaternion().setFromEuler(new THREE.Euler(fp, fy, 0, 'YXZ'));
        ship.position.set(0, 0, 0);
        ship.quaternion.copy(qRestored);
        localCabinWorld.quaternion.copy(qRestored);
        astronautPos.copy(BRIDGE_SPAWN_POS);
        astronautVel.set(0, 0, 0);
        microgravityController.setPosition(astronautPos);
        shipPoseKnown = true;
      } else {
        alignShipInEarthOrbit();
      }
      const wantExterior = String(snapshot?.cameraView || '').toLowerCase().includes('exterior');
      applyCameraView(wantExterior ? 3 : 1);
      suppressDirectorNarrative = true;
      sceneDirector.dispatchEvent('CABIN_ENTERED', {});
      sceneDirector.dispatchEvent('AI_ACTIVATED', {});
      suppressDirectorNarrative = false;
      S.onObservationModeChange?.(getObservationMode());
    },
    startGuidedTour: startGuidedCabinTour,
    onGuidedNarrativeComplete,
    onGuidedStationInteraction,
    onGuidedScienceAction,
    endGuidedCabinTour,
    setCabinFirstPerson: (firstPerson = true) => {
      cabinFirstPerson = Boolean(firstPerson);
      astronaut3D.root.visible = false;
      astronaut3D.firstPersonHands.visible = false;
      if (articulatedAstronaut) {
        articulatedAstronaut.root.visible = !cabinFirstPerson || pv === 3 || exteriorCameraMode;
      }
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      pv = 1;
      ship.visible = false;
      localCabinWorld.visible = true;
      S.onCabinFirstPersonChange?.(cabinFirstPerson);
      return cabinFirstPerson;
    },
    setCabinPerspective: (firstPerson) => {
      cabinFirstPerson = Boolean(firstPerson);
      if (articulatedAstronaut) {
        articulatedAstronaut.root.visible = !cabinFirstPerson || pv === 3 || exteriorCameraMode;
      }
      S.onCabinFirstPersonChange?.(cabinFirstPerson);
      return cabinFirstPerson;
    },
    setFreeHelmMode: (enabled) => {
      freeHelmMode = Boolean(enabled);
      if (freeHelmMode) {
        cabinFirstPerson = true;
        astronaut3D.root.visible = false;
        astronaut3D.firstPersonHands.visible = false;
        if (articulatedAstronaut) articulatedAstronaut.root.visible = false;
        pv = 1;
        ship.visible = false;
        localCabinWorld.visible = true;
        astronautPitch = -0.015;
        targetPitch = -0.015;
      }
      S.onFreeHelmChange?.(freeHelmMode);
    },
    getCabinFirstPerson: () => cabinFirstPerson,
    getAstronautPosition: () => {
      const currentDeck = resolveCurrentDeck(astronautPos);
      return {
        x: Number(astronautPos.x.toFixed(2)),
        y: Number(astronautPos.y.toFixed(2)),
        eyeY: Number((astronautPos.y + SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS).toFixed(2)),
        z: Number(astronautPos.z.toFixed(2)),
        yaw: Number(astronautYaw.toFixed(2)),
        pitch: Number(astronautPitch.toFixed(2)),
        speed: Number(astronautVel.length().toFixed(2)),
        deckId: currentDeck.id,
        deckNumber: currentDeck.deckNumber,
        deckName: currentDeck.name,
        microgravityMode: microgravityController.getMode(),
        anchoredRailId: microgravityController.getAnchoredRailId(),
        cabinFirstPerson: Boolean(cabinFirstPerson),
        thirdPersonAvatarVisible: Boolean(!cabinFirstPerson && (articulatedAstronaut?.root?.visible || astronaut3D?.root?.visible)),
        nearestStationId: nearestCabinStation ? nearestCabinStation.station.id : null,
        nearestStationDist: nearestCabinStation ? Number(nearestCabinStation.distance.toFixed(2)) : null,
        activeStationId: activeCabinStation,
      };
    },
    getAiTelemetry: () => {
      const pos = luminousAI.getPosition();
      const pointed = luminousAI.getPointedTarget ? luminousAI.getPointedTarget() : null;
      return {
        x: Number(pos.x.toFixed(2)),
        y: Number(pos.y.toFixed(2)),
        z: Number(pos.z.toFixed(2)),
        state: luminousAI.getState(),
        pointedTarget: pointed
          ? {
            x: Number(pointed.x.toFixed(2)),
            y: Number(pointed.y.toFixed(2)),
            z: Number(pointed.z.toFixed(2)),
          }
          : null,
      };
    },
    setAstronautLook: (yawRad, pitchRad) => {
      if (Number.isFinite(yawRad)) {
        astronautYaw = yawRad;
        targetYaw = yawRad;
      }
      if (Number.isFinite(pitchRad)) {
        const clamped = Math.max(-1.18, Math.min(1.18, pitchRad));
        astronautPitch = clamped;
        targetPitch = clamped;
      }
    },
    setAstronautPosition: (pos, yawRad, pitchRad) => {
      if (pos && typeof pos === 'object') {
        astronautPos.set(Number(pos.x || 0), Number(pos.y || 0), Number(pos.z || 0));
        astronautVel.set(0, 0, 0);
        if (fourDecksInterior) fourDecksInterior.clampAstronautPosition(astronautPos);
        else cabinSystem.clampAstronautPosition(astronautPos);
        microgravityController.setPosition(astronautPos);
      }
      if (Number.isFinite(yawRad)) { astronautYaw = yawRad; targetYaw = yawRad; }
      if (Number.isFinite(pitchRad)) { astronautPitch = pitchRad; targetPitch = pitchRad; }
    },
    walkAstronautToStation: (stationId) => {
      const st = getStationDef(stationId);
      if (!st) return null;
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      pv = 1;
      ship.visible = false;
      localCabinWorld.visible = true;
      astronautPos.copy(st.position);
      astronautVel.set(0, 0, 0);
      fourDecksInterior.clampAstronautPosition(astronautPos);
      microgravityController.setPosition(astronautPos);
      const dx = st.consolePos.x - st.position.x;
      const dz = st.consolePos.z - st.position.z;
      astronautYaw = Math.atan2(-dx, -dz);
      targetYaw = astronautYaw;
      astronautPitch = -0.06;
      targetPitch = -0.06;
      activeCabinStation = stationId;
      aiFollowAstronaut = false;
      luminousAI.setTargetPosition(st.aiHoverPos, 'Explicación');
      luminousAI.pointAtWorldPosition(st.consolePos, true);
      return st;
    },
    moveAiToStation: (stationId, stateName = 'Explicación') => {
      const st = getStationDef(stationId);
      if (!st) return;
      guidedTourState = null;
      aiFollowAstronaut = false;
      luminousAI.setTargetPosition(st.aiHoverPos, stateName);
      luminousAI.pointAtWorldPosition(st.consolePos, true);
    },
    setAiFollowAstronaut: (follow) => {
      guidedTourState = null;
      aiFollowAstronaut = Boolean(follow);
      if (aiFollowAstronaut) luminousAI.pointAtWorldPosition(null, false);
    },
    setAiLuminousState: (stateName, speaking = false, audioLevel = 0.08) => {
      if (stateName) luminousAI.setState(stateName);
      aiSpeakingState = Boolean(speaking);
      aiAudioLevelState = Number.isFinite(audioLevel) ? audioLevel : 0.08;
    },
    pointAiAtExternalObject: (kind, key) => {
      guidedTourState = null;
      aiFollowAstronaut = false;
      const winSt = getStationDef('windows');
      let pointedLocal = winSt
        ? winSt.consolePos.clone()
        : new V(0, 5.05, -14.6);

      if (kind && key) {
        let worldTargetPos = null;
        if (kind === 'spherex') {
          const found = missionMarkers.get(key);
          if (found) {
            found.label.visible = true;
            worldTargetPos = found.marker.getWorldPosition(new V());
          }
        } else if (kind === 'planet') {
          const planetObj = B.find((b) => b.p.n === key);
          if (planetObj) {
            worldTargetPos = planetObj.pivot.getWorldPosition(new V());
          }
        }
        // Transform real 3D world direction of the star/planet into cabin local coordinates
        // and project onto the panoramic bow window plane so the 3D beam points at the actual object
        if (worldTargetPos && localCabinWorld) {
          const worldDir = worldTargetPos.clone().sub(sp);
          if (worldDir.lengthSq() > 1e-12) {
            worldDir.normalize();
            const dirToObj = worldDir
              .applyQuaternion(localCabinWorld.quaternion.clone().invert())
              .normalize();
            const aiOrigin = winSt ? winSt.aiHoverPos : new V(1.6, 1.85, -10.2);
            pointedLocal = aiOrigin.clone().addScaledVector(dirToObj, 4.2);
          }
        }
        S.onObjectSelect?.({ kind, key });
      }

      if (winSt) {
        luminousAI.setTargetPosition(winSt.aiHoverPos, 'Señalización');
        luminousAI.pointAtWorldPosition(pointedLocal, true);
      }
      return pointedLocal;
    },
    setActiveCabinStation: (stationId) => {
      if (stationId === 'nav') occupyNavigationSeat();
      else activeCabinStation = stationId || null;
      if (!stationId) {
        freeHelmMode = false;
        freeHelmBlend = 0;
        S.onFreeHelmChange?.(false);
      }
      if (!stationId) {
        aiFollowAstronaut = true;
        luminousAI.pointAtWorldPosition(null, false);
        sceneDirector.returnToAstronautControl();
      }
    },
    dispatchSceneEvent: (eventName, payload = {}) => {
      if (eventName === KRONOX_SCENE_EVENTS.EXTERIOR_CAMERA_REQUESTED) {
        if (!free) {
          setFree(true, false);
          S.fr?.(true);
        }
        pv = 3;
        ship.visible = true;
        localCabinWorld.visible = false;
      } else if (eventName === KRONOX_SCENE_EVENTS.CABIN_ENTERED) {
        if (!free) {
          setFree(true, false);
          S.fr?.(true);
        }
        pv = 1;
        ship.visible = false;
        localCabinWorld.visible = true;
      }
      return sceneDirector.dispatchEvent(eventName, payload);
    },
    getSceneDirectorState: () => sceneDirector.getState(),
    skipDirectorSequence: () => {
      sceneDirector.skipActiveSequence();
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      pv = 1;
      ship.visible = false;
      localCabinWorld.visible = true;
      return sceneDirector.getState();
    },
    quality: (mode) => {
      qualityMode = mode;
      R.setPixelRatio(pixelRatioFor(qualityMode));
      R.setSize(innerWidth, innerHeight);
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(speedNoticeTimer);
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('wheel', onWheel);
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('blur', releaseInputs); document.removeEventListener('visibilitychange', onVisibilityChange); document.removeEventListener('focusin', onInputFocus); dom.removeEventListener('pointercancel', releaseInputs);
      removeEventListener('resize', onResize);
      if (backgroundIntroTimer) {
        clearInterval(backgroundIntroTimer);
        backgroundIntroTimer = null;
      }
      disposeTravelEffect();
      astronomicalHologram.dispose();
      localShipEnvRenderTarget?.dispose?.();
      localShipPmremGenerator?.dispose?.();
      ct.dispose();
      const released = disposeSceneResources(sc); destinationResources.dispose(released);
      R.renderLists?.dispose();
      R.dispose();
      if (R.domElement.parentNode === el) el.removeChild(R.domElement);
    },
    view: (v) => applyCameraView(v),
    resetExteriorView: resetExteriorCamera,
    inspectExterior,
    isExteriorInspection: () => exteriorCameraMode,
    speed: (v) => {
      fs = Math.max(0.01, Math.min(5e4, v));
      // Speed presets remain available for manual flight; an active cinematic keeps its continuous timeline.
      S.fv(fs);
    },
    opt: (o) => {
      O = o;
    },
    fov: (v) => {
      fovBase = v;
      const baseFov = pv == 1 ? Math.min(v, 42) : v;
      const activeMag = opticalTelescopeState.enabled ? opticalTelescopeState.magnification : 1;
      cam.fov = activeMag > 1 ? computeTelescopeFieldOfView(baseFov, activeMag) : baseFov;
      cam.updateProjectionMatrix();
      localCam.fov = baseFov;
      localCam.updateProjectionMatrix();
      GU.uH.value = (innerHeight * R.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    },
    free: (on, launchFromEarth = false) => { if (!userCameraAvailable()) return false; if (on && (contextOverview || nearbyMapState)) { if (nearbyMapState) returnFromNearbyMap(); contextOverview = false; cam.position.copy(sp); cam.quaternion.copy(ship.quaternion); } setFree(on, launchFromEarth); },
    spectate,
    board,
    exitSpectator,
    spectating: () => spectator,
    jump,
    key: (k, v) => {
      v ? (keys[k] = 1) : delete keys[k];
    },
    focus,
    quick,
    missionTarget,
    mode,
    lvl,
    reset: () => {
      sim = T0();
    },
    setDay: (d) => {
      sim = d;
    },
    setArrivedTarget: (t) => astronomicalHologram.setArrivedTarget(t),
    getArrivedHologramTarget: () => astronomicalHologram.getActiveTarget(),
    clearAstronomicalHologram: () => astronomicalHologram.clearHologram(),
    getObservationMode,
    setObservationMode,
    setOpticalTelescope,
    getPlanetaryObservationalTelemetry,
    getShipPhysicalSpecs,
    getDualWorldArchitectureState,
    getWarpEffectState: () => ({
      warpAmount: lastWarpAmount,
      navActive: Boolean(
        nav &&
        nav.long &&
        (nav.phase === 'HYPERSPACE_ENTRY' ||
          nav.phase === 'HYPERSPACE_CRUISE' ||
          nav.phase === 'HYPERSPACE_EXIT'),
      ),
      velocityMagnitude: vel.length(),
    }),
    getModularShip: () => modularShip,
    getFourDecksInterior: () => fourDecksInterior,
    getMicrogravityController: () => microgravityController,
    getArticulatedAstronaut: () => articulatedAstronaut,
    setMicrogravityMode: (nextMode) => {
      const targetMode =
        nextMode === MICROGRAVITY_MODES.FREE || nextMode === 'FREE'
          ? MICROGRAVITY_MODES.FREE
          : MICROGRAVITY_MODES.ASSISTED;
      microgravityController.setMode(targetMode);
      S.onMicrogravityStateChange?.({
        mode: targetMode,
        anchored: microgravityController.isAnchored(),
        anchoredRailId: microgravityController.getAnchoredRailId(),
        speed: microgravityController.getSpeed(),
      });
      return targetMode;
    },
    toggleGrabRail: () => {
      const nearRail = fourDecksInterior.grabRails.find((rail) => {
        const dx = astronautPos.x - rail.pos[0];
        const dy = astronautPos.y + 1.0 - rail.pos[1];
        const dz = astronautPos.z - rail.pos[2];
        return Math.hypot(dx, dy) < 2.4 && Math.abs(dz) < (rail.span || 4) * 0.7;
      });
      if (nearRail || microgravityController.isAnchored()) {
        microgravityController.toggleAnchor(nearRail?.id || 'rail-local');
      }
      S.onMicrogravityStateChange?.({
        mode: microgravityController.getMode(),
        anchored: microgravityController.isAnchored(),
        anchoredRailId: microgravityController.getAnchoredRailId(),
        speed: microgravityController.getSpeed(),
      });
      return microgravityController.getAnchoredRailId();
    },
    transitAstronautToDeck: (deckId, yawOverride = null) => {
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      pv = 1;
      ship.visible = false;
      localCabinWorld.visible = true;
      activeCabinStation = null;
      freeHelmMode = false;
      if (deckId !== 'deck-01' && guidedTourState) endGuidedCabinTour();
      deckTransitState = buildDeckTransitWaypoints(astronautPos, deckId, yawOverride);
      const targetCfg = DECK_SPAWNS[deckId] || DECK_SPAWNS['deck-01'];
      const targetDeckInfo = resolveCurrentDeck(targetCfg.pos);
      return {
        deckId: targetDeckInfo.id,
        deckNumber: targetDeckInfo.deckNumber,
        deckName: targetDeckInfo.name,
        position: astronautPos.toArray(),
        inTransit: true,
      };
    },
    getDeckTransitState: () =>
      deckTransitState
        ? {
          active: true,
          targetDeckId: deckTransitState.targetDeckId,
          waypointIndex: deckTransitState.index,
          totalWaypoints: deckTransitState.waypoints.length,
        }
        : { active: false },
    teleportAstronautToDeck: (deckId, yawOverride = null) => {
      deckTransitState = null;
      const cfg = DECK_SPAWNS[deckId] || DECK_SPAWNS['deck-01'];
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      pv = 1;
      ship.visible = false;
      localCabinWorld.visible = true;
      activeCabinStation = null;
      freeHelmMode = false;
      astronautPos.copy(cfg.pos);
      astronautVel.set(0, 0, 0);
      fourDecksInterior.clampAstronautPosition(astronautPos);
      microgravityController.setPosition(astronautPos);
      astronautYaw = Number.isFinite(yawOverride) ? yawOverride : cfg.yaw;
      targetYaw = astronautYaw;
      astronautPitch = -0.05;
      targetPitch = -0.05;
      if (articulatedAstronaut) {
        articulatedAstronaut.root.position.copy(astronautPos);
        articulatedAstronaut.root.rotation.y = astronautYaw;
        articulatedAstronaut.root.visible = !cabinFirstPerson;
      }
      const deckInfo = resolveCurrentDeck(astronautPos);
      if (luminousAI) {
        luminousAI.pointAtWorldPosition(null, false);
        const snapAiPos = {
          x: astronautPos.x + 1.1,
          y: astronautPos.y + 1.55,
          z: astronautPos.z - 1.1,
        };
        luminousAI.group?.position?.set(snapAiPos.x, snapAiPos.y, snapAiPos.z);
        luminousAI.setTargetPosition(snapAiPos, 'Acompañamiento');
        luminousAI.resetWake?.(snapAiPos);
      }
      announceDeckContextIfChanged(deckInfo?.id, true);
      return {
        deckId: deckInfo.id,
        deckNumber: deckInfo.deckNumber,
        deckName: deckInfo.name,
        position: astronautPos.toArray(),
        yaw: astronautYaw,
      };
    },
    setRepairMissionStage: (stage) => {
      activeRepairStage = Math.max(0, Math.min(4, Number(stage) || 0));
      return activeRepairStage;
    },
    getRepairMissionStage: () => activeRepairStage,
    getAsteroidBelt: () => realisticAsteroidBelt,
    identifyTargetUnderCrosshair: () => naturalGalaxySky?.identifyTargetUnderCrosshair?.(cam) || null,
    verifyFloatingOriginPrecision,
    computeDoublePrecisionRelativeVector,
  };
}
export const CK = `<svg viewBox='0 0 1000 600' preserveAspectRatio='none'><defs><linearGradient id='cg' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1b2335'/><stop offset='1' stop-color='#05070c'/></linearGradient><radialGradient id='cv' cx='.5' cy='.45' r='.75'><stop offset='.6' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.55'/></radialGradient></defs><rect width='1000' height='600' fill='url(#cv)'/><path d='M0 0H1000L900 62Q500 92 100 62Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M0 0L130 62L52 380L0 450Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M1000 0L870 62L948 380L1000 450Z' fill='url(#cg)' stroke='#34415c' stroke-width='2'/><path d='M0 600V462Q120 420 330 432Q500 405 670 432Q880 420 1000 462V600Z' fill='url(#cg)' stroke='#3d4d70' stroke-width='3'/><path d='M58 455Q220 432 398 446L380 564Q230 548 78 570Z' fill='#071019' fill-opacity='.72' stroke='#2a8fd0' stroke-opacity='.68' stroke-width='2'/><path d='M942 455Q780 432 602 446L620 564Q770 548 922 570Z' fill='#071019' fill-opacity='.72' stroke='#2a8fd0' stroke-opacity='.68' stroke-width='2'/><g stroke='#6ff0ff' stroke-width='2' fill='none' opacity='.75'><path d='M110 500L170 484L230 494L290 470L350 488'/><circle cx='770' cy='494' r='22'/><path d='M770 494L784 482'/><path d='M830 505H900M830 490H885'/></g><circle cx='460' cy='448' r='5' fill='#ff4040'/><circle cx='480' cy='446' r='5' fill='#ffb030'/><circle cx='520' cy='446' r='5' fill='#40ff80'/><circle cx='540' cy='448' r='5' fill='#40c0ff'/></svg>`,
  YK = `<svg viewBox='0 0 220 190' width='100%' height='100%'><rect x='95' y='100' width='30' height='90' rx='6' fill='#131a28' stroke='#3b4864' stroke-width='3'/><path d='M28 64Q28 24 70 24H150Q192 24 192 64V92Q192 110 172 110H48Q28 110 28 92Z' fill='none' stroke='#252e44' stroke-width='20'/><path d='M28 64Q28 24 70 24H150Q192 24 192 64V92Q192 110 172 110H48Q28 110 28 92Z' fill='none' stroke='#4a5a7c' stroke-width='4'/><rect x='12' y='52' width='26' height='54' rx='10' fill='#e05a2b'/><rect x='182' y='52' width='26' height='54' rx='10' fill='#e05a2b'/><circle cx='110' cy='66' r='15' fill='#0b0f18' stroke='#6ff0ff' stroke-width='3'/><circle cx='110' cy='66' r='5' fill='#6ff0ff'/></svg>`;
export const SC = `<div class='sc sl'><div class='st'><i></i> NIVEL DE VELOCIDAD</div><div id='lv' class='sv'></div><div class='speedStages'><div id='speedStage1'><i></i><span>PLANETA</span></div><div id='speedStage2'><i></i><span>SISTEMA</span></div><div id='speedStage3'><i></i><span>GALAXIA</span></div><div id='speedStage4'><i></i><span>HIPER</span></div></div><div id='ls' class='ss'></div></div><div class='sc sr'><div class='st'><i></i> TELEMETRÍA DE VUELO</div><div class='gaugeRow'><div class='flightGauge'><div class='gaugeFace'><i id='needleSpeed' class='gaugeNeedle'></i><b></b></div><strong id='gaugeSpeedValue'>0</strong><small>VELOCIDAD</small></div><div class='flightGauge'><div class='gaugeFace'><i id='needleInertia' class='gaugeNeedle inertiaNeedle'></i><b></b></div><strong id='gaugeInertiaValue'>0</strong><small>INERCIA</small></div><div class='flightGauge'><div class='gaugeFace compassFace'><i id='needleHeading' class='gaugeNeedle headingNeedle'></i><b></b></div><strong id='gaugeHeadingValue'>0°</strong><small>RUMBO</small></div></div></div>`;
