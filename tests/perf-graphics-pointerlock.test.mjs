import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneHarness } from '../scripts/test-support/sceneHarness.mjs';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  GRAPHICS_PRESET_OPTIONS,
  normalizeGraphicsPreset,
  detectHardwareCapabilities,
  resolveEffectiveGraphicsSettings,
} from '../src/scene/graphicsConfig.js';
import { buildFourDecksInterior3D } from '../src/scene/fourDecksInterior3D.js';

test('graphicsConfig normalizes legacy presets, detects hardware tiers, and resolves live overrides', () => {
  assert.deepEqual(
    GRAPHICS_PRESET_OPTIONS.map((o) => o.id),
    ['auto', 'low', 'medium', 'high'],
  );
  assert.equal(normalizeGraphicsPreset('performance'), 'low');
  assert.equal(normalizeGraphicsPreset('balanced'), 'medium');
  assert.equal(normalizeGraphicsPreset('quality'), 'high');
  assert.equal(normalizeGraphicsPreset('Automática'), 'auto');

  const swCaps = detectHardwareCapabilities({
    navigatorObj: { hardwareConcurrency: 4, deviceMemory: 8, userAgent: 'Mozilla/5.0' },
    windowObj: { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) },
    glRendererString: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))',
    maxTextureSize: 4096,
  });
  assert.equal(swCaps.isSoftwareRenderer, true);
  assert.equal(swCaps.recommendedPreset, 'low');

  const laptopCaps = detectHardwareCapabilities({
    navigatorObj: { hardwareConcurrency: 8, deviceMemory: 8, userAgent: 'Mozilla/5.0' },
    windowObj: { devicePixelRatio: 1.5, matchMedia: () => ({ matches: false }) },
    glRendererString: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)',
    maxTextureSize: 8192,
  });
  assert.equal(laptopCaps.recommendedPreset, 'medium');

  const rtxCaps = detectHardwareCapabilities({
    navigatorObj: { hardwareConcurrency: 16, deviceMemory: 16, userAgent: 'Mozilla/5.0' },
    windowObj: { devicePixelRatio: 2, matchMedia: () => ({ matches: false }) },
    glRendererString: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)',
    glVendorString: 'Google Inc. (NVIDIA)',
    maxTextureSize: 16384,
  });
  assert.equal(rtxCaps.isDedicatedGpu, true);
  assert.equal(rtxCaps.recommendedPreset, 'high');

  const autoMed = resolveEffectiveGraphicsSettings(DEFAULT_GRAPHICS_SETTINGS, {
    autoDetectedPreset: 'medium',
    devicePixelRatio: 2,
  });
  assert.equal(autoMed.preset, 'medium');
  assert.equal(autoMed.shadowsEnabled, true);
  assert.equal(autoMed.shadowMapSize, 1024);
  assert.equal(autoMed.fpsLimit, 0);

  const customLow = resolveEffectiveGraphicsSettings(
    {
      preset: 'low',
      renderScale: 0.6,
      shadowQuality: 'off',
      visualEffects: 'medium',
      fpsLimit: 60,
    },
    { autoDetectedPreset: 'high', devicePixelRatio: 1.5 },
  );
  assert.equal(customLow.preset, 'low');
  assert.equal(customLow.effectivePixelRatio, 0.6);
  assert.equal(customLow.shadowsEnabled, false);
  assert.equal(customLow.visualEffects, 'medium');
  assert.equal(customLow.fpsLimit, 60);
  assert.ok(Math.abs(customLow.minFrameIntervalMs - 1000 / 60) < 0.01);

  const clampedScale = resolveEffectiveGraphicsSettings(
    { preset: 'high', renderScale: 5, fpsLimit: null },
    { autoDetectedPreset: 'high', devicePixelRatio: 2 },
  );
  assert.equal(clampedScale.renderScale, 1.5);
  assert.equal(clampedScale.effectivePixelRatio, 2);
  assert.equal(clampedScale.fpsLimit, 0);
});

test('kronoxInterior120M culls non-active decks and indexes per-deck collision and interact lists', () => {
  const interior = buildFourDecksInterior3D();
  try {
    interior.setActiveVisibleDeck('deck-01', { elevatorActive: false, showAll: false });
    assert.equal(interior.deckContainers['deck-01'].visible, true);
    assert.equal(interior.deckContainers['deck-02'].visible, false);
    assert.equal(interior.deckContainers['deck-03'].visible, false);
    assert.equal(interior.deckContainers['deck-04'].visible, false);
    assert.equal(interior.deckOverlayGroups['deck-01'].visible, true);
    assert.equal(interior.deckOverlayGroups['deck-03'].visible, false);

    const c01Cols = interior.getCollisionMeshesForDeck('deck-01');
    const c01Ints = interior.getInteractMeshesForDeck('deck-01');
    assert.ok(c01Cols.length > 0 && c01Cols.length < interior.cameraCollisionMeshes.length);
    assert.ok(c01Ints.length > 0 && c01Ints.length < interior.interactRaycasterMeshes.length);

    interior.setActiveVisibleDeck('deck-02', { elevatorActive: true, showAll: false });
    assert.equal(interior.deckContainers['deck-02'].visible, true);
    assert.equal(interior.deckContainers['deck-01'].visible, true);
    assert.equal(interior.deckContainers['deck-03'].visible, true);
    assert.equal(interior.deckContainers['deck-04'].visible, false);
  } finally {
    interior.dispose();
  }
});

test('createScene supports Pointer Lock camera look, ESC pause unlock, drag fallback, and live graphics updates', async () => {
  let escapeCalls = 0;
  let lastGraphics = null;
  let lastPlState = null;

  const harness = await createSceneHarness({
    stateOverrides: {
      quality: 'balanced',
      onPointerLockEscape: () => {
        escapeCalls += 1;
      },
      onGraphicsStateChange: (info) => {
        lastGraphics = info;
      },
      onPointerLockChange: (st) => {
        lastPlState = st;
      },
    },
  });

  try {
    const docListeners = new Map();
    const canvasListeners = new Map();
    const origDocAdd = globalThis.document.addEventListener;
    globalThis.document.addEventListener = (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
      return origDocAdd.call(globalThis.document, type, fn);
    };
    const origCreateElement = globalThis.document.createElement;
    globalThis.document.pointerLockElement = null;
    globalThis.document.exitPointerLock = () => {
      globalThis.document.pointerLockElement = null;
      docListeners.get('pointerlockchange')?.forEach((fn) => fn());
    };
    globalThis.document.createElement = (tag) => {
      const el = origCreateElement.call(globalThis.document, tag);
      if (String(tag).toLowerCase() === 'canvas') {
        const origElAdd = el.addEventListener;
        el.addEventListener = (type, fn) => {
          if (!canvasListeners.has(type)) canvasListeners.set(type, new Set());
          canvasListeners.get(type).add(fn);
          return origElAdd.call(el, type, fn);
        };
        el.requestPointerLock = () => {
          globalThis.document.pointerLockElement = el;
          docListeners.get('pointerlockchange')?.forEach((fn) => fn());
        };
      }
      return el;
    };

    const api = await harness.start();
    api.skipRealTimeIntro();
    api.view(1);
    harness.stepFrames(5);

    const dom = harness.renderers[0].domElement;
    assert.equal(api.getPointerLockState().eligible, true);
    assert.equal(api.getPointerLockState().active, false);

    // Click acquires Pointer Lock without competing pointer capture
    canvasListeners.get('pointerdown')?.forEach((fn) =>
      fn({ button: 0, pointerId: 1, pointerType: 'mouse', clientX: 640, clientY: 400 }),
    );
    assert.equal(globalThis.document.pointerLockElement, dom);
    assert.equal(api.getPointerLockState().active, true);
    assert.equal(lastPlState.active, true);

    // Mouse move rotates camera smoothly WITHOUT holding drag button
    const yawBefore = api.getAstronautPosition().yaw;
    canvasListeners.get('pointermove')?.forEach((fn) =>
      fn({ movementX: -24, movementY: 8 }),
    );
    harness.stepFrames(6);
    const yawAfter = api.getAstronautPosition().yaw;
    assert.ok(yawAfter > yawBefore + 0.02, `Expected yaw to rotate on free mouse move (${yawBefore} -> ${yawAfter})`);

    // External ESC release (browser exits Pointer Lock) triggers Pause callback
    globalThis.document.pointerLockElement = null;
    docListeners.get('pointerlockchange')?.forEach((fn) => fn());
    assert.equal(escapeCalls, 1);

    // Programmatic exit when switching to Exterior must NOT re-trigger ESC pause
    api.requestPointerLock();
    assert.equal(api.getPointerLockState().active, true);
    api.view(3);
    harness.stepFrames(3);
    assert.equal(globalThis.document.pointerLockElement, null);
    assert.equal(api.getPointerLockState().eligible, false);
    assert.equal(escapeCalls, 1);

    // Live graphics preset & resolution updates without restart
    api.view(1);
    const updated = api.setGraphicsSettings({
      preset: 'low',
      renderScale: 0.6,
      shadowQuality: 'off',
      fpsLimit: 60,
    });
    assert.equal(updated.effective.preset, 'low');
    assert.equal(updated.effective.shadowsEnabled, false);
    assert.equal(harness.renderers[0].getPixelRatio(), 0.6);
    assert.equal(lastGraphics.effective.fpsLimit, 60);

    // Progressive loading queue advances cleanly on flush
    const beforeLoad = api.getProgressiveLoadingState();
    api.flushProgressiveAssets(16);
    const afterLoad = api.getProgressiveLoadingState();
    assert.ok(afterLoad.loaded >= beforeLoad.loaded);
  } finally {
    await harness.close();
  }
});

test('createScene falls back cleanly to drag camera control when Pointer Lock is unsupported', async () => {
  const harness = await createSceneHarness();
  try {
    const canvasListeners = new Map();
    const origCreateElement = globalThis.document.createElement;
    globalThis.document.createElement = (tag) => {
      const el = origCreateElement.call(globalThis.document, tag);
      if (String(tag).toLowerCase() === 'canvas') {
        const origElAdd = el.addEventListener;
        el.addEventListener = (type, fn) => {
          if (!canvasListeners.has(type)) canvasListeners.set(type, new Set());
          canvasListeners.get(type).add(fn);
          return origElAdd.call(el, type, fn);
        };
      }
      return el;
    };

    const api = await harness.start();
    api.skipRealTimeIntro();
    api.view(1);
    harness.stepFrames(4);

    assert.equal(api.getPointerLockState().supported, false);
    const yawBefore = api.getAstronautPosition().yaw;
    canvasListeners.get('pointerdown')?.forEach((fn) =>
      fn({ button: 0, pointerId: 1, pointerType: 'mouse', clientX: 640, clientY: 400 }),
    );
    assert.equal(api.getPointerLockState().fallbackMode, true);
    canvasListeners.get('pointermove')?.forEach((fn) =>
      fn({ movementX: -20, movementY: 0 }),
    );
    harness.stepFrames(5);
    assert.ok(api.getAstronautPosition().yaw > yawBefore + 0.01);
  } finally {
    await harness.close();
  }
});
