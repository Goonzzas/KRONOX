import * as THREE from 'three';

/**
 * KRONOX — MOTOR DE ESCALA ASTRONÓMICA, EFEMÉRIDES J2000.0 Y MODOS DE OBSERVACIÓN FÍSICA
 * ======================================================================================
 * Resuelve la coexistencia entre:
 *  - Nave habitable de exploración científica: 120.0 metros de eslora física (0.120 km).
 *  - Cuerpos del Sistema Solar con radios físicos documentados (IAU / NASA JPL).
 *  - Posiciones heliocéntricas keplerianas referidas a la época estándar J2000.0.
 *  - Visibilidad astronómica gobernada por tamaño angular real (θ = 2·arctan(R/D)),
 *    magnitud aparente V(r, Δ, α) y poder de resolución del ojo humano (~60″) frente
 *    a instrumentos ópticos de a bordo (10× a 300×).
 */

export const ASTRONOMICAL_REFERENCE_EPOCH = Object.freeze({
  id: 'J2000.0',
  isoUtc: '2000-01-01T12:00:00Z',
  julianDate: 2451545.0,
  unixMs: Date.UTC(2000, 0, 1, 12, 0, 0),
  source: 'IAU / NASA JPL Keplerian Elements (Standish & Williams, J2000.0 frame)',
});

export const PHYSICAL_CONSTANTS = Object.freeze({
  AU_KM: 149597870.7,
  AU_METERS: 149597870700,
  SHIP_LENGTH_METERS: 120.0,
  SHIP_LENGTH_KM: 0.12,
  CABIN_LENGTH_METERS: 24.0,
  NAKED_EYE_RESOLUTION_ARCSEC: 60.0, // ~1 minuto de arco para el ojo humano
  ARCSEC_PER_RADIAN: 206264.80624709636,
});

/**
 * Los 5 modos explícitos de observación y navegación (Sección 4.4)
 */
export const OBSERVATION_MODES = Object.freeze({
  NAKED_EYE: {
    id: 'naked-eye',
    code: 'A',
    shortLabel: 'Simple vista (1×)',
    title: 'Observación a simple vista',
    description:
      'Perspectiva física directa (1×). Los cuerpos lejanos subtienden su tamaño angular real y aparecen como puntos brillantes cuando θ < 60″.',
    isCompressedScale: false,
    isOpticalInstrument: false,
  },
  OPTICAL_INSTRUMENT: {
    id: 'optical-instrument',
    code: 'B',
    shortLabel: 'Telescopio óptico',
    title: 'Observación mediante instrumento óptico',
    description:
      'Ampliación óptica instrumental del campo de visión (10×–300×) para resolver discos planetarios, anillos y satélites galileanos desde grandes distancias.',
    isCompressedScale: false,
    isOpticalInstrument: true,
  },
  SOLAR_NAVIGATION: {
    id: 'solar-navigation',
    code: 'C',
    shortLabel: 'Mapa del Sistema Solar',
    title: 'Vista de navegación del sistema solar',
    description:
      'Representación cartográfica con escala orbital comprimida para selección de rutas interplanetarias. No representa una perspectiva visual directa.',
    isCompressedScale: true,
    isOpticalInstrument: false,
  },
  ASTRONOMICAL_MAP: {
    id: 'astronomical-map',
    code: 'D',
    shortLabel: 'Atlas Astronómico',
    title: 'Vista de mapa astronómico',
    description:
      'Cartografía tridimensional multiescala de sistemas estelares cercanos, región galáctica, Vía Láctea y universo local.',
    isCompressedScale: true,
    isOpticalInstrument: false,
  },
  CLOSE_INSPECTION: {
    id: 'close-inspection',
    code: 'E',
    shortLabel: 'Inspección orbital',
    title: 'Vista de inspección cercana de un cuerpo',
    description:
      'Aproximación orbital física fuera del límite de Roche y sistemas de anillos. La nave de 120 m y el cuerpo celeste conservan su relación física.',
    isCompressedScale: false,
    isOpticalInstrument: false,
  },
});

/**
 * Parámetros físicos documentados (IAU / NASA JPL Planetary Fact Sheet)
 * Incluye radio volumétrico medio (km), masa (kg), albedo geométrico visual (pV)
 * y magnitud absoluta planetaria H = V(1,0) para cálculo de brillo aparente.
 */
export const PLANETARY_PHYSICAL_CATALOG = Object.freeze({
  Sol: {
    name: 'Sol',
    radiusKm: 696340,
    diameterKm: 1392680,
    massKg: 1.9885e30,
    albedo: 1.0,
    absMagV: -26.74,
    ringOuterRatio: 0,
    colorHex: 0xfff4dc,
  },
  Mercurio: {
    name: 'Mercurio',
    radiusKm: 2439.7,
    diameterKm: 4879.4,
    massKg: 3.3011e23,
    albedo: 0.142,
    absMagV: -0.6,
    ringOuterRatio: 0,
    colorHex: 0xc8beb4,
  },
  Venus: {
    name: 'Venus',
    radiusKm: 6051.8,
    diameterKm: 12103.6,
    massKg: 4.8675e24,
    albedo: 0.689,
    absMagV: -4.4,
    ringOuterRatio: 0,
    colorHex: 0xfff0c8,
  },
  Tierra: {
    name: 'Tierra',
    radiusKm: 6371.0,
    diameterKm: 12742.0,
    massKg: 5.9724e24,
    albedo: 0.367,
    absMagV: -3.86,
    ringOuterRatio: 0,
    colorHex: 0x6cb8ff,
  },
  Luna: {
    name: 'Luna',
    radiusKm: 1737.4,
    diameterKm: 3474.8,
    massKg: 7.342e22,
    albedo: 0.12,
    absMagV: +0.21,
    semiMajorAxisKm: 384400,
    ringOuterRatio: 0,
    colorHex: 0xd8dce2,
  },
  Marte: {
    name: 'Marte',
    radiusKm: 3389.5,
    diameterKm: 6779.0,
    massKg: 6.4171e23,
    albedo: 0.17,
    absMagV: -1.52,
    ringOuterRatio: 0,
    colorHex: 0xf08c55,
  },
  Júpiter: {
    name: 'Júpiter',
    radiusKm: 69911.0,
    diameterKm: 139822.0,
    massKg: 1.8982e27,
    albedo: 0.538,
    absMagV: -9.4,
    ringOuterRatio: 0,
    colorHex: 0xffe4b8,
    galileanMoons: [
      { name: 'Ío', radiusKm: 1821.6, semiMajorAxisKm: 421700, periodDays: 1.769 },
      { name: 'Europa', radiusKm: 1560.8, semiMajorAxisKm: 671034, periodDays: 3.551 },
      { name: 'Ganímedes', radiusKm: 2634.1, semiMajorAxisKm: 1070412, periodDays: 7.155 },
      { name: 'Calisto', radiusKm: 2410.3, semiMajorAxisKm: 1882709, periodDays: 16.689 },
    ],
  },
  Saturno: {
    name: 'Saturno',
    radiusKm: 58232.0,
    diameterKm: 116464.0,
    massKg: 5.6834e26,
    albedo: 0.499,
    absMagV: -8.88,
    ringInnerRatio: 1.25,
    ringOuterRatio: 2.4, // Anillos principales A/B/C hasta ~139,750 km
    colorHex: 0xf7dfaa,
  },
  Urano: {
    name: 'Urano',
    radiusKm: 25362.0,
    diameterKm: 50724.0,
    massKg: 8.681e25,
    albedo: 0.488,
    absMagV: -7.19,
    ringOuterRatio: 1.65,
    colorHex: 0xa6f0ff,
  },
  Neptuno: {
    name: 'Neptuno',
    radiusKm: 24622.0,
    diameterKm: 49244.0,
    massKg: 1.02413e26,
    albedo: 0.442,
    absMagV: -6.87,
    ringOuterRatio: 0,
    colorHex: 0x6b9cff,
  },
  Plutón: {
    name: 'Plutón',
    radiusKm: 1188.3,
    diameterKm: 2376.6,
    massKg: 1.303e22,
    albedo: 0.58,
    absMagV: -1.0,
    ringOuterRatio: 0,
    colorHex: 0xd5c4b2,
  },
  Ceres: {
    name: 'Ceres',
    radiusKm: 469.7,
    diameterKm: 939.4,
    massKg: 9.3835e20,
    albedo: 0.09,
    absMagV: +3.34,
    ringOuterRatio: 0,
    colorHex: 0xb5b2ac,
  },
});

export const OPTICAL_MAGNIFICATION_STEPS = Object.freeze([1, 10, 50, 150, 300]);

/**
 * Calcula el diámetro angular físico exacto (en radianes y segundos de arco)
 * y la magnitud aparente visual V de un cuerpo del Sistema Solar visto desde el observador.
 */
export function computeBodyObservationalMetrics({
  bodyName,
  radiusKm,
  bodyHeliocentricAu,
  observerHeliocentricAu,
  opticalMagnification = 1,
}) {
  const catalogEntry = PLANETARY_PHYSICAL_CATALOG[bodyName] || null;
  const rKm = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : catalogEntry?.radiusKm || 1000;

  const dxAu = (bodyHeliocentricAu?.x || 0) - (observerHeliocentricAu?.x || 0);
  const dyAu = (bodyHeliocentricAu?.y || 0) - (observerHeliocentricAu?.y || 0);
  const dzAu = (bodyHeliocentricAu?.z || 0) - (observerHeliocentricAu?.z || 0);
  const distanceAu = Math.max(1e-9, Math.hypot(dxAu, dyAu, dzAu));
  const distanceKm = distanceAu * PHYSICAL_CONSTANTS.AU_KM;

  const helioDistanceAu = Math.max(
    1e-6,
    Math.hypot(
      bodyHeliocentricAu?.x || 0,
      bodyHeliocentricAu?.y || 0,
      bodyHeliocentricAu?.z || 0,
    ),
  );

  // Diámetro angular físico exacto: θ = 2 * arctan(R / D)
  const angularDiameterRad = 2 * Math.atan(rKm / Math.max(rKm * 1.0001, distanceKm));
  const angularDiameterArcsec = angularDiameterRad * PHYSICAL_CONSTANTS.ARCSEC_PER_RADIAN;
  const magnifiedAngularArcsec = angularDiameterArcsec * Math.max(1, opticalMagnification);

  // Fase de iluminación solar cos(α)
  let illuminatedFraction = 1.0;
  let apparentMagnitudeV = catalogEntry?.absMagV ?? 0;
  if (bodyName !== 'Sol') {
    const rObsSunAu = Math.max(
      1e-6,
      Math.hypot(
        observerHeliocentricAu?.x || 0,
        observerHeliocentricAu?.y || 0,
        observerHeliocentricAu?.z || 0,
      ),
    );
    // Ley de cosenos en el triángulo Sol-Cuerpo-Observador
    const cosPhase = Math.max(
      -1,
      Math.min(
        1,
        (helioDistanceAu * helioDistanceAu + distanceAu * distanceAu - rObsSunAu * rObsSunAu) /
          (2 * helioDistanceAu * distanceAu),
      ),
    );
    illuminatedFraction = 0.5 * (1 + cosPhase);
    const phaseAngleDeg = (Math.acos(cosPhase) * 180) / Math.PI;
    const H = catalogEntry?.absMagV ?? -1.5;
    apparentMagnitudeV =
      H + 5 * Math.log10(Math.max(1e-5, helioDistanceAu * distanceAu)) + 0.014 * phaseAngleDeg;
  }

  const resolvedNakedEye =
    angularDiameterArcsec >= PHYSICAL_CONSTANTS.NAKED_EYE_RESOLUTION_ARCSEC;
  const resolvedWithInstrument =
    magnifiedAngularArcsec >= PHYSICAL_CONSTANTS.NAKED_EYE_RESOLUTION_ARCSEC;

  return {
    bodyName,
    radiusKm: rKm,
    diameterKm: rKm * 2,
    distanceAu,
    distanceKm,
    helioDistanceAu,
    angularDiameterRad,
    angularDiameterArcsec,
    magnifiedAngularArcsec,
    opticalMagnification: Math.max(1, opticalMagnification),
    illuminatedFraction,
    apparentMagnitudeV: Number(apparentMagnitudeV.toFixed(2)),
    resolvedNakedEye,
    resolvedWithInstrument,
    shipToPlanetRatio: Number((rKm * 2 / PHYSICAL_CONSTANTS.SHIP_LENGTH_KM).toFixed(1)),
  };
}

/**
 * Calcula la distancia de estacionamiento orbital segura en unidades de escena
 * para que ningún planeta ni sistema de anillos (como Saturno) penetre jamás
 * la cabina habitable ni colisione con el casco de 120 m.
 */
export function computeSafeOrbitalClearance(body, { isCabinActive = true, realScale = false } = {}) {
  if (!body || !body.p) return 16;
  const r = Math.max(0.02, body.r || 0.35);
  const hasRings = Boolean(body.p.ring);
  const isSun = Boolean(body.p.sun);
  const ringMultiplier = hasRings ? 2.85 : isSun ? 2.1 : 1.75;
  // En cabina 1P, el mirador frontal se ubica a z = -12.2 unidades locales desde el origen `sp`.
  // Añadimos un margen físico estricto delante de la proa para que incluso los anillos de Saturno
  // (2.4 * r) queden completamente en el exterior de los cristales del puente.
  const cabinBowMargin = isCabinActive ? 14.8 : realScale ? 0.02 : 0.45;
  return cabinBowMargin + r * ringMultiplier;
}

/**
 * Aplica límite de exclusión esférica para impedir que la nave o la cabina
 * atraviesen la superficie de un planeta o el plano de anillos de Saturno/Urano.
 */
export function enforcePlanetaryCollisionBoundary(shipPosition, solarBodies, { isCabinActive = true } = {}) {
  let collidedBody = null;
  const bowOffset = isCabinActive ? 13.6 : 0.35;
  for (let i = 0; i < solarBodies.length; i++) {
    const b = solarBodies[i];
    if (!b?.pivot || !b.p) continue;
    const center = b.pivot.position;
    const effectiveRadius = Math.max(0.05, b.r || 0.35) * (b.p.ring ? 2.55 : b.p.sun ? 1.55 : 1.35);
    const minAllowedDist = bowOffset + effectiveRadius;
    const delta = shipPosition.clone().sub(center);
    const dist = delta.length();
    if (dist > 1e-6 && dist < minAllowedDist) {
      delta.normalize().multiplyScalar(minAllowedDist);
      shipPosition.copy(center).add(delta);
      collidedBody = b.p.n;
    }
  }
  return collidedBody;
}

/**
 * Construye una baliza estelar puntual de alta fidelidad para representar planetas
 * cuando su tamaño angular es menor que la resolución a simple vista (θ < 60″),
 * evitando que Júpiter o Saturno parezcan enormes esferas artificiales desde la Tierra.
 */
export function createPlanetaryPointBeaconTexture(doc = globalThis.document) {
  if (!doc?.createElement) return new THREE.Texture();
  const canvas = doc.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx?.createRadialGradient) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.14, 'rgba(255, 250, 238, 0.92)');
    grad.addColorStop(0.38, 'rgba(215, 232, 255, 0.28)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

