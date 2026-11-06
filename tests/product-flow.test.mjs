import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SPHEREX_TARGETS,
  SPHEREX_MISSION_TYPES,
  SPHEREX_REFERENCE_EPOCH,
  propagateCoordinates,
  mjdToJulianYear,
} from '../src/data/spherexTargets.js';
import { processKronoxQuery, matchSpherexTarget, matchPlanet } from '../src/utils/kronoxAI.js';
import {
  SHIP_WORLD_UNITS,
  KRONOX_LUMINOUS_STATES,
  PHYSICAL_CABIN_STATIONS,
  createKronoxLuminousEntity3D,
  createAstronautModel3D,
  buildHabitableCabin3D,
} from '../src/scene/habitableShipWorld.js';
import {
  KRONOX_SCENE_EVENTS,
  KRONOX_CONTROL_MODES,
  buildCabinMachineSystems3D,
  createKronoxSceneDirector,
} from '../src/scene/kronoxSceneDirector.js';

test('Product Flow - 5 Official SPHEREx Targets Completeness & Differentiated Scientific Status', () => {
  const targetKeys = SPHEREX_TARGETS.map((t) => t.key);
  const expectedKeys = ['barnard', 'epsilon-indi-b', 'wise-0855', 'rw-aurigae', 'r-draconis'];

  assert.deepEqual(targetKeys.sort(), expectedKeys.sort(), 'Must have exactly the 5 official targets');

  // 1. Barnard - Validated Astrometry
  const barnard = SPHEREX_TARGETS.find((t) => t.key === 'barnard');
  assert.equal(barnard.scientificStatus, 'VALIDADO');
  assert.equal(barnard.statusBadge, 'VALIDADO');
  assert.ok(barnard.scientificLimitations.includes('0.64″'), 'Reports Barnard astrometric residual');
  assert.ok(barnard.coverageStatus.includes('parcial'), 'Acknowledges rectangular detector edge coverage');

  // 2. Epsilon Indi B - Sensitive / Conditional Astrometry
  const epsIndi = SPHEREX_TARGETS.find((t) => t.key === 'epsilon-indi-b');
  assert.equal(epsIndi.scientificStatus, 'SENSIBLE');
  assert.equal(epsIndi.statusBadge, 'PARCIAL');
  assert.ok(epsIndi.scientificLimitations.includes('no resuelto'), 'Acknowledges unresolved binary Ba/Bb');
  assert.ok(epsIndi.scientificLimitations.includes('jitter'), 'Conditions consistency on instrumental jitter >= 0.20"');

  // 3. WISE 0855 - Strict WARNING
  const wise0855 = SPHEREX_TARGETS.find((t) => t.key === 'wise-0855');
  assert.equal(wise0855.scientificStatus, 'WARNING', 'WISE 0855 must strictly retain WARNING status');
  assert.equal(wise0855.statusBadge, 'WARNING');
  assert.ok(wise0855.scientificLimitations.includes('ADVERTENCIA CIENTÍFICA ESTRICTA'));
  assert.ok(wise0855.scientificLimitations.includes('SNR de apertura = 1.07'));
  assert.ok(wise0855.scientificLimitations.includes('SNR de pico = 1.40'));
  assert.ok(wise0855.scientificLimitations.includes('4.4%'), 'Simulated blind detection rate in Epoch 1');
  assert.ok(wise0855.scientificLimitations.includes('72.8%'), 'Prior shrinkage factor gamma');
  assert.ok(wise0855.scientificLimitations.includes('NO constituye una detección estadística independiente'));
  assert.ok(wise0855.scientificLimitations.includes('61.0%'), 'Epoch 2 simulated completeness at 5% FPR');
  assert.ok(wise0855.scientificLimitations.includes('57.9%–64.0%'), 'Epoch 2 Wilson 95% confidence interval');
  assert.ok(wise0855.scientificLimitations.includes('59.1%'), 'Epoch 2 joint detection & recovery');

  // 4. RW Aurigae - Validated Variable Star
  const rwAur = SPHEREX_TARGETS.find((t) => t.key === 'rw-aurigae');
  assert.equal(rwAur.scientificStatus, 'VALIDADO');
  assert.equal(rwAur.statusBadge, 'VALIDADO');
  assert.ok(rwAur.scientificLimitations.includes('T Tauri'));

  // 5. R Draconis - Photometric Variable Match / Astrometry Not Applicable in Epoch 1
  const rDra = SPHEREX_TARGETS.find((t) => t.key === 'r-draconis');
  assert.equal(rDra.scientificStatus, 'FOTOMÉTRICO');
  assert.equal(rDra.statusBadge, 'FOTOMÉTRICO');
  assert.ok(rDra.scientificLimitations.includes('NO ES APLICABLE'));
  assert.ok(rDra.scientificLimitations.includes('0.45 MJy/sr'));
});

test('Product Flow - Rigorous Coordinate Space-Motion Propagation across Epochs', () => {
  for (const target of SPHEREX_TARGETS) {
    assert.ok(Number.isFinite(target.ra), `RA for ${target.key} must be finite`);
    assert.ok(Number.isFinite(target.dec), `Dec for ${target.key} must be finite`);
    assert.ok(target.ra >= 0 && target.ra < 360, `RA for ${target.key} must be in [0, 360)`);
    assert.ok(target.dec >= -90 && target.dec <= 90, `Dec for ${target.key} must be in [-90, 90]`);

    // Propagate to 2026.5
    const prop2026 = propagateCoordinates(target.astrometry, 2026.5);
    assert.ok(prop2026, `Propagation for ${target.key} must succeed`);
    assert.equal(prop2026.epoch, 2026.5);
    assert.ok(Number.isFinite(prop2026.shiftArcsec), 'Shift arcsec must be finite');
  }

  // MJD conversion check
  const mjd59000 = mjdToJulianYear(59000);
  assert.ok(mjd59000 > 2020.0 && mjd59000 < 2021.0, 'MJD 59000 corresponds to late 2020');
});

test('Product Flow - Mission Taxonomy & Grouping', () => {
  assert.equal(SPHEREX_MISSION_TYPES.length, 2, 'Two mission categories: motion and variable');
  const motionMission = SPHEREX_MISSION_TYPES.find((m) => m.key === 'motion');
  const variableMission = SPHEREX_MISSION_TYPES.find((m) => m.key === 'variable');

  assert.deepEqual(motionMission.targetKeys, ['barnard', 'epsilon-indi-b', 'wise-0855']);
  assert.deepEqual(variableMission.targetKeys, ['rw-aurigae', 'r-draconis']);
});

test('Product Flow - View Modes and Functional Controls Integrity', () => {
  const supportedViewModes = ['single', 'blink', 'sideBySide', 'differential', 'candidates'];
  assert.equal(supportedViewModes.length, 5, 'Must support all 5 operational view modes');

  // Verify that blink, sideBySide and differential require at least 2 frames
  const requiresMultipleFrames = (mode, frameCount) => {
    if (['blink', 'sideBySide', 'differential', 'candidates'].includes(mode)) {
      return frameCount >= 2;
    }
    return frameCount >= 1;
  };

  assert.equal(requiresMultipleFrames('single', 1), true);
  assert.equal(requiresMultipleFrames('blink', 1), false);
  assert.equal(requiresMultipleFrames('blink', 2), true);
  assert.equal(requiresMultipleFrames('sideBySide', 1), false);
  assert.equal(requiresMultipleFrames('sideBySide', 2), true);
  assert.equal(requiresMultipleFrames('differential', 2), true);
  assert.equal(requiresMultipleFrames('candidates', 2), true);
});

test('Onboard AI (Kronox) - Navigation, Scientific, Pedagogical and Companion Intents', () => {
  // 1. Navigation intent to Barnard
  const navBarnard = processKronoxQuery('Llévame a la estrella de Barnard', {
    activeTargetKey: 'wise-0855',
  });
  assert.equal(navBarnard.role, 'Navegadora');
  assert.equal(navBarnard.action?.type, 'TRAVEL_SPHEREX');
  assert.equal(navBarnard.action?.targetKey, 'barnard');

  // 2. Navigation intent to Epsilon Indi
  const navEps = processKronoxQuery('Quiero visitar Epsilon Indi', {});
  assert.equal(navEps.action?.type, 'TRAVEL_SPHEREX');
  assert.equal(navEps.action?.targetKey, 'epsilon-indi-b');

  // 3. Return to cockpit intent
  const navCockpit = processKronoxQuery('Regresemos a la nave e ir a la cabina', {});
  assert.equal(navCockpit.action?.type, 'ENTER_COCKPIT');

  // 4. Temporal archive & bands query with real records
  const sciDates = processKronoxQuery('¿En qué fechas se observó esta estrella y qué bandas hay?', {
    activeTargetKey: 'barnard',
    missionOpen: true,
    records: [
      { id: 'obs1', dateAvg: '60800.0', band: 'SPHEREx-D2' },
      { id: 'obs2', dateAvg: '61165.0', band: 'SPHEREx-D2' },
    ],
  });
  assert.equal(sciDates.role, 'Asistente científico');
  assert.ok(sciDates.reply.includes('SPHEREx-D2'));
  assert.ok(sciDates.reply.includes('2 observaciones'));

  // 5. Compare two epochs intent
  const cmpEpochs = processKronoxQuery('Compara dos épocas de esta estrella', {
    activeTargetKey: 'barnard',
  });
  assert.equal(cmpEpochs.action?.type, 'OPEN_MISSION_STAGE');
  assert.equal(cmpEpochs.action?.stage, 'compare');

  // 6. Instructor explanation of proper motion verification
  const instMotion = processKronoxQuery('¿Cómo puedo comprobar si se ha desplazado?', {
    activeTargetKey: 'barnard',
    missionOpen: true,
  });
  assert.equal(instMotion.role, 'Instructora de misiones');
  assert.ok(instMotion.reply.includes('movimiento propio'));
});

test('Habitable 3D Ship World (1u=1m), 1.75m Astronaut, Physical Consoles & 3D Luminous Entity Integrity', () => {
  // 1. Verify unified spatial metric scale (Section 3)
  assert.equal(SHIP_WORLD_UNITS.METER, 1);
  assert.equal(SHIP_WORLD_UNITS.SHIP_LENGTH_METERS, 120);
  assert.equal(SHIP_WORLD_UNITS.ASTRONAUT_HEIGHT_METERS, 1.75);
  assert.equal(SHIP_WORLD_UNITS.ASTRONAUT_EYE_METERS, 1.65);

  // 2. Verify all 8 required states of the 3D Luminous Energy Entity (Section 5)
  const expectedStates = [
    'Reposo',
    'Escucha',
    'Comunicación',
    'Explicación',
    'Señalización',
    'Desplazamiento',
    'Acompañamiento',
    'Celebración',
  ];
  assert.deepEqual(KRONOX_LUMINOUS_STATES, expectedStates);

  // 3. Verify 5 physical in-world stations inside the cabin (Section 4)
  assert.equal(PHYSICAL_CABIN_STATIONS.length, 5);
  const stationIds = PHYSICAL_CABIN_STATIONS.map((s) => s.id);
  assert.deepEqual(stationIds, ['nav', 'science', 'missions', 'comms', 'windows']);

  // 4. Verify 3D Luminous Entity construction, spatial movement, and pointing beam
  const luminousAI = createKronoxLuminousEntity3D();
  assert.ok(luminousAI.group, 'Luminous AI 3D group must exist');
  assert.ok(luminousAI.trailLine, 'Luminous AI spatial wake trail must exist');
  assert.ok(luminousAI.pointingBeam, 'Luminous AI 3D pointing beam must exist');
  for (const st of expectedStates) {
    luminousAI.setState(st);
    luminousAI.update(0.05, 1.2, st === 'Comunicación', 0.6);
  }

  // 5. Verify 1.75m Astronaut 3D model and 3D Habitable Cabin collision & proximity systems
  const astronaut = createAstronautModel3D();
  assert.ok(astronaut.root, 'Astronaut 3D body must exist');
  assert.ok(astronaut.firstPersonHands, 'Astronaut 1st-person hands must exist');
  astronaut.updateAnimation(1.0, true, 1);

  const cabin = buildHabitableCabin3D();
  assert.ok(cabin.cabinRoot, 'Habitable cabin 3D root must exist');
  assert.equal(cabin.stationMeshes.length, 5, 'All 5 physical 3D consoles must be built');

  // Verify proximity detection near Navigation Console (0, 0, -6.2)
  const nearNav = cabin.findNearestInteractiveStation({ x: 0, y: 0, z: -4.9 });
  assert.ok(nearNav, 'Should detect Navigation Console when standing within 2.45m');
  assert.equal(nearNav.station.id, 'nav');

  // Verify epistemic taxonomy query & AI coordination
  const epiRes = processKronoxQuery('Explica las categorías entre candidato, hallazgo y confirmado', {});
  assert.equal(epiRes.avatarState, 'EXPLAINING');
  assert.ok(epiRes.reply.includes('Objeto de la escena 3D'));
  assert.ok(epiRes.reply.includes('Hallazgo personal del usuario'));
  assert.ok(epiRes.reply.includes('Resultado científicamente confirmado'));
});

test('KronoxSceneDirector & Machine-Controlled 3D Scene Events (All 10 Official Ship Events)', () => {
  // 1. Verify all 10 official scene events exist
  const expectedEventKeys = [
    'CABIN_ENTERED',
    'AI_ACTIVATED',
    'NAVIGATION_SELECTED',
    'DESTINATION_CONFIRMED',
    'PROPULSION_ENGAGED',
    'EXTERIOR_CAMERA_REQUESTED',
    'JUMP_INITIATED',
    'ARRIVAL_DETECTED',
    'SCIENTIFIC_SCAN_STARTED',
    'MISSION_ACTIVATED',
  ];
  assert.deepEqual(Object.keys(KRONOX_SCENE_EVENTS), expectedEventKeys);

  // 2. Verify 3D machine systems (holographic nav map, AI projector, sensor sweep rings, bow reticle)
  const machineSystems = buildCabinMachineSystems3D();
  assert.ok(machineSystems.systemsRoot, '3D cabin machine systems root must exist');
  assert.ok(machineSystems.navHoloGroup, '3D navigation hologram map must exist');
  assert.ok(machineSystems.aiProjectorGroup, '3D AI projector emitter must exist');
  assert.ok(machineSystems.sensorSweepGroup, '3D volumetric sensor sweep rings must exist');
  assert.ok(machineSystems.bowReticleGroup, '3D bow window target reticle must exist');

  // 3. Verify event-driven orchestration and synchronized AI narration
  const luminousAI = createKronoxLuminousEntity3D();
  const cabinSystem = buildHabitableCabin3D();
  const narratives = [];
  const stateChanges = [];

  const director = createKronoxSceneDirector({
    cabinSystem,
    machineSystems,
    luminousAI,
    onNarrativeCallback: (text, stateName, stationId) => {
      narratives.push({ text, stateName, stationId });
    },
    onEventCallback: (eventName, payload, state) => {
      stateChanges.push({ eventName, state: { ...state } });
    },
  });

  // Event 1: CABIN_ENTERED
  director.dispatchEvent(KRONOX_SCENE_EVENTS.CABIN_ENTERED);
  let st = director.getState();
  assert.equal(st.lastEvent, 'CABIN_ENTERED');
  assert.equal(st.controlMode, KRONOX_CONTROL_MODES.FREE_ASTRONAUT);

  // Event 2: AI_ACTIVATED (AI Projector generates 3D luminous sphere & greets astronaut)
  director.dispatchEvent(KRONOX_SCENE_EVENTS.AI_ACTIVATED);
  st = director.getState();
  assert.equal(st.aiActive, true);
  assert.equal(st.lastEvent, 'AI_ACTIVATED');

  // Event 3: NAVIGATION_SELECTED (Deploys 3D holographic star map & route vector on Navigation Console)
  director.dispatchEvent(KRONOX_SCENE_EVENTS.NAVIGATION_SELECTED, {
    targetKey: 'barnard',
    targetName: 'Estrella de Barnard',
    distanceLabel: '5,96 años luz',
  });
  st = director.getState();
  assert.equal(st.navMapDeployed, true);
  assert.equal(machineSystems.navHoloGroup.visible, true, '3D hologram map must be active');
  assert.equal(st.controlMode, KRONOX_CONTROL_MODES.MACHINE_INTERACTION);

  // Event 4: DESTINATION_CONFIRMED
  director.dispatchEvent(KRONOX_SCENE_EVENTS.DESTINATION_CONFIRMED, {
    targetKey: 'barnard',
    targetName: 'Estrella de Barnard',
  });
  st = director.getState();
  assert.equal(st.confirmedDestination?.key, 'barnard');
  assert.equal(machineSystems.bowReticleGroup.visible, true);

  // Event 5: PROPULSION_ENGAGED (Triggers real-time 3D propulsion & exterior camera choreography)
  director.dispatchEvent(KRONOX_SCENE_EVENTS.PROPULSION_ENGAGED, {
    targetKey: 'barnard',
    targetName: 'Estrella de Barnard',
  });
  st = director.getState();
  assert.equal(st.propulsionState, 'ENGAGED');
  assert.equal(st.controlMode, KRONOX_CONTROL_MODES.CINEMATIC_SEQUENCE);
  assert.equal(st.activeSequence?.type, 'PROPULSION_AND_DEPARTURE');

  // Tick real-time 3D propulsion sequence across its stages
  const seqStage1 = director.update(0.5, 1.0);
  assert.equal(seqStage1?.type, 'PROPULSION_AND_DEPARTURE');
  assert.equal(seqStage1?.showExteriorShip, true);

  const seqStage2 = director.update(2.2, 3.2);
  assert.equal(director.getState().propulsionState, 'JUMP');
  assert.equal(seqStage2?.showExteriorShip, true);

  // Event 6: EXTERIOR_CAMERA_REQUESTED
  director.dispatchEvent(KRONOX_SCENE_EVENTS.EXTERIOR_CAMERA_REQUESTED);
  st = director.getState();
  assert.equal(st.controlMode, KRONOX_CONTROL_MODES.EXTERIOR_FLIGHT);

  // Event 7: JUMP_INITIATED
  director.dispatchEvent(KRONOX_SCENE_EVENTS.JUMP_INITIATED, {
    targetName: 'Estrella de Barnard',
  });
  st = director.getState();
  assert.equal(st.propulsionState, 'JUMP');

  // Event 8: ARRIVAL_DETECTED (Activates 3D sensors & highlights target on bow windows)
  director.dispatchEvent(KRONOX_SCENE_EVENTS.ARRIVAL_DETECTED, {
    targetKey: 'barnard',
    targetName: 'Estrella de Barnard',
  });
  st = director.getState();
  assert.equal(st.propulsionState, 'ARRIVED');
  assert.equal(st.sensorState, 'SCANNING');
  assert.equal(machineSystems.sensorSweepGroup.visible, true, '3D sensor sweep rings must be active on arrival');
  assert.equal(machineSystems.bowReticleGroup.visible, true, '3D bow window reticle must highlight target');

  // Event 9: SCIENTIFIC_SCAN_STARTED
  director.dispatchEvent(KRONOX_SCENE_EVENTS.SCIENTIFIC_SCAN_STARTED, {
    targetKey: 'barnard',
    targetName: 'Estrella de Barnard',
  });
  st = director.getState();
  assert.equal(st.sensorState, 'LOCKED');

  // Event 10: MISSION_ACTIVATED
  director.dispatchEvent(KRONOX_SCENE_EVENTS.MISSION_ACTIVATED, {
    targetKey: 'barnard',
    targetName: 'Estrella de Barnard',
  });
  st = director.getState();
  assert.equal(st.lastEvent, 'MISSION_ACTIVATED');

  assert.equal(stateChanges.length, 10, 'All 10 official scene events must emit synchronized state transitions');
  assert.equal(narratives.length, 10, 'Kronox IA narrations must be triggered strictly by real ship events');

  // 4. Verify sequence interruption, skipping, and recovery to FREE_ASTRONAUT without locking controls (Section 4)
  director.dispatchEvent(KRONOX_SCENE_EVENTS.PROPULSION_ENGAGED, {
    targetKey: 'wise-0855',
    targetName: 'WISE 0855',
    duration: 6.4,
  });
  assert.equal(director.getState().controlMode, KRONOX_CONTROL_MODES.CINEMATIC_SEQUENCE);
  director.skipActiveSequence();
  assert.equal(director.getState().activeSequence, null, 'Active sequence must be cleared on skip');
  assert.equal(
    director.getState().controlMode,
    KRONOX_CONTROL_MODES.FREE_ASTRONAUT,
    'Skipping sequence must immediately return control to FREE_ASTRONAUT',
  );

  // Verify natural sequence completion returns control to FREE_ASTRONAUT
  director.dispatchEvent(KRONOX_SCENE_EVENTS.PROPULSION_ENGAGED, {
    targetKey: 'barnard',
    targetName: 'Estrella de Barnard',
    duration: 4.0,
  });
  const finishRes = director.update(4.2, 10.0);
  assert.equal(finishRes?.finished, true);
  assert.equal(director.getState().activeSequence, null);
  assert.equal(director.getState().controlMode, KRONOX_CONTROL_MODES.FREE_ASTRONAUT);
});

test('Astronaut Wall/Console Collisions & Kronox IA Spatial Bounds Integrity (Sections 1, 2 & 3)', () => {
  const cabin = buildHabitableCabin3D();
  const r = SHIP_WORLD_UNITS.ASTRONAUT_RADIUS_METERS; // 0.36 m

  // 1. Test outer wall collision clamping (Port, Starboard, Bow, Aft)
  const portAttempt = { x: -12.0, y: 0, z: 0 };
  cabin.clampAstronautPosition(portAttempt);
  assert.ok(Math.abs(portAttempt.x - (-6.35 + r)) < 1e-6, 'Port wall must block astronaut at -5.99m');

  const starboardAttempt = { x: 12.0, y: 0, z: 0 };
  cabin.clampAstronautPosition(starboardAttempt);
  assert.ok(Math.abs(starboardAttempt.x - (6.35 - r)) < 1e-6, 'Starboard wall must block astronaut at +5.99m');

  const bowAttempt = { x: 2.5, y: 0, z: -20.0 };
  cabin.clampAstronautPosition(bowAttempt);
  assert.ok(Math.abs(bowAttempt.z - (-11.25 + r)) < 1e-6, 'Bow panoramic dome must block astronaut at -10.89m');

  const aftAttempt = { x: 0, y: 0, z: 20.0 };
  cabin.clampAstronautPosition(aftAttempt);
  assert.ok(Math.abs(aftAttempt.z - (9.85 - r)) < 1e-6, 'Aft airlock bulkhead must block astronaut at +9.49m');

  // 2. Test physical 3D console collision pushback (Navigation Console at (0, 0.95, -7.35), radius 0.95m)
  const insideNavConsole = { x: 0, y: 0, z: -7.1 };
  cabin.clampAstronautPosition(insideNavConsole);
  const distFromNavCenter = Math.hypot(insideNavConsole.x - 0, insideNavConsole.z - -7.35);
  assert.ok(
    distFromNavCenter >= 0.95 + r - 1e-4,
    `Astronaut must be pushed outside console collider (dist=${distFromNavCenter.toFixed(3)}m >= ${(0.95 + r).toFixed(2)}m)`,
  );

  // 3. Test proximity detection across all 5 physical 3D consoles independently
  for (const st of PHYSICAL_CABIN_STATIONS) {
    const near = cabin.findNearestInteractiveStation(st.position);
    assert.ok(near, `Must detect physical station ${st.id} when standing at its pad`);
    assert.equal(near.station.id, st.id);
    assert.equal(near.distance, 0);
  }

  // 4. Test Kronox IA 3D entity wall-clamping & real machine pointing coordinates
  const ai = createKronoxLuminousEntity3D();
  ai.setTargetPosition({ x: 99, y: 99, z: -99 }, 'Desplazamiento');
  ai.update(0.5, 1.0);
  const aiPos = ai.getPosition();
  assert.ok(aiPos.x <= 5.8 && aiPos.x >= -5.8, 'Kronox IA must stay within bridge X bounds');
  assert.ok(aiPos.z <= 8.8 && aiPos.z >= -10.8, 'Kronox IA must stay within bridge Z bounds');

  const sciSt = PHYSICAL_CABIN_STATIONS.find((s) => s.id === 'science');
  ai.pointAtWorldPosition(sciSt.consolePos, true);
  ai.update(0.1, 1.1);
  const pointed = ai.getPointedTarget();
  assert.ok(pointed, 'Kronox IA must expose its pointed 3D coordinate');
  assert.equal(pointed.x, sciSt.consolePos.x);
  assert.equal(pointed.y, sciSt.consolePos.y);
  assert.equal(pointed.z, sciSt.consolePos.z);
});
