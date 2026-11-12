import * as THREE from 'three';
import {
  CANONICAL_STARS_BY_ID,
  CANONICAL_GALAXIES_BY_ID,
  GALAXY_MORPHOLOGY_METADATA,
  icrsToCartesianPc,
  cartesianPcToIcrs,
  icrsToGalacticDeg,
  temperatureToSpaceColorHex,
} from './astronomicalUniverse.js';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Estrellas brillantes de referencia de Hipparcos / Gaia DR3 que complementan el catálogo de navegación
 * para que el firmamento contenga tanto estrellas cercanas (que exhiben gran paralaje 3D al viajar)
 * como supergigantes y gigantes lejanas (que permanecen casi fijas al viajar unos pocos pársecs).
 */
export const BRIGHT_REFERENCE_SKY_STARS = [
  { key: 'canopus', name: 'Canopus', ra: 95.9879, dec: -52.6957, distancePc: 94.8, temperatureK: 7400, absoluteMagnitude: -5.71, spectralType: 'A9II' },
  { key: 'arcturus', name: 'Arturo', ra: 213.9153, dec: 19.1824, distancePc: 11.26, temperatureK: 4286, absoluteMagnitude: -0.30, spectralType: 'K1.5III' },
  { key: 'vega', name: 'Vega', ra: 279.2347, dec: 38.7837, distancePc: 7.68, temperatureK: 9602, absoluteMagnitude: 0.58, spectralType: 'A0V' },
  { key: 'capella', name: 'Capella', ra: 79.1723, dec: 45.9980, distancePc: 13.12, temperatureK: 4970, absoluteMagnitude: -0.48, spectralType: 'G3III' },
  { key: 'rigel', name: 'Rigel', ra: 78.6345, dec: -8.2016, distancePc: 264.0, temperatureK: 12100, absoluteMagnitude: -6.98, spectralType: 'B8Ia' },
  { key: 'procyon', name: 'Procyon', ra: 114.8255, dec: 5.2250, distancePc: 3.51, temperatureK: 6530, absoluteMagnitude: 2.68, spectralType: 'F5IV-V' },
  { key: 'achernar', name: 'Achernar', ra: 24.4286, dec: -57.2368, distancePc: 42.8, temperatureK: 15000, absoluteMagnitude: -2.70, spectralType: 'B6Vep' },
  { key: 'betelgeuse', name: 'Betelgeuse', ra: 88.7929, dec: 7.4071, distancePc: 168.0, temperatureK: 3600, absoluteMagnitude: -5.60, spectralType: 'M1-M2Ia-Iab' },
  { key: 'hadar', name: 'Hadar', ra: 210.9559, dec: -60.3730, distancePc: 161.0, temperatureK: 25000, absoluteMagnitude: -5.42, spectralType: 'B1III' },
  { key: 'altair', name: 'Altair', ra: 297.6958, dec: 8.8683, distancePc: 5.13, temperatureK: 7550, absoluteMagnitude: 2.22, spectralType: 'A7V' },
  { key: 'acrux', name: 'Acrux', ra: 186.6495, dec: -63.0991, distancePc: 99.0, temperatureK: 28000, absoluteMagnitude: -4.19, spectralType: 'B0.5IV' },
  { key: 'aldebaran', name: 'Aldebarán', ra: 68.9802, dec: 16.5093, distancePc: 20.43, temperatureK: 3910, absoluteMagnitude: -0.70, spectralType: 'K5III' },
  { key: 'antares', name: 'Antares', ra: 247.3519, dec: -26.4320, distancePc: 170.0, temperatureK: 3660, absoluteMagnitude: -5.28, spectralType: 'M1.5Iab' },
  { key: 'spica', name: 'Spica', ra: 201.2982, dec: -11.1613, distancePc: 77.0, temperatureK: 25300, absoluteMagnitude: -3.55, spectralType: 'B1III-IV' },
  { key: 'pollux', name: 'Pólux', ra: 116.3290, dec: 28.0262, distancePc: 10.36, temperatureK: 4666, absoluteMagnitude: 1.08, spectralType: 'K0III' },
  { key: 'fomalhaut', name: 'Fomalhaut', ra: 344.4127, dec: -29.6222, distancePc: 7.70, temperatureK: 8590, absoluteMagnitude: 1.72, spectralType: 'A3V' },
  { key: 'deneb', name: 'Deneb', ra: 310.3580, dec: 45.2803, distancePc: 802.0, temperatureK: 8525, absoluteMagnitude: -8.38, spectralType: 'A2Ia' },
  { key: 'mimosa', name: 'Mimosa', ra: 191.9303, dec: -59.6888, distancePc: 85.0, temperatureK: 27000, absoluteMagnitude: -3.92, spectralType: 'B0.5III' },
  { key: 'regulus', name: 'Régulo', ra: 152.0930, dec: 11.9672, distancePc: 24.3, temperatureK: 12460, absoluteMagnitude: -0.57, spectralType: 'B8IVn' },
  { key: 'adhara', name: 'Adhara', ra: 104.6565, dec: -28.9721, distancePc: 124.0, temperatureK: 22200, absoluteMagnitude: -4.97, spectralType: 'B2II' },
  { key: 'castor', name: 'Cástor', ra: 113.6494, dec: 31.8883, distancePc: 15.6, temperatureK: 10286, absoluteMagnitude: 0.59, spectralType: 'A1V' },
  { key: 'gacrux', name: 'Gacrux', ra: 187.7915, dec: -57.1132, distancePc: 27.2, temperatureK: 3626, absoluteMagnitude: -0.56, spectralType: 'M3.5III' },
  { key: 'shaula', name: 'Shaula', ra: 263.4022, dec: -37.1038, distancePc: 175.0, temperatureK: 25000, absoluteMagnitude: -4.60, spectralType: 'B1.5IV' },
  { key: 'bellatrix', name: 'Bellatrix', ra: 81.2828, dec: 6.3497, distancePc: 77.0, temperatureK: 22000, absoluteMagnitude: -2.78, spectralType: 'B2III' },
  { key: 'elnath', name: 'Elnath', ra: 81.5730, dec: 28.6075, distancePc: 41.0, temperatureK: 13600, absoluteMagnitude: -1.42, spectralType: 'B7III' },
  { key: 'alnilam', name: 'Alnilam', ra: 84.0534, dec: -1.2019, distancePc: 600.0, temperatureK: 27500, absoluteMagnitude: -6.89, spectralType: 'B0Ia' },
  { key: 'alnitak', name: 'Alnitak', ra: 85.1897, dec: -1.9426, distancePc: 226.0, temperatureK: 29500, absoluteMagnitude: -5.00, spectralType: 'O9.5Ib' },
  { key: 'mintaka', name: 'Mintaka', ra: 83.0017, dec: -0.2991, distancePc: 380.0, temperatureK: 29500, absoluteMagnitude: -5.65, spectralType: 'O9.5II' },
  { key: 'polaris', name: 'Polaris', ra: 37.9546, dec: 89.2641, distancePc: 133.0, temperatureK: 6015, absoluteMagnitude: -3.60, spectralType: 'F7Ib' },
];

export function buildCatalogSkyStarList() {
  const map = new Map();
  for (const [key, star] of CANONICAL_STARS_BY_ID.entries()) {
    map.set(key, {
      key: star.key,
      name: star.name,
      raDeg: star.raDeg,
      decDeg: star.decDeg,
      distancePc: star.distancePc,
      positionPc: { ...star.positionPc },
      temperatureK: star.temperatureK,
      absoluteMagnitude: star.absoluteMagnitude,
      apparentMagnitudeFromSun: star.apparentMagnitude,
      spectralType: star.spectralType,
      spaceColorHex: star.spaceColorHex,
    });
  }
  for (const ref of BRIGHT_REFERENCE_SKY_STARS) {
    if (map.has(ref.key)) continue;
    const posPc = icrsToCartesianPc(ref.ra, ref.dec, ref.distancePc);
    const distMod = 5 * Math.log10(Math.max(0.01, ref.distancePc) / 10);
    map.set(ref.key, {
      key: ref.key,
      name: ref.name,
      raDeg: ref.ra,
      decDeg: ref.dec,
      distancePc: ref.distancePc,
      positionPc: posPc,
      temperatureK: ref.temperatureK,
      absoluteMagnitude: ref.absoluteMagnitude,
      apparentMagnitudeFromSun: Number((ref.absoluteMagnitude + distMod).toFixed(2)),
      spectralType: ref.spectralType,
      spaceColorHex: temperatureToSpaceColorHex(ref.temperatureK, ref.spectralType),
    });
  }
  return [...map.values()];
}

export const CATALOG_SKY_STARS = buildCatalogSkyStarList();

/**
 * Calcula cómo se ve el cielo catalogado (Capa A) desde cualquier posición 3D del observador en pársecs.
 */
export function computeSkyFromObserverPc(observerPosPc = { x: 0, y: 0, z: 0 }, options = {}) {
  const ox = Number(observerPosPc?.x || 0);
  const oy = Number(observerPosPc?.y || 0);
  const oz = Number(observerPosPc?.z || 0);
  const observerDistanceFromSunPc = Math.hypot(ox, oy, oz);
  const visualProfile = options.visualProfile === 'scientific' ? 'scientific' : 'cinematic';

  let environmentMode = 'milky-way-interior';
  let hostGalaxyKey = 'milky-way';
  if (options.hostGalaxyKey && options.hostGalaxyKey !== 'milky-way') {
    environmentMode = 'external-galaxy-interior';
    hostGalaxyKey = options.hostGalaxyKey;
  } else if (options.extragalacticMap || observerDistanceFromSunPc > 25000) {
    environmentMode = 'intergalactic-space';
    hostGalaxyKey = null;
  }

  const projectedStars = [];
  for (const star of CATALOG_SKY_STARS) {
    const dx = star.positionPc.x - ox;
    const dy = star.positionPc.y - oy;
    const dz = star.positionPc.z - oz;
    const distFromObserverPc = Math.hypot(dx, dy, dz);

    if (distFromObserverPc < 0.02) continue;

    const dir = cartesianPcToIcrs(dx, dy, dz);
    const apparentMag = Number(
      (star.absoluteMagnitude + 5 * Math.log10(Math.max(0.01, distFromObserverPc) / 10)).toFixed(2),
    );

    let angularShiftDeg = 0;
    if (star.distancePc > 0.01) {
      const uSunX = star.positionPc.x / star.distancePc;
      const uSunY = star.positionPc.y / star.distancePc;
      const uSunZ = star.positionPc.z / star.distancePc;
      const uObsX = dx / distFromObserverPc;
      const uObsY = dy / distFromObserverPc;
      const uObsZ = dz / distFromObserverPc;
      const dot = Math.max(-1, Math.min(1, uSunX * uObsX + uSunY * uObsY + uSunZ * uObsZ));
      angularShiftDeg = Number((Math.acos(dot) * RAD2DEG).toFixed(4));
    }

    const gal = icrsToGalacticDeg(dir.raDeg, dir.decDeg);

    projectedStars.push({
      key: star.key,
      name: star.name,
      raDeg: Number(dir.raDeg.toFixed(4)),
      decDeg: Number(dir.decDeg.toFixed(4)),
      lDeg: Number(gal.lDeg.toFixed(4)),
      bDeg: Number(gal.bDeg.toFixed(4)),
      distanceFromObserverPc: Number(distFromObserverPc.toFixed(4)),
      apparentMagnitude: apparentMag,
      angularShiftFromEarthDeg: angularShiftDeg,
      unitDirection: {
        x: dx / distFromObserverPc,
        y: dy / distFromObserverPc,
        z: dz / distFromObserverPc,
      },
      spaceColorHex: star.spaceColorHex,
      temperatureK: star.temperatureK,
      spectralType: star.spectralType,
    });
  }

  const nearGalacticPlaneCount = projectedStars.filter((s) => Math.abs(s.bDeg) <= 22).length;
  const highGalacticLatitudeCount = projectedStars.filter((s) => Math.abs(s.bDeg) > 40).length;

  return {
    observerPosPc: { x: ox, y: oy, z: oz },
    observerDistanceFromSunPc: Number(observerDistanceFromSunPc.toFixed(4)),
    environmentMode,
    hostGalaxyKey,
    visualProfile,
    densityStats: {
      nearGalacticPlaneCount,
      highGalacticLatitudeCount,
      totalCatalogStars: projectedStars.length,
    },
    isConditionedSimulation: environmentMode === 'external-galaxy-interior',
    simulationDisclaimer:
      environmentMode === 'external-galaxy-interior'
        ? `Cielo estelar interior de ${hostGalaxyKey.toUpperCase()}: simulación condicionada por la morfología, inclinación y población estelar observada (las estrellas individuales no están resueltas en 3D en catálogos de paralaje).`
        : environmentMode === 'intergalactic-space'
          ? 'Espacio intergaláctico: sin campo estelar local de la Vía Láctea; las galaxias se ubican según sus coordenadas de catálogo.'
          : 'Interior de la Vía Láctea: posiciones estelares 3D proyectadas desde la posición actual del observador (Gaia DR3 / Hipparcos).',
    stars: projectedStars,
  };
}

/**
 * Ruido 2D rápido para sintetizar la banda panorámica de la Vía Láctea, la Gran Grieta de polvo oscuro
 * (Cygnus, Aquila, Ophiuchus, Saco de Carbón) y las regiones HII (Laguna, Trífida, Carina, Orión).
 */
function skyHash(ix, iy) {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function skyNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = skyHash(ix, iy);
  const b = skyHash(ix + 1, iy);
  const c = skyHash(ix, iy + 1);
  const d = skyHash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function skyFbm(x, y, octaves = 4) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * skyNoise(x * freq + i * 7.3, y * freq - i * 4.1);
    freq *= 2.04;
    amp *= 0.5;
  }
  return v;
}

let cachedPanoramicMilkyWayTex = null;
function getPanoramicMilkyWayBandTexture() {
  if (cachedPanoramicMilkyWayTex) return cachedPanoramicMilkyWayTex;
  if (typeof document === 'undefined') return null;

  const isHarness = Boolean(globalThis.__KRONOX_SCENE_HARNESS__);
  const W = isHarness ? 64 : 2048;
  const H = isHarness ? 32 : 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const img = ctx.createImageData(W, H);
  if (img && img.data) {
    const d = img.data;
    for (let py = 0; py < H; py++) {
      // bNorm en [-1, 1]; el ecuador galáctico está en bNorm = 0
      const bNorm = (py / (H - 1)) * 2 - 1;
      const absB = Math.abs(bNorm);

      for (let px = 0; px < W; px++) {
        const idx = (py * W + px) * 4;
        // Fuera del plano galáctico (|b| > 24°), el espacio profundo permanece completamente negro (alpha = 0)
        if (absB > 0.27) {
          d[idx] = d[idx + 1] = d[idx + 2] = d[idx + 3] = 0;
          continue;
        }

        // Longitud galáctica l en [-pi, pi], con l = 0 en el Centro Galáctico (Sagitario/Escorpio)
        const lRad = ((px / W) * 2 - 1) * Math.PI;
        const cosL = Math.cos(lRad);

        // Domain warping anisotrópico de alta frecuencia (evita manchas gruesas y produce filamentos naturales)
        const warpX = skyFbm(px / (W / 14) + 3.1, py / (H / 7) - 1.9, 4) - 0.5;
        const warpY = skyFbm(px / (W / 14) - 7.4, py / (H / 7) + 4.6, 4) - 0.5;
        const nBroad = skyFbm(px / (W / 12) + warpX * 1.4, py / (H / 6) + warpY * 1.2, 4);
        const nFine = skyFbm(px / (W / 44) + 11.3 + warpX * 2.1, py / (H / 22) - 5.7 + warpY * 1.9, 5);
        const nDetail = skyFbm(px / (W / 110) - 4.2, py / (H / 55) + 9.4, 3);
        const nMicro = skyHash(px * 3 + 17, py * 3 + 29);

        const bWarped = bNorm + warpY * 0.032;
        const absBWarped = Math.abs(bWarped);

        // Perfil realista del bulbo central de Sagitario y disco galáctico tenue sin saturación excesiva
        const bulgeFactor = Math.exp(-Math.pow(lRad / 0.46, 2) - Math.pow(absBWarped / 0.105, 1.75));
        const diskWidth = Math.max(0.026, 0.044 + 0.048 * Math.max(0, cosL) + 0.026 * (nBroad - 0.5));
        const diskProfile =
          Math.exp(-Math.pow(absBWarped / diskWidth, 1.72)) *
          (0.24 + 0.76 * Math.pow((cosL + 1) * 0.5, 0.9));

        const cloudTextureMod = Math.pow(
          Math.max(0, 0.32 + 0.65 * nBroad + 0.35 * (nFine - 0.5) + 0.2 * (nDetail - 0.5)),
          1.25,
        );
        const starCloudLum = Math.min(0.92, (bulgeFactor * 0.82 + diskProfile * 0.66) * cloudTextureMod);

        // Gran Grieta de Polvo Oscuro (Great Rift natural: absorción oscura nítida, sin manchas marrones ni parches)
        const riftCenterB = 0.011 * Math.sin(lRad * 1.8) + warpY * 0.035;
        const riftWidth = Math.max(0.008, 0.015 + 0.022 * nFine);
        const riftMask =
          Math.exp(-Math.pow(Math.abs(bNorm - riftCenterB) / riftWidth, 1.9)) *
          (0.32 + 0.68 * Math.max(0, cosL + 0.3)) *
          Math.pow(0.45 + 0.7 * nFine, 1.45);
        const darkFilaments =
          Math.exp(-Math.pow(absBWarped / 0.088, 1.9)) *
          Math.pow(Math.max(0, nDetail - 0.42) * 1.7, 2.0) *
          0.85;
        const dustExtinction = Math.min(0.94, riftMask * 0.92 + darkFilaments * 0.68);

        // Micro-estrellas finas resueltas dentro de la banda galáctica
        const starGrain =
          nMicro > 0.935 && starCloudLum > 0.08 ? Math.pow((nMicro - 0.935) / 0.065, 1.4) * (1 - dustExtinction * 0.75) : 0;

        const transmittance = Math.max(0.04, 1 - dustExtinction * 0.92);

        // Nubes estelares sutiles marfil-doradas hacia Sagitario y plata-azuladas en brazos externos
        const warmWeight = 0.25 + 0.75 * Math.pow(Math.max(0, cosL), 1.4);
        const starR =
          starCloudLum * (175 + 48 * warmWeight) * transmittance + starGrain * 250;
        const starG =
          starCloudLum * (168 + 26 * warmWeight) * transmittance + starGrain * 242;
        const starB =
          starCloudLum * (192 - 44 * warmWeight) * transmittance + starGrain * 235;

        const alpha = Math.min(
          0.74,
          (starCloudLum * 0.56 + starGrain * 0.65) *
            Math.max(0, 1 - Math.pow(absB / 0.265, 2.2)),
        );

        d[idx] = Math.max(0, Math.min(255, Math.round(starR)));
        d[idx + 1] = Math.max(0, Math.min(255, Math.round(starG)));
        d[idx + 2] = Math.max(0, Math.min(255, Math.round(starB)));
        d[idx + 3] = Math.max(0, Math.min(255, Math.round(alpha * 255)));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  cachedPanoramicMilkyWayTex = new THREE.CanvasTexture(canvas);
  if (THREE.sRGBEncoding) cachedPanoramicMilkyWayTex.encoding = THREE.sRGBEncoding;
  cachedPanoramicMilkyWayTex.needsUpdate = true;
  return cachedPanoramicMilkyWayTex;
}

/**
 * Crea el sistema 3D de firmamento de 3 capas en la escena de Three.js con soporte en vivo
 * para MODO CIENTÍFICO (`scientific`) y MODO CINEMATOGRÁFICO (`cinematic`).
 */
export function createObserverAwareFirmament({
  scene,
  galaxyOrientationQuat,
  glowTexture = null,
} = {}) {
  const root = new THREE.Group();
  root.name = 'kronox-observer-aware-firmament';
  const skyDomeRadius = 92000;

  // =========================================================================
  // CAPA A: Fuentes puntuales catalogadas proyectadas desde `observerPosPc`
  // =========================================================================
  const maxCatalogCount = CATALOG_SKY_STARS.length;
  const catalogPositions = new Float32Array(maxCatalogCount * 3);
  const catalogColors = new Float32Array(maxCatalogCount * 3);
  const catalogGeometry = new THREE.BufferGeometry();
  catalogGeometry.setAttribute('position', new THREE.BufferAttribute(catalogPositions, 3));
  catalogGeometry.setAttribute('color', new THREE.BufferAttribute(catalogColors, 3));

  const catalogMaterial = new THREE.PointsMaterial({
    size: 4.2,
    map: glowTexture || null,
    vertexColors: true,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const catalogPoints = new THREE.Points(catalogGeometry, catalogMaterial);
  catalogPoints.name = 'firmament-layer-a-catalog-stars';
  catalogPoints.frustumCulled = false;
  root.add(catalogPoints);

  // =========================================================================
  // CAPA B: Fondo difuso observacional (Banda panorámica de la Vía Láctea, Gran Grieta de polvo y nebulosas HII)
  // =========================================================================
  const diffuseGalacticLayer = new THREE.Group();
  diffuseGalacticLayer.name = 'firmament-layer-b-galactic-diffuse-and-dust';
  if (galaxyOrientationQuat) {
    diffuseGalacticLayer.quaternion.copy(galaxyOrientationQuat);
  }

  // Esfera panorámica ecuatorial galáctica con la banda de nubes estelares de Sagitario, polvo oscuro y regiones HII
  const panoramicTex = getPanoramicMilkyWayBandTexture();
  let panoramicBandMesh = null;
  if (panoramicTex) {
    const domeGeo = new THREE.SphereGeometry(skyDomeRadius * 0.97, 48, 28);
    const domeMat = new THREE.MeshBasicMaterial({
      map: panoramicTex,
      transparent: true,
      opacity: 0.72,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    panoramicBandMesh = new THREE.Mesh(domeGeo, domeMat);
    panoramicBandMesh.name = 'milky-way-panoramic-band-dome';
    panoramicBandMesh.frustumCulled = false;
    diffuseGalacticLayer.add(panoramicBandMesh);
  }

  // Nodos finos de micro-estrellas densas a lo largo del plano galáctico (sin parches ni círculos gigantes)
  const dustAndBandCount = 3200;
  const bandPos = new Float32Array(dustAndBandCount * 3);
  const bandCol = new Float32Array(dustAndBandCount * 3);
  for (let i = 0; i < dustAndBandCount; i++) {
    const i3 = i * 3;
    const h1 = skyHash(i, 19);
    const h2 = skyHash(i, 47);
    const theta = h1 * Math.PI * 2;
    const latSpread = (h2 - 0.5) * 0.22 * (0.4 + 0.6 * skyHash(i, 83));
    const r = skyDomeRadius * 0.95;
    bandPos[i3] = Math.cos(latSpread) * Math.cos(theta) * r;
    bandPos[i3 + 1] = Math.sin(latSpread) * r;
    bandPos[i3 + 2] = Math.cos(latSpread) * Math.sin(theta) * r;

    const towardCenter = Math.pow(Math.max(0, Math.cos(theta)), 2.2);
    const isWarmCloud = i % 3 === 0;
    const c = isWarmCloud
      ? new THREE.Color('#eed3a6').lerp(new THREE.Color('#fff2d6'), towardCenter)
      : new THREE.Color('#a4c6f5').lerp(new THREE.Color('#f7dec0'), towardCenter * 0.72);
    bandCol[i3] = c.r;
    bandCol[i3 + 1] = c.g;
    bandCol[i3 + 2] = c.b;
  }
  const bandGeo = new THREE.BufferGeometry();
  bandGeo.setAttribute('position', new THREE.BufferAttribute(bandPos, 3));
  bandGeo.setAttribute('color', new THREE.BufferAttribute(bandCol, 3));
  const bandMaterial = new THREE.PointsMaterial({
    size: 1.5,
    map: glowTexture || null,
    vertexColors: true,
    transparent: true,
    opacity: 0.26,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const bandPoints = new THREE.Points(bandGeo, bandMaterial);
  bandPoints.frustumCulled = false;
  diffuseGalacticLayer.add(bandPoints);
  root.add(diffuseGalacticLayer);

  // =========================================================================
  // CAPA C: Campo estelar débil condicionado por la latitud galáctica
  // =========================================================================
  const procCount = 2600;
  const procPositions = new Float32Array(procCount * 3);
  const procColors = new Float32Array(procCount * 3);
  for (let i = 0; i < procCount; i++) {
    const i3 = i * 3;
    const u = ((i * 97 + 13) % 1000) / 1000;
    const v = ((i * 53 + 29) % 1000) / 1000;
    const theta = u * Math.PI * 2;
    // Fuerte concentración hacia el plano galáctico (|b| < 18°) para que mirar al plano sea denso y mirar a los polos sea austero
    const rawLat = (v - 0.5) * 2;
    const bRad = Math.sign(rawLat) * Math.pow(Math.abs(rawLat), 2.35) * (Math.PI * 0.49);
    const dx = Math.cos(bRad) * Math.cos(theta);
    const dy = Math.sin(bRad);
    const dz = Math.cos(bRad) * Math.sin(theta);
    procPositions[i3] = dx * (skyDomeRadius * 0.94);
    procPositions[i3 + 1] = dy * (skyDomeRadius * 0.94);
    procPositions[i3 + 2] = dz * (skyDomeRadius * 0.94);

    const tempChoice = i % 12;
    const colHex =
      tempChoice < 3
        ? '#ff9a62' // Enanas rojas/naranjas M/K
        : tempChoice < 6
          ? '#ffd8a8' // Estrellas amarillas-ámbar K/G
          : tempChoice < 9
            ? '#fff9f2' // Estrellas tipo solar G/F
            : '#9ec4ff'; // Estrellas calientes azul-blancas A/B
    const c = new THREE.Color(colHex);
    const brightness = 0.35 + ((i * 37) % 65) / 100;
    procColors[i3] = c.r * brightness;
    procColors[i3 + 1] = c.g * brightness;
    procColors[i3 + 2] = c.b * brightness;
  }
  const procGeo = new THREE.BufferGeometry();
  procGeo.setAttribute('position', new THREE.BufferAttribute(procPositions, 3));
  procGeo.setAttribute('color', new THREE.BufferAttribute(procColors, 3));
  const procMaterial = new THREE.PointsMaterial({
    size: 2.3,
    map: glowTexture || null,
    vertexColors: true,
    transparent: true,
    opacity: 0.76,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
  });
  const procPoints = new THREE.Points(procGeo, procMaterial);
  procPoints.name = 'firmament-layer-c-conditioned-procedural';
  procPoints.frustumCulled = false;
  if (galaxyOrientationQuat) {
    procPoints.quaternion.copy(galaxyOrientationQuat);
  }
  root.add(procPoints);

  if (scene) scene.add(root);

  let currentObserverPosPc = { x: 0, y: 0, z: 0 };
  let currentHostGalaxyKey = 'milky-way';
  let currentVisualProfile = 'cinematic';
  let lastSnapshot = null;

  function rebuildSkyForObserver(
    observerPosPc = currentObserverPosPc,
    {
      hostGalaxyKey = currentHostGalaxyKey,
      extragalacticMap = false,
      visualProfile = currentVisualProfile,
    } = {},
  ) {
    currentObserverPosPc = {
      x: Number(observerPosPc?.x || 0),
      y: Number(observerPosPc?.y || 0),
      z: Number(observerPosPc?.z || 0),
    };
    currentHostGalaxyKey = hostGalaxyKey;
    currentVisualProfile = visualProfile === 'scientific' ? 'scientific' : 'cinematic';

    const sky = computeSkyFromObserverPc(currentObserverPosPc, {
      hostGalaxyKey: currentHostGalaxyKey,
      extragalacticMap,
      visualProfile: currentVisualProfile,
    });
    lastSnapshot = sky;

    const isScientific = currentVisualProfile === 'scientific';

    if (sky.environmentMode === 'intergalactic-space') {
      catalogPoints.visible = false;
      diffuseGalacticLayer.visible = false;
      procPoints.visible = false;
      return sky;
    }

    if (sky.environmentMode === 'external-galaxy-interior') {
      catalogPoints.visible = false;
      diffuseGalacticLayer.visible = true;
      procPoints.visible = true;
      const meta = GALAXY_MORPHOLOGY_METADATA[sky.hostGalaxyKey] || GALAXY_MORPHOLOGY_METADATA.m31;
      const cCore = new THREE.Color(meta.palette.core);
      const cArms = new THREE.Color(meta.palette.arms);
      const cHii = new THREE.Color(meta.palette.hii);
      for (let i = 0; i < procCount; i++) {
        const i3 = i * 3;
        const c = i % 11 === 0 ? cHii : i % 3 === 0 ? cCore : cArms;
        procColors[i3] = c.r;
        procColors[i3 + 1] = c.g;
        procColors[i3 + 2] = c.b;
      }
      procGeo.attributes.color.needsUpdate = true;
      if (panoramicBandMesh) panoramicBandMesh.material.opacity = isScientific ? 0.25 : 0.65;
      bandMaterial.opacity = isScientific ? 0.18 : 0.42;
      procMaterial.opacity = isScientific ? 0.45 : 0.78;
      return sky;
    }

    catalogPoints.visible = true;
    diffuseGalacticLayer.visible = true;
    procPoints.visible = true;

    const stars = sky.stars;
    catalogPositions.fill(0);
    catalogColors.fill(0);
    for (let i = 0; i < stars.length && i < maxCatalogCount; i++) {
      const s = stars[i];
      const i3 = i * 3;
      catalogPositions[i3] = s.unitDirection.x * (skyDomeRadius * 0.92);
      catalogPositions[i3 + 1] = s.unitDirection.y * (skyDomeRadius * 0.92);
      catalogPositions[i3 + 2] = s.unitDirection.z * (skyDomeRadius * 0.92);

      const fluxFactor = Math.max(
        isScientific ? 0.16 : 0.34,
        Math.min(1.6, Math.pow(10, -0.18 * (s.apparentMagnitude - 1.5))),
      );
      const baseColor = new THREE.Color(s.spaceColorHex);
      catalogColors[i3] = Math.min(1, baseColor.r * fluxFactor);
      catalogColors[i3 + 1] = Math.min(1, baseColor.g * fluxFactor);
      catalogColors[i3 + 2] = Math.min(1, baseColor.b * fluxFactor);
    }
    catalogGeometry.attributes.position.needsUpdate = true;
    catalogGeometry.attributes.color.needsUpdate = true;

    const haloAttenuation =
      1 - THREE.MathUtils.smoothstep(sky.observerDistanceFromSunPc, 2500, 18000);
    if (panoramicBandMesh) {
      panoramicBandMesh.material.opacity = (isScientific ? 0.22 : 0.68) * haloAttenuation;
    }
    bandMaterial.opacity = (isScientific ? 0.11 : 0.26) * haloAttenuation;
    procMaterial.opacity = (isScientific ? 0.42 : 0.8) * haloAttenuation;
    catalogMaterial.size = isScientific ? 3.2 : 4.2;

    return sky;
  }

  rebuildSkyForObserver({ x: 0, y: 0, z: 0 });

  return {
    root,
    rebuildSkyForObserver,
    syncDomeToCamera(cameraPosition) {
      if (cameraPosition) {
        root.position.copy(cameraPosition);
      }
    },
    setVisualProfile(profile) {
      return rebuildSkyForObserver(currentObserverPosPc, {
        hostGalaxyKey: currentHostGalaxyKey,
        visualProfile: profile,
      });
    },
    getVisualProfile: () => currentVisualProfile,
    getSnapshot: () => lastSnapshot,
  };
}

/**
 * Unificación continua entre escalas para el Sol / Sistema Solar y la Vía Láctea (Secciones 2 y 8).
 */
export function updateCrossScaleContinuity({
  navigationContextId,
  contextOverview,
  nearbyMapState,
  cameraPosition,
  solarBodies,
  asteroidBelt,
  stellarAtlas,
  regionalAtlas,
  macroGalacticGroup,
  nearbyGalaxyMarkers,
} = {}) {
  const camDistToOrigin = cameraPosition ? cameraPosition.length() : 1000;

  const inAtlasScale =
    contextOverview &&
    !nearbyMapState &&
    (navigationContextId === 'stellar' || navigationContextId === 'regional');

  const solarRevealBlend =
    nearbyMapState || navigationContextId === 'milkyway'
      ? 0
      : inAtlasScale
        ? 1 - THREE.MathUtils.smoothstep(camDistToOrigin, 180, 2400)
        : !contextOverview
          ? 1 - THREE.MathUtils.smoothstep(camDistToOrigin, 450, 2800)
          : 0;

  const showDetailedSolarSystem = solarRevealBlend > 0.02;

  if (Array.isArray(solarBodies)) {
    for (const b of solarBodies) {
      b.pivot.visible = showDetailedSolarSystem;
      if (b.glow) {
        b.glow.visible = showDetailedSolarSystem;
      }
    }
  }
  if (asteroidBelt) {
    asteroidBelt.visible = showDetailedSolarSystem;
  }

  const activeAtlas =
    navigationContextId === 'stellar'
      ? stellarAtlas
      : navigationContextId === 'regional'
        ? regionalAtlas
        : null;
  const sunAtlasMarker = activeAtlas?.markers?.get?.('sun')?.marker;
  if (sunAtlasMarker) {
    const pointFactor = Math.max(0.08, 1 - solarRevealBlend * 0.92);
    sunAtlasMarker.scale.setScalar(pointFactor);
  }

  let milkyWayInternalBlend = 0;
  if (nearbyMapState && nearbyGalaxyMarkers) {
    const mwMarker = nearbyGalaxyMarkers.get('milky-way');
    const distToMw =
      mwMarker && cameraPosition ? cameraPosition.distanceTo(mwMarker.position) : camDistToOrigin;
    milkyWayInternalBlend = 1 - THREE.MathUtils.smoothstep(distToMw, 12, 42);
    if (macroGalacticGroup && milkyWayInternalBlend > 0.15) {
      macroGalacticGroup.visible = true;
    }
  }

  return {
    solarRevealBlend: Number(solarRevealBlend.toFixed(4)),
    showDetailedSolarSystem,
    milkyWayInternalBlend: Number(milkyWayInternalBlend.toFixed(4)),
    cameraDistanceToOrigin: Number(camDistToOrigin.toFixed(2)),
  };
}
