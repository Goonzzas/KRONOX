import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { createServer } from 'vite';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';

test('Reported black screen is reproduced by the prior startup source: lab is not defined', async () => {
  const before = JSON.parse(
      zlib.gunzipSync(fs.readFileSync('docs/hotfix-startup/before.json.gz')),
    ).find((f) => f.path === 'src/scene/createScene.js'),
    source = Buffer.from(before.data, 'base64').toString('utf8'),
    harness = await createSceneHarness({ sourceOverride: source });
  try {
    await assert.rejects(harness.start(), /lab is not defined/);
  } finally {
    await harness.close();
  }
});

test('Complete scene starts, draws labels, advances the entry sequence and reenters without losing its position (CPU integration)', async () => {
  const harness = await createSceneHarness();
  try {
    const api = await harness.start();
    assert.ok(api);
    assert.ok(harness.labels.some((t) => t.includes('Sistema Solar')));
    assert.ok(harness.renderers[0].info.render.calls > 0);
    let arrived = 0;
    api.startRealTimeIntro(() => arrived++);
    harness.stepFrames(600);
    assert.equal(arrived, 1);
    assert.ok(harness.events.some((e) => e.name === 'CABIN_ENTERED'));
    assert.ok(harness.events.some((e) => e.name === 'AI_ACTIVATED'));
    const position = api.getShipPosition();
    api.reenterCabin();
    harness.stepFrames(60);
    assert.deepEqual(api.getShipPosition(), position);
    assert.equal(api.setNavigationScale('stellar'), true);
    harness.stepFrames(60);
    assert.equal(api.navigationScale().id, 'stellar');
    assert.ok(api.atlasSnapshot().contextOverview);
    assert.ok(api.atlasSnapshot().stellarSystems > 50);
    assert.equal(api.focusContextStar('sun'), true);
    harness.stepFrames(60);
    assert.equal(api.atlasSnapshot().selectedContextStar, 'sun');
    assert.equal(api.setNavigationScale('regional'), true);
    harness.stepFrames(60);
    assert.ok(api.atlasSnapshot().regionalSystems > 40);
    api.nearbyMap();
    harness.stepFrames(60);
    assert.equal(api.navigationScale().id, 'extragalactic');
    api.reenterCabin();
    harness.stepFrames(60);
    assert.deepEqual(api.getShipPosition(), position);
    assert.equal(api.atlasSnapshot().contextOverview, false);

    assert.equal(api.setNavigationScale('milkyway'), true);
    harness.stepFrames(60);
    assert.equal(api.navigationScale().id, 'milkyway');
  } finally {
    await harness.close();
  }
  assert.equal(harness.renderers[0].disposed, true);
});

test('A startup exception produces a visible retry screen instead of an empty React root', async () => {
  const server = await createServer({
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
  });
  let renderer;
  const previous = console.error;
  console.error = () => {};
  try {
    const { default: Boundary } = await server.ssrLoadModule(
      '/src/components/BootErrorBoundary.jsx',
    );
    function FailedScene() {
      React.useEffect(() => {
        throw Error('Startup regression fixture');
      }, []);
      return null;
    }
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Boundary, null, React.createElement(FailedScene)),
      );
    });
    const tree = JSON.stringify(renderer.toJSON());
    assert.ok(tree.includes('No se pudo iniciar Kronox'));
    assert.ok(tree.includes('Startup regression fixture'));
    assert.equal(renderer.root.findAllByType('button').length, 1);
  } finally {
    console.error = previous;
    if (renderer) await act(async () => renderer.unmount());
    await server.close();
  }
});

test('The real App preserves the explicitly requested welcome menu and full scene (CPU integration)', async () => {
  const harness = await createSceneHarness();
  let renderer;
  try {
    window.location.search = '?welcome=true';
    const { default: App } = await harness.server.ssrLoadModule('/src/App.jsx');
    const { default: Boundary } = await harness.server.ssrLoadModule(
      '/src/components/BootErrorBoundary.jsx',
    );
    await act(async () => {
      renderer = TestRenderer.create(
        React.createElement(Boundary, null, React.createElement(App)),
        { createNodeMock: () => harness.element },
      );
    });
    const output = JSON.stringify(renderer.toJSON());
    assert.ok(output.includes('INICIAR EXPEDICIÓN'));
    assert.ok(!output.includes('No se pudo iniciar Kronox'));
    assert.equal(harness.element.children.length, 1);
    assert.ok(harness.renderers[0].info.render.calls > 0);
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    await harness.close();
  }
});
