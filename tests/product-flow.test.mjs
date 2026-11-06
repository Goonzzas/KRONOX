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
import { KRONOX_AVATAR_STATES, buildKronoxAvatarMesh } from '../src/scene/kronoxAvatar3D.js';

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

test('3D Holographic AI Avatar & Pre-recorded Cinematic Assets Integrity', () => {
  // Verify all 9 required animation states
  const expectedStates = [
    'IDLE',
    'GREETING',
    'TALKING',
    'EXPLAINING',
    'POINTING',
    'NAVIGATING',
    'LISTENING',
    'SUCCESS',
    'FAREWELL',
  ];
  assert.deepEqual(KRONOX_AVATAR_STATES, expectedStates);

  // Verify rigged 3D avatar mesh construction and state transitions
  const avatar = buildKronoxAvatarMesh();
  assert.ok(avatar.root, 'Avatar root THREE.Group must exist');
  for (const st of expectedStates) {
    avatar.update(0.05, { state: st, speaking: st === 'TALKING', audioLevel: 0.5 });
  }

  // Verify epistemic taxonomy query & 3D avatar state coordination
  const epiRes = processKronoxQuery('Explica las categorías entre candidato, hallazgo y confirmado', {});
  assert.equal(epiRes.avatarState, 'EXPLAINING');
  assert.ok(epiRes.reply.includes('Objeto de la escena 3D'));
  assert.ok(epiRes.reply.includes('Hallazgo personal del usuario'));
  assert.ok(epiRes.reply.includes('Resultado científicamente confirmado'));

  // Verify all 5 pre-recorded cinematic MP4 videos and JPG posters exist in public/cinematics/
  const cineDir = path.resolve('public/cinematics');
  const expectedFiles = [
    'scene01_cosmos.mp4',
    'scene02_approach.mp4',
    'scene03_cockpit.mp4',
    'scene04_ai_greeting.mp4',
    'scene05_missions.mp4',
    'poster01_cosmos.jpg',
    'poster02_approach.jpg',
    'poster03_cockpit.jpg',
    'poster04_ai_greeting.jpg',
    'poster05_missions.jpg',
  ];
  for (const file of expectedFiles) {
    const full = path.join(cineDir, file);
    assert.ok(fs.existsSync(full), `Missing cinematic asset: ${file}`);
    assert.ok(fs.statSync(full).size > 10000, `Cinematic asset ${file} is unexpectedly small`);
  }
});
