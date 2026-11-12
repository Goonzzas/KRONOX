import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {createSceneHarness} from '../scripts/test-support/sceneHarness.mjs';

for (const search of ['', '?welcome=false&voice=false']) {
  test('Page load automatically shows the prologue and boards the cabin: ' + (search || 'normal URL'), async () => {
    const harness = await createSceneHarness();
    let renderer;
    try {
      window.location.search = search;
      const {default: App} = await harness.server.ssrLoadModule('/src/App.jsx');
      await act(async () => {
        renderer = TestRenderer.create(React.createElement(App), {createNodeMock:()=>harness.element});
      });
      const initial = JSON.stringify(renderer.toJSON());
      assert.ok(initial.includes('Prólogo de la expedición'));
      assert.ok(initial.includes('ASTRAL SENTINELS'));
      assert.ok(!initial.includes('INICIAR EXPEDICIÓN'));
      assert.equal(window.__kronoxSceneApi.introSnapshot().phase, 'opening');
      await act(async () => {harness.stepFrames(850);});
      assert.equal(window.__kronoxSceneApi.introSnapshot().active, false);
      assert.ok(window.__kronoxSceneApi.introSnapshot().cabinVisible);
      assert.ok(JSON.stringify(renderer.toJSON()).includes('Cabina 1P'));
      assert.equal(window.__kronoxSceneApi.navigationSnapshot().view, 1);
      assert.ok(!JSON.stringify(renderer.toJSON()).includes('Prólogo de la expedición'));
    } finally {
      if(renderer) await act(async()=>renderer.unmount());
      await harness.close();
    }
  });
}

test('Automatic prologue can be skipped and runs again on a fresh page mount', async () => {
  const harness=await createSceneHarness();
  let renderer;
  try {
    window.location.search='?welcome=false&voice=false';
    const {default:App}=await harness.server.ssrLoadModule('/src/App.jsx');
    const mount=async()=>{await act(async()=>{renderer=TestRenderer.create(React.createElement(App),{createNodeMock:()=>harness.element});});};
    await mount();
    const skip=renderer.root.findAllByType('button').find(button=>button.children.includes('Omitir introducción'));
    assert.ok(skip);
    await act(async()=>{skip.props.onClick();harness.stepFrames(2);});
    assert.equal(window.__kronoxSceneApi.introSnapshot().active,false);
    assert.ok(window.__kronoxSceneApi.introSnapshot().cabinVisible);
    await act(async()=>renderer.unmount());renderer=null;
    await mount();
    assert.equal(window.__kronoxSceneApi.introSnapshot().phase,'opening');
    assert.ok(JSON.stringify(renderer.toJSON()).includes('Omitir introducción'));
  }finally{
    if(renderer)await act(async()=>renderer.unmount());
    await harness.close();
  }
});

test('An explicit intro=false link opens the cabin directly', async()=>{
  const harness=await createSceneHarness();let renderer;
  try{
    window.location.search='?welcome=false&voice=false&intro=false';
    const {default:App}=await harness.server.ssrLoadModule('/src/App.jsx');
    await act(async()=>{renderer=TestRenderer.create(React.createElement(App),{createNodeMock:()=>harness.element});});
    await act(async()=>{harness.stepFrames(2);});
    assert.equal(window.__kronoxSceneApi.introSnapshot().active,false);
    assert.ok(window.__kronoxSceneApi.introSnapshot().cabinVisible);
    assert.ok(!JSON.stringify(renderer.toJSON()).includes('Prólogo de la expedición'));
  }finally{if(renderer)await act(async()=>renderer.unmount());await harness.close();}
});

test('5-scene SPHEREx intro, 1st-person cabin, orientation coherence, and orbit line visibility rules', async () => {
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

    // Step through the 5 scenes and verify SPHEREx spectral scan in Scene 2
    let spherexScanned = false;
    for (let i = 0; i < 845; i++) {
      harness.stepFrames(1);
      const spState = api.getSpherexObservatoryState();
      if (spState?.scanning) spherexScanned = true;
    }

    assert.equal(api.introSnapshot().active, false);
    assert.deepEqual(stagesSeen, [
      'opening',
      'escena2_spherex',
      'escena3_conocimiento',
      'escena4_galaxia',
      'escena5_nave',
      'escena6_cabina',
    ]);
    const uniqueCaptions = [...new Set(captionsSeen)];
    assert.equal(uniqueCaptions.length, 6);
    assert.ok(uniqueCaptions[0].includes('Durante siglos, contemplamos el universo'));
    assert.ok(uniqueCaptions[1].includes('nuestros instrumentos nos permiten observar'));
    assert.ok(uniqueCaptions[2].includes('En cada longitud de onda'));
    assert.ok(uniqueCaptions[3].includes('Estrellas, mundos y galaxias guardan los rastros'));
    assert.ok(uniqueCaptions[4].includes('hemos construido una nueva forma de explorar'));
    assert.ok(uniqueCaptions[5].includes('Soy KRONOX IA, tu asistente de exploración'));

    // 2. SPHEREx 3D observatory exists in polar sun-synchronous orbit (~650 km, 98 min, 98 deg)
    const spherex = api.getSpherexObservatoryState();
    assert.ok(spherex);
    assert.equal(spherex.visible, true);
    assert.equal(spherex.altitudeKm, 650);
    assert.equal(spherex.periodMinutes, 98);
    assert.equal(spherex.inclinationDeg, 98);
    assert.equal(spherexScanned, true);

    // 3. Strictly 1st-person cabin without 3rd-person human avatar
    assert.equal(api.getCabinFirstPerson(), true);
    const astro = api.getAstronautPosition();
    assert.equal(astro.cabinFirstPerson, true);
    assert.equal(astro.thirdPersonAvatarVisible, false);
    assert.equal(astro.pitch, 0);
    assert.equal(astro.yaw, 0);

    // 4. Orbit lines hidden inside 1st-person cabin, visible in exterior/map mode when fl.orb=1
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
