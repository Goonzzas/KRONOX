Warning: truncated output (original token count: 110886)
Total output lines: 10737

import { createJumpSequence, advanceJump, JUMP_DURATIONS } from './jumpSequence.js';
import {
  createWebXrManager,
  DEFAULT_VR_SETTINGS,
  VR_UNIFIED_NEAR,
  VR_UNIFIED_FAR,
} from './vrControls.js';
import { createVrConsoleOverlay3D } from './vrConsoleOverlay3D.js';
import { createHyperspaceEffect } from './hyperspaceEffect.js';
import { buildStellarAtlas } from './navigationAtlas.js';
import { makeAtlasGalaxy } from './galaxyVisuals.js';
import { galaxyMapPosition, galaxySymbolRadii, fitAtlasCamera, placeAtlasLabels, makeLabelLeader } from './mapLayout.js';
import { createSceneLabel as lab, placeSpacePlanetLabels } from './sceneLabels.js';
import { heliocentricMapPosition, SOLAR_GALACTIC_ANCHOR } from './astronomicalPositions.js';
import { disposeSceneResources } from './disposeResources.js';
import { scaleContext, scaleForTarget, macroGalacticVisible } from './navigationScale.js';
import { renderWithOriginRebase } from './originRebase.js';
import { integrateFlightVelocity } from './flightDynamics.js';
import { createDestinationResources, summarizeFrameTimes } from './destinationVisuals.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { P, TAU, T0, kep, pos } from '../data/planetData.js';
import { SPHEREX_TARGETS } from '../data/spherexTargets.js';
import { NEARBY_GALAXIES } from '../data/nearbyGalaxies.js';
import {
  SHIP_WORLD_UNITS,
  PHYSICAL_CABIN_STATIONS,
  createAstronautModel3D,
} from './habitableShipWorld.js';
import {
  KRONOX_SCENE_EVENTS,
  buildCabinMachineSystems3D,
  createKronoxSceneDirector,
} from './kronoxSceneDirector.js';
import { createSpherexObservatory3D, SPHEREX_ORBIT_SPEC } from './spherexObservatory3D.js';
const SPHEREX_MODEL_SCALE = 1 / (SPHEREX_ORBIT_SPEC.earthRadiusKm * 1000);
const SPHEREX_ORBIT_RADIUS_EARTH_RADII =
  1 + SPHEREX_ORBIT_SPEC.nominalAltitudeKm / SPHEREX_ORBIT_SPEC.earthRadiusKm;
import {
  COSMIC_HIERARCHY,
  GALAXY_MORPHOLOGY_METADATA,
  ASTRONOMICAL_PROVENANCE_MANIFEST,
  getObjectProvenance,
  getCanonicalStar,
  getCanonicalGalaxy,
  upgradeSceneGalaxiesWithMorphology,
  flushPendingGalaxyTextures,
  getPendingGalaxyTextureCount,
} from './astronomicalUniverse.js';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  normalizeGraphicsPreset,
  detectHardwareCapabilities,
  extractWebGLHardwareInfo,
  detectCompressedTextureSupport,
  resolveEffectiveGraphicsSettings,
} from './graphicsConfig.js';
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
import {
  CABIN_DECKS,
  C02_CABIN_BAYS,
  C02_HAB_SUITES,
  describeInteractablePrompt,
  DIRECT_INTERACTION_IDS,
  radialBayPoint,
} from './kronoxInteriorSpatialModel.js';
import {
  createAstronautCharacter3D,
  createFirstPersonHandsRig,
  ASTRONAUT_ANIMATION_STATES,
} from './astronautCharacter3D.js';
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
function fbm(u, v, f, octaves = 5) {
  let s = 0,
    a = 0.5,
    k = f,
    weight = 0;
  for (let o = 0; o < octaves; o++) {
    s += a * vn(u * k, (v * k) / 2, k);
    weight += a;
    k *= 2;
    a *= 0.5;
  }
  return s / (weight || 1);
}
const mix = (a, b, t) => a.map((q, i) => q + (b[i] - q) * t);
const IS_NODE_SCENE_HARNESS = Boolean(globalThis.__KRONOX_SCENE_HARNESS__);
function sunTexture(p) {
  const W = IS_NODE_SCENE_HARNESS ? 64 : 192,
    H = IS_NODE_SCENE_HARNESS ? 32 : 96,
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
      const n = fbm(u, v, 10, 3);
      // Luz integrada del Sol (estrella G2V, Teff ≈ 5772 K) en el espacio exterior:
      // prácticamente blanca (#fffaf2) con granulación fotosférica cálida sutil, evitando una esfera naranja artificial.
      const o = (j * W + i) * 4;
      d[o] = 255;
      d[o + 1] = Math.min(255, Math.round(244 + n * 11));
      d[o + 2] = Math.min(255, Math.round(226 + n * 28));
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
  const scale = IS_NODE_SCENE_HARNESS ? 0.25 : 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(512 * scale);
  canvas.height = Math.round(384 * scale);
  const context = canvas.getContext('2d');
  context.save();
  context.scale(scale, scale);
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
  const dotsPerArm = IS_NODE_SCENE_HARNESS ? 60 : 210;
  for (let arm = 0; arm < arms; arm++) {
    for (let i = 0; i < dotsPerArm; i++) {
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
  const knotCount = IS_NODE_SCENE_HARNESS ? 18 : 48;
  for (let i = 0; i < knotCount; i++) {
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

function makeNebulaBackdropTexture({ seed = 1, color = '#a88cff' } = {}) {
  let state = seed >>> 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const rgb = [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  context.save();
  context.scale(0.25, 0.25);
  context.translate(256, 256);
  context.rotate(seed * 0.21);
  context.scale(1, 0.62 + random() * 0.2);
  context.globalCompositeOperation = 'screen';
  for (let i = 0; i < 8; i++) {
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
  let performanceWindowStartedAt = null;
  let performanceWindowFrames = 0;
  let performanceWarningIssued = false;
  const preHardwareDetection = detectHardwareCapabilities({
    navigatorObj: globalThis.navigator,
    windowObj: globalThis.window,
  });
  let graphicsUserSettings = {
    ...DEFAULT_GRAPHICS_SETTINGS,
    ...(S.graphicsSettings || {}),
    ...(S.graphicsSettings?.preset ? {} : S.quality ? { preset: normalizeGraphicsPreset(S.quality, 'auto') } : {}),
  };
  let effectiveGraphics = resolveEffectiveGraphicsSettings(graphicsUserSettings, {
    autoDetectedPreset: preHardwareDetection.recommendedPreset,
    devicePixelRatio: globalThis.devicePixelRatio || 1,
  });
  const R = new THREE.WebGLRenderer({
    antialias: effectiveGraphics.antialias,
    logarithmicDepthBuffer: true,
    powerPreference: 'high-performance',
  });
  const hardwareInfo = extractWebGLHardwareInfo(R);
  const compressedTextureSupport = detectCompressedTextureSupport(R);
  const hardwareCapabilities = {
    ...detectHardwareCapabilities({
      navigatorObj: globalThis.navigator,
      windowObj: globalThis.window,
      glRendererString: hardwareInfo.glRendererString,
      glVendorString: hardwareInfo.glVendorString,
      maxTextureSize: hardwareInfo.maxTextureSize,
    }),
    compressedTextures: compressedTextureSupport,
  };
  effectiveGraphics = resolveEffectiveGraphicsSettings(graphicsUserSettings, {
    autoDetectedPreset: hardwareCapabilities.recommendedPreset,
    devicePixelRatio: globalThis.devicePixelRatio || 1,
  });
  const pixelRatioFor = () => effectiveGraphics.effectivePixelRatio;
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 0.94;
  R.outputEncoding = THREE.sRGBEncoding;
  if (R.shadowMap) {
    R.shadowMap.enabled = effectiveGraphics.shadowsEnabled;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.shadowMap.autoUpdate = effectiveGraphics.shadowsEnabled;
  }
  R.setPixelRatio(pixelRatioFor());
  R.setSize(innerWidth, innerHeight);
  el.appendChild(R.domElement);
  const textureLoader = new THREE.TextureLoader();
  const managedPlanetTextures = new Set();
  const getCapAnisotropy = () => {
    const cap = typeof R.capabilities?.getMaxAnisotropy === 'function' ? R.capabilities.getMaxAnisotropy() : 4;
    return Math.min(effectiveGraphics.maxAnisotropy || 4, cap);
  };
  const applyLoadedTexture = (file, colorMap = true, planetName = '', onReady = null) => {
    const texture = textureLoader.load(
      `${import.meta.env.BASE_URL}textures/planets/${file}`,
      (loaded) => {
        if (planetName === 'Neptuno' || planetName === 'Urano') {
          const source = loaded.image;
          const canvas = document.createElement('canvas');
          canvas.width = source.width;
          canvas.height = source.height;
          const context = canvas.getContext('2d');
          if (planetName === 'Neptuno') {
            context.filter = 'contrast(1.4) saturate(0.92)';
            context.drawImage(source, 0, 0);
          } else {
            context.drawImage(source, 0, 0);
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
        }
        onReady?.(loaded);
      },
    );
    if (colorMap) texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = getCapAnisotropy();
    managedPlanetTextures.add(texture);
    return texture;
  };
  const loadTexture = (file, colorMap = true, planetName = '', onReady = null) =>
    applyLoadedTexture(file, colorMap, planetName, onReady);
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
  let vrFrame = null;
  const vrLocalEyeScratch = new THREE.Vector3(0, 1.65, -1.8);
  const vrLocalYawQuatScratch = new THREE.Quaternion();
  const vrEulerScratch = new THREE.Euler(0, 0, 0, 'YXZ');
  const vrYawQuatTmp = new THREE.Quaternion();
  let vrLocalEyeReady = false;
  let vrManager = null;
  const localShipAmbient = new THREE.AmbientLight(0x9eb4d0, 0.26);
  const localShipHemi = new THREE.HemisphereLight(0xd2e1f4, 0x131822, 0.30);
  const localShipSunLight = new THREE.DirectionalLight(0xfff6e5, 2.35);
  localShipSunLight.position.set(-320, 120, -240);
  const localShipRimLight = new THREE.DirectionalLight(0x70b8ff, 0.55);
  localShipRimLight.position.set(240, -80, 310);
  localShipScene.add(localShipAmbient, localShipHemi, localShipSunLight, localShipRimLight);
  let localShipPmremGenerator = null;
  let localShipEnvRenderTarget = null;
  let localShipEnvInitialized = false;
  let localShipShadersWarmed = false;
  const ensureLocalShipEnvironment = () => {
    if (localShipEnvInitialized || disposed) return;
    localShipEnvInitialized = true;
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
  };
  let rafId = 0,
    disposed = false,
    lastNavigationPublish = -1,
    lastNavigationHadNav = false;
  ct.enableDamping = true;
  ct.dampingFactor = 0.07;
  ct.maxDistance = 3e5;
  ct.minDistance = 0.0005;
  sc.add(new THREE.AmbientLight(0xffffff, 0.13));
  sc.add(new THREE.PointLight(0xfff7ec, 1.85, 0, 0));
  const planetaryBeaconMap = createPlanetaryPointBeaconTexture(globalThis.document);
  const starBudgetTargets = [];
  const registerStarBudgetTarget = (ptsObj, minCount = 120) => {
    const count = ptsObj?.geometry?.attributes?.position?.count || 0;
    if (count > 0 && ptsObj?.geometry?.setDrawRange) {
      starBudgetTargets.push({ ptsObj, maxCount: count, minCount: Math.min(count, minCount) });
    }
    return ptsObj;
  };
  const applyStarBudgetFactor = (factor = 1) => {
    const clamped = Math.max(0.25, Math.min(1, Number(factor) || 1));
    for (let i = 0; i < starBudgetTargets.length; i++) {
      const target = starBudgetTargets[i];
      const count = Math.max(target.minCount, Math.round(target.maxCount * clamped));
      target.ptsObj.geometry.setDrawRange(0, count);
    }
  };
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
  sc.add(registerStarBudgetTarget(pts(a, c, 1.5, 0.9), 2400));
  // polvo estelar cercano (moderado para conservar la oscuridad y profundidad del espacio)
  a = [];
  c = [];
  for (let i = 0; i < 9000; i++) {
    const v = new THREE.Vector3(gs(), gs() * 0.5, gs()).multiplyScalar(900);
    a.push(v.x, v.y, v.z);
    c.push(0.5 + Math.random() * 0.4, 0.55 + Math.random() * 0.2, 0.8);
  }
  sc.add(registerStarBudgetTarget(pts(a, c, 0.9, 0.14), 1200));
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
  const planetLabelsGroup = new THREE.Group();
  planetLabelsGroup.name = 'SpacePlanetLabelsLayer';
  sc.add(planetLabelsGroup);
  let spacePlanetLabelHits = [];
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
  // Thin-disk profile from the supplied Milky Way model (about ±600 units near the inner arms).
  // Keep the radial scale intact while avoiding an oversized vertical bulge.
  const diskHeight = (r) => 600 * (1 - 0.5 * (r / 45000));
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
      y = gs() * (i % 3 ? 900 : 2500);
      col = [1, 0.85, 0.6];
    } else if (i < 16000) {
      const r = 3000 + Math.random() * 10000,
        an = Math.random() * TAU;
      x = Math.cos(an) * r;
      z = Math.sin(an) * r;
      y = gs() * 500;
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
    a.push(RG + q * 0.25 + gs() * 1500, gs() * 200, q + gs() * 1500);
    c.push(...nc());
    Rr.push(RG);
    Z.push(200 + Math.random() * 700);
  }
  for (let i = 0; i < 60; i++) {
    const r = Math.random() * 4500,
      an = Math.random() * TAU;
    a.push(Math.cos(an) * r, gs() * 600, Math.sin(an) * r);
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
    a.push(RG + q * 0.25 + gs() * 250, gs() * 400, q + gs() * 250);
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
  macroGalacticGroup.traverse((child) => {
    if (child?.isPoints) registerStarBudgetTarget(child, 320);
  });
  applyStarBudgetFactor(effectiveGraphics.starBudgetFactor);
  upgradeSceneGalaxiesWithMorphology({
    nearbyGalaxyMarkers,
    missionMarkers,
    missionMarkerEffects,
    stellarAtlas,
    regionalAtlas,
    macroGalacticGroup,
    atlasRadii,
    glowTexture: sharedPointMap,
    deferGalaxyTextures: !IS_NODE_SCENE_HARNESS,
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
    texture.anisotropy = getCapAnisotropy();
    managedPlanetTextures.add(texture);
    return texture;
  };
  const createPlaceholderPlanetTexture = (planet) => {
    const cv = document.createElement('canvas');
    cv.width = 16;
    cv.height = 16;
    const ctx = cv.getContext('2d');
    const toRgb = (arr) =>
      Array.isArray(arr) && arr.length >= 3
        ? arr.slice(0, 3).map((v) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : 168;
        })
        : [160, 175, 195];
    const fmt = (rgb, m = 1) =>
      `rgb(${Math.max(12, Math.min(255, Math.round(rgb[0] * m)))},${Math.max(12, Math.min(255, Math.round(rgb[1] * m)))},${Math.max(12, Math.min(255, Math.round(rgb[2] * m)))})`;
    const grad = ctx.createLinearGradient(0, 0, 0, cv.height);
    if (Array.isArray(planet?.c?.[0])) {
      const stops = planet.c.map(toRgb);
      const denom = Math.max(1, stops.length - 1);
      stops.forEach((rgb, idx) => {
        grad.addColorStop(idx / denom, fmt(rgb, 1));
      });
    } else {
      const baseRgb = toRgb(planet?.c);
      grad.addColorStop(0, fmt(baseRgb, 0.78));
      grad.addColorStop(0.35, fmt(baseRgb, 1.04));
      grad.addColorStop(0.55, fmt(baseRgb, 0.92));
      grad.addColorStop(1, fmt(baseRgb, 0.75));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  };
  const makeDwarfTexture = (planet) => {
    const width = IS_NODE_SCENE_HARNESS ? 128 : 256;
    const height = IS_NODE_SCENE_HARNESS ? 64 : 128;
    const sampleWidth = IS_NODE_SCENE_HARNESS ? 64 : 128;
    const sampleHeight = IS_NODE_SCENE_HARNESS ? 32 : 64;
    const sx = width / 1024;
    const sy = height / 512;
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
    for (let y = 0; y < sampleHeight; y++) {
      const v = y / sampleHeight;
      for (let x = 0; x < sampleWidth; x++) {
        const u = x / sampleWidth;
        const broad = fbm(u + seedOffset, v + seedOffset * 0.31, 4.5, 3);
        const detail = fbm(u + seedOffset * 0.7, v + seedOffset * 0.9, 27, 3);
        const latitude = planet.n === 'Eris' ? Math.abs(v - 0.5) * 0.2 : 0;
        const tone = THREE.MathUtils.clamp(
          0.5 + (broad - 0.5) * 2.1 + (detail - 0.5) * 1.1 + latitude,
          0,
          0.999,
        );
        const band = Math.min(2, Math.floor(tone * 3));
        const blend = tone * 3 - band;
        const c0 = palette[band];
        const c1 = palette[band + 1];
        const pixel = (y * sampleWidth + x) * 4;
        image.data[pixel] = c0[0] + (c1[0] - c0[0]) * blend;
        image.data[pixel + 1] = c0[1] + (c1[1] - c0[1]) * blend;
        image.data[pixel + 2] = c0[2] + (c1[2] - c0[2]) * blend;
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

    const craterCount = IS_NODE_SCENE_HARNESS
      ? 24
      : { Ceres: 54, Plutón: 48, Haumea: 32, Makemake: 42, Eris: 50 }[planet.n] || 40;
    for (let index = 0; index < craterCount; index++) {
      const x = random() * width;
      const y = random() * height;
      const radius = (2 + Math.pow(random(), 2.1) * 37) * sx;
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
      context.save();
      context.scale(sx, sy);
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
      context.restore();
    } else if (planet.n === 'Ceres') {
      context.save();
      context.scale(sx, sy);
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
      context.restore();
    } else if (planet.n === 'Haumea') {
      context.save();
      context.scale(sx, sy);
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
      for (let groove = 0; groove < 18; groove++) {
        const y = random() * 512;
        const x = random() * 1024;
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
      context.restore();
    } else if (planet.n === 'Makemake') {
      for (let patch = 0; patch < 24; patch++) {
        const x = random() * width;
        const y = random() * height;
        const radius = (18 + random() * 74) * sx;
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
    const anisotropy = getCapAnisotropy();
    texture.anisotropy = bumpTexture.anisotropy = anisotropy;
    managedPlanetTextures.add(texture);
    managedPlanetTextures.add(bumpTexture);
    return { map: texture, bumpMap: bumpTexture };
  };
  const sharedPlanetSphereGeo = new THREE.SphereGeometry(
    1,
    IS_NODE_SCENE_HARNESS ? 24 : 44,
    IS_NODE_SCENE_HARNESS ? 16 : 32,
  );
  const sharedPlanetAtmoGeo = new THREE.SphereGeometry(
    1.009,
    IS_NODE_SCENE_HARNESS ? 20 : 40,
    IS_NODE_SCENE_HARNESS ? 14 : 28,
  );
  const sharedIceAtmoGeo = new THREE.SphereGeometry(
    1.035,
    IS_NODE_SCENE_HARNESS ? 20 : 40,
    IS_NODE_SCENE_HARNESS ? 14 : 28,
  );
  const sharedMoonSphereGeo = new THREE.SphereGeometry(1, 20, 14);
  const progressiveQueue = [];
  const planetPromoters = new Map();
  const progressiveAssetState = {
    total: 0,
    loaded: 0,
    active: false,
    currentLabel: '',
  };
  let progressiveTimer = null;
  let deferredWarmupTimer = null;
  let initialSceneReadyFired = false;
  const publishProgressiveAssetState = () => {
    const remaining = progressiveQueue.length + (typeof getPendingGalaxyTextureCount === 'function' ? getPendingGalaxyTextureCount() : 0);
    const total = Math.max(progressiveAssetState.total, progressiveAssetState.loaded + remaining);
    progressiveAssetState.total = total;
    progressiveAssetState.active = remaining > 0;
    S.onAssetLoadingState?.({
      ...progressiveAssetState,
      remaining,
    });
  };
  const enqueueProgressiveTask = ({ id, planetName = null, label = '', priority = 50, run }) => {
    progressiveAssetState.total += 1;
    const task = { id, planetName, label, priority, run, done: false };
    progressiveQueue.push(task);
    progressiveQueue.sort((a, b) => a.priority - b.priority);
    if (planetName) {
      planetPromoters.set(planetName, () => {
        if (task.done || disposed) return false;
        task.done = true;
        const idx = progressiveQueue.indexOf(task);
        if (idx !== -1) progressiveQueue.splice(idx, 1);
        progressiveAssetState.currentLabel = task.label || planetName;
        task.run();
        progressiveAssetState.loaded += 1;
        publishProgressiveAssetState();
        return true;
      });
    }
    return task;
  };
  const runNextProgressiveTask = (maxTasks = 1) => {
    if (disposed) return 0;
    let executed = 0;
    while (executed < maxTasks && progressiveQueue.length > 0) {
      const task = progressiveQueue.shift();
      if (!task || task.done) continue;
      task.done = true;
      progressiveAssetState.currentLabel = task.label || task.id;
      try {
        task.run();
      } catch {
        // Progressive hydration failures never abort active simulation
      }
      progressiveAssetState.loaded += 1;
      executed += 1;
    }
    if (executed === 0 && typeof getPendingGalaxyTextureCount === 'function' && getPendingGalaxyTextureCount() > 0) {
      const flushed = flushPendingGalaxyTextures(1);
      if (flushed > 0) {
        progressiveAssetState.currentLabel = 'Morfología galáctica';
        progressiveAssetState.loaded += flushed;
        executed += flushed;
      }
    }
    publishProgressiveAssetState();
    return executed;
  };
  const promotePlanetTexture = (planetName) => {
    const fn = planetName ? planetPromoters.get(planetName) : null;
    if (fn) fn();
  };
  const EAGER_PLANETS = new Set(['Sol', 'Tierra', 'Luna', 'Marte', 'Júpiter', 'Saturno']);
  const PLANET_LOAD_PRIORITY = {
    Saturno: 5,
    Marte: 8,
    Júpiter: 10,
    Venus: 12,
    Mercurio: 15,
    Urano: 18,
    Neptuno: 20,
    Plutón: 28,
    Ceres: 30,
    Haumea: 32,
    Makemake: 34,
    Eris: 36,
  };
  P.forEach((p) => {
    const isEager = EAGER_PLANETS.has(p.n);
    const dwarfSurface = p.dwarf && isEager ? makeDwarfTexture(p) : null;
    const placeholderMap = !p.sun && !isEager ? createPlaceholderPlanetTexture(p) : null;
    const pivot = new THREE.Group(),
      tilt = new THREE.Group(),
      mat = p.sun
        ? new THREE.MeshBasicMaterial({ map: sunTexture(p) })
        : new THREE.MeshStandardMaterial({
          map: dwarfSurface
            ? dwarfSurface.map
            : isEager
              ? loadTexture(PLANET_TEXTURE_FILES[p.n], true, p.n)
              : placeholderMap,
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
      spin = new THREE.Mesh(sharedPlanetSphereGeo, mat);
    if (p.shape) spin.scale.y = p.shape;
    tilt.rotation.z = ((p.tilt || 0) * Math.PI) / 180;
    tilt.add(spin);
    let venusAtmosphereMat = null;
    if (p.n === 'Tierra' || p.n === 'Venus') {
      const isEarth = p.n === 'Tierra';
      const atmosphericMap = isEarth
        ? loadTexture('2k_earth_clouds.jpg')
        : placeholderMap;
      const atmoMat = new THREE.MeshStandardMaterial({
        map: atmosphericMap,
        alphaMap: isEarth ? atmosphericMap : null,
        color: isEarth ? 0xffffff : 0xffe5c2,
        transparent: true,
        opacity: isEarth ? 0.76 : 0.52,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
        side: THREE.FrontSide,
      });
      if (!isEarth) venusAtmosphereMat = atmoMat;
      const atmosphere = new THREE.Mesh(sharedPlanetAtmoGeo, atmoMat);
      spin.add(atmosphere);
    }
    if (!p.sun && !isEager) {
      enqueueProgressiveTask({
        id: `planet-${p.n}`,
        planetName: p.n,
        label: `Textura planetaria: ${p.n}`,
        priority: PLANET_LOAD_PRIORITY[p.n] ?? 40,
        run: () => {
          if (p.dwarf) {
            const generated = makeDwarfTexture(p);
            const oldPlaceholder = mat.map;
            mat.map = generated.map;
            mat.bumpMap = generated.bumpMap;
            mat.bumpScale = 0.022;
            mat.needsUpdate = true;
            if (oldPlaceholder && oldPlaceholder !== placeholderMap) oldPlaceholder.dispose?.();
            placeholderMap?.dispose?.();
            return;
          }
          const texFile = PLANET_TEXTURE_FILES[p.n];
          if (texFile) {
            loadTexture(texFile, true, p.n, (loadedTex) => {
              if (disposed || !loadedTex) return;
              mat.map = loadedTex;
              mat.needsUpdate = true;
              if (placeholderMap && placeholderMap !== loadedTex) placeholderMap.dispose?.();
            });
          }
          if (p.n === 'Venus' && venusAtmosphereMat) {
            loadTexture('2k_venus_atmosphere.jpg', true, 'VenusAtmo', (loadedAtmo) => {
              if (disposed || !loadedAtmo) return;
              venusAtmosphereMat.map = loadedAtmo;
              venusAtmosphereMat.needsUpdate = true;
            });
          }
        },
      });
    }
    if (p.n === 'Urano' || p.n === 'Neptuno') {
      // Thin limb haze gives the ice giants depth without turning their
      // atmospheres into a bright, opaque blue shell.
      const atmosphereColor = p.n === 'Urano' ? 0x8fe8ed : 0x4e9dff;
      const atmosphere = new THREE.Mesh(
        sharedIceAtmoGeo,
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
      system.userData.ignorePlanetClick = true;
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
      spherex.root.scale.setScalar(SPHEREX_MODEL_SCALE);
      const spherexLabel = lab('SPHEREx · NASA (Órbita polar ~650 km)', 0.16, 18);
      spherexLabel.position.set(0, 2.35, 0);
      spherexLabel.visible = false;
      spherex.root.add(spherexLabel);
      LB.push(spherexLabel);
      system.add(spherex.root);
      spherex.update({
        simDays: 0,
        elapsedTime: 0,
        earthRadius: 1,
        orbitRadius: SPHEREX_ORBIT_RADIUS_EARTH_RADII,
        scanning: false,
      });
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
          sharedMoonSphereGeo,
          new THREE.MeshStandardMaterial({
            map: makeMoonTexture(moon),
            roughness: 0.88,
            metalness: 0,
          }),
        );
        mesh.scale.setScalar(moon.size);
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
    b.lab = lab(p.n, 0.4, 28, document, {
      planetTag: true,
      accentColor: p.sun ? '#ffd27d' : p.ring ? '#f0d290' : '#74dcff',
    });
    b.lab.userData.planetName = p.n;
    planetLabelsGroup.add(b.lab);
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
    shipCameraDistance = () => shipCameraDistanceMeters() * metersToAstroSceneUnits();

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
  function getCockpitDisplayTelemetry() {
    const target =
      SPHEREX_TARGETS.find((item) => item.key === (activeMissionKey || nav?.objectKey)) ||
      SPHEREX_TARGETS.find((item) => item.key === 'barnard') ||
      null;
    const speed = vel.length();
    const heading = (((vel.lengthSq() > 1e-8 ? Math.atan2(vel.x, -vel.z) * 57.2958 : -fy * 57.2958) % 360) + 360) % 360;
    const pitch = vel.lengthSq() > 1e-8
      ? Math.atan2(vel.y, Math.hypot(vel.x, vel.z)) * 57.2958
      : -fp * 57.2958;
    const mechanisms = fourDecksInterior?.mechanisms?.state || {};
    const deck = resolveCurrentDeck(astronautPos);
    return {
      target,
      hasActiveMission: Boolean(activeMissionKey || nav?.objectKey),
      destination: nav?.name || arrivalTarget?.name || (activeMissionKey ? target?.name : 'Sistema Solar'),
      navigationPhase: nav?.phase || (nav ? 'EN RUTA' : 'ESTACIONARIA'),
      flightMode: nav ? 'AUTOPILOTO' : freeHelmMode ? 'TIMÓN LIBRE' : speed > 0.02 ? 'MANUAL' : 'ESPERA',
      speed,
      heading,
      pitch,
      aiSpeaking: aiSpeakingState,
      aiAudioLevel: aiAudioLevelState,
      voiceEnabled: Boolean(S.voiceEnabled?.()),
      elapsedTime: clk.elapsedTime,
      crewCount: 1,
      deckCode: deck?.code || 'C01',
      elevator: fourDecksInterior?.elevatorSystem?.state || null,
      mechanisms: { ...mechanisms },
      repairStage: activeRepairStage,
    };
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

  const enterExteriorCameraClearHud = ({ preserveFreeHelm = false } = {}) => {
    nearestCabinStation = null;
    lastNearestStationId = null;
    activeCabinStation = null;
    if (!preserveFreeHelm) {
      freeHelmMode = false;
      S.onFreeHelmChange?.(false);
    }
    S.onNearestStationChange?.(null);
    S.onStationInteract?.(null);
  };

  const pointerLockSupported = Boolean(
    typeof dom?.requestPointerLock === 'function' && typeof document?.exitPointerLock === 'function',
  );
  let pointerLockActive = false;
  let pointerLockFallbackActive = !pointerLockSupported;
  let pointerLockIgnoreMoves = 0;
  let suppressNextUnlockNotification = false;
  let pointerLockBlockedActivation = false;
  const isPointerLockEligible = () =>
    Boolean(
      free &&
      pv === 1 &&
      !exteriorCameraMode &&
      !simulationPaused &&
      !mainMenuOrbitActive &&
      !realTimeIntro &&
      !activeCabinStation &&
      !freeHelmMode &&
      !nearbyMapState &&
      !contextOverview &&
      !launchSequence &&
      !launchCameraBlend &&
      !nav,
    );
  const getPointerLockState = () => ({
    supported: pointerLockSupported,
    active: pointerLockActive,
    eligible: isPointerLockEligible(),
    fallbackDragActive: pointerLockFallbackActive,
    fallbackMode: Boolean(pointerLockFallbackActive || !pointerLockSupported),
  });
  const emitPointerLockState = (reason = 'sync') => {
    S.onPointerLockChange?.({
      ...getPointerLockState(),
      reason,
    });
  };
  const exitPointerLockIfActive = (reason = 'ui') => {
    if (!pointerLockSupported || typeof document === 'undefined') return false;
    const lockedEl = document.pointerLockElement || document.mozPointerLockElement || null;
    if (lockedEl === dom || pointerLockActive) {
      suppressNextUnlockNotification = true;
      pointerLockActive = false;
      try {
        document.exitPointerLock?.();
      } catch {
        // Ignore environments denying exitPointerLock
      }
      emitPointerLockState(reason);
      return true;
    }
    return false;
  };
  const requestPointerLockForLook = (reason = 'click') => {
    if (!isPointerLockEligible()) return false;
    if (!pointerLockSupported) {
      pointerLockFallbackActive = true;
      emitPointerLockState('unsupported');
      return false;
    }
    const lockedEl = typeof document !== 'undefined' ? document.pointerLockElement : null;
    if (lockedEl === dom) {
      pointerLockActive = true;
      emitPointerLockState(reason);
      return true;
    }
    try {
      const res = dom.requestPointerLock?.();
      if (res && typeof res.catch === 'function') {
        res.catch(() => {
          pointerLockFallbackActive = true;
          pointerLockActive = false;
          emitPointerLockState('fallback');
        });
      }
      return true;
    } catch {
      pointerLockFallbackActive = true;
      pointerLockActive = false;
      emitPointerLockState('fallback');
      return false;
    }
  };

  function userCameraAvailable() { return !(realTimeIntro || mainMenuOrbitActive || launchSequence || launchCameraBlend || cabinReentryBlend || nav); }
  function enterExteriorCamera({ preserveFreeHelm = false } = {}) {
    if (!userCameraAvailable()) return false;
    exitPointerLockIfActive('exterior');
    enterExteriorCameraClearHud({ preserveFreeHelm });
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
    pv = 3;
    localCabinWorld.visible = false;
    ship.visible = true;
    S.onViewChange?.(3);
    ship.position.set(0, 0, 0);
    ship.scale.setScalar(SHIP_METRIC_SCALE);
    if (!alreadyExterior) {
      resetExteriorCamera(true);
    }
    emitPointerLockState('exterior');
    return true;
  }

  function applyFreeHelmMode(enabled) {
    const next = Boolean(enabled);
    freeHelmMode = next;
    if (next) {
      exitPointerLockIfActive('helm');
      if (!free) {
        setFree(true, false);
        S.fr?.(true);
      }
      if (astronautSeatedInBridge) {
        astronautSeatedInBridge = false;
      }
      if (astronautRestingInBed) {
        standUpFromRestBed(true);
      }
      freeHelmBlend = 1;
      pv = 3;
      S.onViewChange?.(3);
      enterExteriorCamera({ preserveFreeHelm: true });
      if (articulatedAstronaut?.root) articulatedAstronaut.root.visible = false;
      if (guidedTourState && ['look_camera', 'nav', 'bridge', 'astro_obs'].includes(guidedTourState.step)) {
        onGuidedStationInteraction('windows');
      } else if (!guidedTourState) {
        fourDecksInterior?.setTutorialWaypoint?.({ visible: false });
        luminousAI.pointAtWorldPosition(null, false);
        S.onGuideObjective?.('');
      }
    } else {
      freeHelmBlend = 0;
      if (exteriorCameraMode || pv !== 1) {
        applyCameraView(1);
        S.onViewChange?.(1);
      } else {
        freeHelmMode = false;
      }
      if (!guidedTourState || guidedTourState.step === 'free') {
        fourDecksInterior?.setTutorialWaypoint?.({ visible: false });
        aiFollowAstronaut = true;
        luminousAI.pointAtWorldPosition(null, false);
      }
    }
    emitPointerLockState();
    S.onFreeHelmChange?.(freeHelmMode);
    return freeHelmMode;
  }
  function nearbyMap() {
    if (!userCameraAvailable()) return false;
    if (nearbyMapState) return;
    exitPointerLockIfActive('map');
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
    if (!marker)…60886 tokens truncated…            } else if (Math.hypot(astronautPos.x, astronautPos.z) > 2.45) {
              activeCabinStation = null;
              activeCabinStationAnchorPos = null;
              S.onStationInteract?.(null);
            }
          }

          // Prompt [E] priorizando sillón de mando inicial, Raycast central de cámara + respaldo por proximidad y mirada
          _gazeEyePos.set(eyeX, eyeY, eyeZ);
          _gazeLookDir.set(0, 0, -1).applyQuaternion(localLookQuat).normalize();
          if (isElevatorTransitLocked || exteriorCameraMode || pv !== 1) {
            nearestCabinStation = null;
          } else if (astronautSeatedInBridge) {
            nearestCabinStation = {
              station: {
                id: 'stand-up-seat',
                kind: 'direct',
                deckId: 'deck-01',
                label: 'Sillón de Mando Central (Puente de Mando)',
                title: 'Sillón de Mando Central (Puente de Mando)',
                actionLabel: 'Levantarse [E / WASD]',
                directAction: true,
                tag: 'PUENTE DE MANDO',
                position: { x: 0, y: 3.4, z: -9.85 },
                consolePos: { x: 0, y: 4.35, z: -10.65 },
                aiHoverPos: { x: 1.35, y: 5.05, z: -10.25 },
              },
              distance: 0.4,
            };
          } else if (astronautRestingInBed) {
            const suiteNow = astronautRestingInBed.suite;
            nearestCabinStation = {
              station: {
                id: 'stand-up-bed',
                kind: 'direct',
                deckId: 'deck-02',
                label: `${suiteNow.bedLabel} · Descansando`,
                title: `${suiteNow.code} · En reposo`,
                actionLabel: 'Levantarse [E / WASD]',
                directAction: true,
                tag: `${suiteNow.code} · REPOSO`,
                position: {
                  x: astronautRestingInBed.restPos.x,
                  y: 0.0,
                  z: astronautRestingInBed.restPos.z,
                },
                consolePos: {
                  x: astronautRestingInBed.restPos.x,
                  y: 0.72,
                  z: astronautRestingInBed.restPos.z,
                },
                aiHoverPos: {
                  x: astronautRestingInBed.standPos.x,
                  y: 1.65,
                  z: astronautRestingInBed.standPos.z,
                },
              },
              distance: 0.25,
            };
          } else {
            let rayMatched = null;
            const activeInteractMeshes =
              fourDecksInterior?.getInteractMeshesForDeck?.(activeDeckId) ||
              fourDecksInterior?.interactRaycasterMeshes;
            if (_interactRaycaster && activeInteractMeshes?.length) {
              _interactRaycaster.setFromCamera(_centerNdc, localCam);
              _interactRaycaster.far = 3.25;
              const hits = _interactRaycaster.intersectObjects(activeInteractMeshes, false);
              for (let hi = 0; hi < hits.length; hi++) {
                const hit = hits[hi];
                if (!hit.object.visible) continue;
                const iid = hit.object.userData?.interactId;
                if (!iid) continue;
                if (hit.distance > 3.1) continue;
                const curFloor = resolveCurrentDeck(astronautPos);
                const doorHere = Number(elSys?.state?.doorOpenByDeck?.[curFloor.id] ?? 0);
                const cabHere = Boolean(elSys && Math.abs(elSys.state.cabY - curFloor.elevationY) < 0.25 && doorHere > 0.72);
                const promptMeta = describeInteractablePrompt(iid, {
                  mechanisms: fourDecksInterior?.mechanisms?.state,
                  cabHere,
                  isAnchored: Boolean(mgResult.anchoredRailId),
                });
                const stDef = getStationDef(iid);
                rayMatched = {
                  station: {
                    ...(stDef || {
                      id: iid,
                      deckId: curFloor.id,
                      position: { x: astronautPos.x, y: astronautPos.y, z: astronautPos.z },
                      consolePos: { x: astronautPos.x, y: astronautPos.y + 1.3, z: astronautPos.z },
                      aiHoverPos: { x: astronautPos.x, y: astronautPos.y + 1.65, z: astronautPos.z - 1.2 },
                    }),
                    id: iid,
                    title: promptMeta?.label || stDef?.label || iid,
                    label: promptMeta?.label || stDef?.label || iid,
                    actionLabel: promptMeta?.actionLabel || 'Operar',
                    directAction: Boolean(promptMeta?.direct),
                    kind: hit.object.userData?.interactKind || (promptMeta?.direct ? 'direct' : 'panel'),
                  },
                  distance: hit.distance,
                  gazeDot: 1.0,
                };
                break;
              }
            }

            if (rayMatched) {
              nearestCabinStation = rayMatched;
            } else {
              nearestCabinStation = fourDecksInterior.findNearestInteractiveStation(astronautPos, 2.15, {
                eyePos: _gazeEyePos,
                lookDir: _gazeLookDir,
                minDot: 0.35,
                includeElevator: true,
                lockedDeckId: currentLockedDeckId,
                exteriorMode: exteriorCameraMode || pv !== 1,
              });
              if (nearestCabinStation?.station) {
                const curFloor = resolveCurrentDeck(astronautPos);
                const doorHere = Number(elSys?.state?.doorOpenByDeck?.[curFloor.id] ?? 0);
                const cabHere = Boolean(elSys && Math.abs(elSys.state.cabY - curFloor.elevationY) < 0.25 && doorHere > 0.72);
                const promptMeta = describeInteractablePrompt(nearestCabinStation.station.id, {
                  mechanisms: fourDecksInterior?.mechanisms?.state,
                  cabHere,
                  isAnchored: Boolean(mgResult.anchoredRailId),
                });
                if (promptMeta) {
                  nearestCabinStation = {
                    ...nearestCabinStation,
                    station: {
                      ...nearestCabinStation.station,
                      title: promptMeta.label,
                      actionLabel: promptMeta.actionLabel,
                      directAction: Boolean(promptMeta.direct),
                    },
                  };
                }
              }
            }

            // Si el jugador está dentro de la cabina del ascensor estacionada y mirando adelante, priorizar panel del ascensor
            if (
              !nearestCabinStation &&
              Math.hypot(astronautPos.x, astronautPos.z) <= 1.08 &&
              elSys &&
              elSys.state.phase === 'idle'
            ) {
              const curFloor = resolveCurrentDeck(astronautPos);
              nearestCabinStation = {
                station: {
                  id: 'elevator-panel',
                  kind: 'elevator-panel',
                  deckId: curFloor.id,
                  label: `Selector de cubierta (${curFloor.code} · [1-4])`,
                  actionLabel: 'Planta',
                  directAction: false,
                  tag: 'ASCENSOR 3D',
                  position: { x: 0, y: curFloor.elevationY, z: 0 },
                  consolePos: { x: 0.78, y: curFloor.elevationY + 1.4, z: 0 },
                  aiHoverPos: { x: 0, y: curFloor.elevationY + 1.75, z: -2.2 },
                },
                distance: 0.65,
              };
            }
          }

          // In the novice handoff, keep the tactical table operable with E even
          // if the gaze ray misses its tilted screen. The tabletop is a broad,
          // low-contrast target in the 3D cockpit, so proximity is authoritative.
          if (
            guidedTourState?.mode === 'novice-cinematic' &&
            (guidedTourState.step === 'novice-mission-console' || guidedTourState.step === 'novice-walk-to-mission-console') &&
            resolveCurrentDeck(astronautPos)?.id === 'deck-01'
          ) {
            const missionStation = getStationDef('missions');
            const podiumDist = Math.hypot(astronautPos.x, astronautPos.z - 4.35);
            const tableDist = Math.hypot(astronautPos.x, astronautPos.z - 6.0);
            const missionDistance = Math.min(
              missionStation ? astronautPos.distanceTo(missionStation.position) : Infinity,
              podiumDist,
              tableDist,
            );
            if (missionStation && missionDistance <= 3.35) {
              nearestCabinStation = {
                station: {
                  ...missionStation,
                  title: 'Mando de Misiones SPHEREx · Mesa Táctica',
                  actionLabel: 'Abrir Misiones SPHEREx [E] o clic',
                },
                distance: missionDistance,
                gazeDot: 1,
              };
            }
          }

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
          const nearKey = nearestCabinStation
            ? `${nearId}::${nearestCabinStation.station.title || nearestCabinStation.station.label || ''}`
            : null;
          const activeDeck = resolveCurrentDeck(astronautPos);
          announceDeckContextIfChanged(activeDeck?.id, false);
          if (nearKey !== lastNearestStationId) {
            lastNearestStationId = nearKey;
            S.onNearestStationChange?.(
              nearestCabinStation
                ? {
                  ...nearestCabinStation.station,
                  distance: Number(nearestCabinStation.distance.toFixed(2)),
                }
                : null,
            );
          }
          if (guidedTourState && (guidedTourState.step === 'bridge' || guidedTourState.step === 'look_camera') && nearId === 'nav') {
            setTourStep('nav', 'nav');
            S.onGuideObjective?.('PASO 3/7 · CONSOLA DE NAVEGACIÓN: Acércate a la consola de navegación en el Puente y úsala con [E].');
          }
          if (guidedTourState && guidedTourState.step === 'astro_obs' && String(nearId || '').startsWith('elevator')) {
            setTourStep('elevator_c02', 'elevator');
            S.onAiTourNarrative?.(
              tourNarratives.elevator_c02,
              'Orientación',
              'elevator',
              { id: 'tut-step-hab', priority: 8, replace: true, once: false },
            );
          }
          if (guidedTourState && guidedTourState.step === 'elevator_c02' && activeDeck?.id === 'deck-02') {
            setTourStep('elevator_c03', 'elevator');
            S.onAiTourNarrative?.(
              tourNarratives.elevator_c03,
              'Orientación',
              'elevator',
              { id: 'tut-step-elevator', priority: 8, replace: true, once: false },
            );
          }
          if (
            guidedTourState &&
            (guidedTourState.step === 'elevator_c03' || guidedTourState.step === 'elevator_c02') &&
            activeDeck?.id === 'deck-03'
          ) {
            setTourStep('science', 'science');
            S.onAiTourNarrative?.(
              tourNarratives.science,
              'Orientación',
              'science',
              { id: 'tut-step-science', priority: 8, replace: true, once: false },
            );
          }
          if (guidedTourState?.focus && nearId === guidedTourState.focus && !guidedTourState.proximityAnnounced) {
            guidedTourState.proximityAnnounced = true;
            S.onAiTourNarrative?.(tourNarratives[guidedTourState.focus], 'Explicación', guidedTourState.focus);
          }

          const effectiveFocusedStation =
            guidedTourState?.focus &&
            activeCabinStation !== guidedTourState.focus &&
            !(
              (guidedTourState.step === 'elevator_c02' || guidedTourState.step === 'elevator_c03') &&
              elSys?.state?.passengerRiding
            )
              ? guidedTourState.focus
              : null;

          if (guidedTourState?.focus && !effectiveFocusedStation) {
            fourDecksInterior?.setTutorialWaypoint?.({ visible: false });
          }

          fourDecksInterior.updateStations(
            clk.elapsedTime,
            effectiveFocusedStation ? (nearId === effectiveFocusedStation ? nearId : null) : nearId,
            activeCabinStation || null,
            effectiveFocusedStation,
            freeHelmMode,
            astronautPos,
            activeRepairStage,
            getCockpitDisplayTelemetry(),
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

          const hudThrottleSec = Math.max(0.04, (effectiveGraphics.hudThrottleMs || 65) * 0.001);
          if (clk.elapsedTime - lastScreenProjectionTime > hudThrottleSec) {
            lastScreenProjectionTime = clk.elapsedTime;
            if (S.onAiScreenProjection) {
              luminousAI.group.getWorldPosition(_aiWorldPosScratch);
              _aiProjScratch.copy(_aiWorldPosScratch).project(localCam);
              const inFront = _aiProjScratch.z >= -1 && _aiProjScratch.z <= 1;
              const sx = Math.round((_aiProjScratch.x * 0.5 + 0.5) * innerWidth);
              const sy = Math.round((-_aiProjScratch.y * 0.5 + 0.5) * innerHeight);
              const aiVis = inFront && sx >= -100 && sx <= innerWidth + 100 && sy >= -100 && sy <= innerHeight + 100;
              const aiState = luminousAI.getState();
              const ax = Number(astronautPos.x.toFixed(2));
              const ay = Number(astronautPos.y.toFixed(2));
              const az = Number(astronautPos.z.toFixed(2));
              const deckId = activeDeckInfo.id;
              const mgMode = mgResult.mode;
              const mgSpd = mgResult.speed;
              const mgRail = mgResult.anchoredRailId || '';
              const nextAiKey = `${aiVis ? 1 : 0}|${sx}|${sy}|${aiState}|${ax}|${ay}|${az}|${deckId}|${mgMode}|${mgSpd}|${mgRail}|${cabinFirstPerson ? 1 : 0}`;
              if (nextAiKey !== lastAiProjKey) {
                lastAiProjKey = nextAiKey;
                S.onAiScreenProjection({
                  visible: aiVis,
                  x: sx,
                  y: sy,
                  state: aiState,
                  astronautX: ax,
                  astronautY: ay,
                  astronautZ: az,
                  deckId,
                  deckName: activeDeckInfo.name,
                  microgravityMode: mgMode,
                  microgravitySpeed: mgSpd,
                  anchoredRailId: mgResult.anchoredRailId,
                  cabinFirstPerson,
                });
              }
            }

            if (activeCabinStation && S.onConsoleScreenProjection) {
              const stObj = getStationDef(activeCabinStation);
              const stEntry = fourDecksInterior.stationMeshes.find((m) => m.id === activeCabinStation);
              if (stObj && stEntry && stEntry.screenMesh) {
                stEntry.screenMesh.getWorldPosition(_consoleWorldPosScratch);
                _consoleProjScratch.copy(_consoleWorldPosScratch).project(localCam);
                const screenInFront = _consoleProjScratch.z >= -1 && _consoleProjScratch.z <= 1;
                const scX = Math.round((_consoleProjScratch.x * 0.5 + 0.5) * innerWidth);
                const scY = Math.round((-_consoleProjScratch.y * 0.5 + 0.5) * innerHeight);
                const distToCam = localCam.position.distanceTo(_consoleWorldPosScratch);
                const scaleFactor = Number(Math.max(0.65, Math.min(1.25, 2.6 / Math.max(1.2, distToCam))).toFixed(3));
                const distMeters = Number(distToCam.toFixed(2));
                const shipSpeed = Number(vel.length().toFixed(2));
                const shipInertia = Number(ac.toFixed(3));
                const heading = Math.round((((vel.lengthSq() > 1e-8 ? Math.atan2(vel.x, -vel.z) * 57.2958 : -fy * 57.2958) % 360) + 360) % 360);
                const pitch = Math.round(vel.lengthSq() > 1e-8 ? Math.atan2(vel.y, Math.hypot(vel.x, vel.z)) * 57.2958 : -fp * 57.2958);
                const flightMode = nav ? 'AUTOPILOTO' : activeCabinStation === 'nav' ? 'MANUAL' : 'ESPERA';
                const conVis = screenInFront && distToCam < 4.8;
                const nextConsoleKey = `${activeCabinStation}|${conVis ? 1 : 0}|${scX}|${scY}|${scaleFactor}|${distMeters}|${shipSpeed}|${shipInertia}|${heading}|${pitch}|${flightMode}`;
                if (nextConsoleKey !== lastConsoleProjKey) {
                  lastConsoleProjKey = nextConsoleKey;
                  consoleProjWasActive = true;
                  S.onConsoleScreenProjection({
                    activeStationId: activeCabinStation,
                    visible: conVis,
                    x: scX,
                    y: scY,
                    scale: scaleFactor,
                    distMeters,
                    speed: shipSpeed,
                    inertia: shipInertia,
                    heading,
                    pitch,
                    flightMode,
                  });
                }
              }
            } else if (S.onConsoleScreenProjection && consoleProjWasActive) {
              consoleProjWasActive = false;
              lastConsoleProjKey = '';
              S.onConsoleScreenProjection(null);
            }
            if (
              S.onMissionWaypointHud &&
              guidedTourState?.mode === 'novice-cinematic' &&
              (guidedTourState.step === 'novice-mission-console' || guidedTourState.step === 'novice-walk-to-mission-console') &&
              activeCabinStation !== 'missions' &&
              !exteriorCameraMode &&
              pv === 1 &&
              activeDeckInfo?.id === 'deck-01'
            ) {
              const deckYNow = DECK_SPAWNS['deck-01'].pos.y;
              const vw = Math.max(320, Number(dom?.clientWidth || innerWidth || 1280));
              const vh = Math.max(240, Number(dom?.clientHeight || innerHeight || 720));
              _missionWpApproachScratch.set(0, deckYNow, 4.35);
              const distMeters = Number(
                Math.max(0, astronautPos.distanceTo(_missionWpApproachScratch)).toFixed(1),
              );
              _missionWpWorldScratch.set(0, deckYNow + 1.55, 4.58).applyQuaternion(q);
              _missionWpViewScratch.copy(_missionWpWorldScratch).applyMatrix4(localCam.matrixWorldInverse);
              _missionWpProjScratch.copy(_missionWpWorldScratch).project(localCam);
              const inFront = _missionWpViewScratch.z < -0.15;
              const rawX = Math.round((_missionWpProjScratch.x * 0.5 + 0.5) * vw);
              const rawY = Math.round((-_missionWpProjScratch.y * 0.5 + 0.5) * vh);
              const onScreen =
                inFront && rawX >= 72 && rawX <= vw - 72 && rawY >= 86 && rawY <= vh - 96;
              const turnAngleRad = Number(
                Math.atan2(_missionWpViewScratch.x, Math.max(0.001, -_missionWpViewScratch.z) * (inFront ? 1 : -1) || _missionWpViewScratch.z).toFixed(3),
              );
              // Compact 2D pointing angle (radians, 0 = right, -PI/2 = up, +PI/2 = down, +-PI = left)
              const viewDx = _missionWpViewScratch.x;
              const viewDy = -_missionWpViewScratch.y;
              const arrowAngleRad = inFront
                ? Math.atan2(viewDy, viewDx)
                : Math.atan2(0, _missionWpViewScratch.x >= 0 ? 1 : -1);
              const nearReady = distMeters <= 3.35 || nearestCabinStation?.station?.id === 'missions';
              const autoWalking = Boolean(deckTransitState?.active);
              const wpKey = `${onScreen ? 1 : 0}|${inFront ? 1 : 0}|${rawX}|${rawY}|${distMeters}|${nearReady ? 1 : 0}|${autoWalking ? 1 : 0}|${Math.round(arrowAngleRad * 20)}`;
              if (wpKey !== lastMissionWpHudKey) {
                lastMissionWpHudKey = wpKey;
                missionWpHudWasActive = true;
                const safePinX = Math.max(150, Math.min(vw - 150, rawX));
                const safePinYBase = Math.max(92, Math.min(vh - 135, rawY));
                const safePinY =
                  safePinX > vw - 360 && safePinYBase < 275
                    ? Math.min(vh - 135, 275)
                    : safePinYBase;
                S.onMissionWaypointHud({
                  visible: true,
                  inFront,
                  onScreen,
                  x: safePinX,
                  y: safePinY,
                  arrowAngleRad: Number(arrowAngleRad.toFixed(3)),
                  turnSide: _missionWpViewScratch.x >= 0 ? 'right' : 'left',
                  bearingDeg: Math.round((Math.atan2(_missionWpViewScratch.x, -_missionWpViewScratch.z) * 180) / Math.PI),
                  distanceMeters: distMeters,
                  nearReady,
                  autoWalking,
                  turnHint: turnAngleRad,
                });
              }
            } else if (S.onMissionWaypointHud && missionWpHudWasActive) {
              missionWpHudWasActive = false;
              lastMissionWpHudKey = '';
              S.onMissionWaypointHud(null);
            }
            if (vrConsoleOverlay) {
              const nextVrHoverKey =
                activeCabinStation && vrFrame?.rayHit?.vrAction
                  ? vrFrame?.rayHit?.vrPayload?.buttonKey || null
                  : null;
              if (nextVrHoverKey && nextVrHoverKey !== lastVrHoverButtonKey) {
                S.onSfxCue?.('vr-hover');
              }
              lastVrHoverButtonKey = nextVrHoverKey;
              const elSysVr = fourDecksInterior?.elevatorSystem;
              const doorHereVr = Number(elSysVr?.state?.doorOpenByDeck?.[activeDeckInfo?.id] ?? 0);
              const cabHereVr = Boolean(
                elSysVr &&
                  Math.abs(elSysVr.state.cabY - (activeDeckInfo?.elevationY ?? 0)) < 0.25 &&
                  doorHereVr > 0.72,
              );
              const tgtObjVr =
                SPHEREX_TARGETS.find((t) => t.key === (vrUiContextState.activeTargetKey || activeMissionKey)) || null;
              vrConsoleOverlay.update({
                presenting: Boolean(vrManager?.isPresenting?.()),
                inCabin: true,
                activeStationId: activeCabinStation,
                stationAnchorPos: activeCabinStationAnchorPos,
                deckFloorY: activeDeckInfo?.elevationY ?? 3.4,
                eyePos: _gazeEyePos,
                hoveredHit: vrFrame?.rayHit || null,
                context: {
                  targetName: tgtObjVr?.name || f || near || 'Sistema Solar',
                  activeTargetKey: tgtObjVr?.key || activeMissionKey || 'barnard',
                  findingsCount: vrUiContextState.findingsCount,
                  lastKronoxReply: vrUiContextState.lastKronoxReply,
                  voiceEnabled: vrUiContextState.voiceEnabled,
                  visualProfile: vrUiContextState.visualProfile,
                  opticalMagnification: opticalTelescopeState?.enabled ? opticalTelescopeState.magnification : 1,
                  speed: vel.length(),
                  flightMode: nav ? 'AUTOPILOTO' : freeHelmMode ? 'TIMÓN LIBRE' : activeCabinStation === 'nav' ? 'MANUAL' : 'ESPERA',
                  freeHelmMode,
                  seated: astronautSeatedInBridge,
                  repairStage: activeRepairStage,
                  currentDeckId: activeDeckInfo?.id || 'deck-01',
                  mechanisms: fourDecksInterior?.mechanisms?.state || {},
                  cabHere: cabHereVr,
                  isAnchored: microgravityController.isAnchored(),
                },
              });
            }
          }
        } else {
          lastVrHoverButtonKey = null;
          vrConsoleOverlay?.update?.({ presenting: false, inCabin: false });
          localCabinWorld.visible = false;
          if (nearestCabinStation || lastNearestStationId || activeCabinStation || missionWpHudWasActive) {
            nearestCabinStation = null;
            lastNearestStationId = null;
            activeCabinStation = null;
            if (missionWpHudWasActive) {
              missionWpHudWasActive = false;
              lastMissionWpHudKey = '';
              S.onMissionWaypointHud?.(null);
            }
            if (!exteriorCameraMode && pv === 1) {
              freeHelmMode = false;
              S.onFreeHelmChange?.(false);
            }
            S.onNearestStationChange?.(null);
            S.onStationInteract?.(null);
          }
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
            const hasVrChaseOrbit =
              pv == 3 && (Math.abs(vrChaseYaw) > 1e-4 || Math.abs(vrChasePitch) > 1e-4);
            const chaseMeters = new V(0.28, 0.16, 1.0)
              .multiplyScalar(shipCameraDistanceMeters() * (pv == 3 ? 1 : 0));
            if (hasVrChaseOrbit) {
              chaseMeters.applyEuler(new THREE.Euler(vrChasePitch, vrChaseYaw, 0, 'YXZ'));
            }
            chaseMeters.applyQuaternion(q);
            localCam.position.copy(chaseMeters);
            if (hasVrChaseOrbit) {
              localCam.lookAt(0, 0, 0);
            } else {
              localCam.quaternion.copy(q);
            }
            localCam.near = 0.25;
            localCam.far = 6000;
            localCam.fov = fovBase;
            localCam.updateProjectionMatrix();

            cam.quaternion.copy(localCam.quaternion);
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
          ship.visible = true;
          const baseTravelChase = new V(0.28, 0.16, 1.0).multiplyScalar(shipCameraDistanceMeters());
          if (Math.abs(vrChaseYaw) > 1e-4 || Math.abs(vrChasePitch) > 1e-4) {
            baseTravelChase.applyEuler(new THREE.Euler(vrChasePitch, vrChaseYaw, 0, 'YXZ'));
          }
          activeLocalOffsetMeters = baseTravelChase.applyQuaternion(q);
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
            fourDecksInterior.clampAstronautPosition(
              eye,
              0.25,
              0.24,
              fourDecksInterior?.elevatorSystem?.state || null,
              {
                lockedDeckId: currentLockedDeckId,
              },
            );
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
        ship.visible = Boolean(
          launchSequence ||
            exteriorCameraMode ||
            spectator ||
            pv == 3 ||
            (launchCameraBlend && !localCabinWorld.visible),
        );
        if (ship.visible) {
          localCabinWorld.visible = false;
        }
      }
      // En el Mundo Local Métrico (`localShipScene`, 1 u = 1 m), la nave está anclada en (0,0,0) con sus 120.0 m:
      ship.position.set(0, 0, 0);
      ship.scale.setScalar(SHIP_METRIC_SCALE);
      ship.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new V(0, 0, 1), bk));
      const hideOversizedLegacyPlumes = Boolean(mainMenuOrbitActive || realTimeIntro);
      fl2.visible = !hideOversizedLegacyPlumes && ship.visible;
      if (ship.visible) {
        if (fl2.visible) fl2.scale.setScalar(0.6 + 1.2 * th);
        if (modularShip) modularShip.update(dt, th, inDeepCruiseShowcase ? 0.88 : lastWarpAmount);
        for (let i = 0; i < FL.length; i++) {
          const o = FL[i];
          o.c.visible = !hideOversizedLegacyPlumes;
          o.k.visible = !hideOversizedLegacyPlumes;
          o.g.visible = !hideOversizedLegacyPlumes;
          if (!hideOversizedLegacyPlumes) {
            const L = (0.3 + 1.7 * th) * (1 + 0.1 * Math.sin(ti * 45 + i * 2));
            o.c.scale.set(1 + 0.3 * th, L, 1 + 0.3 * th);
            o.c.position.z = o.z + 0.5 * L;
            o.k.scale.set(1, L * 0.55, 1);
            o.k.position.z = o.z + 0.27 * L;
            o.g.scale.setScalar(0.35 + 0.5 * th);
          }
        }
        for (let i = 0; i < NL.length; i++) {
          NL[i].visible = Math.sin(ti * 4 + i * 3) > -0.2;
        }
      }
      const emitTrailNow = Boolean(O.tr && pv == 3 && kk > 0.9 && th > 0.3);
      if (emitTrailNow) {
        const tp = new V(0, 0, 1.3 * sz).applyQuaternion(q).add(sp);
        for (let j = 0; j < 4; j++) {
          TS.i = (TS.i + 1) % TRN;
          const o = TS.i * 3;
          TP[o] = tp.x + gs() * sz * 0.08;
          TP[o + 1] = tp.y + gs() * sz * 0.08;
          TP[o + 2] = tp.z + gs() * sz * 0.08;
          TB[TS.i] = ti;
        }
        trailFadeRemaining = 2.8;
      }
      if (trailFadeRemaining > 0) {
        trailFadeRemaining = Math.max(0, trailFadeRemaining - dt);
        const fadeOut = trailFadeRemaining <= 0;
        for (let j = 0; j < TRN; j++) {
          const b = fadeOut ? 0 : Math.max(0, Math.min(1, 1 - (ti - TB[j]) / 2.6)) * Math.min(1, th);
          TC[j * 3] = 0.4 * b;
          TC[j * 3 + 1] = 0.7 * b;
          TC[j * 3 + 2] = b;
        }
        tr.geometry.attributes.position.needsUpdate = tr.geometry.attributes.color.needsUpdate = true;
      }
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
      if (!warpCanvasEl && typeof document !== 'undefined') {
        warpCanvasEl = document.getElementById('warp');
        warpCanvasCtx = warpCanvasEl ? warpCanvasEl.getContext('2d') : null;
      }
      const wc = warpCanvasEl;
      const wg = warpCanvasCtx;
      if (wg && (navWarpAmount > 0.01 || warpCanvasWasActive)) {
        const targetWidth = Math.round(innerWidth * R.getPixelRatio()), targetHeight = Math.round(innerHeight * R.getPixelRatio());
        if (wc.width !== targetWidth) wc.width = targetWidth; if (wc.height !== targetHeight) wc.height = targetHeight;
        const w = wc.width,
          h = wc.height,
          cx = w * 0.5,
          cy = h * 0.5;
        const amount = navWarpAmount;
        wg.clearRect(0, 0, w, h);
        wc.style.opacity = amount.toFixed(2);
        warpCanvasWasActive = amount > 0.01;
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
      if (pv == 1 && frameNow - lastHudProjectionAt >= (effectiveGraphics.hudThrottleMs || 65)) {
        lastHudProjectionAt = frameNow;
        const y = getGaugeDom('yk'),
          t = getGaugeDom('tb');
        if (y)
          y.style.transform =
            'translateY(' +
            Math.max(-40, Math.min(40, -yp * 0.8)) +
            'px) rotate(' +
            Math.max(-60, Math.min(60, -bk * 80 + yw * 0.6)) +
            'deg)';
        if (t) t.style.transform = 'scaleX(' + Math.min(1, th / 1.2) + ')';
        if (y || t || getGaugeDom('lv') || getGaugeDom('needleSpeed')) {
          const g = getGaugeDom,
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
      if (
        vrFrame &&
        !freeHelmMode &&
        !simulationPaused &&
        !exteriorCameraTransition &&
        (vrFrame.turnYawDeltaRad || Math.abs(vrFrame.shipPitchAxis || 0) > 0.01)
      ) {
        const orbitOffset = cam.position.clone().sub(ct.target);
        if (orbitOffset.lengthSq() > 1e-6) {
          const sph = new THREE.Spherical().setFromVector3(orbitOffset);
          sph.theta += vrFrame.turnYawDeltaRad || 0;
          sph.phi = THREE.MathUtils.clamp(
            sph.phi - (vrFrame.shipPitchAxis || 0) * dt * 1.15,
            0.08,
            Math.PI - 0.08,
          );
          orbitOffset.setFromSpherical(sph);
          cam.position.copy(ct.target).add(orbitOffset);
          cam.lookAt(ct.target);
        }
      }
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
    {
      const curDeckForLabels = isCabinActive ? resolveCurrentDeck(astronautPos) : null;
      const inLowerEnclosedDeck = Boolean(
        isCabinActive && curDeckForLabels && curDeckForLabels.id !== 'deck-01' && !exteriorCameraMode && !opticalTelescopeState.enabled
      );
      const showSolarSpaceLabels = Boolean(
        !realTimeIntro &&
        !mainMenuOrbitActive &&
        !launchSequence &&
        !launchCameraBlend &&
        !contextOverview &&
        !nearbyMapState &&
        !nav &&
        !inLowerEnclosedDeck &&
        navigationContext.id === 'solar' &&
        (fl.lab !== false)
      );
      if (showSolarSpaceLabels) {
        const placed = placeSpacePlanetLabels(
          B.map((body) => ({
            name: body.p.n,
            pivot: body.pivot,
            label: body.lab,
            radius: body.r,
            allowed: true,
          })),
          cam,
          { width: innerWidth, height: innerHeight, left: 22, right: 22, top: 72, bottom: 72 },
        );
        spacePlanetLabelHits = placed.map((it) => it.entry.screenHit).filter(Boolean);
      } else {
        spacePlanetLabelHits = [];
        for (let i = 0; i < B.length; i++) {
          if (B[i].lab) {
            B[i].lab.visible = false;
            B[i].lab.userData.screenBox = null;
          }
        }
      }
    }
    if (hyperspace) hyperspace.update(nav, cam, dt);
    astronomicalHologram.update(dt, clk.elapsedTime, isCabinActive && localCabinWorld.visible);

    if (S.onAudioEnvironment) {
      const nowEnvMs = performance.now();
      if (nowEnvMs - lastAudioEnvEmitMs >= 160) {
        lastAudioEnvEmitMs = nowEnvMs;
        const zoneNow = mainMenuOrbitActive
          ? 'menu'
          : nearbyMapState || !free
            ? 'map'
            : pv === 1 && !exteriorCameraMode && isCabinActive
              ? 'cabin'
              : 'exterior';
        const deckIdNow = zoneNow === 'cabin' ? resolveCurrentDeck(astronautPos)?.id || 'deck-01' : 'deck-01';
        const elStateNow = fourDecksInterior?.elevatorSystem?.state;
        const elevatorMovingNow = Boolean(elStateNow && elStateNow.moving);
        const rawSpeed = vel.length();
        const speedBucket = rawSpeed < 0.25 ? 0 : Math.round(Math.log10(1 + rawSpeed) * 10);
        const thrustNow = Boolean(
          wasThrusterSfxActive ||
            (zoneNow === 'exterior' &&
              !simulationPaused &&
              (keys.w || keys.s || keys.arrowup || keys.arrowdown || keys.shift || keys.vrMoveFwd)),
        );
        const hPhaseNow = nav?.phase || null;
        const sleepNow = Boolean(astronautRestingInBed?.sleeping);
        const restNow = Boolean(astronautRestingInBed);
        const vrNow = Boolean(xrActiveNow);
        const sig = `${zoneNow}|${deckIdNow}|${hPhaseNow}|${speedBucket}|${thrustNow ? 1 : 0}|${elevatorMovingNow ? 1 : 0}|${sleepNow ? 1 : 0}|${restNow ? 1 : 0}|${vrNow ? 1 : 0}|${simulationPaused ? 1 : 0}`;
        if (sig !== lastAudioEnvSignature) {
          lastAudioEnvSignature = sig;
          S.onAudioEnvironment({
            zone: zoneNow,
            deckId: deckIdNow,
            hyperspacePhase: hPhaseNow,
            speed: rawSpeed,
            thrustActive: thrustNow,
            elevatorMoving: elevatorMovingNow,
            sleeping: sleepNow,
            resting: restNow,
            inVr: vrNow,
            paused: Boolean(simulationPaused),
          });
        }
      }
    }

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
    let xrRigsSyncedThisFrame = false;
    try {
      if (xrActiveNow && vrManager) {
        if (Math.abs(cam.near - VR_UNIFIED_NEAR) > 1e-6 || Math.abs(cam.far - VR_UNIFIED_FAR) > 1) {
          cam.near = VR_UNIFIED_NEAR;
          cam.far = VR_UNIFIED_FAR;
          cam.updateProjectionMatrix();
        }
        if (Math.abs(localCam.near - VR_UNIFIED_NEAR) > 1e-6 || Math.abs(localCam.far - VR_UNIFIED_FAR) > 1) {
          localCam.near = VR_UNIFIED_NEAR;
          localCam.far = VR_UNIFIED_FAR;
          localCam.updateProjectionMatrix();
        }
        const inCabinXr = Boolean(
          vrLocalEyeReady && free && pv === 1 && !exteriorCameraMode && !spectator && !mainMenuOrbitActive,
        );
        vrManager.syncRigsBeforeRender({
          astroCamPos: cam.position,
          astroCamQuat: cam.quaternion,
          localEyePos: inCabinXr ? vrLocalEyeScratch : localCam.position,
          localYawQuat: inCabinXr ? vrLocalYawQuatScratch : localCam.quaternion,
          inCabin: inCabinXr,
          xrFrame,
        });
        xrRigsSyncedThisFrame = true;
        originRebaseState = vrManager.renderAstroInVr({
          threshold: isPhysicalObservationActive() ? 0.001 : 10000,
          cellSize: isPhysicalObservationActive() ? 0 : 1024,
          highPrecisionBodies: isPhysicalObservationActive() ? B : null,
          scaleHeightUniforms: [GU.uH],
        });
      } else {
        originRebaseState = renderWithOriginRebase(R, sc, cam, {
          threshold: isPhysicalObservationActive() ? 0.001 : 10000,
          cellSize: isPhysicalObservationActive() ? 0 : 1024,
          highPrecisionBodies: isPhysicalObservationActive() ? B : null,
        });
      }

      // PASO 2 DE RENDERIZADO: Mundo Local Métrico (`localShipScene`, `1 u = 1 m`) con limpieza de profundidad
      if (localCabinWorld.visible || ship.visible) {
        if (localCabinWorld.visible && ship.visible) {
          const preferExterior = Boolean(
            mainMenuOrbitActive || exteriorCameraMode || spectator || pv == 3 || launchSequence,
          );
          ship.visible = preferExterior;
          localCabinWorld.visible = !preferExterior;
        }
        const inInteriorLighting = Boolean(localCabinWorld.visible && !exteriorCameraMode && !spectator);
        const inBridgeLighting = inInteriorLighting && resolveCurrentDeck(astronautPos)?.id === 'deck-01';
        localShipAmbient.intensity = inBridgeLighting ? 0.11 : inInteriorLighting ? 0.24 : 0.52;
        localShipHemi.intensity = inBridgeLighting ? 0.15 : inInteriorLighting ? 0.31 : 0.45;
        localShipSunLight.intensity = inBridgeLighting ? 0.20 : inInteriorLighting ? 0.72 : 2.35;
        localShipRimLight.intensity = inBridgeLighting ? 0.15 : inInteriorLighting ? 0.32 : 0.55;
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
    } finally {
      if (xrRigsSyncedThisFrame) {
        vrManager.restoreCamerasAfterRender();
      }
      if (savedExteriorCamPos) {
        cam.position.copy(savedExteriorCamPos);
      }
    }
    if (!initialSceneReadyFired) {
      warmLocalShipShaders();
      initialSceneReadyFired = true;
      S.onSceneReady?.();
    }
  }
  function applyCameraView(v) {
    if (!userCameraAvailable()) return false;
    const wasExteriorInspection = exteriorCameraMode;
    if (wasExteriorInspection) leaveExteriorCamera(true);
    pv = v;
    vrChaseYaw = 0;
    vrChasePitch = 0;
    if (v == 1) {
      if (freeHelmMode) {
        freeHelmMode = false;
        freeHelmBlend = 0;
        S.onFreeHelmChange?.(false);
      }
      cabinFirstPerson = true;
      S.onCabinFirstPersonChange?.(true);
      camViewBlend = 0;
      astronaut3D.root.visible = false;
      astronaut3D.firstPersonHands.visible = false;
      if (articulatedAstronaut) articulatedAstronaut.root.visible = false;
      fourDecksInterior?.setActiveVisibleDeck?.(resolveCurrentDeck(astronautPos)?.id || currentLockedDeckId, { showAll: false });
      if (!nav && !arrivalTarget) {
        astronautYaw = 0;
        astronautBodyYaw = 0;
        targetYaw = 0;
        astronautPitch = 0;
        targetPitch = 0;
      }
    } else {
      exitPointerLockIfActive('exterior');
      enterExteriorCameraClearHud();
      if (articulatedAstronaut) articulatedAstronaut.root.visible = false;
    }
    emitPointerLockState();
    const baseFov = v == 1 ? getCabinBaseFov() : fovBase;
    const activeMag = opticalTelescopeState.enabled ? opticalTelescopeState.magnification : 1;
    cam.near = isPhysicalObservationActive() ? 1e-5 : 0.05;
    cam.fov = activeMag > 1 ? computeTelescopeFieldOfView(baseFov, activeMag) : baseFov;
    cam.updateProjectionMatrix();
    localCam.near = v == 3 ? 0.25 : 0.05;
    localCam.far = v == 3 ? 6000 : 4000;
    localCam.fov = baseFov;
    localCam.updateProjectionMatrix();
    GU.uH.value = (innerHeight * R.getPixelRatio()) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    if (free) {
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
  vrManager = createWebXrManager({
    renderer: R,
    sceneAstro: sc,
    sceneLocal: localShipScene,
    camAstro: cam,
    camLocal: localCam,
    vrSettings: S.vrSettings || DEFAULT_VR_SETTINGS,
    isNodeHarness: IS_NODE_SCENE_HARNESS,
    onStateChange: (vrState) => S.onVrStateChange?.(vrState),
    onSessionStartCallback: () => {
      exitPointerLockIfActive('vr');
      simulationPaused = false;
      realTimeIntroPaused = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (free && (pv !== 1 || exteriorCameraMode || !cabinFirstPerson || camViewBlend > 0.05)) {
        applyCameraView(1);
        S.onViewChange?.(1);
      }
      if (typeof R.setAnimationLoop === 'function') {
        R.setAnimationLoop(tick);
      }
    },
    onSessionEndCallback: () => {
      if (typeof R.setAnimationLoop === 'function') {
        R.setAnimationLoop(null);
      }
      delete keys.vrMoveFwd;
      delete keys.vrMoveStrafe;
      delete keys.vrMoveVert;
      delete keys.vrBoost;
      delete keys.vrStabilize;
      if (!disposed && !rafId && typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(tick);
      }
    },
    onInteractHit: (interactId, rayHit) => {
      if (simulationPaused) {
        if (vrManager?.isPresenting?.()) {
          simulationPaused = false;
          S.onVrPauseRequest?.({ resumeOnly: true });
        } else {
          return;
        }
      }
      if (rayHit?.vrAction) {
        handleVrConsoleAction(rayHit.vrAction, rayHit.vrPayload);
        return;
      }
      if (!interactId) return;
      triggerCabinStationInteraction(interactId, null, rayHit);
    },
    onStatusMessage: (msg) => {
      if (!msg) return;
      S.onInteractionFeedback?.({
        id: 'vr-status',
        text: msg,
        ts: Date.now(),
      });
    },
  });
  if (!IS_NODE_SCENE_HARNESS) {
    vrManager.refreshAvailability?.().catch(() => {});
  }
  tick();
  if (IS_NODE_SCENE_HARNESS && !initialSceneReadyFired) {
    initialSceneReadyFired = true;
    S.onSceneReady?.();
  }
  return {
    isSceneReady: () => initialSceneReadyFired,
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
      emitPointerLockState('cabin-ready');
      S.onObservationModeChange?.(getObservationMode());
    },
    releaseInputs,
    setSimulationPaused: (paused) => {
      simulationPaused = Boolean(paused);
      if (simulationPaused) {
        exitPointerLockIfActive('pause');
        releaseInputs();
        vel.set(0, 0, 0);
        astronautVel.set(0, 0, 0);
      } else {
        clk.getDelta();
        releaseInputs();
      }
      emitPointerLockState();
      return simulationPaused;
    },
    isSimulationPaused: () => simulationPaused,
    cycleCameraMode: () => {
      applyCameraView(pv === 1 ? 3 : 1);
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
    onGuidedDestinationSelected,
    onGuidedDestinationArrival,
    onGuidedMissionStarted,
    onGuidedJournalOpen,
    onGuidedInventoryOpen,
    skipGuidedTourStep,
    endGuidedCabinTour,
    setCabinFirstPerson: (firstPerson = true) => {
      cabinFirstPerson = Boolean(firstPerson);
      camViewBlend = cabinFirstPerson ? 0 : 1;
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
      if (guidedTourState && guidedTourState.step === 'look_camera') {
        setTourStep('nav', 'nav');
        S.onAiTourNarrative?.(tourNarratives.nav, 'Orientación', 'nav', {
          id: 'tut-step-nav',
          priority: 8,
          replace: true,
          once: false,
        });
      }
      return cabinFirstPerson;
    },
    setCabinPerspective,
    setFreeHelmMode: (enabled) => applyFreeHelmMode(enabled),
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
        currentLockedDeckId = resolveCurrentDeck(astronautPos).id;
        if (fourDecksInterior) {
          fourDecksInterior.clampAstronautPosition(
            astronautPos,
            undefined,
            undefined,
            fourDecksInterior.elevatorSystem?.state || null,
            { lockedDeckId: currentLockedDeckId },
          );
        } else if (cabinSystem?.clampAstronautPosition) {
          cabinSystem.clampAstronautPosition(astronautPos);
        }
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
      currentLockedDeckId = st.deckId || resolveCurrentDeck(astronautPos).id;
      fourDecksInterior.clampAstronautPosition(
        astronautPos,
        undefined,
        undefined,
        fourDecksInterior.elevatorSystem?.state || null,
        { lockedDeckId: currentLockedDeckId },
      );
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
      if (stationId) {
        exitPointerLockIfActive('station');
      } else {
        if (!exteriorCameraMode) {
          freeHelmMode = false;
          freeHelmBlend = 0;
          S.onFreeHelmChange?.(false);
        }
        if (!guidedTourState || guidedTourState.step === 'free' || !guidedTourState.focus) {
          fourDecksInterior?.setTutorialWaypoint?.({ visible: false });
        } else {
          syncTutorialWaypointForStep(guidedTourState.step);
        }
        aiFollowAstronaut = true;
        luminousAI.pointAtWorldPosition(null, false);
        sceneDirector.returnToAstronautControl();
      }
      emitPointerLockState();
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
    setGraphicsSettings: (nextSettings = {}) => applyGraphicsSettings(nextSettings),
    getGraphicsSettings: () => ({
      settings: { ...graphicsUserSettings },
      effective: { ...effectiveGraphics },
      hardware: hardwareCapabilities,
    }),
    getHardwareCapabilities: () => hardwareCapabilities,
    getPointerLockState,
    requestPointerLock: () => requestPointerLockForLook('api'),
    exitPointerLock: () => exitPointerLockIfActive('api'),
    getProgressiveLoadingState: () => ({
      ...progressiveAssetState,
      remaining: progressiveQueue.length + getPendingGalaxyTextureCount(),
    }),
    flushProgressiveAssets: (maxTasks = 24) => runNextProgressiveTask(maxTasks),
    quality: (mode) => applyGraphicsSettings({ preset: normalizeGraphicsPreset(mode, 'auto') }),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (typeof R.setAnimationLoop === 'function') {
        R.setAnimationLoop(null);
      }
      vrManager?.dispose?.();
      clearTimeout(speedNoticeTimer);
      clearTimeout(progressiveTimer);
      clearTimeout(deferredWarmupTimer);
      exitPointerLockIfActive('dispose');
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      removeEventListener('keydown', onKeyDown);
      removeEventListener('keyup', onKeyUp);
      removeEventListener('blur', releaseInputs); document.removeEventListener('visibilitychange', onVisibilityChange); document.removeEventListener('focusin', onInputFocus); dom.removeEventListener('pointercancel', releaseInputs);
      removeEventListener('resize', onResize);
      if (backgroundIntroTimer) {
        clearInterval(backgroundIntroTimer);
        backgroundIntroTimer = null;
      }
      disposeTravelEffect();
      vrConsoleOverlay?.dispose?.();
      astronomicalHologram.dispose();
      localShipEnvRenderTarget?.dispose?.();
      localShipPmremGenerator?.dispose?.();
      ct.dispose();
      const released = disposeSceneResources(sc);
      disposeSceneResources(localShipScene, released);
      destinationResources.dispose(released);
      R.renderLists?.dispose();
      R.dispose();
      if (R.domElement.parentNode === el) el.removeChild(R.domElement);
    },
    view: (v) => applyCameraView(v),
    resetExteriorView: resetExteriorCamera,
    inspectExterior,
    isExteriorInspection: () => exteriorCameraMode,
    isFreeHelmActive: () => freeHelmMode,
    getSpacePlanetLabelScreenHits: () => spacePlanetLabelHits,
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
      if (noviceCinematicLocked) return;
      v ? (keys[k] = 1) : delete keys[k];
    },
    focus,
    orientTowardPlanet: (planetName) => {
      const body = B.find((x) => x.p.n === planetName);
      if (!body) return false;
      promotePlanetTexture(planetName);
      publishScale('solar');
      if (!free) {
        return focus(planetName);
      }
      const targetWorld = body.pivot.getWorldPosition(new THREE.Vector3());
      const toPlanet = targetWorld.sub(sp);
      if (toPlanet.lengthSq() < 1e-12) return false;
      const dir = toPlanet.normalize();
      if (pv === 1 && !exteriorCameraMode) {
        const invShip = ship.quaternion.clone().invert();
        const localDir = dir.clone().applyQuaternion(invShip).normalize();
        const nextYaw = Math.atan2(-localDir.x, -localDir.z);
        const nextPitch = Math.max(-1.05, Math.min(1.05, Math.asin(Math.max(-1, Math.min(1, localDir.y)))));
        astronautYaw = nextYaw;
        targetYaw = nextYaw;
        astronautPitch = nextPitch;
        targetPitch = nextPitch;
        if (!opticalTelescopeState.enabled) {
          setOpticalTelescope({ enabled: true, magnification: 10, targetName: planetName });
        } else {
          opticalTelescopeState.targetName = planetName;
          S.onObservationModeChange?.(getObservationMode());
        }
        return true;
      }
      // En Exterior / Timón libre: orientar el rumbo de la nave y encuadrar suavemente desde popa hacia el planeta
      fy = Math.atan2(-dir.x, -dir.z);
      fp = Math.max(-0.85, Math.min(0.85, Math.asin(Math.max(-1, Math.min(1, dir.y)))));
      const qNext = new THREE.Quaternion().setFromEuler(new THREE.Euler(fp, fy, 0, 'YXZ'));
      ship.quaternion.copy(qNext);
      if (exteriorCameraMode) {
        const dist = Math.max(95, cam.position.distanceTo(ct.target));
        const eyeDir = dir.clone().negate().add(new THREE.Vector3(0, 0.28, 0)).normalize();
        ct.target.copy(sp);
        cam.position.copy(sp).addScaledVector(eyeDir, dist);
        cam.lookAt(ct.target);
        ct.update();
      }
      return true;
    },
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
    setCinematicMissionDestination: (targetKey) => {
      machineSystems.setRouteTargetVector?.(targetKey);
      machineSystems.navHoloGroup.visible = true;
    },
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
      toggleNearestGrabRail(2.5, true);
      return microgravityController.getAnchoredRailId();
    },
    setCameraSettings: ({ sensitivity, distance3P } = {}) => {
      if (sensitivity && SENSITIVITY_MULT_MAP[sensitivity]) {
        cameraSensitivitySetting = sensitivity;
      }
      if (distance3P && DISTANCE_3P_MAP[distance3P]) {
        cameraDistance3PSetting = distance3P;
      }
      return {
        sensitivity: cameraSensitivitySetting,
        distance3P: cameraDistance3PSetting,
      };
    },
    setHeldTool: (toolId) => {
      heldToolId = toolId || null;
      return heldToolId;
    },
    getHeldTool: () => heldToolId,
    getInteractionPrompt: () => nearestCabinStation?.station || null,
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
      const safeDeckId = DECK_SPAWNS[deckId] ? deckId : 'deck-01';
      currentLockedDeckId = safeDeckId;
      fourDecksInterior.elevatorSystem?.snapToDeck?.(safeDeckId);
      astronautPos.copy(cfg.pos);
      astronautVel.set(0, 0, 0);
      fourDecksInterior.clampAstronautPosition(
        astronautPos,
        undefined,
        undefined,
        fourDecksInterior.elevatorSystem?.state || null,
        { lockedDeckId: currentLockedDeckId },
      );
      microgravityController.setPosition(astronautPos);
      astronautYaw = Number.isFinite(yawOverride) ? yawOverride : cfg.yaw;
      astronautBodyYaw = astronautYaw;
      prevAstronautYaw = astronautYaw;
      targetYaw = astronautYaw;
      astronautPitch = -0.05;
      targetPitch = -0.05;
      if (articulatedAstronaut) {
        articulatedAstronaut.root.position.copy(astronautPos);
        articulatedAstronaut.root.rotation.y = astronautBodyYaw;
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
      if (fourDecksInterior?.elevatorSystem) {
        S.onElevatorStateChange?.({
          ...fourDecksInterior.elevatorSystem.state,
          doorOpenByDeck: { ...fourDecksInterior.elevatorSystem.state.doorOpenByDeck },
        });
      }
      return {
        deckId: deckInfo.id,
        deckNumber: deckInfo.deckNumber,
        deckName: deckInfo.name,
        position: astronautPos.toArray(),
        yaw: astronautYaw,
      };
    },
    selectElevatorFloor: (deckId) => startPhysicalElevatorRide(deckId),
    getElevatorState: () =>
      fourDecksInterior?.elevatorSystem
        ? {
          ...fourDecksInterior.elevatorSystem.state,
          doorOpenByDeck: { ...fourDecksInterior.elevatorSystem.state.doorOpenByDeck },
        }
        : null,
    interactStationMechanism: (actionId, value = null) => {
      const res = fourDecksInterior?.mechanisms?.trigger(actionId, value);
      if (res?.state) S.onMechanismsChange?.({ ...res.state });
      return res || { ok: false, state: null };
    },
    getMechanismsState: () =>
      fourDecksInterior?.mechanisms?.state ? { ...fourDecksInterior.mechanisms.state } : null,
    activateNearestStation: () => {
      if (astronautSeatedInBridge) {
        return standUpFromBridgeSeat();
      }
      if (astronautRestingInBed) {
        return standUpFromRestBed();
      }
      if (!nearestCabinStation?.station) return false;
      if (nearestCabinStation.station.id === 'stand-up-seat') {
        return standUpFromBridgeSeat();
      }
      if (nearestCabinStation.station.id === 'stand-up-bed') {
        return standUpFromRestBed();
      }
      triggerCabinStationInteraction(nearestCabinStation.station.id, nearestCabinStation.station);
      return true;
    },
    standUpFromBridgeSeat,
    sitInCommandSeat: sitInBridgeCommandSeat,
    isAstronautSeated: () => astronautSeatedInBridge,
    restInBed: restInCabinBed,
    standUpFromRestBed,
    triggerOrbitalNap: triggerBedOrbitalNap,
    getRestState: getRestStateSnapshot,
    isAstronautResting: () => Boolean(astronautRestingInBed),
    setRepairMissionStage: (stage) => {
      activeRepairStage = Math.max(0, Math.min(4, Number(stage) || 0));
      return activeRepairStage;
    },
    getRepairMissionStage: () => activeRepairStage,
    getAsteroidBelt: () => realisticAsteroidBelt,
    identifyTargetUnderCrosshair: () => {
      if (
        free &&
        pv === 1 &&
        !exteriorCameraMode &&
        !opticalTelescopeState.enabled &&
        !freeHelmMode &&
        activeCabinStation !== 'windows' &&
        activeCabinStation !== 'nav'
      ) {
        return null;
      }
      return naturalGalaxySky?.identifyTargetUnderCrosshair?.(cam) || null;
    },
    verifyFloatingOriginPrecision,
    computeDoublePrecisionRelativeVector,
    getVrState: () => vrManager?.getState?.() || null,
    enterVr: () => (vrManager ? vrManager.enterVr() : Promise.resolve({ ok: false })),
    exitVr: () => (vrManager ? vrManager.exitVr() : Promise.resolve({ ok: false })),
    recenterVr: () => vrManager?.recenterVr?.() || null,
    setVrSettings: (next) => vrManager?.setSettings?.(next) || null,
    applyVrControllerInput: (inputPatch) => vrManager?.setSyntheticInput?.(inputPatch) || null,
    syncVrContext: (patch) => {
      if (patch && typeof patch === 'object') {
        Object.assign(vrUiContextState, patch);
      }
      return { ...vrUiContextState };
    },
    handleVrConsoleAction: (action, payload) => handleVrConsoleAction(action, payload),
    getVrConsoleButtonMeshes: () => vrConsoleOverlay?.getInteractiveButtonMeshes?.() || [],
    walkNoviceToMissionConsole,
  };
}
