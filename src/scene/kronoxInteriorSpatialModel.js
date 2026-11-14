/**
 * Modelo espacial geométrico del interior de la nave Aurora-120 (KRONOX).
 *
 * Sistema de coordenadas local (1 unidad = 1 metro):
 * - Centro del casco esférico habitable (R = 20 m): (0, 0, 0)
 * - Proa (Puente facetado, Tanques y Hangar de proa): -Z (hasta -15.5 m)
 * - Popa (Reactor, Bodega y Puertas traseras): +Z (hasta +17.5 m)
 * - Estribor: +X | Babor: -X
 * - Cubiertas apiladas verticalmente dentro de la esfera central R = 20 m:
 *   - Cubierta 01 · Puente de Mando:       Y = +3.4 m  (techo Y = +6.8 m)
 *   - Cubierta 02 · Habitacional:          Y =  0.0 m  (techo Y = +3.4 m)
 *   - Cubierta 03 · Ingeniería y SPHEREx:  Y = -3.4 m  (techo Y =  0.0 m)
 *   - Cubierta 04 · Bodega y Hangar:       Y = -6.8 m  (techo Y = -3.4 m)
 * - Núcleo vertical de ascensores / pozo microgravedad compartido en (X = 0, Z = 0, R = 1.25 m).
 */

export const ASTRONAUT_HEIGHT_METERS = 1.72;
export const ASTRONAUT_EYE_METERS = 1.60;
export const ASTRONAUT_RADIUS_METERS = 0.34;

export const AURORA_SPHERE_RADIUS = 20.0;
export const ELEVATOR_SHAFT_RADIUS = 1.24;
export const DECK_HEIGHT_METERS = 3.4;

export const CABIN_DECKS = [
  {
    id: 'deck-01',
    code: 'C01',
    name: 'Puente de Mando',
    shortName: 'Puente',
    elevationY: 3.4,
    zRange: [-15.2, 11.8],
    halfWidth: 11.6,
    accentHex: 0x38d8ff,
    description: 'Cabina en punta de flecha a proa: ventanales facetados, consolas en chevrón, estrado del capitán y mesa holográfica.',
  },
  {
    id: 'deck-02',
    code: 'C02',
    name: 'Cubierta Habitacional',
    shortName: 'Habitacional',
    elevationY: 0.0,
    zRange: [-18.2, 18.2],
    halfWidth: 18.2,
    accentHex: 0xffb857,
    description: 'Ocho camarotes radiales con litera y armario alrededor del comedor circular y del núcleo central de ascensores.',
  },
  {
    id: 'deck-03',
    code: 'C03',
    name: 'Ingeniería y SPHEREx',
    shortName: 'Ingeniería',
    elevationY: -3.4,
    zRange: [-18.2, 18.2],
    halfWidth: 18.2,
    accentHex: 0x7fcfff,
    description: 'Reactor principal a popa, tanques criogénicos dorados, laboratorio espectral SPHEREx (babor) y banco óptico de calibración (estribor).',
  },
  {
    id: 'deck-04',
    code: 'C04',
    name: 'Bodega y Hangar',
    shortName: 'Hangar',
    elevationY: -6.8,
    zRange: [-17.4, 17.4],
    halfWidth: 17.4,
    accentHex: 0x58e2a4,
    description: 'Bahía de contenedores modulares en bodega y transbordador de servicio estacionado en el hangar de proa.',
  },
];

export const HULL_INTERIOR_ZONES = {
  bridgeMain: {
    id: 'deck-01',
    name: 'Puente de Mando · Proa',
    floorY: 3.4,
    minY: 3.4,
    maxY: 6.45,
    minX: -11.4,
    maxX: 11.4,
    minZ: -14.6,
    maxZ: 11.6,
    radiusLimit: 18.2,
  },
  habRing: {
    id: 'deck-02',
    name: 'Cubierta Habitacional',
    floorY: 0.0,
    minY: 0.0,
    maxY: 3.05,
    minX: -17.6,
    maxX: 17.6,
    minZ: -17.6,
    maxZ: 17.6,
    radiusLimit: 17.6,
  },
  engineeringLab: {
    id: 'deck-03',
    name: 'Ingeniería y Laboratorio SPHEREx',
    floorY: -3.4,
    minY: -3.4,
    maxY: -0.35,
    minX: -17.8,
    maxX: 17.8,
    minZ: -17.8,
    maxZ: 17.8,
    radiusLimit: 17.8,
  },
  cargoHangar: {
    id: 'deck-04',
    name: 'Bodega y Hangar de Proa',
    floorY: -6.8,
    minY: -6.8,
    maxY: -3.75,
    minX: -16.8,
    maxX: 16.8,
    minZ: -16.8,
    maxZ: 16.8,
    radiusLimit: 16.8,
  },
  verticalShaft: {
    id: 'elevator-core',
    name: 'Núcleo Vertical de Ascensores',
    centerX: 0.0,
    centerZ: 0.0,
    radius: ELEVATOR_SHAFT_RADIUS,
    minY: -6.8,
    maxY: 6.2,
  },
};

export const SHIP_INTERIOR_STATIONS = [
  // Cubierta 01 · Puente de mando (Y = +3.4)
  {
    id: 'windows',
    label: 'Ventanal Panorámico de Proa',
    tag: 'OBSERVACIÓN',
    deckId: 'deck-01',
    deckLevel: 1,
    position: { x: 0.0, y: 3.4, z: -12.6 },
    consolePos: { x: 0.0, y: 4.95, z: -14.2 },
    aiHoverPos: { x: 1.45, y: 5.05, z: -12.8 },
    lookTarget: { x: 0.0, y: 4.9, z: -28.0 },
    maxInteractDistance: 3.3,
    colorHex: 0x38d8ff,
  },
  {
    id: 'nav',
    label: 'Consola de Navegación en Chevrón',
    tag: 'NAVEGACIÓN',
    deckId: 'deck-01',
    deckLevel: 1,
    position: { x: 0.0, y: 3.4, z: -9.2 },
    consolePos: { x: 0.0, y: 4.75, z: -10.1 },
    aiHoverPos: { x: 1.55, y: 5.05, z: -9.8 },
    lookTarget: { x: 0.0, y: 4.5, z: -13.0 },
    maxInteractDistance: 3.1,
    colorHex: 0x2fd6ff,
  },
  {
    id: 'comms',
    label: 'Puesto Táctico y Enlace KRONOX',
    tag: 'SISTEMAS',
    deckId: 'deck-01',
    deckLevel: 1,
    position: { x: -7.4, y: 3.4, z: -2.5 },
    consolePos: { x: -8.3, y: 4.7, z: -2.0 },
    aiHoverPos: { x: -6.4, y: 5.05, z: -2.8 },
    lookTarget: { x: -11.5, y: 4.4, z: -1.5 },
    maxInteractDistance: 3.1,
    colorHex: 0xffb84d,
  },
  {
    id: 'missions',
    label: 'Mesa Holográfica Táctica',
    tag: 'ÓRBITAS Y MISIONES',
    deckId: 'deck-01',
    deckLevel: 1,
    position: { x: 0.0, y: 3.4, z: 6.0 },
    consolePos: { x: 0.0, y: 4.85, z: 6.0 },
    aiHoverPos: { x: 1.65, y: 5.15, z: 5.4 },
    lookTarget: { x: 0.0, y: 5.1, z: 6.0 },
    maxInteractDistance: 3.2,
    colorHex: 0x8ae8ff,
  },

  // Cubierta 02 · Habitacional (Y = 0.0)
  {
    id: 'galley',
    label: 'Hidratación y Comedor Central',
    tag: 'HABITABILIDAD',
    deckId: 'deck-02',
    deckLevel: 2,
    position: { x: 3.9, y: 0.0, z: -2.2 },
    consolePos: { x: 3.2, y: 1.35, z: -1.6 },
    aiHoverPos: { x: 4.6, y: 1.75, z: -2.6 },
    lookTarget: { x: 0.0, y: 0.85, z: 0.0 },
    maxInteractDistance: 3.2,
    colorHex: 0xffc66d,
  },
  {
    id: 'bioponics',
    label: 'Módulo Biopónico y Soporte Vital',
    tag: 'BIOPÓNICA',
    deckId: 'deck-02',
    deckLevel: 2,
    position: { x: 0.0, y: 0.0, z: 10.6 },
    consolePos: { x: 0.0, y: 1.35, z: 12.1 },
    aiHoverPos: { x: 1.35, y: 1.75, z: 10.4 },
    lookTarget: { x: 0.0, y: 1.25, z: 14.5 },
    maxInteractDistance: 3.2,
    colorHex: 0x45e89e,
  },
  {
    id: 'storage-c02',
    label: 'Compartimento de Suministros EVA',
    tag: 'ALMACENAMIENTO',
    deckId: 'deck-02',
    deckLevel: 2,
    position: { x: -4.8, y: 0.0, z: -4.8 },
    consolePos: { x: -5.85, y: 1.15, z: -5.85 },
    aiHoverPos: { x: -3.9, y: 1.65, z: -4.2 },
    lookTarget: { x: -7.5, y: 1.1, z: -7.5 },
    maxInteractDistance: 2.9,
    colorHex: 0x67e8f9,
  },
  {
    id: 'airlock',
    label: 'Esclusa Radial EVA',
    tag: 'ESCLUSA',
    deckId: 'deck-02',
    deckLevel: 2,
    position: { x: 0.0, y: 0.0, z: -14.2 },
    consolePos: { x: 0.0, y: 1.35, z: -15.4 },
    aiHoverPos: { x: 1.45, y: 1.75, z: -13.6 },
    lookTarget: { x: 0.0, y: 1.3, z: -18.5 },
    maxInteractDistance: 3.2,
    colorHex: 0x5be3aa,
  },

  // Cubierta 03 · Ingeniería y Laboratorio SPHEREx (Y = -3.4)
  {
    id: 'science',
    label: 'Estación Espectral SPHEREx',
    tag: 'CIENCIA SPHEREX',
    deckId: 'deck-03',
    deckLevel: 3,
    position: { x: -13.4, y: -3.4, z: 0.0 },
    consolePos: { x: -14.4, y: -2.05, z: 0.0 },
    aiHoverPos: { x: -12.1, y: -1.65, z: -1.2 },
    lookTarget: { x: -16.0, y: -2.1, z: 0.0 },
    maxInteractDistance: 3.3,
    colorHex: 0xffbe55,
  },
  {
    id: 'sensor-calibration',
    label: 'Banco Óptico de Calibración',
    tag: 'REPARACIÓN',
    deckId: 'deck-03',
    deckLevel: 3,
    position: { x: 13.4, y: -3.4, z: 0.0 },
    consolePos: { x: 14.5, y: -1.95, z: 0.0 },
    aiHoverPos: { x: 12.1, y: -1.65, z: 1.2 },
    lookTarget: { x: 16.0, y: -2.1, z: 0.0 },
    maxInteractDistance: 3.5,
    colorHex: 0x45e8ff,
  },
  {
    id: 'archive',
    label: 'Archivo Espectral IRSA',
    tag: 'ARCHIVO',
    deckId: 'deck-03',
    deckLevel: 3,
    position: { x: -8.2, y: -3.4, z: 10.6 },
    consolePos: { x: -9.0, y: -2.05, z: 11.4 },
    aiHoverPos: { x: -7.2, y: -1.65, z: 9.6 },
    lookTarget: { x: -12.0, y: -2.2, z: 13.5 },
    maxInteractDistance: 3.2,
    colorHex: 0xa2b6ff,
  },
  {
    id: 'engineering',
    label: 'Núcleo del Reactor Aurora',
    tag: 'INGENIERÍA',
    deckId: 'deck-03',
    deckLevel: 3,
    position: { x: 0.0, y: -3.4, z: 5.4 },
    consolePos: { x: 0.0, y: -1.9, z: 6.4 },
    aiHoverPos: { x: 1.55, y: -1.65, z: 5.2 },
    lookTarget: { x: 0.0, y: -1.9, z: 9.0 },
    maxInteractDistance: 3.3,
    colorHex: 0x6ce0ff,
  },

  // Cubierta 04 · Bodega y Hangar (Y = -6.8)
  {
    id: 'hangar',
    label: 'Hangar del Transbordador',
    tag: 'BODEGA Y HANGAR',
    deckId: 'deck-04',
    deckLevel: 4,
    position: { x: 3.2, y: -6.8, z: -8.5 },
    consolePos: { x: 2.2, y: -5.4, z: -9.4 },
    aiHoverPos: { x: 4.2, y: -5.05, z: -8.2 },
    lookTarget: { x: 0.0, y: -5.4, z: -11.5 },
    maxInteractDistance: 3.6,
    colorHex: 0x5be3aa,
  },
  {
    id: 'maintenance-c04',
    label: 'Estación de Mantenimiento y Grúa',
    tag: 'MANTENIMIENTO',
    deckId: 'deck-04',
    deckLevel: 4,
    position: { x: -6.2, y: -6.8, z: 3.6 },
    consolePos: { x: -7.1, y: -5.45, z: 4.3 },
    aiHoverPos: { x: -5.1, y: -5.1, z: 3.0 },
    lookTarget: { x: -8.4, y: -5.4, z: 4.8 },
    maxInteractDistance: 3.2,
    colorHex: 0xffb347,
  },
];

/**
 * Terminales de llamada exteriores (en ±Z de cada rellano) y panel de cabina del ascensor 3D.
 */
export const ELEVATOR_CALL_STATIONS = CABIN_DECKS.flatMap((d, idx) => [
  {
    id: `elevator-call-${d.id}-bow`,
    kind: 'elevator-call',
    deckId: d.id,
    deckLevel: idx + 1,
    side: 'bow',
    label: `Ascensor · Cubierta ${d.code}`,
    tag: 'ASCENSOR 3D',
    position: { x: 0.0, y: d.elevationY, z: -2.05 },
    consolePos: { x: 0.85, y: d.elevationY + 1.35, z: -1.42 },
    maxInteractDistance: 2.35,
    colorHex: 0x38d8ff,
  },
  {
    id: `elevator-call-${d.id}-aft`,
    kind: 'elevator-call',
    deckId: d.id,
    deckLevel: idx + 1,
    side: 'aft',
    label: `Ascensor · Cubierta ${d.code}`,
    tag: 'ASCENSOR 3D',
    position: { x: 0.0, y: d.elevationY, z: 2.05 },
    consolePos: { x: -0.85, y: d.elevationY + 1.35, z: 1.42 },
    maxInteractDistance: 2.35,
    colorHex: 0x38d8ff,
  },
]);

/**
 * Distribución determinista de contenedores ISO y bancos de trabajo en C04 (usada en 3D y colisiones).
 */
export const C04_CARGO_CONTAINERS = Object.freeze([
  { id: 'c04-box-p1', cx: -6.6, cz: -4.2, hx: 1.65, hz: 1.15, h: 1.48, color: 0xc2552b, double: true },
  { id: 'c04-box-p2', cx: -10.8, cz: -1.2, hx: 1.65, hz: 1.15, h: 1.48, color: 0x2e6fb3, double: false },
  { id: 'c04-box-p3', cx: -10.8, cz: 3.8, hx: 1.65, hz: 1.15, h: 1.48, color: 0xd6a23a, double: true },
  { id: 'c04-box-p4', cx: -5.8, cz: 8.6, hx: 1.75, hz: 1.2, h: 1.48, color: 0x3b8f6b, double: false },
  { id: 'c04-box-s1', cx: 6.8, cz: -3.2, hx: 1.65, hz: 1.15, h: 1.48, color: 0x2e6fb3, double: false },
  { id: 'c04-box-s2', cx: 10.6, cz: 1.6, hx: 1.65, hz: 1.15, h: 1.48, color: 0x7a8590, double: true },
  { id: 'c04-box-s3', cx: 6.2, cz: 6.8, hx: 1.65, hz: 1.15, h: 1.48, color: 0xc2552b, double: false },
  { id: 'c04-box-s4', cx: 6.2, cz: 11.2, hx: 1.65, hz: 1.15, h: 1.48, color: 0xd6a23a, double: false },
  { id: 'c04-box-aft', cx: -1.2, cz: 11.4, hx: 1.75, hz: 1.25, h: 1.48, color: 0x3b8f6b, double: true },
]);

// Áreas angulares de las 8 particiones radiales de C02 (desfasadas 22.5° para despejar por completo los pasillos ±Z/±X)
export const C02_BULKHEAD_ANGLES = Object.freeze(
  Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4 + Math.PI / 8),
);

export const INTERIOR_GRAB_RAILS = [
  // Pasamanos verticales y de acceso en el núcleo central (permite anclaje EVA en las 4 cubiertas)
  { id: 'rail-core-c01', pos: [1.05, 4.5, 0.0], span: 2.4, axis: 'y', side: 'starboard', deckId: 'deck-01' },
  { id: 'rail-core-c02', pos: [1.05, 1.1, 0.0], span: 2.4, axis: 'y', side: 'starboard', deckId: 'deck-02' },
  { id: 'rail-core-c03', pos: [1.05, -2.3, 0.0], span: 2.4, axis: 'y', side: 'starboard', deckId: 'deck-03' },
  { id: 'rail-core-c04', pos: [1.05, -5.7, 0.0], span: 2.4, axis: 'y', side: 'starboard', deckId: 'deck-04' },
  // Pasamanos de cubierta
  { id: 'rail-bridge-bow', pos: [0.0, 4.45, -10.5], span: 4.5, axis: 'x', side: 'bow', deckId: 'deck-01' },
  { id: 'rail-bridge-port', pos: [-6.8, 4.45, -2.5], span: 6.0, axis: 'z', side: 'port', deckId: 'deck-01' },
  { id: 'rail-hab-ring', pos: [3.6, 1.1, -2.0], span: 5.0, axis: 'z', side: 'starboard', deckId: 'deck-02' },
  { id: 'rail-lab-spherex', pos: [-12.2, -2.3, 0.0], span: 6.0, axis: 'z', side: 'port', deckId: 'deck-03' },
  { id: 'rail-lab-bench', pos: [14.0, -2.3, 3.0], span: 6.0, axis: 'z', side: 'starboard', deckId: 'deck-03' },
  { id: 'rail-eng-reactor', pos: [2.4, -2.3, 5.4], span: 4.4, axis: 'x', side: 'aft', deckId: 'deck-03' },
  { id: 'rail-hangar-bay', pos: [5.4, -5.65, -6.8], span: 5.5, axis: 'z', side: 'starboard', deckId: 'deck-04' },
];

function pushOutCylinder2D(pos, cx, cz, obstacleRadius) {
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const dist = Math.hypot(dx, dz);
  if (dist < obstacleRadius) {
    if (dist > 1e-4) {
      const k = obstacleRadius / dist;
      pos.x = cx + dx * k;
      pos.z = cz + dz * k;
    } else {
      pos.z = cz - obstacleRadius;
    }
  }
}

/**
 * Determina la cubierta actual a partir de la posición 3D dentro de la esfera habitable.
 */
export function resolveCurrentDeck(position) {
  if (!position) return CABIN_DECKS[0];
  const y = Number(position.y || 0);
  let best = CABIN_DECKS[0];
  let bestDist = Infinity;
  for (let i = 0; i < CABIN_DECKS.length; i++) {
    const d = CABIN_DECKS[i];
    // Banda principal centrada sobre la altura del suelo -> cabeza de cada cubierta
    const midY = d.elevationY + 1.5;
    const dist = Math.abs(y - midY);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}

function getBridgeHalfWidthAtZ(z) {
  // Heptágono Punta de Flecha (rotado +90° Y):
  // P_KRONOX = [[0,-15.5], [6.2,-11], [12,-1], [10.5,12], [-10.5,12], [-12,-1], [-6.2,-11]]
  if (z <= -11.0) {
    const t = Math.max(0.05, Math.min(1, (z + 15.5) / 4.5));
    return t * 6.2;
  }
  if (z <= -1.0) {
    const t = (z + 11.0) / 10.0;
    return 6.2 + t * 5.8;
  }
  const t = Math.max(0, Math.min(1, (z + 1.0) / 13.0));
  return 12.0 - t * 1.5;
}

function pushOutAABB2D(pos, cx, cz, hx, hz) {
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const ox = hx - Math.abs(dx);
  const oz = hz - Math.abs(dz);
  if (ox > 0 && oz > 0) {
    if (ox < oz) {
      pos.x = cx + (dx >= 0 ? hx : -hx);
    } else {
      pos.z = cz + (dz >= 0 ? hz : -hz);
    }
  }
}

function pushOutRadialWall2D(pos, angleRad, rMin, rMax, halfThick) {
  // Orientación Aurora->KRONOX: dirección radial unitaria (sin(a), -cos(a))
  const ux = Math.sin(angleRad);
  const uz = -Math.cos(angleRad);
  const px = Math.cos(angleRad);
  const pz = Math.sin(angleRad);
  const projR = pos.x * ux + pos.z * uz;
  if (projR <= rMin || projR >= rMax) return;
  const projP = pos.x * px + pos.z * pz;
  if (Math.abs(projP) < halfThick) {
    const signP = projP >= 0 ? 1 : -1;
    const targetP = signP * halfThick;
    pos.x = projR * ux + targetP * px;
    pos.z = projR * uz + targetP * pz;
  }
}

function segmentIntersectsRadialWall2D(ax, az, bx, bz, angleRad, rMin, rMax) {
  const ux = Math.sin(angleRad);
  const uz = -Math.cos(angleRad);
  const px = Math.cos(angleRad);
  const pz = Math.sin(angleRad);
  const pa = ax * px + az * pz;
  const pb = bx * px + bz * pz;
  if ((pa > 0.08 && pb > 0.08) || (pa < -0.08 && pb < -0.08)) return false;
  const denom = pa - pb;
  if (Math.abs(denom) < 1e-5) return false;
  const t = pa / denom;
  if (t <= 0 || t >= 1) return false;
  const ix = ax + (bx - ax) * t;
  const iz = az + (bz - az) * t;
  const ir = ix * ux + iz * uz;
  return ir >= rMin && ir <= rMax;
}

/**
 * Restringe la posición del astronauta, cámara 1P/3P o IA KRONOX dentro de las cubiertas
 * reales, mobiliario sólido y núcleo vertical / puertas cerradas del ascensor 3D.
 */
export function clampAstronautPosition(
  pos,
  radius = ASTRONAUT_RADIUS_METERS,
  clearance = 0.24,
  elevatorState = null
) {
  if (!pos) return pos;
  const pad = radius + clearance;
  const radialFromCenter = Math.hypot(pos.x, pos.z);
  const inVerticalShaft = radialFromCenter <= ELEVATOR_SHAFT_RADIUS + 0.08;
  const isEyeOrProbe = radius <= 0.28 || radius === 0.35;

  const cabY = Number.isFinite(elevatorState?.cabY) ? elevatorState.cabY : 3.4;

  if (elevatorState?.moving) {
    if (!isEyeOrProbe && elevatorState.passengerRiding) {
      pos.y = cabY;
      pos.x = Math.max(-0.82, Math.min(0.82, pos.x));
      pos.z = Math.max(-0.82, Math.min(0.82, pos.z));
      return pos;
    }
    if (isEyeOrProbe && elevatorState.passengerRiding && inVerticalShaft) {
      pos.y = Math.max(cabY + 0.35, Math.min(cabY + 2.15, pos.y));
      pos.x = Math.max(-0.86, Math.min(0.86, pos.x));
      pos.z = Math.max(-0.86, Math.min(0.86, pos.z));
      return pos;
    }
  }

  if (inVerticalShaft) {
    if (elevatorState) {
      const refY = isEyeOrProbe ? pos.y - 1.35 : pos.y;
      const sameDeckAsCab = Math.abs(refY - cabY) < 1.55 || Boolean(elevatorState.passengerRiding);
      if (sameDeckAsCab) {
        const activeDeck = resolveCurrentDeck({ y: cabY });
        const doorOpen = Number(elevatorState.doorOpenByDeck?.[activeDeck.id] ?? 0);
        if (isEyeOrProbe) {
          pos.y = Math.max(cabY + 0.35, Math.min(cabY + 2.15, pos.y));
        } else {
          pos.y = cabY;
        }
        pos.x = Math.max(-0.92 + radius * 0.4, Math.min(0.92 - radius * 0.4, pos.x));
        if (doorOpen < 0.72) {
          pos.z = Math.max(-0.92 + radius * 0.4, Math.min(0.92 - radius * 0.4, pos.z));
        }
        return pos;
      }
      // Si la cabina NO está en esta cubierta, impedir entrar al pozo y empujar fuera de la puerta
    } else {
      // Modo sin estado físico de ascensor (pruebas unitarias y sondas) permite tránsito vertical continuo
      pos.y = Math.max(
        HULL_INTERIOR_ZONES.verticalShaft.minY,
        Math.min(HULL_INTERIOR_ZONES.verticalShaft.maxY - (isEyeOrProbe ? 0.25 : 1.4), pos.y)
      );
      const maxShaftR = Math.max(0.25, ELEVATOR_SHAFT_RADIUS - Math.min(0.32, radius * 0.65));
      if (radialFromCenter > maxShaftR && radialFromCenter > 1e-4) {
        if (Math.abs(pos.x) > 0.72) {
          const s = maxShaftR / radialFromCenter;
          pos.x *= s;
          pos.z *= s;
        }
      }
      return pos;
    }
  }

  // Determinar zona de cubierta correspondiente a Y
  let zone = HULL_INTERIOR_ZONES.bridgeMain;
  if (pos.y < -5.1) {
    zone = HULL_INTERIOR_ZONES.cargoHangar;
  } else if (pos.y < -1.7) {
    zone = HULL_INTERIOR_ZONES.engineeringLab;
  } else if (pos.y < 1.7) {
    zone = HULL_INTERIOR_ZONES.habRing;
  } else {
    zone = HULL_INTERIOR_ZONES.bridgeMain;
  }

  const maxFeetY = isEyeOrProbe ? zone.maxY : zone.floorY + 1.58;
  const minAllowedY = isEyeOrProbe ? zone.minY + 0.25 : zone.minY;
  pos.y = Math.max(minAllowedY, Math.min(maxFeetY, pos.y));

  if (zone.id === 'deck-01') {
    // Contorno heptagonal de proa a popa
    pos.z = Math.max(-14.3 + pad * 0.4, Math.min(11.3 - pad * 0.4, pos.z));
    const maxX = Math.max(0.55, getBridgeHalfWidthAtZ(pos.z) - pad);
    pos.x = Math.max(-maxX, Math.min(maxX, pos.x));

    // Colisión con la mesa holográfica (0, +6.0), núcleo capitán (0, -5.5), consolas laterales y chevrón frontal
    pushOutCylinder2D(pos, 0.0, 6.0, 1.58 + radius);
    pushOutCylinder2D(pos, 0.0, -5.5, 0.98 + radius);
    if (!isEyeOrProbe) {
      pushOutAABB2D(pos, -2.85, -9.55, 1.15 + radius, 0.75 + radius);
      pushOutAABB2D(pos, 2.85, -9.55, 1.15 + radius, 0.75 + radius);
      pushOutAABB2D(pos, -6.5, -5.8, 1.2 + radius, 1.0 + radius);
      pushOutAABB2D(pos, 6.5, -5.8, 1.2 + radius, 1.0 + radius);
      pushOutAABB2D(pos, -9.5, 1.2, 0.95 + radius, 4.4 + radius);
      pushOutAABB2D(pos, 9.5, 1.2, 0.95 + radius, 4.4 + radius);
    }
  } else {
    // Recinto circular conforme al radio esférico real de cada cubierta
    const rMax = Math.max(2.5, zone.radiusLimit - pad);
    const r = Math.hypot(pos.x, pos.z);
    if (r > rMax && r > 1e-4) {
      const k = rMax / r;
      pos.x *= k;
      pos.z *= k;
    }

    if (zone.id === 'deck-02') {
      // Mesada circular del comedor alrededor del núcleo (pasillos abiertos en ±Z para |x| <= 1.25)
      if (Math.abs(pos.x) > 1.05) {
        const rInner = 1.48 + radius;
        const rOuter = 3.55 + radius;
        const rc = Math.hypot(pos.x, pos.z);
        if (rc > rInner && rc < rOuter && rc > 1e-4) {
          const targetR = rc < 2.55 ? rInner : rOuter;
          pos.x = (pos.x / rc) * targetR;
          pos.z = (pos.z / rc) * targetR;
        }
      }
      // 8 mamparos radiales sólidos desfasados 22.5° (desde r = 6.9 hasta pared exterior), dejando anillo libre 3.5..6.8
      for (let i = 0; i < C02_BULKHEAD_ANGLES.length; i++) {
        pushOutRadialWall2D(pos, C02_BULKHEAD_ANGLES[i], 6.85 - radius * 0.4, 17.8, 0.14 + radius);
      }
      // Bancos y bastidores biopónicos en bahía popa (+Z), exclusa proa y literas de camarotes
      if (!isEyeOrProbe) {
        pushOutAABB2D(pos, -2.55, 11.4, 0.62 + radius, 2.2 + radius);
        pushOutAABB2D(pos, 2.55, 11.4, 0.62 + radius, 2.2 + radius);
        pushOutAABB2D(pos, -5.95, -5.95, 0.85 + radius, 0.85 + radius);
      }
    } else if (zone.id === 'deck-03') {
      // Reactor principal (0, +9.0), columnas refrigerantes (±4, +9), tanques criogénicos (±6, -9) y arcos de laboratorio
      pushOutCylinder2D(pos, 0.0, 9.0, 2.6 + radius);
      pushOutCylinder2D(pos, -4.0, 9.0, 0.42 + radius);
      pushOutCylinder2D(pos, 4.0, 9.0, 0.42 + radius);
      pushOutCylinder2D(pos, -6.0, -9.0, 1.42 + radius);
      pushOutCylinder2D(pos, 6.0, -9.0, 1.42 + radius);
      if (!isEyeOrProbe) {
        pushOutAABB2D(pos, -15.3, 0.0, 0.95 + radius, 5.2 + radius);
        pushOutAABB2D(pos, 15.1, 0.0, 1.05 + radius, 5.2 + radius);
        pushOutCylinder2D(pos, -9.8, 11.8, 1.05 + radius);
      }
    } else if (zone.id === 'deck-04') {
      // Fuselaje y alas del transbordador de servicio estacionado en proa (0, -11.5)
      pushOutAABB2D(pos, 0.0, -11.5, 1.45 + radius, 4.15 + radius);
      pushOutAABB2D(pos, 0.0, -11.0, 3.55 + radius, 1.2 + radius);
      // Contenedores ISO deterministas y banco de mantenimiento en bodega
      for (let i = 0; i < C04_CARGO_CONTAINERS.length; i++) {
        const b = C04_CARGO_CONTAINERS[i];
        pushOutAABB2D(pos, b.cx, b.cz, b.hx + radius, b.hz + radius);
      }
      if (!isEyeOrProbe) {
        pushOutAABB2D(pos, -7.8, 4.8, 1.15 + radius, 0.95 + radius);
      }
    }
  }

  // Paredes laterales del núcleo de ascensores (entradas en ±Z, muros sólidos en ±X)
  if (Math.abs(pos.z) < 1.38 && Math.abs(pos.x) >= ELEVATOR_SHAFT_RADIUS - 0.15 && Math.abs(pos.x) < 1.65 + radius) {
    pos.x = pos.x >= 0 ? 1.65 + radius : -(1.65 + radius);
  }

  // Barrera física de puertas cerradas del ascensor en cada cubierta (cuando elevatorState está activo)
  if (elevatorState && !isEyeOrProbe && Math.abs(pos.x) < 1.34) {
    const cabY = Number.isFinite(elevatorState.cabY) ? elevatorState.cabY : 3.4;
    const doorOpen = Number(elevatorState.doorOpenByDeck?.[zone.id] ?? 0);
    const cabAtThisDeck = Math.abs(cabY - zone.floorY) < 0.35;
    if (!cabAtThisDeck && Math.abs(pos.z) < 1.52 + radius) {
      pos.z = pos.z >= 0 ? 1.52 + radius : -(1.52 + radius);
    } else if (cabAtThisDeck && doorOpen < 0.72 && Math.abs(pos.z) >= 1.05 && Math.abs(pos.z) < 1.52 + radius) {
      pos.z = pos.z >= 0 ? 1.52 + radius : -(1.52 + radius);
    }
  }

  return pos;
}

/**
 * Encuentra la estación interactiva o terminal de ascensor más cercana dentro de distancia Y campo visual.
 */
export function findNearestInteractiveStation(position, overrideRange = null, options = null) {
  if (!position) return null;
  if (options?.exteriorMode) return null;

  const currentDeck = resolveCurrentDeck(position);
  const hasGaze = Boolean(options?.lookDir && Number.isFinite(options.lookDir.x));
  const minDot = Number.isFinite(options?.minDot) ? options.minDot : 0.38;
  const eyeX = options?.eyePos?.x ?? position.x;
  const eyeY = options?.eyePos?.y ?? ((position.y || 0) + 1.52);
  const eyeZ = options?.eyePos?.z ?? position.z;
  const lxDir = options?.lookDir?.x ?? 0;
  const lyDir = options?.lookDir?.y ?? 0;
  const lzDir = options?.lookDir?.z ?? -1;

  const candidates = options?.includeElevator
    ? [...SHIP_INTERIOR_STATIONS, ...ELEVATOR_CALL_STATIONS]
    : SHIP_INTERIOR_STATIONS;

  let best = null;
  let bestScore = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const st = candidates[i];
    const sx = Array.isArray(st.position) ? st.position[0] : st.position.x;
    const sy = Array.isArray(st.position) ? st.position[1] : st.position.y;
    const sz = Array.isArray(st.position) ? st.position[2] : st.position.z;
    if (Math.abs(sy - currentDeck.elevationY) > 1.8) continue;

    const dx = position.x - sx;
    const dy = (position.y || 0) - sy;
    const dz = position.z - sz;
    const dist = Math.hypot(dx, dy * 0.65, dz);
    const limit = overrideRange
      ? (st.kind === 'elevator-call' ? st.maxInteractDistance : Math.max(st.maxInteractDistance, overrideRange))
      : st.maxInteractDistance;
    if (dist > limit) continue;

    // Evitar detectar estaciones al otro lado de un mamparo sólido radial en C02
    if (currentDeck.id === 'deck-02') {
      const tx = st.consolePos?.x ?? sx;
      const tz = st.consolePos?.z ?? sz;
      let blockedByWall = false;
      for (let w = 0; w < C02_BULKHEAD_ANGLES.length; w++) {
        if (segmentIntersectsRadialWall2D(position.x, position.z, tx, tz, C02_BULKHEAD_ANGLES[w], 6.85, 17.8)) {
          blockedByWall = true;
          break;
        }
      }
      if (blockedByWall) continue;
    }

    let gazeDot = 1.0;
    if (hasGaze) {
      const targetObj = st.consolePos || st.lookTarget || st.position;
      const gx = (targetObj.x ?? sx) - eyeX;
      const gy = (targetObj.y ?? (sy + 1.25)) - eyeY;
      const gz = (targetObj.z ?? sz) - eyeZ;
      const len = Math.hypot(gx, gy * 0.55, gz);
      if (len > 1e-4) {
        gazeDot = (gx * lxDir + (gy * 0.55) * lyDir + gz * lzDir) / len;
      }
      const requiredDot = dist < 1.15 ? Math.min(minDot, 0.12) : minDot;
      if (gazeDot < requiredDot) continue;
    }

    // Puntuación combinada: prioriza distancia corta + alineación directa con la mirada
    const score = dist - gazeDot * 0.65;
    if (score < bestScore) {
      bestScore = score;
      best = { ...st, station: st, distance: dist, gazeDot };
    }
  }
  return best;
}

export const DIRECT_INTERACTION_IDS = new Set([
  'storage-c02',
  'bioponics',
  'galley',
  'hydration',
  'airlock',
  'hangar',
  'maintenance-c04',
  'pickup-multitool',
  'pickup-scanner',
]);

/**
 * Devuelve etiqueta breve y clara de acción contextual para HUD diegético según el estado actual 3D.
 */
export function describeInteractablePrompt(interactId, ctx = {}) {
  if (!interactId) return null;
  const mech = ctx.mechanisms || {};
  const deckList = CABIN_DECKS;

  if (interactId === 'storage-c02') {
    const open = Boolean(mech.storageC02Open);
    return { id: interactId, direct: true, label: open ? 'Cerrar taquilla EVA' : 'Abrir taquilla EVA', actionLabel: open ? 'Cerrar' : 'Abrir' };
  }
  if (interactId === 'bioponics') {
    const on = Boolean(mech.bioponicsActive ?? true);
    return { id: interactId, direct: true, label: on ? 'Alternar espectro biopónico' : 'Activar iluminación biopónica', actionLabel: 'Alternar' };
  }
  if (interactId === 'galley' || interactId === 'hydration') {
    const on = Boolean(mech.hydrationDispensing);
    return { id: interactId, direct: true, label: on ? 'Cerrar dispensador H₂O' : 'Dispensar H₂O mineral', actionLabel: on ? 'Detener' : 'Dispensar' };
  }
  if (interactId === 'airlock') {
    const press = mech.airlockPressurized !== false;
    return { id: interactId, direct: true, label: press ? 'Ciclar válvula de esclusa EVA' : 'Presurizar cámara EVA', actionLabel: press ? 'Despresurizar' : 'Presurizar' };
  }
  if (interactId === 'hangar') {
    const out = Boolean(mech.hangarCraneDeployed);
    return { id: interactId, direct: true, label: out ? 'Replegar grúa y cerrar escotilla' : 'Desplegar grúa y abrir escotilla', actionLabel: out ? 'Replegar' : 'Desplegar' };
  }
  if (interactId === 'maintenance-c04') {
    const out = Boolean(mech.maintDrawerOpen);
    return { id: interactId, direct: true, label: out ? 'Cerrar cajón y brazo robótico' : 'Extender brazo y cajón de taller', actionLabel: out ? 'Replegar' : 'Activar' };
  }
  if (interactId === 'pickup-multitool') {
    return { id: interactId, direct: true, label: 'Recoger Multiherramienta EVA', actionLabel: 'Recoger' };
  }
  if (interactId === 'pickup-scanner') {
    return { id: interactId, direct: true, label: 'Recoger Escáner IR portátil', actionLabel: 'Recoger' };
  }
  if (interactId.startsWith('elevator-floor-')) {
    const deckId = interactId.replace('elevator-floor-', '');
    const d = deckList.find((item) => item.id === deckId);
    return { id: interactId, direct: true, label: d ? `Viajar a ${d.code} · ${d.shortName}` : 'Seleccionar cubierta', actionLabel: d?.code || 'Viajar' };
  }
  if (interactId.startsWith('elevator-call-')) {
    return { id: interactId, direct: true, label: ctx.cabHere ? 'Panel de cubiertas (Ascensor)' : 'Llamar ascensor a esta cubierta', actionLabel: ctx.cabHere ? 'Elegir piso' : 'Llamar' };
  }
  if (interactId === 'elevator-panel') {
    return { id: interactId, direct: false, label: 'Selector de cubierta [1-4]', actionLabel: 'Planta' };
  }
  if (interactId.startsWith('rail-')) {
    return {
      id: interactId,
      direct: true,
      label: ctx.isAnchored ? 'Soltar pasamanos EVA' : 'Agarrar pasamanos EVA',
      actionLabel: ctx.isAnchored ? 'Soltar' : 'Sujetar',
    };
  }
  const st = SHIP_INTERIOR_STATIONS.find((s) => s.id === interactId);
  return {
    id: interactId,
    direct: false,
    label: st ? st.label : 'Consola',
    actionLabel: 'Operar',
  };
}
