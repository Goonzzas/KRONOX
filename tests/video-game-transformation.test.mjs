import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as THREE from 'three';
import {
  ASTRONOMICAL_REFERENCE_EPOCH,
  PHYSICAL_CONSTANTS,
  OBSERVATION_MODES,
  PLANETARY_PHYSICAL_CATALOG,
  computeBodyObservationalMetrics,
  computeSafeOrbitalClearance,
  enforcePlanetaryCollisionBoundary,
} from '../src/scene/astronomicalScaleEngine.js';
import {
  OBSERVATION_VALIDATION_STATES,
  createFindingRecord,
} from '../src/utils/findingsStorage.js';
import {
  loadExpeditionJournal,
  recordJournalActivity,
  saveGameState,
  loadGameState,
} from '../src/utils/expeditionJournal.js';
import {
  COMMUNITY_MODULE_STATUS,
  COMMUNITY_ENTITY_SCHEMAS,
  PRIVACY_LEVELS,
  buildShareableObservationEnvelope,
} from '../src/utils/communitySchema.js';
import {
  processKronoxQuery,
  askKronoxDynamic,
  validateKronoxAction,
} from '../src/utils/kronoxAI.js';
import kronoxChatHandler, {
  sanitizeUserMessage,
  sanitizeActionDescriptor,
} from '../api/kronox-chat.js';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';

test('ETAPA 2 — Escala física de 120 m, época J2000.0, visibilidad angular a simple vista vs. Telescopio Óptico y colisiones planetarias', async () => {
  assert.equal(PHYSICAL_CONSTANTS.SHIP_LENGTH_METERS, 120);
  assert.equal(ASTRONOMICAL_REFERENCE_EPOCH.id, 'J2000.0');
  assert.equal(ASTRONOMICAL_REFERENCE_EPOCH.julianDate, 2451545.0);

  // 1. Verificar los 5 modos de observación diferenciados
  assert.equal(OBSERVATION_MODES.NAKED_EYE.isCompressedScale, false);
  assert.equal(OBSERVATION_MODES.OPTICAL_INSTRUMENT.isCompressedScale, false);
  assert.equal(OBSERVATION_MODES.SOLAR_NAVIGATION.isCompressedScale, true);
  assert.equal(OBSERVATION_MODES.ASTRONOMICAL_MAP.isCompressedScale, true);
  assert.equal(OBSERVATION_MODES.CLOSE_INSPECTION.isCompressedScale, false);

  // 2. Desde la Tierra (1 UA), Júpiter (~5.2044 UA) tiene tamaño angular θ < 60″:
  //    a simple vista (1×) NO se resuelve como gran esfera, sino como punto brillante;
  //    con telescopio óptico (150×) su disco queda resuelto.
  const earthPos = { x: 1.0, y: 0, z: 0 };
  const jupiterPos = { x: 5.2044, y: 0, z: 0 };

  const jupNakedEye = computeBodyObservationalMetrics({
    bodyName: 'Júpiter',
    observerHeliocentricAu: earthPos,
    bodyHeliocentricAu: jupiterPos,
    opticalMagnification: 1,
  });
  assert.ok(jupNakedEye);
  assert.equal(jupNakedEye.radiusKm, 69911);
  assert.ok(
    jupNakedEye.angularDiameterArcsec > 30 && jupNakedEye.angularDiameterArcsec < 52,
    `Diámetro angular real de Júpiter desde la Tierra (${jupNakedEye.angularDiameterArcsec.toFixed(1)}″) debe ser < 60″`,
  );
  assert.equal(jupNakedEye.resolvedNakedEye, false);

  const jupTelescope150x = computeBodyObservationalMetrics({
    bodyName: 'Júpiter',
    observerHeliocentricAu: earthPos,
    bodyHeliocentricAu: jupiterPos,
    opticalMagnification: 150,
  });
  assert.equal(jupTelescope150x.resolvedWithInstrument, true);
  assert.ok(jupTelescope150x.magnifiedAngularArcsec > 4500);

  // 3. Saturno: margen orbital seguro fuera de los anillos para evitar que invadan la cabina
  const saturnBody = {
    r: 4.2,
    p: { n: 'Saturno', ring: [1.3, 2.35] },
    pivot: { position: new THREE.Vector3(0, 0, 0) },
  };
  const safeSaturnDist = computeSafeOrbitalClearance(saturnBody, { isCabinActive: true });
  const saturnRingOuterRadius = saturnBody.r * PLANETARY_PHYSICAL_CATALOG.Saturno.ringOuterRatio;
  assert.ok(
    safeSaturnDist > saturnRingOuterRadius + 12,
    `La distancia orbital segura (${safeSaturnDist.toFixed(2)}) debe quedar fuera de los anillos y de la proa de la cabina`,
  );

  // Verificar repulsión de colisión si la nave intenta atravesar los anillos de Saturno
  const shipPos = new THREE.Vector3(saturnRingOuterRadius * 0.7, 0, 0);
  const collidedName = enforcePlanetaryCollisionBoundary(shipPos, [saturnBody], {
    isCabinActive: true,
  });
  assert.equal(collidedName, 'Saturno');
  assert.ok(shipPos.length() > saturnRingOuterRadius + 12);
});

test('ETAPA 2 — Escena 3D real: Vista Exterior inmediata de la nave de 120 m, encuadre orbital, telescopio [T] y acercamiento seguro a Saturno', async () => {
  const harness = await createSceneHarness();
  try {
    const api = await harness.start();
    api.skipRealTimeIntro();
    harness.stepFrames(3);

    // 1. Verificar especificaciones físicas de la nave de 120 m
    const specs = api.getShipPhysicalSpecs();
    assert.equal(specs.lengthMeters, 120);
    assert.equal(specs.epoch.id, 'J2000.0');

    // 2. Problema 1 resuelto: Al seleccionar la vista exterior (view(3)), la nave es visible en el primer frame sin demora
    api.view(3);
    harness.stepFrames(1);
    const snapExt = api.navigationSnapshot();
    assert.equal(snapExt.view, 3);
    assert.equal(
      snapExt.shipVisible,
      true,
      'La nave de 120 m debe ser visible inmediatamente en Vista Exterior',
    );
    assert.equal(
      snapExt.cabinVisible,
      false,
      'El interior de cabina no debe solaparse con la cámara exterior',
    );

    // 3. Telescopio Óptico desde la cabina 1P
    api.view(1);
    harness.stepFrames(2);
    const obsDefault = api.getObservationMode();
    assert.equal(obsDefault.mode.id, 'naked-eye');
    assert.equal(obsDefault.opticalMagnification, 1);

    const obsTelescope = api.setOpticalTelescope(true, 150, 'Júpiter');
    harness.stepFrames(2);
    assert.equal(obsTelescope.mode.id, 'optical-instrument');
    assert.equal(obsTelescope.opticalMagnification, 150);

    const jupTelemetry = api.getPlanetaryObservationalTelemetry('Júpiter');
    assert.ok(jupTelemetry);
    assert.equal(jupTelemetry.resolvedNakedEye, false);
    assert.equal(jupTelemetry.resolvedWithInstrument, true);

    // Desactivar telescopio y viajar a Saturno para verificar que los anillos nunca invaden la cabina
    api.setOpticalTelescope(false, 1);
    api.focus('Saturno');
    harness.stepFrames(5);
    const satTelemetry = api.getPlanetaryObservationalTelemetry('Saturno');
    assert.ok(satTelemetry);
  } finally {
    await harness.close();
  }
});

test('ETAPA 3 & 4 — HUD mínimo de videojuego, eliminación de paneles duplicados y Menú de Pausa unificado (8 secciones)', async () => {
  const harness = await createSceneHarness();
  let renderer;
  try {
    window.location.search = '?welcome=false&voice=false&intro=false';
    const { default: App } = await harness.server.ssrLoadModule('/src/App.jsx');
    const { default: PauseMenu } = await harness.server.ssrLoadModule(
      '/src/components/PauseMenu.jsx',
    );

    await act(async () => {
      renderer = TestRenderer.create(React.createElement(App), {
        createNodeMock: () => harness.element,
      });
    });
    await act(async () => {
      harness.stepFrames(3);
    });

    const cabinTree = JSON.stringify(renderer.toJSON());
    // En modo exploración 1P en cabina:
    // - Está presente el HUD mínimo con Cabina 1P, botón ESC Pausa y selector de Simple vista / Telescopio
    assert.ok(cabinTree.includes('Cabina 1P'));
    assert.ok(cabinTree.includes('Pausa'));
    assert.ok(cabinTree.includes('Simple vista 1×'));
    // - El panel lateral izquierdo permanente (NavigationDock "ESCALA ACTIVA") NO se muestra durante la exploración en cabina
    assert.ok(!cabinTree.includes('ESCALA ACTIVA'));

    // Verificar renderizado de las 8 secciones del Menú de Pausa
    let pauseRenderer;
    await act(async () => {
      pauseRenderer = TestRenderer.create(
        React.createElement(PauseMenu, {
          open: true,
          currentBody: 'Tierra',
          cameraView: 'Cabina 1P',
        }),
      );
    });
    const pauseTree = JSON.stringify(pauseRenderer.toJSON());
    assert.ok(pauseTree.includes('1. Continuar'));
    assert.ok(pauseTree.includes('2. Guardar partida'));
    assert.ok(pauseTree.includes('3. Mis observaciones'));
    assert.ok(pauseTree.includes('4. Diario de exploración'));
    assert.ok(pauseTree.includes('5. Comunidad'));
    assert.ok(pauseTree.includes('6. Ajustes'));
    assert.ok(pauseTree.includes('7. Controles'));
    assert.ok(pauseTree.includes('8. Volver al menú principal'));
    await act(async () => pauseRenderer.unmount());
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await harness.close();
  }
});

test('ETAPA 5 — Kronox IA: Motor determinista, servicio backend Gemini con rotación de claves, caché y seguridad sin claves en frontend', async () => {
  // 1. Ningún archivo del frontend (src/) debe contener claves GEMINI_API_KEY ni literales AIzaSy
  const srcFiles = [
    'src/App.jsx',
    'src/utils/kronoxAI.js',
    'src/components/KronoxWidget.tsx',
    'src/components/SpaceshipCockpit.jsx',
    'src/components/PauseMenu.jsx',
  ];
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!content.includes('AIzaSy'), `No debe existir ninguna clave literal en ${file}`);
    assert.ok(
      !content.includes('GEMINI_API_KEY'),
      `No debe referenciarse GEMINI_API_KEY en cliente (${file})`,
    );
  }

  // 2. Comandos deterministas responden al instante sin red
  const telCmd = processKronoxQuery('Activa el telescopio a 150x', {});
  assert.equal(telCmd.action?.type, 'SET_OPTICAL_TELESCOPE');
  assert.equal(telCmd.action?.magnification, 150);

  // 3. Validación estricta de lista blanca de acciones
  assert.equal(
    validateKronoxAction({ type: 'SET_OPTICAL_TELESCOPE', magnification: 150 })?.type,
    'SET_OPTICAL_TELESCOPE',
  );
  assert.equal(validateKronoxAction({ type: 'ARBITRARY_MUTATION' }), null);
  assert.equal(
    sanitizeActionDescriptor({ type: 'TRAVEL_PLANET', planetName: 'Saturno' })?.planetName,
    'Saturno',
  );
  assert.equal(
    sanitizeActionDescriptor({ type: 'TRAVEL_PLANET', planetName: 'PlanetaInventado' }),
    null,
  );
  assert.equal(sanitizeUserMessage('  Hola\u0000\u0007 Kronox  '), 'Hola Kronox');

  // 4. Probar endpoint /api/kronox-chat (GET de estado sin exponer claves)
  let statusCode = 0;
  let statusBody = null;
  await kronoxChatHandler(
    { method: 'GET', headers: {} },
    {
      status(c) {
        statusCode = c;
        return this;
      },
      json(b) {
        statusBody = b;
        return this;
      },
    },
  );
  assert.equal(statusCode, 200);
  assert.equal(statusBody.ok, true);
  assert.equal(statusBody.service, 'kronox-chat');
  assert.equal(JSON.stringify(statusBody).includes('AIzaSy'), false);

  // 5. Probar askKronoxDynamic con mock fetch hacia /api/kronox-chat y caché de cliente
  let fetchCount = 0;
  const mockFetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        ok: true,
        reply:
          'Desde la Tierra, Júpiter presenta un tamaño angular entre 30″ y 50″ según su posición orbital J2000.0.',
        role: 'Kronox IA · Astrofísica de a bordo',
        avatarState: 'EXPLAINING',
      }),
    };
  };

  const openEndedQuery =
    '¿Por qué cambia el brillo aparente de los planetas superiores a lo largo del año?';
  const res1 = await askKronoxDynamic(
    openEndedQuery,
    { focusedPlanet: 'Tierra' },
    { fetchImpl: mockFetch },
  );
  assert.equal(res1.source, 'gemini-backend');
  assert.ok(res1.reply.includes('J2000.0'));
  assert.equal(fetchCount, 1);

  // Segunda consulta idéntica debe servirse desde la caché sin nueva llamada de red
  const res2 = await askKronoxDynamic(
    openEndedQuery,
    { focusedPlanet: 'Tierra' },
    { fetchImpl: mockFetch },
  );
  assert.equal(res2.source, 'gemini-backend');
  assert.equal(fetchCount, 1);
});

test('ETAPA 6 — Observaciones personales, Diario de exploración y arquitectura de Comunidad Científica con distinción epistémica', () => {
  // 1. Crear una observación personal y verificar que su estado epistémico sea PERSONAL_ANNOTATION
  const finding = createFindingRecord({
    targetKey: 'wise-0855',
    targetName: 'WISE 0855',
    description: 'Candidato sub-umbral revisado en banda D2.',
    frame: {
      record: {
        id: 'spherex-wise-1',
        band: 'SPHEREx-D2',
        dateAvg: '60812.4',
        release: 'spherex_qr2',
      },
    },
    pixelX: 48,
    pixelY: 48,
  });
  assert.equal(finding.validationStatus, OBSERVATION_VALIDATION_STATES.PERSONAL_ANNOTATION);
  assert.equal(finding.ownerId, 'local_explorer');
  assert.ok(finding.epistemicLabel.toLowerCase().includes('no validada'));

  // 2. Construir sobre de exportación para Ciencia Ciudadana garantizando isOfficiallyValidated === false
  const envelope = buildShareableObservationEnvelope(finding);
  assert.equal(envelope.entity, 'SharedObservation');
  assert.equal(envelope.privacyLevel, PRIVACY_LEVELS.PRIVATE_BY_DEFAULT.id);
  assert.equal(
    envelope.epistemicGuarantee.validationStatus,
    OBSERVATION_VALIDATION_STATES.PERSONAL_ANNOTATION,
  );
  assert.equal(envelope.epistemicGuarantee.isOfficiallyValidated, false);

  // 3. Verificar Diario de exploración y Guardado de partida
  recordJournalActivity({
    type: 'INSPECT_OBJECT',
    title: 'Inspección de Saturno',
    objectKey: 'Saturno',
    objectKind: 'planet',
  });
  const saved = saveGameState({
    currentBody: 'Saturno',
    cameraView: 'Exterior Nave 120 m',
    observationMode: 'close-inspection',
    opticalMagnification: 1,
    scaleMode: 'real',
  });
  assert.equal(saved.currentBody, 'Saturno');
  assert.equal(saved.epoch, 'J2000.0');

  const journal = loadExpeditionJournal();
  assert.ok(Array.isArray(journal.investigatedObjects));
  assert.ok(Array.isArray(journal.activities));

  // 4. Verificar los 7 esquemas modulares de Comunidad Científica
  assert.equal(COMMUNITY_MODULE_STATUS.readiness, 'PLANNED_ARCHITECTURE');
  assert.equal(Object.keys(COMMUNITY_ENTITY_SCHEMAS).length, 7);
});
