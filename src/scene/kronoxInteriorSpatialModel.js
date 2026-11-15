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
export const ELEVATOR_DOOR_CLEAR_HALF_WIDTH = 0.74;
export const DECK_HEIGHT_METERS = 3.4;
export const DECK_SLAB_THICKNESS_METERS = 0.28;
export const DECK_CLEAR_HEIGHT_METERS = DECK_HEIGHT_METERS - DECK_SLAB_THICKNESS_METERS;
export const ASTRONAUT_MAX_FEET_ABOVE_FLOOR = DECK_CLEAR_HEIGHT_METERS - ASTRONAUT_HEIGHT_METERS; // 1.40 m (cabeza <= +3.12 m)

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
    maxY: 6.38,
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
    maxY: 2.98,
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
    maxY: -0.42,
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
    maxY: -3.82,
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
    maxY: 6.38,
  },
};

const ZONE_BY_DECK_ID = {
  'deck-01': HULL_INTERIOR_ZONES.bridgeMain,
  'deck-02': HULL_INTERIOR_ZONES.habRing,
  'deck-03': HULL_INTERIOR_ZONES.engineeringLab,
  'deck-04': HULL_INTERIOR_ZONES.cargoHangar,
};

export function getDeckZoneById(deckId) {
  return ZONE_BY_DECK_ID[deckId] || HULL_INTERIOR_ZONES.bridgeMain;
}

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

// Contorno heptagonal Aurora del Puente C01 y mesas en chevrón proyectadas a KRONOX (kx=az, kz=-ax)
const C01_HEPTAGON_AURORA = Object.freeze([
  [15.5, 0], [11, 6.2], [1, 12], [-12, 10.5], [-12, -10.5], [1, -12], [11, -6.2],
]);

export const C01_CHEVRON_OBSTACLES = Object.freeze((() => {
  const edges = C01_HEPTAGON_AURORA.map((a, idx) => {
    const b = C01_HEPTAGON_AURORA[(idx + 1) % C01_HEPTAGON_AURORA.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz);
    const mx = (a[0] + b[0]) * 0.5;
    const mz = (a[1] + b[1]) * 0.5;
    let nx = dz / l;
    let nz = -dx / l;
    if (nx * mx + nz * mz < 0) {
      nx = -nx;
      nz = -nz;
    }
    return { nx, nz, rot: Math.atan2(nx, nz), at: (t) => [a[0] + dx * t, a[1] + dz * t] };
  });
  const items = [];
  [[5, 3], [6, 1], [0, 1], [1, 3]].forEach(([ei, count]) => {
    const e = edges[ei];
    const ux = -Math.sin(e.rot);
    const uz = -Math.cos(e.rot);
    const vx = Math.cos(e.rot);
    const vz = -Math.sin(e.rot);
    for (let k = 0; k < count; k++) {
      const [ax, az] = e.at((k + 0.5) / count);
      const dKx = az * 0.72;
      const dKz = -ax * 0.72;
      const cAx = ax * 0.72 - e.nx * 1.9;
      const cAz = az * 0.72 - e.nz * 1.9;
      items.push({
        deskCx: dKx,
        deskCz: dKz,
        ux,
        uz,
        vx,
        vz,
        hx: 1.08,
        hz: 0.66,
        chairCx: cAz,
        chairCz: -cAx,
        chairRadius: 0.36,
      });
    }
  });
  [2, 4].forEach((ei) => {
    const e = edges[ei];
    const rot = e.rot + Math.PI;
    const ux = -Math.sin(rot);
    const uz = -Math.cos(rot);
    const vx = Math.cos(rot);
    const vz = -Math.sin(rot);
    for (let k = 0; k < 4; k++) {
      const [x, z] = e.at(0.18 + k * 0.21);
      const ax = x - e.nx * 1.1;
      const az = z - e.nz * 1.1;
      items.push({
        deskCx: az,
        deskCz: -ax,
        ux,
        uz,
        vx,
        vz,
        hx: 1.12,
        hz: 0.48,
        chairCx: null,
        chairCz: null,
        chairRadius: 0,
      });
    }
  });
  return Object.freeze(items);
})());

// Mesada curva de comedor en ±X (r in [2.38, 3.36]) manteniendo pasillos ±Z completamente despejados
export const C02_DINING_ARCS = Object.freeze({
  rInner: 2.38,
  rOuter: 3.36,
  halfAngleRad: 0.90,
  barHeight: 0.82,
  stoolRadius: 3.92,
  stoolAnglesFromX: Object.freeze([-0.58, 0.0, 0.58]),
});

// 6 bahías de camarotes en C02 (omitiendo k=0 esclusa proa -Z y k=4 biopónica popa +Z)
export const C02_CABIN_BAYS = Object.freeze(
  [1, 2, 3, 5, 6, 7].map((k) => {
    const angleRad = (k * Math.PI) / 4;
    return Object.freeze({
      index: k,
      angleRad,
      ux: Math.sin(angleRad),
      uz: -Math.cos(angleRad),
      px: Math.cos(angleRad),
      pz: Math.sin(angleRad),
    });
  })
);

// Estaciones curvas de laboratorio C03 SPHEREx (babor, Math.PI) y Banco Óptico (estribor, 0)
export const C03_LAB_ARCS = Object.freeze([
  ...Array.from({ length: 6 }, (_, i) => {
    const t = Math.PI - 0.95 + (1.9 * i) / 5;
    return {
      side: 'port',
      t,
      cx: 15.2 * Math.cos(t),
      cz: -15.2 * Math.sin(t),
      ux: -Math.sin(t),
      uz: -Math.cos(t),
      vx: Math.cos(t),
      vz: -Math.sin(t),
      hx: 1.2,
      hz: 0.66,
    };
  }),
  ...Array.from({ length: 6 }, (_, i) => {
    const t = -0.95 + (1.9 * i) / 5;
    return {
      side: 'starboard',
      t,
      cx: 15.2 * Math.cos(t),
      cz: -15.2 * Math.sin(t),
      ux: -Math.sin(t),
      uz: -Math.cos(t),
      vx: Math.cos(t),
      vz: -Math.sin(t),
      hx: 1.2,
      hz: 0.66,
    };
  }),
]);

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

export function getBridgeHalfWidthAtZ(z) {
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

function pushOutOBB2D(pos, cx, cz, ux, uz, vx, vz, hx, hz) {
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const pu = dx * ux + dz * uz;
  const pv = dx * vx + dz * vz;
  const ou = hx - Math.abs(pu);
  const ov = hz - Math.abs(pv);
  if (ou > 0 && ov > 0) {
    if (ou < ov) {
      const targetPu = pu >= 0 ? hx : -hx;
      const delta = targetPu - pu;
      pos.x += delta * ux;
      pos.z += delta * uz;
    } else {
      const targetPv = pv >= 0 ? hz : -hz;
      const delta = targetPv - pv;
      pos.x += delta * vx;
      pos.z += delta * vz;
    }
  }
}

function pushOutRadialOBB2D(pos, bay, rCenter, rHalf, tHalf) {
  pushOutOBB2D(
    pos,
    bay.ux * rCenter,
    bay.uz * rCenter,
    bay.ux,
    bay.uz,
    bay.px,
    bay.pz,
    rHalf,
    tHalf
  );
}

function pushOutDiningSector2D(pos, sideSign, rInner, rOuter, halfAngle, radius) {
  const sx = pos.x * sideSign;
  if (sx <= 0.2) return;
  const rMin = Math.max(1.35, rInner - radius);
  const rMax = rOuter + radius;
  const r = Math.hypot(pos.x, pos.z);
  if (r <= rMin || r >= rMax || r < 1e-4) return;
  const ang = Math.atan2(pos.z, sx);
  const rMid = (rInner + rOuter) * 0.5;
  const angLimit = halfAngle + radius / rMid;
  if (Math.abs(ang) >= angLimit) return;

  const dInner = r - rMin;
  const dOuter = rMax - r;
  const dRadial = Math.min(dInner, dOuter);
  const dAngular = (angLimit - Math.abs(ang)) * r;

  if (dRadial <= dAngular) {
    const targetR = dInner < dOuter ? rMin : rMax;
    const scale = targetR / r;
    pos.x *= scale;
    pos.z *= scale;
  } else {
    const targetAng = (ang >= 0 ? 1 : -1) * angLimit;
    pos.x = sideSign * r * Math.cos(targetAng);
    pos.z = r * Math.sin(targetAng);
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
 * Determina el ID de cubierta desde un umbral medio Y cuando no existe bloqueo explícito.
 */
function inferDeckZoneFromY(y) {
  if (y < -5.1) return HULL_INTERIOR_ZONES.cargoHangar;
  if (y < -1.7) return HULL_INTERIOR_ZONES.engineeringLab;
  if (y < 1.7) return HULL_INTERIOR_ZONES.habRing;
  return HULL_INTERIOR_ZONES.bridgeMain;
}

/**
 * Restringe la posición del astronauta, cámara 1P/3P o IA KRONOX dentro de las cubiertas
 * reales (bloqueo estricto entre plantas fuera del ascensor), mobiliario sólido y ascensor 3D.
 */
export function clampAstronautPosition(
  pos,
  radius = ASTRONAUT_RADIUS_METERS,
  clearance = 0.24,
  elevatorState = null,
  options = null
) {
  if (!pos) return pos;
  const pad = radius + clearance;
  const radialFromCenter = Math.hypot(pos.x, pos.z);
  const isEyeOrProbe = radius <= 0.28 || radius === 0.35;
  const rCol = isEyeOrProbe ? Math.max(0.14, radius * 0.72) : radius;

  const cabY = Number.isFinite(elevatorState?.cabY) ? elevatorState.cabY : 3.4;

  // 1) Modo sin estado físico de ascensor (pruebas unitarias y sondas abiertas de pozo)
  if (!elevatorState) {
    const inVerticalShaft = radialFromCenter <= ELEVATOR_SHAFT_RADIUS + 0.08;
    if (inVerticalShaft && !options?.lockedDeckId) {
      pos.y = Math.max(
        HULL_INTERIOR_ZONES.verticalShaft.minY,
        Math.min(HULL_INTERIOR_ZONES.verticalShaft.maxY - (isEyeOrProbe ? 0.22 : ASTRONAUT_HEIGHT_METERS), pos.y)
      );
      const maxShaftR = Math.max(0.25, ELEVATOR_SHAFT_RADIUS - Math.min(0.32, radius * 0.65));
      if (radialFromCenter > maxShaftR && radialFromCenter > 1e-4 && Math.abs(pos.x) > 0.72) {
        const s = maxShaftR / radialFromCenter;
        pos.x *= s;
        pos.z *= s;
      }
      return pos;
    }
  }

  // 2) Pasajero dentro de cabina en tránsito o cierre/apertura inicial: retención total sin deslizamiento
  if (elevatorState?.passengerRiding) {
    const ridingDeck = resolveCurrentDeck({ y: cabY });
    const rideDoorOpen = Number(elevatorState.doorOpenByDeck?.[ridingDeck.id] ?? 0);
    const lockInsideCab =
      elevatorState.moving ||
      elevatorState.phase === 'door-closing' ||
      (elevatorState.phase === 'door-opening' && rideDoorOpen < 0.74);

    if (lockInsideCab) {
      if (isEyeOrProbe) {
        pos.y = Math.max(cabY + 0.32, Math.min(cabY + 2.22, pos.y));
        pos.x = Math.max(-0.82, Math.min(0.82, pos.x));
        pos.z = Math.max(-0.82, Math.min(0.82, pos.z));
      } else {
        pos.y = cabY;
        pos.x = Math.max(-0.72, Math.min(0.72, pos.x));
        pos.z = Math.max(-0.72, Math.min(0.72, pos.z));
      }
      return pos;
    }
  }

  // 3) Resolver cubierta activa con aislamiento estricto entre plantas fuera del ascensor
  let zone;
  if (elevatorState?.passengerRiding) {
    zone = getDeckZoneById(resolveCurrentDeck({ y: cabY }).id);
  } else if (options?.lockedDeckId && ZONE_BY_DECK_ID[options.lockedDeckId]) {
    zone = ZONE_BY_DECK_ID[options.lockedDeckId];
  } else if (options?.prevPos && Number.isFinite(options.prevPos.y)) {
    zone = inferDeckZoneFromY(options.prevPos.y);
  } else {
    zone = inferDeckZoneFromY(pos.y);
  }

  // 4) Interacción con la cabina estacionada en esta cubierta (entrar / permanecer / salir por ±Z)
  if (elevatorState) {
    const cabAtThisDeck = Math.abs(cabY - zone.floorY) < 0.30;
    const inCabFootprint = Math.abs(pos.x) < 1.15 && Math.abs(pos.z) < 1.15;
    if (cabAtThisDeck && inCabFootprint) {
      const doorOpen = Number(elevatorState.doorOpenByDeck?.[zone.id] ?? 0);
      const rEdge = isEyeOrProbe ? 0.14 : Math.min(0.28, radius * 0.65);
      if (isEyeOrProbe) {
        pos.y = Math.max(cabY + 0.28, Math.min(cabY + 2.24, pos.y));
      } else {
        pos.y = Math.max(cabY, Math.min(cabY + 0.48, pos.y));
      }
      pos.x = Math.max(-(0.90 - rEdge), Math.min(0.90 - rEdge, pos.x));
      if (doorOpen < 0.72) {
        pos.z = Math.max(-(0.86 - rEdge), Math.min(0.86 - rEdge, pos.z));
      } else {
        // Solo se permite cruzar el umbral ±Z por la apertura libre central de la puerta
        const maxDoorX = ELEVATOR_DOOR_CLEAR_HALF_WIDTH - rCol;
        if (Math.abs(pos.z) > 0.86 && Math.abs(pos.x) > maxDoorX) {
          pos.z = pos.z >= 0 ? 0.86 : -0.86;
        }
      }
      return pos;
    }
  }

  // 5) Límites verticales infranqueables de la cubierta (suelo firme + techo cerrado bajo losa superior)
  const maxFeetY = isEyeOrProbe ? zone.maxY : zone.floorY + ASTRONAUT_MAX_FEET_ABOVE_FLOOR;
  const minAllowedY = isEyeOrProbe ? zone.minY + 0.22 : zone.minY;
  pos.y = Math.max(minAllowedY, Math.min(maxFeetY, pos.y));

  // 6) Contorno y mobiliario sólido 1:1 de cada cubierta
  if (zone.id === 'deck-01') {
    pos.z = Math.max(-14.35 + pad * 0.4, Math.min(11.35 - pad * 0.4, pos.z));
    const maxX = Math.max(0.55, getBridgeHalfWidthAtZ(pos.z) - pad);
    pos.x = Math.max(-maxX, Math.min(maxX, pos.x));

    // Mesa holográfica (0, +6.0), consola de timón central (0, -10.68), puestos tácticos y chevrón frontal
    // La plataforma circular central en (0, -5.5) queda completamente libre y transitable con peldaños reales.
    pushOutCylinder2D(pos, 0.0, 6.0, 1.65 + rCol);
    const daisRadial = Math.hypot(pos.x, pos.z + 5.5);
    const daisStepY = daisRadial <= 2.56 ? 0.40 : daisRadial <= 3.12 ? 0.18 : 0.0;
    const daisMinY = (isEyeOrProbe ? zone.floorY + 0.18 : zone.floorY) + daisStepY;
    if (pos.y < daisMinY) {
      pos.y = Math.min(zone.maxY - 0.15, daisMinY);
    }
    if (!isEyeOrProbe || pos.y < zone.floorY + 1.38) {
      pushOutAABB2D(pos, 0.0, -10.68, 0.86 + rCol, 0.36 + rCol);
      for (let i = 0; i < C01_CHEVRON_OBSTACLES.length; i++) {
        const obs = C01_CHEVRON_OBSTACLES[i];
        pushOutOBB2D(
          pos,
          obs.deskCx,
          obs.deskCz,
          obs.ux,
          obs.uz,
          obs.vx,
          obs.vz,
          obs.hx + rCol,
          obs.hz + rCol
        );
        if (obs.chairCx !== null) {
          pushOutCylinder2D(pos, obs.chairCx, obs.chairCz, obs.chairRadius + rCol * 0.8);
        }
      }
    }
  } else {
    const rMax = Math.max(2.5, zone.radiusLimit - pad);
    const r = Math.hypot(pos.x, pos.z);
    if (r > rMax && r > 1e-4) {
      const k = rMax / r;
      pos.x *= k;
      pos.z *= k;
    }

    if (zone.id === 'deck-02') {
      // Dos barras curvas del comedor en ±X, dejando pasillos ±Z totalmente transitables hacia el ascensor
      if (!isEyeOrProbe || pos.y < zone.floorY + 1.25) {
        pushOutDiningSector2D(
          pos,
          1,
          C02_DINING_ARCS.rInner,
          C02_DINING_ARCS.rOuter,
          C02_DINING_ARCS.halfAngleRad,
          rCol
        );
        pushOutDiningSector2D(
          pos,
          -1,
          C02_DINING_ARCS.rInner,
          C02_DINING_ARCS.rOuter,
          C02_DINING_ARCS.halfAngleRad,
          rCol
        );
        for (let s = 0; s < C02_DINING_ARCS.stoolAnglesFromX.length; s++) {
          const ang = C02_DINING_ARCS.stoolAnglesFromX[s];
          const sx = C02_DINING_ARCS.stoolRadius * Math.cos(ang);
          const sz = C02_DINING_ARCS.stoolRadius * Math.sin(ang);
          pushOutCylinder2D(pos, sx, sz, 0.34 + rCol * 0.75);
          pushOutCylinder2D(pos, -sx, sz, 0.34 + rCol * 0.75);
        }
      }

      // 8 mamparos radiales sólidos (desfasados 22.5°) y mamparo de esclusa EVA a proa (0, -16.0)
      for (let i = 0; i < C02_BULKHEAD_ANGLES.length; i++) {
        pushOutRadialWall2D(pos, C02_BULKHEAD_ANGLES[i], 6.85 - rCol * 0.35, 17.8, 0.14 + rCol);
      }
      pushOutAABB2D(pos, 0.0, -16.0, 1.45 + rCol, 0.32 + rCol);

      // Taquilla EVA en camarote babor-proa (-5.95, -5.95) y armarios/literas de los 6 camarotes
      pushOutOBB2D(
        pos,
        -5.95,
        -5.95,
        Math.SQRT1_2,
        Math.SQRT1_2,
        -Math.SQRT1_2,
        Math.SQRT1_2,
        0.64 + rCol,
        0.38 + rCol
      );
      for (let b = 0; b < C02_CABIN_BAYS.length; b++) {
        const bay = C02_CABIN_BAYS[b];
        pushOutRadialOBB2D(pos, bay, 16.6, 0.34 + rCol, 0.76 + rCol);
        if (!isEyeOrProbe || pos.y < zone.floorY + 1.15) {
          pushOutRadialOBB2D(pos, bay, 14.1, 1.24 + rCol, 0.59 + rCol);
          pushOutRadialOBB2D(pos, bay, 13.0, 0.27 + rCol, 0.44 + rCol);
        }
      }

      // Bastidores biopónicos altos en bahía de popa (+Z)
      pushOutAABB2D(pos, -2.55, 11.4, 0.50 + rCol, 2.12 + rCol);
      pushOutAABB2D(pos, 2.55, 11.4, 0.50 + rCol, 2.12 + rCol);
    } else if (zone.id === 'deck-03') {
      // Reactor principal (0, +9.0), columnas refrigerantes (±4, +9) y tanques criogénicos (±6, -9)
      pushOutCylinder2D(pos, 0.0, 9.0, 2.58 + rCol);
      pushOutCylinder2D(pos, -4.0, 9.0, 0.36 + rCol);
      pushOutCylinder2D(pos, 4.0, 9.0, 0.36 + rCol);
      pushOutCylinder2D(pos, -6.0, -9.0, 1.42 + rCol);
      pushOutCylinder2D(pos, 6.0, -9.0, 1.42 + rCol);

      // 6 + 6 mesas curvas del laboratorio SPHEREx (babor) y Banco Óptico (estribor)
      if (!isEyeOrProbe || pos.y < zone.floorY + 1.38) {
        for (let i = 0; i < C03_LAB_ARCS.length; i++) {
          const arc = C03_LAB_ARCS[i];
          pushOutOBB2D(
            pos,
            arc.cx,
            arc.cz,
            arc.ux,
            arc.uz,
            arc.vx,
            arc.vz,
            arc.hx + rCol,
            arc.hz + rCol
          );
        }
      }
    } else if (zone.id === 'deck-04') {
      // Fuselaje, cono de proa extendido (-17.2) y alas del transbordador estacionado
      pushOutAABB2D(pos, 0.0, -11.5, 1.38 + rCol, 3.05 + rCol);
      pushOutAABB2D(pos, 0.0, -15.65, 0.98 + rCol, 1.56 + rCol);
      pushOutAABB2D(pos, 0.0, -11.0, 3.55 + rCol, 1.22 + rCol);

      // Contenedores ISO deterministas (doble altura bloquea también sonda de cámara)
      for (let i = 0; i < C04_CARGO_CONTAINERS.length; i++) {
        const b = C04_CARGO_CONTAINERS[i];
        if (b.double || !isEyeOrProbe || pos.y < zone.floorY + 1.56) {
          pushOutAABB2D(pos, b.cx, b.cz, b.hx + rCol, b.hz + rCol);
        }
      }

      // Banco y grúa de mantenimiento C04 (-7.8, +4.8)
      if (!isEyeOrProbe || pos.y < zone.floorY + 1.25) {
        pushOutAABB2D(pos, -7.8, 4.8, 1.12 + rCol, 0.88 + rCol);
      }
    }
  }

  // 7) Núcleo de ascensores, jambas, pedestales y puertas cerradas
  if (elevatorState) {
    const cabAtThisDeck = Math.abs(cabY - zone.floorY) < 0.30;
    const doorOpen = Number(elevatorState.doorOpenByDeck?.[zone.id] ?? 0);

    // Muros y jambas unificados del pozo central dejando el paso libre exacto del umbral (±0.82 m)
    pushOutAABB2D(pos, -1.21, 0.0, 0.39 + rCol, 1.56 + rCol);
    pushOutAABB2D(pos, 1.21, 0.0, 0.39 + rCol, 1.56 + rCol);

    // Barrera física sólida si la cabina NO está en esta cubierta o las hojas no terminaron de abrir
    if (!cabAtThisDeck || doorOpen < 0.72) {
      pushOutAABB2D(pos, 0.0, 0.0, 1.56 + rCol, 1.52 + rCol);
    }
  } else {
    pushOutAABB2D(pos, -1.21, 0.0, 0.39 + rCol, 1.56 + rCol);
    pushOutAABB2D(pos, 1.21, 0.0, 0.39 + rCol, 1.56 + rCol);
  }

  return pos;
}

/**
 * Encuentra la estación interactiva o terminal de ascensor más cercana dentro de distancia Y campo visual.
 */
export function findNearestInteractiveStation(position, overrideRange = null, options = null) {
  if (!position) return null;
  if (options?.exteriorMode) return null;

  const currentDeck = options?.lockedDeckId
    ? CABIN_DECKS.find((d) => d.id === options.lockedDeckId) || resolveCurrentDeck(position)
    : resolveCurrentDeck(position);
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
  'maintenance-light-c04',
  'bench-clamp-c04',
  'parts-tray-c04',
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
  if (interactId === 'maintenance-light-c04') {
    const on = mech.workLightActive !== false;
    return { id: interactId, direct: true, label: on ? 'Apagar lámpara articulada del banco' : 'Encender lámpara articulada del banco', actionLabel: on ? 'Apagar' : 'Encender' };
  }
  if (interactId === 'bench-clamp-c04') {
    const locked = Boolean(mech.benchClampLocked);
    return { id: interactId, direct: true, label: locked ? 'Liberar pieza de la mordaza' : 'Apretar mordaza del banco', actionLabel: locked ? 'Liberar' : 'Sujetar' };
  }
  if (interactId === 'parts-tray-c04') {
    const open = Boolean(mech.partsTrayOpen);
    return { id: interactId, direct: true, label: open ? 'Replegar bandeja de repuestos' : 'Extender bandeja de repuestos', actionLabel: open ? 'Replegar' : 'Extender' };
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
    return { id: interactId, direct: false, label: 'Botonera física C01–C04', actionLabel: 'Ver destinos' };
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
