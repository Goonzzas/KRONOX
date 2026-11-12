import * as THREE from 'three';

/**
 * KRONOX — MOTOR DE ESCALA ASTRONÓMICA, EFEMÉRIDES J2000.0, PRECISIÓN DOBLE (FLOAT64)
 * Y SEPARACIÓN DE MUNDOS (FASE 1 DE RECONSTRUCCIÓN)
 * ======================================================================================
 * Resuelve en la raíz arquitectónica la coexistencia entre dos mundos con sistemas de
 * coordenadas independientes:
 *  A. MUNDO LOCAL DE LA NAVE (`localShipScene`):
 *     - Escala métrica invariante: `1 unidad local = 1.00 metro`.
 *     - Nave exterior: `120.0 metros` de longitud física exacta (`0.120 km`).
 *     - Cabina habitable interior: `24.0 metros` de longitud, `13.6 metros` de manga.
 *     - Astronauta: `1.75 metros` de estatura, `1.65 metros` de altura ocular.
 *  B. MUNDO ASTRONÓMICO FÍSICO (`astronomicalScene` / `sc`):
 *     - Escala física real en modos de observación (Modos 1, 2 y 5):
 *       `1 unidad astronómica de escena = 1.000.000 km = 10^9 m` (`1 UA = 149.5978707 unidades`).
 *     - Cálculos heliocéntricos y relativos al observador en precisión doble IEEE 754 (`Float64`).
 *     - Visibilidad astronómica gobernada por tamaño angular real (θ = 2·arctan(R/D)),
 *       magnitud aparente V(r, Δ, α) y poder de resolución del ojo humano (~60″) frente
 *       al telescopio óptico de a bordo (10× a 500× mediante reducción óptica de FOV sin
 *       inflar la malla 3D del planeta).
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
  AU_METERS: 149597870700.0,
  ASTRO_SCENE_UNIT_KM: 1e6, // 1 unidad astronómica de escena = 1,000,000 km
  ASTRO_SCENE_UNIT_METERS: 1e9, // 1 unidad astronómica de escena = 1,000,000,000 m
  AU_ASTRO_SCENE_UNITS: 149.5978707, // 1 UA en unidades físicas de escena
  METERS_TO_ASTRO_SCENE_UNITS: 1e-9,
  KM_TO_ASTRO_SCENE_UNITS: 1e-6,
  SHIP_LENGTH_METERS: 120.0,
  SHIP_LENGTH_KM: 0.12,
  CABIN_LENGTH_METERS: 24.0,
  CABIN_WIDTH_METERS: 13.6,
  CABIN_HEIGHT_METERS: 4.2,
  ASTRONAUT_HEIGHT_METERS: 1.75,
  ASTRONAUT_EYE_HEIGHT_METERS: 1.65,
  NAKED_EYE_RESOLUTION_ARCSEC: 60.0, // ~1 minuto de arco para el ojo humano
  ARCSEC_PER_RADIAN: 206264.80624709636,
});

/**
 * Definición formal de los dos mundos de coordenadas separados (Sección 1)
 */
export const WORLD_COORDINATE_SYSTEMS = Object.freeze({
  LOCAL_METRIC_WORLD: Object.freeze({
    id: 'local-metric-ship-world',
    name: 'Mundo Local de KRONOX (Nave y Cabina)',
    unitLabel: '1 unidad local = 1 metro',
    metersPerUnit: 1.0,
    kmPerUnit: 0.001,
    shipLengthUnits: PHYSICAL_CONSTANTS.SHIP_LENGTH_METERS,
    cabinLengthUnits: PHYSICAL_CONSTANTS.CABIN_LENGTH_METERS,
    astronautHeightUnits: PHYSICAL_CONSTANTS.ASTRONAUT_HEIGHT_METERS,
    astronautEyeHeightUnits: PHYSICAL_CONSTANTS.ASTRONAUT_EYE_HEIGHT_METERS,
    invariantToPlanetaryDistance: true,
  }),
  ASTRONOMICAL_PHYSICAL_WORLD: Object.freeze({
    id: 'astronomical-physical-world',
    name: 'Mundo Astronómico Físico (Sistema Solar y Cosmos)',
    unitLabel: '1 unidad astronómica de escena = 1.000.000 km (10^9 m)',
    metersPerUnit: PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_METERS,
    kmPerUnit: PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_KM,
    auInSceneUnits: PHYSICAL_CONSTANTS.AU_ASTRO_SCENE_UNITS,
    cpuPrecision: 'Float64 (IEEE 754 double precision)',
    gpuSubmission: 'Camera-relative Floating Origin (Float32 relative to observer)',
  }),
  CARTOGRAPHIC_SCHEMATIC_WORLD: Object.freeze({
    id: 'cartographic-schematic-world',
    name: 'Vista Cartográfica Esquemática de Navegación',
    isCompressed: true,
    mandatoryBanner: 'VISTA ESQUEMÁTICA · ESCALA COMPRIMIDA',
  }),
});

/**
 * Los 5 modos explícitos de observación y navegación (Sección 4)
 */
export const OBSERVATION_MODES = Object.freeze({
  NAKED_EYE: {
    id: 'naked-eye',
    modeNumber: 1,
    code: 'A',
    shortLabel: 'Simple vista (1×)',
    title: 'Modo 1 — Vista a simple vista (1×)',
    description:
      'Perspectiva física directa (1×) desde cabina o exterior de la nave. Los cuerpos lejanos subtienden su tamaño angular real θ = 2·arctan(R/D) y aparecen como puntos luminosos cuando θ < 60″.',
    isCompressedScale: false,
    isOpticalInstrument: false,
    schematicBanner: null,
  },
  OPTICAL_INSTRUMENT: {
    id: 'optical-instrument',
    modeNumber: 2,
    code: 'B',
    shortLabel: 'Telescopio óptico',
    title: 'Modo 2 — Vista telescópica (10× a 500×)',
    description:
      'Telescopio óptico de a bordo con aumento seleccionable (10× a 500×). Reduce ópticamente el campo visual (FOV) sin inflar la malla 3D del planeta, resolviendo discos planetarios, anillos y satélites principales.',
    isCompressedScale: false,
    isOpticalInstrument: true,
    schematicBanner: null,
  },
  SOLAR_NAVIGATION: {
    id: 'solar-navigation',
    modeNumber: 3,
    code: 'C',
    shortLabel: 'Mapa del Sistema Solar',
    title: 'Modo 3 — Mapa de navegación',
    description:
      'Vista cartográfica del sistema solar para selección de destinos y trayectorias. Utiliza escala comprimida claramente identificada y separada de los modos de observación física.',
    isCompressedScale: true,
    isOpticalInstrument: false,
    schematicBanner: 'VISTA ESQUEMÁTICA · ESCALA COMPRIMIDA',
  },
  ASTRONOMICAL_MAP: {
    id: 'astronomical-map',
    modeNumber: 4,
    code: 'D',
    shortLabel: 'Atlas Astronómico',
    title: 'Modo 4 — Mapa astronómico multiescala',
    description:
      'Vistas cartográficas del sistema solar completo, vecindario estelar, Vía Láctea, Grupo Local y universo observable.',
    isCompressedScale: true,
    isOpticalInstrument: false,
    schematicBanner: 'VISTA ESQUEMÁTICA · ESCALA COMPRIMIDA',
  },
  CLOSE_INSPECTION: {
    id: 'close-inspection',
    modeNumber: 5,
    code: 'E',
    shortLabel: 'Inspección orbital',
    title: 'Modo 5 — Inspección cercana',
    description:
      'Órbita de inspección física segura fuera de atmósferas y sistemas de anillos. Conserva el radio físico real del planeta y los 120 m de la nave.',
    isCompressedScale: false,
    isOpticalInstrument: false,
    schematicBanner: null,
    travelCompressionBanner: 'TRÁNSITO CON COMPRESIÓN TEMPORAL',
  },
});

/**
 * Parámetros físicos documentados (IAU / NASA JPL Planetary Fact Sheet)
 * Incluye radio volumétrico medio (km), masa (kg), albedo geométrico visual (pV),
 * magnitud absoluta planetaria H = V(1,0), oblicuidad axial (grados) y satélites.
 */
export const PLANETARY_PHYSICAL_CATALOG = Object.freeze({
  Sol: {
    name: 'Sol',
    radiusKm: 696340,
    diameterKm: 1392680,
    massKg: 1.9885e30,
    albedo: 1.0,
    absMagV: -26.74,
    axialTiltDeg: 7.25,
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
    axialTiltDeg: 0.034,
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
    axialTiltDeg: 177.36,
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
    axialTiltDeg: 23.439,
    ringOuterRatio: 0,
    colorHex: 0x6cb8ff,
    principalMoons: [
      { name: 'Luna', radiusKm: 1737.4, semiMajorAxisKm: 384400, periodDays: 27.321661 },
    ],
  },
  Luna: {
    name: 'Luna',
    radiusKm: 1737.4,
    diameterKm: 3474.8,
    massKg: 7.342e22,
    albedo: 0.12,
    absMagV: +0.21,
    axialTiltDeg: 6.68,
    semiMajorAxisKm: 384400,
    orbitalInclinationDeg: 5.145,
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
    axialTiltDeg: 25.19,
    ringOuterRatio: 0,
    colorHex: 0xf08c55,
    principalMoons: [
      { name: 'Fobos', radiusKm: 11.267, semiMajorAxisKm: 9376, periodDays: 0.3189 },
      { name: 'Deimos', radiusKm: 6.2, semiMajorAxisKm: 23463.2, periodDays: 1.263 },
    ],
  },
  Júpiter: {
    name: 'Júpiter',
    radiusKm: 69911.0,
    diameterKm: 139822.0,
    massKg: 1.8982e27,
    albedo: 0.538,
    absMagV: -9.4,
    axialTiltDeg: 3.13,
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
    axialTiltDeg: 26.73,
    ringInnerRatio: 1.25, // ~72,790 km (borde interior anillo C)
    ringOuterRatio: 2.4, // ~139,756.8 km (borde exterior anillo A/F)
    ringInnerKm: 72790.0,
    ringOuterKm: 139756.8,
    colorHex: 0xf7dfaa,
    principalMoons: [
      { name: 'Titán', radiusKm: 2574.73, semiMajorAxisKm: 1221870, periodDays: 15.945 },
      { name: 'Encélado', radiusKm: 252.1, semiMajorAxisKm: 237948, periodDays: 1.3702 },
    ],
  },
  Urano: {
    name: 'Urano',
    radiusKm: 25362.0,
    diameterKm: 50724.0,
    massKg: 8.681e25,
    albedo: 0.488,
    absMagV: -7.19,
    axialTiltDeg: 97.77,
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
    axialTiltDeg: 28.32,
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
    axialTiltDeg: 122.53,
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
    axialTiltDeg: 4.0,
    ringOuterRatio: 0,
    colorHex: 0xb5b2ac,
  },
  Eris: {
    name: 'Eris',
    radiusKm: 1163.0,
    diameterKm: 2326.0,
    massKg: 1.6466e22,
    albedo: 0.96,
    absMagV: -1.17,
    axialTiltDeg: 78.0,
    ringOuterRatio: 0,
    colorHex: 0xe6e7ea,
  },
  Haumea: {
    name: 'Haumea',
    radiusKm: 816.0,
    diameterKm: 1632.0,
    massKg: 4.006e21,
    albedo: 0.51,
    absMagV: +0.2,
    axialTiltDeg: 126.0,
    ringOuterRatio: 0,
    colorHex: 0xd6d2cc,
  },
  Makemake: {
    name: 'Makemake',
    radiusKm: 715.0,
    diameterKm: 1430.0,
    massKg: 3.1e21,
    albedo: 0.81,
    absMagV: -0.2,
    axialTiltDeg: 29.0,
    ringOuterRatio: 0,
    colorHex: 0xd9bfa3,
  },
});

/**
 * Documentación de parámetros ausentes en `src/data/planetData.js` (Sección 3)
 * `src/data/planetData.js` permanece intacto por integridad del baseline científico.
 * Aquí se documentan explícitamente los parámetros que no están presentes en `planetData.js`
 * y qué valores oficiales IAU / NASA JPL los complementan en `PLANETARY_PHYSICAL_CATALOG`.
 */
export const CATALOG_DOCUMENTATION_NOTES = Object.freeze({
  protectedSourceFile: 'src/data/planetData.js',
  presentInPlanetData: [
    'km (radio físico en km)',
    'au (semieje mayor en UA)',
    'e (excentricidad orbital)',
    'inc (inclinación orbital en grados)',
    'Om (longitud del nodo ascendente Ω)',
    'w (argumento del perihelio ω)',
    'M0 (anomalía media en época J2000.0)',
    'per (periodo orbital en días)',
    'rot (periodo de rotación sideral en horas)',
    'tl (oblicuidad axial en grados)',
  ],
  missingFromPlanetDataAndDocumentedHere: [
    'Luna: inclinación orbital (5.145°) y excentricidad (0.0549) respecto a la eclíptica.',
    'Satélites galileanos (Ío, Europa, Ganímedes, Calisto): radios físicos en km (1821.6, 1560.8, 2634.1, 2410.3 km) y semiejes mayores en km (421700 a 1882709 km), que en createScene.js estaban expresados como múltiplos visuales (2.05 a 4.75 R_Jup).',
    'Satélites principales de Saturno (Titán, Encélado) y Marte (Fobos, Deimos): documentados en PLANETARY_PHYSICAL_CATALOG sin inventar efemérides 3D no verificadas.',
    'Albedo geométrico visual (pV) y magnitud absoluta planetaria H = V(1,0) para el cálculo fotométrico de magnitud aparente.',
  ],
});

/**
 * Pasos de aumento del telescopio óptico de a bordo (10× a 500×, más 1× simple vista)
 */
export const OPTICAL_MAGNIFICATION_STEPS = Object.freeze([1, 10, 50, 150, 300, 500]);

/**
 * Radio físico real en el mundo astronómico (`1 u = 1.000.000 km`).
 * Prohibido usar `0.35 * (p.km / 6371)` en los modos de observación física (Modos 1, 2 y 5).
 */
export function physicalPlanetSceneRadius(p) {
  const km = Number(p?.km) || PLANETARY_PHYSICAL_CATALOG[p?.n]?.radiusKm || 1000;
  return km / PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_KM;
}

/**
 * Distancia heliocéntrica física real en el mundo astronómico (`1 UA = 149.5978707 u`).
 * Prohibido usar `14 + 20 * Math.pow(au, 0.68)` en los modos de observación física.
 */
export function physicalOrbitSceneDistance(au) {
  return Number(au || 0) * PHYSICAL_CONSTANTS.AU_ASTRO_SCENE_UNITS;
}

/**
 * Radio y distancia esquemáticos reservados EXCLUSIVAMENTE para el Modo 3 (`SOLAR_NAVIGATION`),
 * donde la vista se identifica permanentemente como `VISTA ESQUEMÁTICA · ESCALA COMPRIMIDA`.
 */
export function schematicPlanetSceneRadius(p) {
  if (!p) return 0.35;
  if (p.sun) return 4.0;
  if (p.dwarf) return Math.max(0.075, 0.35 * (p.km / 6371));
  return 0.35 * (p.km / 6371);
}

export function schematicOrbitSceneDistance(au) {
  return 14 + 20 * Math.pow(Number(au || 0), 0.68);
}

/**
 * Calcula el campo de visión (FOV vertical en grados) del telescopio de a bordo
 * aplicando la ley óptica exacta: FOV(M) = 2 · arctan(tan(FOV_0 / 2) / M).
 * Esto proyecta el disco planetario aumentado en pantalla SIN alterar la malla 3D del planeta.
 */
export function computeTelescopeFieldOfView(baseFovDeg = 42, magnification = 1) {
  const safeBaseDeg = Math.max(1, Math.min(120, Number(baseFovDeg) || 42));
  const mag = Math.max(1, Number(magnification) || 1);
  if (mag <= 1) return safeBaseDeg;
  const baseRad = (safeBaseDeg * Math.PI) / 180;
  const zoomedRad = 2 * Math.atan(Math.tan(baseRad * 0.5) / mag);
  const zoomedDeg = (zoomedRad * 180) / Math.PI;
  return Math.max(0.02, zoomedDeg);
}

/**
 * Cálculo astronómico en precisión doble IEEE 754 (`Float64Array`) en CPU (Sección 2).
 * Calcula el vector relativo desde el observador hasta el cuerpo celeste en 64 bits
 * antes de convertirlo en desplazamiento relativo de cámara (`Float32Array`) para WebGL.
 */
export function computeDoublePrecisionRelativeVector(targetHeliocentricAu, observerHeliocentricAu) {
  const target64 = new Float64Array([
    Number(targetHeliocentricAu?.x || 0),
    Number(targetHeliocentricAu?.y || 0),
    Number(targetHeliocentricAu?.z || 0),
  ]);
  const observer64 = new Float64Array([
    Number(observerHeliocentricAu?.x || 0),
    Number(observerHeliocentricAu?.y || 0),
    Number(observerHeliocentricAu?.z || 0),
  ]);
  const deltaAu64 = new Float64Array([
    target64[0] - observer64[0],
    target64[1] - observer64[1],
    target64[2] - observer64[2],
  ]);
  const deltaKm64 = new Float64Array([
    deltaAu64[0] * PHYSICAL_CONSTANTS.AU_KM,
    deltaAu64[1] * PHYSICAL_CONSTANTS.AU_KM,
    deltaAu64[2] * PHYSICAL_CONSTANTS.AU_KM,
  ]);
  const deltaMeters64 = new Float64Array([
    deltaAu64[0] * PHYSICAL_CONSTANTS.AU_METERS,
    deltaAu64[1] * PHYSICAL_CONSTANTS.AU_METERS,
    deltaAu64[2] * PHYSICAL_CONSTANTS.AU_METERS,
  ]);
  const deltaScene64 = new Float64Array([
    deltaKm64[0] / PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_KM,
    deltaKm64[1] / PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_KM,
    deltaKm64[2] / PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_KM,
  ]);
  const cameraRelativeFloat32 = new Float32Array([
    deltaScene64[0],
    deltaScene64[1],
    deltaScene64[2],
  ]);
  const distanceAu = Math.hypot(deltaAu64[0], deltaAu64[1], deltaAu64[2]);
  const distanceKm = distanceAu * PHYSICAL_CONSTANTS.AU_KM;
  const distanceMeters = distanceAu * PHYSICAL_CONSTANTS.AU_METERS;
  const distanceSceneUnits = distanceKm / PHYSICAL_CONSTANTS.ASTRO_SCENE_UNIT_KM;

  return {
    targetAu64: target64,
    observerAu64: observer64,
    deltaAu64,
    deltaKm64,
    deltaMeters64,
    deltaScene64,
    cameraRelativeFloat32,
    distanceAu,
    distanceKm,
    distanceMeters,
    distanceSceneUnits,
  };
}

/**
 * Prueba cuantitativa de precisión numérica (Sección 2):
 * Compara la pérdida por cuantización de `Float32` directo en coordenadas heliocéntricas
 * frente a la arquitectura de doble precisión (`Float64`) con origen flotante (`Floating Origin`)
 * y mundo métrico local (`1 u = 1 m`) para un vértice a `localVertexOffsetMeters` (ej. proa de 60 m).
 */
export function verifyFloatingOriginPrecision({
  heliocentricAu = 1.0,
  localVertexOffsetMeters = 60.0,
} = {}) {
  const helioMeters64 = Number(heliocentricAu) * PHYSICAL_CONSTANTS.AU_METERS;
  const vertexOffset64 = Number(localVertexOffsetMeters);

  // 1. Enfoque ingenuo en Float32 con coordenadas heliocéntricas absolutas en metros:
  const f32 = new Float32Array(3);
  f32[0] = helioMeters64; // posición del origen de la nave en Float32
  f32[1] = helioMeters64 + vertexOffset64; // posición del vértice en Float32
  f32[2] = f32[1] - f32[0]; // diferencia reconstruida en GPU sin floating origin
  const naiveFloat32ErrorMeters = Math.abs(f32[2] - vertexOffset64);

  // 2. Enfoque KRONOX Fase 1 (Float64 en CPU + restado de origen de cámara antes de Float32):
  const shipOrigin64 = helioMeters64;
  const vertexWorld64 = helioMeters64 + vertexOffset64;
  const rebased64 = vertexWorld64 - shipOrigin64;
  const rebasedF32 = new Float32Array([rebased64])[0];
  const floatingOriginErrorMeters = Math.abs(rebasedF32 - vertexOffset64);

  return {
    heliocentricAu,
    heliocentricMeters: helioMeters64,
    localVertexOffsetMeters: vertexOffset64,
    naiveFloat32ReconstructedMeters: f32[2],
    naiveFloat32ErrorMeters,
    rebasedFloat32Meters: rebasedF32,
    floatingOriginErrorMeters,
  };
}

/**
 * Calcula el diámetro angular físico exacto (en radianes, segundos de arco y grados)
 * y la magnitud aparente visual V de un cuerpo del Sistema Solar visto desde el observador,
 * empleando aritmética de doble precisión (`Float64`).
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

  const rel64 = computeDoublePrecisionRelativeVector(bodyHeliocentricAu, observerHeliocentricAu);
  const distanceAu = Math.max(1e-12, rel64.distanceAu);
  const distanceKm = Math.max(1e-4, rel64.distanceKm);

  const helioDistanceAu = Math.max(
    1e-6,
    Math.hypot(
      Number(bodyHeliocentricAu?.x || 0),
      Number(bodyHeliocentricAu?.y || 0),
      Number(bodyHeliocentricAu?.z || 0),
    ),
  );

  // Diámetro angular físico exacto: θ = 2 * arctan(R / D)
  const angularDiameterRad = 2 * Math.atan(rKm / Math.max(rKm * 1.000001, distanceKm));
  const angularDiameterArcsec = angularDiameterRad * PHYSICAL_CONSTANTS.ARCSEC_PER_RADIAN;
  const angularDiameterDeg = (angularDiameterRad * 180) / Math.PI;
  const mag = Math.max(1, Number(opticalMagnification) || 1);
  const magnifiedAngularArcsec = angularDiameterArcsec * mag;
  const magnifiedAngularDeg = angularDiameterDeg * mag;

  // Fase de iluminación solar cos(α)
  let illuminatedFraction = 1.0;
  let apparentMagnitudeV = catalogEntry?.absMagV ?? 0;
  if (bodyName !== 'Sol') {
    const rObsSunAu = Math.max(
      1e-6,
      Math.hypot(
        Number(observerHeliocentricAu?.x || 0),
        Number(observerHeliocentricAu?.y || 0),
        Number(observerHeliocentricAu?.z || 0),
      ),
    );
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

  const moonSource = catalogEntry?.galileanMoons || catalogEntry?.principalMoons || [];
  const resolvableMoons = moonSource
    .map((m) => {
      const sepArcsec =
        Math.atan(m.semiMajorAxisKm / Math.max(1, distanceKm)) *
        PHYSICAL_CONSTANTS.ARCSEC_PER_RADIAN;
      const diskArcsec =
        2 *
        Math.atan(m.radiusKm / Math.max(1, distanceKm)) *
        PHYSICAL_CONSTANTS.ARCSEC_PER_RADIAN;
      return {
        name: m.name,
        radiusKm: m.radiusKm,
        semiMajorAxisKm: m.semiMajorAxisKm,
        maxAngularSeparationArcsec: Number(sepArcsec.toFixed(2)),
        magnifiedSeparationArcsec: Number((sepArcsec * mag).toFixed(1)),
        angularDiameterArcsec: Number(diskArcsec.toFixed(3)),
        resolvableInInstrument: sepArcsec * mag >= PHYSICAL_CONSTANTS.NAKED_EYE_RESOLUTION_ARCSEC,
      };
    })
    .filter((m) => m.resolvableInInstrument);

  return {
    bodyName,
    radiusKm: rKm,
    diameterKm: rKm * 2,
    distanceAu,
    distanceKm,
    distanceMeters: rel64.distanceMeters,
    helioDistanceAu,
    angularDiameterRad,
    angularDiameterArcsec,
    angularDiameterDeg,
    magnifiedAngularArcsec,
    magnifiedAngularDeg,
    opticalMagnification: mag,
    illuminatedFraction,
    apparentMagnitudeV: Number(apparentMagnitudeV.toFixed(2)),
    axialTiltDeg: catalogEntry?.axialTiltDeg ?? 0,
    resolvedNakedEye,
    resolvedWithInstrument,
    resolvableMoons,
    planetRadiusToShipLengthRatio: Number((rKm / PHYSICAL_CONSTANTS.SHIP_LENGTH_KM).toFixed(1)),
    planetRadiusToCabinLengthRatio: Number(
      ((rKm * 1000) / PHYSICAL_CONSTANTS.CABIN_LENGTH_METERS).toFixed(1),
    ),
    shipToPlanetRatio: Number(((rKm * 2) / PHYSICAL_CONSTANTS.SHIP_LENGTH_KM).toFixed(1)),
  };
}

/**
 * Calcula la distancia de estacionamiento orbital segura en unidades de escena
 * para que ningún planeta ni sistema de anillos (como Saturno) penetre jamás
 * la cabina habitable ni colisione con el casco de 120 m.
 *
 * - En el mundo astronómico físico (`physicalScale = true`, donde `1 u = 10^6 km` y `r = p.km / 1e6`),
 *   el radio exterior de los anillos de Saturno es `2.40 * r` (`0.1397568 u = 139,756.8 km`),
 *   y la distancia segura se fija en `2.85 * r` (`~165,961 km` del centro de Saturno) o `2.35 * r`
 *   para planetas sin anillos.
 * - Si se pasa un cuerpo con radio esquemático grande (`r >= 0.1` y `!physicalScale`), conserva
 *   el margen esquemático compatible con el mapa comprimido.
 */
export function computeSafeOrbitalClearance(
  body,
  { isCabinActive = true, realScale = false, physicalScale = null } = {},
) {
  if (!body || !body.p) return 16;
  const r = Math.max(1e-5, body.r || 0.35);
  const hasRings = Boolean(body.p.ring);
  const isSun = Boolean(body.p.sun);
  const ringMultiplier = hasRings ? 2.85 : isSun ? 2.15 : 2.35;

  const isPhysical =
    physicalScale !== null ? Boolean(physicalScale) : Boolean(realScale || (r < 0.1 && !body.p.sun));
  if (isPhysical) {
    const bowMetersInAstroUnits =
      PHYSICAL_CONSTANTS.SHIP_LENGTH_METERS * PHYSICAL_CONSTANTS.METERS_TO_ASTRO_SCENE_UNITS;
    return bowMetersInAstroUnits + r * ringMultiplier;
  }

  const cabinBowMargin = isCabinActive ? 14.8 : 0.45;
  return cabinBowMargin + r * (hasRings ? 2.85 : isSun ? 2.1 : 1.75);
}

/**
 * Aplica límite de exclusión esférica para impedir que la nave o la cabina
 * atraviesen la superficie de un planeta o el sistema de anillos de Saturno/Urano.
 */
export function enforcePlanetaryCollisionBoundary(
  shipPosition,
  solarBodies,
  { isCabinActive = true, physicalScale = null } = {},
) {
  let collidedBody = null;
  for (let i = 0; i < solarBodies.length; i++) {
    const b = solarBodies[i];
    if (!b?.pivot || !b.p) continue;
    const center = b.pivot.position;
    const r = Math.max(1e-5, b.r || 0.35);
    const isPhysical =
      physicalScale !== null ? Boolean(physicalScale) : Boolean(r < 0.1 && !b.p.sun);
    const ringFactor = b.p.ring ? 2.55 : b.p.sun ? 1.55 : 1.35;
    const bowOffset = isPhysical
      ? PHYSICAL_CONSTANTS.SHIP_LENGTH_METERS * PHYSICAL_CONSTANTS.METERS_TO_ASTRO_SCENE_UNITS
      : isCabinActive
        ? 13.6
        : 0.35;
    const minAllowedDist = bowOffset + r * ringFactor;
    const delta = shipPosition.clone().sub(center);
    const dist = delta.length();
    if (dist > 1e-12 && dist < minAllowedDist) {
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
