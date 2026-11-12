import * as THREE from 'three';

/**
 * Spatial coordinate convention (matches approved KronoxExteriorShip120m in modularShipHull3D.js):
 * - 1 unit = 1.00 meter in KronoxLocalMetricWorld (`localShipScene`)
 * - -Z = Bow (Proa, nose cone tip at Z = -60.0m)
 * - +Z = Stern (Popa, main thruster cluster at Z = +60.0m)
 * - +Y = Dorsal (up), -Y = Ventral (down)
 * - -X = Port (Babor), +X = Starboard (Estribor)
 */

export const ASTRONAUT_HEIGHT_METERS = 1.75;
export const ASTRONAUT_EYE_METERS = 1.65;
export const ASTRONAUT_RADIUS_METERS = 0.36;

export const CABIN_DECKS = Object.freeze([
  {
    id: 'deck-01',
    deckNumber: 1,
    name: 'Puente de Mando y Mirador de Proa',
    elevationY: -1.6,
    ceilingY: 3.1,
    zRange: [-51.4, -42.0],
    color: '#38bdf8',
    description: 'Timón orbital, mirador panorámico de proa, KRONOX IA y tablero de campaña.',
  },
  {
    id: 'deck-02',
    deckNumber: 2,
    name: 'Cubierta Científica SPHEREx y Banco Óptico',
    elevationY: -1.55,
    ceilingY: 2.05,
    zRange: [-37.2, -20.8],
    color: '#34d399',
    description: 'Criostato SPHEREx en babor, banco óptico reparable en estribor y cúpula dorsal.',
  },
  {
    id: 'deck-03',
    deckNumber: 3,
    name: 'Cubierta de Habitabilidad y Esclusa EVA',
    elevationY: -1.75,
    ceilingY: 2.2,
    zRange: [-13.2, 7.2],
    color: '#f59e0b',
    description: 'Tambores presurizados con ojos de buey, literas, botánica y esclusa ventral EVA.',
  },
  {
    id: 'deck-04',
    deckNumber: 4,
    name: 'Cubierta de Ingeniería y Reactor Tokamak',
    elevationY: -0.25,
    ceilingY: 4.15,
    zRange: [12.5, 40.2],
    color: '#fb7185',
    description: 'Pasarela superior, núcleo de confinamiento Tokamak (Z=+24 m) y bahía MPD.',
  },
]);

/**
 * Strict hull-conforming interior zone bounds (guaranteed >= 0.25m clearance inside modularShipHull3D.js).
 */
export const HULL_INTERIOR_ZONES = Object.freeze({
  bridgeMain: { minX: -4.25, maxX: 4.25, minY: -1.6, maxY: 3.1, minZ: -48.6, maxZ: -42.0 },
  bridgeProw: { centerY: 0.2, radiusBase: 3.6, minY: -1.35, maxY: 2.6, minZ: -51.2, maxZ: -48.4 },
  spineCorridor: { minX: -1.42, maxX: 1.42, minY: -1.55, maxY: 1.42, minZ: -42.2, maxZ: 12.6 },
  scienceCrosswalk: { minX: -4.1, maxX: 4.1, minY: -1.55, maxY: 1.32, minZ: -30.1, maxZ: -27.9 },
  sciencePortPod: { centerX: -5.6, radius: 2.08, minY: -1.55, maxY: 1.98, minZ: -37.0, maxZ: -21.0 },
  scienceStarboardPod: { centerX: 5.6, radius: 2.08, minY: -1.55, maxY: 1.98, minZ: -37.0, maxZ: -21.0 },
  dorsalCupolaShaft: { minX: -1.12, maxX: 1.12, minY: 1.0, maxY: 3.55, minZ: -27.2, maxZ: -24.8 },
  habitatCrosswalkBow: { minX: -3.2, maxX: 3.2, minY: -1.7, maxY: 1.35, minZ: -7.2, maxZ: -4.8 },
  habitatCrosswalkAft: { minX: -3.2, maxX: 3.2, minY: -1.7, maxY: 1.35, minZ: 1.3, maxZ: 3.7 },
  habitatPortDrum: { centerX: -6.2, radius: 3.55, minY: -1.75, maxY: 2.35, minZ: -13.1, maxZ: 7.1 },
  habitatStarboardDrum: { centerX: 6.2, radius: 3.55, minY: -1.75, maxY: 2.35, minZ: -13.1, maxZ: 7.1 },
  ventralAirlockShaft: { minX: -1.25, maxX: 1.25, minY: -4.2, maxY: -1.0, minZ: -7.5, maxZ: -4.5 },
  engineeringMain: { centerX: 0.0, radius: 4.35, minY: -0.25, maxY: 4.05, minZ: 12.5, maxZ: 39.8 },
  engineeringShaft: { minX: -1.25, maxX: 1.25, minY: -3.25, maxY: 0.25, minZ: 15.1, maxZ: 18.1 },
  engineeringLower: { centerX: 0.0, radius: 3.15, minY: -3.25, maxY: -0.65, minZ: 13.0, maxZ: 31.0 },
  spineToEngRamp: { minX: -1.32, maxX: 1.32, minY: -1.45, maxY: 1.4, minZ: 9.6, maxZ: 12.9 },
});

/**
 * Canonical interactive 3D consoles and stations mounted strictly inside the 120m hull.
 */
export const SHIP_INTERIOR_STATIONS = Object.freeze([
  {
    id: 'windows',
    deckLevel: 1,
    zoneLabel: 'CUBIERTA 01 · MIRADOR PANORÁMICO DE PROA (Z -50.6 m)',
    label: 'Mirador Panorámico de Proa',
    description: 'Ventana espacial principal orientada en rumbo -Z con retícula 3D de blancos.',
    position: { x: 0.0, y: -1.6, z: -49.1 },
    consolePos: { x: 0.0, y: -0.45, z: -50.5 },
    aiHoverPos: { x: 1.15, y: 0.15, z: -49.4 },
    colliderRadius: 0.55,
    accent: '#38bdf8',
  },
  {
    id: 'nav',
    deckLevel: 1,
    zoneLabel: 'CUBIERTA 01 · TIMÓN Y NAVEGACIÓN ORBITAL (Z -46.8 m)',
    label: 'Consola de Navegación y Propulsión',
    description: 'Pupitre curvo de vuelo con holograma estelar 3D, selector de destinos y timón.',
    position: { x: 0.0, y: -1.6, z: -45.3 },
    consolePos: { x: 0.0, y: -0.58, z: -46.8 },
    aiHoverPos: { x: 1.25, y: 0.15, z: -46.1 },
    colliderRadius: 0.85,
    accent: '#6ff0ff',
  },
  {
    id: 'comms',
    deckLevel: 1,
    zoneLabel: 'CUBIERTA 01 · NÚCLEO KRONOX IA (X -3.2 m, Z -45.2 m)',
    label: 'Estación Cuántica KRONOX IA',
    description: 'Pedestal de enlace neuronal con KRONOX IA, bitácora y recorrido guiado.',
    position: { x: -2.05, y: -1.6, z: -45.2 },
    consolePos: { x: -3.25, y: -0.55, z: -45.2 },
    aiHoverPos: { x: -2.15, y: 0.25, z: -44.2 },
    colliderRadius: 0.72,
    accent: '#38bdf8',
  },
  {
    id: 'missions',
    deckLevel: 1,
    zoneLabel: 'CUBIERTA 01 · TABLERO DE CAMPAÑA (X +3.2 m, Z -45.2 m)',
    label: 'Consola Táctica de Misiones',
    description: 'Selector de expediciones astronómicas, inventario técnico y progreso.',
    position: { x: 2.05, y: -1.6, z: -45.2 },
    consolePos: { x: 3.25, y: -0.55, z: -45.2 },
    aiHoverPos: { x: 2.15, y: 0.25, z: -44.2 },
    colliderRadius: 0.72,
    accent: '#fbbf24',
  },
  {
    id: 'science',
    deckLevel: 2,
    zoneLabel: 'CUBIERTA 02 · VAINA BABOR SPHEREx (X -5.6 m, Z -32.2 m)',
    label: 'Laboratorio Espectroscopía SPHEREx',
    description: 'Criostato real NASA SPHEREx (0.75–5.0 μm) y análisis fotométrico de FITS.',
    position: { x: -5.6, y: -1.55, z: -30.5 },
    consolePos: { x: -5.6, y: -0.52, z: -32.2 },
    aiHoverPos: { x: -4.45, y: 0.2, z: -31.2 },
    colliderRadius: 0.85,
    accent: '#34d399',
  },
  {
    id: 'sensor-calibration',
    deckLevel: 2,
    zoneLabel: 'CUBIERTA 02 · VAINA ESTRIBOR ÓPTICA (X +5.6 m, Z -30.5 m)',
    label: 'Banco Óptico de Calibración (4 Fases)',
    description: 'Conjunto espejo/dicroico infrarrojo para escaneo, desmontaje, repuesto y calibración.',
    position: { x: 5.6, y: -1.55, z: -28.8 },
    consolePos: { x: 5.6, y: -0.52, z: -30.5 },
    aiHoverPos: { x: 4.45, y: 0.2, z: -29.8 },
    colliderRadius: 0.88,
    accent: '#10b981',
  },
  {
    id: 'archive',
    deckLevel: 2,
    zoneLabel: 'CUBIERTA 02 · CÚPULA DORSAL (Y +1.55 m, Z -26.0 m)',
    label: 'Cúpula Dorsal de Archivo Estelar',
    description: 'Bóveda superior de catalogación astronómica y registro de hallazgos.',
    position: { x: 0.0, y: 1.65, z: -25.1 },
    consolePos: { x: 0.0, y: 2.35, z: -26.2 },
    aiHoverPos: { x: 0.72, y: 2.75, z: -25.6 },
    colliderRadius: 0.62,
    accent: '#60a5fa',
  },
  {
    id: 'galley',
    deckLevel: 3,
    zoneLabel: 'CUBIERTA 03 · TAMBOR HABITACIONAL BABOR (X -6.2 m, Z -5.8 m)',
    label: 'Estación de Habitabilidad e Hidratación',
    description: 'Módulo residencial cero-G con literas presurizadas, cocina y soporte vital.',
    position: { x: -5.0, y: -1.75, z: -5.8 },
    consolePos: { x: -6.25, y: -0.72, z: -5.8 },
    aiHoverPos: { x: -4.9, y: 0.15, z: -4.7 },
    colliderRadius: 0.78,
    accent: '#f59e0b',
  },
  {
    id: 'airlock',
    deckLevel: 3,
    zoneLabel: 'CUBIERTA 03 · ESCLUSA VENTRAL EVA (Y -4.2 m, Z -6.0 m)',
    label: 'Esclusa Ventral EVA y Bahía de Trajes',
    description: 'Cámara de despresurización inferior con soportes de trajes orbitales.',
    position: { x: 0.0, y: -4.2, z: -5.4 },
    consolePos: { x: 0.0, y: -3.2, z: -6.8 },
    aiHoverPos: { x: 0.75, y: -2.4, z: -5.8 },
    colliderRadius: 0.65,
    accent: '#ef4444',
  },
  {
    id: 'engineering',
    deckLevel: 4,
    zoneLabel: 'CUBIERTA 04 · REACTOR TOKAMAK POPA (Z +21.6 m)',
    label: 'Control de Reactor Tokamak e Impulso MPD',
    description: 'Visor blindado del anillo toroidal de confinamiento y bucle criogénico He.',
    position: { x: 0.0, y: -0.25, z: 19.9 },
    consolePos: { x: 0.0, y: 0.75, z: 21.6 },
    aiHoverPos: { x: 1.25, y: 1.45, z: 20.6 },
    colliderRadius: 0.9,
    accent: '#fb7185',
  },
]);

export const INTERIOR_GRAB_RAILS = Object.freeze([
  { id: 'rail-bridge-port', pos: [-3.4, -0.35, -45.2], span: 5.0 },
  { id: 'rail-bridge-stbd', pos: [3.4, -0.35, -45.2], span: 5.0 },
  { id: 'rail-spine-fore', pos: [-1.25, 0.0, -34.0], span: 12.0 },
  { id: 'rail-spine-mid', pos: [1.25, 0.0, -18.0], span: 16.0 },
  { id: 'rail-spine-aft', pos: [-1.25, 0.0, 2.0], span: 14.0 },
  { id: 'rail-science-port', pos: [-3.8, -0.45, -29.0], span: 10.0 },
  { id: 'rail-science-stbd', pos: [3.8, -0.45, -29.0], span: 10.0 },
  { id: 'rail-ventral-shaft', pos: [1.05, -2.6, -6.0], span: 2.6 },
  { id: 'rail-eng-shaft', pos: [1.05, -1.8, 16.5], span: 3.4 },
]);

function clampBox(pos, box, r, h) {
  const cx = Math.max(box.minX + r, Math.min(box.maxX - r, pos.x));
  const cy = Math.max(box.minY, Math.min(box.maxY - h, pos.y));
  const cz = Math.max(box.minZ + r, Math.min(box.maxZ - r, pos.z));
  return new THREE.Vector3(cx, cy, cz);
}

function clampCylX(pos, cyl, r, h) {
  const cz = Math.max(cyl.minZ + r, Math.min(cyl.maxZ - r, pos.z));
  const dx = pos.x - cyl.centerX;
  const maxDx = Math.max(0.2, Math.sqrt(Math.max(0.09, cyl.radius * cyl.radius - 0.15)) - r);
  const cx = cyl.centerX + Math.max(-maxDx, Math.min(maxDx, dx));
  const distFrac = Math.min(1, Math.abs(cx - cyl.centerX) / Math.max(0.5, cyl.radius));
  const localMaxY = cyl.maxY - distFrac * distFrac * 0.55;
  const cy = Math.max(cyl.minY, Math.min(localMaxY - h, pos.y));
  return new THREE.Vector3(cx, cy, cz);
}

function clampProwCone(pos, r, h) {
  const z = Math.max(
    HULL_INTERIOR_ZONES.bridgeProw.minZ + r,
    Math.min(HULL_INTERIOR_ZONES.bridgeProw.maxZ, pos.z),
  );
  const t = Math.max(0, Math.min(1, (-48.4 - z) / 2.8));
  const halfW = 3.65 - t * 1.65;
  const cx = Math.max(-halfW + r, Math.min(halfW - r, pos.x));
  const cy = Math.max(-1.6, Math.min(2.65 - t * 0.4 - h, pos.y));
  return new THREE.Vector3(cx, cy, z);
}

/**
 * Exact 3D union containment inside the 120m approved hull interior volume.
 * Evaluates all connected zones and projects any outside coordinate to the nearest valid interior point.
 */
export function clampAstronautPosition(pos, astronautHeight = 1.65, radius = ASTRONAUT_RADIUS_METERS) {
  if (!pos) return pos;
  const z = HULL_INTERIOR_ZONES;
  const headClear = Math.max(0.4, Math.min(1.68, astronautHeight));
  const candidates = [
    clampBox(pos, z.bridgeMain, radius, headClear),
    clampProwCone(pos, radius, headClear),
    clampBox(pos, z.spineCorridor, radius, headClear * 0.65),
    clampBox(pos, z.scienceCrosswalk, radius, headClear * 0.65),
    clampCylX(pos, z.sciencePortPod, radius, headClear * 0.8),
    clampCylX(pos, z.scienceStarboardPod, radius, headClear * 0.8),
    clampBox(pos, z.dorsalCupolaShaft, radius, 0.85),
    clampBox(pos, z.habitatCrosswalkBow, radius, headClear * 0.72),
    clampBox(pos, z.habitatCrosswalkAft, radius, headClear * 0.72),
    clampCylX(pos, z.habitatPortDrum, radius, headClear * 0.85),
    clampCylX(pos, z.habitatStarboardDrum, radius, headClear * 0.85),
    clampBox(pos, z.ventralAirlockShaft, radius, 0.9),
    clampCylX(pos, z.engineeringMain, radius, headClear * 0.88),
    clampBox(pos, z.spineToEngRamp, radius, headClear * 0.65),
    clampBox(pos, z.engineeringShaft, radius, 0.9),
    clampCylX(pos, z.engineeringLower, radius, headClear * 0.75),
  ];

  const cur = new THREE.Vector3(pos.x || 0, pos.y || 0, pos.z || 0);
  let best = candidates[0];
  let bestDistSq = cur.distanceToSquared(best);
  for (let i = 1; i < candidates.length; i++) {
    const dSq = cur.distanceToSquared(candidates[i]);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = candidates[i];
    }
  }

  pos.x = best.x;
  pos.y = best.y;
  pos.z = best.z;

  // Solid radial collision pushback around physical console pedestals
  for (const st of SHIP_INTERIOR_STATIONS) {
    if (st.id === 'windows') continue;
    if (Math.abs(pos.y - st.position.y) > 1.8) continue;
    const dx = pos.x - st.consolePos.x;
    const dz = pos.z - st.consolePos.z;
    const minDist = st.colliderRadius + radius * 0.85;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist) {
      const dist = Math.max(0.001, Math.sqrt(distSq));
      pos.x = st.consolePos.x + (dx / dist) * minDist;
      pos.z = st.consolePos.z + (dz / dist) * minDist;
    }
  }

  return pos;
}

/**
 * Finds the closest interactive station within range (2.65m default).
 */
export function findNearestInteractiveStation(astronautPos, maxDistMeters = 2.65) {
  if (!astronautPos) return null;
  let nearest = null;
  let bestDist = Infinity;

  for (const st of SHIP_INTERIOR_STATIONS) {
    const dx = (astronautPos.x || 0) - st.position.x;
    const dy = (astronautPos.y || 0) - st.position.y;
    const dz = (astronautPos.z || 0) - st.position.z;
    const dist = Math.hypot(dx, dy * 0.65, dz);
    if (dist <= maxDistMeters && dist < bestDist) {
      bestDist = dist;
      nearest = {
        ...st,
        station: st,
        distance: Number(dist.toFixed(2)),
      };
    }
  }
  return nearest;
}

/**
 * Determines which of the 4 decks/sectors the astronaut is currently occupying.
 */
export function resolveCurrentDeck(astronautPos) {
  if (!astronautPos) return CABIN_DECKS[0];
  const z = astronautPos.z ?? -45.3;
  if (z <= -40.5) return CABIN_DECKS[0];
  if (z <= -19.5) return CABIN_DECKS[1];
  if (z <= 10.5) return CABIN_DECKS[2];
  return CABIN_DECKS[3];
}
