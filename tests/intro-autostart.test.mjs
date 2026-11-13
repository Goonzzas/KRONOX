import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';

function nodeText(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!node || typeof node !== 'object') return '';
  if (Array.isArray(node.children)) return node.children.map(nodeText).join(' ');
  return '';
}

test('Normal page load opens the Main Menu first without auto-starting intro; NUEVA PARTIDA launches the 3D ship intro and boards cabin', async () => {
  const harness = await createSceneHarness();
  let renderer;
  try {
    window.location.search = '?voice=false';
    const { default: App } = await harness.server.ssrLoadModule('/src/App.jsx');
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(App), {
        createNodeMock: () => harness.element,
      });
    });
    const initial = JSON.stringify(renderer.toJSON());
    assert.ok(initial.includes('NUEVA PARTIDA'));
    assert.ok(initial.includes('CONTINUAR'));
    assert.ok(initial.includes('HISTORIA DE LA MISIÓN'));
    assert.ok(initial.includes('CONFIGURACIÓN'));
    assert.ok(initial.includes('CRÉDITOS'));
    assert.equal(window.__kronoxSceneApi.introSnapshot().active, false);
    assert.equal(window.__kronoxSceneApi.introSnapshot().mainMenuOrbitActive, true);
    assert.equal(window.__kronoxSceneApi.getOrbitLinesVisible(), false);

    const startBtn = renderer.root
      .findAllByType('button')
      .find((b) => nodeText(b).includes('NUEVA PARTIDA'));
    assert.ok(startBtn);
    await act(async () => {
      startBtn.props.onClick();
      harness.stepFrames(2);
    });

    const duringIntro = JSON.stringify(renderer.toJSON());
    assert.equal(window.__kronoxSceneApi.introSnapshot().active, true);
    assert.equal(window.__kronoxSceneApi.introSnapshot().phase, 'opening');
    assert.ok(duringIntro.includes('Omitir / Saltar'));
    assert.ok(duringIntro.includes('Pausar'));
    assert.ok(!duringIntro.includes('ASTRAL SENTINELS'));

    await act(async () => {
      harness.stepFrames(1120);
    });
    assert.equal(window.__kronoxSceneApi.introSnapshot().active, false);
    assert.ok(window.__kronoxSceneApi.introSnapshot().cabinVisible);
    assert.ok(JSON.stringify(renderer.toJSON()).includes('Cabina 1P'));
    assert.equal(window.__kronoxSceneApi.navigationSnapshot().view, 1);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await harness.close();
  }
});

test('Direct ?welcome=false&voice=false intro supports pause, resume, and skip', async () => {
  const harness = await createSceneHarness();
  let renderer;
  try {
    window.location.search = '?welcome=false&voice=false';
    const { default: App } = await harness.server.ssrLoadModule('/src/App.jsx');
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(App), {
        createNodeMock: () => harness.element,
      });
    });
    assert.equal(window.__kronoxSceneApi.introSnapshot().phase, 'opening');

    const pauseBtn = renderer.root
      .findAllByType('button')
      .find((b) => nodeText(b).includes('Pausar'));
    assert.ok(pauseBtn);
    await act(async () => {
      pauseBtn.props.onClick();
      harness.stepFrames(10);
    });
    assert.equal(window.__kronoxSceneApi.introSnapshot().paused, true);
    assert.ok(JSON.stringify(renderer.toJSON()).includes('SECUENCIA EN PAUSA'));

    const resumeBtn = renderer.root
      .findAllByType('button')
      .find((b) => nodeText(b).includes('Reanudar'));
    assert.ok(resumeBtn);
    await act(async () => {
      resumeBtn.props.onClick();
      harness.stepFrames(2);
    });
    assert.equal(window.__kronoxSceneApi.introSnapshot().paused, false);

    const skip = renderer.root
      .findAllByType('button')
      .find((b) => nodeText(b).includes('Omitir / Saltar'));
    assert.ok(skip);
    await act(async () => {
      skip.props.onClick();
      harness.stepFrames(2);
    });
    assert.equal(window.__kronoxSceneApi.introSnapshot().active, false);
    assert.ok(window.__kronoxSceneApi.introSnapshot().cabinVisible);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await harness.close();
  }
});

test('An explicit intro=false link opens the cabin directly without playing intro', async () => {
  const harness = await createSceneHarness();
  let renderer;
  try {
    window.location.search = '?welcome=false&voice=false&intro=false';
    const { default: App } = await harness.server.ssrLoadModule('/src/App.jsx');
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(App), {
        createNodeMock: () => harness.element,
      });
    });
    await act(async () => {
      harness.stepFrames(2);
    });
    assert.equal(window.__kronoxSceneApi.introSnapshot().active, false);
    assert.ok(window.__kronoxSceneApi.introSnapshot().cabinVisible);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await harness.close();
  }
});

test('10-scene unified story lore & KRONOX ship tour intro, SPHEREx orbital scan, 1st-person cabin handoff, and orbit line visibility rules', async () => {
  const stagesSeen = [];
  const captionsSeen = [];
  const harness = await createSceneHarness({
    stateOverrides: {
      reducedMotion: () => false,
      onIntroStageChange: (stage, caption) => {
        stagesSeen.push(stage);
        if (caption) captionsSeen.push(caption);
      },
    },
  });
  try {
    const api = await harness.start();
    api.startRealTimeIntro();
    harness.stepFrames(5);

    // 1. Orbit lines must be hidden during cinematic mode
    assert.equal(api.getOrbitLinesVisible(), false);

    // Step through both Cosmic Lore Act I (with SPHEREx observatory scan) & KRONOX Ship Act II
    let spherexScanned = false;
    for (let i = 0; i < 1100; i++) {
      harness.stepFrames(1);
      const spState = api.getSpherexObservatoryState();
      if (spState?.scanning) spherexScanned = true;
    }

    assert.equal(api.introSnapshot().active, false);
    assert.equal(spherexScanned, true);
    assert.deepEqual(stagesSeen, [
      'opening',
      'escena2_spherex',
      'escena3_conocimiento',
      'escena4_galaxia',
      'escena5_nave',
      'escena6_puente',
      'escena7_spherex',
      'escena8_habitabilidad',
      'escena9_ingenieria',
      'escena10_inicio',
    ]);
    const uniqueCaptions = [...new Set(captionsSeen)];
    assert.equal(uniqueCaptions.length, 10);
    assert.ok(uniqueCaptions[0].includes('Durante siglos, contemplamos el universo'));
    assert.ok(uniqueCaptions[1].includes('NASA SPHEREx'));
    assert.ok(uniqueCaptions[2].includes('longitud de onda infrarroja'));
    assert.ok(uniqueCaptions[3].includes('Proyecto Horizonte'));
    assert.ok(uniqueCaptions[4].includes('Proyecto Horizonte construyó KRONOX'));
    assert.ok(uniqueCaptions[5].includes('puente de mando'));
    assert.ok(uniqueCaptions[6].includes('NASA SPHEREx'));
    assert.ok(uniqueCaptions[7].includes('módulo de habitabilidad'));
    assert.ok(uniqueCaptions[8].includes('reactor toroidal'));
    assert.ok(uniqueCaptions[9].includes('Soy KRONOX IA'));

    // 2. Strictly 1st-person cabin handoff at completion
    assert.equal(api.getCabinFirstPerson(), true);
    const astro = api.getAstronautPosition();
    assert.equal(astro.cabinFirstPerson, true);
    assert.equal(astro.thirdPersonAvatarVisible, false);
    assert.equal(astro.pitch, 0);
    assert.equal(astro.yaw, 0);

    // 3. Orbit lines hidden inside 1st-person cabin, visible in exterior view
    assert.equal(api.getOrbitLinesVisible(), false);
    api.view(3);
    harness.stepFrames(2);
    assert.equal(api.getOrbitLinesVisible(), true);
    api.view(1);
    harness.stepFrames(2);
    assert.equal(api.getOrbitLinesVisible(), false);
  } finally {
    await harness.close();
  }
});
