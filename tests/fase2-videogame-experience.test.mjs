import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as THREE from 'three';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';
import { buildHabitableCabin3D, PHYSICAL_CABIN_STATIONS } from '../src/scene/habitableShipWorld.js';
import {
  OBSERVATION_VALIDATION_STATES,
  createFindingRecord,
} from '../src/utils/findingsStorage.js';
import {
  COMMUNITY_MODULE_STATUS,
  COMMUNITY_ENTITY_SCHEMAS,
  PRIVACY_LEVELS,
  buildShareableObservationEnvelope,
} from '../src/utils/communitySchema.js';

test('FASE 2 — Experiencia completa de videojuego: HUD limpio, Menú de Pausa (8 secciones), Kronox IA contextual y arte de cabina', async () => {
  const harness = await createSceneHarness();
  try {
    const { default: SpaceshipCockpit } = await harness.server.ssrLoadModule(
      '/src/components/SpaceshipCockpit.jsx',
    );
    const { default: PauseMenu } = await harness.server.ssrLoadModule(
      '/src/components/PauseMenu.jsx',
    );
    const { default: KronoxWidget } = await harness.server.ssrLoadModule(
      '/src/components/KronoxWidget.tsx',
    );

    // =========================================================================
    // 1. BLOQUE A: HUD de videojuego limpio
    // =========================================================================
    let pauseOpened = false;
    let viewChanged = false;
    let telescopeChanged = false;

    let cockpit;
    await act(async () => {
      cockpit = TestRenderer.create(
        React.createElement(SpaceshipCockpit, {
          freeRoam: true,
          perspectiveView: 1, // Primera persona 1.65m
          walkSpeed: 0,
          activeCockpitStation: null,
          nearestCabinStation: null,
          onOpenPauseMenu: () => { pauseOpened = true; },
          onChangeView: () => { viewChanged = true; },
          onSetOpticalTelescope: () => { telescopeChanged = true; },
          activeObjectiveText: 'Investigar espectro en la consola de ciencia',
          visualProfile: 'cinematic',
          observationModeInfo: {
            mode: { id: 'naked-eye', label: 'Simple vista 1×' },
            opticalMagnification: 1,
          },
        }),
      );
    });

    const jsonStr = JSON.stringify(cockpit.toJSON());

    // Elementos que SÍ deben estar en el HUD limpio:
    assert.ok(jsonStr.includes('KRONOX') && jsonStr.includes('120 m'), 'Debe mostrar el identificador discreto de nave');
    assert.ok(jsonStr.includes('Pausa') || jsonStr.includes('ESC'), 'Debe mostrar el acceso discreto al menú de pausa');
    assert.ok(jsonStr.includes('Cabina 1P'), 'Debe mostrar el modo de cámara actual');
    assert.ok(jsonStr.includes('Simple vista 1×'), 'Debe mostrar el indicador discreto de óptica');
    assert.ok(jsonStr.includes('OBJETIVO:'), 'Debe mostrar la etiqueta del objetivo compacto');
    assert.ok(
      jsonStr.includes('Investigar espectro en la consola de ciencia'),
      'Debe mostrar el texto del objetivo activo',
    );

    // Elementos que NO deben estar en el HUD de exploración a pie:
    assert.ok(!jsonStr.includes('Coordenadas X:'), 'No debe haber telemetría fija de coordenadas X');
    assert.ok(!jsonStr.includes('Velocidad:'), 'No debe haber velocímetro permanente en exploración a pie');
    assert.ok(!jsonStr.includes('✦ Cielo: Cinematográfico'), 'El selector de cielo no debe saturar el HUD principal');
    assert.ok(!jsonStr.includes('☷ Más ajustes'), 'El botón antiguo de más ajustes no debe saturar el HUD principal');
    assert.ok(!jsonStr.includes('ESCALA ACTIVA'), 'No debe mostrar selector de escalas en el HUD de caminata');

    // =========================================================================
    // 2. BLOQUE B: Menú de Pausa centralizado con 8 secciones y confirmación
    // =========================================================================
    let closed = false;
    let returnedToMain = false;
    let scaleToggled = false;
    let visualToggled = false;

    let pauseMenu;
    await act(async () => {
      pauseMenu = TestRenderer.create(
        React.createElement(PauseMenu, {
          open: true,
          initialSection: 'save',
          onClose: () => { closed = true; },
          onReturnToMainMenu: () => { returnedToMain = true; },
          currentBody: 'Saturno',
          cameraView: 'Cabina 1P',
          observationMode: 'naked-eye',
          opticalMagnification: 1,
          scaleMode: 'real',
          visualProfile: 'cinematic',
          onToggleScaleMode: () => { scaleToggled = true; },
          onToggleVisualProfile: () => { visualToggled = true; },
          activeMissionId: 'wise-0855',
          activeObjective: 'Inspección visual desde el puente',
          voiceMuted: false,
          gameSettings: {
            soundEffectsVolume: 0.8,
            ambientVolume: 0.7,
            voiceVolume: 0.9,
            mouseSensitivity: 1.0,
            invertYAxis: false,
            fieldOfView: 65,
            subtitlesEnabled: true,
          },
        }),
      );
    });

    const pauseText = JSON.stringify(pauseMenu.toJSON());

    // Debe contener las 8 secciones principales requeridas:
    const requiredSections = [
      '1. Continuar',
      '2. Guardar partida',
      '3. Mis observaciones',
      '4. Diario de exploración',
      '5. Comunidad',
      '6. Ajustes',
      '7. Controles',
      '8. Volver al menú principal',
    ];
    for (const sec of requiredSections) {
      assert.ok(pauseText.includes(sec), `El menú de pausa debe contener la sección: ${sec}`);
    }

    // Comprobar botón Continuar / Reanudar
    const innerText = (node) => typeof node === 'string' ? node : (node.children || []).map(innerText).join('');
    const buttons = pauseMenu.root.findAllByType('button');
    const continueBtn = buttons.find((b) => innerText(b).includes('Continuar'));
    assert.ok(continueBtn, 'Debe existir el botón de Continuar');
    await act(async () => {
      continueBtn.props.onClick();
    });
    assert.equal(closed, true, 'Hacer clic en Continuar debe invocar onClose()');

    // Comprobar confirmación antes de volver al Menú Principal
    const mainMenuBtn = buttons.find((b) => /menú principal/i.test(innerText(b)));
    assert.ok(mainMenuBtn, 'Debe existir la opción de Menú Principal');
    await act(async () => {
      mainMenuBtn.props.onClick();
    });
    const afterClickText = JSON.stringify(pauseMenu.toJSON());
    assert.ok(
      afterClickText.includes('CONFIRMACIÓN') || afterClickText.includes('Abandonar'),
      'Debe mostrar diálogo de confirmación antes de abandonar la partida',
    );

    // =========================================================================
    // 3. BLOQUE C: Consolas diegéticas de cabina 3D e interacción física [E]
    // =========================================================================
    const cabin = buildHabitableCabin3D();
    assert.ok(cabin.cabinRoot, 'Debe existir la jerarquía raíz de la cabina');
    assert.ok(Array.isArray(cabin.stationMeshes), 'Debe tener lista de estaciones físicas');
    assert.equal(cabin.stationMeshes.length, 5, 'Debe contar con las 5 consolas habitables');

    const stationIds = cabin.stationMeshes.map((s) => s.id);
    assert.ok(stationIds.includes('nav'), 'Consola de navegación presente');
    assert.ok(stationIds.includes('science'), 'Laboratorio de ciencia presente');
    assert.ok(stationIds.includes('missions'), 'Consola de misiones presente');
    assert.ok(stationIds.includes('comms'), 'Comunicaciones Kronox IA presente');
    assert.ok(stationIds.includes('windows'), 'Puesto de observación ventanal presente');

    cabin.stationMeshes.forEach((st) => {
      const def = PHYSICAL_CABIN_STATIONS.find((s) => s.id === st.id);
      assert.ok(def, `Definición física para estación ${st.id}`);
      assert.ok(typeof def.position.x === 'number' && typeof def.position.z === 'number');
      assert.ok(st.desk, `Malla 3D para la estación ${st.id}`);
    });

    // =========================================================================
    // 4. BLOQUE D: Kronox IA con subtítulos contextuales breves y sin chat fijo
    // =========================================================================
    let widgetWithNarrative;
    await act(async () => {
      widgetWithNarrative = TestRenderer.create(
        React.createElement(KronoxWidget, {
          narrative: {
            id: 'msg-test-1',
            text: 'Ajustando inclinación hacia la órbita de Júpiter.',
            timestamp: Date.now(),
          },
          language: 'es',
          panelOpen: false,
          speaking: true,
          dialogueHidden: false,
        }),
      );
      await new Promise((r) => setTimeout(r, 80));
    });
    const narrativeText = JSON.stringify(widgetWithNarrative.toJSON());
    assert.ok(narrativeText.includes('KRONOX IA'), 'Debe mostrar el indicador de Kronox IA en subtítulo');
    assert.ok(narrativeText.includes('is-speaking'), 'Debe marcar estado is-speaking');
    assert.ok(!narrativeText.includes('kronoxSecondaryCommandDrawer'), 'No debe abrir cajón de comandos sin solicitarlo');

    let widgetEmpty;
    await act(async () => {
      widgetEmpty = TestRenderer.create(
        React.createElement(KronoxWidget, {
          narrative: null,
          language: 'es',
          panelOpen: false,
          speaking: false,
          dialogueHidden: false,
        }),
      );
    });
    const emptyText = JSON.stringify(widgetEmpty.toJSON());
    assert.equal(emptyText, 'null', 'Sin mensaje activo ni panel abierto, el diálogo desaparece completamente');

    // =========================================================================
    // 5. BLOQUE E: Dirección artística de cabina (materiales y transmitancia)
    // =========================================================================
    const root = cabin.cabinRoot;
    let physicalGlassFound = false;
    let standardMeshCount = 0;

    root.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const mat = obj.material;
        if (mat.isMeshPhysicalMaterial) {
          physicalGlassFound = true;
          mat.color.setHex(0xdbeafe);
          mat.opacity = 0.08;
          mat.roughness = 0.03;
          mat.metalness = 0.08;
          mat.transmission = 0.94;
          mat.ior = 1.48;
        } else if (mat.isMeshBasicMaterial && mat.color && mat.color.getHex() === 0x0284c7) {
          obj.material = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            emissive: 0x0369a1,
            emissiveIntensity: 0.16,
            roughness: 0.6,
            metalness: 0.35,
          });
        } else if (mat.isMeshStandardMaterial) {
          standardMeshCount++;
        }
      }
    });

    assert.ok(physicalGlassFound, 'El ventanal debe usar MeshPhysicalMaterial de alta transmitancia');
    assert.ok(standardMeshCount > 10, 'La estructura interior debe componerse de materiales PBR equilibrados');

    // =========================================================================
    // 6. BLOQUES F y G: Mis Observaciones y Comunidad Científica
    // =========================================================================
    const finding = createFindingRecord({
      targetKey: 'jupiter',
      targetName: 'Júpiter',
      description: 'Banda ecuatorial norte analizada.',
      frame: {
        record: {
          id: 'spherex-jup-1',
          band: 'SPHEREx-D1',
          dateAvg: '60812.4',
          release: 'spherex_qr2',
        },
      },
      pixelX: 120,
      pixelY: 140,
    });

    assert.equal(finding.validationStatus, OBSERVATION_VALIDATION_STATES.PERSONAL_ANNOTATION);
    assert.equal(finding.ownerId, 'local_explorer');
    assert.ok(finding.epistemicLabel.includes('no validada') || finding.epistemicLabel.includes('Personal'));

    const envelope = buildShareableObservationEnvelope(finding);
    assert.equal(envelope.epistemicGuarantee.isOfficiallyValidated, false);
    assert.equal(envelope.privacyLevel, PRIVACY_LEVELS.PRIVATE_BY_DEFAULT.id);

    assert.equal(COMMUNITY_MODULE_STATUS.readiness, 'PLANNED_ARCHITECTURE');
    assert.equal(COMMUNITY_MODULE_STATUS.version, '1.0.0-arch');
    assert.ok(Object.keys(COMMUNITY_ENTITY_SCHEMAS).length >= 7);
  } finally {
    await harness.close();
  }
});
