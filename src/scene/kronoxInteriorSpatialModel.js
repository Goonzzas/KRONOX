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
    label: 'Comedor Circular y Camarotes',
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
];

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

const ZONE_LIST = [
  HULL_INTERIOR_ZONES.bridgeMain,
  HULL_INTERIOR_ZONES.habRing,
  HULL_INTERIOR_ZONES.engineeringLab,
  HULL_INTERIOR_ZONES.cargoHangar,
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

/**
 * Restringe la posición del astronauta, cámara 1P o IA KRONOX dentro de las cubiertas
 * reales y el núcleo vertical compartido de Aurora-120.
 */
export function clampAstronautPosition(
  pos,
  radius = ASTRONAUT_RADIUS_METERS,
  clearance = 0.24
) {
  if (!pos) return pos;
  const pad = radius + clearance;
  const radialFromCenter = Math.hypot(pos.x, pos.z);
  const inVerticalShaft = radialFromCenter <= ELEVATOR_SHAFT_RADIUS + 0.08;
  const isEyeOrProbe = radius <= 0.28 || radius === 0.35;

  if (inVerticalShaft) {
    // Dentro del pozo central de ascensores se permite tránsito continuo entre todas las cubiertas
    pos.y = Math.max(
      HULL_INTERIOR_ZONES.verticalShaft.minY,
      Math.min(HULL_INTERIOR_ZONES.verticalShaft.maxY - (isEyeOrProbe ? 0.25 : 1.4), pos.y)
    );
    const maxShaftR = Math.max(0.25, ELEVATOR_SHAFT_RADIUS - Math.min(0.32, radius * 0.65));
    if (radialFromCenter > maxShaftR && radialFromCenter > 1e-4) {
      // Permitir salida libre hacia proa (-Z) o popa (+Z) alineado con las portezuelas del pozo
      if (Math.abs(pos.x) > 0.72) {
        const s = maxShaftR / radialFromCenter;
        pos.x *= s;
        pos.z *= s;
      }
    }
    return pos;
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

    // Colisión con la mesa holográfica en (0, 6.0) y núcleo estrado central del capitán (0, -5.5)
    pushOutCylinder2D(pos, 0.0, 6.0, 1.55 + radius);
    pushOutCylinder2D(pos, 0.0, -5.5, 0.95 + radius);
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
      // Mesada circular del comedor alrededor del núcleo (con pasillos libres hacia ±Z)
      if (Math.abs(pos.x) > 0.85) {
        const rInner = 1.48 + radius;
        const rOuter = 3.55 + radius;
        const rc = Math.hypot(pos.x, pos.z);
        if (rc > rInner && rc < rOuter && rc > 1e-4) {
          const targetR = rc < 2.55 ? rInner : rOuter;
          pos.x = (pos.x / rc) * targetR;
          pos.z = (pos.z / rc) * targetR;
        }
      }
    } else if (zone.id === 'deck-03') {
      // Reactor principal en popa (0, +9.0) y tanques dorados en (-6, -9) / (+6, -9)
      pushOutCylinder2D(pos, 0.0, 9.0, 2.55 + radius);
      pushOutCylinder2D(pos, -6.0, -9.0, 1.38 + radius);
      pushOutCylinder2D(pos, 6.0, -9.0, 1.38 + radius);
    } else if (zone.id === 'deck-04') {
      // Fuselaje del transbordador de servicio estacionado en proa (0, -11.5)
      if (pos.z < -7.2 && pos.z > -15.4 && Math.abs(pos.x) < 3.6 + radius) {
        if (Math.abs(pos.x) < 2.4) {
          pos.x = pos.x >= 0 ? 2.4 + radius : -(2.4 + radius);
        }
      }
    }
  }

  // Paredes laterales del núcleo de ascensores (entradas abiertas en -Z y +Z, paredes sólidas en ±X)
  if (Math.abs(pos.z) < 1.15 && Math.abs(pos.x) >= ELEVATOR_SHAFT_RADIUS - 0.15 && Math.abs(pos.x) < 1.62 + radius) {
    pos.x = pos.x >= 0 ? 1.62 + radius : -(1.62 + radius);
  }

  return pos;
}

/**
 * Encuentra la estación interactiva más cercana dentro del radio de interacción y cubierta actual.
 */
export function findNearestInteractiveStation(position, overrideRange = null) {
  if (!position) return null;
  const currentDeck = resolveCurrentDeck(position);
  let best = null;
  let bestDist = Infinity;

  for (let i = 0; i < SHIP_INTERIOR_STATIONS.length; i++) {
    const st = SHIP_INTERIOR_STATIONS[i];
    const sx = Array.isArray(st.position) ? st.position[0] : st.position.x;
    const sy = Array.isArray(st.position) ? st.position[1] : st.position.y;
    const sz = Array.isArray(st.position) ? st.position[2] : st.position.z;
    if (Math.abs(sy - currentDeck.elevationY) > 1.8) continue;
    const dx = position.x - sx;
    const dy = (position.y || 0) - sy;
    const dz = position.z - sz;
    const dist = Math.hypot(dx, dy * 0.65, dz);
    const limit = overrideRange ? Math.max(st.maxInteractDistance, overrideRange) : st.maxInteractDistance;
    if (dist <= limit && dist < bestDist) {
      bestDist = dist;
      best = { ...st, station: st, distance: dist };
    }
  }
  return best;
}
