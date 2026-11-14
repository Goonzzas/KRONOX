import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildModularShip120M, SHIP_METRIC_DIMENSIONS } from '../src/scene/modularShipHull3D.js';
import {
  buildFourDecksInterior3D,
  CABIN_DECKS,
  HULL_INTERIOR_ZONES,
  SHIP_INTERIOR_STATIONS,
} from '../src/scene/fourDecksInterior3D.js';
import { createAstronautCharacter3D, ASTRONAUT_ANIMATION_STATES } from '../src/scene/astronautCharacter3D.js';
import { createMicrogravityPhysicsController, MICROGRAVITY_MODES } from '../src/scene/microgravityPhysicsController.js';
import {
  loadPlayerInventory,
  addInventoryItem,
  removeInventoryItem,
  hasInventoryItem,
  equipInventoryItem,
  INITIAL_INVENTORY_ITEMS,
} from '../src/utils/playerInventory.js';
import {
  GAME_ACHIEVEMENTS,
  unlockGameAchievement,
  isGameAchievementUnlocked,
  getGameAchievementsStatus,
} from '../src/utils/gameAchievements.js';
import {
  CAMPAIGN_LEVELS,
  loadExplorerProfile,
  saveExplorerProfile,
  getCampaignProgress,
  completeCampaignLevel,
} from '../src/state/campaignState.js';
import {
  createAsteroidBeltVisuals,
  ASTEROID_TAXONOMY,
  MAJOR_ASTEROIDS,
} from '../src/scene/asteroidBeltVisuals.js';
import {
  createNaturalGalaxySky,
  CELESTIAL_CATALOG_TARGETS,
} from '../src/scene/naturalGalaxySky.js';

test('KRONOX RECONSTRUCCIÓN INTEGRAL — Casco Modular de 120 Metros y PBR', () => {
  const shipData = buildModularShip120M();
  assert.ok(shipData.root instanceof THREE.Group, 'La nave modular debe retornar un grupo Three.js');
  assert.equal(shipData.dimensions.LENGTH_METERS, 120.0, 'Longitud física de referencia debe ser exactamente 120.0 m');
  assert.equal(shipData.dimensions.RADIATOR_BEAM_METERS, 58.24, 'Envergadura exterior Aurora-120 con anillos atómicos debe ser 58.24 m');
  assert.equal(shipData.dimensions.DECK_COUNT, 4, 'La nave debe soportar 4 cubiertas operativas');

  // Verificar módulos semánticos
  assert.ok(shipData.commandModule, 'Módulo de mando y navegación');
  assert.ok(shipData.structuralSpine, 'Espina dorsal y celosía estructural');
  assert.ok(shipData.scienceModules, 'Módulos científicos presurizados e infrarrojos');
  assert.ok(shipData.habitatModule, 'Módulo de habitabilidad y tambores');
  assert.ok(shipData.engineeringModule, 'Módulo de ingeniería y reactor tokamak');
  assert.ok(shipData.radiatorArrays, 'Paneles radiadores de grafeno');
  assert.ok(shipData.engineCluster, 'Cluster de propulsión de 3 toberas MPD + RCS');
  assert.ok(shipData.antennaGroup, 'Antena parabólica orientable de alta ganancia');

  // Calcular caja envolvente del casco modular
  shipData.root.updateMatrixWorld(true);
  const bbox = new THREE.Box3();
  shipData.root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || obj.userData?.isPlume || obj.userData?.isWarpBubble) return;
    bbox.expandByObject(obj);
  });
  const size = bbox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.z - 120.0) < 2.0, `Longitud real en Z debe aproximar 120 m (obtenido: ${size.z.toFixed(2)})`);
  assert.ok(size.x >= 28.0, `Anchura con radiadores debe ser al menos 28 m (obtenido: ${size.x.toFixed(2)})`);

  // Animación del cluster de motores y antena
  assert.doesNotThrow(() => {
    shipData.update(0.016, 0.8);
  }, 'La actualización de telemetría y plumas no debe fallar');
});

test('KRONOX RECONSTRUCCIÓN INTEGRAL — Interior Completo de 4 Cubiertas Conectadas dentro del Casco de 120m', () => {
  const shipData = buildModularShip120M();
  const interior = buildFourDecksInterior3D();
  assert.ok(interior.root instanceof THREE.Group);
  assert.equal(CABIN_DECKS.length, 4, 'Debe haber exactamente 4 cubiertas habitables');

  // Elevaciones verticales apiladas dentro de la esfera central R = 20 m de Aurora-120
  assert.equal(CABIN_DECKS[0].elevationY, 3.4, 'Cubierta 01 en Y = +3.4 m (Puente de Mando en punta de flecha)');
  assert.equal(CABIN_DECKS[1].elevationY, 0.0, 'Cubierta 02 en Y = 0.0 m (Habitacional · 8 camarotes radiales)');
  assert.equal(CABIN_DECKS[2].elevationY, -3.4, 'Cubierta 03 en Y = -3.4 m (Ingeniería y Laboratorio SPHEREx)');
  assert.equal(CABIN_DECKS[3].elevationY, -6.8, 'Cubierta 04 en Y = -6.8 m (Bodega y Hangar de Proa)');

  // Contención geométrica estricta dentro de la esfera habitable R = 20 m
  const interiorBbox = new THREE.Box3().setFromObject(interior.root);
  assert.ok(interiorBbox.min.z >= -21.0 && interiorBbox.max.z <= 21.0, `Interior en Z debe mantenerse dentro de la esfera R=20 m ([-21.0, 21.0], obtenido [${interiorBbox.min.z.toFixed(2)}, ${interiorBbox.max.z.toFixed(2)}])`);
  assert.ok(interiorBbox.min.x >= -21.0 && interiorBbox.max.x <= 21.0, `Interior en X debe mantenerse dentro de la esfera R=20 m ([-21.0, 21.0], obtenido [${interiorBbox.min.x.toFixed(2)}, ${interiorBbox.max.x.toFixed(2)}])`);
  assert.ok(interiorBbox.min.y >= -7.6 && interiorBbox.max.y <= 7.6, `Interior en Y debe mantenerse dentro de la esfera R=20 m ([-7.6, 7.6], obtenido [${interiorBbox.min.y.toFixed(2)}, ${interiorBbox.max.y.toFixed(2)}])`);
  assert.ok(SHIP_INTERIOR_STATIONS.length >= 10, 'Las 4 cubiertas deben alojar estaciones diegéticas distribuidas');

  // Estaciones interactivas principales
  const sciStation = interior.interactiveStations.find((s) => s.id === 'sensor-calibration');
  assert.ok(sciStation, 'Estación de calibración óptica SPHEREx en Cubierta 03');
  assert.equal(sciStation.deckLevel, 3);

  // Colisiones de microgravedad dentro del puente (C01) y tránsito vertical por núcleo central (0, Y, 0)
  const testPosInsideDeck1 = new THREE.Vector3(0, 3.4, -10.4);
  interior.clampAstronautPosition(testPosInsideDeck1);
  assert.ok(testPosInsideDeck1.y >= HULL_INTERIOR_ZONES.bridgeMain.minY && testPosInsideDeck1.y <= HULL_INTERIOR_ZONES.bridgeMain.maxY);

  // En el núcleo central de ascensores (X = 0, Z = 0), permite tránsito vertical continuo entre cubiertas
  const testPosInShaftMid = new THREE.Vector3(0, 1.2, 0);
  interior.clampAstronautPosition(testPosInShaftMid);
  assert.equal(testPosInShaftMid.y, 1.2, 'El núcleo central permite flotar en microgravedad entre cubiertas');

  // Descenso por el núcleo central hacia Cubierta 03 / 04
  const testPosInShaftLow = new THREE.Vector3(0, -4.5, 0);
  interior.clampAstronautPosition(testPosInShaftLow);
  assert.equal(testPosInShaftLow.y, -4.5, 'El núcleo central permite tránsito vertical completo hasta Bodega');

  // Buscar estación interactiva cercana en Banco Óptico de Cubierta 03 (Estribor X = +13.4, Y = -3.4, Z = 0)
  const nearest = interior.findNearestInteractiveStation(new THREE.Vector3(12.8, -3.4, 0.2));
  assert.ok(nearest);
  assert.equal(nearest.id, 'sensor-calibration');
  assert.ok(shipData.root instanceof THREE.Group);
});

test('KRONOX RECONSTRUCCIÓN INTEGRAL — Astronauta 3D Articulado y 8 Estados de Animación', () => {
  const astronaut = createAstronautCharacter3D();
  assert.ok(astronaut.root instanceof THREE.Group);
  assert.ok(astronaut.torso);
  assert.ok(astronaut.helmetMesh);
  assert.ok(astronaut.visorMesh);
  assert.ok(astronaut.backpack);

  // Verificar estados de animación
  const states = Object.keys(ASTRONAUT_ANIMATION_STATES);
  assert.equal(states.length, 8, 'Debe implementar 8 estados de animación procedural');
  assert.ok(states.includes('IDLE_FLOAT'));
  assert.ok(states.includes('HAND_PUSH'));
  assert.ok(states.includes('THRUSTER_BURST'));
  assert.ok(states.includes('GRAB_RAIL'));
  assert.ok(states.includes('STABILIZE'));
  assert.ok(states.includes('CONSOLE_WORK'));
  assert.ok(states.includes('REPAIR_INTERACT'));
  assert.ok(states.includes('CORRIDOR_SWIM'));

  // Aplicar animación
  astronaut.setState(ASTRONAUT_ANIMATION_STATES.THRUSTER_BURST);
  astronaut.updateAnimation(0.016);
  assert.equal(astronaut.getState(), 'THRUSTER_BURST');

  astronaut.setState(ASTRONAUT_ANIMATION_STATES.REPAIR_INTERACT);
  astronaut.updateAnimation(0.016);
  assert.equal(astronaut.getState(), 'REPAIR_INTERACT');
});

test('KRONOX RECONSTRUCCIÓN INTEGRAL — Motor Físico 6-DOF de Microgravedad', () => {
  const controller = createMicrogravityPhysicsController({
    initialPosition: new THREE.Vector3(0, 3.4, -20.0),
    mode: MICROGRAVITY_MODES.ASSISTED,
  });

  assert.equal(controller.getMode(), 'ASSISTED');
  assert.equal(controller.getSpeed(), 0);

  // Impulso hacia adelante (tecla W)
  const res1 = controller.update(0.1, { w: 1 }, new THREE.Quaternion());
  assert.ok(res1.speed > 0, 'Debe acelerar con W');
  assert.ok(res1.velocity.z < 0, 'W debe generar impulso hacia -Z (adelante)');

  // Freno activo de posición (tecla X)
  const res2 = controller.update(0.5, { x: 1 });
  assert.ok(res2.isStabilizing, 'X debe activar los estabilizadores');
  assert.ok(res2.speed < res1.speed, 'La velocidad debe decaer activamente');

  // Anclaje a pasamanos (tecla E)
  controller.toggleAnchor('rail-nav-01');
  assert.ok(controller.isAnchored(), 'Debe anclarse rígidamente a la estructura');
  const res3 = controller.update(0.1, { w: 1 });
  assert.equal(res3.speed, 0, 'Anclado no debe moverse con teclas');

  controller.toggleAnchor();
  assert.ok(!controller.isAnchored());

  // Modo Libre (inercia newtoniana)
  controller.setMode(MICROGRAVITY_MODES.FREE);
  assert.equal(controller.getMode(), 'FREE');
});

test('KRONOX RECONSTRUCCIÓN INTEGRAL — Inventario Funcional y Logros Científicos', () => {
  // Inventario
  assert.equal(INITIAL_INVENTORY_ITEMS.length, 6, 'El inventario inicial contiene 6 herramientas y piezas de servicio');
  const inv = loadPlayerInventory();
  assert.ok(inv.length >= 6);
  assert.ok(hasInventoryItem('multitool'));
  assert.ok(hasInventoryItem('optical-coupler'));

  equipInventoryItem('multitool');
  assert.ok(hasInventoryItem('multitool'));

  // Logros científicos
  assert.equal(GAME_ACHIEVEMENTS.length, 10, 'Debe haber 10 logros científicos');
  assert.ok(!isGameAchievementUnlocked('ACH_ONBOARD_TECH'));

  const unlocked = unlockGameAchievement('ACH_ONBOARD_TECH');
  assert.ok(unlocked);
  assert.ok(isGameAchievementUnlocked('ACH_ONBOARD_TECH'));

  const status = getGameAchievementsStatus();
  assert.ok(status.unlockedCount >= 1);
  assert.equal(status.totalCount, 10);
});

test('KRONOX RECONSTRUCCIÓN INTEGRAL — Campaña Narrativa y Perfil de Explorador', () => {
  assert.equal(CAMPAIGN_LEVELS.length, 8, 'Prólogo + 7 Niveles de Campaña');
  assert.equal(CAMPAIGN_LEVELS[0].id, 'prologue');
  assert.equal(CAMPAIGN_LEVELS[1].id, 'level-01');

  // Perfil
  saveExplorerProfile({ alias: 'Comandante Nova', skillLevel: 'Avanzado' });
  const profile = loadExplorerProfile();
  assert.equal(profile.alias, 'Comandante Nova');
  assert.equal(profile.skillLevel, 'Avanzado');

  // Progresión
  completeCampaignLevel('prologue');
  const prog = getCampaignProgress();
  assert.ok(prog.completedLevels.includes('prologue'));
  assert.equal(prog.currentLevelId, 'level-01');
});

test('KRONOX RECONSTRUCCIÓN INTEGRAL — Cinturón de Asteroides Realista y Taxonomía', () => {
  assert.ok(ASTEROID_TAXONOMY.ASTEROID);
  assert.ok(ASTEROID_TAXONOMY.METEOROID);
  assert.ok(ASTEROID_TAXONOMY.METEOR);
  assert.ok(ASTEROID_TAXONOMY.METEORITE);

  assert.equal(MAJOR_ASTEROIDS.length, 4, 'Ceres, Vesta, Pallas, Hygiea');
  assert.ok(MAJOR_ASTEROIDS.some((a) => a.name === 'Ceres' && a.radiusKm === 473.0));

  const testScene = new THREE.Scene();
  const belt = createAsteroidBeltVisuals({
    scene: testScene,
    auScaleFn: (au) => au * 100,
  });

  assert.ok(belt.root instanceof THREE.Group);
  assert.ok(belt.instancedMesh instanceof THREE.InstancedMesh);
  assert.equal(belt.instancedMesh.count, 900);

  assert.doesNotThrow(() => {
    belt.update(100.0, (au) => au * 100);
  });
});

test('KRONOX RECONSTRUCCIÓN INTEGRAL — Bóveda Celeste Natural y Raycaster de Retícula', () => {
  assert.ok(CELESTIAL_CATALOG_TARGETS.length >= 6);
  assert.ok(CELESTIAL_CATALOG_TARGETS.some((t) => t.key === 'jupiter'));
  assert.ok(CELESTIAL_CATALOG_TARGETS.some((t) => t.key === 'barnard'));
  assert.ok(CELESTIAL_CATALOG_TARGETS.some((t) => t.key === 'm31'));

  const sky = createNaturalGalaxySky();
  assert.ok(sky.root instanceof THREE.Group);
  assert.ok(sky.skyDome instanceof THREE.Mesh);

  // Probar identificación bajo retícula apuntando hacia Júpiter
  const mockCam = new THREE.PerspectiveCamera();
  const jupTarget = CELESTIAL_CATALOG_TARGETS.find((t) => t.key === 'jupiter');
  mockCam.lookAt(jupTarget.direction);

  const identified = sky.identifyTargetUnderCrosshair(mockCam, 5.0);
  assert.ok(identified);
  assert.equal(identified.key, 'jupiter');
  assert.equal(identified.name, 'Júpiter');
});
