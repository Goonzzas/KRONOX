import * as THREE from 'three';
import {
  CABIN_DECKS,
  HULL_INTERIOR_ZONES,
  SHIP_INTERIOR_STATIONS,
  INTERIOR_GRAB_RAILS,
  clampAstronautPosition,
  findNearestInteractiveStation,
  resolveCurrentDeck,
} from './kronoxInteriorSpatialModel.js';
import { createSharedInteriorPbrPalette } from './interiorAssets/pbrTexturesAndMaterials.js';
import { buildCommandBridgeSector3D } from './interiorAssets/bridgeArchitecture3D.js';
import { buildCentralSpineCorridor3D } from './interiorAssets/spineArchitecture3D.js';
import { buildScienceSectorPods3D } from './interiorAssets/labArchitecture3D.js';
import { buildHabitatDrums3D } from './interiorAssets/habitatArchitecture3D.js';
import { buildEngineeringSector3D } from './interiorAssets/engineeringArchitecture3D.js';

/**
 * Builds the unified, hull-conforming 120m interior of KRONOX (`1 unit = 1 meter`).
 * Every room, corridor, porthole, and reactor chamber sits strictly inside KronoxExteriorShip120m,
 * constructed from sculpted modular architectural assemblies and calibrated PBR materials.
 */
export function buildKronoxInterior120M() {
  const root = new THREE.Group();
  root.name = 'KronoxUnifiedInterior120M';

  const mats = createSharedInteriorPbrPalette();
  const consoles = [];
  const stationMeshes = [];
  const airlockDoors = [];

  const registerConsole = (entry) => {
    consoles.push(entry);
    stationMeshes.push(entry);
  };

  const bridgeParts = buildCommandBridgeSector3D(root, mats, registerConsole);
  buildCentralSpineCorridor3D(root, mats, airlockDoors);
  const scienceParts = buildScienceSectorPods3D(root, mats, registerConsole);
  buildHabitatDrums3D(root, mats, registerConsole);
  const engParts = buildEngineeringSector3D(root, mats, registerConsole);

  const deckContainers = {
    'deck-01': root.getObjectByName('Sector_Bridge_Deck01'),
    'deck-02': root.getObjectByName('Sector_SciencePods_Deck02'),
    'deck-03': root.getObjectByName('Sector_HabitatDrums_Deck03'),
    'deck-04': root.getObjectByName('Sector_Engineering_Deck04'),
  };

  let lastRepairStage = 0;

  function updateStations(
    elapsedTime = 0,
    nearestOrActiveId = null,
    activeStationId = null,
    focusedId = null,
    freeHelm = false,
    astronautPos = null,
    repairStage = null,
  ) {
    if (typeof repairStage === 'number') lastRepairStage = repairStage;

    // 1. Update console highlight/screen states
    for (const c of consoles) {
      const isActive = c.id === activeStationId || c.id === nearestOrActiveId;
      const isFocused = c.id === focusedId;
      const pulse = 0.65 + 0.35 * Math.sin(elapsedTime * 3.5);
      if (c.trimBarMat) {
        c.trimBarMat.emissiveIntensity = isActive ? 1.55 : isFocused ? 1.2 * pulse : 0.65;
      }
      if (c.floorBeacon?.material) {
        c.floorBeacon.material.opacity = isActive ? 0.55 : isFocused ? 0.42 * pulse : 0.16;
      }
      if (c.id === 'engineering') {
        c.updateScreen(
          'TOKAMAK ESTABLE · 98.4% FLUJO',
          ['ANILLO Z = +24.0 m · CONFINAMIENTO ACTIVO', 'CRIOGENIA He-II: 1.9 K NOMINAL', 'IMPULSO MPD: LISTO PARA TRÁNSITO'],
          elapsedTime,
        );
      } else if (c.id === 'science') {
        c.updateScreen(
          'ESPECTRÓMETRO SPHEREx ACTIVO',
          ['BANDAS 1–6: 0.75–5.0 μm SINCRONIZADAS', 'FUENTES: FITS IRSA CALIBRADOS', 'PULSA [E] PARA ABRIR LABORATORIO'],
          elapsedTime,
        );
      } else if (c.id === 'sensor-calibration') {
        c.updateScreen(
          `BANCO ÓPTICO · FASE REPARACIÓN ${lastRepairStage}/4`,
          ['ESPEJO PRIMARIO Au-Be EN ALINEACIÓN', 'RUEDA DICROICA IR OPERATIVA', 'PULSA [E] PARA INTERACTUAR EN VIVO'],
          elapsedTime,
        );
      } else if (c.id === 'nav' && freeHelm) {
        c.updateScreen(
          'TIMÓN LIBRE DE NAVEGACIÓN ACTIVO',
          ['CONTROL DIRECTO EN PROA (-Z)', 'EMPUJE WASD + ORIENTACIÓN', 'ESC PARA LIBERAR TIMÓN'],
          elapsedTime,
        );
      }
    }

    // 1b. Animate Bridge Astrometrics Star-Map Hologram gently above Helm console
    if (bridgeParts?.holoMapGroup) {
      bridgeParts.holoMapGroup.rotation.y = elapsedTime * 0.42;
    }

    // 2. Animate Starboard Optical Calibration Bench according to repair stage (0..4)
    if (scienceParts?.mirrorHousing && scienceParts?.filterWheel && scienceParts?.calibBeam) {
      const stageFrac = Math.max(0, Math.min(4, lastRepairStage));
      scienceParts.filterWheel.rotation.z = elapsedTime * (stageFrac >= 3 ? 1.8 : 0.35);
      scienceParts.mirrorHousing.rotation.x = stageFrac >= 2 && stageFrac < 4 ? -0.34 : Math.sin(elapsedTime * 0.5) * 0.04;
      scienceParts.calibBeam.material.opacity = stageFrac === 4 ? 0.92 : stageFrac >= 1 ? 0.48 : 0.18;
    }

    // 3. Animate Tokamak Plasma Torus & Magnetic Confinement Flux in Engineering (Deck 04)
    if (engParts?.tokamakGroup && engParts?.plasmaCore) {
      engParts.tokamakGroup.rotation.y = elapsedTime * 0.32;
      engParts.plasmaCore.rotation.z = elapsedTime * 1.1;
    }

    // 4. Proximity-driven animated iris bulkhead airlock doors along Central Spine
    const az = astronautPos?.z ?? -45.3;
    const ax = astronautPos?.x ?? 0;
    for (const door of airlockDoors) {
      const nearDoor = Math.abs(az - door.z) < 3.4 && Math.abs(ax - door.x) < 2.1;
      const target = nearDoor ? 1.0 : 0.0;
      door.openProgress += (target - door.openProgress) * 0.18;
      const slide = door.openProgress * door.halfW * 0.92;
      door.leafL.position.x = -door.halfW * 0.5 - slide;
      door.leafR.position.x = door.halfW * 0.5 + slide;
      door.statusMat.emissiveIntensity = nearDoor ? 1.4 : 0.45;
    }
  }

  return {
    root,
    cabinRoot: root,
    decks: CABIN_DECKS,
    deckContainers,
    interactiveStations: SHIP_INTERIOR_STATIONS,
    stationMeshes,
    grabRails: INTERIOR_GRAB_RAILS,
    zones: HULL_INTERIOR_ZONES,
    clampAstronautPosition,
    findNearestInteractiveStation,
    resolveCurrentDeck,
    updateStations,
  };
}
